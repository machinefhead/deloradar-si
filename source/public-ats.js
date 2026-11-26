import { readableJobText } from './job-details.js';

// Javno dokumentirana Job Board API in Lever Postings API.
// V vsakem primeru beremo izvirni vir delodajalca, ne agregatorja.
// Dodajanje delodajalca pomeni en vnos v konfiguracijo, brez novega parserja.
export const ATS_BOARDS = [
  { id: 'planetlabs', name: 'Planet Labs', provider: 'greenhouse', board: 'planetlabs',
    url: 'https://job-boards.greenhouse.io/planetlabs' },
  { id: 'wolt', name: 'Wolt', provider: 'greenhouse', board: 'wolt',
    url: 'https://job-boards.greenhouse.io/wolt' },
  { id: 'robinhood', name: 'Robinhood', provider: 'greenhouse', board: 'robinhood',
    url: 'https://job-boards.greenhouse.io/robinhood' },
  { id: 'aleph', name: 'Aleph', provider: 'lever', board: 'aleph', location: 'Ljubljana, Slovenia',
    url: 'https://jobs.lever.co/aleph' },
  { id: 'tsmg', name: 'TSMG', provider: 'lever', board: 'tsmg', location: 'Ljubljana',
    url: 'https://jobs.lever.co/tsmg' },
];

function publicText(value) {
  const named = { scaron: 'š', Scaron: 'Š', ccaron: 'č', Ccaron: 'Č', zcaron: 'ž',
    Zcaron: 'Ž', euro: '€', hellip: '…', rsquo: '’', ldquo: '“', rdquo: '”' };
  return readableJobText(String(value || '').replace(/&([a-zA-Z]+);/g,
    (raw, name) => named[name] || raw))
    .split('\n')
    .filter(line => !/\b(?:kontaktna oseba|več informacij na telefonski|for recruitment inquiries contact)\b/i.test(line))
    .join('\n')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function dateDay(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 8_640_000_000_000_000) return '';
    value = new Date(value).toISOString();
  }
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:T|$)/.test(value)) return '';
  const day = value.slice(0, 10);
  return !Number.isNaN(Date.parse(day + 'T00:00:00Z')) ? day : '';
}

function modifiedAt(value) {
  if (value == null) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function isSlovenian(value) {
  return /\b(?:Slovenia|Slovenija|Ljubljana|Maribor|Celje|Koper|Novo mesto)\b/i.test(String(value || ''));
}

function validUrl(href, provider, board) {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:') return '';
    if (provider === 'greenhouse') return ['job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(url.hostname) &&
      url.pathname.startsWith('/' + board + '/jobs/') ? url.href : '';
    return url.hostname === 'jobs.lever.co' && url.pathname.startsWith('/' + board + '/') ? url.href : '';
  } catch { return ''; }
}

function greenhouseJob(job, config, now) {
  if (!Number.isInteger(job?.id) || !publicText(job.title)) return null;
  const location = publicText(job.location?.name || '');
  if (!isSlovenian(location)) return null;
  const url = validUrl(job.absolute_url, 'greenhouse', config.board);
  if (!url) return null;
  const deadline = dateDay(job.application_deadline);
  if (deadline && Date.parse(deadline + 'T23:59:59Z') < now) return null;
  const description = publicText(job.content);
  const department = (job.departments || []).map(item => publicText(item.name)).filter(Boolean).join(' / ');
  const company = publicText(job.company_name || config.name);
  return {
    id: 'greenhouse:' + config.board + ':' + job.id, source: config.name, company,
    title: publicText(job.title), location: location.replace(/,?\s*Slovenia\s*$/i, '').trim(),
    date: dateDay(job.first_published), deadline, url,
    ...(description ? { description } : {}),
    ...(department ? { jobCategory: department } : {}),
    ...(job.updated_at ? { lastModifiedAt: job.updated_at } : {}),
  };
}

function leverSalary(range) {
  if (!range || typeof range !== 'object') return null;
  const salary = {};
  for (const [from, to] of [['min', 'minValue'], ['max', 'maxValue']]) {
    const value = Number(range[from]);
    if (range[from] != null && range[from] !== '' && Number.isFinite(value) && value >= 0) salary[to] = value;
  }
  if (!Object.keys(salary).length) return null;
  if (range.currency) salary.currency = String(range.currency);
  if (range.interval) salary.unit = String(range.interval);
  return salary;
}

function leverJob(job, config) {
  if (typeof job?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(job.id)) return null;
  const categories = job.categories || {};
  const location = publicText(categories.location || '');
  if (job.country !== 'SI' && !isSlovenian(location)) return null;
  const url = validUrl(job.hostedUrl, 'lever', config.board);
  if (!url || !publicText(job.text)) return null;
  // Leverjev descriptionPlain vsebuje le uvod in osnovni opis. Ločeni seznami
  // nalog/zahtev ter zaključne informacije sicer ne bi prišli na DeloRadar.
  const body = job.descriptionPlain || [job.openingPlain, job.descriptionBodyPlain].filter(Boolean).join('\n');
  const sections = (job.lists || []).map(item => [item.text, item.contentPlain || item.content]
    .filter(Boolean).join('\n'));
  const description = publicText([body, ...sections, job.additionalPlain || job.additional,
    job.closingPlain || job.closing].filter(Boolean).join('\n\n'));
  const salary = leverSalary(job.salaryRange);
  const category = publicText(categories.department || categories.team || '');
  const lastModifiedAt = modifiedAt(job.updatedAt);
  return {
    id: 'lever:' + config.board + ':' + job.id, source: config.name, company: config.name,
    title: publicText(job.text), location: location.replace(/,?\s*Slovenia\s*$/i, '').trim(),
    date: dateDay(job.createdAt), deadline: '', url,
    ...(description ? { description } : {}),
    ...(category ? { jobCategory: category } : {}),
    ...(categories.commitment ? { employmentType: publicText(categories.commitment) } : {}),
    ...(job.workplaceType ? { workplaceType: publicText(job.workplaceType) } : {}),
    ...(salary ? { salary } : {}),
    ...(lastModifiedAt ? { lastModifiedAt } : {}),
  };
}

async function readJson(url, fetchImpl, timeoutMs) {
  const reply = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!reply.ok) throw Error('ATS: HTTP ' + reply.status);
  const contentType = reply.headers?.get('content-type') || '';
  if (contentType && !/json/i.test(contentType)) throw Error('ATS: nepričakovana vrsta odgovora');
  const raw = await reply.text();
  if (Buffer.byteLength(raw) > 12_000_000) throw Error('ATS: predolg JSON odgovor');
  return JSON.parse(raw);
}

// Lever v robots.txt določa sekundni razmik. Velja skupno za vse delodajalce
// na istem gostitelju in tudi ob sočasnem zagonu zbiralnikov.
let leverLastRequest = Promise.resolve();
function leverJson(url, fetchImpl, timeoutMs) {
  const request = leverLastRequest.then(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return readJson(url, fetchImpl, timeoutMs);
  });
  leverLastRequest = request.then(() => undefined, () => undefined);
  return request;
}

export async function getPublicAtsBoard(config, { fetchImpl = fetch, timeoutMs = 25_000,
  now = Date.now() } = {}) {
  if (!ATS_BOARDS.some(board => board.id === config?.id && board.board === config.board)) {
    throw Error('ATS: neznan ali nedovoljen karierni vir');
  }
  let jobs;
  if (config.provider === 'greenhouse') {
    const url = `https://boards-api.greenhouse.io/v1/boards/${config.board}/jobs?content=true`;
    const result = await readJson(url, fetchImpl, timeoutMs);
    if (!Array.isArray(result?.jobs)) throw Error('Greenhouse: neveljaven seznam');
    jobs = result.jobs.map(job => greenhouseJob(job, config, now)).filter(Boolean);
  } else {
    jobs = [];
    let complete = false;
    for (let page = 0; page < 5; page++) {
      const query = new URLSearchParams({ mode: 'json', location: config.location,
        limit: '100', skip: String(page * 100) });
      const result = await leverJson(`https://api.lever.co/v0/postings/${config.board}?${query}`, fetchImpl, timeoutMs);
      if (!Array.isArray(result)) throw Error('Lever: neveljaven seznam');
      jobs.push(...result.map(job => leverJob(job, config)).filter(Boolean));
      if (result.length < 100) { complete = true; break; }
    }
    if (!complete) throw Error('Lever: preveč strani; ni potrjeno, da je uvoz popoln');
  }
  const seen = new Set(jobs.map(job => job.id));
  if (seen.size !== jobs.length) throw Error('ATS: podvojeni ID-ji na karierni strani');
  console.log(`ATS HTTP ${config.name}: ${jobs.length} izvirnih razpisov za Slovenijo.`);
  return jobs;
}

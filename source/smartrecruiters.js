import { readableJobText } from './job-details.js';

// Javni SmartRecruiters Posting API: en državno filtriran seznam na podjetje
// in samo manjkajoče/stare podrobnosti. Ne uporabljamo iskanja po spletnih karticah.
export const SMARTRECRUITERS_BOARDS = [
  { id: 'sportradar', name: 'Sportradar', company: 'Sportradar', url: 'https://jobs.smartrecruiters.com/Sportradar' },
  { id: 'jysk', name: 'JYSK Slovenija', company: 'JYSK', url: 'https://jobs.smartrecruiters.com/JYSK' },
  { id: 'boschgroup', name: 'Bosch Group', company: 'BoschGroup', url: 'https://jobs.smartrecruiters.com/BoschGroup' },
  { id: 'primark', name: 'Primark', company: 'Primark', url: 'https://jobs.smartrecruiters.com/Primark' },
  { id: 'antonpaar1', name: 'Anton Paar', company: 'antonpaar1', url: 'https://jobs.smartrecruiters.com/antonpaar1' },
];

function plain(value) {
  return readableJobText(value).split('\n')
    .filter(line => !/^\s*(?:kontakt|contact)\s*:/i.test(line) &&
      !/\b(?:contact (?:our|the) recruiter|for recruitment inquiries|kontaktna oseba|kontaktirajte|posted by)\b/i.test(line))
    .join('\n')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '').trim();
}

function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d/.test(value)) return '';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : '';
}

function postingUrl(href, config, id) {
  try {
    const url = new URL(href);
    const parts = url.pathname.split('/').filter(Boolean);
    return url.protocol === 'https:' && url.hostname === 'jobs.smartrecruiters.com' &&
      !url.username && !url.password && !url.search && !url.hash && parts.length === 2 &&
      parts[0].toLowerCase() === config.company.toLowerCase() &&
      (parts[1] === id || parts[1].startsWith(id + '-')) ? url.href : '';
  } catch { return ''; }
}

function asSlovenian(item) {
  return String(item?.location?.country || '').toLowerCase() === 'si';
}

export function parseSmartRecruitersJob(raw, detail, config, now = Date.now()) {
  if (!SMARTRECRUITERS_BOARDS.some(b => b.id === config?.id && b.company === config.company) ||
      !raw || String(raw.id) !== String(detail?.id) || !/^\d{10,16}$/.test(String(raw.id)) ||
      !asSlovenian(raw) || !asSlovenian(detail) || detail.active === false) return null;
  const deadline = day(raw.unpublishOn || detail.unpublishOn);
  if (deadline && Date.parse(deadline + 'T23:59:59Z') < now) return null;
  const url = postingUrl(detail.postingUrl, config, String(raw.id));
  const title = plain(detail.name || raw.name);
  if (!url || !title) return null;
  const sections = detail.jobAd?.sections || {};
  const companyDescription = plain(sections.companyDescription?.text);
  const main = plain(sections.jobDescription?.text);
  const qualifications = plain(sections.qualifications?.text);
  const additional = plain(sections.additionalInformation?.text);
  const description = [companyDescription, main, qualifications, additional].filter(Boolean).join('\n\n');
  if (!description) throw Error('SmartRecruiters: manjkajo javni podatki oglasa ' + raw.id);
  const city = plain(detail.location.city || raw.location?.city);
  const category = plain(detail.department?.label || raw.department?.label || detail.function?.label);
  const employmentType = plain(detail.typeOfEmployment?.label || raw.typeOfEmployment?.label);
  const workplaceAddress = plain(detail.location.address);
  return {
    id: 'smartrecruiters:' + config.company.toLowerCase() + ':' + raw.id,
    source: config.name, company: plain(detail.company?.name || config.name), title,
    url, location: city || 'Slovenija (kraj ni naveden)', description,
    date: day(detail.releasedDate || raw.releasedDate), deadline,
    ...(qualifications ? { requirements: qualifications } : {}),
    ...(additional ? { additionalInformation: additional } : {}),
    ...(category ? { jobCategory: category } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(workplaceAddress ? { workplaceAddress } : {}),
    ...(detail.location.remote === true ? { workplaceType: 'Delo na daljavo' } :
      detail.location.hybrid === true ? { workplaceType: 'Hibridno delo' } : {}),
  };
}

let activeRequests = 0;
const waitingRequests = [];
async function readJson(url, fetchImpl, timeoutMs) {
  // Skupna omejitev vseh SmartRecruiters podjetij: največ 3 zahteve hkrati.
  if (activeRequests >= 3) await new Promise(resolve => waitingRequests.push(resolve));
  activeRequests++;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
    if (!response.ok) throw Error('SmartRecruiters: HTTP ' + response.status);
    if (!/json/i.test(response.headers.get('content-type') || '')) throw Error('SmartRecruiters: odgovor ni JSON');
    const body = await response.text();
    if (Buffer.byteLength(body) > 5_000_000) throw Error('SmartRecruiters: prevelik odgovor');
    return JSON.parse(body);
  } finally {
    activeRequests--;
    waitingRequests.shift()?.();
  }
}

function cacheFor(previous, id, title, now, maxDays = 14) {
  const job = previous.find(item => item.id === id && item.title === title);
  if (!job?.description || !job.detailsFetchedAt) return null;
  const age = now - Date.parse(job.detailsFetchedAt);
  return Number.isFinite(age) && age >= 0 && age < maxDays * 86_400_000 ? job : null;
}

export async function getPublicSmartRecruitersBoard(config, { fetchImpl = fetch, previous = [],
  now = Date.now(), timeoutMs = 25_000, maxNewDetails = 100 } = {}) {
  if (!SMARTRECRUITERS_BOARDS.some(board => board.id === config?.id && board.company === config.company)) {
    throw Error('SmartRecruiters: neznan vir');
  }
  const base = 'https://api.smartrecruiters.com/v1/companies/' + config.company + '/postings';
  const first = await readJson(base + '?country=si&limit=100&offset=0', fetchImpl, timeoutMs);
  if (!Number.isInteger(first.totalFound) || first.totalFound < 0 || first.totalFound > 500 ||
      !Array.isArray(first.content)) throw Error('SmartRecruiters: neveljavno straničenje');
  const list = [...first.content];
  for (let offset = 100; offset < first.totalFound; offset += 100) {
    const next = await readJson(base + '?country=si&limit=100&offset=' + offset, fetchImpl, timeoutMs);
    if (next.totalFound !== first.totalFound || !Array.isArray(next.content) || !next.content.length) {
      throw Error('SmartRecruiters: nepopoln seznam');
    }
    list.push(...next.content);
  }
  if (list.length !== first.totalFound || new Set(list.map(job => String(job.id))).size !== list.length ||
      list.some(job => !asSlovenian(job))) throw Error('SmartRecruiters: neskladni slovenski oglasi');
  const output = new Array(list.length);
  let requested = 0, reused = 0;
  for (let offset = 0; offset < list.length; offset += 3) {
    await Promise.all(list.slice(offset, offset + 3).map(async (raw, index) => {
      const position = offset + index;
      const id = 'smartrecruiters:' + config.company.toLowerCase() + ':' + raw.id;
      const cached = cacheFor(previous, id, plain(raw.name), now);
      if (cached) {
        output[position] = { ...cached, date: day(raw.releasedDate) || cached.date,
          location: plain(raw.location?.city) || cached.location };
        reused++;
        return;
      }
      if (requested >= maxNewDetails) {
        output[position] = { id, source: config.name, company: config.name,
          title: plain(raw.name), location: plain(raw.location?.city) || 'Slovenija (kraj ni naveden)',
          url: 'https://jobs.smartrecruiters.com/' + config.company + '/' + raw.id,
          date: day(raw.releasedDate), deadline: day(raw.unpublishOn) };
        return;
      }
      requested++;
      try {
        const detail = await readJson(base + '/' + raw.id, fetchImpl, timeoutMs);
        const parsed = parseSmartRecruitersJob(raw, detail, config, now);
        output[position] = parsed ? { ...parsed, detailsFetchedAt: new Date(now).toISOString() } : null;
      } catch (error) {
        const stale = cacheFor(previous, id, plain(raw.name), now, 30);
        if (!stale) throw error;
        output[position] = stale;
        reused++;
      }
    }));
    if (offset + 3 < list.length) await new Promise(resolve => setTimeout(resolve, 170));
  }
  const jobs = output.filter(Boolean);
  console.log(`SmartRecruiters ${config.name}: ${jobs.length} slovenskih, ${requested} HTTP opisov, ${reused} iz predpomnilnika.`);
  return jobs;
}

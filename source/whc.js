import { jobPostingDetails, readableJobText } from './job-details.js';

// WHC-jev javni seznam uporablja isti HTTP-odziv kot njegova aplikacija.
// Ne zaženemo brskalnika; ni prijave, klikanja ali skritih osebnih podatkov.
const HOST = 'https://whc-slovenia.com';
const SOURCE = 'WHC Slovenija';
const TYPES = ['work', 'heads'];
const CACHE_MS = 14 * 86_400_000;
const ENTITIES = { scaron: 'š', Scaron: 'Š', ccaron: 'č', Ccaron: 'Č',
  zcaron: 'ž', Zcaron: 'Ž', auml: 'ä', ouml: 'ö', uuml: 'ü',
  hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

function clean(value) {
  return readableJobText(String(value || '').replace(/&([a-zA-Z]+);/g, (raw, name) => ENTITIES[name] || raw));
}

function withoutPersonalContacts(value) {
  return clean(value)
    .split('\n')
    .filter(line => !/\b(?:kontaktna oseba|več informacij na telefonski|za več informacij pokličite)\b/i.test(line))
    .join('\n')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sourceLink(path) {
  if (typeof path !== 'string' || !/^\/(?:workforce|heads)\/jobs\/[a-z0-9-]+-\d{4,9}$/i.test(path)) return null;
  return HOST + path;
}

function isoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:T|$)/.test(value)) return '';
  const day = value.slice(0, 10);
  return Number.isFinite(Date.parse(day)) && new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day ? day : '';
}

function isCandidatePool(title) {
  return /(?:prijava|vpis|registracija)\s+(?:v\s+)?(?:našo\s+)?(?:bazo|bazo kandidatov|evidenco)|spontan[ae]\s+prijav/i.test(title);
}

function isSlovenianLocation(location) {
  // Nekatere kartice objavijo samo »Novo mesto«, druge »Novo mesto, Slovenia«.
  // Zavrnemo le izrecno navedene tuje države, brez ugibanja o posameznem kraju.
  return !/\b(?:croatia|hrvaška|austria|österreich|avstrija|hungary|madžarska|italy|italija|germany|nemčija|serbia|srbija|bosnia|bosna)\b/i.test(location);
}

export function parseWhcListings(html, type) {
  if (typeof html !== 'string' || html.length > 1_000_000 || !TYPES.includes(type)) throw Error('WHC: neveljaven seznam');
  const starts = [...html.matchAll(/<div class="job-card\b[^\"]*"/g)];
  const jobs = [];
  for (let index = 0; index < starts.length; index++) {
    const block = html.slice(starts[index].index, starts[index + 1]?.index ?? html.length);
    const link = block.match(/<h3\b[^>]*>\s*<a href="([^\"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i);
    const url = sourceLink(link?.[1]);
    if (!url || !url.includes('/' + (type === 'work' ? 'workforce' : 'heads') + '/jobs/')) {
      throw Error('WHC: nepričakovana povezava v kartici');
    }
    const title = clean(link[2]);
    const id = link[1].match(/-(\d{4,9})$/)?.[1];
    if (!title || !id) throw Error('WHC: kartica brez naziva ali ID');
    const location = clean(block.match(/class="meta-location\b[^\"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
    if (isCandidatePool(title) || !isSlovenianLocation(location)) continue;
    jobs.push({ id: 'whc:' + id, source: SOURCE, title, company: SOURCE,
      location: location.replace(/\s*,?\s*(?:Slovenia|Slovenija)\s*$/i, '').trim(),
      date: '', deadline: '', url });
  }
  return { jobs, cards: starts.length };
}

function detailsSection(html, headings) {
  for (const heading of headings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const next = html.match(new RegExp('<h2\\b[^>]*>\\s*' + escaped + '\\s*<\\/h2>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>', 'i'))?.[1];
    if (!next) continue;
    const text = withoutPersonalContacts(next).split('\n')
      .filter(line => !/@|\b(?:tel\.?|telefon|pokličite|kontaktna oseba)\b|\b(?:0[347]0|0[3567]\d)\s*\d{3}\s*\d{3}\b/i.test(line))
      .join('\n').trim();
    if (text) return text;
  }
  return '';
}

export function parseWhcDetails(html, listing, now = Date.now()) {
  if (typeof html !== 'string' || html.length > 1_000_000 || !listing?.url) return null;
  let posting;
  for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(match[1]);
      const candidates = Array.isArray(json) ? json : (json['@graph'] || [json]);
      posting = candidates.find(item => item?.['@type'] === 'JobPosting');
      if (posting) break;
    } catch { /* Neveljavno shemo preskočimo. */ }
  }
  if (!posting || clean(posting.title).toLowerCase() !== listing.title.toLowerCase()) return null;
  const identifier = listing.url.match(/-(\d{4,9})$/)?.[1];
  const imageId = posting.image?.match(/\/offers\/\d+\/\d+\/(\d+)\//)?.[1];
  if (imageId && imageId !== identifier) return null;
  const date = isoDay(posting.datePosted), deadline = isoDay(posting.validThrough);
  if (deadline && Date.parse(deadline + 'T23:59:59Z') < now) return null;
  // WHC pri objavi uporabi tudi HTML-entitete šumnikov, ki niso del osnovnega XML.
  const schema = jobPostingDetails({ ...posting, description: withoutPersonalContacts(posting.description) });
  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === 'string') schema[key] = withoutPersonalContacts(value);
  }
  const responsibilities = detailsSection(html, ['Naloge', 'Delovne naloge', 'Opis delovnega mesta']);
  const benefits = detailsSection(html, ['Naša ponudba', 'Nudimo', 'Kaj ponujamo']);
  const requirements = detailsSection(html, ['Pričakovanja', 'Pogoji', 'Kaj pričakujemo']);
  const description = schema.description || responsibilities;
  if (!description && !responsibilities) return null;
  const city = clean(posting.jobLocation?.address?.addressLocality || '');
  const location = listing.location || city;
  return {
    ...(date ? { date } : {}), ...(deadline ? { deadline } : {}),
    ...(location ? { location } : {}),
    ...schema, description,
    ...(responsibilities ? { responsibilities } : {}),
    ...(benefits ? { benefits } : {}),
    ...(requirements ? { requirements } : {}),
  };
}

async function requestHtml(url, fetchImpl, timeoutMs, ajax = false) {
  const reply = await fetchImpl(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job listing index)',
      ...(ajax ? { 'x-requested-with': 'XMLHttpRequest' } : {}) },
  });
  if (!reply.ok) throw Error('WHC: HTTP ' + reply.status);
  const kind = reply.headers?.get('content-type') || '';
  if (kind && !/text\/html/i.test(kind)) throw Error('WHC: odgovor ni HTML');
  const html = await reply.text();
  if (Buffer.byteLength(html) > 1_000_000) throw Error('WHC: prevelik odgovor');
  return html;
}

export async function getWhc({ fetchImpl = fetch, previous = [], maxPages = 20, maxDetails = 24,
  timeoutMs = 15_000, now = Date.now() } = {}) {
  if (!Array.isArray(previous) || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 25 ||
      !Number.isInteger(maxDetails) || maxDetails < 0 || maxDetails > 80) throw Error('WHC: neveljaven načrt');
  const jobs = [], seen = new Set();
  for (const type of TYPES) {
    let finished = false, any = false;
    for (let page = 1; page <= maxPages; page++) {
      const query = new URLSearchParams({ block: 'Recru_Ajax', ajax: '1', page: String(page), recru_type: type, lang: '10' });
      const html = await requestHtml(HOST + '/?' + query, fetchImpl, timeoutMs, true);
      const { jobs: entries, cards } = parseWhcListings(html, type);
      if (!cards) { finished = true; break; }
      if (cards > 10) throw Error('WHC: nepričakovana velikost strani ' + page);
      any = true;
      for (const entry of entries) {
        if (seen.has(entry.id)) throw Error('WHC: ponovljen ID med kategorijami ali stranmi');
        seen.add(entry.id);
        jobs.push(entry);
      }
      if (page < maxPages) await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (!any || !finished) throw Error('WHC: straničenje za ' + type + ' ni popolno');
  }
  if (!jobs.length) throw Error('WHC: ni aktualnih oglasov');

  const byId = new Map(previous.filter(item => item?.source === SOURCE).map(item => [item.id, item]));
  const pending = [];
  for (const job of jobs) {
    const old = byId.get(job.id);
    const age = now - Date.parse(old?.detailsFetchedAt || '');
    if (old?.url === job.url && old.title === job.title && old.description &&
        Number.isFinite(age) && age >= 0 && age < CACHE_MS &&
        (!old.deadline || Date.parse(old.deadline + 'T23:59:59Z') >= now)) {
      Object.assign(job, {
        ...old, id: job.id, source: job.source, url: job.url, title: job.title,
      });
      continue;
    }
    pending.push(job);
  }

  let next = 0, enriched = 0, failed = 0;
  const queue = pending.slice(0, maxDetails);
  async function worker() {
    while (next < queue.length) {
      const job = queue[next++];
      try {
        const html = await requestHtml(job.url, fetchImpl, timeoutMs);
        const details = parseWhcDetails(html, job, now);
        if (!details) throw Error('WHC: podrobnosti ne ustrezajo oglasu');
        Object.assign(job, details, { detailsFetchedAt: new Date(now).toISOString() });
        enriched++;
      } catch (error) {
        failed++;
        console.warn('WHC HTTP: opis ' + job.id + ': ' + String(error?.message || error));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
  console.log(`WHC HTTP: ${jobs.length} oglasov, ${enriched} novih opisov, ` +
    `${jobs.length - pending.length} opisov iz predpomnilnika, ${failed} neuspelih podrobnosti.`);
  return jobs;
}

// A1 Slovenija: javni WordPress REST seznam, ki ga uporablja njihova karierna
// stran, in uradni JobPosting JSON-LD na posameznem javnem oglasu.
// Brez prijavnih obrazcev, brskalnika, prijave ali tujih družb skupine A1.
import { readableJobText } from './job-details.js';

export const A1_SOURCE = 'A1 Slovenija';
export const A1_URL = 'https://jobs.a1.com/sl/job-search/';
const ORIGIN = 'https://jobs.a1.com';
const API_PATH = '/sl/wp-json/a1-group/v1/filter-jobs';
const API_URL = `${ORIGIN}${API_PATH}?per-page=30&country=slovenia`;
const MAX_PAGES = 3;
const MAX_LISTED = 90;
const MAX_DETAILS = 20;

function clean(value) {
  return readableJobText(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/.]*\d{3}[ \-/.]*\d{3,4}\b/g, '')
    .trim();
}

function exactDate(value) {
  const raw = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const date = new Date(raw + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === raw ? raw : '';
}

function deadlineInText(text) {
  const found = text.match(/\bdo\s+(?:vključno\s+)?(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/i);
  return found ? exactDate(`${found[3]}-${found[2].padStart(2, '0')}-${found[1].padStart(2, '0')}`) : '';
}

function exactJobUrl(url, id) {
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  return parsed.origin === ORIGIN && !parsed.search && !parsed.hash &&
    new RegExp(`^/sl/jobs/job/${id}-[^/]+/?$`, 'i').test(parsed.pathname);
}

export function parseA1Listing(data) {
  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.totalItems) ||
      data.totalItems < 1 || data.totalItems > MAX_LISTED ||
      !Number.isInteger(data.maxPages) || data.maxPages < 1 || data.maxPages > MAX_PAGES ||
      typeof data.nextPageUrl !== 'string') throw Error('A1: nepopoln ali prevelik javni seznam');
  const listed = [], seen = new Set();
  let foreign = 0, general = 0;
  for (const record of data.items) {
    const id = String(record?.id || '');
    if (!/^\d{2,8}$/.test(id) || seen.has(id) || !exactJobUrl(record?.url, id)) {
      throw Error('A1: podvojen ID ali neveljaven izvirni URL');
    }
    seen.add(id);
    const title = clean(record.title).slice(0, 300);
    if (!title) throw Error('A1: manjkajoč naslov');
    if (record.company !== 'A1 Slovenia' || record.dataCompany !== 'A1 Slovenia') {
      foreign++;
      continue;
    }
    if (/\b(splošna prijava|samoiniciativna prijava|baza kandidatov)\b/i.test(title)) {
      general++;
      continue;
    }
    const location = clean(record.location).slice(0, 180);
    if (!location || !record.dataLocation) throw Error('A1: slovenski oglas brez kraja');
    listed.push({ id, title, url: record.url, location,
      category: clean(record.type?.category).slice(0, 120),
      employmentType: clean(record.type?.timeType).slice(0, 80),
      workArrangement: clean(record.type?.remoteType).slice(0, 80) });
  }
  return { listed, seen, foreign, general };
}

export function parseA1Job(html, candidate, now = new Date().toISOString()) {
  if (!exactJobUrl(candidate.url, candidate.id)) throw Error('A1: neveljaven naslov podrobnosti');
  const match = String(html).match(/<script\b[^>]*type="application\/ld\+json"[^>]*class="yoast-schema-graph"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw Error('A1: uradni JobPosting ni objavljen');
  const graph = JSON.parse(match[1])?.['@graph'];
  if (!Array.isArray(graph)) throw Error('A1: nepričakovani strukturirani podatki');
  const postings = graph.filter(record => record?.['@type'] === 'JobPosting');
  if (postings.length !== 1) throw Error('A1: manjka enoličen razpis');
  const job = postings[0];
  if (job['@id'] !== candidate.url.replace(/\/$/, '') ||
      job.url !== candidate.url.replace(/\/$/, '') ||
      job.hiringOrganization !== 'A1 Slovenia') {
    throw Error('A1: naslov ali delodajalec se ne ujema');
  }
  const title = clean(job.title).slice(0, 300);
  const description = clean(job.description).slice(0, 8000);
  const locations = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
  const location = locations.map(item => clean(item?.address)).filter(Boolean).join(', ').slice(0, 180);
  const date = exactDate(job.datePosted);
  const deadline = deadlineInText(description) || exactDate(job.validThrough);
  if (title !== candidate.title || location !== candidate.location ||
      !date || !deadline || description.length < 100) {
    throw Error('A1: javni opis, kraj, datumi ali naslov se ne ujemajo');
  }
  const localToday = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit',
    day: '2-digit', timeZone: 'Europe/Ljubljana' }).format(new Date(now));
  if (deadline < localToday) return null;
  return { id: `a1:${candidate.id}`, source: A1_SOURCE, company: A1_SOURCE,
    title, location, description, date, deadline, url: candidate.url,
    ...(candidate.category ? { jobCategory: candidate.category } : {}),
    ...(candidate.employmentType ? { employmentType: candidate.employmentType } : {}),
    ...(candidate.workArrangement ? { workArrangement: candidate.workArrangement } : {}) };
}

async function publicGet(url, fetchImpl, expectJson) {
  const response = await fetchImpl(url, { redirect: 'manual',
    headers: { accept: expectJson ? 'application/json' : 'text/html',
      'user-agent': 'DeloRadar/0.1 (personal job listing index)' },
    signal: AbortSignal.timeout(20_000) });
  if (response.status !== 200 || response.headers.get('location')) {
    throw Error('A1: javni vir HTTP ' + response.status);
  }
  const maxBytes = expectJson ? 400_000 : 180_000;
  if (Number(response.headers.get('content-length') || 0) > maxBytes) throw Error('A1: prevelik odgovor');
  const body = await response.text();
  if (body.length > maxBytes) throw Error('A1: prevelik odgovor');
  return expectJson ? JSON.parse(body) : body;
}

export async function getA1({ fetchImpl = fetch, now = new Date().toISOString(), pauseMs = 500 } = {}) {
  if (!Number.isFinite(Date.parse(now)) || !Number.isInteger(pauseMs) || pauseMs < 0) {
    throw Error('A1: neveljavni parametri zajema');
  }
  const listed = [], ids = new Set();
  let url = API_URL, total, foreign = 0, general = 0;
  for (let page = 1; url && page <= MAX_PAGES; page++) {
    if (page > 1 && pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
    const data = await publicGet(url, fetchImpl, true);
    if (total === undefined) total = data.totalItems;
    if (data.totalItems !== total || data.maxPages > MAX_PAGES) {
      throw Error('A1: število oglasov se je med stranmi spremenilo');
    }
    const part = parseA1Listing(data);
    for (const id of part.seen) {
      if (ids.has(id)) throw Error('A1: ponovljen oglas na drugi strani');
      ids.add(id);
    }
    foreign += part.foreign;
    general += part.general;
    listed.push(...part.listed);
    if (data.nextPageUrl) {
      const next = new URL(data.nextPageUrl);
      if (next.origin !== ORIGIN || next.pathname !== API_PATH ||
          next.searchParams.get('country') !== 'slovenia' || next.href === url) {
        throw Error('A1: nepričakovana naslednja stran');
      }
      url = next.href;
    } else url = '';
  }
  if (url || ids.size !== total || listed.length > MAX_DETAILS || !listed.length) {
    throw Error('A1: nepopoln seznam ali preveč podrobnosti');
  }
  const jobs = [];
  for (const candidate of listed) {
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
    const html = await publicGet(candidate.url.replace(/\/$/, '') + '/', fetchImpl, false);
    const job = parseA1Job(html, candidate, now);
    if (job) jobs.push(job);
  }
  if (!jobs.length) throw Error('A1: ni aktualnih slovenskih razpisov');
  console.log(`A1 Slovenija: ${jobs.length} razpisov, ${ids.size} pregledanih kandidatov, ` +
    `${foreign} tujih družb in ${general} splošnih prijav izločenih.`);
  return { jobs, progress: { checked: ids.size, total, foreign, general, pending: false } };
}

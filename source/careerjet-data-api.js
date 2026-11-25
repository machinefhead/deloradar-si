import { readableJobText } from './job-details.js';

const API = 'https://data.api.careerjet.net/v1/';
const SITE = 'https://www.careerjet.si/';

function searchLink(title) {
  const slug = readableJobText(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
  return slug ? SITE + 'delovna-mesta-' + slug : SITE;
}

function sourceLink(value, title) {
  if (typeof value === 'string') {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
    } catch { /* Brez uporabne povezave: iskanje po naslovu. */ }
  }
  return searchLink(title);
}

function date(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

export function parseCareerjetDataJob(raw, detail = {}) {
  const id = String(raw?.job_id || '').trim();
  const title = readableJobText(detail.title || raw?.title);
  if (!/^[a-z0-9_-]{12,128}$/i.test(id) || !title) return null;
  const description = readableJobText(detail.description || raw.description);
  const location = readableJobText(detail.locations || raw.locations);
  const company = readableJobText(detail.company || raw.company);
  const url = sourceLink(detail.url || raw.url, title);
  const salary = [detail.salary_min ?? raw.salary_min, detail.salary_max ?? raw.salary_max]
    .filter(v => v !== undefined && v !== null && Number.isFinite(Number(v)))
    .map(String).join('–');
  return {
    id: 'careerjet:' + id, source: 'Careerjet', title, company, location,
    date: date(detail.date || raw.date), deadline: '', url,
    ...(description ? { description } : {}),
    ...(salary ? { salary: salary + ' ' + String(detail.salary_currency_code || raw.salary_currency_code || '').trim() } : {}),
    ...(url.startsWith(SITE + 'delovna-mesta-') ? { sourceLinkStatus: 'search' } : {}),
  };
}

export async function fetchCareerjetDataApi({ apiKey, fetchImpl = fetch, maxPages = 1,
  maxDetails = 10, previous = [], timeoutMs = 15_000 } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || /\s/.test(apiKey)) {
    throw Error('Careerjet: manjka API ključ za podatkovni dostop');
  }
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10 ||
      !Number.isInteger(maxDetails) || maxDetails < 0 || maxDetails > 100 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) {
    throw Error('Careerjet: nepravilne omejitve HTTP uvoza');
  }
  const auth = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
  async function getJson(path) {
    const url = new URL(path, API);
    if (url.origin !== new URL(API).origin) throw Error('Careerjet: nedovoljen gostitelj');
    const response = await fetchImpl(url.href, { signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json', authorization: auth } });
    if (!response.ok) throw Error('Careerjet: podatkovni API HTTP ' + response.status);
    if (!String(response.headers.get('content-type')).includes('json')) throw Error('Careerjet: odgovor ni JSON');
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) throw Error('Careerjet: prevelik odgovor');
    return JSON.parse(raw);
  }
  const listings = [];
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ locale_code: 'sl_SI', sort: 'date', page: String(page), page_size: '100' });
    const data = await getJson('query?' + params);
    if (data.type !== 'JOBS' || !Array.isArray(data.jobs)) throw Error('Careerjet: nepopoln seznam');
    listings.push(...data.jobs);
    if (page >= Math.min(data.pages || 1, 10) || data.jobs.length < 100) break;
  }
  const existing = new Map(previous.filter(j => j.source === 'Careerjet' && j.careerjetDetailFetchedAt && j.description)
    .map(j => [j.id, j]));
  const jobs = [], seen = new Set();
  let detailsRequested = 0;
  for (const raw of listings) {
    const preliminary = parseCareerjetDataJob(raw);
    if (!preliminary || seen.has(preliminary.id)) continue;
    seen.add(preliminary.id);
    const cached = existing.get(preliminary.id);
    let detail = {};
    if (!cached && detailsRequested < maxDetails) {
      detailsRequested++;
      try {
        const result = await getJson('job/' + encodeURIComponent(raw.job_id));
        if (result.type === 'JOB' && result.job && typeof result.job === 'object') detail = result.job;
      } catch (error) {
        // Ne izgubimo veljavnega zapisa iz seznama zaradi napake pri dodatnem opisu.
        console.warn('Careerjet: dodatni opis ni dosegljiv (' + String(error.message || error) + ')');
      }
    }
    const mapped = parseCareerjetDataJob(raw, detail);
    if (mapped && detail.description) mapped.careerjetDetailFetchedAt = new Date().toISOString();
    if (cached && mapped && !detail.description) {
      mapped.description = cached.description;
      mapped.careerjetDetailFetchedAt = cached.careerjetDetailFetchedAt;
    }
    if (mapped) jobs.push(mapped);
  }
  return { jobs, stats: { listingCalls: Math.min(maxPages, Math.ceil(listings.length / 100)),
    detailsRequested, descriptions: jobs.filter(x => x.description).length } };
}

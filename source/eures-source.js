import { readableJobText } from './job-details.js';

const BASE = 'https://europa.eu/eures/api/jv-searchengine/public';
const SEARCH = BASE + '/jv-search/search';

function payload(page, resultsPerPage) {
  return { page, resultsPerPage, sortSearch: 'MOST_RECENT', keywords: [], locationCodes: ['si'],
    occupationUris: [], skillUris: [], requiredExperienceCodes: [], positionScheduleCodes: [],
    sectorCodes: [], educationAndQualificationLevelCodes: [], positionOfferingCodes: [],
    euresFlagCodes: [], otherBenefitsCodes: [], requiredLanguages: [], requestLanguage: 'sl' };
}

async function json(response, limit = 3_000_000) {
  if (!response.ok) throw Error('EURES HTTP ' + response.status);
  if (!(response.headers.get('content-type') || '').includes('json')) throw Error('EURES: odgovor ni JSON');
  if (Number(response.headers.get('content-length')) > limit) throw Error('EURES: odgovor je prevelik');
  const raw = await response.text();
  if (Buffer.byteLength(raw) > limit) throw Error('EURES: odgovor je prevelik');
  return JSON.parse(raw);
}

export function euresSourceHint(id) {
  if (!/^[\w-]{8,180}$/.test(String(id || ''))) return '';
  const decoded = Buffer.from(id, 'base64url').toString('utf8');
  const match = decoded.match(/\s(\d{1,3})$/);
  return match?.[1] || '';
}

export function normalizeEuresJob(hit, detail, now = Date.now()) {
  if (!hit?.id || hit.id !== detail?.id || detail.source === 'ZRSZ') return null;
  const profiles = Object.values(detail.jvProfiles || {});
  const profile = detail.jvProfiles?.sl || profiles[0] || {};
  const siLocations = (profile.locations || []).filter(x => String(x.countryCode).toLowerCase() === 'si');
  if (!siLocations.length || !Object.keys(hit.locationMap || {}).some(x => x.toLowerCase() === 'si')) return null;
  const title = readableJobText(profile.title || hit.title);
  if (!title) return null;
  const city = siLocations.map(x => x.cityName).find(x => x && !/^slovenija$/i.test(x)) || '';
  const description = readableJobText(profile.description || hit.description);
  const deadlineStamp = profile.lastApplicationDate === null || profile.lastApplicationDate === undefined
    ? NaN : Number(profile.lastApplicationDate);
  const deadline = Number.isFinite(deadlineStamp) && deadlineStamp >= Date.UTC(2000, 0, 1) &&
    deadlineStamp <= Date.UTC(2100, 0, 1) ? new Date(deadlineStamp).toISOString().slice(0, 10) : '';
  if (deadline && Date.parse(deadline + 'T23:59:59Z') < now) return null;
  const parsedDate = Number(hit.creationDate);
  const date = Number.isFinite(parsedDate) && !Number.isNaN(new Date(parsedDate).getTime())
    ? new Date(parsedDate).toISOString() : '';
  return { id: 'eures:' + hit.id, source: 'EURES', title,
    company: readableJobText(profile.employer?.name || hit.employer?.name || ''),
    location: city || 'Slovenija (kraj ni naveden)',
    locationConfidence: city ? 'city-confirmed' : 'country-only',
    ...(deadline ? { deadline } : {}),
    date: Number.isFinite(Date.parse(date)) ? date : '',
    url: 'https://europa.eu/eures/portal/jv-se/jv-details/' + encodeURIComponent(hit.id) + '?lang=sl',
    ...(description ? { description, summary: description.slice(0, 500) } : {}),
    euresSource: String(detail.source || ''), euresReference: String(detail.reference || '') };
}

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function excludeExistingEures(jobs, existingJobs = []) {
  const seen = new Set(existingJobs.map(x => [norm(x.title), norm(x.company)].join('|')));
  const unique = [], overlaps = [];
  for (const job of jobs) {
    const key = [norm(job.title), norm(job.company)].join('|');
    if (seen.has(key) && norm(job.company).length >= 3) overlaps.push(job);
    else { unique.push(job); seen.add(key); }
  }
  return { unique, overlaps };
}

// GitHub Actions teče dvakrat dnevno. EURES-ova celotna poizvedba je dražja,
// zato rezultat z zadnje uspešne objave uporabimo največ še en naslednji zagon.
export function reuseRecentEuresJobs(previousJobs, now = Date.now(), maxAgeMs = 20 * 3600000) {
  if (!Array.isArray(previousJobs) || !Number.isFinite(now) ||
      !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return [];
  const items = previousJobs.filter(job => job?.source === 'EURES');
  if (!items.length || items.some(job => {
    const fetchedAt = Date.parse(job.euresFetchedAt || '');
    return !Number.isFinite(fetchedAt) || fetchedAt > now || now - fetchedAt >= maxAgeMs;
  })) return [];
  return items.filter(job => !job.deadline ||
    (Number.isFinite(Date.parse(job.deadline + 'T23:59:59Z')) &&
     Date.parse(job.deadline + 'T23:59:59Z') >= now)).map(job => ({ ...job }));
}

export async function fetchEuresAdditional(options = {}) {
  const { fetchImpl = fetch, pages = 1, startPage = 1, pageSize = 50,
    maxDetails = 50, concurrency = 2, searchConcurrency = 4, pauseMs = 200, existingJobs = [] } = options;
  if (![pages, startPage, pageSize, maxDetails, concurrency, searchConcurrency, pauseMs].every(Number.isInteger) ||
    pages < 1 || pages > 65 || startPage < 1 || startPage > 65 || startPage + pages - 1 > 65 ||
    pageSize < 1 || pageSize > 50 || maxDetails < 0 || maxDetails > 4000 ||
    concurrency < 1 || concurrency > 3 || searchConcurrency < 1 || searchConcurrency > 6 ||
    pauseMs < 0 || pauseMs > 10000 || !Array.isArray(existingJobs)) {
    throw Error('EURES: neveljavne meje poizvedb');
  }
  const searchHits = [];
  let totalReported = null;
  const startedAt = Date.now();
  for (let p = startPage; p < startPage + pages; p += searchConcurrency) {
    const batch = Array.from({ length: Math.min(searchConcurrency, startPage + pages - p) }, (_, i) => p + i);
    const results = await Promise.all(batch.map(async page => json(await fetchImpl(SEARCH, {
      method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(payload(page, pageSize)),
    }))));
    for (const result of results) {
      if (!Array.isArray(result.jvs) || !Number.isInteger(result.numberRecords)) throw Error('EURES: neveljaven seznam');
      searchHits.push(...result.jvs);
      totalReported = result.numberRecords;
    }
    if (results.some(result => result.jvs.length < pageSize)) break;
  }
  // Pri ZRSZ je zadnji del EURES ID-ja '14'; dejanski vir dodatno preverimo v podrobnostih.
  const candidates = [...new Map(searchHits.filter(x => x.id && euresSourceHint(x.id) !== '14')
    .map(x => [x.id, x])).values()].slice(0, maxDetails);
  const searchDurationMs = Date.now() - startedAt;
  const jobs = [], errors = [];
  let next = 0, skippedZrsz = 0, skippedLocation = 0;
  async function worker() {
    while (next < candidates.length) {
      const hit = candidates[next++];
      try {
        const detail = await json(await fetchImpl(BASE + '/jv/id/' + encodeURIComponent(hit.id) + '?requestLang=sl', {
          headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000),
        }), 500_000);
        if (detail.id !== hit.id) throw Error('EURES: neujemajoč ID');
        if (detail.source === 'ZRSZ') { skippedZrsz++; continue; }
        const job = normalizeEuresJob(hit, detail);
        if (job) jobs.push(job);
        else skippedLocation++;
      } catch (error) { errors.push({ id: hit.id, reason: String(error.message).slice(0, 100) }); }
      finally { if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs)); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));
  const { unique, overlaps } = excludeExistingEures(jobs, existingJobs);
  return { jobs: unique, stats: { totalReported, searchHits: searchHits.length,
    searchDurationMs, detailsDurationMs: Date.now() - startedAt - searchDurationMs,
    candidates: candidates.length, candidatesAvailable: searchHits.filter(x => euresSourceHint(x.id) !== '14').length,
    skippedZrsz, skippedLocation, duplicates: overlaps.length, unique: unique.length,
    cityConfirmed: unique.filter(x => x.locationConfidence === 'city-confirmed').length,
    countryOnly: unique.filter(x => x.locationConfidence === 'country-only').length,
    failures: errors.length, startPage, pages }, errors };
}

import { readableJobText } from './job-details.js';
import { extractEuresZrszCandidate } from './zrsz-eures-map.js';

const API = 'https://europa.eu/eures/api/jv-searchengine/public';
const SEARCH_URL = API + '/jv-search/search';

function query(page) {
  return { page, resultsPerPage: 50, sortSearch: 'MOST_RECENT', keywords: [],
    locationCodes: ['si'], occupationUris: [], skillUris: [], requiredExperienceCodes: [],
    positionScheduleCodes: [], sectorCodes: [], educationAndQualificationLevelCodes: [],
    positionOfferingCodes: [], euresFlagCodes: [], otherBenefitsCodes: [],
    requiredLanguages: [], requestLanguage: 'sl' };
}

async function responseJson(response, limit) {
  if (!response.ok) throw Error('EURES HTTP ' + response.status);
  if (!String(response.headers.get('content-type')).includes('json')) throw Error('EURES: ni JSON');
  const raw = await response.text();
  if (Buffer.byteLength(raw) > limit) throw Error('EURES: prevelik odgovor');
  return JSON.parse(raw);
}

function isoDate(input) {
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

export function normalizeZrszEuresHit(hit, detail, { now = Date.now() } = {}) {
  if (detail?.source !== 'ZRSZ' || detail?.id !== hit?.id) return null;
  const candidate = extractEuresZrszCandidate(detail);
  if (!candidate) return null;
  const profile = detail.jvProfiles?.sl;
  if (!profile || !Array.isArray(profile.locations) ||
      !profile.locations.some(loc => String(loc.countryCode).toLowerCase() === 'si')) return null;
  const deadline = isoDate(profile.lastApplicationDate);
  if (!deadline || Date.parse(deadline + 'T23:59:59+01:00') < now) return null;
  const title = readableJobText(profile.title || hit.title);
  if (!title) return null;
  const city = profile.locations.filter(loc => String(loc.countryCode).toLowerCase() === 'si')
    .map(loc => loc.cityName).find(Boolean) || '';
  const description = readableJobText(profile.description || hit.description);
  return { id: 'zrsz:' + candidate.reference, source: 'ZRSZ / PoiščiDelo',
    reference: candidate.reference, zrszIdCandidate: candidate.idp,
    zrszIdCandidateSource: 'EURES',
    title, company: readableJobText(profile.employer?.name || hit.employer?.name || ''),
    location: city, date: isoDate(hit.creationDate), deadline,
    ...(description ? { description } : {}),
    euresDetailUrlCandidate: 'https://europa.eu/eures/portal/jv-se/jv-details/' + candidate.euresId + '?lang=sl',
    euresDetailFreshness: 'deadline-confirmed-from-eures',
    url: 'https://europa.eu/eures/portal/jv-se/jv-details/' + candidate.euresId + '?lang=sl',
    provenance: 'eures-http-zrsz',
  };
}

export async function fetchZrszEuresBatch({ fetchImpl = fetch, startPage = 1,
  pages = 1, maxDetails = 50, concurrency = 2, pauseMs = 250, now = Date.now() } = {}) {
  if (![startPage, pages, maxDetails, concurrency, pauseMs].every(Number.isInteger) ||
      startPage < 1 || startPage > 62 || pages < 1 || pages > 5 ||
      maxDetails < 0 || maxDetails > 250 || concurrency < 1 || concurrency > 3 ||
      pauseMs < 0 || pauseMs > 10000) throw Error('EURES: neveljavne meje');
  const hits = [];
  let totalReported = 0;
  for (let p = startPage; p < startPage + pages; p++) {
    const body = await responseJson(await fetchImpl(SEARCH_URL, { method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(query(p)), signal: AbortSignal.timeout(30000),
    }), 3_000_000);
    if (!Number.isInteger(body.numberRecords) || !Array.isArray(body.jvs)) throw Error('EURES: neveljaven seznam');
    totalReported = body.numberRecords;
    hits.push(...body.jvs);
    if (!body.jvs.length) break;
  }
  const selected = [...new Map(hits.filter(x => {
    try { return Buffer.from(x.id, 'base64url').toString('utf8').endsWith(' 14'); }
    catch { return false; }
  }).map(x => [x.id, x])).values()].slice(0, maxDetails);
  const jobs = [], errors = [];
  let next = 0, outdated = 0, skipped = 0;
  async function worker() {
    while (next < selected.length) {
      const hit = selected[next++];
      try {
        const detail = await responseJson(await fetchImpl(API + '/jv/id/' + hit.id + '?requestLang=sl', {
          headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000),
        }), 500_000);
        const job = normalizeZrszEuresHit(hit, detail, { now });
        if (job) jobs.push(job);
        else if (detail.source === 'ZRSZ') outdated++;
        else skipped++;
      } catch (error) { errors.push({ id: hit.id, message: String(error.message).slice(0, 90) }); }
      if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));
  return { jobs, stats: { totalReported, searchHits: hits.length, detailsRequested: selected.length,
    imported: jobs.length, outdatedOrIncomplete: outdated, skipped, failed: errors.length }, errors };
}

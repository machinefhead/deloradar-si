import { extractEuresZrszCandidate, planZrszEuresMatches } from './zrsz-eures-map.js';

const API = 'https://europa.eu/eures/api/jv-searchengine/public';
const SEARCH_URL = API + '/jv-search/search';

function searchBody(page, resultsPerPage) {
  return {
    page, resultsPerPage, sortSearch: 'MOST_RECENT', keywords: [],
    locationCodes: ['si'], occupationUris: [], skillUris: [], requiredExperienceCodes: [],
    positionScheduleCodes: [], sectorCodes: [], educationAndQualificationLevelCodes: [],
    positionOfferingCodes: [], euresFlagCodes: [], otherBenefitsCodes: [],
    requiredLanguages: [], requestLanguage: 'sl',
  };
}

async function readJson(response, maxBytes) {
  if (!response.ok) throw Error('EURES: HTTP ' + response.status);
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw Error('EURES: pričakovan JSON');
  if (Number(response.headers.get('content-length')) > maxBytes) throw Error('EURES: prevelik odgovor');
  const text = await response.text();
  if (Buffer.byteLength(text) > maxBytes) throw Error('EURES: prevelik odgovor');
  return JSON.parse(text);
}

async function requestWithRetry(fetchImpl, url, init, maxBytes) {
  // Le en umirjen ponovni poskus pri začasni nedosegljivosti storitve.
  let response = await fetchImpl(url, init);
  if ([429, 502, 503, 504].includes(response.status)) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 30_000) : 5_000;
    await new Promise(resolve => setTimeout(resolve, wait));
    response = await fetchImpl(url, init);
  }
  return readJson(response, maxBytes);
}

function possibleZrszId(record) {
  if (typeof record?.id !== 'string' || !/^[A-Za-z0-9_-]{8,180}$/.test(record.id)) return false;
  const decoded = Buffer.from(record.id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  // Sufiks označuje vir; sam po sebi NI dokaz, da je oglas iz ZRSZ.
  return /^\d{6,10}(?:-\d{4,10})?\s+\d{1,3}$/.test(decoded);
}

export async function fetchEuresZrszMatches(zrszJobs, options = {}) {
  const { fetchImpl = fetch, pages = 1, startPage = 1, pageSize = 20, detailLimit = 20,
    excludeEuresIds = [],
    concurrency = 2, pauseMs = 250, timeoutMs = 30_000 } = options;
  if (![pages, startPage, pageSize, detailLimit, concurrency, pauseMs, timeoutMs].every(Number.isInteger) ||
      pages < 1 || pages > 5 || pageSize < 1 || pageSize > 50 ||
      startPage < 1 || startPage > 100 ||
    detailLimit < 0 || detailLimit > 250 || concurrency < 1 || concurrency > 3 ||
      pauseMs < 0 || pauseMs > 30_000 || timeoutMs < 100 || timeoutMs > 60_000) {
    throw Error('EURES: neveljavne omejitve poizvedb');
  }
  if (!Array.isArray(excludeEuresIds)) throw Error('EURES: nepravilni že preverjeni ID-ji');
  const skip = new Set(excludeEuresIds);
  const searchResults = [];
  let totalReported = null;
  for (let page = startPage; page < startPage + pages; page++) {
    const payload = await requestWithRetry(fetchImpl, SEARCH_URL, {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(searchBody(page, pageSize)),
    }, 3_000_000);
    if (!Number.isInteger(payload.numberRecords) || !Array.isArray(payload.jvs)) throw Error('EURES: nepopoln seznam');
    totalReported = payload.numberRecords;
    searchResults.push(...payload.jvs);
    if (!payload.jvs.length) break;
  }
  const unique = [...new Map(searchResults.filter(possibleZrszId).map(record => [record.id, record])).values()];
  const selected = unique.filter(item => !skip.has(item.id)).slice(0, detailLimit);
  const details = [];
  const errors = [];
  let index = 0;
  async function worker() {
    while (index < selected.length) {
      const item = selected[index++];
      try {
        const url = API + '/jv/id/' + encodeURIComponent(item.id) + '?requestLang=sl';
        const data = await requestWithRetry(fetchImpl, url, {
          method: 'GET', signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' },
        }, 500_000);
        if (data.id !== item.id) throw Error('EURES: ID se ne ujema');
        // Samo izvorni identifikatorji, brez opisa in kontaktnih podatkov.
        details.push({ id: data.id, source: data.source,
          reference: data.reference, documentId: data.documentId });
      } catch (error) {
        errors.push({ id: item.id, reason: String(error.message).slice(0, 90) });
      }
      if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));
  const plan = planZrszEuresMatches(zrszJobs, details);
  return {
    ...plan,
    stats: { ...plan.stats, totalReported, startPage, pagesRequested: pages,
      searchReturned: searchResults.length, skippedKnown: unique.length - unique.filter(item => !skip.has(item.id)).length,
      numericCandidatesInSearch: unique.length, detailsAttempted: selected.length,
      detailsFetched: details.length, detailsFailed: errors.length,
      checkedZrszSource: details.filter(x => x.source === 'ZRSZ').length },
    errors,
  };
}

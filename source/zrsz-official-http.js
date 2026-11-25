import { parseZrszJson } from './zrsz.js';
import { readableJobText } from './job-details.js';

const SITE = 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/';
const APP_HOST = 'isk-pdm-www-prod-estoritve.apps.ess.gov.si';
const GATEWAY = 'https://apigateway-prod-www-prod.apps.ess.gov.si';
const DAILY = '/dnevne-preglednice/CSZRSZ/ProstaDelovnaMesta.json';
const LIST = '/iskalnik-po-pdm/v1/delovno-mesto/prosta-delovna-mesta-filtri';
const DETAIL = '/iskalnik-po-pdm/v1/delovno-mesto/podrobnosti-prosto-delovno-mesto';

async function responseText(response, maxBytes) {
  if (!response.ok) throw Error('ZRSZ HTTP ' + response.status);
  const raw = await response.text();
  if (Buffer.byteLength(raw) > maxBytes) throw Error('ZRSZ: odgovor je prevelik');
  return raw;
}

async function responseJson(response, maxBytes) {
  if (!String(response.headers.get('content-type')).includes('json')) {
    if (!response.ok) throw Error('ZRSZ HTTP ' + response.status);
    throw Error('ZRSZ: odgovor ni JSON');
  }
  return JSON.parse(await responseText(response, maxBytes));
}

export async function discoverZrszPublicClient({ fetchImpl = fetch, timeoutMs = 25_000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw Error('ZRSZ: neveljavna časovna omejitev');
  const html = await responseText(await fetchImpl(SITE, { signal: AbortSignal.timeout(timeoutMs) }), 500_000);
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(x => x[1]);
  const asset = scripts.find(url => {
    try { const p = new URL(url, SITE); return p.hostname === APP_HOST && p.pathname.endsWith('/zrzs-iskalnik-po-prostih-delovnih-mestih.js'); }
    catch { return false; }
  });
  if (!asset) throw Error('ZRSZ: javna aplikacija ni objavila pričakovanega programa');
  const source = await responseText(await fetchImpl(new URL(asset, SITE), {
    signal: AbortSignal.timeout(timeoutMs),
  }), 2_000_000);
  const found = source.match(/ue_dataFor3ScaleApi_userKey=\{keyName:"user_key",keyValue:"([a-f0-9]{32})"\}/);
  if (!found || !source.includes(GATEWAY)) throw Error('ZRSZ: javni aplikacijski dostop se je spremenil');
  // Ključ ostane samo v zaprti funkciji v pomnilniku; nikoli ga ne vrnemo, izpišemo ali shranimo.
  const publicKey = found[1];
  async function api(path, { method = 'GET', body, maxBytes = 15_000_000 } = {}) {
    const url = new URL(path, GATEWAY);
    if (url.origin !== GATEWAY) throw Error('ZRSZ: nedovoljen API gostitelj');
    url.searchParams.set('user_key', publicKey);
    return responseJson(await fetchImpl(url, { method, signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }), maxBytes);
  }
  return {
    async daily(now = Date.now()) {
      const payload = await api(DAILY);
      return { payload, jobs: parseZrszJson(payload, now) };
    },
    async listings() {
      const all = [];
      let reported = null;
      for (let page = 1; page <= 10; page++) {
        const data = await api(LIST, { method: 'POST', maxBytes: 5_000_000,
          body: { stran: page, stZadetkov: 2000, vrniFiltre: false } });
        if (!Number.isInteger(data.steviloDelovnihMest) || !Array.isArray(data.seznamDelovnihMest)) {
          throw Error('ZRSZ: nepopoln seznam s številčnimi ID-ji');
        }
        if (reported !== null && reported !== data.steviloDelovnihMest) throw Error('ZRSZ: seznam se je med zajemom spremenil');
        reported = data.steviloDelovnihMest;
        all.push(...data.seznamDelovnihMest);
        if (all.length >= reported) break;
      }
      if (!Number.isInteger(reported) || reported < 1 || all.length !== reported ||
          new Set(all.map(item => item.idDelovnoMesto)).size !== reported) {
        throw Error('ZRSZ: nepopolno straničenje ali podvojeni ID-ji');
      }
      return { total: reported, jobs: all };
    },
    async detail(idp) {
      if (!/^\d{6,10}$/.test(String(idp))) throw Error('ZRSZ: neveljaven ID');
      const url = DETAIL + '?idDelovnoMesto=' + idp + '&idAplikacije=1&identifikacijaUporabnika=';
      const result = await api(url, { maxBytes: 300_000 });
      if (String(result.idDelovnoMesto) !== String(idp)) throw Error('ZRSZ: napačen ID v podrobnostih');
      return result;
    },
  };
}

function key(value) {
  return readableJobText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function matchZrszListingIds(dailyJobs, listings) {
  if (!Array.isArray(dailyJobs) || !Array.isArray(listings)) throw Error('ZRSZ: neveljavna seznama');
  const bucket = new Map();
  for (const item of listings) {
    if (!/^\d{6,10}$/.test(String(item.idDelovnoMesto))) continue;
    const matchKey = [key(item.nazivDelovnegaMesta), key(item.delodajalec),
      String(item.datumPrijaveDo || '').slice(0, 10)].join('|');
    if (!bucket.has(matchKey)) bucket.set(matchKey, []);
    bucket.get(matchKey).push(item);
  }
  let matched = 0, ambiguous = 0;
  const jobs = dailyJobs.map(job => {
    const matchKey = [key(job.title), key(job.company), String(job.deadline || '').slice(0, 10)].join('|');
    const candidates = bucket.get(matchKey) || [];
    if (candidates.length !== 1) { if (candidates.length > 1) ambiguous++; return { ...job }; }
    const idp = String(candidates[0].idDelovnoMesto);
    matched++;
    return { ...job, zrszIdCandidate: idp, zrszIdCandidateSource: 'ZRSZ listing',
      zrszIdStatus: 'matched-listing-pending-detail',
    };
  });
  return { jobs, stats: { matched, ambiguous, unmatched: dailyJobs.length - matched } };
}

export function attachZrszOfficialVerifiedLinks(jobs, verifiedRecords) {
  if (!Array.isArray(jobs) || !Array.isArray(verifiedRecords)) throw Error('ZRSZ: nepravilni podatki');
  const byRef = new Map(), conflicts = new Set();
  for (const record of verifiedRecords) {
    const ref = String(record?.reference || '').toUpperCase();
    const idp = String(record?.idp || '');
    if (!/^[A-Z]{2}\d{5,}$/.test(ref) || !/^\d{6,10}$/.test(idp)) continue;
    if (byRef.has(ref) && byRef.get(ref) !== idp) conflicts.add(ref);
    else byRef.set(ref, idp);
  }
  for (const ref of conflicts) byRef.delete(ref);
  let attached = 0;
  const updated = jobs.map(job => {
    if (job.source !== 'ZRSZ / PoiščiDelo' || job.id !== 'zrsz:' + job.reference ||
        !byRef.has(job.reference)) return { ...job };
    const idp = byRef.get(job.reference);
    // Če današnji iskalnik poda drugačen ID kot zgodovinski predpomnilnik,
    // ne objavimo stare povezave.
    if (job.zrszIdCandidateSource === 'ZRSZ listing' &&
        String(job.zrszIdCandidate) !== idp) return { ...job };
    attached++;
    return { ...job, zrszIdCandidate: idp, zrszIdCandidateSource: 'ZRSZ official HTTP',
      zrszIdStatus: 'confirmed-detail',
      url: SITE + '?idp=' + idp + '/#/pdm/' + idp,
    };
  });
  return { jobs: updated, stats: { attached, conflicts: conflicts.size } };
}

export async function getZrszOfficialHttp(options = {}) {
  const client = await discoverZrszPublicClient(options);
  const [daily, listings] = await Promise.all([client.daily(), client.listings()]);
  const joined = matchZrszListingIds(daily.jobs, listings.jobs);
  console.log(`ZRSZ HTTP: JSON ${daily.jobs.length}, iskalnik ${listings.total}, enoličnih ID kandidatov ${joined.stats.matched}`);
  return joined.jobs;
}

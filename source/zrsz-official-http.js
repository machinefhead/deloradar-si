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

// Prejšnji objavljeni podatki so predpomnilnik *preverjenih* ID-jev, ne vir za
// ugibanje. Nove neposredne povezave dobimo samo po ujemanju registrske številke
// v uradnem HTTP odgovoru za posamezno številčno delovno mesto.
export async function verifyZrszFreshLinks(jobs, {
  client, previous = [], maxNewDetails = 60, delayMs = 150,
} = {}) {
  if (!Array.isArray(jobs) || !Array.isArray(previous) || !client || typeof client.detail !== 'function' ||
      !Number.isInteger(maxNewDetails) || maxNewDetails < 0 || maxNewDetails > 250 ||
      !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 2000) {
    throw Error('ZRSZ: neveljaven načrt samodejnega preverjanja ID-jev');
  }
  const confirmed = [], rejected = new Map();
  for (const old of previous) {
    if (old?.source !== 'ZRSZ / PoiščiDelo' || old.id !== 'zrsz:' + old.reference) continue;
    const ref = String(old.reference || '').toUpperCase();
    if (old.zrszIdStatus === 'confirmed-detail') {
      const match = String(old.url || '').match(/^https:\/\/www\.ess\.gov\.si\/iskalci-zaposlitve\/iskanje-zaposlitve\/iskanje-dela\/\?idp=(\d{6,10})\/#\/pdm\/\1$/);
      if (match) confirmed.push({ reference: ref, idp: match[1] });
    } else if (old.zrszIdStatus === 'mismatch-detail' && /^\d{6,10}$/.test(String(old.zrszIdCandidate))) {
      rejected.set(ref, String(old.zrszIdCandidate));
    }
  }
  const reused = attachZrszOfficialVerifiedLinks(jobs, confirmed);
  const updated = reused.jobs;
  const pending = updated.filter(job => job.source === 'ZRSZ / PoiščiDelo' &&
    job.zrszIdStatus !== 'confirmed-detail' && job.zrszIdCandidateSource === 'ZRSZ listing' &&
    /^\d{6,10}$/.test(String(job.zrszIdCandidate)) &&
    rejected.get(job.reference) !== String(job.zrszIdCandidate))
    .slice(0, maxNewDetails);
  let position = 0, attempted = 0, matched = 0, mismatched = 0, errors = 0, stop = false;
  const failures = [];
  const verifiedNow = [];
  const mismatchedRefs = new Set(updated.filter(job => job.zrszIdStatus !== 'confirmed-detail' &&
    rejected.get(job.reference) === String(job.zrszIdCandidate)).map(job => job.reference));
  async function worker() {
    while (!stop && position < pending.length) {
      const job = pending[position++];
      let failed = false;
      try {
        const detail = await client.detail(job.zrszIdCandidate);
        const ref = String(detail?.registerskaStevilka || '').trim().toUpperCase();
        if (ref === job.reference) {
          verifiedNow.push({ reference: ref, idp: String(job.zrszIdCandidate) });
          matched++;
        } else {
          mismatchedRefs.add(job.reference);
          mismatched++;
        }
      } catch {
        errors++;
        failed = true;
      }
      attempted++;
      failures.push(failed);
      if (failures.length > 20) failures.shift();
      if (failures.length >= 20 && failures.filter(Boolean).length >= 8) stop = true;
      if (delayMs && !stop) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker));
  const withNewLinks = attachZrszOfficialVerifiedLinks(updated, verifiedNow);
  return { jobs: withNewLinks.jobs.map(job => mismatchedRefs.has(job.reference)
    ? { ...job, zrszIdStatus: 'mismatch-detail' } : job),
  stats: { cached: reused.stats.attached, candidates: pending.length, attempted, verified: matched,
    mismatched, errors, stoppedForErrors: stop } };
}

// Pri več oglasih z enakim nazivom, podjetjem in rokom osnovni seznam ne
// vsebuje registrske številke. Poskusimo le majhen nabor verjetnih ID-jev,
// toda neposredno povezavo ustvarimo IZKLJUČNO, če uradni odgovor podrobnosti
// potrdi popolnoma enako registrsko številko. Negativne ID-je hranimo v
// objavljenem posnetku, da jih na vsakem 12-urnem zajemu ne preverjamo znova.
export async function verifyZrszAmbiguousLinks(jobs, {
  client, listings = [], previous = [], maxNewDetails = 0, delayMs = 150,
} = {}) {
  if (!Array.isArray(jobs) || !Array.isArray(listings) || !Array.isArray(previous) ||
      !client || typeof client.detail !== 'function' || !Number.isInteger(maxNewDetails) ||
      maxNewDetails < 0 || maxNewDetails > 250 || !Number.isInteger(delayMs) ||
      delayMs < 0 || delayMs > 2000) throw Error('ZRSZ: neveljavni alternativni kandidati');
  const previousByRef = new Map(previous.filter(job => job?.source === 'ZRSZ / PoiščiDelo')
    .map(job => [job.reference, job]));
  const knownIdps = new Set(jobs.filter(job => job.zrszIdStatus === 'confirmed-detail')
    .map(job => String(job.zrszIdCandidate)).filter(id => /^\d{6,10}$/.test(id)));
  const byTitle = new Map();
  for (const item of listings) {
    if (!/^\d{6,10}$/.test(String(item.idDelovnoMesto))) continue;
    const title = key(item.nazivDelovnegaMesta);
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(item);
  }
  const proposals = new Map(), skippedPreviously = new Map();
  for (const job of jobs) {
    if (job.source !== 'ZRSZ / PoiščiDelo' || job.zrszIdStatus === 'confirmed-detail' ||
        job.zrszIdStatus === 'matched-listing-pending-detail' ||
        !/^[A-Z]{2}\d{5,}$/.test(String(job.reference)) || job.reference.startsWith('IE')) continue;
    const old = previousByRef.get(job.reference);
    const rejected = new Set(Array.isArray(old?.zrszCheckedIdps) ? old.zrszCheckedIdps.filter(
      value => /^\d{6,10}$/.test(String(value))).map(String) : []);
    if (old?.zrszIdStatus === 'mismatch-detail' && /^\d{6,10}$/.test(String(old.zrszIdCandidate))) {
      rejected.add(String(old.zrszIdCandidate));
    }
    skippedPreviously.set(job.reference, rejected);
    const sameTitle = byTitle.get(key(job.title)) || [];
    const sameCompany = sameTitle.filter(item => key(item.delodajalec) === key(job.company));
    const sameDeadline = sameTitle.filter(item =>
      String(item.datumPrijaveDo || '').slice(0, 10) === String(job.deadline || '').slice(0, 10));
    const strongest = sameCompany.filter(item => sameDeadline.includes(item));
    // Prednost imajo enaki naziv, delodajalec in rok. Če teh ni, preverimo
    // zelo ozek nabor po nazivu/roku oziroma nazivu/delodajalcu.
    const candidates = strongest.length > 0 && strongest.length <= 8 ? strongest
      : sameDeadline.length > 0 && sameDeadline.length <= 3 ? sameDeadline
        : sameCompany.length > 0 && sameCompany.length <= 3 ? sameCompany : [];
    for (const item of candidates) {
      const idp = String(item.idDelovnoMesto);
      if (knownIdps.has(idp) || rejected.has(idp)) continue;
      if (!proposals.has(idp)) proposals.set(idp, new Set());
      proposals.get(idp).add(job.reference);
    }
  }
  const queue = [...proposals.entries()].slice(0, maxNewDetails);
  let position = 0, verified = 0, mismatched = 0, errors = 0, stop = false;
  const newChecked = new Map(), matches = [], recentErrors = [];
  async function worker() {
    while (!stop && position < queue.length) {
      const [idp, refs] = queue[position++];
      let failed = false;
      try {
        const detail = await client.detail(idp);
        const ref = String(detail.registerskaStevilka || '').trim().toUpperCase();
        if (refs.has(ref)) { matches.push({ reference: ref, idp }); verified++; }
        else mismatched++;
        for (const candidateRef of refs) if (candidateRef !== ref) {
          if (!newChecked.has(candidateRef)) newChecked.set(candidateRef, new Set());
          newChecked.get(candidateRef).add(idp);
        }
      } catch {
        failed = true;
        errors++;
      }
      recentErrors.push(failed);
      if (recentErrors.length > 20) recentErrors.shift();
      if (recentErrors.length >= 20 && recentErrors.filter(Boolean).length >= 8) stop = true;
      if (delayMs && !stop) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
  const annotated = jobs.map(job => {
    const additional = newChecked.get(job.reference);
    const old = skippedPreviously.get(job.reference);
    if (!additional?.size && !old?.size) return { ...job };
    const all = [...new Set([...(old || []), ...(additional || [])])].slice(-24);
    return { ...job, zrszCheckedIdps: all };
  });
  // Tudi pri navideznem enoličnem ujemanju se URL potrdi šele z registrsko
  // številko iz ločenega odgovora. Ob konfliktu dveh ID-jev ni povezave.
  const prepared = annotated.map(job => matches.some(match => match.reference === job.reference)
    ? { ...job, zrszIdCandidateSource: 'ZRSZ official HTTP' } : job);
  const attached = attachZrszOfficialVerifiedLinks(prepared, matches);
  return { jobs: attached.jobs, stats: { proposals: proposals.size, attempted: position,
    verified: attached.stats.attached, mismatched, errors, conflicts: attached.stats.conflicts,
    stoppedForErrors: stop } };
}

export async function getZrszOfficialHttp(options = {}) {
  const client = await discoverZrszPublicClient(options);
  const [daily, listings] = await Promise.all([client.daily(), client.listings()]);
  const joined = matchZrszListingIds(daily.jobs, listings.jobs);
  console.log(`ZRSZ HTTP: JSON ${daily.jobs.length}, iskalnik ${listings.total}, enoličnih ID kandidatov ${joined.stats.matched}`);
  const verified = await verifyZrszFreshLinks(joined.jobs, { client,
    previous: options.previous || [], maxNewDetails: options.maxNewDetails ?? 0 });
  console.log(`ZRSZ HTTP: ${verified.stats.cached} neposrednih povezav iz predpomnilnika, ` +
    `${verified.stats.verified} novih preverjenih, ${verified.stats.mismatched} neskladij, ` +
    `${verified.stats.errors} napak (${verified.stats.attempted}/${verified.stats.candidates} zahtevkov).`);
  const additional = await verifyZrszAmbiguousLinks(verified.jobs, { client, listings: listings.jobs,
    previous: options.previous || [], maxNewDetails: Math.max(0, (options.maxNewDetails ?? 0) - verified.stats.attempted) });
  console.log(`ZRSZ HTTP: zahtevnejša ujemanja ${additional.stats.verified} potrjenih od ` +
    `${additional.stats.attempted} dodatnih HTTP preverjanj, ` +
    `${additional.stats.errors} napak; ${additional.stats.proposals} možnih ID-jev.`);
  return options.withStats ? { jobs: additional.jobs, stats: {
    dailyCount: daily.jobs.length, searchCount: listings.total,
    strictMatched: joined.stats.matched,
    verifiedFromCache: verified.stats.cached, verifiedNew: verified.stats.verified + additional.stats.verified,
    unlinked: additional.jobs.filter(job => job.zrszIdStatus !== 'confirmed-detail').length,
    unlinkedIE: additional.jobs.filter(job => job.reference?.startsWith('IE') &&
      job.zrszIdStatus !== 'confirmed-detail').length,
  } } : additional.jobs;
}

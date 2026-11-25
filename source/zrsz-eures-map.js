// Čista obdelava že zakonito pridobljenega EURES izvoza. Ta modul ne pošilja
// omrežnih zahtevkov in NE potrjuje neposredne povezave na ZRSZ.

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function euresHandle(record) {
  if (typeof record?.id === 'string' && record.id.startsWith('eures:')) return record.id.slice(6);
  if (typeof record?.id === 'string' && /^[A-Za-z0-9_-]{8,180}$/.test(record.id)) return record.id;
  if (typeof record?.url !== 'string') return '';
  try {
    const url = new URL(record.url);
    return url.hostname === 'europa.eu' && /^\/eures\/portal\/jv-se\/jv-details\/[A-Za-z0-9_-]+$/.test(url.pathname)
      ? url.pathname.split('/').at(-1) : '';
  } catch { return ''; }
}

export function extractEuresZrszCandidate(record) {
  if (record?.source !== 'ZRSZ') return null;
  // EURES-jev živi odgovor uporablja `reference` za ŠTEVILČNI idp,
  // `documentId` pa za registrsko številko RH/RE... iz ZRSZ JSON-a.
  const reference = clean(record?.documentId || record?.registration || record?.reference).toUpperCase();
  if (!/^[A-Z]{2}\d{5,}$/.test(reference)) return null;
  const handle = euresHandle(record);
  if (!/^[A-Za-z0-9_-]{8,180}$/.test(handle)) return null;
  const decoded = Buffer.from(handle.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const match = /^(\d{6,10})(?:-\d{4,10})?\s+\d{1,3}$/.exec(decoded);
  if (!match) return null;
  const originalRef = decoded.replace(/\s+\d{1,3}$/, '');
  if (record?.reference && clean(record.reference) !== originalRef &&
      !/^[A-Z]{2}\d{5,}$/.test(clean(record.reference).toUpperCase())) return null;
  return { reference, idp: match[1], euresId: handle };
}

export function planZrszEuresMatches(zrszJobs, euresRecords) {
  if (!Array.isArray(zrszJobs) || !Array.isArray(euresRecords)) throw Error('ZRSZ/EURES: pričakovana sta seznama');
  const zrsz = new Map(zrszJobs.filter(item => item?.source === 'ZRSZ / PoiščiDelo' &&
    item.id === `zrsz:${item.reference}`).map(item => [item.reference, item]));
  const known = new Map();
  const conflicted = new Set();
  let parsed = 0, unmatched = 0;
  for (const record of euresRecords) {
    const candidate = extractEuresZrszCandidate(record);
    if (!candidate) continue;
    parsed++;
    if (!zrsz.has(candidate.reference)) { unmatched++; continue; }
    const old = known.get(candidate.reference);
    if (old && old.idp !== candidate.idp) conflicted.add(candidate.reference);
    else if (!old) known.set(candidate.reference, candidate);
  }
  for (const key of conflicted) known.delete(key);
  return {
    // To so KANDIDATI za preverjanje. Brez preverjenega odgovora ZRSZ ne
    // ustvarjamo neposrednih URL-jev in ne prepisujemo oglasov.
    candidates: [...known.values()],
    stats: { zrszTotal: zrsz.size, euresTotal: euresRecords.length,
      parsed, matchedCandidates: known.size, conflictingReferences: conflicted.size,
      unmatched, withoutCandidate: zrsz.size - known.size },
  };
}

export function attachZrszEuresCandidates(jobs, candidates) {
  if (!Array.isArray(jobs) || !Array.isArray(candidates)) throw Error('ZRSZ/EURES: pričakovana sta seznama');
  const map = new Map();
  const conflicts = new Set();
  for (const record of candidates) {
    const reference = clean(record?.reference).toUpperCase();
    const idp = clean(record?.idp);
    if (!/^[A-Z]{2}\d{5,}$/.test(reference) || !/^\d{6,10}$/.test(idp)) continue;
    if (map.has(reference) && map.get(reference) !== idp) conflicts.add(reference);
    else map.set(reference, idp);
  }
  for (const reference of conflicts) map.delete(reference);
  let matched = 0;
  return {
    jobs: jobs.map(job => {
      const idp = job?.source === 'ZRSZ / PoiščiDelo' && job.id === `zrsz:${job.reference}`
        ? map.get(job.reference) : null;
      if (!idp) return { ...job };
      matched++;
      // NAMERNO ohranimo `url` iz dnevnega izvoza. EURES kandidat ni
      // potrjena neposredna povezava na ZRSZ.
      return { ...job, zrszIdCandidate: idp, zrszIdCandidateSource: 'EURES' };
    }),
    stats: { matched, conflicts: conflicts.size, unmatched: jobs.length - matched },
  };
}

// EURES potrdi identifikator oglasa, ne pa nujno aktualnega roka prijave.
// Ne prepisuj izvorne povezave, dokler ni preverjena tudi svežina objave.
export function attachVerifiedEuresDetailLinks(jobs, candidates) {
  if (!Array.isArray(jobs) || !Array.isArray(candidates)) throw Error('ZRSZ/EURES: pričakovana sta seznama');
  const map = new Map(), conflicts = new Set();
  for (const candidate of candidates) {
    const reference = clean(candidate?.reference).toUpperCase();
    const idp = clean(candidate?.idp);
    const euresId = clean(candidate?.euresId);
    if (!/^[A-Z]{2}\d{5,}$/.test(reference) || !/^\d{6,10}$/.test(idp) ||
        !/^[A-Za-z0-9_-]{8,180}$/.test(euresId)) continue;
    const original = Buffer.from(euresId, 'base64url').toString('utf8');
    if (!new RegExp('^' + idp + '(?:-\\d{4,10})?\\s+14$').test(original)) continue;
    const previous = map.get(reference);
    if (previous && previous.idp !== idp) conflicts.add(reference);
    else map.set(reference, { idp, euresId });
  }
  for (const reference of conflicts) map.delete(reference);
  let linked = 0;
  const mapped = jobs.map(job => {
    const found = job?.source === 'ZRSZ / PoiščiDelo' && job.id === `zrsz:${job.reference}`
      ? map.get(job.reference) : null;
    if (!found) return { ...job };
    linked++;
    const { directDetailSource: oldDirectSource, ...rest } = job;
    const searchUrl = 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/' +
      '#/?drzava=SI,&iskalniTekst=' + encodeURIComponent(job.company || job.title || '') + '&iskalnaLokacija=';
    const officialCandidate = job.zrszIdCandidateSource === 'ZRSZ listing' ||
      job.zrszIdCandidateSource === 'ZRSZ official HTTP';
    return { ...rest,
      zrszIdCandidate: officialCandidate ? job.zrszIdCandidate : found.idp,
      zrszIdCandidateSource: officialCandidate ? job.zrszIdCandidateSource : 'EURES',
      url: oldDirectSource === 'EURES' ? searchUrl : job.url,
      euresDetailUrlCandidate: 'https://europa.eu/eures/portal/jv-se/jv-details/' + found.euresId + '?lang=sl',
      euresDetailFreshness: 'unverified',
    };
  });
  return { jobs: mapped, stats: { linked, conflicts: conflicts.size } };
}

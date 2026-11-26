import { readFile } from 'node:fs/promises';
import { discoverZrszPublicClient, matchZrszListingIds } from '../source/zrsz-official-http.js';

// Ne zapisuje podatkov, ključev ali osebnih kontaktov. Primerja le javni
// dnevni seznam in aktualni iskalnik ter stanje zadnje lokalne objave.
const snapshot = JSON.parse(await readFile(process.argv[2] || 'dist/jobs.json', 'utf8'));
const existing = snapshot.jobs.filter(job => job.source === 'ZRSZ / PoiščiDelo');
const missing = existing.filter(job => !/\?idp=\d+/.test(job.url || ''));
const client = await discoverZrszPublicClient();
const [daily, listings] = await Promise.all([client.daily(), client.listings()]);
const joined = matchZrszListingIds(daily.jobs, listings.jobs);

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
const byTitle = new Map();
for (const item of listings.jobs) {
  const title = norm(item.nazivDelovnegaMesta);
  if (!byTitle.has(title)) byTitle.set(title, []);
  byTitle.get(title).push(item);
}
const groups = {};
const candidatesToProbe = new Map();
for (const job of missing) {
  const prefix = String(job.reference || '').slice(0, 2);
  const group = groups[prefix] ||= { missing: 0, knownIdp: 0, noTitle: 0,
    uniqueTitleAndDeadline: 0, possibleIdps: 0 };
  group.missing++;
  if (/^\d{6,10}$/.test(String(job.zrszIdCandidate || ''))) group.knownIdp++;
  const sameTitle = byTitle.get(norm(job.title)) || [];
  if (!sameTitle.length) group.noTitle++;
  const sameDeadline = sameTitle.filter(item =>
    String(item.datumPrijaveDo || '').slice(0, 10) === String(job.deadline || '').slice(0, 10));
  if (sameDeadline.length === 1) group.uniqueTitleAndDeadline++;
  // Ne preverjamo IE po samem nazivu. Podatki na dveh seznamih niso
  // ista objava; takšno ujemanje bi lahko ustvarilo napačen URL.
  if (prefix === 'IE') continue;
  const sameEmployer = sameTitle.filter(item => norm(item.delodajalec) === norm(job.company));
  const strong = sameTitle.filter(item => sameEmployer.includes(item) && sameDeadline.includes(item));
  const likely = strong.length && strong.length <= 8 ? strong
    : sameDeadline.length && sameDeadline.length <= 3 ? sameDeadline
      : sameEmployer.length && sameEmployer.length <= 3 ? sameEmployer : [];
  group.possibleIdps += likely.length;
  for (const item of likely) {
    const idp = String(item.idDelovnoMesto);
    if (!candidatesToProbe.has(idp)) candidatesToProbe.set(idp, new Set());
    candidatesToProbe.get(idp).add(job.reference);
  }
}
const summary = {
  checkedAt: snapshot.checkedAt,
  dailyJson: daily.jobs.length, searchApi: listings.total,
  strictMatching: joined.stats,
  directInSnapshot: existing.length - missing.length,
  missingDirect: missing.length,
  unresolvedByPrefix: groups,
  distinctCandidateIdps: candidatesToProbe.size,
};
console.log(JSON.stringify(summary, null, 2));
const probe = Number(process.env.ZRSZ_AUDIT_PROBE_LIMIT || 0);
if (Number.isInteger(probe) && probe > 0 && probe <= 80) {
  const entries = [...candidatesToProbe.entries()].slice(0, probe);
  let verified = 0, mismatched = 0, errors = 0;
  for (let i = 0; i < entries.length; i += 3) {
    const batch = await Promise.allSettled(entries.slice(i, i + 3).map(async ([idp, refs]) => {
      const detail = await client.detail(idp);
      return refs.has(String(detail.registerskaStevilka || '').trim().toUpperCase());
    }));
    for (const result of batch) {
      if (result.status === 'rejected') errors++;
      else if (result.value) verified++;
      else mismatched++;
    }
  }
  console.log(JSON.stringify({ probe: entries.length, verified, mismatched, errors }));
}

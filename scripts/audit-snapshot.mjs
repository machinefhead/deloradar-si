import { readFile } from 'node:fs/promises';

// Ne spreminja izvoza. Izračuna merljive kazalnike in previdne kandidate
// za podvajanje oziroma odvečen vir; odločitev ostane ločena od zajema.
const path = process.argv[2] || 'dist/jobs.json';
const snapshot = JSON.parse(await readFile(path, 'utf8'));
if (!Array.isArray(snapshot.jobs) || !Array.isArray(snapshot.sources)) {
  throw Error('Posnetek mora vsebovati jobs in sources');
}
const jobs = snapshot.jobs;
const normalize = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const percent = (part, whole) => whole ? Math.round(100 * part / whole) + '%' : '—';
const bySource = new Map();
const orphanSources = new Set();
for (const source of snapshot.sources) {
  if (bySource.has(source.name)) throw Error('Podvojen vir v seznamu: ' + source.name);
  bySource.set(source.name, { name: source.name, status: source.status, jobs: [], candidates: new Set() });
}
for (const job of jobs) {
  if (!bySource.has(job.source)) {
    orphanSources.add(job.source);
    bySource.set(job.source, { name: job.source, status: 'NI V SEZNAMU VIROV', jobs: [], candidates: new Set() });
  }
  bySource.get(job.source).jobs.push(job);
}

const buckets = new Map();
for (const job of jobs) {
  const title = normalize(job.title), company = normalize(job.company), location = normalize(job.location);
  if (title.length < 8 || company.length < 3 || location.length < 3) continue;
  const key = [title, company, location].join('|');
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(job);
}
let crossSourceCandidateGroups = 0;
for (const entries of buckets.values()) {
  // Trije ali več enako poimenovanih razpisov so lahko različna delovna mesta.
  if (entries.length !== 2 || entries[0].source === entries[1].source) continue;
  const [a, b] = entries;
  if (a.deadline && b.deadline && String(a.deadline).slice(0, 10) !== String(b.deadline).slice(0, 10)) continue;
  crossSourceCandidateGroups++;
  bySource.get(a.source).candidates.add(a.id);
  bySource.get(b.source).candidates.add(b.id);
}

const sourceRows = [...bySource.values()].map(source => {
  const list = source.jobs;
  const described = list.filter(job => String(job.description || '').trim()).length;
  const located = list.filter(job => String(job.location || '').trim()).length;
  const dated = list.filter(job => Number.isFinite(Date.parse(job.date || ''))).length;
  const marked = list.filter(job => job.duplicateGroup).length;
  const candidates = source.candidates.size;
  return { name: source.name, status: source.status, count: list.length,
    description: percent(described, list.length), location: percent(located, list.length),
    date: percent(dated, list.length), marked, candidates,
    maybeRedundant: list.length > 0 && list.length <= 10 && candidates === list.length };
}).sort((a, b) => a.count - b.count || a.name.localeCompare(b.name, 'sl'));

const ids = new Set(jobs.map(job => job.id));
const duplicateGroupCounts = new Map();
for (const job of jobs) if (job.duplicateGroup) duplicateGroupCounts.set(job.duplicateGroup,
  (duplicateGroupCounts.get(job.duplicateGroup) || 0) + 1);
const foreign = jobs.filter(job => /\b(?:Stuttgart|Graz|München|Munich|Berlin|Wien|Vienna|Zagreb)\b/i.test(job.location || ''));
const summary = {
  snapshot: snapshot.checkedAt || '',
  jobs: jobs.length,
  connected: snapshot.sources.length,
  sourcesLive: snapshot.sources.filter(source => source.status === 'live').length,
  duplicateIds: jobs.length - ids.size,
  markedGroups: duplicateGroupCounts.size,
  markedJobs: [...duplicateGroupCounts.values()].reduce((total, n) => total + n, 0),
  candidateGroups: crossSourceCandidateGroups,
  foreignLocations: foreign.length,
  sourcesMissingFromCatalog: [...orphanSources],
};
console.log('DeloRadar – revizija posnetka (brez spreminjanja podatkov)');
console.log(summary);
console.table(sourceRows);
for (const source of sourceRows.filter(row => row.maybeRedundant)) {
  console.log(`KANDIDAT ZA ODVEČEN VIR: ${source.name} – vseh ${source.count} zapisov ima možen par drugje; preveriti dodatne posnetke in točne povezave.`);
}
for (const job of foreign.slice(0, 12)) console.log(`TUJA LOKACIJA: ${job.source}: ${job.location} – ${job.id}`);
if (summary.duplicateIds > 0 || orphanSources.size || [...duplicateGroupCounts.values()].some(n => n < 2)) {
  process.exitCode = 1;
  console.error('Neveljavni ali nepopolni identifikatorji dvojnikov');
}

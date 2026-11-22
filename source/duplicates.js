// Varna, reverzibilna oznaka zelo verjetnih medportalskih dvojnikov.
// Ne odstranjuje oglasov: vsak vir ohrani svoj ID, URL in metapodatke.
function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function publishedOn(job) {
  const parsed = Date.parse(job.date || '');
  return Number.isFinite(parsed) ? parsed : null;
}

export function markLikelyDuplicates(jobs) {
  const buckets = new Map();
  for (const job of jobs) {
    const title = normalized(job.title), company = normalized(job.company), location = normalized(job.location);
    // Brez kraja in datuma ne moremo razlikovati ponovljenih ali večjih razpisov.
    if (title.length < 8 || company.length < 3 || location.length < 3 || publishedOn(job) === null) continue;
    const key = [title, company, location].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(job);
  }
  const byId = new Map();
  for (const candidates of buckets.values()) {
    // Pri treh ali več objavah bi se lahko združila različna delovna mesta.
    if (candidates.length !== 2) continue;
    const [a, b] = candidates;
    if (a.source === b.source || a.id === b.id || a.url === b.url) continue;
    if (Math.abs(publishedOn(a) - publishedOn(b)) > 14 * 24 * 3600 * 1000) continue;
    const aDeadline = String(a.deadline || '').slice(0, 10), bDeadline = String(b.deadline || '').slice(0, 10);
    if (aDeadline && bDeadline && aDeadline !== bDeadline) continue;
    // ZRSZ nima stabilnih URL-jev za posamezen oglas, zato ga ne združujemo
    // z objavami drugih portalov zgolj na podlagi podobnega naziva.
    if (a.reference || b.reference || a.source === 'ZRSZ / PoiščiDelo' || b.source === 'ZRSZ / PoiščiDelo') continue;
    const group = 'dupe:' + [a.id, b.id].sort()[0];
    byId.set(a.id, group);
    byId.set(b.id, group);
  }
  return jobs.map(({ duplicateGroup: previous, ...job }) => byId.has(job.id)
    ? { ...job, duplicateGroup: byId.get(job.id) } : job);
}

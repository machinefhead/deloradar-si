// Lokalni načrtovalnik ZRSZ dopolnjevanja. Ne izvaja HTTP zahtevkov.
// Vhodna seznama sta že normalizirana prek parseZrszJson().
const DAY = 86_400_000;
const DETAIL_FIELDS = [
  'responsibilities', 'requirements', 'benefits', 'skills', 'workplaceType',
  'workplaceAddress', 'education', 'experience', 'salary', 'incentives',
  'jobCategory', 'detailsFetchedAt', 'detailsCheckedAt',
];
const COMPARE_FIELDS = [
  'title', 'company', 'location', 'date', 'deadline', 'description',
  'employmentType', 'contractType', 'contractDuration', 'workHours',
  'requirements', 'education', 'experience', 'workplaceAddress',
];

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function sameListing(current, previous) {
  return previous?.source === 'ZRSZ / PoiščiDelo' &&
    previous.id === current.id && previous.reference === current.reference &&
    COMPARE_FIELDS.every(key => current[key] === undefined ||
      JSON.stringify(current[key]) === JSON.stringify(previous[key]));
}

export function planZrszDetails(current, previous, options = {}) {
  const { now = Date.now(), maxRequests = 60, refreshDays = 14, retryHours = 24 } = options;
  if (!Array.isArray(current) || !Array.isArray(previous)) throw Error('ZRSZ: pričakovana sta dva seznama oglasov');
  if (!Number.isInteger(maxRequests) || maxRequests < 0 || maxRequests > 500 ||
      !Number.isFinite(refreshDays) || refreshDays < 1 ||
      !Number.isFinite(retryHours) || retryHours < 1) throw Error('ZRSZ: neveljavne omejitve dopolnjevanja');

  const old = new Map(previous.filter(job => job?.id && job.source === 'ZRSZ / PoiščiDelo')
    .map(job => [job.id, job]));
  const results = current.map(job => ({ ...job }));
  const currentIds = new Set(results.map(job => job.id));
  const newOrChanged = [], periodic = [];
  let reused = 0, delayed = 0, changed = 0, added = 0;
  for (const job of results) {
    if (job.source !== 'ZRSZ / PoiščiDelo' || !job.reference || job.id !== `zrsz:${job.reference}`) {
      throw Error('ZRSZ: neveljaven stabilni identifikator');
    }
    const prior = old.get(job.id);
    const same = sameListing(job, prior);
    if (same) {
      for (const field of DETAIL_FIELDS) {
        if ((job[field] === undefined || job[field] === null || job[field] === '') && prior[field] !== undefined) {
          job[field] = prior[field];
        }
      }
      // Neposredno povezavo lahko ohranimo samo za isto preverjeno registrsko referenco.
      if (/^https:\/\/www\.ess\.gov\.si\/.*\?idp=\d+\//.test(prior.url || '')) job.url = prior.url;
      reused++;
    }
    if (!prior) added++;
    else if (!same) changed++;
    const checked = same ? timestamp(prior.detailsCheckedAt) : null;
    if (checked !== null && now >= checked && now - checked < retryHours * 3_600_000) {
      delayed++;
      continue;
    }
    if (!same || !timestamp(prior.detailsFetchedAt)) newOrChanged.push(job.id);
    else if (now - timestamp(prior.detailsFetchedAt) >= refreshDays * DAY) periodic.push(job.id);
  }
  const queue = newOrChanged.concat(periodic);
  return {
    jobs: results,
    requests: queue.slice(0, maxRequests),
    stats: { total: results.length, added, changed, reused, delayed,
      queued: queue.length, deferred: Math.max(0, queue.length - maxRequests), removed: [...old.keys()].filter(id => !currentIds.has(id)).length },
  };
}

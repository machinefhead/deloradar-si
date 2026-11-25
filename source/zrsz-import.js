import { createHash } from 'node:crypto';
import { parseZrszJson } from './zrsz.js';

const PROFILE_FIELDS = [
  'title', 'company', 'location', 'date', 'deadline', 'description', 'education',
  'experience', 'contractType', 'contractDuration', 'employmentType', 'workHours',
  'requirements', 'salary', 'benefits', 'workplaceAddress',
];
const AUDIT_FIELDS = [
  'description', 'education', 'experience', 'contractType', 'workHours',
  'requirements', 'salary', 'benefits', 'workplaceAddress',
];

function fingerprint(job) {
  const values = PROFILE_FIELDS.map(field => job[field] ?? null);
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

export function importZrszSnapshot(payload, previousJobs = [], { now = Date.now() } = {}) {
  if (!Array.isArray(previousJobs)) throw Error('ZRSZ: prejšnji seznam mora biti tabela');
  const current = parseZrszJson(payload, now);
  const previous = new Map(previousJobs.filter(job => job?.source === 'ZRSZ / PoiščiDelo' &&
    typeof job.id === 'string' && job.id === `zrsz:${job.reference}`)
    .map(job => [job.id, job]));
  const liveIds = new Set();
  let added = 0, updated = 0, unchanged = 0;
  const jobs = current.map(job => {
    // Nikoli ne prevzemamo starih ?idp povezav, saj je njihova pravilnost odvisna
    // od živega seznama in preverjenega ujemanja registrske številke.
    const hash = fingerprint(job);
    const old = previous.get(job.id);
    liveIds.add(job.id);
    if (!old) added++;
    else if (old.zrszFingerprint === hash || fingerprint(old) === hash) unchanged++;
    else updated++;
    return { ...job, zrszFingerprint: hash };
  });
  const missing = Object.fromEntries(AUDIT_FIELDS.map(field =>
    [field, jobs.filter(job => job[field] === undefined || job[field] === null || job[field] === '').length]));
  return {
    jobs,
    report: {
      input: payload.SteviloPDM, accepted: jobs.length,
      discarded: payload.SteviloPDM - jobs.length,
      added, updated, unchanged,
      removed: [...previous.keys()].filter(id => !liveIds.has(id)).length,
      capturedAt: payload.DatumObjave,
      missing,
      // Dnevni JSON nima idDelovnoMesto; ne štejemo iskalnih URL-jev kot neposrednih.
      directIdsVerified: 0,
    },
  };
}

// Ciljni zajem: ohrani vse tuje vire in njihove statistike iz javnega posnetka.
import { markLikelyDuplicates } from './duplicates.js';
import { MJOB_SOURCE, MJOB_URL } from './mjob.js';

export function mergeMjobSnapshot(baseline, result, now = new Date().toISOString()) {
  if (!Array.isArray(baseline?.jobs) || !baseline.jobs.length ||
      !Array.isArray(baseline.sources) || !baseline.sources.length ||
      !Array.isArray(baseline.planned) || !Number.isFinite(Date.parse(baseline.checkedAt))) {
    throw Error('Ciljni zajem: javni posnetek ni popoln');
  }
  if (!Array.isArray(result?.jobs) || !result.jobs.length || !result.progress || !result.state?.checkedAt ||
      !Number.isFinite(Date.parse(now))) throw Error('Ciljni zajem: novi vir ni uspešno vrnil podatkov');
  if (baseline.sources.some(source => source.name === MJOB_SOURCE && source.id !== 'mjob')) {
    throw Error('Ciljni zajem: ime Mjob je že uporabljeno v drugem viru');
  }
  const existing = baseline.jobs.filter(job => job.source !== MJOB_SOURCE);
  const ids = new Set(existing.map(job => job.id));
  for (const job of result.jobs) {
    if (!/^mjob:\d{4,9}$/.test(job.id) || job.source !== MJOB_SOURCE || !job.title || !job.company ||
        !job.location || !job.description || job.url !== MJOB_URL + '/podrobnosti/' + job.id.slice(5) ||
        ids.has(job.id)) throw Error('Ciljni zajem: neveljaven ali podvojen Mjob oglas');
    ids.add(job.id);
  }
  if (ids.size !== existing.length + result.jobs.length) {
    throw Error('Ciljni zajem: izvorni posnetek ima podvojene ID-je');
  }
  const jobs = markLikelyDuplicates([...existing, ...result.jobs]);
  const duplicates = new Map();
  for (const job of jobs) if (job.duplicateGroup) {
    duplicates.set(job.source, (duplicates.get(job.source) || 0) + 1);
  }
  const newSource = { id: 'mjob', name: MJOB_SOURCE, url: MJOB_URL,
    status: 'live', count: result.jobs.length, likelyDuplicates: duplicates.get(MJOB_SOURCE) || 0,
    mjob: result.progress, lastCheckedAt: now };
  const sources = baseline.sources.some(s => s.id === 'mjob')
    ? baseline.sources.map(s => s.id === 'mjob' ? newSource : { ...s, likelyDuplicates: duplicates.get(s.name) || 0 })
    : [...baseline.sources.map(s => ({ ...s, likelyDuplicates: duplicates.get(s.name) || 0 })), newSource];
  // Drugi metapodatki, preverjeni URL-ji, statusi in števci ostanejo enaki.
  for (const old of baseline.sources.filter(s => s.id !== 'mjob')) {
    const next = sources.find(s => s.id === old.id);
    if (!next || next.status !== old.status || next.count !== old.count || next.url !== old.url) {
      throw Error('Ciljni zajem: poskus spremembe drugega vira');
    }
  }
  return { ...baseline, jobs, sources,
    planned: baseline.planned.filter(p => p.name !== MJOB_SOURCE),
    discovery: { ...baseline.discovery, mjob: result.state },
    lastFullCheckedAt: baseline.lastFullCheckedAt || baseline.checkedAt,
    captureMode: 'incremental', lastUpdatedSources: ['mjob'], checkedAt: now };
}

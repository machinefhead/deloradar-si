// Ciljni zajem: ohrani vse tuje vire in njihove statistike iz javnega posnetka.
import { markLikelyDuplicates } from './duplicates.js';
import { MJOB_SOURCE, MJOB_URL } from './mjob.js';
import { KRKA_SOURCE, KRKA_URL } from './krka.js';
import { TELEKOM_SOURCE, TELEKOM_URL } from './telekom.js';
import { A1_SOURCE, A1_URL } from './a1.js';

function mergeSourceSnapshot(baseline, result, target, now) {
  if (!Array.isArray(baseline?.jobs) || !baseline.jobs.length ||
      !Array.isArray(baseline.sources) || !baseline.sources.length ||
      !Array.isArray(baseline.planned) || !Number.isFinite(Date.parse(baseline.checkedAt))) {
    throw Error('Ciljni zajem: javni posnetek ni popoln');
  }
  if (!Array.isArray(result?.jobs) || !result.jobs.length || !result.progress ||
      !Number.isFinite(Date.parse(now))) throw Error('Ciljni zajem: novi vir ni uspešno vrnil podatkov');
  if (baseline.sources.some(source => source.name === target.name && source.id !== target.id)) {
    throw Error('Ciljni zajem: ime vira je že uporabljeno');
  }
  const existing = baseline.jobs.filter(job => job.source !== target.name);
  const ids = new Set(existing.map(job => job.id));
  for (const job of result.jobs) {
    if (!target.validate(job) || job.source !== target.name || !job.title || !job.company ||
        !job.location || !job.description ||
        ids.has(job.id)) throw Error('Ciljni zajem: neveljaven ali podvojen oglas');
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
  const newSource = { id: target.id, name: target.name, url: target.url,
    status: 'live', count: result.jobs.length, likelyDuplicates: duplicates.get(target.name) || 0,
    [target.id]: result.progress, lastCheckedAt: now };
  const sources = baseline.sources.some(s => s.id === target.id)
    ? baseline.sources.map(s => s.id === target.id ? newSource : { ...s, likelyDuplicates: duplicates.get(s.name) || 0 })
    : [...baseline.sources.map(s => ({ ...s, likelyDuplicates: duplicates.get(s.name) || 0 })), newSource];
  // Drugi metapodatki, preverjeni URL-ji, statusi in števci ostanejo enaki.
  for (const old of baseline.sources.filter(s => s.id !== target.id)) {
    const next = sources.find(s => s.id === old.id);
    if (!next || next.status !== old.status || next.count !== old.count || next.url !== old.url) {
      throw Error('Ciljni zajem: poskus spremembe drugega vira');
    }
  }
  return { ...baseline, jobs, sources,
    planned: baseline.planned.filter(p => p.name !== 'Careerjet' && p.name !== target.name && !target.plannedNames.includes(p.name)),
    discovery: result.state ? { ...baseline.discovery, [target.id]: result.state } : baseline.discovery,
    lastFullCheckedAt: baseline.lastFullCheckedAt || baseline.checkedAt,
    captureMode: 'incremental', lastUpdatedSources: [target.id], checkedAt: now };
}

export function mergeMjobSnapshot(baseline, result, now = new Date().toISOString()) {
  if (!result?.state?.checkedAt) throw Error('Ciljni zajem: novi vir ni uspešno vrnil podatkov');
  return mergeSourceSnapshot(baseline, result, { id: 'mjob', name: MJOB_SOURCE, url: MJOB_URL,
    plannedNames: [], validate: job => /^mjob:\d{4,9}$/.test(job.id) &&
      job.url === MJOB_URL + '/podrobnosti/' + job.id.slice(5) }, now);
}

export function mergeKrkaSnapshot(baseline, result, now = new Date().toISOString()) {
  return mergeSourceSnapshot(baseline, result, { id: 'krka', name: KRKA_SOURCE, url: KRKA_URL,
    plannedNames: ['Krka'], validate: job => /^krka:\d{3,9}$/.test(job.id) &&
      job.url === `https://krka.csod.com/ux/ats/careersite/13/home/requisition/${job.id.slice(5)}?c=krka&lang=sl-SI` }, now);
}

export function mergeTelekomSnapshot(baseline, result, now = new Date().toISOString()) {
  return mergeSourceSnapshot(baseline, result, { id: 'telekom', name: TELEKOM_SOURCE, url: TELEKOM_URL,
    plannedNames: [], validate: job => /^telekom:\d{8,12}$/.test(job.id) &&
      new URL(job.url).origin === 'https://zaposlitev.telekom.si' &&
      new URL(job.url).pathname.endsWith(`/${job.id.slice(8)}/`) }, now);
}

export function mergeA1Snapshot(baseline, result, now = new Date().toISOString()) {
  return mergeSourceSnapshot(baseline, result, { id: 'a1', name: A1_SOURCE, url: A1_URL,
    plannedNames: [], validate: job => /^a1:\d{2,8}$/.test(job.id) &&
      /^https:\/\/jobs\.a1\.com\/sl\/jobs\/job\/\d{2,8}-[^/]+\/?$/i.test(job.url) &&
      new URL(job.url).pathname.match(/^\/sl\/jobs\/job\/(\d{2,8})-/)?.[1] === job.id.slice(3) }, now);
}

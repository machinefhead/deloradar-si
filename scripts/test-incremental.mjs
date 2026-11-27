import assert from 'node:assert/strict';
import { mergeMjobSnapshot, mergeKrkaSnapshot, mergeTelekomSnapshot } from '../source/incremental.js';
import { MJOB_SOURCE, MJOB_URL } from '../source/mjob.js';
import { KRKA_SOURCE, KRKA_URL } from '../source/krka.js';
import { TELEKOM_SOURCE, TELEKOM_URL } from '../source/telekom.js';

const previous = { jobs: [{ id: 'optius:A', source: 'Optius', title: 'Prodaja',
  url: 'https://www.optius.com/a', company: 'ABC', location: 'Maribor', duplicateGroup: 'staro' }],
sources: [{ id: 'optius', name: 'Optius', url: 'https://www.optius.com/', status: 'live', count: 1,
  likelyDuplicates: 1, special: 'ohrani' }], planned: [{ name: MJOB_SOURCE }, { name: 'SPAR Slovenija' }],
  checkedAt: '2026-11-26T10:00:00Z', discovery: { linkedin: { preserved: true } } };
const job = { id: 'mjob:264665', source: MJOB_SOURCE, title: 'Prodaja', company: 'ABC',
  location: 'Maribor', description: 'Pomoč pri prodaji', date: '', deadline: '', url: MJOB_URL + '/podrobnosti/264665' };
const result = { jobs: [job], state: { checkedAt: { '264665': '2026-11-27T10:00:00Z' } },
  progress: { checked: 1, total: 1844, pending: true, requested: 1 } };
const merged = mergeMjobSnapshot(previous, result, '2026-11-27T10:00:00Z');
assert.equal(merged.jobs.length, 2);
const { duplicateGroup: unused, ...oldWithoutDuplicate } = previous.jobs[0];
assert.deepEqual(merged.jobs[0], oldWithoutDuplicate,
  'Odstrani zastarelo oznako dvojnika, stari oglas pa ostane');
assert.equal(merged.sources[0].special, 'ohrani');
assert.equal(merged.sources[0].count, 1);
assert.equal(merged.sources[1].count, 1);
assert.equal(merged.sources[1].mjob.total, 1844);
assert.equal(merged.discovery.linkedin.preserved, true);
assert.equal(merged.lastFullCheckedAt, previous.checkedAt);
assert.equal(merged.captureMode, 'incremental');
assert.equal(merged.planned.length, 1);
assert.ok(merged.planned[0].name.includes('SPAR'));
const second = mergeMjobSnapshot(merged, { ...result, jobs: [{ ...job, description: 'Nov opis' }] }, '2026-11-28T10:00:00Z');
assert.equal(second.jobs.length, 2);
assert.equal(second.jobs[1].description, 'Nov opis');
assert.equal(second.sources.length, 2);
assert.equal(second.lastFullCheckedAt, previous.checkedAt);
assert.deepEqual(second.jobs[0], merged.jobs[0]);
assert.throws(() => mergeMjobSnapshot(previous, { ...result, jobs: [] }), /ni uspešno/);
assert.throws(() => mergeMjobSnapshot(previous, { ...result, jobs: [{ ...job, url: 'http://bad/' }] }), /neveljaven/);
const baselineKrka = { ...merged, planned: [{ name: 'Krka' }, ...merged.planned] };
const krkaJob = { id: 'krka:9221', source: KRKA_SOURCE, title: 'Tehnolog',
  company: KRKA_SOURCE, location: 'Novo mesto', deadline: '2026-12-06', date: '',
  description: 'Pregled in vzdrževanje laboratorijske opreme',
  url: 'https://krka.csod.com/ux/ats/careersite/13/home/requisition/9221?c=krka&lang=sl-SI' };
const krkaMerged = mergeKrkaSnapshot(baselineKrka, { jobs: [krkaJob],
  progress: { checked: 1, total: 1, pending: false } }, '2026-11-28T10:00:00Z');
assert.equal(krkaMerged.jobs.length, 3);
assert.deepEqual(krkaMerged.jobs[0], baselineKrka.jobs[0]);
assert.equal(krkaMerged.sources.find(s => s.id === 'mjob').count, 1);
assert.equal(krkaMerged.sources.find(s => s.id === 'krka').url, KRKA_URL);
assert.deepEqual(krkaMerged.lastUpdatedSources, ['krka']);
assert.deepEqual(krkaMerged.discovery.mjob, merged.discovery.mjob);
assert.equal(krkaMerged.planned.some(s => s.name === 'Krka'), false);
assert.equal(krkaMerged.lastFullCheckedAt, previous.checkedAt);
assert.throws(() => mergeKrkaSnapshot(baselineKrka, { jobs: [{ ...krkaJob, url: 'https://bad.invalid/' }],
  progress: { checked: 1, total: 1 } }), /neveljaven/);
const telekomJob = { id: 'telekom:1458743333', source: TELEKOM_SOURCE,
  title: 'tehnik na terenu', company: 'Telekom Slovenije, d.d.', location: 'Maribor',
  description: 'Javna ponudba za terenskega tehnika v Mariboru', date: '2026-11-19',
  deadline: '2026-11-29',
  url: 'https://zaposlitev.telekom.si/job/tehnik-na-terenu/1458743333/' };
const baselineTelekom = { ...krkaMerged, planned: [...krkaMerged.planned, { name: 'Careerjet' }] };
const telecomMerged = mergeTelekomSnapshot(baselineTelekom, { jobs: [telekomJob],
  progress: { checked: 1, total: 1, pending: false } }, '2026-11-28T10:00:00Z');
assert.equal(telecomMerged.jobs.length, 4);
assert.equal(telecomMerged.sources.find(s => s.id === 'telekom').url, TELEKOM_URL);
assert.deepEqual(telecomMerged.lastUpdatedSources, ['telekom']);
assert.equal(telecomMerged.lastFullCheckedAt, previous.checkedAt);
assert.equal(telecomMerged.planned.some(s => s.name === 'Careerjet'), false);
assert.deepEqual(telecomMerged.jobs.slice(0, -1), krkaMerged.jobs);
assert.throws(() => mergeTelekomSnapshot(baselineTelekom, { jobs: [{ ...telekomJob,
  url: 'https://bad.invalid/' }], progress: { checked: 1, total: 1 } }), /neveljaven/);
console.log('Ciljni zajem: stari oglasi, viri, opis, načrti in datum polnega zajema ostanejo ohranjeni.');

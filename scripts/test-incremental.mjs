import assert from 'node:assert/strict';
import { mergeMjobSnapshot } from '../source/incremental.js';
import { MJOB_SOURCE, MJOB_URL } from '../source/mjob.js';

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
console.log('Ciljni zajem: stari oglasi, viri, opis, načrti in datum polnega zajema ostanejo ohranjeni.');

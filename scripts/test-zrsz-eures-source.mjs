import assert from 'node:assert/strict';
import { normalizeZrszEuresHit, fetchZrszEuresBatch } from '../source/zrsz-eures-source.js';

const id = Buffer.from('3509311 14').toString('base64url');
const now = Date.parse('2026-11-25T12:00:00Z');
const hit = { id, title: 'Kuhar', creationDate: Date.parse('2026-11-24T10:00:00Z'),
  employer: { name: 'Podjetje' }, description: 'Opis' };
const profile = { title: 'Kuhar', description: '<p>Priprava jedi</p>',
  employer: { name: 'Podjetje' }, locations: [{ countryCode: 'si', cityName: 'Maribor' }],
  lastApplicationDate: Date.parse('2026-12-01T00:00:00Z') };
const detail = { id, source: 'ZRSZ', documentId: 'RE91400', reference: '3509311',
  jvProfiles: { sl: profile } };
const valid = normalizeZrszEuresHit(hit, detail, { now });
assert.equal(valid.id, 'zrsz:RE91400');
assert.equal(valid.location, 'Maribor');
assert.equal(valid.description, 'Priprava jedi');
assert.equal(valid.deadline, '2026-12-01');
assert.equal(normalizeZrszEuresHit(hit, { ...detail, jvProfiles: { sl: {
  ...profile, lastApplicationDate: Date.parse('2026-11-23T00:00:00Z') } } }, { now }), null);
assert.equal(normalizeZrszEuresHit(hit, { ...detail, source: 'HZZ' }, { now }), null);
let call = 0;
const mockFetch = async () => new Response(JSON.stringify(call++ === 0
  ? { numberRecords: 1, jvs: [hit] } : detail),
{ status: 200, headers: { 'content-type': 'application/json' } });
const result = await fetchZrszEuresBatch({ fetchImpl: mockFetch, now, pauseMs: 0 });
assert.equal(result.stats.imported, 1);
assert.equal(result.jobs[0].reference, 'RE91400');
console.log('OK: neposredni ZRSZ podatki EURES in roki prijave');

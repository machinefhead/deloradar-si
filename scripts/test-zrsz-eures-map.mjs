import assert from 'node:assert/strict';
import { extractEuresZrszCandidate, planZrszEuresMatches, attachZrszEuresCandidates, attachVerifiedEuresDetailLinks } from '../source/zrsz-eures-map.js';

const handle = value => Buffer.from(value, 'utf8').toString('base64url');
const record = (ref, idp) => ({ source: 'ZRSZ', reference: ref, id: `eures:${handle(`${idp} 1`)}` });
const jobs = ['RE91400', 'RE91401', 'RE91402'].map(reference => ({
  id: `zrsz:${reference}`, reference, source: 'ZRSZ / PoiščiDelo',
}));
const a = record('RE91400', '3509311');
assert.deepEqual(extractEuresZrszCandidate(a), {
  reference: 'RE91400', idp: '3509311', euresId: a.id.slice(6),
});
assert.equal(extractEuresZrszCandidate(record('RF12345', 'abc')), null);
assert.deepEqual(extractEuresZrszCandidate({
  id: a.id.slice(6), source: 'ZRSZ', reference: '3509311', documentId: 'RE91400',
}), { reference: 'RE91400', idp: '3509311', euresId: a.id.slice(6) });
assert.equal(extractEuresZrszCandidate({ id: a.id, source: 'HZZ', reference: '3509311', documentId: 'RE91400' }), null);
assert.equal(extractEuresZrszCandidate({ id: a.id, source: 'ZRSZ', reference: '3509312', documentId: 'RE91400' }), null);
const compound = Buffer.from('3477477-202647 14').toString('base64url');
assert.deepEqual(extractEuresZrszCandidate({ id: compound, source: 'ZRSZ',
  reference: '3477477-202647', documentId: 'RF42951' }),
{ reference: 'RF42951', idp: '3477477', euresId: compound });
assert.equal(extractEuresZrszCandidate({ reference: 'RE91400', id: 'eures:not-an-encoded-id' }), null);
const plan = planZrszEuresMatches(jobs, [
  a, a, record('RE91401', '3509312'), record('RE91401', '3509313'),
  record('RE99999', '3509314'), { reference: 'RE91402', id: 'not-base64' },
]);
assert.equal(plan.stats.matchedCandidates, 1, 'Konfliktni ID ni sprejet');
assert.equal(plan.stats.conflictingReferences, 1);
assert.equal(plan.stats.unmatched, 1);
assert.equal(plan.stats.withoutCandidate, 2);
assert.deepEqual(plan.candidates.map(x => x.reference), ['RE91400']);
assert.equal('url' in plan.candidates[0], false, 'Kandidat nikoli ne postane nepreverjena direktna povezava');
const attached = attachZrszEuresCandidates([{ ...jobs[0], url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/' }], plan.candidates);
assert.equal(attached.stats.matched, 1);
assert.equal(attached.jobs[0].zrszIdCandidate, '3509311');
assert.equal(attached.jobs[0].url, 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/');
const safeId = handle('3509311 14');
const linked = attachVerifiedEuresDetailLinks([{ ...jobs[0], url: attached.jobs[0].url }],
  [{ reference: 'RE91400', idp: '3509311', euresId: safeId }]);
assert.equal(linked.stats.linked, 1);
assert.equal(linked.jobs[0].euresDetailUrlCandidate,
  'https://europa.eu/eures/portal/jv-se/jv-details/' + safeId + '?lang=sl');
assert.equal(linked.jobs[0].url, attached.jobs[0].url);
assert.equal(linked.jobs[0].euresDetailFreshness, 'unverified');
assert.equal(linked.jobs[0].zrszIdCandidate, '3509311');
assert.equal(attachVerifiedEuresDetailLinks(jobs, [
  { reference: 'RE91400', idp: '3509311', euresId: handle('3509312 14') },
]).stats.linked, 0);
console.log('OK: EURES ID kandidati, strogo povezovanje z ZRSZ, zaščita pred konfliktom');

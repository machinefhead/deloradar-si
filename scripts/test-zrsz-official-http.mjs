import assert from 'node:assert/strict';
import { matchZrszListingIds, attachZrszOfficialVerifiedLinks, verifyZrszFreshLinks } from '../source/zrsz-official-http.js';

const daily = [{ id: 'zrsz:RE91400', source: 'ZRSZ / PoiščiDelo', reference: 'RE91400',
  title: 'DIETNI KUHAR - M/Ž', company: 'Podjetje d.o.o.', deadline: '2026-12-01',
  url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/' }];
const listing = [{ idDelovnoMesto: '3509311', nazivDelovnegaMesta: 'Dietni kuhar m/ž',
  delodajalec: 'PODJETJE D.O.O.', datumPrijaveDo: '2026-12-01T00:00:00+01:00' }];
const result = matchZrszListingIds(daily, listing);
assert.equal(result.stats.matched, 1);
assert.equal(result.jobs[0].zrszIdCandidate, '3509311');
assert.equal(result.jobs[0].url, daily[0].url, 'Nezavarovana kandidatna povezava ne sme prepisati ZRSZ URL-ja');
assert.equal(matchZrszListingIds(daily, [...listing, { ...listing[0], idDelovnoMesto: '3509312' }]).stats.ambiguous, 1);
assert.equal(matchZrszListingIds(daily, [{ ...listing[0], datumPrijaveDo: '2026-11-24' }]).stats.matched, 0);
const confirmed = attachZrszOfficialVerifiedLinks(daily, [{ idp: '3509311', reference: 'RE91400' }]);
assert.equal(confirmed.stats.attached, 1);
assert.match(confirmed.jobs[0].url, /\?idp=3509311\/#\/pdm\/3509311$/);
assert.equal(confirmed.jobs[0].zrszIdStatus, 'confirmed-detail');
assert.equal(attachZrszOfficialVerifiedLinks(daily, [
  { idp: '3509311', reference: 'RE91400' }, { idp: '3509312', reference: 'RE91400' },
]).stats.attached, 0);
const changed = attachZrszOfficialVerifiedLinks([{ ...daily[0], zrszIdCandidate: '3509312',
  zrszIdCandidateSource: 'ZRSZ listing' }], [{ idp: '3509311', reference: 'RE91400' }]);
assert.equal(changed.stats.attached, 0, 'Stari predpomnjeni ID ne sme prepisati današnjega');
const first = result.jobs[0];
const previous = attachZrszOfficialVerifiedLinks([first], [{ reference: 'RE91400', idp: '3509311' }]).jobs;
const newCandidate = { ...first, id: 'zrsz:RE91401', reference: 'RE91401',
  zrszIdCandidate: '3509312', zrszIdStatus: 'matched-listing-pending-detail' };
const mismatchCandidate = { ...first, id: 'zrsz:RE91402', reference: 'RE91402',
  zrszIdCandidate: '3509313', zrszIdStatus: 'matched-listing-pending-detail' };
const ieWithoutCandidate = { ...first, id: 'zrsz:IE18067', reference: 'IE18067',
  zrszIdCandidate: undefined, zrszIdStatus: undefined };
const requested = [];
const verify = await verifyZrszFreshLinks([first, newCandidate, mismatchCandidate, ieWithoutCandidate], {
  previous, maxNewDetails: 2, delayMs: 0, client: {
    async detail(idp) {
      requested.push(idp);
      return { idDelovnoMesto: idp, registerskaStevilka: idp === '3509312' ? 'RE91401' : 'WRONG999' };
    },
  },
});
assert.deepEqual(requested.sort(), ['3509312', '3509313'], 'Preverjamo samo nova ID-ja, ne starih ali manjkajočih IE');
assert.equal(verify.stats.cached, 1);
assert.equal(verify.stats.verified, 1);
assert.equal(verify.stats.mismatched, 1);
assert.match(verify.jobs[0].url, /idp=3509311/);
assert.match(verify.jobs[1].url, /idp=3509312/);
assert.equal(verify.jobs[2].url, mismatchCandidate.url, 'Napačna registrska številka ne sme ustvariti neposredne povezave');
assert.equal(verify.jobs[2].zrszIdStatus, 'mismatch-detail');
assert.equal(verify.jobs[3].url, ieWithoutCandidate.url, 'IE brez kandidata ohrani iskalno povezavo');
const secondCalls = [];
const repeated = await verifyZrszFreshLinks([first, newCandidate, mismatchCandidate], {
  previous: verify.jobs, maxNewDetails: 60, delayMs: 0,
  client: { detail: async idp => { secondCalls.push(idp); throw Error('No duplicate requests'); } },
});
assert.equal(secondCalls.length, 0, 'Potrjenih in zavrnjenih ID-jev ne preverjamo ponovno ob naslednji gradnji');
assert.equal(repeated.jobs[2].zrszIdStatus, 'mismatch-detail', 'Negativni rezultat ostane v posnetku');
const throttled = await verifyZrszFreshLinks([newCandidate], { previous: [], maxNewDetails: 0,
  client: { detail: async () => { throw Error('Quota exceeded'); } } });
assert.equal(throttled.stats.attempted, 0);
const recovered = await verifyZrszFreshLinks([newCandidate], { previous: [], maxNewDetails: 1, delayMs: 0,
  client: { detail: async () => { throw Error('Temporary 503'); } } });
assert.equal(recovered.stats.errors, 1);
assert.equal(recovered.jobs[0].zrszIdStatus, 'matched-listing-pending-detail', 'Začasnih napak ne shranjujemo kot zavrnitev');
console.log('OK: uradni ZRSZ HTTP ID-ji, varno povezovanje in zaščita dvojnikov');

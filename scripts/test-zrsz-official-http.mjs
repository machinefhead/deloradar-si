import assert from 'node:assert/strict';
import { matchZrszListingIds, attachZrszOfficialVerifiedLinks } from '../source/zrsz-official-http.js';

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
console.log('OK: uradni ZRSZ HTTP ID-ji, varno povezovanje in zaščita dvojnikov');

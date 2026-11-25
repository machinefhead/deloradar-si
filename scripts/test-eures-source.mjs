import assert from 'node:assert/strict';
import { euresSourceHint, normalizeEuresJob, excludeExistingEures, fetchEuresAdditional, reuseRecentEuresJobs } from '../source/eures-source.js';

assert.equal(euresSourceHint(Buffer.from('3495881 14').toString('base64url')), '14');
assert.equal(euresSourceHint(Buffer.from('2929234 19').toString('base64url')), '19');
const id = Buffer.from('2929234 19').toString('base64url');
const hit = { id, title: 'Varilec', description: '<p>Opis</p>', creationDate: 1793227569000,
  locationMap: { SI: [null] }, employer: { name: 'Delodajalec' } };
const detail = { id, source: 'HZZ', reference: '2929234', jvProfiles: { hr: {
  title: 'Varilec', description: '<p>Opis dela</p>', locations: [{ countryCode: 'si', cityName: 'Koper' }] } } };
const job = normalizeEuresJob(hit, detail);
assert.equal(job.location, 'Koper');
assert.equal(job.description, 'Opis dela');
assert.equal(job.euresSource, 'HZZ');
const due = Date.parse('2026-12-20T00:00:00Z');
const dated = { ...detail, jvProfiles: { hr: { ...detail.jvProfiles.hr, lastApplicationDate: due } } };
assert.equal(normalizeEuresJob(hit, dated, Date.parse('2026-11-25T12:00:00Z')).deadline, '2026-12-20');
assert.equal(normalizeEuresJob(hit, dated, Date.parse('2026-12-21T12:00:00Z')), null,
  'EURES: potečenega oglasa ne prikažemo');
const countryOnly = normalizeEuresJob(hit, { ...detail, jvProfiles: { hr: {
  ...detail.jvProfiles.hr, locations: [{ countryCode: 'si', cityName: 'SLOVENIJA' }],
} } });
assert.equal(countryOnly.location, 'Slovenija (kraj ni naveden)');
assert.equal(countryOnly.locationConfidence, 'country-only');
const moment = Date.parse('2026-11-25T12:00:00Z');
const previousEures = [{ ...countryOnly, euresFetchedAt: new Date(moment - 13 * 3600000).toISOString() }];
assert.equal(reuseRecentEuresJobs(previousEures, moment).length, 1,
  'EURES: naslednji 12-urni zagon uporabi svež predpomnilnik');
assert.equal(reuseRecentEuresJobs(previousEures, moment + 8 * 3600000).length, 0,
  'EURES: po približno enem dnevu zahtevamo svež seznam');
assert.equal(reuseRecentEuresJobs([{ ...countryOnly }], moment).length, 0,
  'EURES: brez preverjenega časa zajema ne zaupamo predpomnilniku');
assert.equal(reuseRecentEuresJobs([{ ...previousEures[0], deadline: '2026-11-24' }], moment).length, 0,
  'EURES: poteklih oglasov iz predpomnilnika ne obdržimo');
assert.equal(normalizeEuresJob(hit, { ...detail, source: 'ZRSZ' }), null);
assert.equal(normalizeEuresJob(hit, { ...detail, jvProfiles: { hr: { locations: [{ countryCode: 'hr' }] } } }), null);
assert.equal(excludeExistingEures([job], [{ title: 'VARILEC', company: 'delodajalec' }]).unique.length, 0);

const responses = [
  { numberRecords: 1, jvs: [hit] }, detail,
];
const fetchImpl = async () => new Response(JSON.stringify(responses.shift()), {
  status: 200, headers: { 'content-type': 'application/json' },
});
const result = await fetchEuresAdditional({ fetchImpl, pages: 1, pageSize: 1, maxDetails: 1, pauseMs: 0 });
assert.equal(result.stats.unique, 1);
assert.equal(result.jobs[0].title, 'Varilec');
const searchedPages = [];
const searchOnly = await fetchEuresAdditional({ pages: 4, pageSize: 1, maxDetails: 0, pauseMs: 0,
  fetchImpl: async (_url, options) => {
    const page = JSON.parse(options.body).page;
    searchedPages.push(page);
    return new Response(JSON.stringify({ numberRecords: 4, jvs: [{ ...hit, id: `${id}-${page}` }] }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
assert.deepEqual(searchedPages, [1, 2, 3, 4], 'EURES: štiri strani pošljemo v enem HTTP paketu');
assert.equal(searchOnly.stats.searchHits, 4);
await assert.rejects(fetchEuresAdditional({ startPage: 65, pages: 2 }), /neveljavne meje/);
console.log('EURES: dodatni oglasi in deduplikacija OK');

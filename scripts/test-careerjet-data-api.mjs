import assert from 'node:assert/strict';
import { fetchCareerjetDataApi, parseCareerjetDataJob } from '../source/careerjet-data-api.js';

const firstId = 'a'.repeat(64);
const secondId = 'b'.repeat(64);
const listing = {
  type: 'JOBS', pages: 1, hits: 2, jobs: [
    { job_id: firstId, title: 'Električar (m/ž)', company: 'Primer d.o.o.',
      locations: 'Ljubljana', date: 'Wed, 25 Nov 2026 09:00:00 GMT',
      description: '<p>Kratek povzetek</p>' },
    { job_id: secondId, title: 'Programer', company: 'Primer 2',
      locations: 'Maribor', description: 'Opis s seznama', url: 'https://www.careerjet.si/primer-oglasa' },
    { job_id: 'INVALID', title: 'Neustrezen identifikator' },
  ],
};
const detail = { type: 'JOB', job: { title: 'Električar (m/ž)',
  description: '<p>Celoten opis.</p><p>Pogoji.</p>', locations: 'Ljubljana' } };
const calls = [];
const fetchImpl = async (url, options) => {
  calls.push(url);
  assert.equal(new URL(url).origin, 'https://data.api.careerjet.net');
  assert.equal(options.headers.authorization, 'Basic ' + Buffer.from('test-secret:').toString('base64'));
  assert.equal(options.headers.accept, 'application/json');
  return new Response(JSON.stringify(url.includes('/job/') ? detail : listing),
    { status: 200, headers: { 'content-type': 'application/json' } });
};
const result = await fetchCareerjetDataApi({ apiKey: 'test-secret', fetchImpl,
  maxPages: 1, maxDetails: 1 });
assert.equal(result.jobs.length, 2);
assert.equal(calls.length, 2, 'Največ en seznam in ena dodatna podrobnost');
assert.equal(result.jobs[0].id, 'careerjet:' + firstId);
assert.match(result.jobs[0].description, /Celoten opis/);
assert.match(result.jobs[0].description, /Pogoji/);
assert.equal(result.jobs[0].sourceLinkStatus, 'search', 'Brez potrjene povezave odpremo iskanje');
assert.equal(result.jobs[1].url, 'https://www.careerjet.si/primer-oglasa');
assert.equal(result.jobs[1].sourceLinkStatus, undefined);
assert.ok(result.jobs[0].careerjetDetailFetchedAt);
const reused = await fetchCareerjetDataApi({ apiKey: 'test-secret', fetchImpl,
  maxDetails: 0, previous: result.jobs });
assert.equal(calls.length, 3, 'Preverjeni celotni opis iz predpomnilnika ne zahteva novega API klica');
assert.equal(reused.jobs[0].description, result.jobs[0].description);
assert.equal(reused.jobs[0].careerjetDetailFetchedAt, result.jobs[0].careerjetDetailFetchedAt);
assert.equal(parseCareerjetDataJob({ job_id: '../../secret', title: 'X' }), null);
assert.equal(parseCareerjetDataJob({ job_id: firstId, title: 'X', url: 'http://insecure.example/' }).sourceLinkStatus, 'search');
await assert.rejects(fetchCareerjetDataApi({}), /manjka API ključ/);
await assert.rejects(fetchCareerjetDataApi({ apiKey: 'test-secret', maxPages: 11 }), /nepravilne omejitve/);
await assert.rejects(fetchCareerjetDataApi({ apiKey: 'test-secret', fetchImpl: async () =>
  new Response('API calls budget exhausted', { status: 402, headers: { 'content-type': 'text/plain' } }) }), /HTTP 402/);
console.log('OK: Careerjet JSON podatkovni API, zasebni ključ, 2 poizvedbi, predpomnilnik in varne povezave');

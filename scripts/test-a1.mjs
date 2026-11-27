import assert from 'node:assert/strict';
import { getA1, parseA1Job, parseA1Listing, A1_URL, A1_SOURCE } from '../source/a1.js';

const root = 'https://jobs.a1.com';
const listUrl = root + '/sl/wp-json/a1-group/v1/filter-jobs?per-page=30&country=slovenia';
const first = { id: '9570', title: 'Ekspert za informacijsko varnost',
  url: root + '/sl/jobs/job/9570-ekspert-za-informacijsko-varnost',
  company: 'A1 Slovenia', dataCompany: 'A1 Slovenia',
  location: 'Ljubljana', dataLocation: 'Ljubljana',
  type: { category: 'Cyber Security', timeType: 'Polni delovni čas', remoteType: 'Delno delo na daljavo' } };
const second = { ...first, id: '9517', title: 'Prodajalec',
  url: root + '/sl/jobs/job/9517-prodajalec', location: 'Koper', dataLocation: 'Koper' };
const foreign = { ...first, id: '9527', company: '', dataCompany: 'Telekom Austria AG',
  url: root + '/sl/jobs/job/9527-vodja', location: '', dataLocation: 'Wien' };
const general = { ...first, id: '1835', title: 'Splošna prijava',
  url: root + '/sl/jobs/job/1835-splosna-prijava' };
const page = { items: [first, foreign, general, second], totalItems: 4, maxPages: 1,
  nextPageUrl: '', filterData: {} };
const listed = parseA1Listing(page);
assert.deepEqual(listed.listed.map(job => job.id), ['9570', '9517']);
assert.equal(listed.foreign, 1);
assert.equal(listed.general, 1);
assert.throws(() => parseA1Listing({ ...page, totalItems: 200 }), /prevelik/);
assert.throws(() => parseA1Listing({ ...page, items: [first, first] }), /podvojen/);
assert.throws(() => parseA1Listing({ ...page, items: [{ ...first, url: 'https://evil.example/job/9570' }] }), /neveljaven/);

const detail = (record, deadline, address) => `<script type="application/ld+json" class="yoast-schema-graph">${JSON.stringify({
  '@graph': [{ '@type': 'JobPosting', '@id': record.url, url: record.url, title: record.title,
    datePosted: '2026-11-27', validThrough: '2026-12-12', hiringOrganization: 'A1 Slovenia',
    jobLocation: [{ '@type': 'Place', address }],
    description: `Pri A1 ponujamo strokovno delo, izobraževanje in razvoj na področju digitalnih rešitev. ` +
      `Opis nalog in pogojev za zaposlitev kandidatk in kandidatov vsebuje vse ključne podatke. ` +
      `Prijave zbiramo do vključno ${deadline}. Kontakt: kadri@example.com.` }] })}</script>`;
const firstHtml = detail(first, '11.12.2026', 'Ljubljana');
const secondHtml = detail(second, '29.11.2026', 'Koper');
const parsed = parseA1Job(firstHtml, listed.listed[0], '2026-11-27T12:00:00Z');
assert.equal(parsed.id, 'a1:9570');
assert.equal(parsed.source, A1_SOURCE);
assert.equal(parsed.deadline, '2026-12-11', 'Uradni opis ima prednost pred zamaknjenim validThrough');
assert.equal(parsed.location, 'Ljubljana');
assert.equal(parsed.employmentType, 'Polni delovni čas');
assert.ok(!parsed.description.includes('kadri@example.com'));
assert.equal(parseA1Job(secondHtml, listed.listed[1], '2026-12-01T12:00:00Z'), null);
assert.throws(() => parseA1Job(detail(first, '11.12.2026', 'Wien'), listed.listed[0]), /ne ujemajo/);
assert.throws(() => parseA1Job(firstHtml.replace('A1 Slovenia', 'Telekom Austria AG'), listed.listed[0]), /ne ujema/);

const calls = [];
const done = await getA1({ fetchImpl: async (url, opts) => {
  calls.push(url);
  assert.equal(opts.redirect, 'manual');
  const response = url === listUrl ? page : url === first.url + '/' ? firstHtml :
    url === second.url + '/' ? secondHtml : null;
  assert.ok(response, 'Ni nepredvidenih zahtevkov');
  return new Response(typeof response === 'string' ? response : JSON.stringify(response), { status: 200 });
}, now: '2026-11-27T12:00:00Z', pauseMs: 0 });
assert.equal(done.jobs.length, 2);
assert.deepEqual(done.jobs.map(job => job.id), ['a1:9570', 'a1:9517']);
assert.deepEqual(done.progress, { checked: 4, total: 4, foreign: 1, general: 1, pending: false });
assert.deepEqual(calls, [listUrl, first.url + '/', second.url + '/']);
await assert.rejects(() => getA1({ fetchImpl: async () =>
  new Response('Blokirano', { status: 429 }), pauseMs: 0 }), /HTTP 429/);
await assert.rejects(() => getA1({ fetchImpl: async () =>
  Response.json({ ...page, totalItems: 5 }), pauseMs: 0 }), /nepopoln seznam/);
assert.equal(A1_URL, root + '/sl/job-search/');
console.log('A1 Slovenija: javni seznam, filtriranje tujih družb, opis, dejanski rok in omejitve zajema uspešni.');

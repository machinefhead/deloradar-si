import assert from 'node:assert/strict';
import { KRKA_SOURCE, KRKA_URL, parseKrkaContext, parseKrkaListing, getKrka } from '../source/krka.js';

const TOKEN = 'x'.repeat(140);
const html = `<script>if(!csod.context)csod.context={"corp":"krka","cultureID":42,` +
  `"cultureName":"sl-SI","endpoints":{"cloud":"https://eu-fra.api.csod.com/"},"token":"${TOKEN}"};</script>`;
const entry = (id, extra = {}) => ({ requisitionId: id,
  displayJobTitle: 'TEHNOLOG v Službi za meroslovje',
  postingEffectiveDate: '27. 11. 2026', postingExpirationDate: '6. 12. 2026',
  locations: [{ city: 'Novo mesto', country: 'SI' }, { city: 'Krško', country: 'SI' }],
  externalDescription: '<p>Upravljanje laboratorijske opreme in pregled merilnikov.</p>' +
    '<p>Piši na kadri@example.com ali pokliči 041 123 456.</p>', ...extra });

const ctx = parseKrkaContext(html);
assert.equal(ctx.cultureId, 42);
assert.equal(ctx.token, TOKEN);
assert.throws(() => parseKrkaContext(html.replace('eu-fra.api.csod.com', 'evil.example')), /nepričakovana/);
assert.throws(() => parseKrkaContext('<html>ni javne konfiguracije</html>'), /manjka/);

const listing = parseKrkaListing({ totalCount: 2, requisitions: [entry(9221),
  entry(9000, { postingExpirationDate: '26. 11. 2026' })] }, { now: '2026-11-27T09:00:00Z' });
assert.equal(listing.jobs.length, 1);
assert.equal(listing.expired, 1);
assert.deepEqual(listing.ids, new Set(['9221', '9000']));
const job = listing.jobs[0];
assert.equal(job.id, 'krka:9221');
assert.equal(job.source, KRKA_SOURCE);
assert.equal(job.company, KRKA_SOURCE);
assert.equal(job.location, 'Novo mesto, Krško');
assert.equal(job.deadline, '2026-12-06');
assert.equal(job.date, '', 'Datum začetka prikaza ni zanesljiv datum objave');
assert.equal(job.url, 'https://krka.csod.com/ux/ats/careersite/13/home/requisition/9221?c=krka&lang=sl-SI');
assert.ok(job.description.includes('Upravljanje laboratorijske opreme'));
assert.ok(!job.description.includes('kadri@example.com'));
assert.ok(!job.description.includes('041 123 456'));
const countryOnly = parseKrkaListing({ totalCount: 2, requisitions: [
  entry(9226, { locations: [{ country: 'SI' }] }),
  entry(7346, { displayJobTitle: 'SPLOŠNA BAZA KANDIDATOV ZA ŠTUDENTSKO DELO',
    locations: [{ country: 'SI' }], postingExpirationDate: '-' }),
] });
assert.equal(countryOnly.jobs.length, 1);
assert.equal(countryOnly.jobs[0].location, 'Slovenija', 'Ne izmišljaj kraja, če je znana samo država');
assert.equal(countryOnly.general, 1, 'Splošno bazo izloči iz dejanskih razpisov');
assert.throws(() => parseKrkaListing({ totalCount: -1, requisitions: [entry(9221)] }), /nepopoln/);
assert.throws(() => parseKrkaListing({ totalCount: 1, requisitions: [entry(9221,
  { postingExpirationDate: '31. 2. 2027' })] }), /obveznih/);
assert.throws(() => parseKrkaListing({ totalCount: 2, requisitions: [entry(9221), entry(9221)] }), /podvojen/);

const requests = [];
const fakeFetch = async (url, options) => {
  requests.push({ url, method: options.method || 'GET', headers: options.headers, body: options.body });
  if (url === KRKA_URL) return new Response(html, { status: 200 });
  if (url.endsWith('/rec-job-search/external/jobs')) {
    assert.equal(options.headers.authorization, `Bearer ${TOKEN}`);
    const { pageNumber, pageSize } = JSON.parse(options.body);
    assert.equal(pageNumber, 1);
    assert.equal(pageSize, 25);
    return Response.json({ data: { totalCount: 1, requisitions: [entry(9221)] } });
  }
  throw Error('Unexpected URL');
};
const result = await getKrka({ fetchImpl: fakeFetch, pauseMs: 0, now: '2026-11-27T09:00:00Z' });
assert.equal(result.jobs.length, 1);
assert.equal(result.progress.checked, 1);
assert.equal(result.progress.pending, false);
assert.equal(requests.length, 2, 'En javni HTML in en javni iskalni odgovor');

const pages = [];
await getKrka({ pauseMs: 0, now: '2026-11-27T09:00:00Z', fetchImpl: async (url, options) => {
  if (url === KRKA_URL) return new Response(html);
  const { pageNumber } = JSON.parse(options.body);
  pages.push(pageNumber);
  return Response.json({ data: { totalCount: 26, requisitions: pageNumber === 1
    ? Array.from({ length: 25 }, (_, i) => entry(8000 + i)) : [entry(8025)] } });
} });
assert.deepEqual(pages, [1, 2]);
await assert.rejects(getKrka({ pauseMs: 0, fetchImpl: async url => url === KRKA_URL
  ? new Response(html) : new Response('blocked', { status: 403 }) }), /403/);
await assert.rejects(getKrka({ pauseMs: 0, fetchImpl: async url => url === KRKA_URL
  ? new Response(html) : Response.json({ data: { totalCount: 1, requisitions: [] } }) }), /straničenje/);
console.log('Krka: anonimni uradni seznam, omejitve, roki, slovenski kraji, zaščita kontaktov in straničenje uspešni.');

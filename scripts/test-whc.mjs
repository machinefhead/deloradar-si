import assert from 'node:assert/strict';
import { getWhc, parseWhcDetails, parseWhcListings } from '../source/whc.js';

function card(type, id, slug, title, location) {
  return `<div class="job-card flex rounded-3xl"><div class="info">
    <div class="meta-location flex"><img src="/pin.svg">${location}</div>
    <h3 class="font-bold"><a href="/${type}/jobs/${slug}-${id}">${title}</a></h3>
    <a href="/${type}/jobs/${slug}-${id}">Podrobnosti</a></div></div>`;
}
const workCard = card('workforce', 217531, 'nastavljalec-strojev-mz', 'Nastavljalec strojev (m/ž)', '8290 Sevnica, Slovenia');
const headsCard = card('heads', 218770, 'vodja-proizvodnje-mz', 'Vodja proizvodnje (m/ž)', 'Logatec');
const signupCard = card('heads', 215830, 'prijava-v-bazo-kandidatov', 'Prijava v bazo kandidatov', 'Slovenia');
const parsed = parseWhcListings(workCard + workCard.replace('217531', '217532'), 'work');
assert.equal(parsed.cards, 2);
assert.equal(parsed.jobs.length, 2);
assert.equal(parsed.jobs[0].id, 'whc:217531');
assert.equal(parsed.jobs[0].location, '8290 Sevnica');
assert.equal(parseWhcListings(headsCard + signupCard, 'heads').jobs.length, 1,
  'Splošna prijava v bazo kandidatov ni oglas za prosto delovno mesto');
assert.equal(parseWhcListings(card('heads', 214555, 'delo', 'Delo', 'Vienna, Austria'), 'heads').jobs.length, 0,
  'Izrecno tuje lokacije izločimo');
assert.throws(() => parseWhcListings(workCard.replace('/workforce/jobs/', 'https://other.example/'), 'work'),
  /nepričakovana povezava/, 'Tujih URL-jev ne smemo izvoziti');

function details(title, id) {
  const schema = {
    '@context': 'https://schema.org', '@type': 'JobPosting', title,
    description: 'Skrb za delovne procese in &scaron;iritev ekipe. Pišite oseba@whc-slovenia.com ali 040 123 456.',
    datePosted: '2026-11-26T00:00:00+01:00', validThrough: '2027-02-24T00:00:00+01:00',
    employmentType: 'FULL_TIME', image: `https://whc-slovenia.com/data/offers/217/2175/${id}/0.jpg`,
    jobLocation: { address: { addressLocality: 'Sevnica' } },
  };
  return `<section class="job-details-section"><div class="job-info">
    <div class="job-description"><h2>Naloge</h2><ul><li>Nadzor strojev</li></ul></div>
    <h2>Naša ponudba</h2><ul><li>Stalna zaposlitev</li>
      <li>Več informacij na tel. 040 123 456, oseba@whc-slovenia.com</li></ul>
    <h2>Pričakovanja</h2><ul><li>Tehnična izobrazba</li></ul></div></section>
    <script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
const first = parsed.jobs[0];
const filled = parseWhcDetails(details(first.title, 217531), first, Date.parse('2026-11-26T11:00:00Z'));
assert.equal(filled.date, '2026-11-26');
assert.equal(filled.deadline, '2027-02-24');
assert.equal(filled.employmentType, 'FULL_TIME');
assert.match(filled.description, /širitev ekipe/, 'Slovenske HTML entitete so pravilno dekodirane');
assert.match(filled.responsibilities, /Nadzor strojev/);
assert.match(filled.requirements, /Tehnična izobrazba/);
assert.match(filled.benefits, /Stalna zaposlitev/);
assert.doesNotMatch(JSON.stringify(filled), /040 123 456|oseba@/, 'Kontaktov posameznikov ne uvažamo');
assert.equal(parseWhcDetails(details('Napačen naziv', 217531), first), null);
assert.equal(parseWhcDetails(details(first.title, 555555), first), null);

const urls = [], contentByPath = new Map([
  ['/workforce/jobs/nastavljalec-strojev-mz-217531', details('Nastavljalec strojev (m/ž)', 217531)],
  ['/heads/jobs/vodja-proizvodnje-mz-218770', details('Vodja proizvodnje (m/ž)', 218770)],
]);
const fetchImpl = async (url, options) => {
  urls.push(url);
  const parsedUrl = new URL(url);
  if (parsedUrl.searchParams.get('block') === 'Recru_Ajax') {
    assert.equal(options.headers['x-requested-with'], 'XMLHttpRequest');
    const type = parsedUrl.searchParams.get('recru_type');
    const page = Number(parsedUrl.searchParams.get('page'));
    return { ok: true, headers: { get: () => 'text/html; charset=UTF-8' },
      text: async () => page > 1 ? '' : type === 'work' ? workCard : headsCard + signupCard };
  }
  if (!contentByPath.has(parsedUrl.pathname)) throw Error('Nepričakovan zahtevek ' + url);
  return { ok: true, headers: { get: () => 'text/html' }, text: async () => contentByPath.get(parsedUrl.pathname) };
};
const now = Date.parse('2026-11-26T11:00:00Z');
const jobs = await getWhc({ fetchImpl, now, maxDetails: 2 });
assert.equal(jobs.length, 2);
assert.ok(jobs.every(job => job.description && job.detailsFetchedAt));
assert.equal(urls.length, 6, 'Štiri strani seznama in dva HTTP zahtevka za opis');
urls.length = 0;
const cached = await getWhc({ fetchImpl, previous: jobs, now: now + 86_400_000, maxDetails: 2 });
assert.equal(cached.length, 2);
assert.equal(urls.length, 4, 'Pri svežem predpomnilniku ne prenašamo opisov ponovno');
await assert.rejects(getWhc({ fetchImpl, maxPages: 1, maxDetails: 0 }), /straničenje za work ni popolno/);
console.log('OK: WHC neposredni HTTP seznami, dve kategoriji, celotni opisi, varni URL-ji in predpomnilnik');

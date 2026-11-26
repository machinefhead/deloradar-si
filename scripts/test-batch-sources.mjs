import assert from 'node:assert/strict';
import { SMARTRECRUITERS_BOARDS, getPublicSmartRecruitersBoard,
  parseSmartRecruitersJob } from '../source/smartrecruiters.js';
import { NOVARTIS_SOURCE, getNovartisWorkday, parseNovartisJob } from '../source/novartis-workday.js';
import { ASHBY_BOARDS, parseAshbyBoard, getPublicAshbyBoard } from '../source/ashby.js';
import { ATS_BOARDS } from '../source/public-ats.js';
import { WORKABLE_BOARDS } from '../source/workable.js';

const now = Date.parse('2026-11-26T20:00:00Z');
const smart = SMARTRECRUITERS_BOARDS.find(board => board.id === 'sportradar');
const rawSmart = { id: '744000163815771', name: 'Razvijalec aplikacij',
  location: { country: 'si', city: 'Ljubljana' }, releasedDate: '2026-11-25T10:00:00Z' };
const smartDetail = { ...rawSmart, active: true, postingUrl:
  'https://jobs.smartrecruiters.com/Sportradar/744000163815771-razvijalec-aplikacij',
  company: { name: 'Sportradar' }, typeOfEmployment: { label: 'Full-time' },
  jobAd: { sections: {
    jobDescription: { text: '<p>Razvoj podatkovnih aplikacij.</p>' },
    qualifications: { text: '<p>Znanje JavaScript.</p>' },
    additionalInformation: { text: '<p>Prilagodljiv urnik.</p> Kontakt: zaposlitev@example.com' },
  } } };
const parsedSmart = parseSmartRecruitersJob(rawSmart, smartDetail, smart, now);
assert.equal(parsedSmart.id, 'smartrecruiters:sportradar:744000163815771');
assert.equal(parsedSmart.location, 'Ljubljana');
assert.equal(parsedSmart.date, '2026-11-25');
assert.match(parsedSmart.description, /Razvoj podatkovnih aplikacij/);
assert.equal(parsedSmart.requirements, 'Znanje JavaScript.');
assert.equal(parsedSmart.additionalInformation, 'Prilagodljiv urnik.');
assert.doesNotMatch(parsedSmart.description, /zaposlitev@example\.com|<p>/);
assert.equal(parseSmartRecruitersJob(rawSmart,
  { ...smartDetail, postingUrl: 'https://example.com/oglas' }, smart, now), null);
assert.equal(parseSmartRecruitersJob({ ...rawSmart, location: { country: 'de' } },
  smartDetail, smart, now), null);
assert.equal(parseSmartRecruitersJob({ ...rawSmart, unpublishOn: '2026-11-01' },
  smartDetail, smart, now), null);
const coface = SMARTRECRUITERS_BOARDS.find(board => board.id === 'coface');
assert.equal(parseSmartRecruitersJob({ ...rawSmart, name: 'Send us your CV' },
  { ...smartDetail, name: 'Send us your CV', postingUrl:
    'https://jobs.smartrecruiters.com/Coface/744000163815771-send-us-your-cv' }, coface, now), null,
  'Splošne prijave ne obravnavamo kot konkretno razpisano delovno mesto');
const smartUrls = [];
const smartFetch = async url => {
  smartUrls.push(url);
  return new Response(JSON.stringify(url.includes('?country=si')
    ? { totalFound: 1, content: [rawSmart] } : smartDetail),
  { status: 200, headers: { 'content-type': 'application/json' } });
};
const smartJobs = await getPublicSmartRecruitersBoard(smart,
  { fetchImpl: smartFetch, now });
assert.equal(smartJobs.length, 1);
assert.equal(smartUrls.length, 2, 'En seznam in ena HTTP podrobnost');
const cachedSmart = await getPublicSmartRecruitersBoard(smart,
  { fetchImpl: smartFetch, previous: smartJobs, now: now + 86_400_000 });
assert.equal(smartUrls.length, 3, 'Svež opis mora priti iz predpomnilnika');
assert.equal(cachedSmart[0].description, smartJobs[0].description);

assert.equal(NOVARTIS_SOURCE.name, 'Novartis');
const facet = 'db69d9f0446c11de98360015c5e6daf6';
const novartisRows = [
  { title: 'Inženir proizvodnje', locationsText: 'Ljubljana',
    externalPath: '/job/Ljubljana/Inzenir-proizvodnje_REQ-10000001-1' },
  { title: 'Vodja kakovosti', locationsText: '2 Locations',
    externalPath: '/job/Ivrea/Vodja-kakovosti_REQ-10000002' },
];
const novartisDetail = (row, country, additionalLocations = []) => ({ jobPostingInfo: {
  title: row.title, country: { descriptor: country },
  location: country === 'Slovenia' ? 'Ljubljana' : 'Ivrea', additionalLocations,
  jobDescription: '<p>Vodenje procesov.</p><ul><li>Kontrola kakovosti</li></ul>',
  startDate: '2026-11-25', timeType: 'Full time', canApply: true,
} });
const foreign = novartisDetail(novartisRows[1], 'Italy', []);
assert.equal(parseNovartisJob(novartisRows[1], foreign, facet), null,
  'Tujega razpisa brez dokazano slovenske lokacije ne uvažamo');
assert.equal(parseNovartisJob(novartisRows[1],
  novartisDetail(novartisRows[1], 'Italy', ['Ljubljana']), facet)?.location, 'Ljubljana');
const novartisUrls = [];
const novartisFetch = async (url, options) => {
  novartisUrls.push({ url, method: options.method || 'GET' });
  let payload;
  if (url.endsWith('/jobs')) {
    const body = JSON.parse(options.body);
    payload = body.searchText === 'Slovenia'
      ? { facets: [{ facetParameter: 'locationMainGroup', values: [{ facetParameter: 'locationCountry',
        values: [{ descriptor: 'Slovenia', id: facet }] }] }] }
      : { total: 2, jobPostings: novartisRows };
  } else {
    const row = novartisRows.find(row => url.endsWith(row.externalPath));
    payload = novartisDetail(row, row === novartisRows[0] ? 'Slovenia' : 'Italy',
      row === novartisRows[1] ? ['Ljubljana'] : []);
  }
  return new Response(JSON.stringify(payload),
    { status: 200, headers: { 'content-type': 'application/json' } });
};
const novartisJobs = await getNovartisWorkday({ fetchImpl: novartisFetch, now });
assert.equal(novartisJobs.length, 2);
assert.equal(novartisUrls.length, 4, 'Iskanje facete, seznam in dve podrobnosti');
assert.ok(novartisJobs.every(job => job.description.includes('Kontrola kakovosti')));
assert.ok(novartisJobs.every(job => job.url.startsWith('https://novartis.wd3.myworkdayjobs.com/')));
assert.equal(novartisJobs[0].date, '2026-11-25');
await getNovartisWorkday({ fetchImpl: novartisFetch, previous: novartisJobs,
  now: now + 86_400_000 });
assert.equal(novartisUrls.length, 6, 'Ponovitev uporabi predpomnilnik, brez dveh HTTP podrobnosti');

const ashby = ASHBY_BOARDS.find(board => board.id === 'xds');
const ashbyPayload = { jobs: [
  { id: '1b4fb4a3-1be0-4b79-a152-887637ea7c5c', title: 'Komercialist',
    isListed: true, location: 'Ljubljana, Slovenia',
    jobUrl: 'https://jobs.ashbyhq.com/xds/1b4fb4a3-1be0-4b79-a152-887637ea7c5c',
    descriptionPlain: 'Prodaja na slovenskem trgu. Kontakt test@example.com',
    publishedAt: '2026-11-20T12:00:00Z' },
  { id: '1b4fb4a3-1be0-4b79-a152-887637ea7c5d', title: 'Tuji oglas',
    isListed: true, location: 'Berlin, Germany' },
] };
const ashbyJobs = parseAshbyBoard(ashbyPayload, ashby);
assert.equal(ashbyJobs.length, 1);
assert.equal(ashbyJobs[0].location, 'Ljubljana');
assert.equal(ashbyJobs[0].date, '2026-11-20');
assert.doesNotMatch(ashbyJobs[0].description, /test@example\.com/);
assert.throws(() => parseAshbyBoard({ jobs: [{ ...ashbyPayload.jobs[0],
  jobUrl: 'https://example.com/jobs/not-verified' }] }, ashby));
const ashbyRequests = [];
await getPublicAshbyBoard(ashby, { fetchImpl: async url => {
  ashbyRequests.push(url);
  return new Response(JSON.stringify(ashbyPayload),
    { status: 200, headers: { 'content-type': 'application/json' } });
} });
assert.deepEqual(ashbyRequests,
  ['https://api.ashbyhq.com/posting-api/job-board/xds?includeCompensation=true']);
const sunrise = ASHBY_BOARDS.find(board => board.id === 'sunrise');
const sunriseRows = [{
  id: '1b4fb4a3-1be0-4b79-a152-887637ea7c51', title: 'QA Engineer',
  isListed: true, location: 'CET +/- 3', workplaceType: 'Remote',
  address: { postalAddress: { addressCountry: 'Slovenia', addressLocality: 'Ljubljana' } },
  jobUrl: 'https://jobs.ashbyhq.com/sunrise/1b4fb4a3-1be0-4b79-a152-887637ea7c51',
  descriptionPlain: 'Preverjanje programske opreme na robotskih celicah.',
}, {
  id: '1b4fb4a3-1be0-4b79-a152-887637ea7c52', title: 'Svetovalec na daljavo',
  isListed: true, location: 'Dubai', address: { postalAddress: { addressCountry: 'United Arab Emirates' } },
  secondaryLocations: [{ location: 'Slovenia (Remote)',
    address: { postalAddress: { addressCountry: 'Slovenia' } } }],
  jobUrl: 'https://jobs.ashbyhq.com/sunrise/1b4fb4a3-1be0-4b79-a152-887637ea7c52',
  descriptionPlain: 'Delo na daljavo iz Slovenije.', workplaceType: 'Remote',
}, {
  id: '1b4fb4a3-1be0-4b79-a152-887637ea7c53', title: 'Tuji oglas',
  isListed: true, location: 'Berlin', address: { postalAddress: { addressCountry: 'Germany' } },
}];
const sunriseParsed = parseAshbyBoard({ jobs: sunriseRows }, sunrise);
assert.equal(sunriseParsed.length, 2, 'Slovenija iz uradnega addressCountry in sekundarne lokacije');
assert.equal(sunriseParsed[0].location, 'Ljubljana');
assert.equal(sunriseParsed[1].location, 'Slovenija (delo na daljavo)');
assert.ok(ASHBY_BOARDS.some(board => board.id === 'paradox'));
assert.ok(ASHBY_BOARDS.some(board => board.id === 'axelera'));
assert.ok(SMARTRECRUITERS_BOARDS.some(board => board.id === 'abbvie'));
assert.ok(SMARTRECRUITERS_BOARDS.some(board => board.id === 'konecranes'));
assert.ok(ATS_BOARDS.some(board => board.id === 'rws'));
assert.ok(WORKABLE_BOARDS.find(board => board.id === 'moneyhub'));

console.log('OK: SmartRecruiters, Novartis Workday, Ashby, javni HTTP, zasebni stiki in predpomnilnik');

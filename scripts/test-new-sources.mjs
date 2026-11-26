import assert from 'node:assert/strict';
import { parseStudentWorkPage, getStudentWork } from '../source/student-work.js';
import { ATS_BOARDS, getPublicAtsBoard } from '../source/public-ats.js';
import { WORKABLE_BOARDS, getPublicWorkableBoard, parseWorkableJobs } from '../source/workable.js';
import { jobPostingDetails } from '../source/job-details.js';
import { parseNovaPriloznostJob } from '../source/next-sources.js';
import { getCompeto } from '../source/competo.js';
import { getCeltra, parseCeltraFeed } from '../source/celtra.js';

function celtraItem(id, country, deadline = '', url = `http://celtra.hire.trakstar.com/jobs/${id}`) {
  return `<item><title>Inženir &amp; razvijalec</title><link>${url}</link>
    <description>&lt;p&gt;Razvoj&amp;nbsp;aplikacij&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Priprava projektov&lt;/li&gt;&lt;/ul&gt;
    Kontakt: test@celtra.si</description>
    <pubDate>Thu, 26 Nov 2026 00:00:00 +0530</pubDate>
    <job:locationCity>Ljubljana</job:locationCity><job:locationCountry>${country}</job:locationCountry>
    <job:closeDte>${deadline}</job:closeDte><job:positionType>full_time</job:positionType>
    <job:team>Engineering</job:team></item>`;
}
const celtraFeed = `<rss version="2.0"><channel><title>Jobs at Celtra, Inc.</title>
  ${celtraItem('fk01abc', 'Slovenia')}
  ${celtraItem('fk01abd', 'United States')}
  ${celtraItem('fk01abe', 'Slovenia', '2026-11-01')}
  </channel></rss>`;
const parsedCeltra = parseCeltraFeed(celtraFeed, Date.parse('2026-11-26T12:00:00Z'));
assert.equal(parsedCeltra.length, 1);
assert.equal(parsedCeltra[0].id, 'celtra:fk01abc');
assert.equal(parsedCeltra[0].url, 'https://celtra.hire.trakstar.com/jobs/fk01abc/');
assert.equal(parsedCeltra[0].employmentType, 'Polni delovni čas');
assert.equal(parsedCeltra[0].jobCategory, 'Engineering');
assert.match(parsedCeltra[0].description, /Razvoj aplikacij[\s\S]*Priprava projektov/);
assert.doesNotMatch(parsedCeltra[0].description, /test@celtra\.si|<p>/);
assert.throws(() => parseCeltraFeed(celtraFeed.replace(
  'http://celtra.hire.trakstar.com/jobs/fk01abc', 'https://example.com/jobs/fk01abc')));
const celtraRequests = [];
const fetchedCeltra = await getCeltra({ fetchImpl: async url => {
  celtraRequests.push(url);
  return new Response(celtraFeed, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
} });
assert.equal(fetchedCeltra.length, 1, 'Tuji in potekli razpisi ne sodijo med slovenske oglase');
assert.deepEqual(celtraRequests, ['https://celtra.hire.trakstar.com/jobfeeds/celtra']);

function studentPage(page, id) {
  return `<div id="results"><article class="job-item" data-jobid="${id}">
    <h5>POMOČ PRI DELU</h5>
    <p><svg><use xlink:href="/icons.svg#icon-location"></use></svg> Ljubljana</p>
    <li class="job-payment"><strong>8.50 €/h neto</strong></li>
    <p class="description text-break">Pomoč pri urejanju dokumentacije.</p>
    <li>Trajanje: <strong><!--sse-->DLJE ČASA<!--/sse--></strong></li>
    <li>Delovnik: <strong><!--sse-->DOPOLDAN<!--/sse--></strong></li>
    <a href="/studenti/prosta-dela?isci=1&vsadelapodj=1&kljb=Podjetje+%C4%8D">Vsa dela podjetja</a>
    </article></div>
    <div class="page-item active"><a>${page}</a></div><a data-page="2">2</a>`;
}
const parsed = parseStudentWorkPage(studentPage(1, '123456'));
assert.equal(parsed.totalPages, 2);
assert.equal(parsed.jobs.length, 1);
assert.equal(parsed.jobs[0].company, 'Podjetje č');
assert.equal(parsed.jobs[0].contractDuration, 'DLJE ČASA');
assert.equal(parsed.jobs[0].salary, '8.50 €/h neto');
assert.equal(parsed.jobs[0].url, 'https://www.studentski-servis.com/studenti/prosta-dela?isci=1&kljb=123456');
await assert.rejects(async () => parseStudentWorkPage(studentPage(2, '123456'), 1));
const studentJobs = await getStudentWork({ fetchImpl: async url => {
  const page = Number(new URL(url).searchParams.get('page'));
  return new Response(studentPage(page, String(123455 + page)), { status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' } });
} });
assert.equal(studentJobs.length, 2);

const greenhouse = ATS_BOARDS.find(board => board.id === 'planetlabs');
const greenhouseJobs = await getPublicAtsBoard(greenhouse, { fetchImpl: async () =>
  new Response(JSON.stringify({ jobs: [
    { id: 1234, title: 'Inženir', location: { name: 'Ljubljana, Slovenia' },
      company_name: 'Planet Labs', absolute_url: 'https://job-boards.greenhouse.io/planetlabs/jobs/1234',
      first_published: '2026-11-25T10:00:00Z', content: '&lt;p&gt;Razvoj programske opreme&lt;/p&gt;' },
    { id: 1235, title: 'Engineer', location: { name: 'New York, USA' },
      absolute_url: 'https://job-boards.greenhouse.io/planetlabs/jobs/1235' },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } }) });
assert.equal(greenhouseJobs.length, 1);
assert.equal(greenhouseJobs[0].description, 'Razvoj programske opreme');
assert.equal(greenhouseJobs[0].date, '2026-11-25');

const outfit7 = ATS_BOARDS.find(board => board.id === 'outfit7');
const outfit7Jobs = await getPublicAtsBoard(outfit7, { fetchImpl: async () =>
  new Response(JSON.stringify({ jobs: [
    { id: 1234567, title: 'Računovodja', location: { name: 'Ljubljana, Slovenia; Limassol, Cyprus' },
      absolute_url: 'https://outfit7.com/careers/jobs?gh_jid=1234567',
      content: '&lt;p&gt;/&lt;/p&gt;', metadata: [
        { name: 'Publish - Description (Recruiter)', value: 'Obdelava podatkov in poročil.' },
        { name: 'Publish - Responsibilities (Recruiter)', value: 'Priprava bilanc.' },
        { name: 'Publish - Required Skills (Recruiter)', value: 'Računovodske izkušnje.' },
        { name: 'Employment Type', value: 'Full-time' },
        { name: 'Work Type', value: ['Hybrid'] },
        { name: 'Publish - SLO Title (Recruiter)', value: 'Računovodja (m/ž)' },
        { name: 'Publish - Compensation', value: 'Plača po dogovoru.' },
      ] },
    { id: 1234568, title: 'Talent Pool for Growth', location: { name: 'Ljubljana, Slovenia' },
      absolute_url: 'https://outfit7.com/careers/jobs?gh_jid=1234568', content: 'Baza prijav.' },
    { id: 1234569, title: 'Razvijalec', location: { name: 'Berlin, Germany' },
      absolute_url: 'https://outfit7.com/careers/jobs?gh_jid=1234569' },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } }) });
assert.equal(outfit7Jobs.length, 1, 'Baze kandidatov in tujih oglasov ne uvažamo');
assert.equal(outfit7Jobs[0].location, 'Ljubljana');
assert.equal(outfit7Jobs[0].description, 'Obdelava podatkov in poročil.\n\nPriprava bilanc.\n\nRačunovodske izkušnje.');
assert.equal(outfit7Jobs[0].responsibilities, 'Priprava bilanc.');
assert.equal(outfit7Jobs[0].workplaceType, 'Hybrid');
assert.equal(outfit7Jobs[0].localTitle, 'Računovodja (m/ž)');
assert.equal(outfit7Jobs[0].salaryNote, 'Plača po dogovoru.');

const plume = ATS_BOARDS.find(board => board.id === 'plume');
const plumeJobs = await getPublicAtsBoard(plume, { fetchImpl: async () =>
  new Response(JSON.stringify({ jobs: [
    { id: 1234567, title: 'Razvijalec', location: { name: 'Ljubljana' },
      absolute_url: 'https://www.plume.com/career-opportunities/?gh_jid=1234567',
      content: '&lt;p&gt;Programiranje storitev&lt;/p&gt;' },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } }) });
assert.equal(plumeJobs.length, 1);
assert.equal(plumeJobs[0].description, 'Programiranje storitev');

const teads = ATS_BOARDS.find(board => board.id === 'teads1');
const teadsJobs = await getPublicAtsBoard(teads, { fetchImpl: async () =>
  new Response(JSON.stringify({ jobs: [
    { id: 1234567, title: 'Inženir', location: { name: 'Ljubljana' },
      absolute_url: 'https://job-boards.eu.greenhouse.io/teads1/jobs/1234567',
      content: 'Programiranje' },
    { id: 1234568, title: 'Open Application', location: { name: 'Ljubljana' },
      absolute_url: 'https://job-boards.eu.greenhouse.io/teads1/jobs/1234568' },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } }) });
assert.equal(teadsJobs.length, 1);

const povio = WORKABLE_BOARDS.find(board => board.id === 'povio');
const slLocation = city => ({ country: 'Slovenia', countryCode: 'SI', city });
const workableJob = (city, shortcode = 'ABCD123456') => ({
  shortcode, title: 'Razvijalec podatkovnih sistemov',
  url: 'https://apply.workable.com/j/' + shortcode,
  description: '<p>Razvoj podatkovnih rešitev.</p><p>Pišite test@example.com</p>',
  published_on: '2026-11-20T10:00:00Z', employment_type: 'Full-time',
  department: 'Engineering', locations: [slLocation(city)],
});
const workablePayload = { jobs: [
  workableJob('Ljubljana'), workableJob('Maribor'), workableJob('Celje'),
  { ...workableJob('Berlin', 'CDEF123456'), locations: [{ country: 'Germany', countryCode: 'DE', city: 'Berlin' }] },
] };
const oneWorkable = parseWorkableJobs(workablePayload, povio);
assert.equal(oneWorkable.length, 1, 'Več krajev istega ID-ja ne sme ustvariti dvojnikov');
assert.deepEqual(oneWorkable[0].locations, ['Ljubljana', 'Maribor', 'Celje']);
assert.equal(oneWorkable[0].id, 'workable:povio:ABCD123456');
assert.equal(oneWorkable[0].url, 'https://apply.workable.com/j/ABCD123456');
assert.equal(oneWorkable[0].date, '2026-11-20');
assert.equal(oneWorkable[0].employmentType, 'Full-time');
assert.match(oneWorkable[0].description, /Razvoj podatkovnih rešitev/);
assert.doesNotMatch(oneWorkable[0].description, /test@example\.com|<p>/);
assert.throws(() => parseWorkableJobs({ jobs: [
  { ...workableJob('Ljubljana'), url: 'https://example.com/j/ABCD123456' },
] }, povio), /stabilnega ID-ja/);
const workableRequests = [];
const workableFetched = await getPublicWorkableBoard(povio, { fetchImpl: async url => {
  workableRequests.push(url);
  return new Response(JSON.stringify(workablePayload), { status: 200,
    headers: { 'content-type': 'application/json' } });
} });
assert.equal(workableFetched.length, 1);
assert.deepEqual(workableRequests, ['https://apply.workable.com/api/v1/widget/accounts/povio?details=true'],
  'Seznam in celotni opisi pridejo v enem HTTP odgovoru');

const aleph = ATS_BOARDS.find(board => board.id === 'aleph');
const leverJobs = await getPublicAtsBoard(aleph, { fetchImpl: async () =>
  new Response(JSON.stringify([{ id: '12345678-1234-1234-1234-123456789abc',
    country: 'SI', text: 'Razvijalec', categories: { location: 'Ljubljana, Slovenia', department: 'IT' },
    hostedUrl: 'https://jobs.lever.co/aleph/12345678-1234-1234-1234-123456789abc',
    createdAt: 1795600800000, descriptionPlain: 'Uvodni opis.',
    lists: [{ text: 'Naloge', content: '<ul><li>Razvoj aplikacij</li></ul>' }],
    additionalPlain: 'Dodatne informacije.' }]), { status: 200,
    headers: { 'content-type': 'application/json' } }) });
assert.equal(leverJobs.length, 1);
assert.match(leverJobs[0].description, /Naloge[\s\S]*Razvoj aplikacij/);
assert.match(leverJobs[0].description, /Dodatne informacije/);

assert.equal(jobPostingDetails({ baseSalary: { currency: 'USD', value: { unitText: 'MONTH' } } }).salary, undefined);
const novaListing = { id: 'novapriloznost:oglas', url: 'https://novapriloznost.si/delovno-mesto/oglas/' };
function nova(city) {
  const data = { '@type': 'JobPosting', title: 'Primer dela', datePosted: '2026-11-25',
    validThrough: '2026-12-31', jobLocation: { '@type': 'Place', address: city } };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}
assert.equal(parseNovaPriloznostJob(nova('Stuttgart'), novaListing), null);
assert.equal(parseNovaPriloznostJob(nova('Ljubljana'), novaListing)?.location, 'Ljubljana');
const competoRows = [
  { uid: '6ad20f0feb4ac', name: 'Pravnik za javna naročila', city: 'Ljubljana',
    dateFrom: '2026-11-17', worktime: 'Polni delovni čas' },
  { uid: '6ad20f0feb4ab', name: 'Engineer', city: 'Berlin, Germany', dateFrom: '2026-11-16' },
];
const requestedCompeto = [];
const competoFetch = async url => {
  requestedCompeto.push(url);
  const data = url.endsWith('/6ad20f0feb4ac')
    ? { ...competoRows[0], aboutCompany: 'Pomembna organizacija.',
      description: 'Priprava pogodbe.', expectations: 'Pravo in natančnost.',
      offerings: 'Izobraževanja. Kontakt: ime@competo.si\nZa več informacij lahko kontaktirate vodjo projekta na 051/357 116 (Jasna Benko Živec).' }
    : competoRows;
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
};
const competoNow = Date.parse('2026-11-26T12:00:00Z');
const competoJobs = await getCompeto({ fetchImpl: competoFetch, now: competoNow });
assert.equal(competoJobs.length, 1);
assert.equal(competoJobs[0].company, 'COMPETO d.o.o.');
assert.equal(competoJobs[0].url, 'https://portal.digi.competo.si/jobs/6ad20f0feb4ac');
assert.match(competoJobs[0].description, /Priprava pogodbe[\s\S]*Pravo in natančnost[\s\S]*Izobraževanja/);
assert.doesNotMatch(competoJobs[0].description, /ime@competo.si/);
assert.doesNotMatch(competoJobs[0].description, /051\/357 116|Jasna Benko Živec|kontaktirate vodjo/i);
assert.equal(requestedCompeto.length, 2, 'En seznam in ena podrobnost');
const cachedCompeto = await getCompeto({ previous: competoJobs, fetchImpl: competoFetch, now: competoNow + 86_400_000 });
assert.equal(requestedCompeto.length, 3, 'Sveže opise uporabimo iz predpomnilnika');
assert.equal(cachedCompeto[0].description, competoJobs[0].description);
console.log('OK: študentski HTML, Greenhouse/Lever/Competo JSON, polni opis, plača in tuje lokacije');

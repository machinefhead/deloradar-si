import assert from 'node:assert/strict';
import { parseStudentWorkPage, getStudentWork } from '../source/student-work.js';
import { ATS_BOARDS, getPublicAtsBoard } from '../source/public-ats.js';
import { jobPostingDetails } from '../source/job-details.js';
import { parseNovaPriloznostJob } from '../source/next-sources.js';
import { getCompeto } from '../source/competo.js';

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

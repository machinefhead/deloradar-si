import assert from 'node:assert/strict';
import { parseFirstJobList, parseFirstJobDetail, parseCinkarnaList, parseCinkarnaDetail,
  getFirstJob, getCinkarna } from '../source/new-sources.js';

const firstjobUrl = 'https://firstjob.si/delovno-mesto/studentsko-delo-v-strezbi-m-z-maribor/';
function firstjobCard(date = '18/11/2026') {
  return `<article class="bde-loop-item ee-post"><a class="bde-container-link" href="${firstjobUrl}">
    <div class="bde-text-1">${date}</div>
    <h3 class="bde-heading-2 bde-heading">ŠTUDENTSKO DELO V STREŽBI (m/ž) – MARIBOR</h3>
    <div class="bde-text-3">Vrsta dela:</div><div class="bde-text-4">GOSTINSTVO</div>
    <div class="bde-text-5">Lokacija</div><div class="bde-div-6"><div class="bde-text-7">Maribor</div></div>
    </a></article>`;
}
const firstjobList = firstjobCard();
const firstjob = parseFirstJobList(firstjobList, '2026-11-27');
assert.equal(firstjob.length, 1);
assert.equal(firstjob[0].url, firstjobUrl);
assert.equal(firstjob[0].location, 'Maribor');
assert.equal(firstjob[0].date, '2026-11-18');
assert.equal(firstjob[0].source, 'FirstJob (študentsko delo)');
assert.deepEqual(parseFirstJobList(firstjobCard('01/01/2026'), '2026-11-27'), []);
const firstjobDetail = `<html><title>Delovno mesto</title><div id="prijava" class="bde-rich-text">
  <p>Priložnost za študente.</p><ul><li>Delo v strežbi</li></ul>
  <p>Kontakt: Ana: 040 123 456, ana@example.com</p></div></html>`;
const firstjobEnriched = parseFirstJobDetail(firstjobDetail, firstjob[0]);
assert.match(firstjobEnriched.description, /Delo v strežbi/);
assert.doesNotMatch(firstjobEnriched.description, /040 123 456|ana@example.com/);
assert.equal((await getFirstJob({ now: '2026-11-27', fetchText: async url =>
  url === firstjobUrl ? firstjobDetail : firstjobList })).length, 1);

const cinkarnaPath = '/novica/elektrikar-2026-11-24';
const cinkarnaUrl = 'https://www.cinkarna.si' + cinkarnaPath;
const cinkarnaList = `<html><a href="/karierna-tocka">Kariera</a>
  <h3><a href="${cinkarnaPath}">ELEKTRIKAR</a></h3>
  <h3><a href="/novica/tehnolog-2026-02-12">TEHNOLOG</a></h3></html>`;
const cinkarna = parseCinkarnaList(cinkarnaList, '2026-11-27');
assert.equal(cinkarna.length, 1);
assert.equal(cinkarna[0].url, cinkarnaUrl);
assert.equal(cinkarna[0].date, '2026-11-24');
assert.equal(cinkarna[0].location, 'Celje');
const cinkarnaDetail = `<h1 class="title">ELEKTRIKAR</h1><div class="newsDetail">
  <p>24. 11. 2026</p><div class="row"><p>Vzdrževanje industrijskih elektro naprav ter diagnostika okvar.</p>
  <ul><li>Pripravljenost na izmensko delo.</li></ul>
  <p>Prijavo pošljete do vključno 8.12.2026 na ana@example.com.</p></div></div>`;
const enriched = parseCinkarnaDetail(cinkarnaDetail, cinkarna[0], '2026-11-27');
assert.match(enriched.description, /diagnostika okvar/);
assert.equal(enriched.deadline, '2026-12-08');
assert.doesNotMatch(enriched.description, /ana@example.com/);
assert.equal(parseCinkarnaDetail(cinkarnaDetail, cinkarna[0], '2026-12-12'), null,
  'Potekli razpisi ne smejo ostati med aktivnimi');
assert.deepEqual((await getCinkarna({ now: '2026-11-27', fetchText: async url =>
  url === cinkarnaUrl ? cinkarnaDetail : cinkarnaList })).map(job => job.id), [cinkarna[0].id]);
console.log('OK: FirstJob in Cinkarna – izvirni razpisi, svežina, rok, opisi in brez kontaktov');

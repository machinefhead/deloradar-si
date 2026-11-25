import assert from 'node:assert/strict';
import { parseManpowerListings, parseManpowerDetails, getManpower } from '../source/manpower.js';

function card(id, title, slug, date = '19/11/2026') {
  return `<div class="card p-lg-8 p-5 justify-content-between mb-5 topjob">
    <div class="card-top"><span class="bg-danger-01">${date}</span>
    <a href="/sl/job-posts/osrednjeslovenska-regija/${slug}"><h3 class="fs-13">${title}</h3></a></div>
    <span class="category-item bg-primary">Informatika</span>
    <div class="job-type d-flex">Delo na lokaciji</div>
    <div class="text-grey-03 fs-19 lh-25 truncate-multiline">Vzdrževanje poslovnih aplikacij. Lokacija dela: <strong>Ljubljana</strong></div>
    <div class="job-content"><div class="job-city d-flex">Osrednjeslovenska regija</div>
    <a href="/sl/job-posts-preview?job_id=${id}&amp;dp=1">Več informacij</a></div></div>`;
}
const first = card('314857', 'Sistemski inženir m/ž', 'sistemski-inzenir');
const second = card('314858', 'Administrator m/ž', 'administrator');
const listed = parseManpowerListings(first + second);
assert.equal(listed.length, 2);
assert.equal(listed[0].id, 'manpower:314857');
assert.equal(listed[0].title, 'Sistemski inženir m/ž');
assert.equal(listed[0].date, '2026-11-19');
assert.equal(listed[0].location, 'Ljubljana');
assert.equal(listed[0].regions[0], 'Osrednjeslovenska');
assert.equal(listed[0].company, 'Manpower Slovenija');
assert.match(listed[0].description, /Vzdrževanje poslovnih aplikacij/);
assert.equal(parseManpowerListings(card('314860', 'Prazno', 'prazno', '32/11/2026')).length, 0,
  'Neveljaven datum oglasa se ne objavi');
assert.equal(parseManpowerListings(first.replace('/sl/job-posts/osrednjeslovenska-regija/sistemski-inzenir',
  'https://other.example/sl/job-posts/job')).length, 0, 'Tujih izvornih URL-jev ne prevzemamo');

const detail = `<main class="job-posts-page"><h1>Sistemski inženir m/ž</h1>
  <h6>Kratek opis</h6><p>Za naročnika iščemo sistemskega inženirja v Ljubljani.</p>
  <h6>Opis</h6><ul><li>Vzdrževanje strežnikov in omrežij.</li><li>Uvajanje novih sistemov.</li></ul>
  <h6>Zahteve</h6><p>Tri leta izkušenj in poznavanje Linuxa.</p>
  <h6>Ponudba</h6><p>Fleksibilen delovni čas. V kolikor ustrezate razpisanim pogojem, za več informacij pokličite 040 123 456.</p>
  <div class="talent-db-cta">Prijava</div></main>`;
const parsed = parseManpowerDetails(detail, listed[0]);
assert.match(parsed.description, /Vzdrževanje strežnikov/);
assert.match(parsed.requirements, /poznavanje Linuxa/);
assert.match(parsed.benefits, /Fleksibilen delovni čas/);
assert.doesNotMatch(JSON.stringify(parsed), /040 123 456/, 'Osebnih kontaktnih številk iz CTA ne shranjujemo');
assert.equal(parseManpowerDetails(detail.replace('Sistemski inženir m/ž', 'Drug naziv'), listed[0]), null,
  'Podrobnosti napačnega oglasa se ne pripojijo');

let requested = [];
const content = {
  'https://www.manpower.si/sl/delovna-mesta?page=0': first + second + '<a href="?page=1" rel="next">Naprej</a>',
  'https://www.manpower.si/sl/delovna-mesta?page=1': '',
  [listed[0].url]: detail,
  [listed[1].url]: detail.replace('Sistemski inženir m/ž', 'Administrator m/ž'),
};
const fetchImpl = async url => {
  requested.push(url);
  if (!(url in content)) throw Error('Nepričakovan URL: ' + url);
  return { ok: true, headers: { get: () => 'text/html; charset=UTF-8' }, text: async () => content[url] };
};
const now = Date.parse('2026-11-25T12:00:00Z');
const live = await getManpower({ fetchImpl, now, maxDetails: 2 });
assert.equal(live.length, 2);
assert.equal(live[0].description.startsWith('• Vzdrževanje'), true);
assert.equal(live[0].detailsFetchedAt, new Date(now).toISOString());
assert.equal(requested.length, 4, 'Dve strani seznama in dva neposredna HTTP opisa');
requested = [];
const cached = await getManpower({ fetchImpl, now: now + 86_400_000, previous: live, maxDetails: 2 });
assert.equal(cached.length, 2);
assert.equal(requested.length, 2, 'Nespremenjenih opisov ne prenašamo znova');
await assert.rejects(getManpower({ fetchImpl, maxPages: 1, maxDetails: 0 }), /straničenje ni končano/,
  'Nepopolnega straničenja ne označimo kot uspešen vir');
console.log('OK: Manpower programatsko straničenje, natančni URL-ji, varni opisi in predpomnilnik');

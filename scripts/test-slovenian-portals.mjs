import assert from 'node:assert/strict';
import {
  parseIzsList, parseIzsDetail, parseHidriaList, parseHidriaDetail,
  parseLthList, parseLthDetail, parseTelkomList, parseTelkomDetail, parsePseList,
} from '../source/slovenian-portals.js';
import { parseIskraemecoList, parseIskraemecoDetail, getIskraemeco } from '../source/iskraemeco.js';

const now = '2026-11-26';
const izs = `<table id="jobsList"><tr><th>Naslov</th></tr>
<tr><td>Elektro projektant</td><td>Podjetje d.o.o.</td><td>30.11.2026</td><td><a data-id="970" class="view">Ogled</a></td></tr>
<tr><td>Stari oglas</td><td>Drugo podjetje</td><td>10.11.2026</td><td><a data-id="99" class="view">Ogled</a></td></tr></table>`;
const izsJobs = parseIzsList(izs, now);
assert.equal(izsJobs.length, 1);
assert.equal(izsJobs[0].id, 'izs:970');
assert.equal(izsJobs[0].deadline, '2026-11-30');
const izsDetails = parseIzsDetail(`<table><tr><td>Kraj:</td><td>Ljubljana</td></tr>
<tr><td>Vrsta zaposlitve:</td><td>redna zaposlitev</td></tr>
<tr><td>Kontaktna oseba:</td><td>Fizična oseba</td></tr></table>
<strong>Opis del in nalog:</strong><p>Načrtovanje projektov, priprava dokumentacije ter prijave na primer@example.com.</p>
<h3 class="table-title">Pravni pouk</h3>`);
assert.equal(izsDetails.location, 'Ljubljana');
assert.equal(izsDetails.employmentType, 'redna zaposlitev');
assert.ok(!JSON.stringify(izsDetails).includes('Fizična oseba'));
assert.ok(!JSON.stringify(izsDetails).includes('primer@example.com'));

const hidria = `<a href="/int/sl/zaposlitev/prosta-delovna-mesta/orodjar-12/" class="single-tender">
<h3>Orodjar</h3><li class="worklocation"><span>Kraj dela:</span> Koper </li>
<li class="enddate"><span>Rok za oddajo do:</span> 31. 12. 2026 </li></a>
<a href="/int/sl/zaposlitev/prosta-delovna-mesta/staro/" class="single-tender"><h3>Staro</h3>
<li class="enddate"><span>Rok do:</span> 01. 10. 2026</li></a>`;
const hidriaJobs = parseHidriaList(hidria, now);
assert.equal(hidriaJobs.length, 1);
assert.equal(hidriaJobs[0].location, 'Koper');
assert.equal(hidriaJobs[0].deadline, '2026-12-31');
assert.equal(parseHidriaDetail(`<li class="startdate"><span>Datum objave:</span> 18. 11. 2026 </li>
<div class="text-content"><p>Delovno mesto za orodjarja, vzdrževanje orodij, popravila in razvoj novih delovnih priprav.</p>
<div class="tendergo">Prijavite se</div>`).date, '2026-11-18');

const lth = `<table class="employments-list"><tr role="row" class="employment-item">
<td><a href="/sl/kariera/prosta-delovna-mesta/urejevalec">UREJEVALEC</a></td><td>Slovenija</td>
<td>Trata</td><td>Proizvodnja</td><td>Redna zaposlitev</td><td>31. 12. 2026</td></tr>
<tr role="row" class="employment-item"><td><a href="/sl/kariera/prosta-delovna-mesta/tujina">Tuji oglas</a></td>
<td>Severna Makedonija</td><td>Skopje</td><td>Proizvodnja</td><td>Redna</td><td>31. 12. 2026</td></tr>
<tr role="row" class="employment-item"><td><a href="/sl/kariera/prosta-delovna-mesta/praksa">UČNA MESTA ZA OBVEZNO PRAKSO</a></td>
<td>Slovenija</td><td>Trata</td><td>Splošna prijava</td><td>Praksa</td><td>31. 12. 2026</td></tr></table>`;
const lthJobs = parseLthList(lth, now);
assert.equal(lthJobs.length, 1);
assert.equal(lthJobs[0].location, 'Trata');
assert.equal(lthJobs[0].employmentType, 'Redna zaposlitev');
assert.ok(parseLthDetail(`<div class="job-intro text-intro">Iščemo odgovornega delavca za proizvodnjo.</div>
<section class="employment-content"><h2 class="h3">Naloge in odgovornosti:</h2>
<div>Proizvodnja, nadzor kakovosti, dokumentacija ter varno delo.</div></section>`).description.includes('Naloge in odgovornosti'));

const telkom = `<article class="bde-loop-item ee-post"><a href="https://www.telkom.si/kariera/proizvodni-delavec-ii/">
<h5 class="bde-heading">Proizvodni delavec II (M/Ž)</h5><b>Objavljeno</b>: 2 novembra, 2026</a></article>`;
const telkomJobs = parseTelkomList(telkom);
assert.equal(telkomJobs.length, 1);
assert.equal(telkomJobs[0].date, '2026-11-02');
assert.ok(parseTelkomDetail(`<div class="bde-text zaposlitevtext"><ul><li>Upravljanje strojev in nadzor izdelkov</li>
<li>Vzdrževanje ter skrb za varno delo</li></ul></div>`).description.includes('Vzdrževanje'));

const pse = `Razpisana delovna mesta<h3 class="elementor-heading-title elementor-size-default">Serviser telekomunikacijske opreme</h3>
<p><strong>Datum objave:</strong> 7. 10. 2026</p><table class="tg-job">
<tr><th>Naloge in odgovornosti</th><td>Servisiranje komunikacijske opreme</td></tr>
<tr><th>Delovni čas</th><td>polni delovni čas</td></tr></table>`;
const pseJobs = parsePseList(pse);
assert.equal(pseJobs.length, 1);
assert.equal(pseJobs[0].date, '2026-10-07');
assert.ok(pseJobs[0].description.includes('Servisiranje'));

const iskraemecoHtml = `<div class="vacancy-card"><div class="vacancy-card__title"><h4>Inženir elektronike (m/ž)</h4></div>
  <div class="vacancy-card__text">Rok prijave 30. 11. 2026</div>
  <a href="https://iskraemeco.com/sl/career-position/inzenir-elektronike/">Preberi več</a></div>
<div class="margin : margin--40"></div>
<div class="vacancy-card"><h4>Potekel razpis</h4><div>Rok prijave 12. 11. 2026</div>
  <a href="https://iskraemeco.com/sl/career-position/poteklo/">Preberi več</a></div>
<div class="margin : margin--40"></div>
<div class="vacancy-card"><h4>Neznan izvirnik</h4><a href="https://neznano.example/sl/career-position/x/">Preberi več</a></div>
<div class="margin : margin--40"></div>`;
const iskraJobs = parseIskraemecoList(iskraemecoHtml, now);
assert.equal(iskraJobs.length, 1, 'Ohranimo samo veljavne uradne povezave in nepretečene razpise');
assert.equal(iskraJobs[0].deadline, '2026-11-30');
assert.equal(iskraJobs[0].url, 'https://iskraemeco.com/sl/career-position/inzenir-elektronike/');
const iskraDetail = `<link rel="canonical" href="https://iskraemeco.com/sl/career-position/inzenir-elektronike/"/>
<meta property="og:title" content="Inženir elektronike (m/ž)"/>
<div class="editor-text"><h5>Lokacija: Kranj, Slovenija</h5></div>
<section class="sc-general : sc-two-col-module : p-0"><h3>Odgovornosti</h3>
<div class="editor-text"><ul><li>Razvoj in preverjanje elektronskih sistemov.</li>
<li>Odgovornost za testne postopke.</li></ul></div></section>`;
const enrichedIskra = parseIskraemecoDetail(iskraDetail, iskraJobs[0]);
assert.equal(enrichedIskra.location, 'Kranj');
assert.match(enrichedIskra.description, /Razvoj in preverjanje/);
assert.deepEqual(await getIskraemeco({ now, fetchText: async url => url.endsWith('/odprta-delovna-mesta/') ? iskraemecoHtml : iskraDetail }), [enrichedIskra]);
assert.throws(() => parseIskraemecoDetail(iskraDetail, { ...iskraJobs[0], title: 'Drug oglas' }), /ne ustrezajo/);
assert.throws(() => parseIskraemecoList('<p>Stran se je spremenila</p>'), /ni prepoznan/);

console.log('Slovenski portali: IZS, Hidria, LTH, Telkom, PSE in Iskraemeco uspešni.');

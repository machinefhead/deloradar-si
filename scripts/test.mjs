import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { page } from '../source/page.js';

assert.match(page, /<html lang="sl">/);
assert.match(page, /href="\.\/"/);
assert.match(page, /\.\/jobs\.json/);
assert.match(page, /function configureMulti\(/);
assert.match(page, /function persistFilters\(/);

const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Predloga mora vsebovati odjemalsko skripto');
new Script(script, { filename: 'deloradar-client.js' });
assert.match(page, /\.multi-option\[hidden\]\{display:none!important\}/, 'Iskanje po večizbirnih možnostih mora dejansko skriti vrstice');
assert.match(page, /<input class="field" type="search" id="search"/, 'Glavno iskalno polje mora imeti vgrajen gumb X');
assert.match(script, /if\(clear\)\{multiSelected\[id\]=\[\];closeMulti\(host\);/, 'Počisti izbor mora zapreti večizbirni seznam');
assert.match(page, /grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/, 'Navigacija mora biti poravnana na sredino');
assert.match(page, /\.bottom\{margin-top:14px\}/, 'Razmik pod navigacijo naj bo primerljiv razmiku nad njo');
assert.match(page, /id="backToTop"/, 'Plavajoči gumb za vrnitev na vrh mora biti v dokumentu');
assert.match(script, /window\.addEventListener\('scroll',updateBackToTop,\{passive:true\}\)/, 'Gumb za vrh se mora prilagajati drsenju');
assert.match(page, /manualLink\.textContent='↻ Osveži'/, 'Osveži mora biti povezava na ročni zajem v GitHub Actions');
assert.match(page, /\$\('refresh'\)\.replaceWith\(manualLink\)/, 'Podvojeni gumb za branje istega posnetka ne sme ostati na javni strani');
assert.match(page, /class="refreshinfo" id="updated">Zadnji zajem oglasov: —/, 'Datum mora biti pod gumbom za osvežitev');
assert.match(page, /class="srcfooter">Oglasi se posodabljajo približno vsakih 30 minut\./, 'Stanje povezav mora imeti samo kratko pojasnilo pogostosti zajema');
assert.match(page, /\.srcfooter'\)\.textContent='Oglasi se posodabljajo približno vsakih 30 minut\./, 'Javna stran ne sme prepisati kratkega pojasnila');
for (const source of ['ZRSZ ↗','MojeDelo ↗','Careerjet ↗','Zaposlitev.info ↗']) {
  assert.ok(page.includes(source), `Med hitro dostopnimi iskalniki manjka ${source}`);
}
assert.doesNotMatch(page, /Ob odprtju preberemo zadnji objavljeni posnetek/, 'Podvojeno pojasnilo pod tabelo je odvečno');
const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
assert.match(workflow, /cron: '17,47 \* \* \* \*'/, 'Osveževanje mora biti predvideno vsakih 30 minut');

const extract = (start, end) => {
  const a = script.indexOf(start), b = script.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Manjka odsek ${start}`);
  return script.slice(a, b);
};
const selected = { region: ['Podravska'] };
const controls = { search: '', published: '', deadline: '', myStatus: '' };
const context = {
  jobs: [
    { id: '1', title: 'Električar', company: 'A', location: 'Maribor', region: 'Podravska', sector: 'Elektrotehnika', source: 'Optius' },
    { id: '2', title: 'Programer', company: 'B', location: 'Ptuj', region: 'Podravska', sector: 'IT', source: 'Kariera.si' },
    { id: '3', title: 'Programer', company: 'A', location: 'Ljubljana', region: 'Osrednjeslovenska', sector: 'IT', source: 'Optius' },
    { id: '4', title: 'Programer', company: 'A', location: 'Maribor', region: 'Podravska', regions: ['Podravska', 'Savinjska'], sector: 'IT', source: 'GOV.SI' }
  ],
  multiIds: ['sourceFilter', 'region', 'city', 'sector', 'company'],
  selectedValues: id => selected[id] || [],
  regionOf: job => job.region,
  sectorOf: job => job.sector,
  $: id => ({ value: controls[id] || '', checked: false }),
  dateValue: () => NaN,
  getState: () => ({})
};
runInNewContext(
  extract('function normalizeTerm(', 'function configureMulti(') + '\n' +
  extract('function matchesJob(', 'function filtered('), context
);
assert.equal(context.normalizeTerm('Škofja Loka'), 'skofja loka', 'Besedno iskanje mora delovati tudi brez šumnikov');
assert.deepEqual(JSON.parse(JSON.stringify(Array.from(context.facetCounts('city').entries()))), [['Maribor', 2], ['Ptuj', 1]], 'Regija mora zožiti kraje in prikazati število zadetkov');
selected.sector = ['IT'];
assert.deepEqual(JSON.parse(JSON.stringify(Array.from(context.facetCounts('city').entries()))), [['Ptuj', 1], ['Maribor', 1]], 'Vse druge izbire morajo vplivati na možnosti krajev');
selected.city = ['Maribor'];
assert.equal(context.jobs.filter(job => context.matchesJob(job)).length, 1, 'Filtri morajo delovati skupaj');
assert.equal(context.facetCounts('region').get('Podravska'), 1, 'Število pri regiji upošteva ostale filtre');
assert.equal(context.facetCounts('region').get('Savinjska'), 1, 'Oglas lahko pripada več regijam, ne sme se podvajati v tabeli');
assert.match(page, /Oglasov na stran/);
assert.doesNotMatch(page, /id="loadMore"/, 'Starega gumba za 500 zadetkov ne potrebujemo več');
assert.doesNotMatch(page, /<label for="contract">/, 'Neaktiven filter ne sme zasedati prostora');
const navContext = { pager: { innerHTML: '' }, pageSize: 50, currentPage: 2 };
runInNewContext(extract('function pageButton(', 'function render('), navContext);
navContext.pageNavigation(12);
assert.match(navContext.pager.innerHTML, /data-page="1"/);
assert.match(navContext.pager.innerHTML, /data-page="12"/);
assert.match(navContext.pager.innerHTML, /data-page="2" aria-current="page"/);
assert.match(navContext.pager.innerHTML, /aria-label="Prejšnja stran">‹<\/button>/);
assert.match(navContext.pager.innerHTML, /aria-label="Naslednja stran">›<\/button>/);
assert.doesNotMatch(navContext.pager.innerHTML, /Prva stran|Zadnja stran|«|»/, 'Odstranimo skoka na prvo in zadnjo stran');
assert.match(navContext.pager.innerHTML, /Oglasov na stran/);
navContext.currentPage=1;navContext.pageNavigation(12);
assert.match(navContext.pager.innerHTML, /data-page="0" disabled aria-label="Prejšnja stran"/, 'Prejšnja stran mora biti onemogočena na začetku');
navContext.currentPage=12;navContext.pageNavigation(12);
assert.match(navContext.pager.innerHTML, /data-page="13" disabled aria-label="Naslednja stran"/, 'Naslednja stran mora biti onemogočena na koncu');
assert.match(navContext.pager.innerHTML, /<option value="10"/);
assert.match(navContext.pager.innerHTML, /<option value="25"/);
assert.match(navContext.pager.innerHTML, /<option value="50"/);
assert.match(navContext.pager.innerHTML, /<option value="100"/);
const multiContext = {};
runInNewContext(extract('function clearMultiSearch(', 'function configureMulti('), multiContext);
const mockSearch={value:'ptu'},mockRows=[{hidden:true},{hidden:false}];
multiContext.clearMultiSearch({querySelector:()=>mockSearch,querySelectorAll:()=>mockRows});
assert.equal(mockSearch.value,'', 'Iskanje v filtru se mora počistiti');
assert.ok(mockRows.every(row=>row.hidden===false), 'Po izbrisu iskalnega niza se morajo vrniti vse možnosti');

const { parseGovListings, parseAtamaListings, parseOptiusFeed, parseTrenkwalderListings, parseAgadoListings, parseAdeccoSitemap, parseAdeccoJobPreview, parseRekruterFeed, parseNoveSitemap, parseNoveJob, parseLidlSitemap, parseLidlJob, parseKolektorListings, parseMojeDeloConfig, parseMojeDeloJobs, parseZaposlitevInfoListings, zaposlitevInfoTotalPages } = await import('../source/collector.js');
const row = (status, slug) => `<tr>
  <td class="td-title"><a href="/zbirke/delovna-mesta/${slug}/">Referent javnega sektorja</a></td>
  <td>20. 11. 2026</td><td>4. 12. 2026</td><td>Občina Test</td>
  <td>Javni natečaj</td><td>Nedoločen čas</td><td>Polni delovni čas</td><td><i class="label">${status}</i></td>
</tr>`;
const gov = parseGovListings(`<table><tbody>${row('V teku', 'test-1')}</tbody>${row('Zaključeno', 'test-2')}</tbody></table>`);
assert.equal(gov.length, 1, 'Zaključeni javni razpisi ne sodijo v rezultate');
assert.equal(gov[0].source, 'GOV.SI');
assert.equal(gov[0].date, '2026-11-20');
assert.equal(gov[0].deadline, '2026-12-04');
assert.equal(gov[0].url, 'https://www.gov.si/zbirke/delovna-mesta/test-1/');

const atama = parseAtamaListings('<div class="pos_novica_ps_spisek"><h3>Električar (m/ž) Maribor</h3><div class="povzetev_nov_ps_spisek">Opis dela</div><div class="vec_nov_ps_spisek"><a href="S2210/D28068/Elektricar">Več o tem</a></div><div class="clear"></div></div>');
assert.equal(atama.length, 1);
assert.equal(atama[0].title, 'Električar (m/ž) Maribor');
assert.equal(atama[0].url, 'https://atama.si/S2210/D28068/Elektricar');
const optius = parseOptiusFeed('<rss><item><title>Elektrotehnik</title><link>https://www.optius.com/iskalci/prosta-delovna-mesta/test/</link><employer>Podjetje</employer><pubDate>Fri, 20 Nov 2026 15:17:00 +0100</pubDate></item></rss>');
assert.equal(optius.length, 1);
assert.equal(optius[0].company, 'Podjetje');
const trenkwalder = parseTrenkwalderListings('<span class="micro_highlight text-gray-40 mr-auto">2026.11.20</span><h3 class="subtitle_highlight" title="Operater"><a href="https://si.trenkwalder.com/jobs/a0tbI00000UwAyfQAF">Operater</a></h3><p class="micro_highlight truncate leading-5">Maribor</p><span class="micro_highlight text-gray-40 mr-auto">2026.11.19</span><h3 class="subtitle_highlight" title="Delo v Nemčiji"><a href="https://si.trenkwalder.com/jobs/a0taV000013fvXzQAI">Delo v Nemčiji</a></h3><p class="micro_highlight truncate leading-5">Kassel</p>');
assert.equal(trenkwalder.length, 1, 'Tuji oglasi se ne vključijo');
assert.equal(trenkwalder[0].location,'Maribor');
assert.equal(trenkwalder[0].date,'2026-11-20');

const agadoCard = (id, title, location, date) => `<div class="single_job_student" style="box-sizing:border-box;"><a target="_blank" href="https://www.agado.si/iskalci/69/vsa-prosta-delovna-mesta/j${id}/oglas-${id}"></a><div class="job_date">${date}<hr>${id}</div><div class="job_title"><h5>${title}</h5></div><div class="job_details"><div class="half_width"><mark>Vrsta dela</mark><br></br><span>ELEKTROTEHNIKA</span></div><div class="half_width"><mark>Lokacija:</mark><br></br><span>${location}</span></div></div></div>`;
const agado = parseAgadoListings([
  agadoCard('123', 'Elektrotehnik (m/ž)', 'Maribor<br>(Podravska)', '17.11.26'),
  agadoCard('124', 'Električar - Avstrija', 'Graz<br>(Steiermark)', '16.11.26'),
  agadoCard('125', 'Vpis v bazo iskalcev dela', 'Cela Slovenija', '30.07.25'),
  agadoCard('126', 'Skladiščnik', 'Ljubljana<br>(Osrednjeslovenska regija)', '11.11.26'),
].join(''));
assert.equal(agado.length, 2, 'Agado: brez tujih zaposlitev in splošnih vpisov v bazo');
assert.equal(agado[0].id, 'agado:123');
assert.equal(agado[0].location, 'Maribor');
assert.equal(agado[0].date, '2026-11-17');
assert.equal(agado[0].url, 'https://www.agado.si/iskalci/69/vsa-prosta-delovna-mesta/j123/oglas-123');

const adeccoUrl='https://www.adecco.com/sl-si/prosta-delovna-mesta/elektrikar-m-maribor/jn-112026-1190001';
const adeccoSitemap=parseAdeccoSitemap(`<?xml version="1.0"?><urlset><url><loc>${adeccoUrl}</loc></url><url><loc>https://www.adecco.com/en-si/job-search/test/jn-112026-1190002</loc></url></urlset>`);
assert.equal(adeccoSitemap.length,1,'Zajemamo samo slovensko različico Adecco');
const adeccoData={ '@type':'JobPosting', title:'Električar (m/ž)', datePosted:'2026-11-20T10:00:00Z', validThrough:'2026-12-20T23:59:59Z', jobLocation:{address:{addressLocality:'Maribor',addressCountry:'SI'}} };
const adeccoHtml=`<html><script type="application/ld+json">${JSON.stringify(adeccoData)}</script></html>`;
const adecco=parseAdeccoJobPreview(adeccoHtml,adeccoSitemap[0],Date.parse('2026-11-22'));
assert.equal(adecco.title,'Električar (m/ž)');
assert.equal(adecco.location,'Maribor');
assert.equal(adecco.id,'adecco:jn-112026-1190001');
assert.equal(adecco.source,'Adecco');
assert.equal(parseAdeccoJobPreview(adeccoHtml,adeccoSitemap[0],Date.parse('2027-01-01')),null,'Poteklih oglasov ne vključujemo');

const rekruterFeed=`<rss><channel><item><title>Elektrotehnik (m/ž)</title><link>https://zaposlitev.rekruter.si/jobs/8775101-elektrotehnik</link><pubDate>Fri, 20 Nov 2026 13:34:44 +0100</pubDate><tt:locations><tt:location><tt:name>Podravska</tt:name><tt:city>Maribor</tt:city><tt:country>Slovenia</tt:country></tt:location></tt:locations></item><item><title>Delo na Hrvaškem</title><link>https://zaposlitev.rekruter.si/jobs/1234567-tujina</link><tt:locations><tt:location><tt:city>Zagreb</tt:city><tt:country>Croatia</tt:country></tt:location></tt:locations></item></channel></rss>`;
const rekruter=parseRekruterFeed(rekruterFeed);
assert.equal(rekruter.length,1,'Rekruter: brez izključno tujih zaposlitev');
assert.equal(rekruter[0].location,'Maribor');
assert.equal(rekruter[0].id,'rekruter:8775101');
assert.equal(rekruter[0].date,'2026-11-20T12:34:44.000Z');
const noveUrl='https://novezaposlitve.si/razisci/delovna-mesta/elektricarji-in-monterji-m-z/';
const noveList=parseNoveSitemap(`<urlset><url><loc>${noveUrl}</loc></url><url><loc>https://novezaposlitve.si/razisci/iscem-zaposlitev/kandidat/</loc></url></urlset>`);
assert.equal(noveList.length,1,'Nove zaposlitve: ne vključimo oglasov iskalcev zaposlitve');
const noveHtml='<h1 class="case27-primary-text">Električarji in monterji (m/ž)</h1><div class="lmb-label">Prijave do: </div><div class="value">23 decembra, 2026</div><li><div class="item-attr">Podjetje</div><div class="item-property">DMB d.o.o.</div></li><li><div class="item-attr">Datum objave</div><div class="item-property">29 oktobra, 2026</div></li>';
const nove=parseNoveJob(noveHtml,noveList[0],Date.parse('2026-11-22'));
assert.equal(nove.company,'DMB d.o.o.');
assert.equal(nove.date,'2026-10-29');
assert.equal(nove.deadline,'2026-12-23');
assert.equal(parseNoveJob(noveHtml,noveList[0],Date.parse('2027-01-01')),null,'Poteklih oglasov Nove zaposlitve ne vključimo');

const lidlUrl='https://kariera.lidl.si/jobs/pomocnik-vodje-poslovne-enote-m-z-maribor-borova-vas-maribor-770466';
const lidlLinks=parseLidlSitemap(`<urlset><url><loc>${lidlUrl}</loc></url><url><loc>${lidlUrl}</loc></url><url><loc>https://kariera.lidl.si/ostalo/123</loc></url></urlset>`);
assert.equal(lidlLinks.length,1,'Lidl: iz uradnega seznama zajemamo samo povezave /jobs/ in odstranimo dvojnike');
assert.equal(lidlLinks[0].id,'lidl:770466');
const lidlData={ '@context':'https://schema.org', '@type':'JobPosting', title:'Pomočnik vodje poslovne enote (m/ž) Maribor',
  datePosted:'2026-11-15T23:00:00+00:00', validThrough:'2026-11-26T22:59:59+00:00',
  hiringOrganization:{name:'Prodaja'},jobLocation:{address:{addressLocality:'Maribor',addressCountry:'SI'}} };
const lidlHtml=`<script type="application/ld+json">${JSON.stringify(lidlData)}</script>`;
const lidl=parseLidlJob(lidlHtml,lidlLinks[0],Date.parse('2026-11-22'));
assert.equal(lidl.title,'Pomočnik vodje poslovne enote (m/ž) Maribor');
assert.equal(lidl.company,'Lidl Slovenija','Oddelek »Prodaja« ni ime delodajalca');
assert.equal(lidl.location,'Maribor');
assert.equal(lidl.date,'2026-11-15T23:00:00.000Z');
assert.equal(lidl.deadline,'2026-11-26T22:59:59.000Z');
assert.equal(parseLidlJob(lidlHtml,lidlLinks[0],Date.parse('2026-12-01')),null,'Lidl: izločimo potekle oglase');
assert.equal(parseLidlJob(lidlHtml.replace('"addressCountry":"SI"','"addressCountry":"AT"'),lidlLinks[0],Date.parse('2026-11-22')),null,'Lidl: izločimo oglase izven Slovenije');
assert.equal(parseLidlJob('<script type="application/ld+json">invalid</script>',lidlLinks[0]),null,'Lidl: neveljavni JSON-LD ne sme ustaviti zajema');

const kolektorHtml='<table class="list" style="display:none"><tbody><tr class="item cat-1571"><td>Energetski transformatorji</td><td><a href="/sl/o-nas/kadri-in-izobrazevanje/elektromehanik-2024-01-11"><strong>Elektromehanik</strong></a></td><td>Ljubljana - Črnuče</td><td>30.11.2026</td></tr><tr class="item cat-1571"><td>Mobilnost</td><td><a href="/sl/o-nas/kadri-in-izobrazevanje/radnik-bih"><strong>Proizvodni delavec</strong></a></td><td>Klašnice (BIH)</td><td>30.11.2026</td></tr><tr class="item cat-1571"><td>Tehnologija</td><td><a href="/sl/o-nas/kadri-in-izobrazevanje/stari"><strong>Star oglas</strong></a></td><td>Idrija</td><td>01.10.2026</td></tr></tbody></table>';
const kolektor=parseKolektorListings(kolektorHtml,Date.parse('2026-11-22'));
assert.equal(kolektor.length,1,'Kolektor: vključimo le aktualne zaposlitve v Sloveniji');
assert.equal(kolektor[0].title,'Elektromehanik');
assert.equal(kolektor[0].location,'Ljubljana - Črnuče');
assert.equal(kolektor[0].deadline,'2026-11-30');
assert.equal(kolektor[0].url,'https://www.kolektor.com/sl/o-nas/kadri-in-izobrazevanje/elektromehanik-2024-01-11');

const mdConfig=parseMojeDeloConfig('window.globalsConfig = {"appConfig":{"tenantId":"tenant-public","jbChannelId":"channel-public","defaultLanguageId":"language-public"}};');
assert.deepEqual(mdConfig,{tenantId:'tenant-public',channelId:'channel-public',languageId:'language-public'});
const mdSample={data:{total:2,items:[
  {id:'abc-123',title:'Elektrotehnik',company:{name:'Primer d.o.o.'},country:{countryCode:'SI'},town:{name:'Maribor'},regions:[{translation:'Podravska'}],startDate:'2026-11-20T07:00:00Z'},
  {id:'foreign-1',title:'Elektromonter v Avstriji',country:{countryCode:'AT'},town:{name:'Graz'}},
]}};
const mdJobs=parseMojeDeloJobs(mdSample);
assert.equal(mdJobs.length,1,'MojeDelo: brez tujih oglasov');
assert.equal(mdJobs[0].company,'Primer d.o.o.');
assert.equal(mdJobs[0].location,'Maribor');
assert.deepEqual(mdJobs[0].regions,['Podravska']);
assert.equal(mdJobs[0].date,'2026-11-20T07:00:00.000Z');
assert.equal(mdJobs[0].url,'https://www.mojedelo.com/iskanje-zaposlitve?jobAdIds=abc-123');
assert.throws(()=>parseMojeDeloJobs({data:{items:[]}}),'Neveljavna struktura API-ja ne sme dati lažnega uspeha');

const ziCard=(path,title,company,location,stamp)=>`<a rel="nofollow" class="job-link custom-wpjb-card" href="https://zaposlitev.info/delo/${path}/"><div class="wpjb-grid-row"><div class="wpjb-grid-col wpjb-col-title"><span class="wpjb-line-major">${title}</span><span class="wpjb-sub wpjb-sub-small">${company}</span></div><div class="wpjb-grid-col wpjb-col-location"><span class="tag location">${location}</span><span class="tag date">${stamp}</span></div></div></a>`;
const ziHtml=`<div class="wpjb-job-list wpjb-grid">${ziCard('elektricar-m-z','Električar (m/ž)','Elektro, d. o. o.','Maribor','Nov, 20')}${ziCard('serviser-v-grazu','Serviser','Agencija','Graz, Avstrija','Nov, 19')}</div><div class="wpjb-paginate-links"><a href="https://zaposlitev.info/prosta-delovna-mesta/page/2/">2</a><a href="https://zaposlitev.info/prosta-delovna-mesta/page/38/">38</a></div>`;
const ziJobs=parseZaposlitevInfoListings(ziHtml,Date.parse('2026-11-22'));
assert.equal(ziJobs.length,1,'Zaposlitev.info: brez tujih oglasov');
assert.equal(ziJobs[0].title,'Električar (m/ž)');
assert.equal(ziJobs[0].company,'Elektro, d. o. o.');
assert.equal(ziJobs[0].date,'2026-11-20');
assert.equal(ziJobs[0].url,'https://zaposlitev.info/delo/elektricar-m-z/');
assert.equal(zaposlitevInfoTotalPages(ziHtml),38,'Zajem vseh strani, ne samo prvih deset oglasov');

console.log('OK: filtri, straničenje in parserji vseh trinajstih virov');

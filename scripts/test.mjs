import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { page } from '../source/page.js';
import { markLikelyDuplicates } from '../source/duplicates.js';

const sameVacancy=(id,source,date,extra={})=>({ id,source,date,title:'Elektrotehnik (m/ž)',company:'Primer d.o.o.',location:'Maribor',deadline:'2026-12-15',url:'https://primer.si/delo/'+id,...extra });
const duplicateFixture=[
  sameVacancy('mojedelo:1','MojeDelo.com','2026-11-20T23:00:00Z'),
  sameVacancy('zaposlitevinfo:1','Zaposlitev.info','2026-11-21'),
  sameVacancy('mojedelo:2','MojeDelo.com','2026-11-20',{location:'Ljubljana'}),
  sameVacancy('zaposlitevinfo:2','Zaposlitev.info','2026-11-21',{location:'Ptuj'}),
  sameVacancy('mojedelo:3','MojeDelo.com','2026-11-01',{title:'Programer'}),
  sameVacancy('zaposlitevinfo:3','Zaposlitev.info','2026-11-21',{title:'Programer'}),
  sameVacancy('mojedelo:4','MojeDelo.com','2026-11-20',{title:'Skladiščnik',deadline:'2026-12-01'}),
  sameVacancy('zaposlitevinfo:4','Zaposlitev.info','2026-11-21',{title:'Skladiščnik',deadline:'2026-12-31'}),
  sameVacancy('mojedelo:5','MojeDelo.com','2026-11-20',{title:'Varilec',location:''}),
  sameVacancy('zaposlitevinfo:5','Zaposlitev.info','2026-11-21',{title:'Varilec',location:''}),
];
const marked=markLikelyDuplicates(duplicateFixture);
assert.equal(marked[0].duplicateGroup,marked[1].duplicateGroup,'Enak naslov, podjetje, kraj in bližnja datuma lahko pomenijo isti razpis');
assert.equal(marked[0].id,'mojedelo:1','Ohranimo izvorni ID in povezavo vsake objave');
assert.equal(duplicateFixture[0].duplicateGroup,undefined,'Označevanje ne sme spreminjati vhodnih oglasov');
assert.ok(marked.slice(2).every(job=>!job.duplicateGroup),'Različni kraji, predaleč oddaljeni datumi, roki ali neznani kraji se ne združijo');
assert.equal(markLikelyDuplicates(marked.concat(sameVacancy('third','Optius','2026-11-21'))).filter(j=>j.duplicateGroup).length,0,'Trije podobni razpisi se ne združujejo samodejno');
assert.equal(markLikelyDuplicates(marked).filter(j=>j.duplicateGroup).length,2,'Večkratni zajem mora ohraniti enake oznake dvojnikov');
assert.equal(markLikelyDuplicates([
  sameVacancy('zrsz:1','ZRSZ / PoiščiDelo','2026-11-20',{reference:'ABC123'}),
  sameVacancy('mojedelo:6','MojeDelo.com','2026-11-21')
]).filter(j=>j.duplicateGroup).length,0,'ZRSZ brez neposrednega URL-ja oglasa ostane samostojen');

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
assert.match(page, /id="groupDuplicates" checked/, 'Uporabnik lahko preklopi združevanje, privzeto je vključeno');
assert.match(script, /values\.groupDuplicates=\$\('groupDuplicates'\)\.checked/, 'Izbrani način prikaza se mora shraniti v brskalniku');
assert.match(page, /Objavljeno tudi na:/, 'Združeni oglas mora ohraniti povezavo do drugega vira');
assert.match(page, /Druge izvorne povezave/, 'CSV mora vključevati tudi alternativne povezave');
assert.match(script, /window\.addEventListener\('scroll',updateBackToTop,\{passive:true\}\)/, 'Gumb za vrh se mora prilagajati drsenju');
assert.match(page, /manualLink\.textContent='↻ Osveži'/, 'Osveži mora biti povezava na ročni zajem v GitHub Actions');
assert.match(page, /\$\('refresh'\)\.replaceWith\(manualLink\)/, 'Podvojeni gumb za branje istega posnetka ne sme ostati na javni strani');
assert.match(page, /class="refreshinfo" id="updated">Zadnji zajem oglasov: —/, 'Datum mora biti pod gumbom za osvežitev');
assert.match(page, /class="srcfooter">Oglasi se posodabljajo približno vsakih 12 ur\./, 'Stanje povezav mora kazati dvanajsturni urnik');
assert.match(page, /\.srcfooter'\)\.textContent='Oglasi se posodabljajo približno vsakih 12 ur\./, 'Javna stran ne sme prepisati novega urnika');
assert.match(page, /id="sourceSummary"/, 'Povzetek dosegljivosti virov mora biti viden brez odpiranja seznama');
assert.match(page, /<div class="sourceslist" id="sourceStatus">/, 'Statusi vseh posameznih virov morajo biti vedno vidni');
assert.doesNotMatch(page, /<details class="sourcedetails"|id="sourceDetails"/, 'Seznam stanja povezav ne potrebuje razširljivega menija');
assert.match(page, /\.sidebar>\.panel:nth-of-type\(2\)\{display:block\}/, 'Stanje povezav mora ostati vidno tudi na telefonu');
assert.match(page, /\.sourcecatalog\{display:block\}/, 'Careerjet in EURES morata biti prikazana na dnu brez klika');
assert.match(page, /id="planned"><div class="sourcecard"><a href="https:\/\/www\.careerjet\.si\//, 'Careerjet mora ostati dosegljiv tudi, če zajem podatkov ne uspe');
assert.match(page, /locationCodes=si&amp;previousPageType=findJob&amp;lang=sl/, 'EURES mora imeti stalno povezavo na iskanje po Sloveniji');
assert.doesNotMatch(page, /id="showCatalog"|id="topSources"|function showSources\(/, 'Odvečna gumba za prikaz istih povezav morata biti odstranjena');
assert.doesNotMatch(page, /sourcesToggle|sidebar\.sources-open/, 'Tudi mobilni seznam virov ostaja odprt');
assert.match(script, /planned\.filter\(function\(s\)\{return s\.name==='Careerjet'\|\|s\.name==='EURES \(Slovenija\)'\}\)/, 'Na dnu sta samo dva nepovezana iskalnika');
assert.match(script, /sources\.slice\(\)\.sort\(function\(a,b\)\{return b\.count-a\.count/, 'Seznam virov naj bo razvrščen po količini oglasov');
assert.doesNotMatch(page, /Več oglasov na velikih portalih/, 'Povezana portala se ne smeta prikazovati kot nepovezana');
assert.doesNotMatch(page, /class="quicklinks"/, 'Podvojene hitre povezave niso več potrebne');
assert.match(page, /ZRSZ oznaka: '\+safe\(j\.reference\)/, 'ZRSZ referenca mora biti vidna, ker JSON nima neposrednih URL-jev posameznih oglasov');
assert.match(page, /Iskanje po delodajalcu/, 'Pri ZRSZ mora biti jasno, da povezava odpre iskanje, ne posameznega oglasa');
assert.match(page, /<h2>Še nepovezani viri<\/h2>/, 'Seznam naj jasno razlikuje nepovezane vire od že zajetih');
const collectorSource=readFileSync(new URL('../source/collector.js',import.meta.url),'utf8');
const plannedBlock=collectorSource.match(/const PLANNED = \[([\s\S]*?)\n\];/)?.[1]||'';
assert.ok(plannedBlock.includes('ZRSZ / PoiščiDelo')&&plannedBlock.includes('Careerjet'),'Dostop do dveh glavnih nepovezanih iskalnikov mora ostati');
assert.ok(!plannedBlock.includes("name: 'MojeDelo.com'")&&!plannedBlock.includes("name: 'Zaposlitev.info'"),'Že povezanih portalov ne podvajamo med dodatnimi viri');
assert.match(plannedBlock,/EURES \(Slovenija\).*locationCodes=si/,'EURES mora odpreti iskanje, omejeno na Slovenijo');
assert.equal((plannedBlock.match(/\{ name:/g)||[]).length,3,'V produkciji morata med nepovezanimi ostati le Careerjet in EURES (lokalno tudi ZRSZ brez aktivacije)');
for(const name of ['SPAR Slovenija','Slovenske železnice','Prohuman']) {
  assert.ok(!plannedBlock.includes("name: '"+name+"'"),'Že zajeti ali blokirani delodajalci ne sodijo med čakajoča iskalnika: '+name);
}
assert.doesNotMatch(page, /Ob odprtju preberemo zadnji objavljeni posnetek/, 'Podvojeno pojasnilo pod tabelo je odvečno');
const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
assert.match(workflow, /cron: '17 5,17 \* \* \*'/, 'Samodejno osveževanje mora teči dvakrat dnevno (na 12 ur)');

const extract = (start, end) => {
  const a = script.indexOf(start), b = script.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Manjka odsek ${start}`);
  return script.slice(a, b);
};
const linkContext = {};
runInNewContext(extract('function slugForJob(', 'function load('), linkContext);
const oldMojeDelo = {
  source: 'MojeDelo.com', title: 'Operater na stroju (m/ž), Tržič',
  url: 'https://www.mojedelo.com/iskanje-zaposlitve?jobAdIds=5cb3187e-ae51-4db9-81a7-c30c131a6e40'
};
assert.equal(linkContext.resolvedLink(oldMojeDelo), 'https://www.mojedelo.com/oglas/operater-na-stroju-mz-trzic/5cb3187e-ae51-4db9-81a7-c30c131a6e40', 'Tudi že objavljeni posnetek mora takoj odpirati posamezni oglas MojeDelo');
assert.equal(linkContext.resolvedLink({source: 'ZRSZ / PoiščiDelo', reference: 'NY31603', company: 'Klinika Golnik', url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/'}),
  'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/#/?drzava=SI,&iskalniTekst=Klinika%20Golnik&iskalnaLokacija=', 'Stari posnetek ZRSZ mora voditi vsaj na predizpolnjeno iskanje');
assert.equal(linkContext.resolvedLink({source:'Optius',url:'https://www.optius.com/prijava/'}), 'https://www.optius.com/prijava/', 'Povezav drugih portalov ne spreminjamo');
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
  groupEnabled: () => false,
  groupById: new Map(),
  mergedState: () => ({}),
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
const pairId='dupe:mojedelo:1';
const firstAd={...marked[0],duplicateGroup:pairId,url:'https://www.mojedelo.com/iskanje-zaposlitve?jobAdIds=abc'};
const secondAd={...marked[1],duplicateGroup:pairId,url:'https://zaposlitev.info/delo/abc'};
const pair=[firstAd,secondAd];
const dupeContext={
  groupEnabled:()=>true,
  groupById:new Map([[firstAd.id,pair],[secondAd.id,pair]]),
  filtered:()=>pair,
  state:{[firstAd.id]:{saved:true},[secondAd.id]:{status:'contacted'}},
  getState(id){return this.state[id]||{}}
};
dupeContext.getState=id=>dupeContext.state[id]||{};
runInNewContext(extract('function displayed(', 'var pager='),dupeContext);
assert.equal(dupeContext.displayed().length,1,'Zanesljiv par je privzeto ena vrstica');
assert.equal(dupeContext.displayed()[0].source,'Zaposlitev.info','Neposredna povezava do oglasa ima prednost pred iskalno');
assert.equal(dupeContext.displayed()[0].alternatives[0].url,firstAd.url,'Drugi vir ostane dostopen pod naslovom');
dupeContext.filtered=()=>[firstAd];
assert.equal(dupeContext.displayed()[0].alternatives[0].url,secondAd.url,'Vir je dostopen tudi kadar filter skrije drugo objavo');
dupeContext.groupEnabled=()=>false;
dupeContext.filtered=()=>pair;
assert.equal(dupeContext.displayed().length,2,'Izklop združevanja vrne oba izvorna oglasa');
runInNewContext(extract('function memberIds(', 'function save('),dupeContext);
dupeContext.groupEnabled=()=>true;
assert.equal(dupeContext.mergedState(firstAd).saved,true,'Zaznamek s kateregakoli vira se prenese v združeno vrstico');
assert.equal(dupeContext.mergedState(firstAd).status,'contacted','Predhodni status na drugem viru se ohrani');
runInNewContext(extract('function changeMemberStates(', "$('jobRows').addEventListener('click'"),dupeContext);
dupeContext.changeMemberStates(firstAd.id,'status','interested');
assert.equal(dupeContext.state[secondAd.id].status,'interested','Sprememba statusa v združeni vrstici velja za obe izvorni objavi');
dupeContext.groupEnabled=()=>false;
dupeContext.changeMemberStates(firstAd.id,'saved',false);
assert.equal(dupeContext.state[firstAd.id].saved,false,'Pri ločenem prikazu se spreminja samo izbrani oglas');
assert.equal(dupeContext.state[secondAd.id].status,'interested','Ločeni prikaz ne spremeni statusov druge objave');
const facetDupeContext={...context,jobs:pair,groupEnabled:()=>true,groupById:dupeContext.groupById,selectedValues:()=>[],mergedState:()=>({}),$:()=>({value:'',checked:false})};
runInNewContext(extract('function normalizeTerm(', 'function configureMulti(')+'\n'+extract('function matchesJob(', 'function filtered('),facetDupeContext);
assert.equal(facetDupeContext.facetCounts('city').get('Maribor'),1,'Števci krajev ne smejo dvakrat šteti združenega oglasa');
assert.equal(facetDupeContext.facetCounts('sourceFilter').get('MojeDelo.com'),1,'Oba vira še vedno nastopata med izbirami portalov');
assert.equal(facetDupeContext.facetCounts('sourceFilter').get('Zaposlitev.info'),1,'Izvorni portal ne izgine iz filtra');
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

const { parseGovListings, parseAtamaListings, parseOptiusFeed, parseTrenkwalderListings, parseAgadoListings, parseAdeccoSitemap, parseAdeccoJobPreview, parseRekruterFeed, parseNoveSitemap, parseNoveJob, parseLidlSitemap, parseLidlJob, parseKolektorListings, parseMojeDeloConfig, parseMojeDeloJobs, parseZaposlitevInfoListings, zaposlitevInfoTotalPages, parseMercatorListings, parseIscideloListings, iscideloPages } = await import('../source/collector.js');
const { parseZrszJson } = await import('../source/zrsz.js');
const { parseDmListings, parseNovaPriloznostSitemap, parseNovaPriloznostJob } = await import('../source/next-sources.js');
const zrszSample = {
  DatumObjave: '2026-11-21T00:00:00', SteviloPDM: 3,
  ProstaDelovnaMesta: [
    { RegStPrijave: 'NY31603 ', NazivDelMesta: 'ELEKTRIČAR - M/Ž', PoslovniSubjekt: 'Primer, d.o.o., Industrijska cesta 4, 2000 MARIBOR',
      UEPDM: 'MARIBOR', RokZaPrijavoKandidatov: '19.12.2026', DatumObjave: '19.11.2026',
      OpisDelInNalog: 'Ne kopiraj v javno tabelo', KontaktZaKandidate: 'Osebni kontakt' },
    { RegStPrijave: 'AB12345', NazivDelMesta: 'Stari razpis', UEPDM: 'LJUBLJANA', RokZaPrijavoKandidatov: '1.11.2026', DatumObjave: '1.11.2026' },
    { RegStPrijave: 'NY31603 ', NazivDelMesta: 'ELEKTRIČAR - M/Ž', UEPDM: 'MARIBOR', RokZaPrijavoKandidatov: '19.12.2026', DatumObjave: '19.11.2026' },
  ],
};
const zrsz = parseZrszJson(zrszSample, Date.parse('2026-11-22T12:00:00+01:00'));
assert.equal(zrsz.length, 1, 'ZRSZ: izločimo potekle oglase in dvojnike po uradni referenci');
assert.equal(zrsz[0].id, 'zrsz:NY31603');
assert.equal(zrsz[0].company, 'Primer, d.o.o.');
assert.equal(zrsz[0].location, 'UE Maribor', 'Upravne enote ne smemo prikazati kot točnega kraja');
assert.equal(zrsz[0].date, '2026-11-19');
assert.equal(zrsz[0].deadline, '2026-12-19');
assert.equal(zrsz[0].url, 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/#/?drzava=SI,&iskalniTekst=Primer%2C%20d.o.o.&iskalnaLokacija=', 'ZRSZ: ne povezuj na prazen seznam; iskanje je predizpolnjeno z delodajalcem');
assert.ok(!('OpisDelInNalog' in zrsz[0]) && !('KontaktZaKandidate' in zrsz[0]), 'ZRSZ: brez celotnih opisov in kontaktnih podatkov');
assert.throws(() => parseZrszJson({ DatumObjave: '2026-11-21T00:00:00', SteviloPDM: 4, ProstaDelovnaMesta: zrszSample.ProstaDelovnaMesta }, Date.parse('2026-11-22')), /nepopoln/, 'Ne objavimo nepopolnega dnevnega izvoza');
assert.throws(() => parseZrszJson(zrszSample, Date.parse('2026-12-05')), /zastarel/, 'Starega posnetka ne objavimo kot aktualne oglase');
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
  {id:'5cb3187e-ae51-4db9-81a7-c30c131a6e40',title:'Operater na stroju (m/ž), Tržič',company:{name:'Primer d.o.o.'},country:{countryCode:'SI'},town:{name:'Maribor'},regions:[{translation:'Podravska'}],startDate:'2026-11-20T07:00:00Z'},
  {id:'foreign-1',title:'Elektromonter v Avstriji',country:{countryCode:'AT'},town:{name:'Graz'}},
]}};
const mdJobs=parseMojeDeloJobs(mdSample);
assert.equal(mdJobs.length,1,'MojeDelo: brez tujih oglasov');
assert.equal(mdJobs[0].company,'Primer d.o.o.');
assert.equal(mdJobs[0].location,'Maribor');
assert.deepEqual(mdJobs[0].regions,['Podravska']);
assert.equal(mdJobs[0].date,'2026-11-20T07:00:00.000Z');
assert.equal(mdJobs[0].url,'https://www.mojedelo.com/oglas/operater-na-stroju-mz-trzic/5cb3187e-ae51-4db9-81a7-c30c131a6e40', 'MojeDelo: neposredna stran oglasa (preverjena v brskalniku)');
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

const mercatorHtml = `<div class="active-job-list"><div class="active-job-row">
 <div class="active-job-item jobposition-50 jobregion-6 jobregion-4 jobregion-2"><a href="/sl/kariera/prosta-delovna-mesta/elektricarji-11765/"><h3>ELEKTRIČARJI (m/ž)</h3></a><p>Jesenice, Kočevje, Ljubljana</p><p></p></div>
 <div class="active-job-item jobposition-60 jobregion-14"><a href="/sl/kariera/prosta-delovna-mesta/delo-v-tujini-11766/"><h3>Delo v tujini</h3></a><p>Zagreb</p></div></div></div>`;
const mercator = parseMercatorListings(mercatorHtml);
assert.equal(mercator.length,1,'Mercator: izključimo izključno tuje oglase');
assert.equal(mercator[0].id,'mercator:11765');
assert.deepEqual(mercator[0].regions,['Osrednjeslovenska','Jugovzhodna Slovenija','Gorenjska'],'Mercator: več regij v enem oglasu');
assert.equal(mercator[0].location,'Jesenice, Kočevje, Ljubljana');
assert.equal(mercator[0].url,'https://www.mercatorgroup.si/sl/kariera/prosta-delovna-mesta/elektricarji-11765/');
assert.throws(()=>parseMercatorListings('<html>brez oglasov</html>'),/Mercator/,'Sprememba HTML ne sme veljati za uspešen zajem');

const iscideloCard=(id,title,company,location,deadline)=>`<article class="legacy-result-card rp-job-result" data-job-card><h2><a href="/delovna-mesta/${id}" data-card-title>${title}</a></h2><div class="legacy-result-company" data-card-company>${company}</div><span data-card-city><b>Kraj dela:</b>${location}</span><span data-card-deadline><b>Prijave odprte do:</b>${deadline}</span></article>`;
const iscideloHtml=`<div id="job-results">${iscideloCard('elektricar-m-z','Električar (m/ž)','Test d.o.o.','Maribor','30. 11. 2026')}${iscideloCard('star-oglas','Star oglas','Test','Maribor','1. 10. 2026')}${iscideloCard('delo-v-avstriji','Delo v tujini','Test','Avstrija','30. 11. 2026')}</div><nav class="jobs-pagination" data-page="1" data-pages="2"></nav>`;
const iscidelo = parseIscideloListings(iscideloHtml,Date.parse('2026-11-22'));
assert.equal(iscidelo.length,1,'IščiDelo: brez poteklih in izključno tujih razpisov');
assert.equal(iscidelo[0].title,'Električar (m/ž)');
assert.equal(iscidelo[0].company,'Test d.o.o.');
assert.equal(iscidelo[0].location,'Maribor');
assert.equal(iscidelo[0].deadline,'2026-11-30');
assert.equal(iscidelo[0].url,'https://iscidelo.com/delovna-mesta/elektricar-m-z');
assert.deepEqual(iscideloPages(iscideloHtml),{page:1,total:2});
assert.throws(()=>iscideloPages('<html>napaka</html>'),/straneh/,'Manjkajoča paginacija mora pomeniti napako');

const nuxtNodes = [];
const ref = value => (nuxtNodes.push(value), nuxtNodes.length - 1);
const dmItem = (id, title, end, address, city) => ({
  jobId: ref(id), title: ref(title), slug: ref('prodajalec-test'),
  postEndDate: end ? ref(end) : undefined, altAddress: ref(address),
  addresses: city ? ref([ref({ city: ref(city) })]) : undefined,
  jobInviteUrl: ref('https://www.dm-jobs.si/job/prodajalec-test/' + id + '/'),
});
const dmItems = [
  ref(dmItem('274443', 'Prodajalec (m/ž)', '2026-12-04T22:59:59Z', 'Cesta 1 1000 Ljubljana', 'Brezovica')),
  ref(dmItem('274442', 'Star oglas', '2026-11-01T22:59:59Z', 'Trg 2 1000 Ljubljana')),
  ref(dmItem('274441', 'Prodajalec - samoiniciativna prijava', null, 'Cesta 3 4000 Kranj')),
];
const dmCount = ref(dmItems.length);
const dmLinks = ref(dmItems);
ref({ count: dmCount, jobs: dmLinks });
const dmHtml = '<script id="__NUXT_DATA__" type="application/json">' + JSON.stringify(nuxtNodes) + '</script>';
const dmJobs = parseDmListings(dmHtml, Date.parse('2026-11-22'));
assert.equal(dmJobs.length, 1, 'dm: izločimo potekle oglase in samoiniciativne prijave');
assert.equal(dmJobs[0].location, 'Brezovica', 'dm: uporabljamo dejanski kraj dela namesto poštnega kraja');
assert.equal(dmJobs[0].url, 'https://www.dm-jobs.si/job/prodajalec-test/274443/');
assert.throws(() => parseDmListings(dmHtml.replace('https://www.dm-jobs.si/job/prodajalec-test/274443/', 'https://evil.test/job/274443/'), Date.parse('2026-11-22')), /URL ali ID/, 'dm: oglas mora imeti pravi javni URL');
assert.throws(() => parseDmListings(dmHtml.replace('"count":' + dmCount, '"count":99999')), /nepopoln/, 'dm: brez strukture ne sme prijaviti uspeha');
assert.throws(() => parseDmListings('<html>brez podatkov</html>'), /podatkov/, 'dm: sprememba HTML mora biti zaznana');

const novaJobUrl = 'https://novapriloznost.si/delovno-mesto/elektrotehnik-m-z/';
const novaSitemap = parseNovaPriloznostSitemap('<urlset><url><loc><![CDATA[' + novaJobUrl +
  ']]></loc></url><url><loc>' + novaJobUrl +
  '</loc></url><url><loc>https://drugi-primer.si/delovno-mesto/test/</loc></url></urlset>');
assert.equal(novaSitemap.length, 1, 'Nova Priložnost: samo uradni URL-ji, brez podvojitev');
const novaPosting = {
  '@type': 'JobPosting', title: 'Elektrotehnik (m/ž)', datePosted: '2026-11-20T12:00:00Z',
  validThrough: '2026-12-20T23:59:59Z', description: 'Celoten opis ne sodi v DeloRadar',
  hiringOrganization: { name: 'Podjetje d.o.o.' },
  jobLocation: { address: 'Maribor' },
};
const novaHtml = '<script type="application/ld+json">' + JSON.stringify(novaPosting) + '</script>';
const novaJob = parseNovaPriloznostJob(novaHtml, novaSitemap[0], Date.parse('2026-11-22'));
assert.equal(novaJob.title, 'Elektrotehnik (m/ž)');
assert.equal(novaJob.company, 'Podjetje d.o.o.');
assert.equal(novaJob.location, 'Maribor');
assert.equal(novaJob.deadline, '2026-12-20T23:59:59.000Z');
assert.ok(!('description' in novaJob), 'Nova Priložnost: ne kopiramo celotnih opisov');
assert.equal(parseNovaPriloznostJob(novaHtml, novaSitemap[0], Date.parse('2027-01-01')), null, 'Nova Priložnost: brez poteklih razpisov');
assert.equal(parseNovaPriloznostJob(novaHtml.replace('"address":"Maribor"', '"address":{"addressLocality":"Graz","addressCountry":"AT"}'), novaSitemap[0], Date.parse('2026-11-22')), null, 'Nova Priložnost: samo Slovenija');
assert.throws(() => parseNovaPriloznostJob('<html>brez JSON-LD</html>', novaSitemap[0]), /strukturiranih/, 'Nova Priložnost: zaznamo pokvarjene oglase');

console.log('OK: filtri, straničenje, 18 virov in ZRSZ dnevni JSON');

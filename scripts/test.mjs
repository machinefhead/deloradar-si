import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
for (const file of ['../source/zrsz.js', '../source/zrsz-links.js', './probe-public-portals.mjs']) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /playwright-core|chromium\.launch|\.goto\(|dispatchEvent\('click'/,
    `${file}: zajem oglasov ne sme več odpirati brskalnika ali klikati kartic`);
}
import { page } from '../source/page.js';
import { planAdeccoIncremental } from '../source/collector.js';
import { markLikelyDuplicates } from '../source/duplicates.js';
const adeccoNow = Date.parse('2026-11-25T12:00:00Z');
const adeccoListings = Array.from({ length: 140 }, (_, i) => ({
  id: `adecco:jn-112026-${String(i).padStart(7, '0')}`,
  url: `https://www.adecco.com/sl-si/prosta-delovna-mesta/oglas/jn-112026-${String(i).padStart(7, '0')}`,
}));
const adeccoPrevious = adeccoListings.map(listing => ({ ...listing, source: 'Adecco', title: 'Oglas', deadline: '2026-12-20' }));
const adeccoPlan = planAdeccoIncremental(adeccoListings, adeccoPrevious, adeccoNow);
assert.equal(adeccoPlan.cached.size, 140, 'Adecco: aktualne oglase preberemo iz predpomnilnika');
assert.ok(adeccoPlan.requests.length > 0 && adeccoPlan.requests.length < 30,
  'Adecco: dnevno osvežimo le del trenutno veljavnih oglasov');
const adeccoChanged = planAdeccoIncremental(adeccoListings.slice(0, 1),
  [{ ...adeccoPrevious[0], url: 'https://www.adecco.com/sl-si/prosta-delovna-mesta/drug-oglas/jn-112026-0000000' }], adeccoNow);
assert.equal(adeccoChanged.cached.size, 0, 'Adecco: starih spremenjenih povezav ne uporabimo');
assert.equal(adeccoChanged.requests.length, 1, 'Adecco: nov URL je treba preveriti s HTTP');
const adeccoExpired = planAdeccoIncremental(adeccoListings.slice(0, 1),
  [{ ...adeccoPrevious[0], deadline: '2026-11-24' }], adeccoNow);
assert.equal(adeccoExpired.cached.size, 0, 'Adecco: potečen oglas ni varno ponovno uporabiti');
import { mergeZrszDirectLinks, supplementZrszPublicDetails } from '../source/zrsz-links.js';
import { planZrszDetails } from '../source/zrsz-incremental.js';
import {
  parseZrszPilotCard, parseZrszPilotDetail, zrszDirectUrl,
  parseEuresPilotSummary, parseEuresPilotDetail, careerjetProbeStatus,
} from '../source/portal-probe.js';

const sameVacancy=(id,source,date,extra={})=>({ id,source,date,title:'Elektrotehnik (m/ž)',company:'Primer d.o.o.',location:'Maribor',deadline:'2026-12-15',url:'https://primer.si/delo/'+id,...extra });
const planNow=Date.parse('2026-11-25T12:00:00Z');
const zrszPlanJob=(reference,extra={})=>({id:'zrsz:'+reference,reference,source:'ZRSZ / PoiščiDelo',title:'Električar',company:'Primer d.o.o.',date:'2026-11-20',deadline:'2026-12-15',url:'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/',...extra});
const oldZrsz=[
  zrszPlanJob('A',{skills:'Varjenje',detailsFetchedAt:'2026-11-24T12:00:00Z',detailsCheckedAt:'2026-11-24T12:00:00Z',url:'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/?idp=3503870/#/pdm/3503870'}),
  zrszPlanJob('B',{detailsFetchedAt:'2026-10-30T12:00:00Z',detailsCheckedAt:'2026-11-20T12:00:00Z'}),
  zrszPlanJob('REMOVED'),
];
const zrszPlan=planZrszDetails([zrszPlanJob('A'),zrszPlanJob('B'),zrszPlanJob('C'),zrszPlanJob('D',{title:'Nov naziv'})],oldZrsz,{now:planNow,maxRequests:2});
assert.deepEqual(zrszPlan.requests,['zrsz:C','zrsz:D'],'ZRSZ: najprej nova oglasa, brez ponovnega branja nespremenjenih');
assert.equal(zrszPlan.stats.deferred,1,'ZRSZ: odložimo poznejše osveževanje prek omejitve');
assert.equal(zrszPlan.stats.removed,1,'ZRSZ: zaznamo izginule oglase');
assert.equal(zrszPlan.jobs[0].skills,'Varjenje','ZRSZ: ponovno uporabimo preverjene podrobnosti');
assert.match(zrszPlan.jobs[0].url,/\?idp=3503870/,'ZRSZ: ohranimo samo neposredno preverjeno povezavo');
assert.deepEqual(planZrszDetails([zrszPlanJob('A')],oldZrsz,{now:planNow,maxRequests:0}).requests,[],'ZRSZ: limit 0 zagotavlja nič zahtevkov');
assert.deepEqual(planZrszDetails([zrszPlanJob('A',{title:'Spremenjeno'})],oldZrsz,{now:planNow}).requests,['zrsz:A'],'ZRSZ: ob spremenjenem nazivu znova preverimo oglas');
assert.throws(()=>planZrszDetails([zrszPlanJob('A')],oldZrsz,{maxRequests:501}),/neveljavne/,'ZRSZ: zavrnemo pretirano omejitev');
const largeZrszPlan=planZrszDetails(Array.from({length:3500},(_,index)=>zrszPlanJob('R'+index)),[],{now:planNow,maxRequests:60});
assert.equal(largeZrszPlan.stats.queued,3500,'ZRSZ: načrtujemo tudi celoten prvi dnevni seznam');
assert.equal(largeZrszPlan.requests.length,60,'ZRSZ: en zagon nikoli ne preseže dovoljenega števila podrobnosti');
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
assert.equal(markLikelyDuplicates([
  sameVacancy('iscidelo:1','IščiDelo',''),
  sameVacancy('mojedelo:7','MojeDelo.com','2026-11-20')
]).filter(j=>j.duplicateGroup).length,2,'Izjemoma združimo enak naziv, podjetje in kraj, ko datum manjka le enemu viru');
assert.equal(markLikelyDuplicates([
  sameVacancy('iscidelo:2','IščiDelo',''),
  sameVacancy('mojedelo:8','MojeDelo.com','')
]).filter(j=>j.duplicateGroup).length,0,'Brez datumov obeh oglasov ne sklepamo o identiteti');

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
assert.match(page, /id="exportFiltered"[^>]*>↓ Izvozi filtrirane \(JSON\)/, 'Obstoječi izvoz mora biti filtrirani JSON');
assert.match(page, /id="exportAll"[^>]*>↓ Izvozi vse \(JSON\)/, 'Na voljo mora biti izvoz vseh izvornih oglasov');
assert.match(page, /<dialog id="jobDialog" class="jobdialog"/, 'Podrobnosti oglasa morajo biti na voljo na isti strani');
assert.match(page, /data-detail-id=/, 'Klik na naziv oglasa mora odpreti podrobnosti');
assert.match(page, /jobDialog\.showModal\(\)/, 'Podrobnosti se odprejo v dostopnem dialogu');
assert.match(script, /new URLSearchParams\(window\.location\.search\)\.get\('oglas'\)/, 'Povezava do konkretnega oglasa mora odpreti njegov opis');
assert.match(script, /if\(linkedJob&&!openJobDetail\(linkedJob\)\)/, 'Neveljavne ali potekle povezave ne smejo prikazati drugega oglasa');
assert.match(page, /Opis preverjen/, 'Pri opisu mora biti razviden datum preverjanja podrobnosti');
assert.doesNotMatch(page, /Izvozi CSV|text\/csv|\.csv'/, 'CSV izvoz je v celoti zamenjan z JSON');
assert.match(script, /scope==='filtered'\?displayed\(\):jobs/, 'Filtrirani JSON mora izvoziti vse filtrirane strani, celoten pa vsa izvorna dela');
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
assert.match(page, /\.sourcecatalog\{display:block\}/, 'Nepovezani viri morajo biti prikazani brez klika');
assert.match(page, /id="planned"><div class="sourcecard"><p>Pridobivam seznam nepovezanih virov/, 'Nepovezani viri morajo imeti jasen začetni prikaz');
assert.doesNotMatch(page, /Za ta iskalnika še nimamo samodejnega izvoza/, 'Ko EURES priključimo, ne sme ostati zastarelo navodilo');
assert.doesNotMatch(page, /id="showCatalog"|id="topSources"|function showSources\(/, 'Odvečna gumba za prikaz istih povezav morata biti odstranjena');
assert.doesNotMatch(page, /sourcesToggle|sidebar\.sources-open/, 'Tudi mobilni seznam virov ostaja odprt');
assert.match(script, /planned\.filter\(function\(s\)\{return !linkedNames\.has\(s\.name\)\}\)/, 'Na dnu pokažemo vse načrtovane, a še nepovezane vire');
assert.match(script, /safe\(s\.status\|\|'V raziskavi'\)/, 'Status raziskave vira mora biti viden');
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
assert.ok((plannedBlock.match(/\{ name:/g)||[]).length>=12,'Raziskani, a še nepovezani viri morajo ostati vidni v katalogu');
for(const name of ['SPAR Slovenija','Slovenske železnice','Prohuman','HOFER Slovenija','Pošta Slovenije','Bolha Zaposlitve','LinkedIn Jobs']) {
  assert.ok(plannedBlock.includes("name: '"+name+"'"),'Raziskani nepovezani vir manjka: '+name);
}
assert.doesNotMatch(page, /Ob odprtju preberemo zadnji objavljeni posnetek/, 'Podvojeno pojasnilo pod tabelo je odvečno');
const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
assert.match(workflow, /cron: '17 5,17 \* \* \*'/, 'Samodejno osveževanje mora teči dvakrat dnevno (na 12 ur)');

const extract = (start, end) => {
  const a = script.indexOf(start), b = script.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Manjka odsek ${start}`);
  return script.slice(a, b);
};
const sourceElements = new Map(['sourceStatus', 'sourceSummary', 'sourcesNum', 'planned', 'notice']
  .map(id => [id, { innerHTML: '', textContent: '' }]));
const sourceFooter = { textContent: '' };
const sourceContext = {
  jobs: [
    { source: 'ZRSZ / PoiščiDelo', url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/?idp=3509311/#/pdm/3509311' },
    { source: 'ZRSZ / PoiščiDelo', url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/#/?iskalniTekst=podjetje' },
  ],
  sources: [
    { id: 'zrsz', name: 'ZRSZ / PoiščiDelo', status: 'live', count: 4152 },
    { id: 'eures', name: 'EURES', status: 'live', count: 25 },
    { id: 'adecco', name: 'Adecco', status: 'live', count: 161 },
  ],
  planned: [{ name: 'Careerjet', href: 'https://www.careerjet.si/', note: 'Še ni uvoza' }],
  $: id => sourceElements.get(id),
  safe: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  document: { querySelector: () => sourceFooter },
};
runInNewContext(extract('function sourceRender(', 'function matchesJob('), sourceContext);
sourceContext.sourceRender();
assert.equal(sourceElements.get('sourceSummary').textContent, '3 od 3 virov dosegljivih');
assert.match(sourceElements.get('sourceStatus').innerHTML, /ZRSZ \/ PoiščiDelo/);
assert.match(sourceElements.get('sourceStatus').innerHTML, /Neposredne povezave ZRSZ: 1 \/ 2/, 'Stanje povezav mora razlikovati preverjeni idp in iskanje');
assert.match(sourceElements.get('sourceStatus').innerHTML, /opis v DeloRadarju in iskanje ZRSZ/, 'Manjkajoči uradni ID dobi pošteno označen način dostopa');
assert.match(sourceElements.get('sourceStatus').innerHTML, /EURES/);
assert.match(sourceElements.get('planned').innerHTML, /Careerjet/);
assert.doesNotMatch(sourceElements.get('planned').innerHTML, /EURES/, 'Povezanega EURES ne smemo prikazati kot nepovezan vir');
assert.equal(sourceElements.get('notice').innerHTML, '', 'Ko vsi viri delujejo, ne prikazujemo opozorila');
sourceContext.sources[1].status = 'error';
sourceContext.sourceRender();
assert.equal(sourceElements.get('sourceSummary').textContent, '2 od 3 virov dosegljivih');
assert.match(sourceElements.get('sourceStatus').innerHTML, /Ni odziva/);
assert.match(sourceElements.get('notice').innerHTML, /EURES/, 'Napaka mora biti vidna med stanjem virov');
const linkContext = {};
runInNewContext(extract('function slugForJob(', 'function load('), linkContext);
const fixtureExportJobs = [
  { id:'a',title:'Električar',source:'Optius',url:'https://primer.si/1',
    location:'Maribor',description:'Vzdrževanje električnih napeljav.',employmentType:'FULL_TIME',duplicateGroup:'pair1' },
  { id:'b',title:'Električar',source:'Kariera.si',url:'https://primer.si/2',duplicateGroup:'pair1' },
];
const exportControls = {
  search: {value:'električar'},published: {value:''},deadline: {value:'7'},myStatus: {value:''},
  onlySaved:{checked:true},hideApplied:{checked:false},sort:{value:'new'},
};
const exportContext = {
  multiIds:['sourceFilter','region'],selectedValues:id=>id==='region'?['Podravska']:[],
  $:id=>exportControls[id],checkedAt:'2026-11-25T11:14:23Z',sources:[{id:'optius',status:'live',count:2}],
  groupEnabled:()=>true,mergedState:()=>({saved:true,status:'contacted'}),
  getState:id=>id==='a'?{saved:true,status:'interested'}:{},
};
runInNewContext(extract('function jsonExportData(', 'function downloadJson('),exportContext);
const exportFiltered=exportContext.jsonExportData('filtered',[fixtureExportJobs[0]],'2026-11-25T12:00:00Z');
assert.equal(exportFiltered.scope,'filtered');
assert.equal(exportFiltered.version,2,'Bogat izvoz uporablja novo različico sheme');
assert.equal(exportFiltered.total,1);
assert.equal(exportFiltered.duplicateMode,'merged');
assert.equal(exportFiltered.jobs[0].status,'contacted','Filtrirani izvoz ohrani združen uporabnikov status');
assert.equal(exportFiltered.jobs[0].saved,true);
assert.equal(exportFiltered.filters.facets.region[0],'Podravska','Filtrirani JSON vsebuje tudi uporabljene filtre');
assert.equal(exportFiltered.capturedAt,'2026-11-25T11:14:23Z');
assert.equal(exportFiltered.jobs[0].description,'Vzdrževanje električnih napeljav.');
assert.equal(exportFiltered.jobs[0].employmentType,'FULL_TIME');
assert.equal(exportFiltered.jobs[0].locations[0],'Maribor');
assert.equal(exportFiltered.jobs[0].contractDuration,null,'Neznanega trajanja ne ugibamo');
const exportAll=exportContext.jsonExportData('all',fixtureExportJobs,'2026-11-25T12:00:00Z');
assert.equal(exportAll.scope,'all');
assert.equal(exportAll.total,2);
assert.equal(exportAll.duplicateMode,'original','Celoten izvoz ohrani vse izvore tudi pri združenem prikazu');
assert.equal(exportAll.filters,null,'V celoten izvoz ne prenašamo aktivnih filtrov');
assert.equal(exportAll.jobs[0].status,'interested','Celoten izvoz shrani ločene osebne oznake po izvornih ID-jih');
assert.equal(exportAll.jobs[1].status,'');
assert.equal(exportAll.jobs[1].description,null,'Vsi oglasi imajo enako strukturo dodatnih polj');
assert.equal(fixtureExportJobs[0].status,undefined,'Izvoz ne sme spreminjati originalnih podatkov');
const downloaded=[];
let exportedContent='';
Object.assign(exportContext,{
  jobs:fixtureExportJobs,
  displayed:()=>[fixtureExportJobs[0]],
  noticeMessage:message=>{throw Error('Nepričakovano opozorilo: '+message)},
  Blob:class {constructor(parts,options){this.parts=parts;this.options=options}},
  URL:{createObjectURL(blob){exportedContent=blob.parts.join('');return 'blob:test-export'},revokeObjectURL(){}},
  document:{createElement(){return {href:'',download:'',click(){downloaded.push(this.download)},remove(){}}},body:{appendChild(){}}},
  setTimeout() {},
});
runInNewContext(extract('function downloadJson(', "$('exportFiltered').addEventListener"),exportContext);
exportContext.downloadJson('filtered');
assert.match(downloaded[0],/^deloradar-filtrirani-\d{4}-\d{2}-\d{2}\.json$/);
assert.equal(JSON.parse(exportedContent).jobs.length,1,'Klik na filtrirani izvoz vrne samo filtrirane zadetke');
exportContext.downloadJson('all');
assert.match(downloaded[1],/^deloradar-vsi-oglasi-\d{4}-\d{2}-\d{2}\.json$/);
assert.equal(JSON.parse(exportedContent).jobs.length,2,'Klik na celotni izvoz ne sme uporabiti filtriranega seznama');
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
runInNewContext(extract('function pageButton(', 'function detailValue('), navContext);
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
const detailContext={
  safe:value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  dateLabel:value=>value||'—',checkedAt:'2026-11-25T11:14:23Z',Intl,
  URL,window:{location:{href:'https://machinefhead.github.io/deloradar-si/?filter=severno#staro'}},
};
runInNewContext(extract('function jobPermalink(', 'var jobDialog='),detailContext);
assert.equal(detailContext.jobPermalink('zrsz:IE18067'),
  'https://machinefhead.github.io/deloradar-si/?filter=severno&oglas=zrsz%3AIE18067',
  'Točen oglas ima deljivo, pravilno kodirano povezavo in ne prenaša starega URL fragmenta');
const detailHtml=detailContext.detailMarkup({id:'zrsz:77',source:'ZRSZ / PoiščiDelo',title:'Električar <test>',company:'Primer d.o.o.',
  location:'UE Maribor',description:'Vzdrževanje naprav.\nPozor: <img src=x onerror=alert(1)>',
  employmentType:'FULL_TIME',contractDuration:'Nedoločen čas',workHours:'40 ur tedensko',
  date:'2026-11-20',deadline:'2026-12-15',url:'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/#/?iskalniTekst=Primer',reference:'77'},[]);
assert.match(detailHtml,/Opis delovnega mesta/, 'Prikaz vključuje opis, če ga vir ponuja');
assert.match(detailHtml,/Nedoločen čas/, 'Trajanje zaposlitve je vidno');
assert.match(detailHtml,/Polni delovni čas/, 'Vrsta zaposlitve ima razumljivo oznako');
assert.match(detailHtml,/Rok za prijavo/, 'Rok prijave je v podrobnostih');
assert.doesNotMatch(detailHtml,/<img|onerror=|&lt;img/, 'Nevarne oznake iz opisa se ne prikazujejo in ne izvajajo');
const nestedDescription='<p><p>Uvod o delu.</p><p><br></p><p><strong>Vaše naloge:</strong></p><ul><li>Vzdrževanje</li><li>Organizacija</li></ul></p>';
const formatted=detailContext.detailMarkup({id:'adecco:1',source:'Adecco',title:'Vodja kakovosti',description:nestedDescription},[]);
assert.match(formatted,/<p>Uvod o delu\.<\/p>/,'Adecco: ločeni odstavki so berljivi');
assert.match(formatted,/<p><strong>Vaše naloge:<\/strong><\/p>/,'Adecco: naslov razdelka je poudarjen');
assert.match(formatted,/<ul><li>Vzdrževanje<\/li><li>Organizacija<\/li><\/ul>/,'Adecco: alineje so pravi HTML seznam');
assert.doesNotMatch(formatted,/&lt;p&gt;|&lt;ul&gt;|&lt;li&gt;/,'V dialogu ne smejo ostati surove oznake');
assert.match(detailContext.detailReadable('&amp;lt;p&amp;gt;Delo&amp;lt;/p&amp;gt;'),/Delo/,'Dvakrat HTML-kodirano besedilo se razbere');
assert.match(detailHtml,/Poišči razpis na ZRSZ/, 'Iskalna povezava ni predstavljena kot neposredni oglas');
assert.match(detailHtml,/Povezava do opisa v DeloRadarju/, 'Vsak oglas omogoča deljenje natančno svojega opisa');
assert.match(detailHtml,/oglas=zrsz%3A77/, 'Povezava do opisa vsebuje identifikator oglasa, ne nepreverjenega idp');
const noDescription=detailContext.detailMarkup({id:'a',title:'Operater',source:'Optius',url:'https://www.optius.com/delo/1',summary:'Kratek povzetek.'},[]);
assert.match(noDescription,/Kratek povzetek\./, 'Povzetek je viden, tudi če ni celotnega opisa');
const noDetails=detailContext.detailMarkup({id:'a',title:'Operater',source:'Optius',url:'https://www.optius.com/delo/1'},[]);
assert.match(noDetails,/ne ponuja celotnega opisa/, 'Manjkajoči opis je pojasnjen, ne izmišljen');
const alternative=detailContext.detailMarkup({id:'a',title:'Operater',source:'Optius',url:'https://www.optius.com/delo/1'},
  [{id:'a',source:'Optius'},{id:'b',source:'GOV.SI'}]);
assert.match(alternative,/data-detail-source="b"/, 'Pri označenih dvojnikih so na voljo podrobnosti drugega vira');
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
const { parseMojeDeloDetails, parseZaposlitevInfoDetails, parseKarieraDetails, parseOptiusDetails, reuseJobDetails, enrichJobsProgressively } = await import('../source/job-enrichment.js');
const karieraJob={source:'Kariera.si',title:'Izmenski vzdrževalec – elektrotehnik m/ž/d',url:'https://www.kariera.si/sl/delovno-mesto/kari123abc'};
const karieraHTML='<h1>Izmenski vzdrževalec – elektrotehnik m/ž/d</h1><div class="details-post-data"><div class="post-block"><p>Stabilna proizvodnja.</p></div><div class="post-block"><h4 class="block-title">Glavne naloge:</h4><div><ul><li>Vzdrževanje opreme</li></ul></div></div><div class="post-block"><h4 class="block-title">Od kandidatov pričakujemo:</h4><div><ul><li>Izkušnje z elektroniko</li></ul></div></div><div class="post-block"><h4 class="block-title">Nudimo:</h4><div><ul><li>Redna zaposlitev</li></ul></div></div><a href="/sl/oddaj-prijavo/kari123abc">Prijava</a></div>';
const kd=parseKarieraDetails(karieraHTML,karieraJob);
assert.equal(kd.description,'Stabilna proizvodnja.');
assert.match(kd.responsibilities,/• Vzdrževanje opreme/);
assert.match(kd.requirements,/• Izkušnje z elektroniko/);
assert.match(kd.benefits,/• Redna zaposlitev/);
assert.equal(parseKarieraDetails(karieraHTML,{...karieraJob,title:'Drugo delo'}),null,'Ne povezujemo napačnega oglasa');
assert.equal(parseKarieraDetails(karieraHTML.replace('kari123abc','kari000abc'),karieraJob),null,'Ne prenašamo podrobnosti sorodnih oglasov');
const optiusJob={source:'Optius',title:'Elektrotehnik (m/ž)',url:'https://www.optius.com/iskalci/prosta-delovna-mesta/elektrotehnik-1/'};
const optiusHTML='<link rel="canonical" href="https://www.optius.com/iskalci/prosta-delovna-mesta/elektrotehnik-1/"><h1>Elektrotehnik (m/ž)</h1><div class="info-wrapper"><div class="info-cols"><div class="col-left"><h3 class="section-title">Opis delovnega mesta</h3></div><div class="col-right"><ul><li>Popravila strojev</li></ul></div></div></div><div class="info-wrapper"><div class="info-cols"><div class="col-left"><h3 class="section-title">Pričakujemo</h3></div><div class="col-right"><p>Poznavanje vezij</p></div></div></div><div class="info-wrapper"><div class="info-cols"><div class="col-left"><h3 class="section-title">Ponujamo</h3></div><div class="col-right"><p>Fleksibilno delo</p></div></div></div>';
const od=parseOptiusDetails(optiusHTML,optiusJob);
assert.match(od.description,/• Popravila strojev/);
assert.equal(od.requirements,'Poznavanje vezij');
assert.equal(od.benefits,'Fleksibilno delo');
assert.equal(parseOptiusDetails(optiusHTML,{...optiusJob,url:'https://www.optius.com/iskalci/prosta-delovna-mesta/drug/'}),null,'Optius: preverimo kanonično povezavo');
const mdDetailFixture={data:{id:'5cb3187e-ae51-4db9-81a7-c30c131a6e40',
  jobAdTranslations:[{title:'Operater na stroju',jobDescription:'<p>Menjava orodij.</p>',weOffer:'<p>Stabilna zaposlitev.</p>'}],
  weExpect:'<ul><li>Natančnost</li></ul>',employmentTypes:[{translation:'Redno, določen d. č.'}],
  workTime:{translation:'Polni delovni čas'},educationLevels:[{translation:'Poklicna šola'}],
  endDate:'2026-12-10T22:59:59.000Z',
  applicationRecipientEmails:['kontakt@example.com'],waysToApply:'Kontaktna oseba: zasebni telefon'}};
const mdDetail=parseMojeDeloDetails(mdDetailFixture,{id:'mojedelo:5cb3187e-ae51-4db9-81a7-c30c131a6e40',title:'Operater na stroju'});
assert.equal(mdDetail.description,'Menjava orodij.','MojeDelo: opis se normalizira v navadno besedilo');
assert.equal(mdDetail.benefits,'Stabilna zaposlitev.');
assert.equal(mdDetail.employmentType,'Redno, določen d. č.');
assert.equal(mdDetail.deadline,'2026-12-10');
assert.ok(!JSON.stringify(mdDetail).includes('kontakt@example.com'),'Kontaktov fizičnih oseb ne kopiramo');
assert.equal(parseMojeDeloDetails(mdDetailFixture,{id:'mojedelo:drugi',title:'Operater na stroju'}),null,'Ne prenašamo opisa napačnega ID-ja');
const ziMarkup='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Prodajalec (m/ž)',
  description:'<p>Prodaja in svetovanje.</p><p>Delo s strankami.</p>',employmentType:'PART_TIME',
  validThrough:'2026-12-20',hiringOrganization:{name:'Trgovina'}})+'</script>';
const ziDetail=parseZaposlitevInfoDetails(ziMarkup,{id:'zaposlitevinfo:1',title:'Prodajalec (m/ž)'},Date.parse('2026-11-25'));
assert.match(ziDetail.description,/Delo s strankami/,'Zaposlitev.info: uporabi samo javni JobPosting');
assert.equal(ziDetail.deadline,'2026-12-20');
assert.equal(parseZaposlitevInfoDetails(ziMarkup,{title:'Povsem drug oglas'}),null,'Ne kopiraj drugega oglasa');
const cacheTime=Date.parse('2026-11-25T13:00:00Z');
const previousDetail={id:'mojedelo:1',source:'MojeDelo.com',title:'Naziv',description:'Shranjeni opis',
  detailsFetchedAt:'2026-11-24T13:00:00Z',deadline:'2026-11-20'};
assert.equal(reuseJobDetails({id:'mojedelo:1',source:'MojeDelo.com',title:'Naziv'},previousDetail,cacheTime).description,'Shranjeni opis');
assert.equal(reuseJobDetails({id:'mojedelo:1',source:'MojeDelo.com',title:'Naziv'},previousDetail,cacheTime).deadline,undefined,'Preteklega roka iz starega opisa ne ohranimo');
assert.equal(reuseJobDetails({id:'mojedelo:1',source:'MojeDelo.com',title:'Spremenjen naziv'},previousDetail,cacheTime),null,'Spremenjen oglas preveri znova');
assert.equal(reuseJobDetails({id:'mojedelo:1',source:'MojeDelo.com',title:'Naziv',date:'2026-11-25'},
  {...previousDetail,date:'2026-11-24'},cacheTime),null,'Ponovno objavljen oglas preveri znova');
let requests=0;
const progressive=await enrichJobsProgressively([
  {id:'mojedelo:1',source:'MojeDelo.com',title:'Naziv'},
  {id:'mojedelo:2',source:'MojeDelo.com',title:'Nova zaposlitev'},
  {id:'mojedelo:3',source:'MojeDelo.com',title:'Tretja zaposlitev'},
], [previousDetail], {name:'test',limit:1,concurrency:1,now:cacheTime,
  getDetails:async job=>{requests++;return {id:job.id}},
  parseDetails:()=>({description:'Nov podroben opis'})});
assert.equal(requests,1,'Zajamemo samo predpisano število novih podrobnosti');
assert.equal(progressive[0].description,'Shranjeni opis','Zadržimo že preverjene podatke');
assert.equal(progressive[1].description,'Nov podroben opis');
assert.equal(progressive[2].description,undefined,'Preostali oglasi ostanejo v seznamu brez izmišljanja');
let limitedRequests=0;
await enrichJobsProgressively(Array.from({length:7},(_,index)=>({id:'mojedelo:'+index,source:'MojeDelo.com',title:'Razpis '+index})),[],
  {name:'test-limit',limit:5,concurrency:4,now:cacheTime,
    getDetails:async()=>{limitedRequests++;return {};},parseDetails:()=>({description:'Opis'})});
assert.equal(limitedRequests,5,'Zadnja sočasna skupina ne sme preseči omejitve zahtevkov');
const { readableJobText, jobPostingDetails } = await import('../source/job-details.js');
assert.equal(readableJobText('<p>Prijava &amp; delo</p><ul><li>Vodenje</li><li>Organizacija</li></ul>'),
  'Prijava & delo\n• Vodenje\n• Organizacija','HTML opis ohrani odstavke in alineje');
assert.equal(readableJobText('&amp;lt;p&amp;gt;Strokovno delo&amp;lt;/p&amp;gt;'),'Strokovno delo','HTML, kodiran dvakrat, se očisti pred izpisom');
assert.equal(readableJobText(nestedDescription),'Uvod o delu.\n\nVaše naloge:\n• Vzdrževanje\n• Organizacija','Adecco: tudi gnezdeni odstavki in seznami se pravilno pretvorijo');
assert.deepEqual(jobPostingDetails({employmentType:['FULL_TIME','PART_TIME'],baseSalary:{currency:'EUR',value:{minValue:1800,maxValue:2300,unitText:'MONTH'}}}).salary,
  {currency:'EUR',minValue:1800,maxValue:2300,unit:'MONTH'},'Objavljena plača ohrani zneske in obdobje');
const zrszSample = {
  DatumObjave: '2026-11-21T00:00:00', SteviloPDM: 3,
  ProstaDelovnaMesta: [
    { RegStPrijave: 'NY31603 ', NazivDelMesta: 'ELEKTRIČAR - M/Ž', PoslovniSubjekt: 'Primer, d.o.o., Industrijska cesta 4, 2000 MARIBOR',
      UEPDM: 'MARIBOR', RokZaPrijavoKandidatov: '19.12.2026', DatumObjave: '19.11.2026',
      OpisDelInNalog: 'Montaža in vzdrževanje strojev.', TrajanjeZaposlitve: '6 mesecev',
      VrstaZaposlitve: 'Polni delovni čas', KontaktZaKandidate: 'Osebni kontakt' },
    { RegStPrijave: 'AB12345', NazivDelMesta: 'Stari razpis', UEPDM: 'LJUBLJANA', RokZaPrijavoKandidatov: '1.11.2026', DatumObjave: '1.11.2026' },
    { RegStPrijave: 'NY31603 ', NazivDelMesta: 'ELEKTRIČAR - M/Ž', UEPDM: 'MARIBOR', RokZaPrijavoKandidatov: '19.12.2026', DatumObjave: '19.11.2026' },
  ],
};
const zrsz = parseZrszJson(zrszSample, Date.parse('2026-11-22T12:00:00+01:00'));
const zrszRich = parseZrszJson({ ...zrszSample, SteviloPDM: 1, ProstaDelovnaMesta: [{
  ...zrszSample.ProstaDelovnaMesta[0], TrajanjeInVrstaZaposlitve: 'nedoločen čas, polni delovni čas',
  Klasius: 'srednja poklicna, Elektrotehnika', DelovneIzkusnje: '2 leti',
  VozniskiIzpit: ', vozniški izpit B', ZnanjeJezikov: ', slovenski jezik tekoče',
  PredvidenoPlacilo: '1800 EUR', AltKlasius: 'srednja tehniška',
}] }, Date.parse('2026-11-22T12:00:00+01:00'));
assert.equal(zrszRich[0].contractType, 'nedoločen čas, polni delovni čas');
assert.match(zrszRich[0].education, /Alternativna izobrazba: srednja tehniška/);
assert.match(zrszRich[0].requirements, /^vozniški izpit B|^poskusno delo|^slovenski jezik|^pogoji/i);
assert.equal(zrszRich[0].salary, '1800 EUR');
assert.equal(zrsz.length, 1, 'ZRSZ: izločimo potekle oglase in dvojnike po uradni referenci');
assert.equal(zrsz[0].id, 'zrsz:NY31603');
assert.equal(zrsz[0].company, 'Primer, d.o.o.');
assert.equal(zrsz[0].location, 'UE Maribor', 'Upravne enote ne smemo prikazati kot točnega kraja');
assert.equal(zrsz[0].date, '2026-11-19');
assert.equal(zrsz[0].deadline, '2026-12-19');
assert.equal(zrsz[0].url, 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/#/?drzava=SI,&iskalniTekst=Primer%2C%20d.o.o.&iskalnaLokacija=', 'ZRSZ: ne povezuj na prazen seznam; iskanje je predizpolnjeno z delodajalcem');
assert.equal(zrsz[0].description,'Montaža in vzdrževanje strojev.','ZRSZ ohrani objavljeni opis');
assert.equal(zrsz[0].contractDuration,'6 mesecev','ZRSZ ohrani trajanje pogodbe');
assert.equal(zrsz[0].employmentType,'Polni delovni čas');
assert.ok(!('KontaktZaKandidate' in zrsz[0]), 'ZRSZ ne kopira podatkov o kontaktnih osebah');
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
assert.equal(gov[0].contractType,'Nedoločen čas');
assert.equal(gov[0].workHours,'Polni delovni čas');
assert.equal(gov[0].jobCategory,'Javni natečaj');
assert.equal(gov[0].url, 'https://www.gov.si/zbirke/delovna-mesta/test-1/');

const atama = parseAtamaListings('<div class="pos_novica_ps_spisek"><h3>Električar (m/ž) Maribor</h3><div class="povzetev_nov_ps_spisek">Opis dela</div><div class="vec_nov_ps_spisek"><a href="S2210/D28068/Elektricar">Več o tem</a></div><div class="clear"></div></div>');
assert.equal(atama.length, 1);
assert.equal(atama[0].title, 'Električar (m/ž) Maribor');
assert.equal(atama[0].url, 'https://atama.si/S2210/D28068/Elektricar');
const optius = parseOptiusFeed('<rss><item><title>Elektrotehnik</title><link>https://www.optius.com/iskalci/prosta-delovna-mesta/test/</link><employer>Podjetje</employer><description>Kratek povzetek oglasa.</description><pubDate>Fri, 20 Nov 2026 15:17:00 +0100</pubDate></item></rss>');
assert.equal(optius.length, 1);
assert.equal(optius[0].company, 'Podjetje');
assert.equal(optius[0].summary, 'Kratek povzetek oglasa.');
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
assert.equal(agado[0].jobCategory, 'ELEKTROTEHNIKA');
assert.equal(agado[0].url, 'https://www.agado.si/iskalci/69/vsa-prosta-delovna-mesta/j123/oglas-123');

const adeccoUrl='https://www.adecco.com/sl-si/prosta-delovna-mesta/elektrikar-m-maribor/jn-112026-1190001';
const adeccoSitemap=parseAdeccoSitemap(`<?xml version="1.0"?><urlset><url><loc>${adeccoUrl}</loc></url><url><loc>https://www.adecco.com/en-si/job-search/test/jn-112026-1190002</loc></url></urlset>`);
assert.equal(adeccoSitemap.length,1,'Zajemamo samo slovensko različico Adecco');
const adeccoData={ '@type':'JobPosting', title:'Električar (m/ž)', datePosted:'2026-11-20T10:00:00Z', validThrough:'2026-12-20T23:59:59Z',
  description:'<p>Vgradnja in popravilo električnih naprav.</p>', employmentType:'FULL_TIME',
  jobLocation:{address:{addressLocality:'Maribor',addressCountry:'SI'}} };
const adeccoHtml=`<html><script type="application/ld+json">${JSON.stringify(adeccoData)}</script></html>`;
const adecco=parseAdeccoJobPreview(adeccoHtml,adeccoSitemap[0],Date.parse('2026-11-22'));
assert.equal(adecco.title,'Električar (m/ž)');
assert.equal(adecco.location,'Maribor');
assert.equal(adecco.id,'adecco:jn-112026-1190001');
assert.equal(adecco.source,'Adecco');
assert.equal(adecco.description,'Vgradnja in popravilo električnih naprav.');
assert.equal(adecco.employmentType,'FULL_TIME');
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
const noveHtml='<h1 class="case27-primary-text">Električarji in monterji (m/ž)</h1><div class="lmb-label">Prijave do: </div><div class="value">23 decembra, 2026</div><li><div class="item-attr">Podjetje</div><div class="item-property">DMB d.o.o.</div></li><li><div class="item-attr">Datum objave</div><div class="item-property">29 oktobra, 2026</div></li><li><div class="item-attr">Trajanje zaposlitve</div><div class="item-property">3 mesece</div></li>';
const nove=parseNoveJob(noveHtml,noveList[0],Date.parse('2026-11-22'));
assert.equal(nove.company,'DMB d.o.o.');
assert.equal(nove.date,'2026-10-29');
assert.equal(nove.deadline,'2026-12-23');
assert.equal(nove.contractDuration,'3 mesece');
assert.equal(parseNoveJob(noveHtml,noveList[0],Date.parse('2027-01-01')),null,'Poteklih oglasov Nove zaposlitve ne vključimo');

const lidlUrl='https://kariera.lidl.si/jobs/pomocnik-vodje-poslovne-enote-m-z-maribor-borova-vas-maribor-770466';
const lidlLinks=parseLidlSitemap(`<urlset><url><loc>${lidlUrl}</loc></url><url><loc>${lidlUrl}</loc></url><url><loc>https://kariera.lidl.si/ostalo/123</loc></url></urlset>`);
assert.equal(lidlLinks.length,1,'Lidl: iz uradnega seznama zajemamo samo povezave /jobs/ in odstranimo dvojnike');
assert.equal(lidlLinks[0].id,'lidl:770466');
const lidlData={ '@context':'https://schema.org', '@type':'JobPosting', title:'Pomočnik vodje poslovne enote (m/ž) Maribor',
  datePosted:'2026-11-15T23:00:00+00:00', validThrough:'2026-11-26T22:59:59+00:00',
  hiringOrganization:{name:'Prodaja'},jobLocation:{address:{addressLocality:'Maribor',addressCountry:'SI'}},
  description:'<p>Vodenje poslovne enote.</p><p>Organizacija dela.</p>',employmentType:'FULL_TIME',workHours:'40 ur/teden' };
const lidlHtml=`<script type="application/ld+json">${JSON.stringify(lidlData)}</script>`;
const lidl=parseLidlJob(lidlHtml,lidlLinks[0],Date.parse('2026-11-22'));
assert.equal(lidl.title,'Pomočnik vodje poslovne enote (m/ž) Maribor');
assert.equal(lidl.company,'Lidl Slovenija','Oddelek »Prodaja« ni ime delodajalca');
assert.equal(lidl.location,'Maribor');
assert.equal(lidl.date,'2026-11-15T23:00:00.000Z');
assert.equal(lidl.deadline,'2026-11-26T22:59:59.000Z');
assert.equal(lidl.description,'Vodenje poslovne enote.\nOrganizacija dela.');
assert.equal(lidl.employmentType,'FULL_TIME');
assert.equal(lidl.workHours,'40 ur/teden');
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
  {id:'5cb3187e-ae51-4db9-81a7-c30c131a6e40',title:'Operater na stroju (m/ž), Tržič',company:{name:'Primer d.o.o.'},country:{countryCode:'SI'},town:{name:'Maribor'},regions:[{translation:'Podravska'}],startDate:'2026-11-20T07:00:00Z',description:'Vodenje stroja.',employmentType:'FULL_TIME'},
  {id:'foreign-1',title:'Elektromonter v Avstriji',country:{countryCode:'AT'},town:{name:'Graz'}},
]}};
const mdJobs=parseMojeDeloJobs(mdSample);
assert.equal(mdJobs.length,1,'MojeDelo: brez tujih oglasov');
assert.equal(mdJobs[0].company,'Primer d.o.o.');
assert.equal(mdJobs[0].location,'Maribor');
assert.deepEqual(mdJobs[0].regions,['Podravska']);
assert.equal(mdJobs[0].date,'2026-11-20T07:00:00.000Z');
assert.equal(mdJobs[0].description,'Vodenje stroja.');
assert.equal(mdJobs[0].employmentType,'FULL_TIME');
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
  validThrough: '2026-12-20T23:59:59Z', description: '<p>Vzdrževanje opreme.</p><p>Terensko delo.</p>',
  employmentType:'FULL_TIME',qualifications:'Poznavanje elektrotehnike',jobBenefits:'Regres',
  hiringOrganization: { name: 'Podjetje d.o.o.' },
  jobLocation: { address: 'Maribor' },
};
const novaHtml = '<script type="application/ld+json">' + JSON.stringify(novaPosting) + '</script>';
const novaJob = parseNovaPriloznostJob(novaHtml, novaSitemap[0], Date.parse('2026-11-22'));
assert.equal(novaJob.title, 'Elektrotehnik (m/ž)');
assert.equal(novaJob.company, 'Podjetje d.o.o.');
assert.equal(novaJob.location, 'Maribor');
assert.equal(novaJob.deadline, '2026-12-20T23:59:59.000Z');
assert.equal(novaJob.description,'Vzdrževanje opreme.\nTerensko delo.','Nova Priložnost: ohrani objavljeni opis');
assert.equal(novaJob.employmentType,'FULL_TIME');
assert.equal(novaJob.requirements,'Poznavanje elektrotehnike');
assert.equal(novaJob.benefits,'Regres');
assert.equal(parseNovaPriloznostJob(novaHtml, novaSitemap[0], Date.parse('2027-01-01')), null, 'Nova Priložnost: brez poteklih razpisov');
assert.equal(parseNovaPriloznostJob(novaHtml.replace('"address":"Maribor"', '"address":{"addressLocality":"Graz","addressCountry":"AT"}'), novaSitemap[0], Date.parse('2026-11-22')), null, 'Nova Priložnost: samo Slovenija');
assert.throws(() => parseNovaPriloznostJob('<html>brez JSON-LD</html>', novaSitemap[0]), /strukturiranih/, 'Nova Priložnost: zaznamo pokvarjene oglase');

const pilotZrszCard = parseZrszPilotCard({
  title: ' TEHNOLOG V PERUTNINSKI PROIZVODNJI - M/Ž ',
  companyLocation: ' PANVITA, AGROMERKUR d.o.o. | MURSKA SOBOTA ',
  metadata: 'Določen čas | 40 ur/teden | 11.11.2026',
});
assert.equal(pilotZrszCard.company, 'PANVITA, AGROMERKUR d.o.o.');
assert.equal(pilotZrszCard.location, 'MURSKA SOBOTA');
assert.equal(pilotZrszCard.date, '2026-11-11');
const pilotZrsz = parseZrszPilotDetail(pilotZrszCard, {
  url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/?idp=3503870/#/pdm/3503870',
  reference: 'RH54049',
});
assert.equal(pilotZrsz.id, 'zrsz:RH54049', 'Pilot ZRSZ ohrani registrsko številko kot ID');
assert.equal(pilotZrsz.url, zrszDirectUrl('3503870'), 'Pilot ZRSZ vrne URL točno določenega oglasa');
const zrszOriginal = [
  sameVacancy('zrsz:RH54049', 'ZRSZ / PoiščiDelo', '2026-11-11', { reference: 'RH54049', url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/#/?iskalniTekst=PANVITA' }),
  sameVacancy('zrsz:RH99999', 'ZRSZ / PoiščiDelo', '2026-11-11', { reference: 'RH99999' }),
];
const zrszEnriched = mergeZrszDirectLinks(zrszOriginal, [pilotZrsz]);
assert.equal(zrszEnriched[0].url, zrszDirectUrl('3503870'), 'Neposredni URL popravimo samo ob ujemanju registrske oznake');
assert.equal(zrszEnriched[1].url, zrszOriginal[1].url, 'Nepreverjeni ZRSZ oglasi ohranijo iskalni URL');
assert.equal(zrszEnriched[0].id, zrszOriginal[0].id, 'ZRSZ ohrani isti ID in uporabnikove statuse');
assert.equal(zrszOriginal[0].url.includes('?idp='), false, 'Vhodnih oglasov ne spreminjamo');
const newZrszRecord = { ...pilotZrsz, reference: 'RH97509', id: 'zrsz:RH97509', idp: '3509816', url: zrszDirectUrl('3509816') };
const zrszCombined = supplementZrszPublicDetails(zrszOriginal, [pilotZrsz, newZrszRecord, newZrszRecord]);
assert.equal(zrszCombined.length, 3, 'Manjkajoči preverjeni oglas dodamo samo enkrat');
assert.equal(zrszCombined[2].id, 'zrsz:RH97509', 'Živi ZRSZ oglas ohrani preverjeno registrsko številko');
assert.equal(zrszCombined[2].source, 'ZRSZ / PoiščiDelo', 'Nov oglas je isti vir, ne nov portal');
assert.equal(zrszCombined[2].deadline, '', 'Ne ugibamo prijavnega roka iz javne kartice');
assert.equal(zrszCombined[0].id, zrszOriginal[0].id, 'Z obogatitvijo ne spremenimo obstoječega ID-ja');
assert.equal(supplementZrszPublicDetails(zrszOriginal, [{ ...newZrszRecord, url: 'https://example.org/oglas' }]).length,
  2, 'Oglas z nepreverjenim URL-jem zavrnemo');
assert.throws(() => parseZrszPilotDetail(pilotZrszCard, {
  url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/#/', reference: 'RH54049',
}), /neposredna/, 'Pilot mora zavrniti povezavo, ki odpira samo iskalnik');
assert.throws(() => parseZrszPilotDetail(pilotZrszCard, {
  url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/?idp=3503870/#/pdm/3503871', reference: 'RH54049',
}), /neposredna/, 'Dva različna številčna ID-ja nista preverjena neposredna povezava');

const pilotEuresSummary = parseEuresPilotSummary({
  title: 'TEHNOLOG V PERUTNINSKI PROIZVODNJI - M/Ž',
  company: 'PANVITA, AGROMERKUR d.o.o.', location: 'Slovenia : Mura',
  publication: 'Publication date: 18/11/2026',
  url: 'https://europa.eu/eures/portal/jv-se/jv-details/MzUwMzg3MCAxNA?jvDisplayLanguage=sl',
});
const pilotEures = parseEuresPilotDetail(pilotEuresSummary, {
  title: 'TEHNOLOG V PERUTNINSKI PROIZVODNJI - M/Ž',
  company: 'PANVITA, AGROMERKUR d.o.o.', reference: 'RH54049', deadline: '26/11/2026',
});
assert.equal(pilotEures.date, '2026-11-18');
assert.equal(pilotEures.deadline, '2026-11-26');
assert.equal(pilotEures.zrszIdCandidate, '3503870', 'EURES ID je lahko kandidat za neposredni ZRSZ URL');
assert.ok(!('urlZrsz' in pilotEures), 'Kandidat ni potrjena ZRSZ povezava brez preverjanja na zavodu');
assert.throws(() => parseEuresPilotSummary({ ...pilotEuresSummary, url: 'https://tuj-portal.example/jobs/1' }), /neznana/, 'EURES: izloči tuje URL-je');
assert.equal(careerjetProbeStatus('<html><h1>Zahtevano je preverjanje</h1></html>').status, 'blocked',
  'Careerjetovih zaščit ne zaobidemo');

console.log('OK: filtri, straničenje, dodatni Manpower, ZRSZ JSON in pilotski parserji');

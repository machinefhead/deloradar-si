import { page } from './page.js';
import { getZrszJson } from './zrsz.js';
import { getZrszOfficialHttp } from './zrsz-official-http.js';
import { fetchCareerjetDataApi } from './careerjet-data-api.js';
import { getDm, getNovaPriloznost } from './next-sources.js';
import { getManpower } from './manpower.js';
import { getWhc } from './whc.js';
import { getStudentWork } from './student-work.js';
import { getCompeto } from './competo.js';
import { getCeltra } from './celtra.js';
import { ATS_BOARDS, getPublicAtsBoard } from './public-ats.js';
import { WORKABLE_BOARDS, getPublicWorkableBoard } from './workable.js';
import { SMARTRECRUITERS_BOARDS, getPublicSmartRecruitersBoard } from './smartrecruiters.js';
import { ASHBY_BOARDS, getPublicAshbyBoard } from './ashby.js';
import { getIzs, getHidria, getLthCastings, getTelkom, getPse } from './slovenian-portals.js';
import { LINKEDIN_SOURCE, getLinkedinViaDelovnaMesta } from './linkedin-via-delovnamesta.js';
import { getPublicTrenkwalder } from './trenkwalder-search.js';
import { EMPLOYER_MIRRORS, getEmployerViaDelovnaMesta } from './employers-via-delovnamesta.js';
import { getMerkurRecruitee } from './recruitee.js';
import { markLikelyDuplicates } from './duplicates.js';
import { fetchEuresAdditional, excludeExistingEures, reuseRecentEuresJobs } from './eures-source.js';
import { jobPostingDetails, readableJobText } from './job-details.js';
import { enrichJobsProgressively, parseMojeDeloDetails, parseZaposlitevInfoDetails, parseKarieraDetails, parseOptiusDetails } from './job-enrichment.js';

// Naslov poda ZRSZ in ostane v zaščiteni GitHub Actions skrivnosti.
const ZRSZ_JSON_URL = process.env.ZRSZ_JSON_URL?.trim();
const ZRSZ_OFFICIAL_HTTP_ENABLED = process.env.ZRSZ_OFFICIAL_HTTP_ENABLED === '1';
const EURES_HTTP_ENABLED = process.env.EURES_HTTP_ENABLED === '1';
const CAREERJET_DATA_API_KEY = process.env.CAREERJET_DATA_API_KEY?.trim();

const SOURCES = [
  { id: 'optius', name: 'Optius', url: 'https://www.optius.com/iskalci/prosta-delovna-mesta/' },
  { id: 'kariera', name: 'Kariera.si', url: 'https://www.kariera.si/sl/delovna-mesta' },
  { id: 'govsi', name: 'GOV.SI', url: 'https://www.gov.si/zbirke/delovna-mesta/' },
  { id: 'atama', name: 'Atama', url: 'https://atama.si/za-iskalce/aktualna-ponudba-dela' },
  { id: 'trenkwalder', name: 'Trenkwalder', url: 'https://si.trenkwalder.com/jobs' },
  { id: 'agado', name: 'Agado', url: 'https://www.agado.si/iskalci/69/prosta-delovna-mesta' },
  { id: 'adecco', name: 'Adecco', url: 'https://www.adecco.com/sl-si/prosta-delovna-mesta' },
  { id: 'rekruter', name: 'Rekruter', url: 'https://zaposlitev.rekruter.si/jobs' },
  { id: 'nove', name: 'Nove zaposlitve', url: 'https://novezaposlitve.si/' },
  { id: 'lidl', name: 'Lidl Slovenija', url: 'https://kariera.lidl.si/' },
  { id: 'kolektor', name: 'Kolektor', url: 'https://www.kolektor.com/kariera' },
  { id: 'mojedelo', name: 'MojeDelo.com', url: 'https://www.mojedelo.com/iskanje-zaposlitve' },
  { id: 'zaposlitevinfo', name: 'Zaposlitev.info', url: 'https://zaposlitev.info/prosta-delovna-mesta/' },
  { id: 'mercator', name: 'Mercator', url: 'https://www.mercatorgroup.si/sl/kariera/prosta-delovna-mesta/seznam-prostih-delovnih-mest/' },
  { id: 'iscidelo', name: 'IščiDelo', url: 'https://iscidelo.com/delovna-mesta/' },
  ...(ZRSZ_JSON_URL || ZRSZ_OFFICIAL_HTTP_ENABLED ? [{ id: 'zrsz', name: 'ZRSZ / PoiščiDelo', url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/' }] : []),
  { id: 'dm', name: 'dm Slovenija', url: 'https://www.dm-jobs.si/job-listing/' },
  { id: 'novapriloznost', name: 'Nova Priložnost', url: 'https://novapriloznost.si/prosta-delovna-mesta/' },
  { id: 'manpower', name: 'Manpower Slovenija', url: 'https://www.manpower.si/sl/delovna-mesta' },
  { id: 'whc', name: 'WHC Slovenija', url: 'https://whc-slovenia.com/workforce/jobs' },
  { id: 'studentski', name: 'e-Študentski Servis (študentsko delo)', url: 'https://www.studentski-servis.com/studenti/prosta-dela' },
  { id: 'competo', name: 'Competo', url: 'https://portal.digi.competo.si/jobs' },
  { id: 'celtra', name: 'Celtra', url: 'https://celtra.hire.trakstar.com/' },
  { id: 'izs', name: 'IZS – Borza dela', url: 'https://www.izs.si/borza-dela/prosta-delovna-mesta/' },
  { id: 'hidria', name: 'Hidria', url: 'https://www.hidria.com/int/sl/zaposlitev/prosta-delovna-mesta/' },
  { id: 'lth', name: 'LTH Castings', url: 'https://www.lthcastings.com/sl/kariera/prosta-delovna-mesta' },
  { id: 'telkom', name: 'Telkom d.o.o.', url: 'https://www.telkom.si/kariera/' },
  { id: 'pse', name: 'PSE d.o.o.', url: 'https://www.pse.si/sl/zaposlitve/' },
  { id: 'linkedin', name: LINKEDIN_SOURCE, url: 'https://www.linkedin.com/jobs/' },
  ...EMPLOYER_MIRRORS.map(item => ({ id: 'mirror_' + item.id, name: item.name, url: item.url })),
  { id: 'recruitee_merkur', name: 'Merkur zavarovalnica', url: 'https://merkurzavarovalnica.recruitee.com/' },
  ...ATS_BOARDS.map(board => ({ id: 'ats_' + board.id, name: board.name, url: board.url })),
  ...WORKABLE_BOARDS.map(board => ({ id: 'workable_' + board.id, name: board.name, url: board.url })),
  ...SMARTRECRUITERS_BOARDS.map(board => ({ id: 'smart_' + board.id, name: board.name, url: board.url })),
  ...ASHBY_BOARDS.map(board => ({ id: 'ashby_' + board.id, name: board.name, url: board.url })),
  ...(CAREERJET_DATA_API_KEY ? [{ id: 'careerjet', name: 'Careerjet', url: 'https://www.careerjet.si/' }] : []),
  ...(EURES_HTTP_ENABLED ? [{ id: 'eures', name: 'EURES', url: 'https://europa.eu/eures/portal/jv-se/search?locationCodes=si&lang=sl' }] : []),
];
const PLANNED = [
  // Samo kandidati, pri katerih je smiselno nadaljevati raziskavo uvoza.
  // Že povezani, pretežno podvojeni in trenutno nerelevantni viri niso javni backlog.
  ...(!ZRSZ_JSON_URL && !ZRSZ_OFFICIAL_HTTP_ENABLED ? [{ name: 'ZRSZ / PoiščiDelo', href: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/', priority: 1, status: 'Pripravljen HTTP uvoz', note: 'V produkciji je vključen z ZRSZ_OFFICIAL_HTTP_ENABLED=1; tu manjka nastavitev.' }] : []),
  ...(!EURES_HTTP_ENABLED ? [{ name: 'EURES (Slovenija)', href: 'https://europa.eu/eures/portal/jv-se/search?locationCodes=si&lang=sl', priority: 1, status: 'Pripravljen HTTP uvoz', note: 'V produkciji je vključen z EURES_HTTP_ENABLED=1; tu manjka nastavitev.' }] : []),
  { name: 'HOFER Slovenija', href: 'https://kariera.hofer.si/iskanje-zaposlitve', priority: 1, status: 'JSON najden', note: 'Javni REST za iskanje zaposlitve je dosegljiv, a je ob preverjanju vrnil prazen seznam. Preveriti parametre in objave.' },
  { name: 'SPAR Slovenija', href: 'https://www.spar.si/zaposlitev-spar', priority: 1, status: 'GitHub Actions HTTP 403', note: 'Z lokalnimi neposrednimi HTTP zahtevki je bilo potrjenih 58 aktivnih izvirnih razpisov s polnimi opisi. V GitHub Actions uradni SPAR odgovori vrnejo HTTP 403, zato uvoz source/spar.js ostane pripravljen, vendar ga ne prištevamo med redno povezane vire, dokler ne dobimo normalnega strojno berljivega izvoza.' },
  { name: 'Petrol', href: 'https://www.petrol.eu/sl/kariera/prosta-delovna-mesta', priority: 2, status: 'Preusmeritve izvirnih povezav', note: 'Deset izvirnih oglasov ima javne podatke JobPosting, vendar izvorni Petrolovi URL-ji trenutno preusmerijo na nedosegljivo HTTP različico. Ne objavljamo pokvarjenih povezav.' },
  { name: 'Zaposlitev.net', href: 'https://www.zaposlitev.net/', priority: 2, status: 'Ponovni poskus', note: 'Ob zadnjem neposrednem preverjanju je portal vrnil HTTP 503.' },
  ...(!CAREERJET_DATA_API_KEY ? [{ name: 'Careerjet', href: 'https://www.careerjet.si/', priority: 3, status: 'Agregator', note: 'Večinoma povezuje druge vire. Raziskati ustrezen izvoz in preveriti, ali prinaša unikatne oglase.' }] : []),
  { name: 'Krka', href: 'https://www.krka.biz/employment/prosta-delovna-mesta/', priority: 2, status: 'ATS brez odprtega seznama', note: 'Stran vodi na Cornerstone OnDemand; preveriti uraden strojno berljiv izvoz razpisov.' },
  { name: 'Iskra', href: 'https://www.iskra.eu/sl/Prosta-delovna-mesta/', priority: 2, status: 'HTTP ni dosegljiv', note: 'Javna podstran ima neposredne oglase, pri avtomatskem HTTP preverjanju pa je povezava časovno potekla.' },
  { name: 'OTP banka', href: 'https://www.otpbanka.si/kariera', priority: 2, status: 'Nedokončana preusmeritev', note: 'Devet izvirnih povezav na FledgeHR je prepoznanih, vendar uradni HTTP za sezname in posamezne oglase trenutno vrača preusmeritev na isto pot. Nadaljujemo šele z delujočimi povezavami.' },
];
// Uradni regionalni RSS-viri Optius. Ohranimo izvirni izvor regije,
// saj posamezni RSS-oglas ne navaja kraja in je lahko v več regijah.
const OPTIUS_REGIONS = [
  ['1', 'Gorenjska'], ['2', 'Goriška'], ['3', 'Jugovzhodna Slovenija'],
  ['4', 'Koroška'], ['5', 'Primorsko-notranjska'], ['6', 'Obalno-kraška'],
  ['7', 'Osrednjeslovenska'], ['8', 'Podravska'], ['9', 'Pomurska'],
  ['10', 'Savinjska'], ['11', 'Posavska'], ['12', 'Zasavska'],
];
let cached = null;
let cachedAt = 0;
const CACHE_MS = 15 * 60 * 1000;
const DETAIL_CACHE_URL = 'https://machinefhead.github.io/deloradar-si/jobs.json';
let previousSnapshotPromise;
async function previousSnapshot() {
  if (!previousSnapshotPromise) previousSnapshotPromise = (async () => {
    try {
      const response = await fetch(DETAIL_CACHE_URL, { signal: AbortSignal.timeout(20000), headers: { accept: 'application/json' } });
      if (!response.ok || Number(response.headers.get('content-length')) > 35_000_000) return {};
      const snapshot = await response.json();
      return Array.isArray(snapshot?.jobs) ? snapshot : {};
    } catch (error) {
      console.warn('DeloRadar: predhodni opisi začasno niso dosegljivi: ' + String(error?.message || error));
      return {};
    }
  })();
  return previousSnapshotPromise;
}
async function previousJobs() {
  return (await previousSnapshot()).jobs || [];
}
function detailLimit(name, fallback) {
  const candidate = Number(process.env[name]);
  return Number.isInteger(candidate) && candidate >= 0 && candidate <= 500 ? candidate : fallback;
}
function decode(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function plain(value = '') {
  return decode(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function xml(block, tag) {
  const found = block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return found ? plain(found[1]) : '';
}
function parseLocalDate(s) {
  const found = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  return found ? found[3] + '-' + found[2].padStart(2, '0') + '-' + found[1].padStart(2, '0') : '';
}
async function getText(url, headers = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12500),
    headers: { 'user-agent': 'DeloRadar/0.1 (personal job listing index)', accept: 'text/html,application/rss+xml,application/xml;q=0.9', ...headers },
  });
  if (!response.ok) throw Error('HTTP ' + response.status);
  const content = await response.text();
  if (content.length > 3_000_000) throw Error('Response too large');
  return content;
}
export function parseOptiusFeed(feed) {
  if (!feed.includes('<rss')) throw Error('RSS unavailable');
  const jobs = [];
  for (const match of feed.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const url = xml(block, 'link');
    const title = xml(block, 'title');
    if (!url.startsWith('https://www.optius.com/') || !title) continue;
    const parsed = Date.parse(xml(block, 'pubDate'));
    jobs.push({ id: 'optius:' + url, source: 'Optius', title, company: xml(block, 'employer'),
      location: '', date: Number.isFinite(parsed) ? new Date(parsed).toISOString() : '',
      deadline: xml(block, 'validTill'), url,
      ...(xml(block, 'description') ? { summary: xml(block, 'description') } : {}) });
  }
  return jobs;
}
async function getOptius() {
  const jobsByUrl = new Map();
  let successful = 0;
  // Omejimo sočasne zahtevke, da ne obremenimo vira ob polurnem zajemu.
  for (let start = 0; start < OPTIUS_REGIONS.length; start += 3) {
    const batch = OPTIUS_REGIONS.slice(start, start + 3);
    const results = await Promise.allSettled(batch.map(([id]) =>
      getText('https://www.optius.com/rss/?podrocje=&regija=' + id).then(parseOptiusFeed)));
    results.forEach((result, i) => {
      if (result.status !== 'fulfilled') return;
      successful++;
      const region = batch[i][1];
      for (const job of result.value) {
        if (jobsByUrl.has(job.url)) {
          const existing = jobsByUrl.get(job.url);
          if (!existing.regions.includes(region)) existing.regions.push(region);
        } else jobsByUrl.set(job.url, { ...job, regions: [region] });
      }
    });
  }
  if (!successful) throw Error('All Optius regional RSS feeds failed');
  return enrichJobsProgressively([...jobsByUrl.values()], await previousJobs(), {
    name: 'Optius', limit: detailLimit('DETAIL_OPTIUS_LIMIT', 12), concurrency: 2,
    getDetails: job => getText(job.url), parseDetails: parseOptiusDetails,
  });
}
async function getKariera() {
  const html = await getText('https://www.kariera.si/sl/delovna-mesta');
  const jobs = [];
  for (const match of html.matchAll(/<a\s+href=["'](\/sl\/delovno-mesto\/[^"']+)["'][^>]*class=["'][^"']*\bjob-card\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const body = match[2];
    const titleMatch = body.match(/<h4[^>]*class=["'][^"']*jobitem-name[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i);
    if (!titleMatch) continue;
    const meta = body.match(/<ul[^>]*class=["'][^"']*jobitem-meta[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || '';
    const li = Array.from(meta.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(x => plain(x[1]));
    const location = li.find(x => x !== li[0] && !/sproščena|bonus|plača|regres/i.test(x)) || '';
    const deadline = body.match(/Rok prijave<\/span>\s*<div[^>]*>([^<]+)<\/div>/i);
    jobs.push({ id: 'kariera:' + match[1], source: 'Kariera.si', title: plain(titleMatch[1]),
      company: '', location, date: parseLocalDate(li[0] || ''),
      deadline: parseLocalDate(deadline?.[1] || ''), url: 'https://www.kariera.si' + match[1] });
  }
  if (!jobs.length) throw Error('Unexpected listing format');
  return enrichJobsProgressively(jobs, await previousJobs(), {
    name: 'Kariera.si', limit: detailLimit('DETAIL_KARIERA_LIMIT', 30), concurrency: 3,
    getDetails: job => getText(job.url), parseDetails: parseKarieraDetails,
  });
}
export function parseGovListings(html) {
  // GOV.SI v HTML-ju zapira <tbody> po vsaki vrstici; zato razčlenimo celotno tabelo.
  const table = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw Error('GOV.SI listings table not found');
  const jobs = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from(row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), m => m[1]);
    if (cells.length < 8) continue;
    if (!/^v teku$/i.test(plain(cells[7]))) continue;
    const link = cells[0].match(/<a\b[^>]*href=["'](\/zbirke\/delovna-mesta\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const title = plain(link[2]);
    if (!title) continue;
    const url = new URL(link[1], 'https://www.gov.si').href;
    jobs.push({ id: 'govsi:' + link[1], source: 'GOV.SI', title,
      company: plain(cells[3]), location: '', date: parseLocalDate(plain(cells[1])),
      deadline: parseLocalDate(plain(cells[2])), url,
      contractType: plain(cells[5]), workHours: plain(cells[6]),
      jobCategory: plain(cells[4]) });
  }
  return jobs;
}
async function getGov() {
  const jobs = [];
  for (let page = 0; page < 8; page++) {
    const url = `https://www.gov.si/zbirke/delovna-mesta/?nrOfItems=100&status=ongoing&start=${page * 100}`;
    const found = parseGovListings(await getText(url));
    if (page === 0 && found.length === 0) throw Error('GOV.SI returned no current jobs');
    jobs.push(...found);
    if (found.length < 100) break;
  }
  return jobs;
}
export function parseAtamaListings(html) {
  const jobs = [];
  for (const item of html.matchAll(/<div\s+class=["']pos_novica_ps_spisek["']>([\s\S]*?)<div\s+class=["']clear["']><\/div>\s*<\/div>/gi)) {
    const title = plain(item[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '');
    const link = item[1].match(/<a\s+href=["'](S2210\/D\d+\/[^"']+)["'][^>]*>/i)?.[1];
    if (!title || !link) continue;
    const url = new URL(link, 'https://atama.si/').href;
    jobs.push({ id: 'atama:' + url, source: 'Atama', title, company: '',
      location: '', date: '', deadline: '', url });
  }
  return jobs;
}
async function getAtama() {
  const url = 'https://atama.si/S2200/Ponudba+dela.';
  let html;
  try {
    html = await getText(url);
  } catch (error) {
    // Portal občasno prekine en sam zahtevek, čeprav je javni seznam dosegljiv.
    // En omejen ponovni poskus prepreči izgubo vira v polnem periodičnem zajemu.
    if (!/timed?\s*out|timeout|aborted|fetch failed/i.test(String(error?.message || error))) throw error;
    await new Promise(resolve => setTimeout(resolve, 500));
    html = await getText(url);
  }
  const jobs = parseAtamaListings(html);
  if (!jobs.length) throw Error('Unexpected Atama listing format');
  return jobs;
}
export function parseTrenkwalderListings(html) {
  const jobs = [];
  // Strežnik javno izriše prvo stran (do 30). Njihov /api/* je izključen
  // v robots.txt, zato ne uporabljamo skritih internih API-jev.
  for (const match of html.matchAll(/<h3\b[^>]*class=["'][^"']*subtitle_highlight[^"']*["'][^>]*>([\s\S]*?)<\/h3>/gi)) {
    const title = plain(match[1]);
    const url = match[1].match(/<a\s+href=["'](https:\/\/si\.trenkwalder\.com\/jobs\/a0t[a-zA-Z0-9]+)["']/i)?.[1];
    if (!title || !url) continue;
    const before = html.slice(Math.max(0, match.index - 2800), match.index);
    const dateParts = Array.from(before.matchAll(/<span class=["']micro_highlight text-gray-40 mr-auto["']>(\d{4})\.(\d{2})\.(\d{2})<\/span>/gi)).at(-1);
    const after = html.slice(match.index + match[0].length, match.index + match[0].length + 1700);
    const location = plain(after.match(/<p class=["']micro_highlight truncate leading-5["']>([^<]+)<\/p>/i)?.[1] || '');
    // Tuja prosta mesta ne sodijo v zbirko za Slovenijo.
    if (/(?:nemčij|avstrij|kassel|hrvašk)/i.test(title + ' ' + location)) continue;
    jobs.push({ id: 'trenkwalder:' + url, source: 'Trenkwalder', title, company: '', location,
      date: dateParts ? dateParts[1] + '-' + dateParts[2] + '-' + dateParts[3] : '',
      deadline: '', url });
  }
  return jobs;
}
async function getTrenkwalder() {
  const jobs = parseTrenkwalderListings(await getText('https://si.trenkwalder.com/jobs'));
  if (!jobs.length) throw Error('Unexpected Trenkwalder listing format');
  return jobs;
}
export function parseAgadoListings(html) {
  const jobs = [];
  const cards = [...html.matchAll(/<div\s+class=["']single_job_student["'][^>]*>/gi)];
  for (let i = 0; i < cards.length; i++) {
    const card = html.slice(cards[i].index, cards[i + 1]?.index || Math.min(cards[i].index + 3500, html.length));
    const link = card.match(/<a\b[^>]*href=["'](https:\/\/www\.agado\.si\/iskalci\/69\/vsa-prosta-delovna-mesta\/j(\d+)\/[^"']+)["']/i);
    const title = plain(card.match(/<div\s+class=["']job_title["'][^>]*>[\s\S]*?<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1] || '');
    if (!link || !title || /vpis v bazo iskalcev/i.test(title)) continue;
    const dateText = card.match(/<div\s+class=["']job_date["'][^>]*>\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i)?.[1] || '';
    const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    const year = dateMatch ? (dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]) : '';
    const date = dateMatch ? year + '-' + dateMatch[2].padStart(2, '0') + '-' + dateMatch[1].padStart(2, '0') : '';
    const locationHtml = card.match(/<mark\b[^>]*>\s*Lokacija:\s*<\/mark>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '';
    const location = plain(locationHtml.split(/<br\b/i)[0]);
    // Portal oglašuje tudi delo v tujini; DeloRadar prikazuje le Slovenijo.
    if (/(?:avstrij|nemčij|steiermark|oberosterreich|oberoesterreich|österreich|graz|wien|linz|kassel)/i.test(title + ' ' + locationHtml)) continue;
    jobs.push({ id: 'agado:' + link[2], source: 'Agado', title, company: '', location,
      date, deadline: '', url: link[1],
      jobCategory: plain(card.match(/<mark\b[^>]*>\s*Vrsta dela\s*<\/mark>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '') });
  }
  return Array.from(new Map(jobs.map(j => [j.id, j])).values());
}
async function getAgado() {
  const url = 'https://www.agado.si/iskalci/69/prosta-delovna-mesta';
  let html;
  try {
    html = await getText(url);
  } catch (error) {
    // HTTP 500 je prehodna napaka izvornega strežnika. Brez obhajanja blokad
    // ponovimo le en zahtevek; če znova odpove, objavo ustavi nadzor virov.
    if (!/^(?:HTTP 5\d\d|.*(?:timeout|aborted|fetch failed))$/i.test(String(error?.message || error))) throw error;
    await new Promise(resolve => setTimeout(resolve, 500));
    html = await getText(url);
  }
  const jobs = parseAgadoListings(html);
  if (!jobs.length) throw Error('Unexpected Agado listing format');
  return jobs;
}
export function parseAdeccoSitemap(xmlText) {
  if (!/<urlset\b/i.test(xmlText)) throw Error('Unexpected Adecco sitemap format');
  const listings = [];
  for (const match of xmlText.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const url = xml(match[1], 'loc');
    const id = url.match(/^https:\/\/www\.adecco\.com\/sl-si\/prosta-delovna-mesta\/[^/?#]+\/(jn-\d{6}-\d+)\/?$/i)?.[1];
    if (id) listings.push({ id: 'adecco:' + id.toLowerCase(), url });
  }
  return Array.from(new Map(listings.map(item => [item.id, item])).values());
}
export function parseAdeccoJobPreview(html, listing, now = Date.now()) {
  const raw = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (Array.isArray(data)) data = data.find(item => item['@type'] === 'JobPosting');
  if (!data || data['@type'] !== 'JobPosting') return null;
  const address = data.jobLocation?.address || {};
  const country = address.addressCountry?.name || address.addressCountry || '';
  if (country && !/^(SI|Slovenia|Slovenija)$/i.test(String(country))) return null;
  const title = plain(data.title || '');
  if (!title) return null;
  const due = Date.parse(String(data.validThrough || '').trim());
  if (Number.isFinite(due) && due < now) return null;
  const published = Date.parse(data.datePosted || '');
  return { id: listing.id, source: 'Adecco', title, company: '',
    location: plain(address.addressLocality || address.location || ''),
    date: Number.isFinite(published) ? new Date(published).toISOString() : '',
    deadline: Number.isFinite(due) ? new Date(due).toISOString() : '', url: listing.url,
    ...jobPostingDetails(data) };
}
async function getAdeccoPreview(listing) {
  // Javni, v robots.txt dovoljeni URL-ji in samo začetek HTML-ja.
  // Adecco podpira HTTP Range; 30 KB vsebuje strukturirane podatke JobPosting.
  const response = await fetch(listing.url, { signal: AbortSignal.timeout(12500),
    headers: { range: 'bytes=0-29999', 'user-agent': 'DeloRadar/0.1 (personal job listing index)', accept: 'text/html' } });
  // Sitemap občasno še navaja oglase, ki so že umaknjeni (HTTP 410).
  // To ni izpad vira in jih ne poskušamo prikazovati kot aktualne.
  if (response.status === 404 || response.status === 410) return null;
  if (response.status !== 206) throw Error('Adecco did not honor a small range request');
  return parseAdeccoJobPreview(await response.text(), listing);
}
function adeccoRefreshBucket(id, days) {
  let hash = 5381;
  for (const character of id) hash = (Math.imul(hash, 33) + character.charCodeAt(0)) >>> 0;
  return hash % days;
}
export function planAdeccoIncremental(listings, previousJobs, now = Date.now()) {
  const cachedById = new Map(previousJobs.filter(job => job?.source === 'Adecco').map(job => [job.id, job]));
  const cached = new Map();
  const requests = [];
  const refreshDays = 14;
  const todayBucket = Math.floor(now / 86400000) % refreshDays;
  for (const listing of listings) {
    const old = cachedById.get(listing.id);
    const expired = old?.deadline && Number.isFinite(Date.parse(old.deadline)) && Date.parse(old.deadline) < now;
    const valid = old?.url === listing.url && old?.title && !expired;
    if (valid) cached.set(listing.id, old);
    const lastFetch = Date.parse(old?.detailsFetchedAt || '');
    const refreshDue = adeccoRefreshBucket(listing.id, refreshDays) === todayBucket &&
      (!Number.isFinite(lastFetch) || now - lastFetch >= 7 * 86400000);
    if (!valid || refreshDue) requests.push(listing);
  }
  return { cached, requests };
}
async function getAdecco() {
  const listings = parseAdeccoSitemap(await getText('https://www.adecco.com/sitemap-jobs-slovenia-sl.xml'));
  if (!listings.length) throw Error('Adecco sitemap has no job listings');
  const { cached, requests } = planAdeccoIncremental(listings, await previousJobs());
  let refreshed = 0, skipped = 0, failed = 0;
  for (let start = 0; start < requests.length; start += 6) {
    const batch = await Promise.allSettled(requests.slice(start, start + 6).map(getAdeccoPreview));
    for (let i = 0; i < batch.length; i++) {
      const result = batch[i];
      if (result.status === 'fulfilled' && result.value) {
        cached.set(requests[start + i].id, { ...result.value, detailsFetchedAt: new Date().toISOString() });
        refreshed++;
      } else if (result.status === 'fulfilled') skipped++;
      else failed++;
    }
    if (start + 6 < requests.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  const jobs = listings.map(listing => cached.get(listing.id)).filter(Boolean);
  console.log(`DeloRadar: Adecco ${refreshed} osveženih, ${jobs.length - refreshed} iz predpomnilnika, ${skipped} umaknjenih/neveljavnih, ${failed} napak; ${listings.length} povezav v sitemapu.`);
  if (!jobs.length) throw Error('Adecco details unavailable');
  return jobs;
}
export function parseRekruterFeed(feed) {
  if (!/<rss\b/i.test(feed)) throw Error('Unexpected Rekruter RSS format');
  const jobs = [];
  for (const match of feed.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1], url = xml(block, 'link'), title = xml(block, 'title');
    const id = url.match(/^https:\/\/zaposlitev\.rekruter\.si\/jobs\/(\d+)-[^/?#]+\/?$/)?.[1];
    if (!id || !title) continue;
    const locations = Array.from(block.matchAll(/<tt:location\b[^>]*>([\s\S]*?)<\/tt:location>/gi))
      .map(m => m[1]).filter(m => /^(SI|Slovenia|Slovenija)$/i.test(xml(m, 'tt:country')));
    if (!locations.length) continue;
    const city = xml(locations[0], 'tt:city') || xml(locations[0], 'tt:name');
    const posted = Date.parse(xml(block, 'pubDate'));
    jobs.push({ id: 'rekruter:' + id, source: 'Rekruter', title, company: '', location: city,
      date: Number.isFinite(posted) ? new Date(posted).toISOString() : '', deadline: '', url,
      ...(xml(block, 'description') ? { summary: xml(block, 'description') } : {}) });
  }
  return Array.from(new Map(jobs.map(j => [j.id, j])).values());
}
async function getRekruter() {
  const jobs = parseRekruterFeed(await getText('https://zaposlitev.rekruter.si/jobs.rss'));
  if (!jobs.length) throw Error('Rekruter RSS has no Slovenian jobs');
  return jobs;
}
export function parseNoveSitemap(xmlText) {
  if (!/<urlset\b/i.test(xmlText)) throw Error('Unexpected Nove zaposlitve sitemap');
  const listings = [];
  for (const match of xmlText.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const url = xml(match[1], 'loc');
    const slug = url.match(/^https:\/\/novezaposlitve\.si\/razisci\/delovna-mesta\/([a-z0-9-]+)\/?$/i)?.[1];
    if (slug) listings.push({ id: 'nove:' + slug.toLowerCase(), url });
  }
  return Array.from(new Map(listings.map(item => [item.id, item])).values());
}
function slDate(value) {
  const months = ['januarja','februarja','marca','aprila','maja','junija','julija','avgusta','septembra','oktobra','novembra','decembra'];
  const m = plain(value).toLocaleLowerCase('sl').match(/(\d{1,2})\.?\s+([a-zčšž]+),?\s+(\d{4})/i);
  if (!m) return '';
  const month = months.indexOf(m[2]) + 1;
  return month ? m[3] + '-' + String(month).padStart(2,'0') + '-' + m[1].padStart(2,'0') : '';
}
export function parseNoveJob(html, listing, now = Date.now()) {
  const title = plain(html.match(/<h1\b[^>]*class=["'][^"']*\bcase27-primary-text\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  if (!title) return null;
  const fields = new Map(Array.from(html.matchAll(/<li>\s*<div class="item-attr">([\s\S]*?)<\/div>\s*<div class="item-property">([\s\S]*?)<\/div>\s*<\/li>/gi))
    .map(m => [plain(m[1]), plain(m[2])]));
  const deadline = slDate(html.match(/<div class="lmb-label">\s*Prijave do:\s*<\/div>\s*<div class="value">([\s\S]*?)<\/div>/i)?.[1] || '');
  if (deadline && Date.parse(deadline + 'T23:59:59Z') < now) return null;
  return { id: listing.id, source: 'Nove zaposlitve', title,
    company: fields.get('Podjetje') || '', location: fields.get('Kraj dela') || '',
    date: slDate(fields.get('Datum objave') || ''), deadline, url: listing.url,
    ...(fields.get('Vrsta zaposlitve') ? { employmentType: fields.get('Vrsta zaposlitve') } : {}),
    ...(fields.get('Delovni čas') ? { workHours: fields.get('Delovni čas') } : {}),
    ...(fields.get('Trajanje zaposlitve') ? { contractDuration: fields.get('Trajanje zaposlitve') } : {}),
    ...(fields.get('Izobrazba') ? { education: fields.get('Izobrazba') } : {}),
    ...(fields.get('Plačilo') ? { salary: readableJobText(fields.get('Plačilo')) } : {}) };
}
async function getNove() {
  const listings = parseNoveSitemap(await getText('https://novezaposlitve.si/wp-sitemap-posts-job_listing-1.xml'));
  if (!listings.length) throw Error('Nove zaposlitve sitemap has no jobs');
  const results = await Promise.allSettled(listings.map(async listing => parseNoveJob(await getText(listing.url), listing)));
  const jobs = results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);
  if (!results.some(r => r.status === 'fulfilled')) throw Error('Nove zaposlitve pages unavailable');
  return jobs;
}
export function parseLidlSitemap(xmlText) {
  if (!/<urlset\b/i.test(xmlText)) throw Error('Unexpected Lidl jobs sitemap');
  const listings = [];
  for (const match of xmlText.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const url = xml(match[1], 'loc');
    const id = url.match(/^https:\/\/kariera\.lidl\.si\/jobs\/[a-z0-9-]+-(\d+)\/?$/i)?.[1];
    if (id) listings.push({ id: 'lidl:' + id, url });
  }
  return Array.from(new Map(listings.map(item => [item.id, item])).values()).slice(0, 200);
}
export function parseLidlJob(html, listing, now = Date.now()) {
  const blocks = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  let data;
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]);
      const candidates = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      data = candidates.find(item => item && (item['@type'] === 'JobPosting' || item['@type']?.includes?.('JobPosting')));
      if (data) break;
    } catch { /* Neveljavno strukturirano polje ignoriramo. */ }
  }
  if (!data) return null;
  const address = (Array.isArray(data.jobLocation) ? data.jobLocation[0] : data.jobLocation)?.address || {};
  const country = address.addressCountry?.name || address.addressCountry || '';
  if (!/^(SI|Slovenia|Slovenija)$/i.test(String(country))) return null;
  const title = plain(data.title || '');
  if (!title) return null;
  const expiry = Date.parse(data.validThrough || '');
  if (Number.isFinite(expiry) && expiry < now) return null;
  const posted = Date.parse(data.datePosted || '');
  return { id: listing.id, source: 'Lidl Slovenija', title, company: 'Lidl Slovenija',
    location: plain(address.addressLocality || ''),
    date: Number.isFinite(posted) ? new Date(posted).toISOString() : '',
    deadline: Number.isFinite(expiry) ? new Date(expiry).toISOString() : '', url: listing.url,
    ...jobPostingDetails(data) };
}
async function getLidl() {
  const listings = parseLidlSitemap(await getText('https://kariera.lidl.si/sitemap-jobs.xml'));
  if (!listings.length) throw Error('Lidl sitemap has no job listings');
  const jobs = [];
  for (let start = 0; start < listings.length; start += 5) {
    const batch = await Promise.allSettled(listings.slice(start, start + 5).map(async listing =>
      parseLidlJob(await getText(listing.url), listing)));
    for (const result of batch) if (result.status === 'fulfilled' && result.value) jobs.push(result.value);
    if (start + 5 < listings.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!jobs.length) throw Error('Lidl job details unavailable');
  return jobs;
}
export function parseKolektorListings(html, now = Date.now()) {
  const table = html.match(/<table\b[^>]*class=["'][^"']*\blist\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw Error('Kolektor vacancies table missing');
  const jobs = [];
  for (const row of table.matchAll(/<tr\b[^>]*class=["'][^"']*\bitem\b[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from(row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), m => m[1]);
    if (cells.length !== 4) continue;
    const link = cells[1].match(/<a\b[^>]*href=["'](\/sl\/o-nas\/kadri-in-izobrazevanje\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const title = plain(link[2]), location = plain(cells[2]);
    if (!title || (/(BIH|Bosna|Srbija|Hrvaška|Klašnice)/i.test(location) && !/Slovenij/i.test(location))) continue;
    const deadline = parseLocalDate(plain(cells[3]));
    if (deadline && Date.parse(deadline + 'T23:59:59Z') < now) continue;
    const url = new URL(link[1], 'https://www.kolektor.com').href;
    jobs.push({ id: 'kolektor:' + link[1], source: 'Kolektor', title, company: 'Kolektor',
      location, date: '', deadline, url });
  }
  return Array.from(new Map(jobs.map(j => [j.id, j])).values());
}
async function getKolektor() {
  const jobs = parseKolektorListings(await getText('https://www.kolektor.com/kariera'));
  if (!jobs.length) throw Error('Kolektor has no active jobs in table');
  return jobs;
}
export function parseMojeDeloConfig(script) {
  const match = script.match(/^\s*window\.globalsConfig\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!match) throw Error('MojeDelo public configuration missing');
  const config = JSON.parse(match[1]).appConfig;
  if (!config?.tenantId || !config?.jbChannelId || !config?.defaultLanguageId) throw Error('MojeDelo configuration incomplete');
  return { tenantId: config.tenantId, channelId: config.jbChannelId, languageId: config.defaultLanguageId };
}
function mojeDeloSlug(title) {
  return plain(title).toLocaleLowerCase('sl').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/\b([mz])\/([mz])\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function parseMojeDeloJobs(response) {
  if (!Array.isArray(response?.data?.items) || !Number.isInteger(response?.data?.total)) throw Error('MojeDelo unexpected response');
  return response.data.items.flatMap(item => {
    if (!item?.id || !plain(item.title) || item.country?.countryCode !== 'SI') return [];
    const published = Date.parse(item.repostingDate || item.startDate || '');
    const regions = (item.regions || []).map(r => plain(r.translation || r.name || '')).filter(Boolean);
    const town = plain(item.town?.translation || item.town?.name || item.jobLocationInput || '');
    // Država SI v osnovnem iskalniku ni vedno enaka dejanskemu kraju dela.
    if (/\b(?:Graz|Bad Radkersburg|Wien|Vienna|Stuttgart|München|Munich)\b/i.test(town) &&
        !/\b(?:Slovenija|Slovenia)\b/i.test(town)) return [];
    return [{ id: 'mojedelo:' + item.id, source: 'MojeDelo.com', title: plain(item.title),
      company: plain(item.company?.name || (item.anonymizedCompany ? 'Nerazkrito podjetje' : '')),
      location: town, regions,
      date: Number.isFinite(published) ? new Date(published).toISOString() : '', deadline: '',
      // Neposredna stran oglasa uporablja naslovni del in javni UUID iz seznama.
      url: 'https://www.mojedelo.com/oglas/' + mojeDeloSlug(item.title) + '/' + encodeURIComponent(item.id),
      ...jobPostingDetails(item) }];
  });
}
async function getMojeDelo() {
  const config = parseMojeDeloConfig(await getText('https://api.mojedelo.com/uploaded-files/config/www.mojedelo.com/jb.globals.js'));
  const headers = { ...config, accept: 'application/json' };
  const api = 'https://api.mojedelo.com/job-ads-search?';
  const first = JSON.parse(await getText(api + 'pageSize=100&startFrom=0', headers));
  const jobs = parseMojeDeloJobs(first);
  const total = Math.min(first.data.total, 10_000);
  if (total === 0 || jobs.length === 0) throw Error('MojeDelo has no Slovenian job ads');
  const failed = [];
  for (let start = 100; start < total; start += 400) {
    const offsets = Array.from({ length: Math.min(4, Math.ceil((total - start) / 100)) }, (_, i) => start + i * 100);
    const results = await Promise.allSettled(offsets.map(async offset =>
      parseMojeDeloJobs(JSON.parse(await getText(api + `pageSize=100&startFrom=${offset}`, headers)))));
    results.forEach((result, i) => result.status === 'fulfilled' ? jobs.push(...result.value) : failed.push(offsets[i]));
    if (start + 400 < total) await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (failed.length) throw Error('MojeDelo missing pages at offsets ' + failed.join(', '));
  const unique = Array.from(new Map(jobs.map(job => [job.id, job])).values());
  return enrichJobsProgressively(unique, await previousJobs(), {
    name: 'MojeDelo.com', limit: detailLimit('DETAIL_MOJEDELO_LIMIT', 280), concurrency: 4,
    getDetails: async job => JSON.parse(await getText('https://api.mojedelo.com/job-ads/' + encodeURIComponent(job.id.slice('mojedelo:'.length)), headers)),
    parseDetails: parseMojeDeloDetails,
  });
}
export function parseZaposlitevInfoListings(html, now = Date.now()) {
  if (!/<div\s+class=["']wpjb-job-list\b/i.test(html)) throw Error('Zaposlitev.info job listing missing');
  const jobs = [];
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  for (const match of html.matchAll(/<a\b[^>]*class=["'][^"']*\bjob-link\s+custom-wpjb-card\b[^"']*["'][^>]*href=["'](https:\/\/zaposlitev\.info\/delo\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = match[1], body = match[2];
    const title = plain(body.match(/<span\s+class=["']wpjb-line-major["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    if (!title) continue;
    const company = plain(body.match(/<span\s+class=["']wpjb-sub\s+wpjb-sub-small["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const location = plain(body.match(/<span\s+class=["']tag\s+location["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const rawDate = plain(body.match(/<span\s+class=["']tag\s+date["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const m = rawDate.match(/([a-z]{3}),?\s*(\d{1,2})/i);
    let date = '';
    if (m && months[m[1].toLowerCase()]) {
      const current = new Date(now), month = months[m[1].toLowerCase()];
      let year = current.getUTCFullYear();
      if (month > current.getUTCMonth() + 2) year--;
      date = `${year}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }
    if (/(?:avstrija|nemčija|hrvaška|švica|italija|graz|wien|linz|münchen)/i.test(location)) continue;
    jobs.push({ id: 'zaposlitevinfo:' + new URL(url).pathname, source: 'Zaposlitev.info', title,
      company, location, date, deadline: '', url });
  }
  return Array.from(new Map(jobs.map(job => [job.id, job])).values());
}
export function zaposlitevInfoTotalPages(html) {
  const pagination = html.match(/<div\s+class=["']wpjb-paginate-links["']>([\s\S]*?)<\/div>/i)?.[1] || '';
  const pages = Array.from(pagination.matchAll(/\/prosta-delovna-mesta\/page\/(\d+)\//g), m => Number(m[1]));
  return Math.max(1, ...pages);
}
async function getZaposlitevInfo() {
  const startUrl = 'https://zaposlitev.info/prosta-delovna-mesta/';
  const first = await getText(startUrl);
  const jobs = parseZaposlitevInfoListings(first);
  if (!jobs.length) throw Error('Zaposlitev.info returned no jobs');
  const totalPages = Math.min(100, zaposlitevInfoTotalPages(first));
  const failures = [];
  for (let page = 2; page <= totalPages; page += 4) {
    const pages = Array.from({ length: Math.min(4, totalPages - page + 1) }, (_, i) => page + i);
    const results = await Promise.allSettled(pages.map(async p =>
      parseZaposlitevInfoListings(await getText(startUrl + `page/${p}/`))));
    results.forEach((result, i) => result.status === 'fulfilled' ? jobs.push(...result.value) : failures.push(pages[i]));
    if (page + 4 <= totalPages) await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (failures.length) throw Error('Zaposlitev.info missing pages ' + failures.join(', '));
  const unique = Array.from(new Map(jobs.map(job => [job.id, job])).values());
  return enrichJobsProgressively(unique, await previousJobs(), {
    name: 'Zaposlitev.info', limit: detailLimit('DETAIL_ZAPOSLITEV_LIMIT', 30), concurrency: 3,
    getDetails: job => getText(job.url), parseDetails: parseZaposlitevInfoDetails,
  });
}
const MERCATOR_REGIONS = {
  1: 'Savinjska', 2: 'Gorenjska', 4: 'Jugovzhodna Slovenija',
  5: 'Obalno-kraška', 6: 'Osrednjeslovenska', 8: 'Goriška',
  10: 'Podravska', 11: 'Primorsko-notranjska', 13: 'Posavska',
};
export function parseMercatorListings(html) {
  if (!html.includes('class="active-job-list"')) throw Error('Mercator: javni seznam delovnih mest manjka');
  const jobs = new Map();
  for (const match of html.matchAll(/<div\s+class=["']active-job-item\s+([^"']*)["'][^>]*>([\s\S]*?)<\/div>/gi)) {
    const classes = match[1];
    const link = match[2].match(/<a\s+href=["'](\/sl\/kariera\/prosta-delovna-mesta\/[^"'?#]+\/)['"][^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!link) continue;
    const title = plain(link[2]);
    const location = plain(match[2].match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
    if (!title) continue;
    const regionIds = [...classes.matchAll(/\bjobregion-(\d+)\b/g)].map(x => Number(x[1]));
    const regions = [...new Set(regionIds.map(id => MERCATOR_REGIONS[id]).filter(Boolean))];
    if (regionIds.includes(14) && !regions.length) continue; // Izključno tuji razpisi.
    const id = link[1].match(/-(\d+)\/$/)?.[1] || link[1];
    jobs.set(id, { id: 'mercator:' + id, source: 'Mercator', title, company: 'Mercator',
      location, regions, date: '', deadline: '', url: 'https://www.mercatorgroup.si' + link[1] });
  }
  return [...jobs.values()];
}
async function getMercator() {
  const jobs = parseMercatorListings(await getText('https://www.mercatorgroup.si/sl/kariera/prosta-delovna-mesta/seznam-prostih-delovnih-mest/'));
  if (!jobs.length) throw Error('Mercator: javni seznam ne vsebuje veljavnih oglasov');
  return jobs;
}
export function parseIscideloListings(html, now = Date.now()) {
  if (!html.includes('id="job-results"')) throw Error('IščiDelo: javni seznam manjka');
  const jobs = new Map();
  for (const match of html.matchAll(/<article\b(?=[^>]*\bdata-job-card\b)[^>]*>([\s\S]*?)<\/article>/gi)) {
    const body = match[1];
    const link = body.match(/<a\s+href=["'](\/delovna-mesta\/[^"'?#/]+)["'][^>]*\bdata-card-title\b[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const title = plain(link[2]);
    const company = plain(body.match(/<div\s+class=["']legacy-result-company["'][^>]*\bdata-card-company\b[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
    const location = plain(body.match(/<span\s+data-card-city[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '').replace(/^Kraj dela:\s*/i, '');
    const deadline = parseLocalDate(plain(body.match(/<span\s+data-card-deadline[^>]*>([\s\S]*?)<\/span>/i)?.[1] || ''));
    if (!title || (deadline && Date.parse(deadline + 'T23:59:59+01:00') < now)) continue;
    if (/^(Avstrija|Hrvaška|Nemčija|Italija|Srbija|Bosna)/i.test(location)) continue;
    const id = link[1].slice('/delovna-mesta/'.length);
    jobs.set(id, { id: 'iscidelo:' + id, source: 'IščiDelo', title, company, location,
      date: '', deadline, url: 'https://iscidelo.com' + link[1] });
  }
  return [...jobs.values()];
}
export function iscideloPages(html) {
  const match = html.match(/<nav\b[^>]*\bclass=["'][^"']*\bjobs-pagination\b[^"']*["'][^>]*\bdata-page=["'](\d+)["'][^>]*\bdata-pages=["'](\d+)["']/i);
  if (!match) throw Error('IščiDelo: podatki o straneh manjkajo');
  const page = Number(match[1]), total = Number(match[2]);
  if (page < 1 || total < 1 || total > 40 || page > total) throw Error('IščiDelo: nepričakovano straničenje');
  return { page, total };
}
async function getIscidelo() {
  const base = 'https://iscidelo.com/delovna-mesta/?perPage=30&sort=relevance&page=';
  const first = await getText(base + '1');
  const pagination = iscideloPages(first);
  if (pagination.page !== 1) throw Error('IščiDelo: prva stran ni bila vrnjena');
  const jobs = parseIscideloListings(first);
  if (!jobs.length) throw Error('IščiDelo: prvi seznam je prazen');
  for (let p = 2; p <= pagination.total; p += 2) {
    const pages = Array.from({ length: Math.min(2, pagination.total - p + 1) }, (_, i) => p + i);
    const results = await Promise.allSettled(pages.map(async page => {
      const html = await getText(base + page);
      if (iscideloPages(html).page !== page) throw Error('IščiDelo: zahtevana stran ni bila vrnjena');
      const entries = parseIscideloListings(html);
      if (!entries.length) throw Error('IščiDelo: prazna naslednja stran');
      return entries;
    }));
    if (results.some(r => r.status === 'rejected')) throw Error('IščiDelo: nepopoln zajem strani ' + pages.join(', '));
    jobs.push(...results.flatMap(r => r.value));
    if (p + 2 <= pagination.total) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return [...new Map(jobs.map(job => [job.id, job])).values()];
}
async function collect() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  let zrszDiagnostics, linkedinResult;
  const collectors = [getOptius(), getKariera(), getGov(), getAtama(), getPublicTrenkwalder(), getAgado(), getAdecco(), getRekruter(), getNove(), getLidl(), getKolektor(), getMojeDelo(), getZaposlitevInfo(), getMercator(), getIscidelo()];
  if (ZRSZ_JSON_URL || ZRSZ_OFFICIAL_HTTP_ENABLED) collectors.push(
    ZRSZ_OFFICIAL_HTTP_ENABLED ? previousJobs().then(async oldJobs => {
      const result = await getZrszOfficialHttp({ previous: oldJobs, withStats: true,
        maxNewDetails: Math.min(250, detailLimit('ZRSZ_VERIFY_NEW_LIMIT', 100)),
      });
      zrszDiagnostics = result.stats;
      return result.jobs;
    }) : getZrszJson(ZRSZ_JSON_URL));
  collectors.push(getDm(), getNovaPriloznost(), previousJobs().then(oldJobs => getManpower({
    previous: oldJobs, maxDetails: detailLimit('DETAIL_MANPOWER_LIMIT', 20),
  })), previousJobs().then(oldJobs => getWhc({
    previous: oldJobs, maxDetails: detailLimit('DETAIL_WHC_LIMIT', 24),
  })), getStudentWork(), previousJobs().then(oldJobs => getCompeto({ previous: oldJobs })), getCeltra(),
  getIzs(), getHidria(), getLthCastings(), getTelkom(), getPse(),
  previousSnapshot().then(async snapshot => {
    linkedinResult = await getLinkedinViaDelovnaMesta({
      previous: snapshot.jobs || [],
      previousState: snapshot.discovery?.delovnamestaLinkedin || {},
    });
    return linkedinResult.jobs;
  }),
  ...EMPLOYER_MIRRORS.map(item => previousJobs().then(previous =>
    getEmployerViaDelovnaMesta(item, { previous }))),
  getMerkurRecruitee(),
  ...ATS_BOARDS.map(board => getPublicAtsBoard(board)),
  ...WORKABLE_BOARDS.map(board => getPublicWorkableBoard(board)),
  ...SMARTRECRUITERS_BOARDS.map(board => previousJobs().then(previous =>
    getPublicSmartRecruitersBoard(board, { previous, maxNewDetails: detailLimit('DETAIL_SMARTRECRUITERS_LIMIT', 100) }))),
  ...ASHBY_BOARDS.map(board => getPublicAshbyBoard(board)));
  if (CAREERJET_DATA_API_KEY) collectors.push(previousJobs().then(async oldJobs => {
    const result = await fetchCareerjetDataApi({ apiKey: CAREERJET_DATA_API_KEY,
      maxPages: 1, maxDetails: 10, previous: oldJobs });
    console.log(`DeloRadar: Careerjet JSON ${result.jobs.length} oglasov, ${result.stats.detailsRequested} dodatnih HTTP opisov.`);
    return result.jobs;
  }));
  if (EURES_HTTP_ENABLED) collectors.push(previousJobs().then(async oldJobs => {
    const recent = reuseRecentEuresJobs(oldJobs);
    if (recent.length) {
      console.log(`DeloRadar: EURES ${recent.length} svežih oglasov iz prejšnjega zajema (brez novih HTTP poizvedb).`);
      return recent;
    }
    const result = await fetchEuresAdditional({ pages: 65, maxDetails: 100 });
    console.log(`DeloRadar: EURES HTTP ${result.stats.searchHits} zadetkov, ${result.stats.unique} dodatnih, ` +
      `${result.stats.cityConfirmed} s krajem, ${result.stats.countryOnly} brez kraja, ${result.stats.failures} napak; ` +
      `iskanje ${Math.round(result.stats.searchDurationMs / 1000)} s, podrobnosti ${Math.round(result.stats.detailsDurationMs / 1000)} s.`);
    const checkedAt = new Date().toISOString();
    return result.jobs.map(job => ({ ...job, euresFetchedAt: checkedAt }));
  }));
  const startedAt = Date.now();
  const observed = collectors.map((promise, i) => Promise.resolve(promise).then(
    jobs => {
      console.log(`DeloRadar: vir ${SOURCES[i].id} pripravljen v ${Math.round((Date.now() - startedAt) / 1000)} s (${jobs.length} oglasov)`);
      return jobs;
    },
    error => {
      console.warn(`DeloRadar: vir ${SOURCES[i].id} neuspešen po ${Math.round((Date.now() - startedAt) / 1000)} s`);
      throw error;
    },
  ));
  const results = await Promise.allSettled(observed);
  if (EURES_HTTP_ENABLED && results.at(-1)?.status === 'fulfilled') {
    const otherJobs = results.slice(0, -1).flatMap(r => r.status === 'fulfilled' ? r.value : []);
    results.at(-1).value = excludeExistingEures(results.at(-1).value, otherJobs).unique;
  }
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const reason = result.reason;
      console.warn('DeloRadar: vir ' + SOURCES[i].id + ' ni dosegljiv: ' +
        String(reason?.message || reason || 'Neznana napaka') + (reason?.cause?.code ? ' [' + reason.cause.code + ']' : ''));
    }
  });
  const jobs = markLikelyDuplicates(Array.from(new Map(results.flatMap(r => r.status === 'fulfilled' ? r.value : []).map(j => [j.id, j])).values()));
  const markedBySource = new Map();
  for (const job of jobs) if (job.duplicateGroup) {
    markedBySource.set(job.source, (markedBySource.get(job.source) || 0) + 1);
  }
  const sources = SOURCES.map((source, i) => ({ ...source,
    status: results[i].status === 'fulfilled' ? 'live' : 'error',
    count: results[i].status === 'fulfilled' ? results[i].value.length : 0,
    likelyDuplicates: markedBySource.get(source.name) || 0,
    ...(source.id === 'zrsz' && zrszDiagnostics ? { zrsz: zrszDiagnostics } : {}),
    ...(source.id === 'linkedin' && linkedinResult ? { scanProgress: linkedinResult.progress } : {}) }));
  cached = { jobs, sources, planned: PLANNED, checkedAt: new Date().toISOString(), storage: 'browser-local',
    discovery: { delovnamestaLinkedin: linkedinResult?.state || {} } };
  cachedAt = Date.now() - (sources.some(s => s.status === 'error') ? CACHE_MS - 60_000 : 0);
  return cached;
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    if (url.pathname === '/api/jobs') {
      try {
        const data = await collect();
        return new Response(JSON.stringify(data), { headers: {
          'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
      } catch (_) {
        return new Response(JSON.stringify({ error: 'Sources unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } });
      }
    }
    if (url.pathname !== '/') return new Response('Not found', { status: 404 });
    return new Response(page, { headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
  },
};

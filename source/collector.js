import { page } from './page.js';
import { getZrszJson, getZrszFromPublicBrowser } from './zrsz.js';
import { getDm, getNovaPriloznost } from './next-sources.js';

// Naslov poda ZRSZ in ostane v zaščiteni GitHub Actions skrivnosti.
const ZRSZ_JSON_URL = process.env.ZRSZ_JSON_URL?.trim();
const ZRSZ_BROWSER_ENABLED = process.env.ZRSZ_BROWSER_ENABLED === '1';

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
  ...(ZRSZ_JSON_URL || ZRSZ_BROWSER_ENABLED ? [{ id: 'zrsz', name: 'ZRSZ / PoiščiDelo', url: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/' }] : []),
  { id: 'dm', name: 'dm Slovenija', url: 'https://www.dm-jobs.si/job-listing/' },
  { id: 'novapriloznost', name: 'Nova Priložnost', url: 'https://novapriloznost.si/prosta-delovna-mesta/' },
];
const PLANNED = [
  ...(!ZRSZ_JSON_URL && !ZRSZ_BROWSER_ENABLED ? [{ name: 'ZRSZ / PoiščiDelo', href: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/', note: 'Dnevni JSON je preverjen; preverjamo samodejni prenos prek javnega gumba.' }] : []),
  { name: 'Careerjet', href: 'https://www.careerjet.si/', note: 'Čakamo primeren XML vir oziroma dogovorjen dostop za nekomercialni zajem.' },
  { name: 'EURES (Slovenija)', href: 'https://europa.eu/eures/portal/jv-se/search?page=1&resultsPerPage=10&orderBy=BEST_MATCH&locationCodes=si&previousPageType=findJob&lang=sl', note: 'Iskanje je že omejeno na Slovenijo. Za samodejni množični izvoz še potrebujemo ustrezen partnerski dostop; številni oglasi se prekrivajo z ZRSZ.' },
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
      deadline: xml(block, 'validTill'), url });
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
  return [...jobsByUrl.values()];
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
  return jobs;
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
      deadline: parseLocalDate(plain(cells[2])), url });
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
  const jobs = parseAtamaListings(await getText('https://atama.si/S2200/Ponudba+dela.'));
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
      date, deadline: '', url: link[1] });
  }
  return Array.from(new Map(jobs.map(j => [j.id, j])).values());
}
async function getAgado() {
  const jobs = parseAgadoListings(await getText('https://www.agado.si/iskalci/69/prosta-delovna-mesta'));
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
    deadline: Number.isFinite(due) ? new Date(due).toISOString() : '', url: listing.url };
}
async function getAdeccoPreview(listing) {
  // Javni, v robots.txt dovoljeni URL-ji in samo začetek HTML-ja.
  // Adecco podpira HTTP Range; 30 KB vsebuje strukturirane podatke JobPosting.
  const response = await fetch(listing.url, { signal: AbortSignal.timeout(12500),
    headers: { range: 'bytes=0-29999', 'user-agent': 'DeloRadar/0.1 (personal job listing index)', accept: 'text/html' } });
  if (response.status !== 206) throw Error('Adecco did not honor a small range request');
  return parseAdeccoJobPreview(await response.text(), listing);
}
async function getAdecco() {
  const listings = parseAdeccoSitemap(await getText('https://www.adecco.com/sitemap-jobs-slovenia-sl.xml'));
  if (!listings.length) throw Error('Adecco sitemap has no job listings');
  const jobs = [];
  for (let start = 0; start < listings.length; start += 6) {
    const batch = await Promise.allSettled(listings.slice(start, start + 6).map(getAdeccoPreview));
    for (const result of batch) if (result.status === 'fulfilled' && result.value) jobs.push(result.value);
    if (start + 6 < listings.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
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
      date: Number.isFinite(posted) ? new Date(posted).toISOString() : '', deadline: '', url });
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
    date: slDate(fields.get('Datum objave') || ''), deadline, url: listing.url };
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
    deadline: Number.isFinite(expiry) ? new Date(expiry).toISOString() : '', url: listing.url };
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
export function parseMojeDeloJobs(response) {
  if (!Array.isArray(response?.data?.items) || !Number.isInteger(response?.data?.total)) throw Error('MojeDelo unexpected response');
  return response.data.items.flatMap(item => {
    if (!item?.id || !plain(item.title) || item.country?.countryCode !== 'SI') return [];
    const published = Date.parse(item.repostingDate || item.startDate || '');
    const regions = (item.regions || []).map(r => plain(r.translation || r.name || '')).filter(Boolean);
    const town = plain(item.town?.translation || item.town?.name || item.jobLocationInput || '');
    return [{ id: 'mojedelo:' + item.id, source: 'MojeDelo.com', title: plain(item.title),
      company: plain(item.company?.name || (item.anonymizedCompany ? 'Nerazkrito podjetje' : '')),
      location: town, regions,
      date: Number.isFinite(published) ? new Date(published).toISOString() : '', deadline: '',
      // Javno iskanje podpira filter po ID; povezava odpre natanko ta oglas v iskalniku.
      url: 'https://www.mojedelo.com/iskanje-zaposlitve?jobAdIds=' + encodeURIComponent(item.id) }];
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
  return Array.from(new Map(jobs.map(job => [job.id, job])).values());
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
  return Array.from(new Map(jobs.map(job => [job.id, job])).values());
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
  const collectors = [getOptius(), getKariera(), getGov(), getAtama(), getTrenkwalder(), getAgado(), getAdecco(), getRekruter(), getNove(), getLidl(), getKolektor(), getMojeDelo(), getZaposlitevInfo(), getMercator(), getIscidelo()];
  if (ZRSZ_JSON_URL || ZRSZ_BROWSER_ENABLED) collectors.push(ZRSZ_JSON_URL ? getZrszJson(ZRSZ_JSON_URL) : getZrszFromPublicBrowser());
  collectors.push(getDm(), getNovaPriloznost());
  const results = await Promise.allSettled(collectors);
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const reason = result.reason;
      console.warn('DeloRadar: vir ' + SOURCES[i].id + ' ni dosegljiv: ' +
        String(reason?.message || reason || 'Neznana napaka') + (reason?.cause?.code ? ' [' + reason.cause.code + ']' : ''));
    }
  });
  const sources = SOURCES.map((source, i) => ({ ...source,
    status: results[i].status === 'fulfilled' ? 'live' : 'error',
    count: results[i].status === 'fulfilled' ? results[i].value.length : 0 }));
  const jobs = Array.from(new Map(results.flatMap(r => r.status === 'fulfilled' ? r.value : []).map(j => [j.id, j])).values());
  cached = { jobs, sources, planned: PLANNED, checkedAt: new Date().toISOString(), storage: 'browser-local' };
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

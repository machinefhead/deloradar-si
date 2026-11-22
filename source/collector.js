import { page } from './page.js';

const SOURCES = [
  { id: 'optius', name: 'Optius', url: 'https://www.optius.com/iskalci/prosta-delovna-mesta/' },
  { id: 'kariera', name: 'Kariera.si', url: 'https://www.kariera.si/sl/delovna-mesta' },
  { id: 'govsi', name: 'GOV.SI', url: 'https://www.gov.si/zbirke/delovna-mesta/' },
  { id: 'atama', name: 'Atama', url: 'https://atama.si/za-iskalce/aktualna-ponudba-dela' },
  { id: 'trenkwalder', name: 'Trenkwalder', url: 'https://si.trenkwalder.com/jobs' },
  { id: 'agado', name: 'Agado', url: 'https://www.agado.si/iskalci/69/prosta-delovna-mesta' },
];
const PLANNED = [
  { name: 'ZRSZ / PoiščiDelo', href: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/', note: 'ZRSZ za ponovno objavo podatkov zahteva dovoljenje; do dovoljenja le povezava na iskalnik' },
  { name: 'MojeDelo.com', href: 'https://www.mojedelo.com/', note: 'Povezava za podatke še ni preverjena' },
  { name: 'Careerjet', href: 'https://www.careerjet.si/', note: 'Že združuje vire; preprečiti dvojnike' },
  { name: 'Nove zaposlitve', href: 'https://novezaposlitve.si/', note: 'Preverjanje strukture in pogojev uporabe' },
  { name: 'IščiDelo', href: 'https://iscidelo.com/', note: 'Preverjanje strukture in pogojev uporabe' },
  { name: 'EURES', href: 'https://eures.europa.eu/', note: 'Evropski portal s slovenskim trgom dela' },
  { name: 'Druge zaposlitvene agencije', href: 'https://www.adecco.com/sl-si/', note: 'Adecco in drugi; Manpower prepoveduje avtomatsko zbiranje podatkov' },
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
async function getText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12500),
    headers: { 'user-agent': 'DeloRadar/0.1 (personal job listing index)', accept: 'text/html,application/rss+xml,application/xml;q=0.9' },
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
async function collect() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const results = await Promise.allSettled([getOptius(), getKariera(), getGov(), getAtama(), getTrenkwalder(), getAgado()]);
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

import { page } from './page.js';

const SOURCES = [
  { id: 'optius', name: 'Optius', url: 'https://www.optius.com/iskalci/prosta-delovna-mesta/' },
  { id: 'kariera', name: 'Kariera.si', url: 'https://www.kariera.si/sl/delovna-mesta' },
];
const PLANNED = [
  { name: 'ZRSZ / PoiščiDelo', href: 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/', note: 'Preveriti dovoljenje in uradni izvoz podatkov' },
  { name: 'MojeDelo.com', href: 'https://www.mojedelo.com/', note: 'Povezava za podatke še ni preverjena' },
  { name: 'Careerjet', href: 'https://www.careerjet.si/', note: 'Že združuje vire; preprečiti dvojnike' },
  { name: 'Nove zaposlitve', href: 'https://novezaposlitve.si/', note: 'Preverjanje strukture in pogojev uporabe' },
  { name: 'IščiDelo', href: 'https://iscidelo.com/', note: 'Preverjanje strukture in pogojev uporabe' },
  { name: 'GOV.SI – javni natečaji', href: 'https://www.gov.si/zbirke/delovna-mesta/', note: 'Poseben vir za javni sektor' },
  { name: 'EURES', href: 'https://eures.europa.eu/', note: 'Evropski portal s slovenskim trgom dela' },
  { name: 'Zaposlitvene agencije', href: 'https://www.manpower.si/', note: 'Manpower, Adecco, Trenkwalder, Atama in drugi' },
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
async function getOptius() {
  const feed = await getText('https://www.optius.com/rss/?podrocje=&regija=');
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
async function collect() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const results = await Promise.allSettled([getOptius(), getKariera()]);
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

// Telekom Slovenije: javni HTML razpisi SAP SuccessFactors, samo seznam in
// javne podrobnosti, brez prijavnih obrazcev ali dodatnih storitev.
import { readableJobText } from './job-details.js';

export const TELEKOM_SOURCE = 'Telekom Slovenije';
export const TELEKOM_URL = 'https://zaposlitev.telekom.si/go/Delovna-mesta/5111301/';
const ORIGIN = 'https://zaposlitev.telekom.si';
const MAX_JOBS = 20;

function clean(value) {
  return readableJobText(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/.]*\d{3}[ \-/.]*\d{3,4}\b/g, '')
    .trim();
}

export function parseTelekomListing(html) {
  if (!/<table\b[^>]*id="searchresults"/i.test(html)) {
    throw Error('Telekom: javni seznam oglasov ni prepoznan');
  }
  const countMatch = html.match(/Rezultati\s*<b>\s*\d+\s*[–-]\s*\d+\s*<\/b>\s*od\s*<b>\s*(\d+)\s*<\/b>/i);
  if (!countMatch || +countMatch[1] < 1 || +countMatch[1] > MAX_JOBS) {
    throw Error('Telekom: nepričakovano število oglasov ali straničenje');
  }
  const links = [...html.matchAll(/<a\s+href="(\/job\/[^"?#]+\/(\d{8,12})\/)"\s+class="jobTitle-link"/gi)];
  const byId = new Map();
  for (const match of links) {
    const url = ORIGIN + match[1];
    if (byId.has(match[2]) && byId.get(match[2]) !== url) throw Error('Telekom: neujemanje povezav');
    byId.set(match[2], url);
  }
  if (byId.size !== +countMatch[1]) throw Error('Telekom: seznam oglasov je nepopoln');
  return [...byId.entries()].map(([id, url]) => ({ id, url }));
}

function isoDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function locationFromText(description, title) {
  const location = (description.match(/(?:Delo se (?:bo )?(?:opravljalo|izvajalo)|izvajanj[ae] del)[^.]{0,160}?\b(?:v|na območju)\s+(Mariboru|Maribora|Ptuju|Ptuj|Ljubljani|Celju|Kopru|Kranju|Novem mestu)\b/i) ||
    title.match(/\b(Maribor|Ptuj|Ljubljana|Celje|Koper|Kranj|Novo mesto)\b/i))?.[1] || '';
  const names = { mariboru: 'Maribor', maribora: 'Maribor', maribor: 'Maribor',
    ptuju: 'Ptuj', ptuj: 'Ptuj', ljubljani: 'Ljubljana', ljubljana: 'Ljubljana',
    celju: 'Celje', celje: 'Celje', kopru: 'Koper', koper: 'Koper',
    kranju: 'Kranj', kranj: 'Kranj', 'novem mestu': 'Novo mesto', 'novo mesto': 'Novo mesto' };
  return names[location.toLowerCase()] || 'Slovenija';
}

export function parseTelekomJob(html, url, now = new Date().toISOString()) {
  const parsed = new URL(url);
  if (parsed.origin !== ORIGIN || !/^\/job\/[^/?#]+\/\d{8,12}\/$/.test(parsed.pathname)) {
    throw Error('Telekom: neveljavna izvirna povezava');
  }
  const id = parsed.pathname.match(/\/(\d{8,12})\/$/)[1];
  if (!/itemtype="http:\/\/schema\.org\/JobPosting"/.test(html)) {
    throw Error('Telekom: uradni oglas ni prepoznan');
  }
  const title = clean(html.match(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i)?.[1]).slice(0, 300);
  const body = html.match(/<span class="jobdescription">([\s\S]*?)<\/span>\s*<\/span>\s*<\/div>/i)?.[1];
  const description = clean(body).slice(0, 8000);
  const date = isoDate(html.match(/itemprop="datePosted"\s+content="([^"]+)"/i)?.[1]);
  const deadline = isoDate(html.match(/itemprop="validThrough"\s+content="([^"]+)"/i)?.[1]);
  if (!title || description.length < 100 || !date || !deadline) {
    throw Error('Telekom: naslov, celoten opis ali datumi manjkajo');
  }
  const localToday = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit',
    day: '2-digit', timeZone: 'Europe/Ljubljana' }).format(new Date(now));
  if (deadline < localToday) return null;
  return { id: `telekom:${id}`, source: TELEKOM_SOURCE, company: 'Telekom Slovenije, d.d.',
    title, location: locationFromText(description, title), description, date, deadline, url };
}

async function publicHtml(url, fetchImpl) {
  const response = await fetchImpl(url, { redirect: 'manual',
    headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' },
    signal: AbortSignal.timeout(20_000) });
  if (response.status !== 200 || response.headers.get('location')) {
    throw Error(`Telekom: javni vir HTTP ${response.status}`);
  }
  if (Number(response.headers.get('content-length') || 0) > 450_000) {
    throw Error('Telekom: prevelik HTML odgovor');
  }
  const html = await response.text();
  if (html.length > 450_000) throw Error('Telekom: prevelik HTML odgovor');
  return html;
}

export async function getTelekom({ fetchImpl = fetch, now = new Date().toISOString(),
  pauseMs = 400 } = {}) {
  if (!Number.isFinite(Date.parse(now)) || !Number.isInteger(pauseMs) || pauseMs < 0) {
    throw Error('Telekom: neveljavni parametri zajema');
  }
  const listed = parseTelekomListing(await publicHtml(TELEKOM_URL, fetchImpl));
  const jobs = [];
  for (const { url } of listed) {
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
    const job = parseTelekomJob(await publicHtml(url, fetchImpl), url, now);
    if (job) jobs.push(job);
  }
  if (!jobs.length) throw Error('Telekom: ni veljavnih slovenskih oglasov');
  console.log(`Telekom Slovenije: ${jobs.length} aktualnih razpisov iz 1 seznama in ${listed.length} javnih podrobnosti.`);
  return { jobs, progress: { checked: listed.length, total: listed.length, pending: false } };
}

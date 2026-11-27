import { readableJobText } from './job-details.js';

// Javne izvirne strani. Uvažamo le oglase z neposrednim URL-jem; osebnih
// kontaktov ne prepisujemo. Brez dostopa do zasebnih API-jev ali prijav.
const FIRSTJOB_LIST = 'https://firstjob.si/prosta-dela-za-studente-in-dijake/';
const CINKARNA_LIST = 'https://www.cinkarna.si/karierna-tocka';
const MAX_AGE_DAYS = 120;

function clean(value = '') { return readableJobText(value).replace(/\s+/g, ' ').trim(); }
function dateDmy(value) {
  const match = String(value).match(/\b(\d{1,2})[./]\s*(\d{1,2})[./]\s*(20\d{2})\b/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}
function recent(date, now) {
  const elapsed = Date.parse(now + 'T12:00:00Z') - Date.parse(date + 'T12:00:00Z');
  return Number.isFinite(elapsed) && elapsed >= -86400000 && elapsed <= MAX_AGE_DAYS * 86400000;
}
function withoutContacts(text) {
  return text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[\s./-]*\d{3}[\s./-]*\d{3,4}\b/g, '').trim();
}
function divContent(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return '';
  const open = html.indexOf('>', start) + 1;
  let depth = 1;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = open;
  let tag;
  while ((tag = tags.exec(html))) {
    depth += /^<\/div/i.test(tag[0]) ? -1 : 1;
    if (!depth) return html.slice(open, tag.index);
  }
  return '';
}
async function readHtml(url, maxBytes = 450_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000),
    headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!response.ok) throw Error(`HTTP ${response.status} za ${new URL(url).hostname}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw Error('Prevelik javni HTML');
  const html = await response.text();
  if (html.length > maxBytes) throw Error('Prevelik javni HTML');
  return html;
}
async function withDetails(jobs, parser, read) {
  const result = [];
  for (let start = 0; start < jobs.length; start += 3) {
    const settled = await Promise.allSettled(jobs.slice(start, start + 3).map(async job =>
      parser(await read(job.url), job)));
    settled.forEach((item, i) => result.push(item.status === 'fulfilled' ? item.value : jobs[start + i]));
    if (start + 3 < jobs.length) await new Promise(resolve => setTimeout(resolve, 200));
  }
  return result;
}

export function parseFirstJobList(html, now = new Date().toISOString().slice(0, 10)) {
  if (!html.includes('bde-loop-item ee-post')) throw Error('FirstJob: neprepoznan seznam oglasov');
  const jobs = new Map();
  for (const match of html.matchAll(/<article\s+class="bde-loop-item ee-post">\s*<a[^>]*href="(https:\/\/firstjob\.si\/delovno-mesto\/[^"?#]+\/)"[^>]*>([\s\S]*?)<\/a>\s*<\/article>/gi)) {
    const url = match[1], card = match[2];
    const title = clean(card.match(/<h3\s+class="[^"]*bde-heading[^"]*">([\s\S]*?)<\/h3>/i)?.[1]);
    const date = dateDmy(clean(card.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/)?.[1]));
    if (!title || !date || !recent(date, now)) continue;
    const location = clean(card.match(/Lokacija\s*<\/div>[\s\S]*?<div\s+class="bde-text-[^"]*">\s*([^<]+)<\/div>/i)?.[1]);
    const jobCategory = clean(card.match(/Vrsta dela:\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i)?.[1]);
    jobs.set(url, { id: 'firstjob:' + new URL(url).pathname, source: 'FirstJob (študentsko delo)',
      company: '', title, location, date, deadline: '', url,
      ...(jobCategory ? { jobCategory } : {}) });
  }
  return [...jobs.values()];
}

export function parseFirstJobDetail(html, job) {
  if (!html.includes('<title>') || !html.includes('id="prijava"')) return job;
  const content = divContent(html, '<div id="prijava"');
  const description = withoutContacts(readableJobText(content));
  return description.length > 45 ? { ...job, description } : job;
}

export async function getFirstJob({ now, fetchText = readHtml } = {}) {
  const jobs = parseFirstJobList(await fetchText(FIRSTJOB_LIST), now);
  return withDetails(jobs, parseFirstJobDetail, fetchText);
}

export function parseCinkarnaList(html, now = new Date().toISOString().slice(0, 10)) {
  if (!html.includes('karierna-tocka') || !html.includes('href="/novica/')) throw Error('Cinkarna: neprepoznan karierni seznam');
  const jobs = new Map();
  for (const match of html.matchAll(/<h3><a\s+href="(\/novica\/[a-z0-9-]+-(20\d{2})-(\d{2})-(\d{2}))">([^<]+)<\/a><\/h3>/gi)) {
    const [, path, year, month, day, rawTitle] = match;
    const date = `${year}-${month}-${day}`;
    const title = clean(rawTitle);
    if (!recent(date, now) || !title) continue;
    const url = 'https://www.cinkarna.si' + path;
    jobs.set(url, { id: 'cinkarna:' + path, source: 'Cinkarna Celje', company: 'Cinkarna Celje',
      title, location: /mozirje/i.test(path) ? 'Mozirje' : 'Celje', date, deadline: '', url });
  }
  return [...jobs.values()];
}

export function parseCinkarnaDetail(html, job, now = new Date().toISOString().slice(0, 10)) {
  const title = clean(html.match(/<h1\s+class="title">([\s\S]*?)<\/h1>/i)?.[1]);
  if (!title || title.toLowerCase() !== job.title.toLowerCase()) return job;
  const body = divContent(html, '<div class="newsDetail"');
  if (!body) return job;
  const deadline = dateDmy(clean(body).match(/(?:do(?:\s+vključno)?|najkasneje do|rok prijave)\s+(\d{1,2}\.\s*\d{1,2}\.\s*20\d{2})/i)?.[1]);
  if (deadline && deadline < now) return null;
  // Opis iz samo osrednjega dela oglasa, brez imen, telefonskih številk ali e-pošte.
  const description = withoutContacts(readableJobText(body))
    .replace(/^\s*\d{1,2}\.\s*\d{1,2}\.\s*20\d{2}\s*/, '').slice(0, 12000);
  return description.length > 60 ? { ...job, ...(deadline ? { deadline } : {}), description } : job;
}

export async function getCinkarna({ now, fetchText = readHtml } = {}) {
  const jobs = parseCinkarnaList(await fetchText(CINKARNA_LIST), now);
  const detailed = await withDetails(jobs, (html, job) => parseCinkarnaDetail(html, job, now), fetchText);
  return detailed.filter(Boolean);
}

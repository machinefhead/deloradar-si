import { readableJobText } from './job-details.js';

// Uradni javni seznam Iskraemeco in uradni podrobni opisi.
// Lastnik projekta je 27. 11. 2026 potrdil posebno dovoljenje za uporabo.
// Prijava ostaja na izvirni povezavi; osebnih kontaktov ne zbiramo.
const LIST_URL = 'https://iskraemeco.com/sl/kariera/odprta-delovna-mesta/';
const JOB_PREFIX = 'https://iskraemeco.com/sl/career-position/';

function shortText(html) {
  return readableJobText(html || '').replace(/\s+/g, ' ').trim();
}

function deadlineFrom(text) {
  const match = text.match(/\bRok prijave\s*:?\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})\b/i);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}

export function parseIskraemecoList(html, now = new Date().toISOString().slice(0, 10)) {
  if (!html.includes('vacancy-card')) throw Error('Iskraemeco: uradni seznam razpisov ni prepoznan');
  const jobs = new Map();
  const cards = [...html.matchAll(/<div class="vacancy-card">([\s\S]*?)(?=<div class="vacancy-card">|<div class="margin\s*:\s*margin--40">|<\/section>)/gi)];
  if (!cards.length) throw Error('Iskraemeco: struktura razpisov se je spremenila');
  for (const [, card] of cards) {
    const title = shortText(card.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1]);
    const href = card.match(/\bhref="(https:\/\/iskraemeco\.com\/sl\/career-position\/[a-z0-9-]+\/)"/i)?.[1];
    if (!title || !href || !href.startsWith(JOB_PREFIX)) continue;
    const deadline = deadlineFrom(shortText(card));
    if (deadline && deadline < now) continue;
    jobs.set(href, { id: 'iskraemeco:' + new URL(href).pathname, source: 'Iskraemeco',
      company: 'Iskraemeco', title, location: '', date: '', deadline, url: href });
  }
  return [...jobs.values()];
}

export function parseIskraemecoDetail(html, job) {
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  const originalTitle = shortText(html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1]);
  if (canonical !== job.url || originalTitle.toLowerCase() !== job.title.toLowerCase()) {
    throw Error('Iskraemeco: podrobnosti ne ustrezajo razpisu');
  }
  const location = shortText(html.match(/<h5>\s*(?:Lokacija|Location):\s*([^<]+)<\/h5>/i)?.[1]);
  if (!/\bSlovenija\b|\bSlovenia\b/i.test(location)) return null;
  const sections = [...html.matchAll(/<section class="sc-general : sc-two-col-module[^\"]*"[^>]*>([\s\S]*?)<\/section>/gi)]
    .map(match => readableJobText(match[1])).filter(value => value.length > 30);
  const description = sections.join('\n\n')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/.]*\d{3}[ \-/.]*\d{3,4}\b/g, '').trim();
  if (description.length < 60) throw Error('Iskraemeco: podroben opis ni na voljo');
  return { ...job, location: location.replace(/,?\s*(?:Slovenija|Slovenia)\s*$/i, '').trim() || 'Slovenija', description };
}

export async function getIskraemeco({ now, fetchText } = {}) {
  const read = fetchText || (async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000),
      headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
    if (!response.ok) throw Error(`Iskraemeco: HTTP ${response.status}`);
    if (Number(response.headers.get('content-length')) > 500_000) throw Error('Iskraemeco: prevelik javni odgovor');
    const html = await response.text();
    if (html.length > 500_000) throw Error('Iskraemeco: prevelik javni odgovor');
    return html;
  });
  const listing = parseIskraemecoList(await read(LIST_URL), now);
  const result = [];
  for (let start = 0; start < listing.length; start += 3) {
    const chunk = await Promise.all(listing.slice(start, start + 3).map(async job =>
      parseIskraemecoDetail(await read(job.url), job)));
    result.push(...chunk.filter(Boolean));
    if (start + 3 < listing.length) await new Promise(resolve => setTimeout(resolve, 200));
  }
  console.log(`Iskraemeco: ${result.length} slovenskih razpisov z uradnimi opisi in povezavami.`);
  return result;
}

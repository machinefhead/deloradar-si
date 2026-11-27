// Mjob: izključno javni sitemap.xml in javne podstrani razpisov.
// Zajem je namenoma postopen: strani imajo približno 0,4 MB in popoln pregled
// vseh razpisov na enem zagonu ne bi bil prijazen do izvirnega portala.
import { readableJobText } from './job-details.js';

export const MJOB_SOURCE = 'Mjob (študentsko delo)';
export const MJOB_URL = 'https://www.mjob.si/jobi-studentsko-delo';
const SITEMAP = 'https://www.mjob.si/sitemap.xml';
const DETAIL_PREFIX = MJOB_URL + '/podrobnosti/';
const CACHE_MS = 14 * 86400_000;

function clean(value) {
  return readableJobText(String(value || '').replace(/<!--[\s\S]*?-->/g, ''))
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/.]*\d{3}[ \-/.]*\d{3,4}\b/g, '')
    .replace(/\s+/g, ' ').trim();
}

async function publicText(url) {
  const response = await fetch(url, {
    headers: { accept: 'text/html,application/xml;q=0.9' },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 404 && url.startsWith(DETAIL_PREFIX)) return null;
  if (response.status !== 200) throw Error(`Mjob: HTTP ${response.status} za javno stran`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 1_200_000) throw Error('Mjob: prevelik javni odgovor');
  const html = await response.text();
  if (html.length > 1_200_000) throw Error('Mjob: prevelik javni odgovor');
  return html;
}

export function parseMjobSitemap(xml, { minimum = 100 } = {}) {
  if (!/<urlset\b/i.test(xml)) throw Error('Mjob: neveljaven javni sitemap');
  const ids = new Set();
  for (const match of xml.matchAll(/<loc>https:\/\/(?:www\.)?mjob\.si\/jobi-studentsko-delo\/podrobnosti\/(\d{4,9})<\/loc>/gi)) {
    ids.add(match[1]);
  }
  if (ids.size < minimum || ids.size > 10000) throw Error('Mjob: nepopoln ali nepričakovano obsežen sitemap');
  return [...ids].sort((a, b) => Number(b) - Number(a));
}

function bullets(html, label) {
  const marker = `<p>${label}</p>`;
  const start = html.indexOf(marker);
  if (start < 0) return '';
  const section = html.slice(start + marker.length);
  const list = section.match(/^\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/i);
  return list ? [...list[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(item => clean(item[1])).filter(Boolean).join('; ').slice(0, 2500) : '';
}

export function parseMjobDetail(html, id) {
  const header = html.match(/<h1\b[^>]*class="[^"]*break-word[^"]*"[^>]*>([\s\S]*?)<\/h1>\s*<span\b[^>]*class="[^"]*font-extralight[^\"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const code = html.match(/Šifra(?:<!--[\s\S]*?-->)?:\s*<span\b[^>]*>(\d+)<\/span>/i);
  if (!header || !code || code[1] !== String(id)) throw Error(`Mjob: podrobnosti ${id} ne ustrezajo javnemu razpisu`);
  const title = clean(header[1]).slice(0, 300), company = clean(header[2]).slice(0, 180);
  const place = html.match(/Kraj dela(?:<!--[\s\S]*?-->)?:<\/span><span>([\s\S]*?)<\/span>/i);
  const location = clean(place?.[1]).slice(0, 180);
  if (!title || !company || !location) throw Error(`Mjob: ${id} nima naslova, delodajalca ali kraja`);
  const intro = html.match(/<p class="mt-6">([\s\S]*?)<\/p>/i);
  const responsibilities = bullets(html, 'Opis dela');
  const description = [clean(intro?.[1]), responsibilities].filter(Boolean).join(' ').slice(0, 3500);
  if (description.length < 30) throw Error(`Mjob: ${id} nima uporabnega javnega opisa`);
  const requirements = [bullets(html, 'Zahtevana znanja'), bullets(html, 'Dodatni pogoji')].filter(Boolean).join('; ');
  const benefits = bullets(html, 'Nudimo');
  const schedule = html.match(/Delovni čas(?:<!--[\s\S]*?-->)?:<\/span><span>([\s\S]*?)<\/span>/i);
  const duration = html.match(/Trajanje(?:<!--[\s\S]*?-->)?:<\/span><span>([\s\S]*?)<\/span>/i);
  return {
    id: `mjob:${id}`, source: MJOB_SOURCE, title, company, location,
    date: '', deadline: '', url: DETAIL_PREFIX + id,
    description, requirements, benefits, employmentType: 'Študentsko delo',
    ...(schedule ? { workSchedule: clean(schedule[1]) } : {}),
    ...(duration ? { duration: clean(duration[1]) } : {}),
  };
}

export async function getMjob({ previous = [], previousState = {}, maxDetails = 20,
  now = new Date().toISOString(), minimum = 100, fetchText = publicText, pauseMs = 450 } = {}) {
  if (!Number.isInteger(maxDetails) || maxDetails < 0 || maxDetails > 50) throw Error('Mjob: prevelika omejitev novih preverjanj');
  const ids = parseMjobSitemap(await fetchText(SITEMAP), { minimum });
  if (Number.isInteger(previousState.total) && ids.length < previousState.total * 0.7) {
    throw Error('Mjob: javni sitemap je občutno krajši; varnostno obdrži zadnjo objavo');
  }
  const live = new Set(ids);
  const checkedAt = Object.fromEntries(Object.entries(previousState.checkedAt || {})
    .filter(([id, checked]) => live.has(id) && Number.isFinite(Date.parse(checked))));
  const jobs = new Map(previous.filter(job => job.source === MJOB_SOURCE && live.has(String(job.id).slice(5)))
    .map(job => [String(job.id).slice(5), job]));
  const timestamp = Date.parse(now);
  if (!Number.isFinite(timestamp)) throw Error('Mjob: neveljaven datum zajema');
  const unvisited = ids.filter(id => !checkedAt[id]);
  const dueRefresh = ids.filter(id => checkedAt[id] && timestamp - Date.parse(checkedAt[id]) >= CACHE_MS)
    .sort((a, b) => Date.parse(checkedAt[a]) - Date.parse(checkedAt[b]));
  // Ko obstajajo starejši že objavljeni oglasi, jim nameni del proračuna.
  // Preostanek porabi za nove vnose, ne za vsakokratno preverjanje istega vrha.
  const refreshBudget = Math.min(dueRefresh.length, unvisited.length ? Math.floor(maxDetails / 4) : maxDetails);
  const todo = [...unvisited.slice(0, maxDetails - refreshBudget), ...dueRefresh.slice(0, refreshBudget)];
  for (let i = 0; i < todo.length; i++) {
    const id = todo[i], html = await fetchText(DETAIL_PREFIX + id);
    if (html === null) jobs.delete(id); // Odstranjen oglas (javni HTTP 404).
    else jobs.set(id, parseMjobDetail(html, id));
    checkedAt[id] = now;
    if (pauseMs > 0 && i < todo.length - 1) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  const result = {
    jobs: [...jobs.values()], state: { checkedAt, total: ids.length },
    progress: { checked: Object.keys(checkedAt).length, total: ids.length,
      requested: todo.length, pending: Object.keys(checkedAt).length < ids.length },
  };
  console.log(`Mjob: ${result.jobs.length} potrjenih del, ${todo.length} novih preverjanj, ` +
    `${result.progress.checked}/${ids.length} pregledanih povezav iz javnega sitemapa.`);
  return result;
}

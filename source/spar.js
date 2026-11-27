import { readableJobText } from './job-details.js';

// Uradna SPAR stran: tri področja + podstrani regij trgovin. Gre izključno
// za javne HTML odgovore; brez obrazcev za prijavo, JS brskalnika ali /cdn-cgi/.
const ORIGIN = 'https://www.spar.si';
const SECTIONS = [
  ['uprava-druzbe-spar', 'Uprava'],
  ['restavracije-interspar', 'Restavracije'],
  ['studentsko-delo', 'Študentsko delo'],
];
const REGION_NAMES = {
  osrednjeslovenska: 'Osrednjeslovenska', savinjska: 'Savinjska',
  gorenjska: 'Gorenjska', dolenjska: 'Jugovzhodna Slovenija',
  obalna: 'Obalno-kraška', podravska: 'Podravska', goriska: 'Goriška',
  spodnjeposavska: 'Posavska', 'primorsko-notranjska': 'Primorsko-notranjska',
};

function clean(value) {
  return readableJobText(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?<!\d)(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '').trim();
}

async function publicHtml(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000),
    headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (response.status === 404 || response.status === 410) return '';
  if (!response.ok || new URL(response.url).origin !== ORIGIN) throw Error('SPAR: HTTP ' + response.status);
  const body = await response.text();
  if (body.length > 360_000) throw Error('SPAR: prevelik HTML odgovor');
  return body;
}

export function parseSparListingLinks(html) {
  return [...new Set([...html.matchAll(/href=["'](\/zaposlitev\/[a-z0-9-]+)["']/gi)]
    .map(match => ORIGIN + match[1]))];
}

export function parseSparRegions(html) {
  return [...new Set([...html.matchAll(/href=["'](\/zaposlitev-spar\/trgovine\/([a-z0-9-]+))["']/gi)]
    .filter(match => Object.hasOwn(REGION_NAMES, match[2]))
    .map(match => ORIGIN + match[1]))];
}

function slDate(value) {
  const hit = String(value || '').match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!hit) return '';
  const date = `${hit[3]}-${hit[2].padStart(2, '0')}-${hit[1].padStart(2, '0')}`;
  return Number.isFinite(Date.parse(date + 'T00:00:00Z')) ? date : '';
}

export function parseSparJob(html, url, category, regions = [], today = new Date().toISOString().slice(0, 10), verifiedAt = new Date().toISOString()) {
  if (!html) return null; // 404/410 = že umaknjen razpis.
  const parsed = new URL(url);
  if (parsed.origin !== ORIGIN || !/^\/zaposlitev\/[a-z0-9-]+$/.test(parsed.pathname)) {
    throw Error('SPAR: neveljaven izvirni URL');
  }
  const title = clean(html.match(/<h1\b[^>]*class="[^"]*\bjob-detail__headline\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]).slice(0, 300);
  if (!title) throw Error('SPAR: naslov oglasa manjka');
  const fields = new Map();
  for (const match of html.matchAll(/<div class="job-detail__info-container">\s*<h4 class="[^"]*job-detail__info-headline[^"]*">([\s\S]*?)<\/h4>\s*<div class="job-detail__info-text(?: text)?">([\s\S]*?)<\/div>/gi)) {
    const key = clean(match[1]).replace(/:$/, '').toLowerCase();
    fields.set(key, { html: match[2], text: clean(match[2]) });
  }
  const location = fields.get('kraj zaposlitve')?.text || '';
  const requirements = fields.get('kaj pričakujemo')?.text || '';
  const responsibilities = fields.get('delo obsega')?.text || '';
  const benefits = fields.get('nudimo')?.text || '';
  const extra = [...fields.entries()].filter(([key]) =>
    !['kraj zaposlitve', 'delovno mesto', 'kaj pričakujemo', 'delo obsega', 'nudimo', 'opomba'].includes(key))
    .map(([key, value]) => `${key}: ${value.text}`).filter(x => x.length > 30);
  const description = [responsibilities && 'Delo obsega:\n' + responsibilities,
    requirements && 'Kaj pričakujemo:\n' + requirements,
    benefits && 'Nudimo:\n' + benefits, ...extra].filter(Boolean).join('\n\n');
  if (description.length < 50) throw Error('SPAR: opis delovnega mesta manjka');
  const notice = fields.get('opomba')?.text || '';
  const deadlineText = notice.match(/Rok za prijavo kandidatov:\s*(?:\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\s*-\s*)?(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/i)?.[1] || '';
  const deadline = slDate(deadlineText);
  if (deadline && deadline < today) return null;
  return {
    id: 'spar:' + parsed.pathname, source: 'SPAR Slovenija', company: 'SPAR Slovenija',
    url, title, location, date: '', deadline, description,
    ...(requirements ? { requirements } : {}),
    ...(responsibilities ? { responsibilities } : {}),
    ...(benefits ? { benefits } : {}),
    ...(category ? { jobCategory: category } : {}),
    ...(category === 'Študentsko delo' ? { employmentType: 'Študentsko delo' } : {}),
    ...(regions.length ? { regions } : {}),
    sparVerifiedAt: verifiedAt,
  };
}

export async function getSpar({ previous = [], fetchHtml = publicHtml,
  now = new Date().toISOString() } = {}) {
  const listed = new Map();
  const add = (html, category, region = '') => {
    for (const url of parseSparListingLinks(html)) {
      const item = listed.get(url) || { url, category, regions: [] };
      if (region && !item.regions.includes(region)) item.regions.push(region);
      listed.set(url, item);
    }
  };
  const categoryPages = await Promise.all(SECTIONS.map(([slug]) => fetchHtml(`${ORIGIN}/zaposlitev-spar/${slug}`)));
  categoryPages.forEach((html, index) => add(html, SECTIONS[index][1]));
  const stores = await fetchHtml(`${ORIGIN}/zaposlitev-spar/trgovine`);
  const regions = parseSparRegions(stores);
  if (!stores || regions.length < 5) throw Error('SPAR: manjkajo regijski seznami');
  for (let i = 0; i < regions.length; i += 3) {
    const batch = regions.slice(i, i + 3);
    const pages = await Promise.all(batch.map(fetchHtml));
    pages.forEach((html, j) => add(html, 'Trgovine', REGION_NAMES[batch[j].split('/').at(-1)]));
    if (i + 3 < regions.length) await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!listed.size) throw Error('SPAR: ni javnih oglasov na seznamih');
  const cached = new Map(previous.filter(job => job.source === 'SPAR Slovenija').map(job => [job.url, job]));
  const jobs = [];
  let requested = 0, failures = 0, removed = 0;
  const records = [...listed.values()];
  for (let i = 0; i < records.length; i += 3) {
    const batch = await Promise.all(records.slice(i, i + 3).map(async item => {
      const old = cached.get(item.url);
      const age = old?.sparVerifiedAt ? Date.parse(now) - Date.parse(old.sparVerifiedAt) : Infinity;
      if (old && age >= 0 && age < 14 * 86400_000 && (!old.deadline || old.deadline >= now.slice(0, 10))) {
        return { ...old, ...(item.regions.length ? { regions: item.regions } : {}) };
      }
      try {
        requested++;
        const html = await fetchHtml(item.url);
        if (!html) { removed++; return null; }
        return parseSparJob(html, item.url, item.category, item.regions, now.slice(0, 10), now);
      } catch (error) {
        failures++;
        console.warn(`SPAR: neuspelo preverjanje javnega oglasa (${String(error?.message || error)})`);
        return old && age >= 0 && age < 30 * 86400_000 &&
          (!old.deadline || old.deadline >= now.slice(0, 10)) ? old : null;
      }
    }));
    jobs.push(...batch.filter(Boolean));
    if (i + 3 < records.length) await new Promise(resolve => setTimeout(resolve, 190));
  }
  if (failures > Math.max(3, Math.floor(records.length * 0.15)) || !jobs.length) {
    throw Error(`SPAR: nepopoln zajem (${failures} napak, ${removed} umaknjenih)`);
  }
  console.log(`SPAR: ${jobs.length} izvirnih oglasov, ${requested} podrobnosti prek HTTP, ${removed} umaknjenih, ${failures} napak.`);
  return [...new Map(jobs.map(item => [item.id, item])).values()];
}

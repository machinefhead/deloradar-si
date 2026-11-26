import { jobPostingDetails, readableJobText } from './job-details.js';

// DelovnaMesta.si javno objavlja sitemap in JobPosting JSON-LD. Njihova pot
// /api/ je v robots.txt izključena, zato jo namerno ne uporabljamo. Ne
// zahtevamo strani LinkedIna (vključno z /jobs-guest/): izvirni URL je že v
// JSON-LD. Tako vir ne potrebuje prijave, ključa ali brskalnika.
const SITE = 'https://delovnamesta.si';
export const LINKEDIN_SOURCE = 'LinkedIn Jobs (prek DelovnaMesta.si)';
const SITEMAP = SITE + '/sitemap.xml';

async function publicText(url, maxBytes) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(18000),
    headers: { accept: 'text/html,application/xml;q=0.9', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' },
  });
  if (!response.ok) throw Error(`DelovnaMesta.si: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw Error('DelovnaMesta.si: predolg odgovor');
  const text = await response.text();
  if (text.length > maxBytes) throw Error('DelovnaMesta.si: predolg odgovor');
  return text;
}

// Šestmestni heksadecimalni zaključek označuje mešane oglase LinkedIna in
// kariernih strani. Samo iz zaključka NIKOLI ne sklepamo, da gre za LinkedIn.
export function parseDelovnaMestaSitemap(xml) {
  if (!/<urlset\b/i.test(xml)) throw Error('DelovnaMesta.si: sitemap nima seznama URL');
  const items = new Map();
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const url = match[1].match(/<loc>([^<]+)<\/loc>/i)?.[1]?.trim();
    if (!url || !/^https:\/\/delovnamesta\.si\/zaposlitev\/[a-z0-9-]+-[a-f\d]{6}$/i.test(url)) continue;
    const lastmod = match[1].match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/i)?.[1] || '';
    items.set(url, { url, lastmod });
  }
  if (!items.size) throw Error('DelovnaMesta.si: ni ustreznih oglasov v sitemap');
  return [...items.values()].sort((a, b) => b.lastmod.localeCompare(a.lastmod) || a.url.localeCompare(b.url));
}

function clean(value) {
  return readableJobText(value || '').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    '[e-poštni naslov na izvirni strani]').replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/]*\d{3}[ \-/]*\d{3,4}\b/g,
    '[telefon na izvirni strani]').trim();
}

function asCountry(value) {
  if (typeof value === 'string') return value.toUpperCase();
  return String(value?.name || '').toUpperCase();
}

function linkedinId(url) {
  try {
    const parsed = new URL(url);
    if (!/^(?:[a-z]{2,3}\.)?linkedin\.com$/i.test(parsed.hostname) || parsed.protocol !== 'https:') return null;
    const path = parsed.pathname.match(/^\/jobs\/view\/(?:[^/]*?-)?(\d{7,15})\/?$/i);
    return path?.[1] || null;
  } catch { return null; }
}

export function parseLinkedinPosting(html, listingUrl, now = new Date().toISOString().slice(0, 10)) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const schema = scripts.map(match => { try { return JSON.parse(match[1]); } catch { return null; } })
    .flatMap(value => Array.isArray(value) ? value : [value])
    .find(value => value?.['@type'] === 'JobPosting');
  if (!schema) throw Error('DelovnaMesta.si: manjkajoči JobPosting JSON-LD');
  const id = linkedinId(schema.url);
  if (!id) return null; // Drugi izvirni portali še niso LinkedIn.
  const locations = (Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]).filter(Boolean);
  const slovenia = locations.filter(place => ['SI', 'SLOVENIA', 'SLOVENIJA'].includes(asCountry(place?.address?.addressCountry)));
  const remote = (Array.isArray(schema.applicantLocationRequirements)
    ? schema.applicantLocationRequirements : [schema.applicantLocationRequirements]).filter(Boolean)
    .some(place => ['SI', 'SLOVENIA', 'SLOVENIJA'].includes(asCountry(place?.address?.addressCountry || place?.name)));
  if (!slovenia.length && !remote) return null;
  if (schema.validThrough && Number.isFinite(Date.parse(schema.validThrough)) &&
    String(schema.validThrough).slice(0, 10) < now) return null;
  const title = clean(schema.title).slice(0, 300);
  if (!title) return null;
  const location = slovenia.map(place => clean(place?.address?.addressLocality || '')).filter(Boolean)
    .filter((value, i, all) => all.indexOf(value) === i).join(', ');
  const company = clean(schema.hiringOrganization?.name || '').slice(0, 200);
  const parsed = jobPostingDetails(schema);
  const fields = Object.fromEntries(Object.entries(parsed).map(([key, value]) =>
    [key, typeof value === 'string' ? clean(value) : value]));
  const deadline = schema.validThrough ? String(schema.validThrough).slice(0, 10) : '';
  return {
    id: `linkedin:${id}`, source: LINKEDIN_SOURCE, title, company, location,
    date: /^\d{4}-\d{2}-\d{2}$/.test(schema.datePosted || '') ? schema.datePosted : '',
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : '',
    url: schema.url, viaUrl: listingUrl,
    ...fields,
  };
}

function scanLimit() {
  const raw = process.env.LINKEDIN_DM_SCAN_LIMIT;
  const value = raw === undefined ? 480 : Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 800 ? value : 480;
}

function balancedCandidates(candidates) {
  // Če pregledamo samo najnovejši datum spremembe, zajamemo predvsem sveže
  // prepisane agencijske oglase in premalo LinkedIna. Pregled razporedimo po
  // dnevih; vsako naslednje izvajanje nadaljuje tam, kjer smo ostali.
  const dates = [...new Set(candidates.map(item => item.lastmod))].sort().reverse();
  const byDate = dates.map(date => candidates.filter(item => item.lastmod === date));
  const result = [];
  for (let offset = 0; result.length < candidates.length; offset++) {
    for (const bucket of byDate) if (offset < bucket.length) result.push(bucket[offset]);
  }
  return result;
}

export async function getLinkedinViaDelovnaMesta({ previous = [], previousState = {},
  maxScan = scanLimit(), fetchText = publicText } = {}) {
  const candidates = parseDelovnaMestaSitemap(await fetchText(SITEMAP, 1_800_000));
  const active = new Map(candidates.map(item => [item.url, item.lastmod]));
  // Veljavni prejšnji vnosi in pregledani ne-LinkedIn oglasi ne potrebujejo
  // ponovnega HTTP klica, dokler se datum spremembe v sitemap ne spremeni.
  const checked = Object.fromEntries(Object.entries(previousState || {})
    .filter(([url, modified]) => active.get(url) === modified));
  const byUrl = new Map(previous.filter(job => job.source === LINKEDIN_SOURCE &&
    active.has(job.viaUrl) && checked[job.viaUrl] === active.get(job.viaUrl))
    .map(job => [job.viaUrl, job]));
  const pending = balancedCandidates(candidates.filter(item => !Object.hasOwn(checked, item.url))).slice(0, maxScan);
  let successful = 0, errors = 0;
  for (let start = 0; start < pending.length; start += 3) {
    const batch = pending.slice(start, start + 3);
    const results = await Promise.allSettled(batch.map(async item => {
      const html = await fetchText(item.url, 180_000);
      return parseLinkedinPosting(html, item.url);
    }));
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status === 'rejected') {
        errors++;
        console.warn('DeloRadar: preverjanje posrednega LinkedIn oglasa ni uspelo: ' +
          String(result.reason?.message || result.reason));
        continue;
      }
      successful++;
      checked[batch[index].url] = batch[index].lastmod;
      if (result.value) byUrl.set(batch[index].url, result.value);
    }
    if (start + 3 < pending.length) await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (errors && (successful === 0 || errors > Math.max(10, Math.floor(pending.length * 0.15)))) {
    throw Error(`DelovnaMesta.si: preveč neuspelih HTTP zahtevkov (${errors}/${pending.length})`);
  }
  const jobsById = new Map();
  for (const job of byUrl.values()) jobsById.set(job.id, job);
  const progress = { checked: Object.keys(checked).length, total: candidates.length,
    pending: candidates.length - Object.keys(checked).length, requested: pending.length,
    successful, errors };
  console.log(`DeloRadar: LinkedIn prek javnega JSON-LD: ${jobsById.size} oglasov, ` +
    `pregledanih ${progress.checked}/${progress.total} kandidatov; HTTP ${successful} uspešnih, ${errors} napak.`);
  if (!jobsById.size && progress.checked >= 20) throw Error('DelovnaMesta.si: ni potrjenih slovenskih LinkedIn oglasov');
  return { jobs: [...jobsById.values()], state: checked, progress };
}

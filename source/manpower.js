import { readableJobText } from './job-details.js';

const HOST = 'https://www.manpower.si';
const LIST = HOST + '/sl/delovna-mesta';

const REGION_NAMES = new Map([
  ['gorenjska', 'Gorenjska'], ['goriška', 'Goriška'],
  ['jugovzhodna slovenija', 'Jugovzhodna Slovenija'], ['koroška', 'Koroška'],
  ['obalno-kraška', 'Obalno-kraška'], ['osrednjeslovenska', 'Osrednjeslovenska'],
  ['podravska', 'Podravska'], ['pomurska', 'Pomurska'], ['posavska', 'Posavska'],
  ['primorsko-notranjska', 'Primorsko-notranjska'], ['savinjska', 'Savinjska'],
  ['zasavska', 'Zasavska'],
]);

function onlyJobUrl(path) {
  try {
    const url = new URL(path, HOST);
    return url.origin === HOST && /^\/sl\/job-posts\/[a-z0-9/-]+$/i.test(url.pathname) && !url.search
      ? url.href : null;
  } catch { return null; }
}

function dateISO(date) {
  const match = String(date).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [day, month, year] = match.slice(1).map(Number);
  const actual = new Date(Date.UTC(year, month - 1, day));
  return actual.getUTCFullYear() === year && actual.getUTCMonth() === month - 1 && actual.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}

function companyAndLocation(card, description) {
  const region = readableJobText(card.match(/class="job-city[^\"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '');
  const inSummary = description.match(/(?:Lokacija dela|Kraj dela)\s*:\s*([^\n.]{2,70})/i)?.[1]?.trim();
  const location = inSummary && !/\b(regija|tujina)\b/i.test(inSummary) ? inSummary :
    (region ? region + (REGION_NAMES.has(region.toLowerCase().replace(/ regija$/i, '')) ? ' (regija)' : '') : '');
  const mapped = REGION_NAMES.get(region.toLowerCase().replace(/ regija$/i, ''));
  return { company: 'Manpower Slovenija', location,
    ...(mapped ? { regions: [mapped] } : {}) };
}

export function parseManpowerListings(html) {
  if (typeof html !== 'string' || html.length > 2_000_000) throw Error('Manpower: neveljaven HTML');
  const starts = [...html.matchAll(/<div class="card p-lg-8 p-5 justify-content-between mb-5[^\"]*">/g)];
  return starts.flatMap((found, i) => {
    const card = html.slice(found.index, starts[i + 1]?.index || html.length);
    const id = card.match(/href="\/sl\/job-posts-preview\?job_id=(\d{4,12})&amp;dp=1"/)?.[1] ||
      card.match(/href="\/sl\/job-posts-preview\?job_id=(\d{4,12})&dp=1"/)?.[1];
    const titleLink = card.match(/<a href="(\/sl\/job-posts\/[^\"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const url = titleLink && onlyJobUrl(titleLink[1]);
    const title = readableJobText(titleLink?.[2] || '');
    const date = dateISO(card.match(/<span[^>]*>(\d{2}\/\d{2}\/\d{4})<\/span>/)?.[1]);
    if (!id || !url || !title || !date) return [];
    const summary = readableJobText(card.match(/class="text-grey-03 fs-19 lh-25 truncate-multiline"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '');
    const category = readableJobText(card.match(/class="category-item[^\"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1] || '');
    const workplaceType = readableJobText(card.match(/class="job-type[^\"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '');
    return [{ id: 'manpower:' + id, source: 'Manpower Slovenija', title, url, date,
      ...companyAndLocation(card, summary), ...(summary ? { summary, description: summary } : {}),
      ...(category ? { jobCategory: category } : {}), ...(workplaceType ? { workplaceType } : {}) }];
  });
}

export function parseManpowerDetails(html, listing) {
  if (typeof html !== 'string' || html.length > 1_000_000 || !listing?.id) return null;
  const main = html.match(/class="job-posts-page"[^>]*>([\s\S]*?)<div class="talent-db-cta/)?.[1];
  if (!main) return null;
  const heading = readableJobText(main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '');
  const normalize = value => readableJobText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!heading || normalize(heading) !== normalize(listing.title)) return null;
  const sections = {};
  for (const match of main.matchAll(/<h6[^>]*>([\s\S]*?)<\/h6>([\s\S]*?)(?=<h6\b|$)/gi)) {
    const label = readableJobText(match[1]).toLowerCase();
    let raw = match[2];
    // V vsebino ne prenašamo kontaktnih oseb in telefonskih številk iz CTA.
    raw = raw.split(/V kolikor ustrezate razpisanim pogojem|Za več informacij (?:pokličite|pišite)/i)[0];
    sections[label] = readableJobText(raw);
  }
  const description = sections.opis || sections['kratek opis'];
  if (!description || description.length < 30) return null;
  const details = { description,
    ...(sections.zahteve ? { requirements: sections.zahteve } : {}),
    ...(sections.ponudba ? { benefits: sections.ponudba } : {}),
  };
  if (sections['kratek opis']) details.summary = sections['kratek opis'];
  return details;
}

async function htmlGet(url, fetchImpl, timeoutMs) {
  const reply = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!reply.ok) throw Error('Manpower HTTP ' + reply.status);
  if (!String(reply.headers.get('content-type')).includes('html')) throw Error('Manpower: odgovor ni HTML');
  const raw = await reply.text();
  if (Buffer.byteLength(raw) > 2_000_000) throw Error('Manpower: predolg odgovor');
  return raw;
}

export async function getManpower({ fetchImpl = fetch, previous = [], maxPages = 12,
  maxDetails = 20, timeoutMs = 15_000, now = Date.now() } = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20 ||
      !Number.isInteger(maxDetails) || maxDetails < 0 || maxDetails > 80 ||
      !Array.isArray(previous)) throw Error('Manpower: neveljaven načrt zajema');
  const jobs = [], seen = new Set();
  let finished = false;
  for (let page = 0; page < maxPages; page++) {
    const html = await htmlGet(LIST + '?page=' + page, fetchImpl, timeoutMs);
    const entries = parseManpowerListings(html);
    if (!entries.length) {
      if (!page) throw Error('Manpower: seznam je prazen');
      finished = true;
      break;
    }
    for (const item of entries) {
      if (seen.has(item.id)) throw Error('Manpower: ponovljeni ID v straničenju');
      seen.add(item.id);
      jobs.push(item);
    }
    if (!/rel="next"/.test(html)) { finished = true; break; }
  }
  if (!finished || !jobs.length) throw Error('Manpower: straničenje ni končano ali je prazno');
  const oldById = new Map(previous.filter(job => job.source === 'Manpower Slovenija').map(job => [job.id, job]));
  const pending = [];
  const merged = jobs.map(job => {
    const old = oldById.get(job.id);
    const age = now - Date.parse(old?.detailsFetchedAt || '');
    if (old?.url === job.url && old?.date === job.date && old.description &&
        Number.isFinite(age) && age >= 0 && age < 14 * 86_400_000) {
      return { ...job, description: old.description, summary: old.summary || job.summary,
        ...(old.requirements ? { requirements: old.requirements } : {}),
        ...(old.benefits ? { benefits: old.benefits } : {}), detailsFetchedAt: old.detailsFetchedAt };
    }
    pending.push(job.id);
    return job;
  });
  const requested = pending.slice(0, maxDetails), byId = new Map(merged.map(job => [job.id, job]));
  let position = 0, enriched = 0, failed = 0;
  async function worker() {
    while (position < requested.length && failed < 8) {
      const id = requested[position++], job = byId.get(id);
      try {
        const details = parseManpowerDetails(await htmlGet(job.url, fetchImpl, timeoutMs), job);
        if (!details) throw Error('Manpower: opis ali naslov se ne ujemata');
        Object.assign(job, details, { detailsFetchedAt: new Date(now).toISOString() });
        enriched++;
      } catch { failed++; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, requested.length) }, worker));
  console.log(`Manpower HTTP: ${jobs.length} oglasov, ${enriched} novih celotnih opisov, ` +
    `${jobs.length - pending.length} svežih opisov iz predpomnilnika, ${failed} napak.`);
  return merged;
}

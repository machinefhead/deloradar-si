// Krka: anonimni javni seznam njihovega uradnega Cornerstone Career Site.
// Celoten opis je v istem javnem odgovoru; ni dodatnih zahtevkov za 17 oglasov.
import { readableJobText } from './job-details.js';

export const KRKA_SOURCE = 'Krka, d. d., Novo mesto';
export const KRKA_URL = 'https://krka.csod.com/ux/ats/careersite/13/home?c=krka&lang=sl-SI';
const KRKA_API = 'https://eu-fra.api.csod.com/rec-job-search/external/jobs';
const PAGE_SIZE = 25;
const MAX_PAGES = 6;
const REQUEST_DELAY_MS = 10_000; // Krkin robots.txt zahteva Crawl-delay: 10.

function isoDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (!match) return '';
  const day = +match[1], month = +match[2], year = +match[3];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function strippedText(raw) {
  return readableJobText(raw)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/.]*\d{3}[ \-/.]*\d{3,4}\b/g, '')
    .trim();
}

export function parseKrkaContext(html) {
  const found = String(html || '').match(/csod\.context\s*=\s*(\{.*?\});/s);
  if (!found) throw Error('Krka: javna konfiguracija strani manjka');
  const context = JSON.parse(found[1]);
  if (context.corp !== 'krka' || context.cultureName !== 'sl-SI' ||
      context.endpoints?.cloud !== 'https://eu-fra.api.csod.com/' ||
      !Number.isInteger(context.cultureID) || typeof context.token !== 'string' ||
      context.token.length < 100) throw Error('Krka: nepričakovana konfiguracija javnega iskalnika');
  return { token: context.token, cultureId: context.cultureID, cultureName: context.cultureName };
}

export function parseKrkaListing(data, { now = new Date().toISOString() } = {}) {
  if (!data || !Array.isArray(data.requisitions) ||
      !Number.isInteger(data.totalCount) || data.totalCount < 0 || data.totalCount > MAX_PAGES * PAGE_SIZE) {
    throw Error('Krka: nepopoln seznam javnih razpisov');
  }
  const ljubljanaDate = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Ljubljana',
  }).format(new Date(now));
  const jobs = [], ids = new Set();
  let expired = 0, foreign = 0, general = 0;
  for (const record of data.requisitions) {
    const id = String(record?.requisitionId || '');
    if (!/^\d{3,9}$/.test(id) || ids.has(id)) throw Error('Krka: manjkajoč ali podvojen ID');
    ids.add(id);
    const locations = record.locations;
    if (!Array.isArray(locations) || !locations.length) throw Error(`Krka: ${id} nima lokacije`);
    if (locations.every(loc => loc.country !== 'SI')) { foreign++; continue; }
    if (locations.some(loc => loc.country && loc.country !== 'SI')) {
      throw Error(`Krka: ${id} meša slovenske in tuje lokacije`);
    }
    const title = strippedText(record.displayJobTitle).slice(0, 300);
    const location = [...new Set(locations.filter(loc => loc.country === 'SI')
      .map(loc => strippedText(loc.city || '')).filter(Boolean))].join(', ').slice(0, 200) || 'Slovenija';
    const description = strippedText(record.externalDescription).slice(0, 4500);
    const deadline = isoDate(record.postingExpirationDate);
    if (/SPLOŠNA BAZA|SPLOŠNA PRIJAVA|SAMOINICIATIVNA PRIJAVA/i.test(title)) {
      general++;
      continue;
    }
    if (!title || !location || description.length < 30 || !deadline) {
      throw Error(`Krka: ${id} nima vseh obveznih javnih podatkov`);
    }
    if (deadline < ljubljanaDate) { expired++; continue; }
    jobs.push({ id: `krka:${id}`, source: KRKA_SOURCE, title,
      company: KRKA_SOURCE, location, description, date: '', deadline,
      url: `https://krka.csod.com/ux/ats/careersite/13/home/requisition/${id}?c=krka&lang=sl-SI` });
  }
  return { jobs, ids, expired, foreign, general };
}

function responseSize(response, maxBytes) {
  if (response.status !== 200) throw Error('Krka: javni vir HTTP ' + response.status);
  if (Number(response.headers.get('content-length') || 0) > maxBytes) {
    throw Error('Krka: prevelik odgovor');
  }
}

export async function getKrka({ fetchImpl = fetch, now = new Date().toISOString(),
  pauseMs = REQUEST_DELAY_MS } = {}) {
  if (!Number.isFinite(Date.parse(now)) || !Number.isInteger(pauseMs) || pauseMs < 0) {
    throw Error('Krka: neveljavni parametri zajema');
  }
  const homepage = await fetchImpl(KRKA_URL, {
    headers: { accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(20_000),
  });
  responseSize(homepage, 100_000);
  const html = await homepage.text();
  if (html.length > 100_000) throw Error('Krka: prevelika javna konfiguracija');
  const context = parseKrkaContext(html);
  const jobs = [], ids = new Set();
  let totalCount, expired = 0, foreign = 0, general = 0;
  for (let page = 1; page <= (totalCount === undefined ? 1 : Math.ceil(totalCount / PAGE_SIZE)); page++) {
    // Razmik med zahtevki ščiti tudi anonimni javni iskalnik.
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
    const body = { careerSiteId: '13', careerSitePageId: '13', pageNumber: page, pageSize: PAGE_SIZE,
      cultureId: context.cultureId, cultureName: context.cultureName, searchText: '',
      states: [], countryCodes: [], cities: [], placeID: '', radius: '', postingsWithinDays: '',
      customFieldCheckboxKeys: [], customFieldDropdowns: [], customFieldRadios: [] };
    const response = await fetchImpl(KRKA_API, { method: 'POST', redirect: 'manual',
      signal: AbortSignal.timeout(25_000),
      headers: { authorization: `Bearer ${context.token}`, 'csod-accept-language': context.cultureName,
        accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    responseSize(response, 2_000_000);
    const content = await response.text();
    if (content.length > 2_000_000) throw Error('Krka: prevelik seznam');
    const envelope = JSON.parse(content);
    if (!envelope.data || !Array.isArray(envelope.data.requisitions)) {
      throw Error('Krka: javni podatkovni odgovor manjka');
    }
    if (totalCount === undefined) totalCount = envelope.data.totalCount;
    if (!Number.isInteger(totalCount) || totalCount < 1 || totalCount > MAX_PAGES * PAGE_SIZE ||
        envelope.data.totalCount !== totalCount ||
        envelope.data.requisitions.length !== Math.min(PAGE_SIZE, totalCount - (page - 1) * PAGE_SIZE)) {
      throw Error('Krka: nepopolno ali spremenjeno straničenje');
    }
    const parsed = parseKrkaListing(envelope.data, { now });
    for (const id of parsed.ids) {
      if (ids.has(id)) throw Error('Krka: dvojnik med stranmi');
      ids.add(id);
    }
    jobs.push(...parsed.jobs);
    expired += parsed.expired;
    foreign += parsed.foreign;
    general += parsed.general;
  }
  if (!jobs.length) throw Error('Krka: nič veljavnih slovenskih oglasov; obdrži prejšnjo objavo');
  console.log(`Krka: ${jobs.length} slovenskih razpisov v ${Math.ceil(totalCount / PAGE_SIZE)} ` +
    `omejenih javnih poizvedbah, ${expired} poteklih, ${foreign} tujih, ${general} splošnih prijav.`);
  return { jobs, progress: { checked: ids.size, total: totalCount, pending: false,
    expired, foreign, general } };
}

import { readableJobText } from './job-details.js';

// Dokumentiran javni seznam Workable. details=true vrne opis v istem JSON-u;
// več vrstic z istim shortcode pomenijo različne lokacije istega razpisa.
export const WORKABLE_BOARDS = [
  { id: 'povio', name: 'Povio', account: 'povio', url: 'https://apply.workable.com/povio/' },
  { id: 'dploy', name: 'D-ploy', account: 'd-ploy', url: 'https://apply.workable.com/d-ploy/' },
  { id: 'laundryheap', name: 'Laundryheap', account: 'laundryheap-2', url: 'https://apply.workable.com/laundryheap-2/' },
  { id: 'sofmedica', name: 'SOFMEDICA', account: 'sofmedica', url: 'https://apply.workable.com/sofmedica/' },
];

function clean(value) {
  return readableJobText(value)
    .split('\n').filter(line => !/(?:feel free to (?:reach out|contact)|for (?:more information|recruitment inquiries).*contact|kontaktna oseba|kontaktirajte|recruiter\s*:)/i.test(line))
    .join('\n')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '')
    .trim();
}

function isSlovenia(value) {
  return String(value?.countryCode || '').toUpperCase() === 'SI' ||
    /^(?:Slovenia|Slovenija)$/i.test(String(value?.country || '').trim());
}

function safeJobUrl(value, id, account) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'apply.workable.com' ||
        url.username || url.password || url.search || url.hash) return '';
    const segments = url.pathname.split('/').filter(Boolean);
    return ((segments.length === 2 && segments[0] === 'j' && segments[1] === id) ||
      (segments.length === 3 && segments[0] === account && segments[1] === 'j' && segments[2] === id))
      ? url.href : '';
  } catch { return ''; }
}

function publishedDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d/.test(value)) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

export function parseWorkableJobs(payload, config) {
  if (!WORKABLE_BOARDS.some(item => item.id === config?.id && item.account === config.account) ||
      !payload || !Array.isArray(payload.jobs) || payload.jobs.length > 1000) {
    throw Error('Workable: neznan vir ali neveljaven seznam');
  }
  const selected = new Map();
  for (const raw of payload.jobs) {
    const locations = Array.isArray(raw?.locations) ? raw.locations : [];
    const inSlovenia = locations.some(isSlovenia) || (!locations.length && isSlovenia(raw));
    if (!inSlovenia) continue;
    const id = String(raw.shortcode || '').toUpperCase();
    const title = clean(raw.title);
    const url = safeJobUrl(raw.url, id, config.account);
    const description = clean(raw.description);
    if (!/^[A-F0-9]{10}$/.test(id) || !title || !url || !description) {
      throw Error('Workable: slovenski oglas brez stabilnega ID-ja, naslova ali opisa');
    }
    if (!selected.has(id)) selected.set(id, { raw, id, title, url, description, cities: new Set() });
    const entry = selected.get(id);
    if (entry.title !== title || entry.url !== url) throw Error('Workable: različna zapisa z istim ID-jem');
    for (const location of locations.filter(isSlovenia)) {
      if (location.hidden) continue;
      const city = clean(location.city);
      if (city) entry.cities.add(city);
    }
    if (!locations.length && isSlovenia(raw)) {
      const city = clean(raw.city);
      if (city) entry.cities.add(city);
    }
  }
  return [...selected.values()].map(({ raw, id, title, url, description, cities }) => {
    const places = [...cities];
    const department = clean(raw.department || raw.function);
    const employment = clean(raw.employment_type);
    return {
      id: 'workable:' + config.account + ':' + id,
      source: config.name, company: config.name, title, url, description,
      location: places.join(' / ') || 'Slovenija (kraj ni naveden)',
      ...(places.length > 1 ? { locations: places } : {}),
      date: publishedDate(raw.published_on), deadline: '',
      ...(department ? { jobCategory: department } : {}),
      ...(employment ? { employmentType: employment } : {}),
      ...(raw.telecommuting === true ? { workplaceType: 'Delo na daljavo (možno)' } : {}),
    };
  });
}

export async function getPublicWorkableBoard(config, { fetchImpl = fetch, timeoutMs = 25_000 } = {}) {
  if (!WORKABLE_BOARDS.some(item => item.id === config?.id && item.account === config.account)) {
    throw Error('Workable: neznan vir');
  }
  // Končna javna pot Workable widgeta: ne potrebujemo dodatnega HTTP 302
  // prehoda z www.workable.com, en GET vrne vse opise in lokacije.
  const url = 'https://apply.workable.com/api/v1/widget/accounts/' + config.account + '?details=true';
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!response.ok) throw Error('Workable: HTTP ' + response.status);
  if (!/json/i.test(response.headers.get('content-type') || '')) throw Error('Workable: odgovor ni JSON');
  if (response.url && !['www.workable.com', 'apply.workable.com'].includes(new URL(response.url).hostname)) {
    throw Error('Workable: nepričakovana preusmeritev');
  }
  const body = await response.text();
  if (Buffer.byteLength(body) > 4_000_000) throw Error('Workable: prevelik odgovor');
  const jobs = parseWorkableJobs(JSON.parse(body), config);
  console.log(`Workable ${config.name}: ${jobs.length} slovenskih oglasov z opisom iz enega JSON odgovora.`);
  return jobs;
}

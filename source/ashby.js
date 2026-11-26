import { readableJobText } from './job-details.js';

// Ashby javni Job Board JSON vsebuje opis, lokacijo in neposredni URL v
// istem odgovoru, zato ne potrebujemo dodatnih obiskov posameznih oglasov.
export const ASHBY_BOARDS = [
  { id: 'xds', name: 'XDS', board: 'xds', url: 'https://jobs.ashbyhq.com/xds' },
  { id: 'sunrise', name: 'Sunrise Robotics', board: 'sunrise', url: 'https://jobs.ashbyhq.com/sunrise' },
  { id: 'paradox', name: 'Paradox', board: 'paradox', url: 'https://jobs.ashbyhq.com/paradox' },
  { id: 'axelera', name: 'Axelera AI', board: 'axelera', url: 'https://jobs.ashbyhq.com/axelera' },
  { id: 'n8n', name: 'n8n', board: 'n8n', url: 'https://jobs.ashbyhq.com/n8n' },
  { id: 'rubylabs', name: 'Ruby Labs', board: 'ruby-labs', url: 'https://jobs.ashbyhq.com/ruby-labs' },
];

function clean(value) {
  return readableJobText(value).split('\n')
    .filter(line => !/^\s*(?:kontakt|contact)\s*:/i.test(line) &&
      !/\b(?:contact (?:our|the) recruiter|recruitment inquiries|kontaktna oseba|kontaktirajte)\b/i.test(line))
    .join('\n')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '').trim();
}

function isSlovenia(value) {
  return /\b(?:Slovenia|Slovenija)\b/i.test(String(value || ''));
}

function slovenianPlaces(raw) {
  // Ashby pri slovenskih mestih pogosto zapiše samo »Ljubljana« ali »CET +/- 3«.
  // Uradni strukturirani addressCountry je močnejši dokaz od ugibanja iz naslova.
  const locations = [{ location: raw.location, address: raw.address },
    ...(Array.isArray(raw.secondaryLocations) ? raw.secondaryLocations.map(item =>
      typeof item === 'string' ? { location: item } : item) : [])];
  const places = [];
  for (const item of locations) {
    const country = String(item?.address?.postalAddress?.addressCountry || '').trim();
    const label = String(item?.location || '').trim();
    if (!/^(?:SI|Slovenia|Slovenija)$/i.test(country) && !isSlovenia(label)) continue;
    const locality = clean(item?.address?.postalAddress?.addressLocality || '');
    const isRemote = /\bremote\b/i.test(label) || /\bremote\b/i.test(raw.workplaceType || '');
    const city = locality || (label.match(/\b(?:Ljubljana|Maribor|Celje|Koper|Kranj|Ptuj|Novo mesto)\b/i) || [])[0];
    const place = city || (isRemote ? 'Slovenija (delo na daljavo)' : 'Slovenija (kraj ni naveden)');
    if (!places.includes(place)) places.push(place);
  }
  // Če je naveden tudi konkreten slovenski kraj, izločimo splošno oznako države.
  return places.some(place => !place.startsWith('Slovenija ('))
    ? places.filter(place => !place.startsWith('Slovenija (')) : places;
}

function directUrl(value, board, id) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'jobs.ashbyhq.com' &&
      !url.username && !url.password && !url.search && !url.hash &&
      url.pathname.replace(/\/$/, '') === '/' + board + '/' + id ? url.href : '';
  } catch { return ''; }
}

export function parseAshbyBoard(payload, config) {
  if (!ASHBY_BOARDS.some(board => board.id === config?.id && board.board === config.board) ||
      !Array.isArray(payload?.jobs) || payload.jobs.length > 1000) {
    throw Error('Ashby: neznan vir ali neveljavni javni podatki');
  }
  const jobs = [];
  for (const raw of payload.jobs) {
    if (raw?.isListed !== true || /\b(?:talent pool|open application|general application)\b/i.test(raw.title || '')) continue;
    const locations = slovenianPlaces(raw);
    if (!locations.length) continue;
    const id = String(raw.id || ''), title = clean(raw.title);
    const url = directUrl(raw.jobUrl, config.board, id);
    const description = clean(raw.descriptionPlain || raw.descriptionHtml);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !title || !url || !description) {
      throw Error('Ashby: slovenski oglas brez ID-ja, naslova, URL-ja ali opisa');
    }
    const date = typeof raw.publishedAt === 'string' && /^\d{4}-\d\d-\d\d/.test(raw.publishedAt) &&
      Number.isFinite(Date.parse(raw.publishedAt)) ? raw.publishedAt.slice(0, 10) : '';
    const places = locations;
    const employment = clean(raw.employmentType);
    const department = clean(raw.department || raw.team);
    const workplace = clean(raw.workplaceType);
    jobs.push({ id: 'ashby:' + config.board + ':' + id, source: config.name, company: config.name,
      title, url, description, location: places.join(' / '),
      ...(places.length > 1 ? { locations: places } : {}), date, deadline: '',
      ...(employment ? { employmentType: employment } : {}),
      ...(department ? { jobCategory: department } : {}),
      ...(workplace ? { workplaceType: workplace } : {}),
    });
  }
  if (new Set(jobs.map(item => item.id)).size !== jobs.length) throw Error('Ashby: podvojeni ID-ji');
  return jobs;
}

export async function getPublicAshbyBoard(config, { fetchImpl = fetch, timeoutMs = 25_000 } = {}) {
  if (!ASHBY_BOARDS.some(board => board.id === config?.id && board.board === config.board)) {
    throw Error('Ashby: neznan vir');
  }
  const url = 'https://api.ashbyhq.com/posting-api/job-board/' + config.board + '?includeCompensation=true';
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) {
    throw Error('Ashby: API ni vrnil veljavnega JSON-a (' + response.status + ')');
  }
  const body = await response.text();
  if (Buffer.byteLength(body) > 4_000_000) throw Error('Ashby: prevelik seznam');
  const jobs = parseAshbyBoard(JSON.parse(body), config);
  console.log(`Ashby ${config.name}: ${jobs.length} slovenskih razpisov z opisom iz enega JSON odgovora.`);
  return jobs;
}

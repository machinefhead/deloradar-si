import { readableJobText } from './job-details.js';

// Ashby javni Job Board JSON vsebuje opis, lokacijo in neposredni URL v
// istem odgovoru, zato ne potrebujemo dodatnih obiskov posameznih oglasov.
export const ASHBY_BOARDS = [
  { id: 'xds', name: 'XDS', board: 'xds', url: 'https://jobs.ashbyhq.com/xds' },
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
    const locations = [raw.location, ...(raw.secondaryLocations || []).map(item =>
      typeof item === 'string' ? item : item.location)].filter(isSlovenia)
      .map(item => clean(item).replace(/,?\s*Slovenia\s*$/i, '').trim());
    if (!locations.length) continue;
    const id = String(raw.id || ''), title = clean(raw.title);
    const url = directUrl(raw.jobUrl, config.board, id);
    const description = clean(raw.descriptionPlain || raw.descriptionHtml);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !title || !url || !description) {
      throw Error('Ashby: slovenski oglas brez ID-ja, naslova, URL-ja ali opisa');
    }
    const date = typeof raw.publishedAt === 'string' && /^\d{4}-\d\d-\d\d/.test(raw.publishedAt) &&
      Number.isFinite(Date.parse(raw.publishedAt)) ? raw.publishedAt.slice(0, 10) : '';
    const places = [...new Set(locations.filter(Boolean))];
    const employment = clean(raw.employmentType);
    const department = clean(raw.department || raw.team);
    const workplace = clean(raw.workplaceType);
    jobs.push({ id: 'ashby:' + config.board + ':' + id, source: config.name, company: config.name,
      title, url, description, location: places.join(' / ') || 'Slovenija (kraj ni naveden)',
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

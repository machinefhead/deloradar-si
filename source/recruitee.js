import { readableJobText } from './job-details.js';

// Uradni javni Careers Site API. En JSON odgovor vsebuje vse aktivne
// ponudbe, zahteve, opis in izvirni URL (brez klicev prijavnih obrazcev).
const FEED = 'https://merkurzavarovalnica.recruitee.com/api/offers/';
const ORIGIN = 'https://merkurzavarovalnica.recruitee.com';

function clean(value) {
  return readableJobText(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?<!\d)(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '')
    .trim();
}

function dateOnly(value) {
  if (!value) return '';
  const normalized = String(value).replace(/ UTC$/, 'Z').replace(' ', 'T');
  return /^\d{4}-\d\d-\d\d/.test(normalized) && Number.isFinite(Date.parse(normalized))
    ? normalized.slice(0, 10) : '';
}

export function parseMerkurRecruitee(data, today = new Date().toISOString().slice(0, 10)) {
  if (!Array.isArray(data?.offers) || data.offers.length > 1000) throw Error('Recruitee: neveljaven seznam');
  const jobs = [];
  for (const offer of data.offers) {
    if (offer?.status !== 'published') continue;
    const isSlovenia = offer.country_code === 'SI' || (offer.locations || [])
      .some(location => location?.country_code === 'SI');
    if (!isSlovenia) continue;
    const deadline = dateOnly(offer.close_at);
    if (deadline && deadline < today) continue;
    const id = String(offer.id || ''), title = clean(offer.title).slice(0, 300);
    let url = '';
    try {
      const parsed = new URL(offer.careers_url);
      if (parsed.origin === ORIGIN && /^\/o\/[a-z0-9-]+\/?$/i.test(parsed.pathname) &&
          !parsed.username && !parsed.password && !parsed.search && !parsed.hash) url = parsed.href;
    } catch { /* Ne objavljamo nepovezljivih oglasov. */ }
    const description = clean(offer.description);
    const requirements = clean(offer.requirements);
    if (!/^\d+$/.test(id) || !title || !url || description.length < 50) {
      throw Error('Recruitee: slovenski razpis nima veljavnega ID-ja, URL-ja ali opisa');
    }
    const location = clean(offer.city || offer.location || '') || 'Slovenija';
    jobs.push({ id: 'recruitee:merkur:' + id, source: 'Merkur zavarovalnica',
      company: 'Merkur zavarovalnica', title, location, url, date: dateOnly(offer.created_at),
      deadline, description: requirements ? `${description}\n\nZahteve:\n${requirements}` : description,
      ...(requirements ? { requirements } : {}),
      ...(clean(offer.department) ? { jobCategory: clean(offer.department) } : {}),
      ...(clean(offer.employment_type) ? { employmentType: clean(offer.employment_type) } : {}),
    });
  }
  if (new Set(jobs.map(item => item.id)).size !== jobs.length) throw Error('Recruitee: podvojeni ID-ji');
  return jobs;
}

export async function getMerkurRecruitee({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(FEED, { signal: AbortSignal.timeout(25_000),
    headers: { accept: 'application/json', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) {
    throw Error(`Recruitee: javni JSON ni dosegljiv (${response.status})`);
  }
  const body = await response.text();
  if (Buffer.byteLength(body) > 1_000_000) throw Error('Recruitee: prevelik JSON odgovor');
  const jobs = parseMerkurRecruitee(JSON.parse(body));
  if (!jobs.length) throw Error('Recruitee: ni aktivnih slovenskih oglasov');
  console.log(`Merkur zavarovalnica: ${jobs.length} izvirnih oglasov z opisom iz enega JSON odgovora.`);
  return jobs;
}

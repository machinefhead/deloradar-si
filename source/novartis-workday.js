import { readableJobText } from './job-details.js';

// Novartisov javni Workday CXS: poizvedba s filtrom lokacije Slovenija,
// straničenje in neposredni HTTP opisi. Brez interaktivnega odpiranja oglasov.
const CXS = 'https://novartis.wd3.myworkdayjobs.com/wday/cxs/novartis/Novartis_Careers';
const BOARD = 'https://novartis.wd3.myworkdayjobs.com/en-US/Novartis_Careers';
export const NOVARTIS_SOURCE = { id: 'novartis', name: 'Novartis', url: 'https://www.novartis.com/si-en/careers/career-search' };

function text(value) {
  return readableJobText(value).split('\n')
    .filter(line => !/^\s*(?:kontakt|contact)\s*:/i.test(line) &&
      !/\b(?:kontaktna oseba|kontaktirajte|for recruitment inquiries contact|contact the recruiter)\b/i.test(line))
    .join('\n')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '').trim();
}

function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d/.test(value)) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function linkAndId(path) {
  if (typeof path !== 'string' || !/^\/job\/[^/?#]+\/[^/?#]+$/.test(path)) return null;
  const match = path.match(/_REQ-\d{7,10}(?:-\d+)?$/);
  if (!match) return null;
  return { id: 'novartis:' + match[0].slice(1), url: BOARD + path };
}

function countryFacet(payload) {
  const group = payload?.facets?.find(item => item.facetParameter === 'locationMainGroup');
  const countries = group?.values?.find(item => item.facetParameter === 'locationCountry');
  const match = countries?.values?.find(item => item.descriptor === 'Slovenia');
  return typeof match?.id === 'string' && /^[a-f0-9]{32}$/i.test(match.id) ? match.id : '';
}

export function parseNovartisJob(raw, detail, sloveniaFacetId) {
  const identity = linkAndId(raw?.externalPath);
  const job = detail?.jobPostingInfo;
  const primarySlovenia = job?.country?.descriptor === 'Slovenia' ||
    (typeof sloveniaFacetId === 'string' && !!sloveniaFacetId && job?.country?.id === sloveniaFacetId);
  const additional = Array.isArray(job?.additionalLocations) ? job.additionalLocations : [];
  // Delovno mesto je lahko objavljeno za Slovenijo in tujino, primarni kraj
  // pa je v drugi državi. Tam vzamemo izrecno navedeni slovenski sekundarni kraj.
  const slovenianSecondary = additional.filter(location =>
    /\b(?:Ljubljana|Mengeš|Maribor|Celje|Koper|Kranj|Novo mesto|Ptuj)\b/i.test(String(location)));
  if (!identity || !job || (!primarySlovenia && !slovenianSecondary.length) ||
      !text(job.title) || !text(job.jobDescription) || job.canApply === false) return null;
  const locations = [...new Set([...(primarySlovenia ? [job.location] : []), ...slovenianSecondary]
    .map(text).filter(Boolean))];
  const location = locations.join(' / ');
  const employmentType = text(job.timeType);
  return {
    ...identity, source: NOVARTIS_SOURCE.name, company: NOVARTIS_SOURCE.name,
    title: text(job.title), location: location || 'Slovenija (kraj ni naveden)',
    ...(locations.length > 1 ? { locations } : {}),
    date: day(job.startDate), deadline: '', description: text(job.jobDescription),
    ...(employmentType ? { employmentType } : {}),
  };
}

async function requestJson(url, fetchImpl, timeoutMs, body) {
  const response = await fetchImpl(url, { ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}),
      'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!response.ok) throw Error('Novartis Workday: HTTP ' + response.status);
  if (!/json/i.test(response.headers.get('content-type') || '')) throw Error('Novartis Workday: odgovor ni JSON');
  const data = await response.text();
  if (Buffer.byteLength(data) > 5_000_000) throw Error('Novartis Workday: prevelik odgovor');
  return JSON.parse(data);
}

function getPrevious(previous, identity, title, now, maxDays = 14) {
  const found = previous.find(job => job.id === identity.id && job.title === title);
  if (!found?.description || !found.detailsFetchedAt) return null;
  const age = now - Date.parse(found.detailsFetchedAt);
  return Number.isFinite(age) && age >= 0 && age < maxDays * 86_400_000 ? found : null;
}

export async function getNovartisWorkday({ fetchImpl = fetch, previous = [], now = Date.now(),
  timeoutMs = 25_000, maxNewDetails = 100 } = {}) {
  // Imena držav in njihovi ID-ji so podatki iz uradnega odziva; ne kodiramo
  // nestabilnega Workday UUID-ja, saj se lahko med konfiguracijami spreminja.
  const discovery = await requestJson(CXS + '/jobs', fetchImpl, timeoutMs,
    { appliedFacets: {}, limit: 20, offset: 0, searchText: 'Slovenia' });
  const facetId = countryFacet(discovery);
  if (!facetId) throw Error('Novartis Workday: filter države Slovenija ni na voljo');
  const list = [];
  let total = null;
  for (let offset = 0; offset < (total ?? 20); offset += 20) {
    const result = await requestJson(CXS + '/jobs', fetchImpl, timeoutMs,
      { appliedFacets: { locationCountry: [facetId] }, limit: 20, offset, searchText: '' });
    // Workday lahko pri naslednjih straneh vrne total=0, četudi so oglasi
    // prisotni. Kot merilo popolnosti uporabljamo total prve strani in ID-je.
    if (!Number.isInteger(result.total) || result.total < 0 || result.total > 200 ||
        !Array.isArray(result.jobPostings) ||
        (total != null && result.total !== 0 && result.total !== total)) {
      throw Error('Novartis Workday: neveljavno straničenje');
    }
    if (total === null) total = result.total;
    if (result.jobPostings.length !== Math.min(20, total - offset)) {
      throw Error('Novartis Workday: nepopoln seznam slovenskih razpisov');
    }
    list.push(...result.jobPostings);
  }
  const identities = list.map(row => linkAndId(row.externalPath));
  if (identities.some(item => !item) || new Set(identities.map(item => item.id)).size !== list.length) {
    throw Error('Novartis Workday: manjkajoči ali podvojeni stabilni ID-ji');
  }
  const output = new Array(list.length);
  let requested = 0, reused = 0;
  for (let offset = 0; offset < list.length; offset += 3) {
    await Promise.all(list.slice(offset, offset + 3).map(async (raw, index) => {
      const position = offset + index;
      const identity = identities[position], title = text(raw.title);
      const cached = getPrevious(previous, identity, title, now);
      if (cached) {
        output[position] = { ...cached, url: identity.url };
        reused++;
        return;
      }
      if (requested >= maxNewDetails) {
        output[position] = { ...identity, source: NOVARTIS_SOURCE.name,
          company: NOVARTIS_SOURCE.name, title,
          location: raw.locationsText === '2 Locations' ? 'Slovenija (kraj ni naveden)' : text(raw.locationsText),
          date: '', deadline: '' };
        return;
      }
      requested++;
      try {
        const detail = await requestJson(CXS + raw.externalPath, fetchImpl, timeoutMs);
        const parsed = parseNovartisJob(raw, detail, facetId);
        if (!parsed) throw Error('Novartis Workday: nepričakovana država, ID ali opis');
        output[position] = { ...parsed, detailsFetchedAt: new Date(now).toISOString() };
      } catch (error) {
        const stale = getPrevious(previous, identity, title, now, 30);
        if (!stale) throw error;
        output[position] = { ...stale, url: identity.url };
        reused++;
      }
    }));
    if (offset + 3 < list.length) await new Promise(resolve => setTimeout(resolve, 180));
  }
  const jobs = output.filter(Boolean);
  if (jobs.length !== list.length) throw Error('Novartis Workday: nepopoln slovenski zajem');
  console.log(`Novartis Workday: ${jobs.length} slovenskih oglasov, ${requested} HTTP opisov, ${reused} iz predpomnilnika.`);
  return jobs;
}

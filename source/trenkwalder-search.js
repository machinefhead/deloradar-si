import { readableJobText } from './job-details.js';

// Trenkwalderjeva javna stran /jobs uporablja Algolia search-only odjemalca.
// Ključ za branje vsakokrat razberemo iz javnega JS, nikoli ga ne shranimo v git.
// Ne zahtevamo njihove v robots.txt izključene poti /api/* in ne odpiramo oglasov.
const SITE = 'https://si.trenkwalder.com';
const ALGOLIA_APP = '02IH9HMLGA';
const INDEX = 'PROD_SI_New_Index_1_date';
const SEARCH = `https://${ALGOLIA_APP}-dsn.algolia.net/1/indexes/${INDEX}/query`;

function text(value) {
  return readableJobText(value || '').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/.]*\d{3}[ \-/.]*\d{3,4}\b/g, '').trim();
}

export function parseTrenkwalderHits(hits, now = new Date().toISOString().slice(0, 10)) {
  if (!Array.isArray(hits)) throw Error('Trenkwalder: neveljavni zadetki');
  const jobs = [];
  for (const hit of hits) {
    if (hit?.publishingStatus !== 'Published' || hit.country !== 'SI') continue;
    const id = String(hit.objectID || '');
    const url = hit.web?.jobUrl || '';
    if (!/^a0t[a-zA-Z0-9]{12,20}$/.test(id) || url !== `${SITE}/jobs/${id}`) {
      throw Error('Trenkwalder: neveljavna neposredna povezava');
    }
    const title = text(hit.jobObject?.title).slice(0, 300);
    const place = text(hit.jobLocation?.location);
    const location = /^slovenia|slovenija$/i.test(place) ? 'Slovenija (kraj ni naveden)' : place;
    if (!title) throw Error('Trenkwalder: oglas brez naziva');
    const deadline = /^\d{4}-\d\d-\d\d/.test(hit.jobParams?.endDate || '')
      ? hit.jobParams.endDate.slice(0, 10) : '';
    if (deadline && deadline < now) continue;
    const sections = hit.jobContent || {};
    const description = [sections.companyInformation, sections.jobDescription]
      .map(text).filter(Boolean).join('\n\n');
    const requirements = text(sections.jobRequirements);
    const benefits = text(sections.compensationBenefits);
    if (!description && !requirements) throw Error('Trenkwalder: manjkajoča vsebina oglasa');
    const date = /^\d{4}-\d\d-\d\d/.test(hit.web?.jobAdDate || '')
      ? hit.web.jobAdDate.slice(0, 10) : '';
    const categories = Array.isArray(hit.jobObject?.jobCategory) ? hit.jobObject.jobCategory : [];
    const category = text(categories.map(value => value?.national || value?.en).filter(Boolean).join(' / '));
    const hours = Number(hit.jobInfo?.hoursPerWeek);
    const salaryMin = Number(hit.jobInfo?.salaryMin);
    const salaryMax = Number(hit.jobInfo?.salaryMax);
    const salary = hit.jobInfo?.publishSalary === true &&
      (Number.isFinite(salaryMin) && salaryMin > 0 || Number.isFinite(salaryMax) && salaryMax > 0)
      ? { currency: hit.jobInfo.currency || 'EUR',
        ...(salaryMin > 0 ? { minValue: salaryMin } : {}),
        ...(salaryMax > 0 ? { maxValue: salaryMax } : {}),
        unit: text(hit.jobInfo?.salaryPeriod?.national || 'Mesec') }
      : null;
    jobs.push({ id: `trenkwalder:${url}`, source: 'Trenkwalder', company: 'Trenkwalder',
      title, location, date, deadline, url, description,
      ...(requirements ? { requirements } : {}), ...(benefits ? { benefits } : {}),
      ...(category ? { jobCategory: category } : {}),
      ...(hours > 0 && hours <= 168 ? { workHours: `${hours} ur na teden` } : {}),
      ...(salary ? { salary } : {}),
    });
  }
  if (new Set(jobs.map(item => item.id)).size !== jobs.length) throw Error('Trenkwalder: podvojeni oglasi');
  return jobs;
}

export async function getPublicTrenkwalder({ fetchImpl = fetch } = {}) {
  const request = async (url, options = {}) => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(25_000),
      headers: { accept: 'text/html,application/javascript,application/json',
        'user-agent': 'DeloRadar/0.1 (personal job listing index)', ...options.headers }, ...options });
    if (!response.ok) throw Error(`Trenkwalder: HTTP ${response.status}`);
    const content = await response.text();
    if (content.length > 3_000_000) throw Error('Trenkwalder: prevelik odgovor');
    return content;
  };
  const page = await request(SITE + '/jobs');
  const appScript = [...page.matchAll(/<script[^>]*src=["']([^"']+\/_app-[^"']+\.js)["']/gi)][0]?.[1];
  if (!appScript) throw Error('Trenkwalder: manjka javni odjemalec iskalnika');
  const scriptUrl = new URL(appScript, SITE);
  if (scriptUrl.hostname !== 'si.trenkwalder.com' || !scriptUrl.pathname.startsWith('/_next/static/')) {
    throw Error('Trenkwalder: neznan odjemalec');
  }
  const client = await request(scriptUrl.href);
  // V njihovi javni JS kodi sta dva različno omejena ključa. Uporabimo
  // prvega za iskanje (search-only), ne analitičnega ključa.
  const searchKey = client.match(/em\("02IH9HMLGA","([a-f\d]{32})"\)/i)?.[1];
  if (!searchKey) throw Error('Trenkwalder: javni iskalni ključ ni dosegljiv');
  const all = [];
  let total = 0;
  for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
    const response = JSON.parse(await request(SEARCH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-algolia-application-id': ALGOLIA_APP,
        'x-algolia-api-key': searchKey },
      body: JSON.stringify({ params: new URLSearchParams({ query: '', filters: 'publishingStatus:Published',
        hitsPerPage: '100', page: String(pageIndex) }).toString() }),
    }));
    if (!Number.isInteger(response.nbHits) || response.nbHits < 0 || response.nbHits > 500 ||
        !Array.isArray(response.hits) || response.hits.length > 100) {
      throw Error('Trenkwalder: neveljavno število zadetkov');
    }
    if (pageIndex === 0) total = response.nbHits;
    if (response.nbHits !== total) throw Error('Trenkwalder: seznam se je med prenosom spremenil');
    all.push(...response.hits);
    if (all.length >= total) break;
    if (!response.hits.length) throw Error('Trenkwalder: manjka stran rezultatov');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (all.length !== total) throw Error(`Trenkwalder: nepopoln zajem ${all.length}/${total}`);
  const jobs = parseTrenkwalderHits(all);
  console.log(`Trenkwalder: ${jobs.length} celotnih slovenskih oglasov iz ${Math.ceil(total / 100)} javnih iskalnih odgovorov.`);
  return jobs;
}

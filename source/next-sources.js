// Dodatni javni seznami delodajalcev in portalov.
// Razpoložljive podatke JobPosting dopolnimo brez dodatnih obiskov strani.
import { jobPostingDetails } from './job-details.js';

const DM_LIST = 'https://www.dm-jobs.si/job-listing/';
const NOVA_SITEMAP = 'https://novapriloznost.si/job_listing-sitemap.xml';

function tidy(value) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').trim()
    : '';
}

async function getPublicText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(16_000),
    headers: {
      accept: 'text/html,application/xml;q=0.9',
      'user-agent': 'DeloRadar/0.1 (non-commercial job metadata index)',
    },
  });
  if (!response.ok) throw Error('HTTP ' + response.status);
  if (Number(response.headers.get('content-length')) > 2_000_000) throw Error('Prevelik odgovor vira');
  const content = await response.text();
  if (content.length > 2_000_000) throw Error('Prevelik odgovor vira');
  return content;
}

export function parseDmListings(html, now = Date.now()) {
  const raw = html.match(/<script\b[^>]*id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) throw Error('dm: javni seznam nima podatkov');
  const nodes = JSON.parse(raw);
  if (!Array.isArray(nodes) || nodes.length > 30_000) throw Error('dm: nepričakovana oblika seznama');
  const summary = nodes.find(item => item && !Array.isArray(item) && typeof item === 'object' &&
    Number.isInteger(item.count) && Number.isInteger(item.jobs) && Array.isArray(nodes[item.jobs]));
  if (!summary) throw Error('dm: število oglasov ni razvidno');
  const count = nodes[summary.count], references = nodes[summary.jobs];
  // Javni HTML ima največ 10 zapisov na stran. Dokler ni preverjeno
  // straničenje, ne prikazujemo nepopolnega nabora kot celotnega.
  if (!Number.isInteger(count) || count < 0 || count > 500 || references.length !== count) {
    throw Error('dm: nepopoln seznam; potrebno je straničenje');
  }
  const jobs = new Map();
  for (const reference of references) {
    const item = nodes[reference];
    if (!item || typeof item !== 'object') throw Error('dm: neveljaven zapis oglasa');
    const id = tidy(nodes[item.jobId]), title = tidy(nodes[item.title]);
    const url = tidy(nodes[item.jobInviteUrl]);
    if (!/^\d{3,10}$/.test(id) || !title ||
        !new RegExp('^https://www\\.dm-jobs\\.si/job/[^/]+/' + id + '/?$').test(url)) {
      throw Error('dm: neveljaven javni URL ali ID');
    }
    // Samoiniciativne prijave niso razpisana prosta delovna mesta.
    if (/samoiniciativna prijava/i.test(title)) continue;
    const due = Date.parse(tidy(nodes[item.postEndDate]));
    if (Number.isFinite(due) && due < now) continue;
    const address = tidy(nodes[item.altAddress]);
    const addressRefs = nodes[item.addresses];
    const firstAddress = Array.isArray(addressRefs) ? nodes[addressRefs[0]] : null;
    const actualCity = firstAddress && tidy(nodes[firstAddress.city] || nodes[firstAddress.altCity]);
    // Poštni kraj se lahko razlikuje od dejanskega kraja dela.
    const town = actualCity || address.match(/\b\d{4}\s+(.+)$/)?.[1] || address;
    jobs.set(id, { id: 'dm:' + id, source: 'dm Slovenija', title, company: 'dm Slovenija',
      location: town, date: '', deadline: Number.isFinite(due) ? new Date(due).toISOString() : '', url });
  }
  return [...jobs.values()];
}

export async function getDm() {
  return parseDmListings(await getPublicText(DM_LIST));
}

export function parseNovaPriloznostSitemap(xml) {
  if (!/<urlset\b/i.test(xml)) throw Error('Nova Priložnost: sitemap manjka');
  const links = new Map();
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const value = block[1].match(/<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/i)?.[1]?.trim();
    if (!value) continue;
    let url;
    try { url = new URL(value); } catch { continue; }
    const match = url.pathname.match(/^\/delovno-mesto\/([a-z0-9-]+)\/?$/i);
    if (url.origin !== 'https://novapriloznost.si' || !match) continue;
    url.search = ''; url.hash = '';
    links.set(url.href, { id: 'novapriloznost:' + match[1], url: url.href });
  }
  if (links.size > 300) throw Error('Nova Priložnost: nepričakovano velik seznam');
  return [...links.values()];
}

export function parseNovaPriloznostJob(html, listing, now = Date.now()) {
  let data;
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      data = nodes.find(item => item && (item['@type'] === 'JobPosting' || item['@type']?.includes?.('JobPosting')));
      if (data) break;
    } catch { /* Neveljavna pomožna shema ni JobPosting. */ }
  }
  if (!data) throw Error('Nova Priložnost: oglas nima strukturiranih podatkov');
  const title = tidy(data.title);
  const until = Date.parse(data.validThrough || '');
  if (!title || !Number.isFinite(until)) throw Error('Nova Priložnost: manjka naslov ali rok');
  if (until < now) return null;
  const places = Array.isArray(data.jobLocation) ? data.jobLocation : [data.jobLocation];
  const address = places[0]?.address;
  const country = typeof address === 'object' ? address?.addressCountry?.name || address?.addressCountry : '';
  if (country && !/^(SI|Slovenia|Slovenija)$/i.test(country)) return null;
  const location = typeof address === 'string' ? address : address?.addressLocality || '';
  const posted = Date.parse(data.datePosted || '');
  return {
    id: listing.id, source: 'Nova Priložnost', title,
    company: tidy(data.hiringOrganization?.name || ''),
    location: tidy(location),
    date: Number.isFinite(posted) ? new Date(posted).toISOString() : '',
    deadline: new Date(until).toISOString(), url: listing.url,
    ...jobPostingDetails(data),
  };
}

export async function getNovaPriloznost() {
  const listings = parseNovaPriloznostSitemap(await getPublicText(NOVA_SITEMAP));
  if (!listings.length) throw Error('Nova Priložnost: ni veljavnih URL-jev v sitemapu');
  const jobs = [];
  for (let i = 0; i < listings.length; i += 3) {
    const batch = await Promise.all(listings.slice(i, i + 3).map(async listing =>
      parseNovaPriloznostJob(await getPublicText(listing.url), listing)));
    jobs.push(...batch.filter(Boolean));
    if (i + 3 < listings.length) await new Promise(resolve => setTimeout(resolve, 200));
  }
  return [...new Map(jobs.map(job => [job.id, job])).values()];
}

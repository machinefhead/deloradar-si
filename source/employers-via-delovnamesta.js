import { jobPostingDetails, readableJobText } from './job-details.js';

// Javni seznami slovenskih podjetij z JobPosting JSON-LD: originalni URL
// preverimo proti domeni izvirnega delodajalca. /api/* ni dovoljena pot in je
// nikoli ne uporabljamo. Na 12-urni gradnji običajno preberemo le sezname,
// opis posameznega oglasa pa ponovno preverimo na 14 dni.
const SITE = 'https://delovnamesta.si';
export const EMPLOYER_MIRRORS = [
  { id: 'novartis', name: 'Novartis', slugs: ['novartis-lek', 'novartis-in-slovenia', 'novartis-farmacevtska-proizvodnja'], hosts: ['novartis.wd3.myworkdayjobs.com'], url: 'https://www.novartis.com/si-en/careers/career-search' },
  { id: 'sandoz', name: 'Sandoz', slugs: ['sandoz'], hosts: ['sandoz.wd103.myworkdayjobs.com'], url: 'https://www.sandoz.com/careers' },
  { id: 'akrapovic', name: 'Akrapovič', slugs: ['akrapovic'], hosts: ['jobs.akrapovic.com'], url: 'https://jobs.akrapovic.com/' },
  { id: 'rcs', name: 'RCS agencija', slugs: ['rcs'], hosts: ['www.rcsagencija.si'], url: 'https://www.rcsagencija.si/' },
  { id: 'palfinger', name: 'Palfinger', slugs: ['palfinger'], hosts: ['career.palfinger.com'], url: 'https://career.palfinger.com/' },
  { id: 'unior', name: 'Unior', slugs: ['unior'], hosts: ['www.unior.si'], url: 'https://www.unior.si/' },
  { id: 'minor', name: 'Minor Hotels', slugs: ['minor-hotels'], hosts: ['euamcareers.minorhotels.com'], url: 'https://euamcareers.minorhotels.com/' },
  { id: 'arriva', name: 'Arriva Slovenija', slugs: ['arriva-slovenija'], hosts: ['arriva.si'], url: 'https://arriva.si/' },
  { id: 'hrm', name: 'HRM rešitve', slugs: ['hrm-resitve'], hosts: ['hrm-resitve.si'], url: 'https://hrm-resitve.si/' },
  { id: 'eversum', name: 'eVersum', slugs: ['eversum'], hosts: ['eversum.bamboohr.com'], url: 'https://eversum.bamboohr.com/careers/list' },
  { id: 'freudenberg', name: 'Freudenberg', slugs: ['freudenberg'], hosts: ['freudenberg.wd3.myworkdayjobs.com'], url: 'https://www.freudenberg.com/career' },
  { id: 'litostroj', name: 'Litostroj Power', slugs: ['litostroj-power'], hosts: ['litostroj-power.breezy.hr'], url: 'https://litostroj-power.breezy.hr/' },
  { id: 'viaduct', name: 'Viaduct', slugs: ['viaduct'], hosts: ['www.viaduct.ai'], url: 'https://www.viaduct.ai/about/careers' },
  { id: 'kraken', name: 'Kraken', slugs: ['kraken'], hosts: ['jobs.ashbyhq.com'], pathPrefix: '/kraken.com/', url: 'https://jobs.ashbyhq.com/kraken.com' },
  { id: 'kolektorsisteh', name: 'Kolektor Sisteh', slugs: ['kolektor-sisteh'], hosts: ['www.kolektorsisteh.si'], url: 'https://www.kolektorsisteh.si/kariera' },
  { id: 'ey', name: 'EY', slugs: ['ey'], hosts: ['careers.ey.com'], pathPrefix: '/ey/job/', url: 'https://careers.ey.com/' },
  { id: 'setcce', name: 'SETCCE', slugs: ['setcce'], hosts: ['www.careers-page.com'], pathPrefix: '/setcce-careers/job/', url: 'https://www.careers-page.com/setcce-careers' },
  { id: 'decathlon', name: 'Decathlon Slovenija', slugs: ['decathlon'], hosts: ['jobs.decathlon.net'], pathPrefix: '/sl/open-roles-detail/', url: 'https://jobs.decathlon.net/sl/' },
  { id: 'mahle', name: 'MAHLE', slugs: ['mahle'], hosts: ['careers.mahle.com'], pathPrefix: '/job/', url: 'https://careers.mahle.com/' },
  { id: 'gitlab', name: 'GitLab', slugs: ['gitlab'], hosts: ['job-boards.greenhouse.io'], pathPrefix: '/gitlab/jobs/', url: 'https://job-boards.greenhouse.io/gitlab' },
  { id: 'supabase', name: 'Supabase', slugs: ['supabase'], hosts: ['jobs.ashbyhq.com'], pathPrefix: '/supabase/', url: 'https://jobs.ashbyhq.com/supabase' },
  { id: 'posthog', name: 'PostHog', slugs: ['posthog'], hosts: ['jobs.ashbyhq.com'], pathPrefix: '/PostHog/', url: 'https://jobs.ashbyhq.com/PostHog' },
  { id: 'pivovarna', name: 'Pivovarna Laško Union', slugs: ['pivovarna-lasko-union'], hosts: ['theheinekencompany-rmk.jobs.hr.cloud.sap'], pathPrefix: '/Slovenia/job/', url: 'https://careers.theheinekencompany.com/' },
  { id: 'otp', name: 'OTP banka', slugs: ['otp'], hosts: ['otpbanka.fledgehr.com', 'nkbm.fledgehr.com'], pathPrefix: '/jobs/', url: 'https://otpbanka.fledgehr.com/jobs' },
];

// Največ tri vzporedne zahteve skupaj čez vse delodajalce iz istega vira.
let active = 0;
const pending = [];
async function limited(fn) {
  if (active >= 3) await new Promise(resolve => pending.push(resolve));
  active++;
  try { return await fn(); }
  finally {
    await new Promise(resolve => setTimeout(resolve, 120));
    active--;
    pending.shift()?.();
  }
}

async function publicText(url) {
  return limited(async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000),
      headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
    if (!response.ok) throw Error(`DelovnaMesta.si: HTTP ${response.status}`);
    const content = await response.text();
    if (content.length > 300_000) throw Error('DelovnaMesta.si: prevelik javni odgovor');
    return content;
  });
}

export function parseEmployerListings(html) {
  const links = new Set();
  for (const match of html.matchAll(/<h3 class="title"><a href="(\/zaposlitev\/[a-z0-9-]+)"/gi)) {
    links.add(SITE + match[1]);
  }
  return [...links];
}

function clean(value) {
  return readableJobText(value || '').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/.]*\d{3}[ \-/.]*\d{3,4}\b/g, '').trim();
}

function country(value) {
  return String(typeof value === 'string' ? value : value?.name || '').toUpperCase();
}

export function parseEmployerPosting(html, viaUrl, config, now = new Date().toISOString().slice(0, 10)) {
  if (!EMPLOYER_MIRRORS.some(item => item.id === config?.id)) throw Error('Neznan delodajalec');
  const script = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!script) throw Error('DelovnaMesta.si: manjkajoči JobPosting');
  const schema = JSON.parse(script);
  if (schema['@type'] !== 'JobPosting') throw Error('DelovnaMesta.si: nepričakovani podatki');
  let url;
  try {
    const parsed = new URL(schema.url);
    if (parsed.protocol !== 'https:' || !config.hosts.includes(parsed.hostname) ||
        (config.pathPrefix && !parsed.pathname.startsWith(config.pathPrefix)) ||
        parsed.username || parsed.password || parsed.pathname === '/') return null;
    url = parsed.href;
  } catch { return null; }
  const places = (Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]).filter(Boolean);
  const slovene = places.filter(place => ['SI', 'SLOVENIA', 'SLOVENIJA'].includes(country(place?.address?.addressCountry)));
  const remote = (Array.isArray(schema.applicantLocationRequirements)
    ? schema.applicantLocationRequirements : [schema.applicantLocationRequirements]).filter(Boolean)
    .some(place => ['SI', 'SLOVENIA', 'SLOVENIJA'].includes(country(place?.address?.addressCountry || place?.name)));
  if (!slovene.length && !remote) return null;
  const deadline = /^\d{4}-\d\d-\d\d/.test(schema.validThrough || '') ? schema.validThrough.slice(0, 10) : '';
  if (deadline && deadline < now) return null;
  const title = clean(schema.title).slice(0, 300);
  const details = jobPostingDetails(schema);
  const description = clean(details.description);
  if (!title || description.length < 60) throw Error('DelovnaMesta.si: nepopoln izvirni oglas');
  const location = [...new Set(slovene.map(item => clean(item.address?.addressLocality)).filter(Boolean))].join(', ')
    || (remote ? 'Slovenija (delo na daljavo)' : 'Slovenija (kraj ni naveden)');
  const date = /^\d{4}-\d\d-\d\d/.test(schema.datePosted || '') ? schema.datePosted.slice(0, 10) : '';
  const publicFields = Object.fromEntries(Object.entries(details).map(([key, value]) =>
    [key, typeof value === 'string' ? clean(value) : value]));
  return {
    id: `employer:${config.id}:${url}`, source: config.name, company: clean(schema.hiringOrganization?.name || config.name),
    title, location, date, deadline, url, viaUrl, ...publicFields,
    mirrorVerifiedAt: new Date().toISOString(),
  };
}

export async function getEmployerViaDelovnaMesta(config, { previous = [], fetchText = publicText,
  now = new Date().toISOString() } = {}) {
  if (!EMPLOYER_MIRRORS.some(item => item.id === config?.id)) throw Error('Neznan delodajalec');
  const pages = await Promise.all(config.slugs.map(slug => fetchText(`${SITE}/podjetje/${slug}`)));
  const listing = [...new Set(pages.flatMap(parseEmployerListings))];
  const cached = new Map(previous.filter(item => item.source === config.name && item.viaUrl)
    .map(item => [item.viaUrl, item]));
  const refreshed = [];
  let failures = 0, requested = 0;
  for (const viaUrl of listing) {
    const old = cached.get(viaUrl);
    const age = old?.mirrorVerifiedAt ? Date.parse(now) - Date.parse(old.mirrorVerifiedAt) : Infinity;
    if (old && age >= 0 && age < 14 * 86400_000 && (!old.deadline || old.deadline >= now.slice(0, 10))) {
      refreshed.push(old);
      continue;
    }
    try {
      requested++;
      const job = parseEmployerPosting(await fetchText(viaUrl), viaUrl, config, now.slice(0, 10));
      if (job) refreshed.push(job);
    } catch (error) {
      failures++;
      if (old && age >= 0 && age < 30 * 86400_000 &&
          (!old.deadline || old.deadline >= now.slice(0, 10))) refreshed.push(old);
      console.warn(`${config.name}: podrobnosti niso dosegljive: ${String(error?.message || error)}`);
    }
  }
  if (failures > Math.max(2, Math.floor(listing.length * 0.15)) ||
      (listing.length && !refreshed.length)) {
    throw Error(`${config.name}: nepopoln javni HTTP zajem (${failures}/${listing.length})`);
  }
  const unique = [...new Map(refreshed.map(job => [job.id, job])).values()];
  console.log(`${config.name}: ${unique.length} izvirnih oglasov, ${requested} podrobnih HTTP preverjanj, ${failures} napak.`);
  return unique;
}

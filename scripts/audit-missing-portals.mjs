// Diagnostični HTTP pregled: koliko javnih izvirnih oglasov z manjkajočih
// kariernih strani dejansko še ni v DeloRadarju? Ne shranjuje/objavlja oglasov.
import { readFile } from 'node:fs/promises';

const groups = {
  Novartis: ['novartis-lek', 'novartis-in-slovenia', 'novartis-farmacevtska-proizvodnja'],
  Lek: ['lek'],
  'Pošta Slovenije': ['posta-slovenije'],
  'Slovenske železnice': ['slovenske-zeleznice'],
  SPAR: ['spar'],
  Petrol: ['petrol'],
  Sandoz: ['sandoz'],
  'Akrapovič': ['akrapovic'],
  Krka: ['krka'],
  Prohuman: ['prohuman-slovenia'],
  'HSG Kariera': ['hsg-kariera'],
  Trenkwalder: ['trenkwalder'],
  RCS: ['rcs'],
  Palfinger: ['palfinger'],
  n8n: ['n8n'],
  Unior: ['unior'],
  'Minor Hotels': ['minor-hotels'],
  Arriva: ['arriva-slovenija'],
  OTP: ['otp'],
  'HRM rešitve': ['hrm-resitve'],
  'Ruby Labs': ['ruby-labs'],
};
const snapshot = JSON.parse(await readFile('dist/jobs.json', 'utf8'));
const exists = new Set(snapshot.jobs.map(job => job.url));
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const existingTitles = new Set(snapshot.jobs.map(job => normalized(job.title)));
const host = value => { try { return new URL(value).hostname; } catch { return ''; } };
async function html(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(18000),
    headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job index)' },
  });
  if (!response.ok) throw Error(`${new URL(url).hostname} ${response.status}`);
  const result = await response.text();
  if (result.length > 300_000) throw Error('Predolg javni HTML odgovor');
  return result;
}
function jobsInCompany(htmlSource) {
  return [...new Set([...htmlSource.matchAll(/<h3 class="title"><a href="(\/zaposlitev\/[^\"]+)"/gi)]
    .map(match => 'https://delovnamesta.si' + match[1]))];
}
function structured(htmlSource) {
  const match = htmlSource.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  const data = JSON.parse(match[1]);
  return data['@type'] === 'JobPosting' ? data : null;
}
const results = {};
const seenUrls = new Set();
for (const [group, slugs] of Object.entries(groups)) {
  if (process.argv.includes('--delaj-only')) continue;
  const selected = process.argv.find(arg => arg.startsWith('--groups='))?.slice('--groups='.length)?.split(',');
  if (selected && !selected.includes(group)) continue;
  try {
    const pages = await Promise.all(slugs.map(slug => html(`https://delovnamesta.si/podjetje/${slug}`)));
    const urls = [...new Set(pages.flatMap(jobsInCompany))];
    const entries = [];
    for (let start = 0; start < urls.length; start += 3) {
      const batch = await Promise.allSettled(urls.slice(start, start + 3).map(async url =>
        ({ listing: url, job: structured(await html(url)) })));
      for (const result of batch) {
        if (result.status === 'rejected') entries.push({ error: String(result.reason?.message || result.reason) });
        else if (result.value.job) entries.push(result.value);
      }
      if (start + 3 < urls.length) await new Promise(resolve => setTimeout(resolve, 200));
    }
    const detail = entries.filter(item => item.job).map(item => ({
      url: item.job.url || '', source: host(item.job.url), title: item.job.title || '',
      desc: String(item.job.description || '').length,
    }));
    const fromOriginal = detail.filter(job => !seenUrls.has(job.url) && seenUrls.add(job.url));
    const firstParty = fromOriginal.filter(job => !/linkedin\.com|ess\.gov\.si|europa\.eu/i.test(job.source));
    const byHost = Object.fromEntries([...new Set(detail.map(job => job.source))].map(name =>
      [name, detail.filter(job => job.source === name).length]).sort((a, b) => b[1] - a[1]));
    results[group] = { publicListings: urls.length, details: detail.length, errors: entries.length - detail.length,
      alreadySameUrl: detail.filter(job => exists.has(job.url)).length,
      likelyExistingTitle: detail.filter(job => existingTitles.has(normalized(job.title))).length,
      firstPartyNotSeen: firstParty.filter(job => !exists.has(job.url)).length,
      firstPartyWithFullText: firstParty.filter(job => !exists.has(job.url) && job.desc > 100).length,
      linkedin: detail.filter(job => /linkedin\.com/.test(job.source)).length,
      zrszEures: detail.filter(job => /ess\.gov\.si|europa\.eu/.test(job.source)).length,
      byHost };
  } catch (error) {
    results[group] = { error: String(error?.message || error) };
  }
  console.log(group + ': ' + JSON.stringify(results[group]));
}
console.log('Skupaj presojamo samo že objavljene javne URL/JobPosting; ne štejejo kot nova delovna mesta, dokler ni preverjen izvirnik.');

async function delajSlovenia() {
  const links = new Set();
  const counts = [];
  for (let page = 1; page <= 4; page++) {
    const url = page === 1 ? 'https://delaj.si/oglasi/?drzava=SI'
      : `https://delaj.si/oglasi/page/${page}/?drzava=SI`;
    const pageHtml = await html(url);
    const visibleCount = pageHtml.match(/(\d+) aktivnih oglasov/)?.[1];
    if (visibleCount) counts.push(Number(visibleCount));
    for (const match of pageHtml.matchAll(/href="(https:\/\/delaj\.si\/oglas\/[^"?#]+)"/g)) links.add(match[1]);
  }
  const entries = [];
  for (let start = 0; start < links.size; start += 3) {
    const batch = [...links].slice(start, start + 3);
    const results = await Promise.allSettled(batch.map(async url => ({ url, content: await html(url) })));
    for (const result of results) {
      if (result.status === 'rejected') entries.push({ error: String(result.reason?.message || result.reason) });
      else {
        const { url, content } = result.value;
        const job = structured(content);
        const government = content.match(/https:\/\/www\.gov\.si\/zbirke\/delovna-mesta\/[^"<> ]+/)?.[0] || '';
        entries.push({ url, job, government });
      }
    }
    if (start + 3 < links.size) await new Promise(resolve => setTimeout(resolve, 150));
  }
  const original = entries.filter(item => item.job);
  return { reportedSlovenia: counts[0], listingLinks: links.size, errors: entries.filter(item => item.error).length,
    structuredOriginal: original.length, withFullText: original.filter(item =>
      String(item.job.description || '').length > 100).length,
    withSameTitleInDeloRadar: original.filter(item => existingTitles.has(normalized(item.job.title))).length,
    governmentDuplicates: entries.filter(item => item.government).length };
}
try { console.log('Delaj.si: ' + JSON.stringify(await delajSlovenia())); }
catch (error) { console.log('Delaj.si: ' + String(error?.message || error)); }

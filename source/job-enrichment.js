import { jobPostingDetails, readableJobText } from './job-details.js';

// Podatke dopolnimo samo iz običajnih javnih prikazov posameznih razpisov.
// Kontaktov posameznikov in osebnih podatkov prijaviteljev ne zbiramo.
const FIELDS = [
  'description', 'summary', 'responsibilities', 'requirements', 'benefits', 'skills',
  'employmentType', 'contractType', 'contractDuration', 'workHours', 'workplaceType',
  'workplaceAddress', 'education', 'experience', 'salary', 'incentives', 'jobCategory',
  'deadline', 'detailsFetchedAt',
];

function text(value, maximum = 25000) {
  return readableJobText(value).slice(0, maximum).trim();
}

function translated(value) {
  if (Array.isArray(value)) return value.map(translated).filter(Boolean).join('\n');
  if (!value || typeof value !== 'object') return text(value);
  return text(value.translation || value.name || '');
}

function isoDate(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : '';
}

export function parseMojeDeloDetails(response, job) {
  const data = response?.data;
  const identifier = String(job?.id || '').replace(/^mojedelo:/, '');
  if (!data || String(data.id || '') !== identifier) return null;
  const localized = Array.isArray(data.jobAdTranslations) ?
    data.jobAdTranslations.find(entry => entry?.title === job.title) || data.jobAdTranslations[0] || {} : {};
  const field = name => text(data[name] || localized[name]);
  const details = {
    description: field('jobDescription'),
    summary: field('adSummary'),
    requirements: field('weExpect'),
    benefits: field('weOffer'),
    employmentType: translated(data.employmentTypes),
    workHours: translated(data.workTime),
    workplaceType: translated(data.workModes),
    education: translated(data.educationLevels),
    experience: translated(data.totalWorkExperience),
    jobCategory: translated(data.jobCategories),
    deadline: isoDate(data.endDate),
  };
  // Zapis o delodajalcu je lahko tudi osebni kontakt; uporabimo le podatke oglasa.
  if (!details.description && !details.summary && !details.requirements && !details.benefits) return null;
  return Object.fromEntries(Object.entries(details).filter(([, value]) => !!value));
}

function postingNodes(payload) {
  if (Array.isArray(payload)) return payload.flatMap(postingNodes);
  if (!payload || typeof payload !== 'object') return [];
  const nested = Array.isArray(payload['@graph']) ? payload['@graph'].flatMap(postingNodes) : [];
  return [payload, ...nested];
}

function isJobPosting(value) {
  const types = Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']];
  return types.some(type => String(type || '').toLowerCase() === 'jobposting');
}

export function parseZaposlitevInfoDetails(html, job, now = Date.now()) {
  const scripts = [...String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const postings = scripts.flatMap(match => {
    try { return postingNodes(JSON.parse(match[1])).filter(isJobPosting); }
    catch { return []; }
  });
  const title = text(job?.title).toLocaleLowerCase('sl');
  const posting = postings.find(item => text(item.title).toLocaleLowerCase('sl') === title);
  if (!posting) return null;
  const details = jobPostingDetails(posting);
  const deadline = isoDate(posting.validThrough);
  if (deadline && Date.parse(deadline + 'T23:59:59Z') >= now) details.deadline = deadline;
  if (!Object.keys(details).length) return null;
  return details;
}

function sameJobTitle(htmlTitle, jobTitle) {
  const normalized = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
  return normalized(htmlTitle) === normalized(jobTitle);
}

export function parseKarieraDetails(html, job) {
  const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (!title || !sameJobTitle(title, job?.title)) return null;
  const key = String(job?.url || '').match(/\/sl\/delovno-mesto\/(kari[a-f0-9]+)/i)?.[1];
  const start = html.indexOf('details-post-data');
  if (!key || start < 0) return null;
  const end = html.indexOf('/sl/oddaj-prijavo/' + key, start);
  if (end <= start || end - start > 70000) return null;
  const body = html.slice(start, end);
  const sections = body.split(/(?=<div\b[^>]*class=["'][^"']*\bpost-block\b)/i).slice(1);
  const details = {};
  for (const block of sections) {
    const heading = block.match(/<h4\b[^>]*class=["'][^"']*\bblock-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1];
    if (!heading) {
      const intro = text(block);
      if (intro && !details.description) details.description = intro;
      continue;
    }
    const content = text(block.slice(block.indexOf('</h4>') + 5));
    if (!content) continue;
    const name = text(heading).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/nudimo|ponujamo|ugodnost/.test(name)) details.benefits = content;
    else if (/nalog|odgovornost|delo bo/.test(name)) details.responsibilities = content;
    else if (/pricakujemo|zahtev|pogoj/.test(name)) details.requirements = content;
  }
  return Object.keys(details).length ? details : null;
}

export function parseOptiusDetails(html, job) {
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
  if (!canonical || canonical.replace(/\/$/, '') !== String(job?.url || '').replace(/\/$/, '')) return null;
  const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (!title || !sameJobTitle(title, job?.title)) return null;
  const section = /<h3\b[^>]*class=["'][^"']*\bsection-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>\s*<\/div>\s*<div\b[^>]*class=["']col-right["'][^>]*>([\s\S]*?)<\/div>/gi;
  const details = {};
  for (const match of html.matchAll(section)) {
    const heading = text(match[1]).toLocaleLowerCase('sl');
    const content = text(match[2]);
    if (!content) continue;
    if (heading.includes('opis delovnega mesta')) details.description = content;
    else if (heading.includes('pričakujemo') || heading.includes('zahtevamo')) details.requirements = content;
    else if (heading.includes('ponujamo') || heading.includes('nudimo')) details.benefits = content;
  }
  return details.description ? details : null;
}

export function reuseJobDetails(job, previous, now = Date.now()) {
  if (!previous || previous.source !== job.source || previous.title !== job.title ||
      (previous.date && job.date && previous.date !== job.date) ||
      !previous.detailsFetchedAt || !Number.isFinite(Date.parse(previous.detailsFetchedAt)) ||
      Date.parse(previous.detailsFetchedAt) > now || now - Date.parse(previous.detailsFetchedAt) > 30 * 86400000) return null;
  const fields = {};
  for (const field of FIELDS) if (previous[field] !== undefined && previous[field] !== null && previous[field] !== '') fields[field] = previous[field];
  if (fields.deadline && Date.parse(fields.deadline + 'T23:59:59Z') < now) delete fields.deadline;
  return fields.description || fields.summary || fields.requirements || fields.benefits ? fields : null;
}

export async function enrichJobsProgressively(jobs, previousJobs, options) {
  const { name, limit, concurrency = 3, getDetails, parseDetails, now = Date.now() } = options;
  const previous = new Map(previousJobs.map(job => [job.id, job]));
  const results = jobs.map(job => ({ ...job }));
  const pending = [], refresh = [];
  let cached = 0, updated = 0, failed = 0, deferred = 0;
  results.forEach((job, index) => {
    const older = previous.get(job.id);
    const reused = reuseJobDetails(job, older, now);
    const recentlyChecked = older?.detailsCheckedAt && Number.isFinite(Date.parse(older.detailsCheckedAt)) &&
      now >= Date.parse(older.detailsCheckedAt) && now - Date.parse(older.detailsCheckedAt) < 86400000;
    if (reused) {
      Object.assign(job, reused);
      if (older.detailsCheckedAt) job.detailsCheckedAt = older.detailsCheckedAt;
      cached++;
      if (now - Date.parse(older.detailsFetchedAt) > 14 * 86400000 && !recentlyChecked) refresh.push(index);
    } else if (older?.title === job.title && older.source === job.source && recentlyChecked) {
      job.detailsCheckedAt = older.detailsCheckedAt;
      deferred++;
    } else pending.push(index);
  });
  // Najprej dopolnjujemo še nepokrite oglase; vmes ne obremenjujemo istih URL-jev.
  const queue = pending.concat(refresh);
  for (let start = 0; start < Math.min(queue.length, limit); start += concurrency) {
    const slice = queue.slice(start, Math.min(start + concurrency, limit));
    const batch = await Promise.allSettled(slice.map(async index => {
      const job = results[index];
      job.detailsCheckedAt = new Date(now).toISOString();
      const raw = await getDetails(job);
      const details = parseDetails(raw, job, now);
      if (!details) return false;
      Object.assign(job, details, { detailsFetchedAt: new Date(now).toISOString() });
      return true;
    }));
    batch.forEach(result => result.status === 'fulfilled' && result.value ? updated++ : failed++);
    if (start + concurrency < Math.min(queue.length, limit)) await new Promise(resolve => setTimeout(resolve, 120));
  }
  console.log(`DeloRadar: ${name} podrobnosti: ${updated} pridobljenih/osveženih, ${cached} iz predhodnega zajema, ${failed} neuspešnih, ${deferred} začasno odloženih, ${Math.max(0, queue.length - limit)} za pozneje.`);
  return results;
}

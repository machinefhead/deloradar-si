import { readableJobText } from './job-details.js';

// Competojev portal prikazuje seznam in podrobnosti prek istega javnega JSON
// vmesnika, ki ga uporablja njegova aplikacija. Ne zaganjamo brskalnika.
const API = 'https://digi.competo.si/serv/api/portal/jobs';
const PUBLIC_URL = 'https://portal.digi.competo.si/jobs/';
const REFRESH_MS = 14 * 24 * 60 * 60 * 1000;

function text(value) {
  return readableJobText(String(value || ''))
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '')
    .replace(/\bKontakt\s*:\s*$/gim, '')
    .split('\n')
    .filter(line => !/(?:kontaktna oseba|za več informacij|kontaktirate|kontaktirajte|pokličite|osebni kontakt)/i.test(line))
    .join('\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return '';
  return Number.isFinite(Date.parse(value + 'T00:00:00Z')) ? value : '';
}

async function json(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(18_000), headers: {
    accept: 'application/json', 'user-agent': 'DeloRadar/0.1 (personal job listing index)',
  } });
  if (!response.ok) throw Error('Competo HTTP ' + response.status);
  if (!/json/i.test(response.headers.get('content-type') || '')) {
    throw Error('Competo: nepričakovan tip odgovora');
  }
  const body = await response.text();
  if (Buffer.byteLength(body) > 3_000_000) throw Error('Competo: prevelik JSON odgovor');
  return JSON.parse(body);
}

function baseJob(row) {
  if (typeof row?.uid !== 'string' || !/^[a-zA-Z0-9]{8,30}$/.test(row.uid)) return null;
  const title = text(row.name);
  if (!title) return null;
  const location = text(row.city);
  // Izključimo izrecno navedene tuje lokacije. Ne izmišljamo mesta,
  // če je navedenih samo več regij ali nepopoln opis.
  if (/\b(?:Austria|Österreich|Germany|Deutschland|Italy|Italia|Croatia|Hrvatska)\b/i.test(location)) return null;
  return { id: 'competo:' + row.uid, source: 'Competo', title,
    company: 'COMPETO d.o.o.', location, date: date(row.dateFrom), deadline: '',
    url: PUBLIC_URL + row.uid,
    ...(row.worktime ? { employmentType: text(row.worktime) } : {}),
  };
}

function addDetails(base, detail, fetchedAt) {
  if (detail?.uid !== base.id.slice('competo:'.length)) return base;
  const sections = [
    ['O delodajalcu in delovnem mestu', detail.aboutCompany],
    ['Naloge', detail.description],
    ['Pričakovanja', detail.expectations],
    ['Ponujamo', detail.offerings],
  ];
  const description = sections.map(([label, value]) => {
    const content = text(value);
    return content ? label + '\n' + content : '';
  }).filter(Boolean).join('\n\n');
  return { ...base, ...(description ? { description, competoFetchedAt: fetchedAt } : {}) };
}

export async function getCompeto({ previous = [], fetchImpl = fetch, maxDetails = 30,
  now = Date.now() } = {}) {
  const listing = await json(API, fetchImpl);
  if (!Array.isArray(listing) || listing.length > 1000) throw Error('Competo: neveljaven seznam oglasov');
  const jobs = [...new Map(listing.map(row => baseJob(row)).filter(Boolean)
    .map(job => [job.id, job])).values()];
  const old = new Map(previous.filter(job => job.source === 'Competo').map(job => [job.id, job]));
  const refresh = [];
  const fetchDate = new Date(now).toISOString();
  for (const [index, job] of jobs.entries()) {
    const cached = old.get(job.id);
    const age = now - Date.parse(cached?.competoFetchedAt || '');
    if (cached?.title === job.title && cached.description && Number.isFinite(age) &&
      age >= 0 && age < REFRESH_MS) {
      jobs[index] = { ...job, description: cached.description,
        competoFetchedAt: cached.competoFetchedAt };
    } else if (refresh.length < maxDetails) refresh.push(index);
  }
  let failures = 0;
  for (let start = 0; start < refresh.length; start += 3) {
    const batch = refresh.slice(start, start + 3);
    const settled = await Promise.allSettled(batch.map(async index => {
      const job = jobs[index];
      return addDetails(job, await json(API + '/' + job.id.slice(8), fetchImpl), fetchDate);
    }));
    settled.forEach((result, i) => {
      const index = batch[i];
      if (result.status === 'fulfilled') jobs[index] = result.value;
      else {
        failures++;
        const cached = old.get(jobs[index].id);
        if (cached?.title === jobs[index].title && cached.description) {
          jobs[index] = { ...jobs[index], description: cached.description,
            competoFetchedAt: cached.competoFetchedAt };
        }
      }
    });
    if (start + 3 < refresh.length) await new Promise(resolve => setTimeout(resolve, 150));
  }
  console.log(`DeloRadar: Competo JSON ${jobs.length} oglasov, ${refresh.length} zahtev za opise, ${failures} napak.`);
  return jobs;
}

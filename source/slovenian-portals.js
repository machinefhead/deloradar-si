import { readableJobText } from './job-details.js';

// Izvirni slovenski seznami. Vse oglaševalce preverimo prek HTTP brez brskalnika;
// podrobnosti beremo samo pri majhnem številu izrecno prikazanih razpisov.
const URLS = {
  izs: 'https://www.izs.si/borza-dela/prosta-delovna-mesta/',
  hidria: 'https://www.hidria.com/int/sl/zaposlitev/prosta-delovna-mesta/',
  lth: 'https://www.lthcastings.com/sl/kariera/prosta-delovna-mesta',
  telkom: 'https://www.telkom.si/kariera/',
  pse: 'https://www.pse.si/sl/zaposlitve/',
};

const requestHeaders = { accept: 'text/html,application/xhtml+xml;q=0.9', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' };
async function getHtml(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: requestHeaders });
  if (!response.ok) throw Error(`${new URL(url).hostname}: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > 1_500_000) throw Error('Prevelik HTML odgovor');
  const html = await response.text();
  if (html.length > 1_500_000) throw Error('Prevelik HTML odgovor');
  return html;
}

const clean = value => readableJobText(value || '').replace(/[ \t]+\n/g, '\n').trim();
const text = value => clean(value).replace(/\s+/g, ' ').trim();
function dateSl(value) {
  const match = String(value).match(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})\b/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}
function dateWordSl(value) {
  const months = { januarja: 1, februarja: 2, marca: 3, aprila: 4, maja: 5, junija: 6,
    julija: 7, avgusta: 8, septembra: 9, oktobra: 10, novembra: 11, decembra: 12 };
  const match = text(value).toLowerCase().match(/\b(\d{1,2})\s+(januarja|februarja|marca|aprila|maja|junija|julija|avgusta|septembra|oktobra|novembra|decembra),?\s+(20\d{2})\b/);
  return match ? `${match[3]}-${String(months[match[2]]).padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}
function current(deadline, now = new Date().toISOString().slice(0, 10)) {
  return !deadline || deadline >= now;
}
function noPersonalContacts(value) {
  return clean(value).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[e-poštni naslov na izvirni strani]')
    .replace(/(?:\+386|00386|0)\s*\d{1,3}[ \-/]*\d{3}[ \-/]*\d{3,4}\b/g, '[telefon na izvirni strani]');
}
async function detailed(jobs, count, detail) {
  const collected = [];
  for (let start = 0; start < jobs.length; start += count) {
    const batch = await Promise.allSettled(jobs.slice(start, start + count).map(detail));
    const error = batch.find(result => result.status === 'rejected');
    if (error) throw error.reason;
    collected.push(...batch.map(result => result.value));
    if (start + count < jobs.length) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return collected;
}

export function parseIzsList(html, now) {
  const table = html.match(/<table\b[^>]*id="jobsList"[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw Error('IZS: javni seznam ni dosegljiv');
  const jobs = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (cells.length !== 4) continue;
    const id = cells[3].match(/\bdata-id="(\d+)"/)?.[1];
    const deadline = dateSl(text(cells[2]));
    if (!id || !deadline || !current(deadline, now)) continue;
    jobs.push({ id: `izs:${id}`, source: 'IZS – Borza dela', title: text(cells[0]),
      company: text(cells[1]), location: '', date: '', deadline,
      url: `${URLS.izs}?id=${id}` });
  }
  return jobs;
}

export function parseIzsDetail(html) {
  const properties = {};
  for (const row of html.matchAll(/<tr\b[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    const key = text(row[1]).replace(/:\s*$/, '').toLowerCase();
    properties[key] = text(row[2]);
  }
  const content = html.match(/<strong>Opis del in nalog:<\/strong>([\s\S]*?)(?:<h3\b[^>]*>Pravni pouk|$)/i)?.[1] || '';
  const result = {
    location: properties.kraj || '',
    education: properties['strokovna izobrazba'] || '',
    employmentType: properties['vrsta zaposlitve'] || '',
    contractDuration: properties['trajanje zaposlitve'] || '',
    workHours: properties['oblika dela'] || '',
    applicationMethod: noPersonalContacts(properties['način prijave kandidatov'] || ''),
    description: noPersonalContacts(content),
  };
  if (!result.description) throw Error('IZS: podrobnosti oglasa so prazne');
  return result;
}

export async function getIzs() {
  const jobs = parseIzsList(await getHtml(URLS.izs));
  return detailed(jobs, 3, async job => {
    const id = job.id.slice(4);
    const detail = parseIzsDetail(await getHtml(`https://www.izs.si/ajax?id=${id}&action=borzaDelaDetail`));
    return { ...job, ...detail };
  });
}

export function parseHidriaList(html, now) {
  const jobs = [];
  for (const match of html.matchAll(/<a\s+href="(\/int\/sl\/zaposlitev\/prosta-delovna-mesta\/[^"?]+\/)"\s+class="single-tender">([\s\S]*?)<\/a>/gi)) {
    const body = match[2];
    const title = text(body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
    const location = text(body.match(/<li\s+class="worklocation">[\s\S]*?<\/span>([\s\S]*?)<\/li>/i)?.[1]);
    const jobCategory = text(body.match(/<li\s+class="branch">[\s\S]*?<\/span>([\s\S]*?)<\/li>/i)?.[1]);
    const deadline = dateSl(body.match(/<li\s+class="enddate">([\s\S]*?)<\/li>/i)?.[1] || '');
    if (!title || !deadline || !current(deadline, now)) continue;
    jobs.push({ id: `hidria:${match[1]}`, source: 'Hidria', company: 'Hidria', title, location, jobCategory,
      date: '', deadline, url: new URL(match[1], URLS.hidria).href });
  }
  if (!jobs.length && /single-tender/.test(html)) return [];
  if (!/single-tender|Našli nismo|Ni objavljenih/i.test(html)) throw Error('Hidria: nepričakovana oblika seznama');
  return jobs;
}

export function parseHidriaDetail(html) {
  const date = dateSl(html.match(/<li\s+class="startdate">([\s\S]*?)<\/li>/i)?.[1] || '');
  const content = html.match(/<div class="text-content">([\s\S]*?)<div class="tendergo">/i)?.[1] || '';
  const description = noPersonalContacts(content);
  if (description.length < 60) throw Error('Hidria: oglas nima pričakovanega opisa');
  return { date, description };
}

export async function getHidria() {
  return detailed(parseHidriaList(await getHtml(URLS.hidria)), 3, async job => ({
    ...job, ...parseHidriaDetail(await getHtml(job.url)),
  }));
}

export function parseLthList(html, now) {
  if (!/class="employments-list"/.test(html)) throw Error('LTH Castings: ni tabele razpisov');
  const jobs = [];
  for (const row of html.matchAll(/<tr\s+role="row"\s+class="employment-item">([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (cells.length < 6 || text(cells[1]) !== 'Slovenija') continue;
    const link = cells[0].match(/<a\s+href="(\/sl\/kariera\/prosta-delovna-mesta\/[^"?]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const title = text(link?.[2]);
    const deadline = dateSl(text(cells[5]));
    const category = text(cells[3]);
    if (!link || !title || !deadline || !current(deadline, now) || /splošna prijava|učna mesta|obvezno prakso/i.test(title + ' ' + category)) continue;
    jobs.push({ id: `lth:${link[1]}`, source: 'LTH Castings', title, company: 'LTH Castings',
      location: text(cells[2]), jobCategory: category, employmentType: text(cells[4]),
      date: '', deadline, url: new URL(link[1], URLS.lth).href });
  }
  return jobs;
}

export function parseLthDetail(html) {
  const intro = html.match(/<div class="job-intro text-intro">([\s\S]*?)<\/div>/i)?.[1] || '';
  const sections = [...html.matchAll(/<section class="employment-content(?:\s+[^"]*)?">([\s\S]*?)<\/section>/gi)]
    .map(m => m[1]).filter(s => /<h2\s+class="h3">/.test(s));
  const description = noPersonalContacts([intro, ...sections].join('\n'));
  if (description.length < 60) throw Error('LTH Castings: opis manjka');
  return { description };
}

export async function getLthCastings() {
  const jobs = [];
  for (let start = 0; start <= 88; start += 11) {
    const html = await getHtml(URLS.lth + (start ? `?start=${start}` : ''));
    jobs.push(...parseLthList(html));
    const next = html.match(/<a\s+href="[^"]*\?start=(\d+)"\s+class="btn btn-primary"/i)?.[1];
    if (!next) break;
    if (Number(next) !== start + 11) throw Error('LTH Castings: nepričakovano straničenje');
    if (start === 88) throw Error('LTH Castings: več kot 100 objav, preveriti straničenje');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const unique = [...new Map(jobs.map(job => [job.id, job])).values()];
  return detailed(unique, 3, async job => ({ ...job,
    ...parseLthDetail(await getHtml(job.url)),
  }));
}

export function parseTelkomList(html) {
  const jobs = [];
  for (const match of html.matchAll(/<article class="bde-loop-item ee-post">([\s\S]*?)<\/article>/gi)) {
    const body = match[1];
    const url = body.match(/<a[^>]*href="(https:\/\/www\.telkom\.si\/kariera\/[^"?]+\/)"/i)?.[1];
    const title = text(body.match(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i)?.[1]);
    const date = dateWordSl(body.match(/Objavljeno<\/b>\s*:\s*([^<]+)/i)?.[1]);
    if (!url || !title) continue;
    jobs.push({ id: `telkom:${new URL(url).pathname}`, source: 'Telkom d.o.o.',
      company: 'Telkom d.o.o.', title, location: '', date, deadline: '', url });
  }
  if (!jobs.length) throw Error('Telkom: seznam zaposlitev ni dosegljiv');
  return jobs;
}

export function parseTelkomDetail(html) {
  const parts = [...html.matchAll(/<div class="[^"]*\bzaposlitevtext\b[^"]*">([\s\S]*?)<\/div>/gi)].map(m => m[1]);
  const description = noPersonalContacts(parts.join('\n'));
  if (description.length < 60) throw Error('Telkom: opis razpisa ni dosegljiv');
  return { description };
}

export async function getTelkom() {
  return detailed(parseTelkomList(await getHtml(URLS.telkom)), 2, async job => ({
    ...job, ...parseTelkomDetail(await getHtml(job.url)),
  }));
}

export function parsePseList(html) {
  if (!html.includes('Razpisana delovna mesta')) throw Error('PSE: ni rubrike razpisov');
  const jobs = [];
  for (const match of html.matchAll(/<h3\s+class="elementor-heading-title elementor-size-default">([^<]+)<\/h3>([\s\S]*?)(?=<h3\s+class="elementor-heading-title elementor-size-default">|<footer\b|$)/gi)) {
    const title = text(match[1]);
    const data = match[2];
    const date = dateSl(data.match(/Datum objave:<\/strong>\s*([^<]+)/i)?.[1] || '');
    const table = data.match(/<table\s+class="tg-job"[^>]*>([\s\S]*?)<\/table>/i)?.[1];
    if (!title || !date || !table) continue;
    const pairs = [...table.matchAll(/<tr\b[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)];
    const description = noPersonalContacts(pairs.map(row => `${text(row[1])}: ${clean(row[2])}`).join('\n'));
    const fields = new Map(pairs.map(row => [text(row[1]).toLowerCase(), text(row[2])]));
    if (!description) throw Error('PSE: prazni podatki o razpisu');
    const anchor = data.match(/id="([a-z0-9_-]+)"[^>]*data-widget_type="heading/i)?.[1] || 'serviser';
    jobs.push({ id: `pse:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, source: 'PSE d.o.o.',
      company: 'PSE d.o.o.', title, location: '', date, deadline: '',
      description, workHours: fields.get('delovni čas') || '', education: fields.get('zahtevana izobrazba') || '',
      experience: fields.get('zahtevane delovne izkušnje') || '', url: `${URLS.pse}#${anchor}` });
  }
  return jobs;
}

export async function getPse() {
  return parsePseList(await getHtml(URLS.pse));
}

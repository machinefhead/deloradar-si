import { readableJobText } from './job-details.js';

// Javni seznam e-Študentskega Servisa že vsebuje celoten kratek opis in plačilo.
// Ena HTTP stran vrne do 50 razpisov, brez odpiranja posameznih kartic.
const HOST = 'https://www.studentski-servis.com';
const SOURCE = 'e-Študentski Servis (študentsko delo)';
const LIST = HOST + '/studenti/prosta-dela';

function text(value) {
  const entities = { scaron: 'š', Scaron: 'Š', ccaron: 'č', Ccaron: 'Č',
    zcaron: 'ž', Zcaron: 'Ž', euro: '€', ndash: '–', mdash: '—', hellip: '…' };
  return readableJobText(String(value || '').replace(/<!--[\s\S]*?-->/g, '').replace(/&([a-zA-Z]+);/g,
    (matched, name) => entities[name] || matched));
}

function publicText(value) {
  return text(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function companyName(article) {
  const encoded = article.match(/href="[^\"]*[?&]vsadelapodj=1&amp;kljb=([^\"&]+)"/i)?.[1] ||
    article.match(/href="[^\"]*[?&]vsadelapodj=1&kljb=([^\"&]+)"/i)?.[1];
  if (!encoded) return '';
  try {
    const name = text(decodeURIComponent(encoded.replace(/\+/g, ' ')));
    return name.length <= 160 ? name : '';
  } catch { return ''; }
}

export function parseStudentWorkPage(html, requestedPage = 1) {
  if (typeof html !== 'string' || html.length > 1_500_000 || !html.includes('id="results"')) {
    throw Error('Študentski servis: neznana oblika seznama');
  }
  const active = Number(html.match(/<div class="page-item active">\s*<a[^>]*>(\d+)<\/a>/)?.[1] || 1);
  if (active !== requestedPage) throw Error('Študentski servis: strežnik ni vrnil zahtevane strani');
  const pages = [...html.matchAll(/\bdata-page="(\d+)"/g)].map(match => Number(match[1]));
  const totalPages = Math.max(active, 1, ...pages);
  const starts = [...html.matchAll(/<article class="job-item" data-jobid="(\d{3,12})">/g)];
  const jobs = [];
  for (let i = 0; i < starts.length; i++) {
    const id = starts[i][1];
    const article = html.slice(starts[i].index, starts[i + 1]?.index || html.length).split('</article>')[0];
    const title = text(article.match(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i)?.[1]);
    const description = publicText(article.match(/<p class="description text-break">([\s\S]*?)<\/p>/i)?.[1]);
    const location = text(article.match(/#icon-location[^<]*<\/use>\s*<\/svg>\s*([^<\n]+)/i)?.[1]);
    if (!title) throw Error('Študentski servis: kartica brez naziva ' + id);
    if (/\b(?:Avstrija|Nemčija|Hrvaška|Italija|Austria|Croatia|Germany|Italy)\b/i.test(location)) continue;
    const payment = text(article.match(/<li class="job-payment">([\s\S]*?)<\/li>/i)?.[1]);
    const duration = text(article.match(/Trajanje:\s*<strong>([\s\S]*?)<\/strong>/i)?.[1]);
    const schedule = text(article.match(/Delovnik:\s*<strong>([\s\S]*?)<\/strong>/i)?.[1]);
    const company = companyName(article);
    jobs.push({
      id: 'studentski:' + id, source: SOURCE, title, company, location,
      date: '', deadline: '',
      url: LIST + '?isci=1&kljb=' + encodeURIComponent(id),
      employmentType: 'Študentsko delo', contractType: 'Študentsko delo',
      ...(description ? { description, summary: description } : {}),
      ...(payment ? { salary: payment } : {}),
      ...(duration ? { contractDuration: duration } : {}),
      ...(schedule ? { workHours: schedule } : {}),
    });
  }
  return { jobs, cards: starts.length, totalPages, shownPage: active };
}

async function listingPage(page, fetchImpl, timeoutMs) {
  const url = LIST + '?isci=1&page=' + page;
  const reply = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!reply.ok) throw Error('Študentski servis: HTTP ' + reply.status + ' (stran ' + page + ')');
  const contentType = reply.headers?.get('content-type') || '';
  if (contentType && !/text\/html/i.test(contentType)) throw Error('Študentski servis: odgovor ni HTML');
  const html = await reply.text();
  if (Buffer.byteLength(html) > 1_500_000) throw Error('Študentski servis: prevelik odgovor');
  return parseStudentWorkPage(html, page);
}

export async function getStudentWork({ fetchImpl = fetch, maxPages = 100, timeoutMs = 18_000 } = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) {
    throw Error('Študentski servis: neveljavna omejitev straničenja');
  }
  const first = await listingPage(1, fetchImpl, timeoutMs);
  if (!first.cards || first.totalPages > maxPages) {
    throw Error('Študentski servis: prazen ali prevelik seznam strani');
  }
  const results = [first];
  for (let page = 2; page <= first.totalPages; page += 3) {
    const batch = Array.from({ length: Math.min(3, first.totalPages - page + 1) }, (_, i) => page + i);
    const pages = await Promise.all(batch.map(number => listingPage(number, fetchImpl, timeoutMs)));
    if (pages.some(item => item.totalPages !== first.totalPages || !item.cards ||
        (item.shownPage < first.totalPages && item.cards !== first.cards))) {
      throw Error('Študentski servis: nepopolno ali spremenjeno straničenje');
    }
    results.push(...pages);
    if (page + 3 <= first.totalPages) await new Promise(resolve => setTimeout(resolve, 250));
  }
  const jobs = results.flatMap(item => item.jobs);
  const ids = new Set(jobs.map(job => job.id));
  if (ids.size !== jobs.length) throw Error('Študentski servis: ponovljeni oglasi med stranmi');
  console.log(`Študentski servis HTTP: ${jobs.length} razpisov na ${first.totalPages} javnih straneh (brez dodatnih zahtevkov za opise).`);
  return jobs;
}

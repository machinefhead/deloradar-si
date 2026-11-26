import { readableJobText } from './job-details.js';

// Uradni RSS zaposlitvenega portala Celtra/Trakstar vsebuje že celotne opise.
// En HTTP zahtevek zadostuje za vse odprte objave; oglasov ne odpiramo posebej.
const FEED = 'https://celtra.hire.trakstar.com/jobfeeds/celtra';
const SOURCE = 'Celtra';

function field(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return block.match(new RegExp('<' + escaped + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + escaped + '>', 'i'))?.[1]
    ?.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() || '';
}

function clean(value) {
  const named = { rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
    hellip: '…', mdash: '—', ndash: '–', euro: '€', bull: '•' };
  return readableJobText(String(value || '').replace(/&(?:amp;)?([a-z]+);/gi,
    (raw, name) => named[name.toLowerCase()] || raw))
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '')
    .replace(/(?:\+386|00386|0[234567])(?:[\s./-]*\d){6,9}/g, '')
    .trim();
}

function jobUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'celtra.hire.trakstar.com' ||
        url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/jobs\/(fk[a-z0-9]+)\/?$/i);
    return match ? { id: match[1].toLowerCase(), url: 'https://celtra.hire.trakstar.com/jobs/' + match[1].toLowerCase() + '/' } : null;
  } catch { return null; }
}

export function parseCeltraFeed(xml, now = Date.now()) {
  if (typeof xml !== 'string' || xml.length > 1_000_000 ||
      !/<rss\b/i.test(xml) || !/<channel\b/i.test(xml) || !xml.includes('Jobs at Celtra')) {
    throw Error('Celtra: napačen ali nepopoln RSS');
  }
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  if (items.length > 1000) throw Error('Celtra: nepričakovano velik seznam');
  const jobs = [];
  for (const item of items) {
    const block = item[1];
    const country = clean(field(block, 'job:locationCountry'));
    if (!/^(?:slovenia|slovenija)$/i.test(country)) continue;
    const link = jobUrl(clean(field(block, 'link')));
    const title = clean(field(block, 'title'));
    const description = clean(field(block, 'description'));
    if (!link || !title || !description) throw Error('Celtra: slovenski oglas nima ID-ja ali opisa');
    const rawDeadline = clean(field(block, 'job:closeDte'));
    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline) ? rawDeadline : '';
    if (deadline && Date.parse(deadline + 'T23:59:59Z') < now) continue;
    const published = Date.parse(clean(field(block, 'pubDate')));
    const team = clean(field(block, 'job:team'));
    const position = clean(field(block, 'job:positionType'));
    const city = clean(field(block, 'job:locationCity'));
    jobs.push({
      id: 'celtra:' + link.id, source: SOURCE, company: SOURCE, title,
      location: city || 'Slovenija (kraj ni naveden)',
      date: Number.isFinite(published) ? new Date(published).toISOString() : '',
      deadline, url: link.url, description,
      ...(team ? { jobCategory: team } : {}),
      ...(position ? { employmentType: position === 'full_time' ? 'Polni delovni čas' : position } : {}),
    });
  }
  if (new Set(jobs.map(job => job.id)).size !== jobs.length) throw Error('Celtra: podvojeni ID-ji');
  return jobs;
}

export async function getCeltra({ fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const response = await fetchImpl(FEED, { signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/rss+xml,application/xml', 'user-agent': 'DeloRadar/0.1 (personal job listing index)' } });
  if (!response.ok) throw Error('Celtra: RSS HTTP ' + response.status);
  if (!/xml|rss/i.test(String(response.headers.get('content-type')))) throw Error('Celtra: odgovor ni RSS');
  const xml = await response.text();
  if (Buffer.byteLength(xml) > 1_000_000) throw Error('Celtra: odgovor je prevelik');
  const jobs = parseCeltraFeed(xml);
  console.log(`Celtra RSS: ${jobs.length} slovenskih oglasov s celotnim opisom v enem HTTP zahtevku.`);
  return jobs;
}

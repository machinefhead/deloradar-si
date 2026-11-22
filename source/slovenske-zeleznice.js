// Uradni javni seznam SŽ. Hranimo le naslov, rok in URL razpisa.
const LIST = 'https://www.sz.si/kariera/razpisi-za-prosta-delovna-mesta/';

const MONTHS = {
  januarja: 1, februarja: 2, marca: 3, aprila: 4,
  maja: 5, junija: 6, julija: 7, avgusta: 8,
  septembra: 9, oktobra: 10, novembra: 11, decembra: 12,
};

function clean(html) {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&#8211;|&#x2013;/gi, '–')
    .replace(/&#8217;|&#x2019;/gi, '’')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

function dateFromSlovenian(raw) {
  const match = clean(raw).match(/(\d{1,2})\.\s*([a-zčšž]+)\s+(\d{4})/i);
  if (!match) return '';
  const month = MONTHS[match[2].toLowerCase()];
  return month ? `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}

export function parseSzListings(html, now = Date.now()) {
  if (!/grid-razpisi_za_delo/.test(html)) throw Error('SŽ: uradni seznam razpisov manjka');
  const jobs = new Map();
  for (const match of html.matchAll(/<article\b[^>]*\bpost-(\d+)\b[^>]*\brazpisi_za_delo\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    const body = match[2];
    const url = body.match(/<a\b[^>]*href=["'](https:\/\/www\.sz\.si\/pogoji_za_zaposlitev\/[^"'?#]+\/?)["']/i)?.[1];
    const title = clean(body.match(/<div\b[^>]*\bpost-title\b[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
    const deadline = dateFromSlovenian(body.match(/Rok za prijavo:\s*([^<]+)</i)?.[1] || '');
    if (!url || !title || !deadline) continue;
    // Rok velja še do konca navedenega dne po slovenskem času.
    if (Date.parse(deadline + 'T23:59:59+01:00') < now) continue;
    jobs.set(match[1], { id: 'sz:' + match[1], source: 'Slovenske železnice',
      title, company: 'Slovenske železnice', location: '', date: '', deadline, url });
  }
  return [...jobs.values()];
}

export async function getSz() {
  const response = await fetch(LIST, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: 'text/html', 'user-agent': 'DeloRadar/0.1 (non-commercial job metadata index)' },
  });
  if (!response.ok) throw Error('SŽ: HTTP ' + response.status);
  if (Number(response.headers.get('content-length')) > 1_000_000) throw Error('SŽ: prevelik seznam');
  const html = await response.text();
  if (html.length > 1_000_000) throw Error('SŽ: prevelik seznam');
  const jobs = parseSzListings(html);
  if (!jobs.length) throw Error('SŽ: ni prepoznanih aktualnih razpisov');
  return jobs;
}

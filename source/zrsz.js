// Priključek za ZRSZ je namenjen dogovorjenemu JSON izvozu.
// Naslova ne ugibamo in ne uporabljamo prijave na osebni portal PoiščiDelo.
const JOB_PAGE = 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/';
const MAX_BYTES = 15_000_000;

function text(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function date(value) {
  const input = text(value);
  if (!input) return '';
  const local = input.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/);
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(input) && Number.isFinite(Date.parse(input)) ? input : '';
}

function officialUrl(raw, id) {
  const supplied = text(raw);
  if (supplied) {
    try {
      const url = new URL(supplied);
      if (url.protocol === 'https:' &&
          (url.hostname === 'www.ess.gov.si' || url.hostname === 'ess.gov.si' || url.hostname === 'www.poiscidelo.si')) {
        return url.href;
      }
    } catch { /* Neveljavna ali tuja povezava: uporabimo uradno povezavo po ID. */ }
  }
  return /^\d+$/.test(id) ? `${JOB_PAGE}?idp=${encodeURIComponent(id)}/` : '';
}

function rows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.prostaDelovnaMesta)) return payload.prostaDelovnaMesta;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  throw Error('ZRSZ: nepoznana oblika JSON izvoza; potreben je vzorec dejanskega odgovora');
}

export function parseZrszJson(payload, now = Date.now()) {
  const entries = rows(payload);
  if (entries.length > 20_000) throw Error('ZRSZ: nepričakovano veliko zapisov');
  // Ne razglasimo samo prve strani paginiranega izvoza za popoln ZRSZ seznam.
  const total = payload?.total ?? payload?.totalCount ?? payload?.steviloZadetkov ??
    payload?.data?.total ?? payload?.data?.totalCount;
  if (total !== undefined && Number.isFinite(Number(total)) && Number(total) > entries.length) {
    throw Error('ZRSZ: JSON vsebuje le del zapisov; urediti je treba straničenje');
  }
  const jobs = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const id = text(entry.idDelovnegaMesta ?? entry.idDelovnoMesto ?? entry.idPdm ?? entry.id);
    const title = text(entry.nazivDelovnegaMesta ?? entry.naziv ?? entry.title);
    const url = officialUrl(entry.povezava ?? entry.url ?? entry.link, id);
    if (!id || !title || !url) continue;
    const country = text(entry.drzava ?? entry.country);
    if (country && !/^(si|svn|slovenija|slovenia)$/i.test(country)) continue;
    const deadline = date(entry.rokPrijave ?? entry.datumPoteka ?? entry.deadline);
    if (deadline && Date.parse(deadline.slice(0, 10) + 'T23:59:59+01:00') < now) continue;
    if (jobs.has(id)) continue;
    jobs.set(id, {
      id: 'zrsz:' + id,
      source: 'ZRSZ / PoiščiDelo',
      title,
      company: text(entry.nazivDelodajalca ?? entry.delodajalec ?? entry.company),
      location: text(entry.krajDela ?? entry.kraj ?? entry.location),
      date: date(entry.datumObjave ?? entry.datePosted ?? entry.date),
      deadline,
      url,
    });
  }
  if (entries.length && !jobs.size) throw Error('ZRSZ: nobenega veljavnega oglasa; preveri polja JSON izvoza');
  return [...jobs.values()];
}

export async function getZrszJson(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw Error('ZRSZ: dovoljen je samo HTTPS izvoz');
  const response = await fetch(parsed, {
    signal: AbortSignal.timeout(20_000),
    headers: { accept: 'application/json', 'user-agent': 'DeloRadar/0.1 (non-commercial job metadata index)' },
  });
  if (!response.ok) throw Error('ZRSZ: izvoz je vrnil HTTP ' + response.status);
  const size = Number(response.headers.get('content-length'));
  if (size > MAX_BYTES) throw Error('ZRSZ: izvoz presega omejitev velikosti');
  const content = await response.text();
  if (content.length > MAX_BYTES) throw Error('ZRSZ: izvoz presega omejitev velikosti');
  return parseZrszJson(JSON.parse(content));
}

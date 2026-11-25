// Omejen, ročno sprožen preizkus javnih prikazov. Ni produkcijski zbiralnik.
export const ZRSZ_SEARCH_URL = 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/';
export const EURES_SLOVENIA_URL = 'https://europa.eu/eures/portal/jv-se/search?page=1&resultsPerPage=10&orderBy=BEST_MATCH&locationCodes=si&previousPageType=findJob&lang=sl';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

function localDate(value) {
  const match = clean(value).match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if (!match) return '';
  const result = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const day = new Date(result + 'T12:00:00Z');
  return day.getUTCFullYear() === Number(match[3]) && day.getUTCMonth() + 1 === Number(match[2]) && day.getUTCDate() === Number(match[1]) ? result : '';
}

export function zrszDirectUrl(idp) {
  if (!/^\d{6,10}$/.test(String(idp))) throw Error('ZRSZ: neveljaven številčni ID');
  return `${ZRSZ_SEARCH_URL}?idp=${idp}/#/pdm/${idp}`;
}

export function parseZrszPilotCard({ title, companyLocation, metadata }) {
  const companyAndLocation = clean(companyLocation);
  const split = companyAndLocation.lastIndexOf(' | ');
  const result = {
    title: clean(title),
    company: split < 0 ? companyAndLocation : clean(companyAndLocation.slice(0, split)),
    location: split < 0 ? '' : clean(companyAndLocation.slice(split + 3)),
    date: localDate(metadata),
  };
  if (!result.title || !result.company) throw Error('ZRSZ: manjkajoči podatki oglasa');
  return result;
}

export function parseZrszPilotDetail(card, detail) {
  const url = new URL(detail.url);
  if (url.origin !== new URL(ZRSZ_SEARCH_URL).origin || url.pathname !== new URL(ZRSZ_SEARCH_URL).pathname) {
    throw Error('ZRSZ: naslov ne pripada uradnemu iskalniku');
  }
  const idp = url.searchParams.get('idp')?.replace(/\/$/, '') || '';
  if (!/^\d{6,10}$/.test(idp) || url.hash !== `#/pdm/${idp}`) {
    throw Error('ZRSZ: povezava ni neposredna povezava do enega oglasa');
  }
  const reference = clean(detail.reference).toUpperCase();
  if (!/^[A-Z]{2}\d{5,}$/.test(reference)) throw Error('ZRSZ: brez veljavne registrske številke');
  return { ...card, reference, id: `zrsz:${reference}`, idp, url: zrszDirectUrl(idp) };
}

export function parseEuresPilotSummary({ title, company, location, publication, url }) {
  const href = new URL(url, 'https://europa.eu');
  if (href.hostname !== 'europa.eu' || !/^\/eures\/portal\/jv-se\/jv-details\/[A-Za-z0-9_-]+$/.test(href.pathname)) {
    throw Error('EURES: neznana izvorna povezava');
  }
  if (!clean(title) || !clean(company)) throw Error('EURES: manjkajoči podatki oglasa');
  return {
    title: clean(title), company: clean(company), location: clean(location), date: localDate(publication),
    url: href.origin + href.pathname + href.search,
  };
}

export function parseEuresPilotDetail(summary, { title, company, reference, deadline }) {
  const actualTitle = clean(title);
  const actualCompany = clean(company);
  if (actualTitle !== summary.title || actualCompany !== summary.company) {
    throw Error('EURES: podrobnosti se ne ujemajo s seznamom');
  }
  const handle = new URL(summary.url).pathname.split('/').at(-1);
  const encoded = handle.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  // Kandidat, nikoli potrjen URL. Preveriti ga je treba na ZRSZ skupaj z registrsko številko.
  const numericCandidate = decoded.match(/^(\d{6,10})\s+\d{1,3}$/)?.[1] || '';
  const normalizedReference = clean(reference).toUpperCase();
  return {
    ...summary, id: `eures:${handle}`, reference: normalizedReference,
    deadline: localDate(deadline),
    zrszIdCandidate: /^[A-Z]{2}\d{5,}$/.test(normalizedReference) && /Slovenia/i.test(summary.location) ? numericCandidate : '',
  };
}

export function careerjetProbeStatus(html) {
  if (/Zahtevano je preverjanje|Verification required|Checking your browser/i.test(html)) {
    return { status: 'blocked', reason: 'Careerjet zahteva preverjanje brskalnika; zaščite ne obhajamo.' };
  }
  if (!/<html[\s>]/i.test(html)) return { status: 'unavailable', reason: 'Nepričakovan odziv.' };
  return { status: 'unverified', reason: 'Dostop obstaja; prikaz oglasov je treba posebej preveriti.' };
}

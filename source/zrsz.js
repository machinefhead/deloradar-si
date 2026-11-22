// ZRSZ: dnevni JSON. Javnega gumba se dotaknemo prek običajnega
// brskalnika; aplikacijskega dostopnega ključa ne beremo niti ne kopiramo.
const SEARCH_PAGE = 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/';
const MAX_BYTES = 15_000_000;

function str(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function date(value) {
  const input = str(value);
  const local = input.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/);
  if (local) {
    const result = `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
    const parsed = new Date(result + 'T12:00:00Z');
    return parsed.getUTCFullYear() === Number(local[3]) && parsed.getUTCMonth() + 1 === Number(local[2]) && parsed.getUTCDate() === Number(local[1]) ? result : '';
  }
  return '';
}

function entityName(raw) {
  // ZRSZ v isti vrednosti združuje delodajalca in poštni naslov.
  // Odstranimo samo jasno prepoznaven zaključek »ulica, 1000 MESTO«.
  return str(raw).replace(/,\s*[^,]+,\s*\d{4}\s+[^,]+$/, '').trim();
}

function administrativeUnit(raw) {
  const value = str(raw);
  if (!value) return '';
  const name = value.toLocaleLowerCase('sl').replace(/(^|[\s-])(\p{L})/gu, (_, sep, letter) =>
    sep + letter.toLocaleUpperCase('sl'));
  return 'UE ' + name;
}

export function parseZrszJson(payload, now = Date.now()) {
  const entries = payload?.ProstaDelovnaMesta;
  if (!Array.isArray(entries) || !Number.isInteger(payload?.SteviloPDM) ||
      entries.length !== payload.SteviloPDM || entries.length > 20_000) {
    throw Error('ZRSZ: neveljaven ali nepopoln dnevni JSON seznam');
  }
  const published = Date.parse(str(payload.DatumObjave));
  if (!Number.isFinite(published) || published > now + 86_400_000 || now - published > 7 * 86_400_000) {
    throw Error('ZRSZ: manjkajoč, prihodnji ali zastarel datum posnetka');
  }

  const jobs = new Map();
  for (const item of entries) {
    if (!item || typeof item !== 'object') continue;
    const id = str(item.RegStPrijave);
    const title = str(item.NazivDelMesta).replace(/\s+/g, ' ');
    const deadline = date(item.RokZaPrijavoKandidatov);
    if (!id || !title || !deadline || Date.parse(deadline + 'T23:59:59+01:00') < now || jobs.has(id)) continue;
    jobs.set(id, {
      id: 'zrsz:' + id,
      source: 'ZRSZ / PoiščiDelo',
      reference: id,
      title,
      company: entityName(item.PoslovniSubjekt),
      // Upravna enota ni nujno kraj opravljanja dela; ne pretvarjamo je v naslov.
      location: administrativeUnit(item.UEPDM),
      date: date(item.DatumObjave),
      deadline,
      // Izvoz ne vsebuje povezav do posameznih oglasov. Uporabimo javni iskalnik.
      url: SEARCH_PAGE,
    });
  }
  if (entries.length && !jobs.size) throw Error('ZRSZ: v posnetku ni uporabnih aktualnih oglasov');
  return [...jobs.values()];
}

export async function getZrszJson(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw Error('ZRSZ: izvoz mora uporabljati HTTPS');
  const response = await fetch(parsed, {
    signal: AbortSignal.timeout(25_000),
    headers: { accept: 'application/json', 'user-agent': 'DeloRadar/0.1 (non-commercial metadata index)' },
  });
  if (!response.ok) throw Error('ZRSZ: podatkovni izvoz je vrnil HTTP ' + response.status);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw Error('ZRSZ: prevelik JSON');
  const raw = await response.text();
  if (raw.length > MAX_BYTES) throw Error('ZRSZ: prevelik JSON');
  return parseZrszJson(JSON.parse(raw));
}

export async function getZrszFromPublicBrowser() {
  const { chromium } = await import('playwright-core');
  // Na GitHubovem standardnem runnerju je Google Chrome že nameščen.
  // Ne uporabljamo osebne seje, shranjenih gesel ali internih API-jev.
  // Na GitHubovih brezplačnih izvajalnikih je lahko prvi zagon Chrome počasen.
  const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 120_000 });
  try {
    const context = await browser.newContext({ acceptDownloads: true, locale: 'sl-SI' });
    const page = await context.newPage();
    await page.goto(SEARCH_PAGE, { waitUntil: 'domcontentloaded', timeout: 35_000 });
    const button = page.getByRole('button', { name: /\.json/i });
    await button.waitFor({ state: 'visible', timeout: 45_000 });
    // Obe obljubi morata biti povezani: če klik odpove, ne sme ostati
    // nezaščiteno čakanje na prenos, ki bi podrlo proces pri zapiranju.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 70_000 }),
      button.click({ timeout: 25_000 }),
    ]);
    const { readFile, stat } = await import('node:fs/promises');
    const file = await download.path();
    if ((await stat(file)).size > MAX_BYTES) throw Error('ZRSZ: preneseni JSON je prevelik');
    const payload = JSON.parse(await readFile(file, 'utf8'));
    const jobs = parseZrszJson(payload);
    // V dnevnik zapišemo le osnovno stanje, ne vsebine ali zahtevkov.
    console.log('ZRSZ: javni JSON ' + payload.DatumObjave + ', aktualnih oglasov ' + jobs.length);
    return jobs;
  } finally {
    await browser.close();
  }
}

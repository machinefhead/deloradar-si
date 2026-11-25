// ZRSZ: dnevni JSON. Javnega gumba se dotaknemo prek običajnega
// brskalnika; aplikacijskega dostopnega ključa ne beremo niti ne kopiramo.
import { readZrszPublicDetails, supplementZrszPublicDetails } from './zrsz-links.js';
import { readableJobText } from './job-details.js';
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

function detailsFromZrsz(item) {
  // Uporabimo le jasno poimenovana vsebinska polja, kadar so v dnevnem izvozu.
  // Podatkov o kontaktnih osebah, telefonu in e-pošti ne kopiramo.
  const fields = {
    description: ['OpisDelInNalog', 'OpisDela', 'OpisZaposlitve'],
    contractDuration: ['TrajanjeZaposlitve'],
    contractType: ['VrstaDelovnegaRazmerja'],
    employmentType: ['VrstaZaposlitve'],
    workHours: ['DelovniCas', 'TedenskiDelovniCas'],
    requirements: ['PogojiZaZasedboDelovnegaMesta', 'DrugiPogoji'],
    education: ['ZahtevanaIzobrazba'],
    experience: ['ZahtevaneDelovneIzkušnje', 'ZahtevaneDelovneIzkusnje'],
    workplaceAddress: ['KrajOpravljanjaDela'],
  };
  const result = {};
  for (const [field, keys] of Object.entries(fields)) {
    const value = keys.map(key => readableJobText(item[key])).find(Boolean);
    if (value) result[field] = value;
  }
  return result;
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
      ...detailsFromZrsz(item),
      // Izvoz vsebuje registrsko številko, ne pa številčnega idDM za povezavo ?idp=.
      // Uradni iskalnik podpira povezavo s predizpolnjenim iskanjem po delodajalcu.
      url: SEARCH_PAGE + '#/?drzava=SI,&iskalniTekst=' + encodeURIComponent(entityName(item.PoslovniSubjekt) || title) + '&iskalnaLokacija=',
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
    // Javni iskalnik odpre pojavno izbiro piškotkov. Izberemo samo nujne,
    // s klikom na običajen gumb v dialogu (brez prikritih API-klicev).
    const cookieDialog = page.locator('#cookieman-modal');
    if (await cookieDialog.isVisible()) {
      const choices = [
        /zavrni|reject/i,
        /(?:samo|le|only).{0,30}(?:nujn|obvezn|necessary|essential)/i,
        /shrani|save settings|potrdi (?:izbiro|nastavitve)/i,
      ];
      let dismissed = false;
      for (const label of choices) {
        const button = cookieDialog.getByRole('button', { name: label }).first();
        if (await button.count() && await button.isVisible()) {
          await button.click({ timeout: 10_000 });
          dismissed = true;
          break;
        }
      }
      if (!dismissed) {
        const labels = (await cookieDialog.getByRole('button').allTextContents())
          .map(text => text.trim().replace(/\s+/g, ' ').slice(0, 80));
        throw Error('ZRSZ: neznan dialog piškotkov (' + labels.join(', ') + ')');
      }
    }
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
    const linkLimit = Number(process.env.ZRSZ_DIRECT_LINK_LIMIT || 0);
    if (!Number.isInteger(linkLimit) || linkLimit < 0 || linkLimit > 100) {
      throw Error('ZRSZ: ZRSZ_DIRECT_LINK_LIMIT mora biti med 0 in 100');
    }
    if (linkLimit === 0) return jobs;
    const startedAt = Date.now();
    try {
      const verified = await readZrszPublicDetails(page, linkLimit);
      const linked = supplementZrszPublicDetails(jobs, verified);
      const updated = linked.slice(0, jobs.length).filter((job, index) => job.url !== jobs[index].url).length;
      const added = linked.length - jobs.length;
      console.log(`ZRSZ: ${updated} popravljenih povezav, ${added} novih preverjenih oglasov ` +
        `(${verified.length} pregledanih, ${Date.now() - startedAt} ms); preostali ohranijo iskanje`);
      if (process.env.ZRSZ_LINKS_REQUIRED === '1' && updated + added < Math.min(2, linkLimit)) {
        throw Error('ZRSZ: premajhen delež preverjenih povezav ali dodatnih oglasov');
      }
      return linked;
    } catch (error) {
      if (process.env.ZRSZ_LINKS_REQUIRED === '1') throw error;
      console.warn('ZRSZ: neposredne povezave niso na voljo; ohranili smo popoln JSON: ' + String(error.message).slice(0, 220));
      return jobs;
    }
  } finally {
    await browser.close();
  }
}

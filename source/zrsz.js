// ZRSZ: razčlenjevanje dnevnega JSON-a brez odpiranja posameznih oglasov v brskalniku.
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
    contractType: ['VrstaDelovnegaRazmerja', 'TrajanjeInVrstaZaposlitve'],
    employmentType: ['VrstaZaposlitve'],
    workHours: ['DelovniCas', 'TedenskiDelovniCas', 'UrnikDela'],
    education: ['ZahtevanaIzobrazba', 'Klasius'],
    experience: ['ZahtevaneDelovneIzkušnje', 'ZahtevaneDelovneIzkusnje', 'DelovneIzkusnje'],
    workplaceAddress: ['KrajOpravljanjaDela', 'LokacijaDelMesta'],
    salary: ['PredvidenoPlacilo'],
    benefits: ['DodatneUgodnosti'],
  };
  const result = {};
  for (const [field, keys] of Object.entries(fields)) {
    const value = keys.map(key => readableJobText(item[key])).find(Boolean);
    if (value) result[field] = value;
  }
  // V dnevnem JSON-u sta obseg in trajanje običajno združena v eni vrednosti:
  // »določen čas 1 leto, 20 ur/teden« ali »nedoločen čas, polni delovni čas«.
  // Izluščimo samo izrecno navedeni del, brez predpostavke o 40 urah.
  const combined = readableJobText(item.TrajanjeInVrstaZaposlitve);
  const hours = combined.match(/(?:^|,\s*)(polni delovni čas|\d+(?:[,.]\d+)?\s*ur\s*\/\s*teden)\s*$/i);
  if (hours) result.workHours = result.workHours && result.workHours !== hours[1]
    ? `${hours[1]} (${result.workHours})` : hours[1];
  if (hours && !result.employmentType) result.employmentType = hours[1];
  if (!result.contractDuration) {
    const duration = combined.match(/^določen čas\s+(.+?)(?:,\s*(?:polni delovni čas|\d+(?:[,.]\d+)?\s*ur\s*\/\s*teden))?$/i);
    if (duration?.[1]) result.contractDuration = duration[1].trim();
  }
  const additionalRequirements = [
    ['PogojiZaZasedboDelovnegaMesta', 'DrugiPogoji'],
    ['PoskusnoDelo'], ['VozniskiIzpit'], ['ZnanjeJezikov'],
    ['KompetenceInZnanja'], ['OstalaPricakovanja'],
  ].map(keys => keys.map(key => readableJobText(item[key])).find(Boolean)?.replace(/^,\s*/, '')).filter(Boolean);
  if (additionalRequirements.length) result.requirements = additionalRequirements.join('\n');
  const alternativeEducation = readableJobText(item.AltKlasius);
  if (alternativeEducation) result.education = [result.education, `Alternativna izobrazba: ${alternativeEducation}`].filter(Boolean).join('\n');
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

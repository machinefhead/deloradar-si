import { readableJobText } from './job-details.js';
import { planZrszDetails } from './zrsz-incremental.js';

const ZRSZ_SOURCE = 'ZRSZ / PoiščiDelo';
const DIRECT = /[?&]idp=(\d{6,10})(?:\/|&|$)/;
const FIELDS = {
  description: ['description', 'OpisDelInNalog', 'OpisDela'],
  responsibilities: ['responsibilities', 'Naloge'],
  requirements: ['requirements', 'DrugiPogoji'],
  education: ['education', 'ZahtevanaIzobrazba'],
  experience: ['experience', 'ZahtevaneDelovneIzkušnje'],
  workHours: ['workHours', 'DelovniCas'],
  contractDuration: ['contractDuration', 'TrajanjeZaposlitve'],
  contractType: ['contractType', 'VrstaDelovnegaRazmerja'],
  workplaceAddress: ['workplaceAddress', 'KrajOpravljanjaDela'],
  benefits: ['benefits'], skills: ['skills'], salary: ['salary'],
};

export function zrszDetailId(job) {
  if (job?.source !== ZRSZ_SOURCE || job.id !== `zrsz:${job.reference}`) return null;
  const url = new URL(job.url);
  if (url.origin !== 'https://www.ess.gov.si') return null;
  const match = url.search.match(DIRECT);
  return match ? match[1] : null;
}

export function parseZrszDetailResponse(payload, job, idp) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('ZRSZ: napačen odgovor podrobnosti');
  const data = payload.job && typeof payload.job === 'object' ? payload.job : payload;
  const reference = String(data.reference ?? data.RegStPrijave ?? '').trim();
  const returnedId = String(data.idp ?? data.idDM ?? '').trim();
  if (reference !== job.reference || (returnedId && returnedId !== idp)) throw Error('ZRSZ: neujemanje reference ali ID-ja');
  const details = {};
  for (const [target, aliases] of Object.entries(FIELDS)) {
    const raw = aliases.map(key => data[key]).find(value => value !== null && value !== undefined && value !== '');
    const value = readableJobText(raw);
    if (value) details[target] = value.slice(0, 30_000);
  }
  if (!Object.keys(details).length) throw Error('ZRSZ: odgovor ne vsebuje uporabnih podrobnosti');
  return details;
}

function detailUrl(template, idp) {
  if (typeof template !== 'string' || !template.includes('{idp}')) throw Error('ZRSZ: manjka potrjena predloga URL z {idp}');
  const result = new URL(template.replaceAll('{idp}', idp));
  if (result.protocol !== 'https:' || !result.hostname.endsWith('.ess.gov.si')) throw Error('ZRSZ: URL ni na dovoljeni domeni ZRSZ');
  return result;
}

export async function enrichZrszHttp(current, previous, options = {}) {
  const {
    endpointTemplate, fetchImpl = fetch, maxRequests = 20, concurrency = 2,
    pauseMs = 350, now = Date.now(), timeoutMs = 12_000,
  } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3 ||
      !Number.isInteger(pauseMs) || pauseMs < 0 || pauseMs > 30_000 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
    throw Error('ZRSZ: neveljavne omejitve HTTP zahtevkov');
  }
  // Najprej oglasom z dokazanim številčnim ID-jem: ZRSZ JSON sam ID-ja ne vsebuje.
  const prioritized = [...current].sort((a, b) => Number(Boolean(zrszDetailId(b))) - Number(Boolean(zrszDetailId(a))));
  const plan = planZrszDetails(prioritized, previous, { now, maxRequests: 500 });
  const candidates = plan.requests.map(id => plan.jobs.find(job => job.id === id))
    .map(job => ({ job, idp: zrszDetailId(job) })).filter(item => item.idp).slice(0, maxRequests);
  if (!candidates.length) return { jobs: current.map(job => plan.jobs.find(item => item.id === job.id)), stats: { ...plan.stats, attempted: 0, enriched: 0, failed: 0, missingDirectId: plan.requests.length } };
  const requests = candidates.map(item => ({ ...item, url: detailUrl(endpointTemplate, item.idp) }));
  const updated = new Map();
  let next = 0, failed = 0;
  async function worker() {
    while (next < requests.length) {
      const item = requests[next++];
      try {
        const response = await fetchImpl(item.url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw Error('HTTP ' + response.status);
        if (!(response.headers.get('content-type') || '').includes('application/json')) throw Error('ZRSZ: odgovor ni JSON');
        if (Number(response.headers.get('content-length')) > 250_000) throw Error('ZRSZ: prevelik odgovor');
        const body = await response.text();
        if (body.length > 250_000) throw Error('ZRSZ: prevelik odgovor');
        const details = parseZrszDetailResponse(JSON.parse(body), item.job, item.idp);
        updated.set(item.job.id, { ...details, detailsFetchedAt: new Date(now).toISOString(), detailsCheckedAt: new Date(now).toISOString() });
      } catch {
        failed++;
        updated.set(item.job.id, { detailsCheckedAt: new Date(now).toISOString() });
      }
      if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, worker));
  return {
    jobs: current.map(original => {
      const job = plan.jobs.find(item => item.id === original.id);
      return updated.has(job.id) ? { ...job, ...updated.get(job.id) } : job;
    }),
    stats: { ...plan.stats, attempted: requests.length, enriched: requests.length - failed,
      failed, missingDirectId: plan.requests.length - requests.length },
  };
}

// Ročni pilot z neposrednimi HTTP/JSON zahtevki. Nikoli ne odpira oglasov v brskalniku.
import { discoverZrszPublicClient, matchZrszListingIds } from '../source/zrsz-official-http.js';
import { fetchEuresAdditional } from '../source/eures-source.js';
import { careerjetProbeStatus } from '../source/portal-probe.js';

const parameter = name => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const count = Number(parameter('limit') || 3);
const requested = (parameter('sources') || 'zrsz,eures,careerjet').split(',').map(x => x.trim());
if (!requested.length || requested.some(x => !['zrsz', 'eures', 'careerjet'].includes(x))) {
  throw Error('Dovoljeni viri: zrsz,eures,careerjet');
}
const maxCount = requested.every(x => x === 'zrsz') ? 100 : 5;
if (!Number.isInteger(count) || count < 1 || count > maxCount) {
  throw Error(`Pilot za izbrane vire podpira samo --limit=1..${maxCount}`);
}
const output = { type: 'DeloRadar HTTP portal pilot', countPerSource: count,
  capturedAt: new Date().toISOString(), sources: {} };

async function zrszSample() {
  const client = await discoverZrszPublicClient();
  const [daily, listing] = await Promise.all([client.daily(), client.listings()]);
  const candidates = matchZrszListingIds(daily.jobs, listing.jobs).jobs
    .filter(job => job.zrszIdCandidateSource === 'ZRSZ listing').slice(0, count);
  let verified = 0;
  const records = [];
  for (const item of candidates) {
    const detail = await client.detail(item.zrszIdCandidate);
    const matches = String(detail.registerskaStevilka).toUpperCase() === item.reference;
    if (matches) verified++;
    records.push({ reference: item.reference, idp: item.zrszIdCandidate, matched: matches });
  }
  return { status: candidates.length === count && verified === count ? 'ok' : 'partial',
    jsonJobs: daily.jobs.length, listedJobs: listing.total, tested: candidates.length, verified, records };
}

async function euresSample() {
  const result = await fetchEuresAdditional({ pages: 1, maxDetails: count, concurrency: 2 });
  return { status: result.errors.length ? 'partial' : 'ok',
    ...result.stats, records: result.jobs.map(job => ({ title: job.title, source: job.euresSource,
      location: job.location, confidence: job.locationConfidence })) };
}

async function careerjetSample() {
  const response = await fetch('https://www.careerjet.si/delovna-mesta', {
    signal: AbortSignal.timeout(20_000),
    headers: { 'user-agent': 'DeloRadar/0.1 (personal metadata index)', accept: 'text/html' },
  });
  if (!response.ok) return { status: 'blocked', reason: `HTTP ${response.status}` };
  if (Number(response.headers.get('content-length')) > 500_000) throw Error('Careerjet: predolg odziv');
  const html = await response.text();
  if (html.length > 500_000) throw Error('Careerjet: predolg odziv');
  return careerjetProbeStatus(html);
}

for (const source of requested) {
  try {
    output.sources[source] = source === 'zrsz' ? await zrszSample()
      : source === 'eures' ? await euresSample() : await careerjetSample();
  } catch (error) {
    output.sources[source] = { status: 'error', reason: String(error?.message || error).slice(0, 300) };
  }
}
console.log(JSON.stringify(output, null, 2));
if (requested.some(source => ['error', 'partial'].includes(output.sources[source].status))) process.exitCode = 1;

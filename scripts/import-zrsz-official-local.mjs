import { writeFile } from 'node:fs/promises';
import { discoverZrszPublicClient, matchZrszListingIds } from '../source/zrsz-official-http.js';

const limit = Number(process.argv[2] || 30);
if (!Number.isInteger(limit) || limit < 0 || limit > 250) throw Error('Število podrobnosti mora biti 0–250');
const client = await discoverZrszPublicClient();
const [daily, list] = await Promise.all([client.daily(), client.listings()]);
const mapped = matchZrszListingIds(daily.jobs, list.jobs);
const jobs = mapped.jobs.map(x => ({ ...x }));
const candidates = jobs.filter(x => x.zrszIdStatus === 'matched-listing-pending-detail').slice(0, limit);
let verified = 0, rejected = 0;
for (const item of candidates) {
  try {
    const detail = await client.detail(item.zrszIdCandidate);
    if (String(detail.registerskaStevilka).toUpperCase() !== item.reference) { rejected++; continue; }
    verified++;
    const idp = item.zrszIdCandidate;
    item.zrszIdStatus = 'confirmed-detail';
    item.url = 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/?idp=' + idp + '/#/pdm/' + idp;
  } catch { rejected++; }
}
const output = 'zrsz-official-http-local.json';
const report = { capturedAt: daily.payload.DatumObjave, jsonJobs: daily.jobs.length,
  listedJobs: list.total, ...mapped.stats, attemptedDetails: candidates.length, verified, rejected };
await writeFile(output, JSON.stringify({ kind: 'zrsz-official-http-import', checkedAt: new Date().toISOString(),
  report, jobs }, null, 2) + '\n');
console.log(JSON.stringify({ output, report, directUrlExamples: jobs.filter(j => j.zrszIdStatus === 'confirmed-detail')
  .slice(0, 3).map(x => ({ reference: x.reference, idp: x.zrszIdCandidate })) }, null, 2));

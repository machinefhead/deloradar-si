import { readFile, writeFile } from 'node:fs/promises';
import { discoverZrszPublicClient } from '../source/zrsz-official-http.js';

const args = process.argv.slice(2);
const max = Number(args[0] || 300);
const output = args[1] || 'data/zrsz-idp-verified.json';
if (!Number.isInteger(max) || max < 1 || max > 5000) throw Error('Največje število: 1–5000');

const client = await discoverZrszPublicClient();
const [daily, listed] = await Promise.all([client.daily(), client.listings()]);
const numericListings = listed.jobs.filter(x => /^\d{6,10}$/.test(String(x.idDelovnoMesto)));
let old;
try { old = JSON.parse(await readFile(output, 'utf8')); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const dailyRefs = new Set(daily.jobs.map(x => x.reference));
const listedIds = new Set(numericListings.map(x => String(x.idDelovnoMesto)));
const verified = new Map((old?.records || []).filter(x =>
  dailyRefs.has(x.reference) && listedIds.has(x.idp) && /^\d{6,10}$/.test(x.idp))
  .map(x => [x.idp, x]));
const remaining = numericListings.filter(x => !verified.has(String(x.idDelovnoMesto))).slice(0, max);
let index = 0, attempts = 0, errors = 0, unmatched = 0, stopRequested = false;
const errorIds = [];
const recentFailures = [];
async function save() {
  await writeFile(output, JSON.stringify({ kind: 'zrsz-official-idp-verification',
    capturedAt: daily.payload.DatumObjave, checkedAt: new Date().toISOString(),
    records: [...verified.values()],
    stats: { daily: daily.jobs.length, listed: listed.total, numericListings: numericListings.length,
      otherIdsSkipped: listed.total - numericListings.length, verified: verified.size,
      attemptedThisRun: attempts, failedThisRun: errors, notInDaily: unmatched,
      remaining: numericListings.length - verified.size, errorIds },
  }, null, 2) + '\n');
}
async function worker() {
  while (index < remaining.length) {
    if (stopRequested) break;
    const listing = remaining[index++];
    const idp = String(listing.idDelovnoMesto);
    let failed = false;
    try {
      const detail = await client.detail(idp);
      const reference = String(detail.registerskaStevilka || '').trim().toUpperCase();
      if (/^[A-Z]{2}\d{5,}$/.test(reference) && dailyRefs.has(reference)) {
        verified.set(idp, { idp, reference });
      } else unmatched++;
    } catch { errors++; errorIds.push(idp); failed = true; }
    attempts++;
    recentFailures.push(failed);
    if (recentFailures.length > 50) recentFailures.shift();
    // HTTP 403/429/503 ali izpad omrežja: po več zaporednih napakah ne obremenjuj storitve.
    if (recentFailures.length >= 20 && recentFailures.filter(Boolean).length >= 8) {
      stopRequested = true;
    }
    if (attempts % 100 === 0) {
      await save();
      console.log(JSON.stringify({ processed: attempts, verified: verified.size,
        errors, remaining: numericListings.length - verified.size }));
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
await save();
console.log(JSON.stringify({ finished: attempts, verified: verified.size,
  errors, notInDaily: unmatched, remaining: numericListings.length - verified.size,
  stoppedForErrors: stopRequested }));

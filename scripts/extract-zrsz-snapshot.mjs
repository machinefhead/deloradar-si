import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourcePath = process.argv[2];
if (!sourcePath) throw Error('Uporaba: node scripts/extract-zrsz-snapshot.mjs POT-DO-ARHIVSKEGA-JOBS.JSON');
const source = JSON.parse(await readFile(resolve(sourcePath), 'utf8'));
if (!Array.isArray(source.jobs) || !Number.isFinite(Date.parse(source.checkedAt))) throw Error('Neveljaven arhivski posnetek');
const allowed = ['id', 'reference', 'title', 'company', 'location', 'date', 'deadline', 'description',
  'responsibilities', 'requirements', 'education', 'experience', 'employmentType', 'contractType',
  'contractDuration', 'workHours', 'workplaceAddress', 'salary', 'benefits', 'url'];
const jobs = source.jobs.filter(item => item.source === 'ZRSZ / PoiščiDelo')
  .map(item => Object.fromEntries(allowed.filter(key => item[key] !== undefined && item[key] !== null)
    .map(key => [key, item[key]])));
if (jobs.length < 1000 || jobs.some(item => item.id !== `zrsz:${item.reference}`)) throw Error('Nepričakovana struktura ZRSZ arhiva');
const snapshot = { version: 1, kind: 'historical-zrsz-preview', capturedAt: source.checkedAt,
  origin: 'GitHub Actions run 45647386600, 25. 11. 2026' };
const target = resolve('data/zrsz-preview.json');
await mkdir(dirname(target), { recursive: true });
const chunkSize = 500;
const shards = [];
for (let offset = 0; offset < jobs.length; offset += chunkSize) {
  const file = `zrsz-preview-${shards.length + 1}.json`;
  await writeFile(resolve('data', file), JSON.stringify(jobs.slice(offset, offset + chunkSize)), 'utf8');
  shards.push(file);
}
await writeFile(target, JSON.stringify({ ...snapshot, total: jobs.length, shards }), 'utf8');
console.log(`ZRSZ testni posnetek: ${jobs.length} oglasov; ${jobs.filter(job => /\?idp=\d+/.test(job.url)).length} neposrednih povezav`);

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchEuresAdditional } from '../source/eures-source.js';

const args = process.argv.slice(2);
function flag(name, fallback) {
  const position = args.indexOf('--' + name);
  return position === -1 ? fallback : Number(args[position + 1]);
}
const pages = flag('pages', 3);
const startPage = flag('start-page', 1);
const maxDetails = flag('details', 100);
const output = resolve('eures-additional-local.json');
const existing = JSON.parse(await readFile(resolve('dist/jobs.json'), 'utf8'));
const result = await fetchEuresAdditional({ pages, startPage, maxDetails, existingJobs: existing.jobs });
await writeFile(output, JSON.stringify({ kind: 'eures-additional-local', checkedAt: new Date().toISOString(),
  ...result }, null, 2) + '\n');
console.log(JSON.stringify({ output, stats: result.stats, exampleTitles: result.jobs.slice(0, 8)
  .map(x => ({ title: x.title, location: x.location, origin: x.euresSource })) }, null, 2));

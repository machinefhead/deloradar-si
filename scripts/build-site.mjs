import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { page } from '../source/page.js';
import collector from '../source/collector.js';

async function fetchJobs() {
  const fixtureIndex = process.argv.indexOf('--fixture');
  if (fixtureIndex !== -1) {
    const path = process.argv[fixtureIndex + 1];
    if (!path) throw new Error('Za --fixture podaj pot JSON datoteke.');
    return JSON.parse(await readFile(resolve(path), 'utf8'));
  }
  const response = await collector.fetch(new Request('https://deloradar.invalid/api/jobs'));
  if (!response.ok) throw new Error(`Zbiralnik je vrnil HTTP ${response.status}`);
  return response.json();
}

const data = await fetchJobs();
assert.ok(Array.isArray(data.jobs), 'Manjka jobs');
assert.ok(Array.isArray(data.sources), 'Manjka sources');
assert.ok(Array.isArray(data.planned), 'Manjka planned');
assert.ok(data.checkedAt && !Number.isNaN(Date.parse(data.checkedAt)), 'Manjka checkedAt');
if (data.jobs.length === 0) {
  // Ne objavi prazne strani ob začasnem izpadu vseh virov.
  throw new Error('Nobeden od povezanih portalov ni vrnil oglasov. Obdrži prejšnjo objavo.');
}
const seen = new Set();
for (const job of data.jobs) {
  assert.ok(job.id && job.title && job.source, 'Oglas ima nepopolne osnovne podatke');
  assert.ok(/^https:\/\//.test(job.url), 'Oglas nima varne izvorne povezave');
  assert.ok(!seen.has(job.id), 'Podvojeni ID oglasa');
  seen.add(job.id);
}

await mkdir('dist', { recursive: true });
await Promise.all([
  writeFile('dist/index.html', page, 'utf8'),
  writeFile('dist/jobs.json', JSON.stringify(data), 'utf8'),
]);
console.log(`Pripravljena stran: ${data.jobs.length} oglasov, ${data.sources.filter(s => s.status === 'live').length} aktivnih virov.`);

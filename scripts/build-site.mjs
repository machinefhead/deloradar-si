import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { page } from '../source/page.js';
import collector from '../source/collector.js';
import { attachVerifiedEuresDetailLinks } from '../source/zrsz-eures-map.js';
import { attachZrszOfficialVerifiedLinks } from '../source/zrsz-official-http.js';

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
try {
  const mapping = JSON.parse(await readFile('data/eures-zrsz-mapping.json', 'utf8'));
  if (mapping.kind !== 'eures-zrsz-detail-links' || !Array.isArray(mapping.candidates)) {
    throw Error('Napačna preslikava EURES/ZRSZ');
  }
  data.jobs = attachVerifiedEuresDetailLinks(data.jobs, mapping.candidates).jobs;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
try {
  const verified = JSON.parse(await readFile('data/zrsz-idp-verified.json', 'utf8'));
  if (verified.kind !== 'zrsz-official-idp-verification' || !Array.isArray(verified.records)) {
    throw Error('Neveljavni preverjeni ZRSZ ID-ji');
  }
  data.jobs = attachZrszOfficialVerifiedLinks(data.jobs, verified.records).jobs;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
assert.ok(Array.isArray(data.jobs), 'Manjka jobs');
assert.ok(Array.isArray(data.sources), 'Manjka sources');
assert.ok(Array.isArray(data.planned), 'Manjka planned');
assert.ok(data.checkedAt && !Number.isNaN(Date.parse(data.checkedAt)), 'Manjka checkedAt');
if (process.env.DELORADAR_REQUIRE_ALL_SOURCES === '1') {
  const unavailable = data.sources.filter(source => source.status !== 'live');
  assert.equal(unavailable.length, 0, 'Objava preklicana: nedosegljivi viri: ' +
    unavailable.map(source => source.name).join(', '));
}
if (process.env.ZRSZ_OFFICIAL_HTTP_ENABLED === '1') {
  const zrsz = data.sources.find(s => s.id === 'zrsz');
  assert.ok(zrsz?.status === 'live' && zrsz.count > 0, 'Samodejni ZRSZ HTTP uvoz ni uspel');
}
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
// Starih testnih posnetkov ZRSZ ne izdajamo skupaj z dejansko spletno stranjo.
// Odstranimo samo že ustvarjene datoteke tega nekdanjega predogleda.
const oldPreviews = (await readdir('dist')).filter(name => /^zrsz-preview(?:-\d+)?\.(?:json|html)$/.test(name));
await Promise.all(oldPreviews.map(name => unlink(`dist/${name}`)));
console.log(`Pripravljena stran: ${data.jobs.length} oglasov, ${data.sources.filter(s => s.status === 'live').length} aktivnih virov.`);

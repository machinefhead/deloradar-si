// Vizualna objava: uporabi nespremenjen zadnji javni posnetek jobs.json.
// Ne uvaža collector.js in ne pošilja zahtevkov zaposlitvenim portalom.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { page } from '../source/page.js';

const publicSnapshot = 'https://machinefhead.github.io/deloradar-si/jobs.json';
const maxBytes = 35_000_000;
const fixtureIndex = process.argv.indexOf('--fixture');
let bytes;
if (fixtureIndex >= 0) {
  assert.ok(process.argv[fixtureIndex + 1], 'Za --fixture podaj pot do obstoječega jobs.json');
  bytes = await readFile(resolve(process.argv[fixtureIndex + 1]));
} else {
  const response = await fetch(publicSnapshot, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  assert.equal(response.status, 200, 'Zadnji javni posnetek ni dosegljiv; objavo prekini');
  assert.ok(Number(response.headers.get('content-length') || 0) <= maxBytes,
    'Javni posnetek presega dovoljeno velikost');
  bytes = Buffer.from(await response.arrayBuffer());
}
assert.ok(bytes.length > 100 && bytes.length <= maxBytes, 'Javni posnetek je prazen ali prevelik');
const data = JSON.parse(bytes.toString('utf8'));
assert.ok(Array.isArray(data.jobs) && data.jobs.length > 0, 'Manjkajo oglasi');
assert.ok(Array.isArray(data.sources) && data.sources.length > 0, 'Manjkajo povezani viri');
assert.ok(Array.isArray(data.planned), 'Manjka seznam kandidatov');
assert.ok(data.checkedAt && !Number.isNaN(Date.parse(data.checkedAt)), 'Manjka datum zadnjega zajema');
assert.ok(data.jobs.every(job => job.id && job.title && job.source && /^https:\/\//.test(job.url)),
  'Javni posnetek vsebuje nepopolne oglase');

await mkdir('dist', { recursive: true });
await Promise.all([
  writeFile('dist/index.html', page, 'utf8'),
  writeFile('dist/jobs.json', bytes), // Namenoma brez nove serializacije ali spremembe datuma.
]);
const hash = createHash('sha256').update(bytes).digest('hex');
console.log(`Objava samo videza: ${data.jobs.length} nespremenjenih oglasov, ` +
  `${data.sources.length} virov; SHA-256 posnetka ${hash}.`);
console.log('Zahtevki zaposlitvenim portalom: 0.');

// Samo Mjob: prenese zadnji javni posnetek in največ nekaj podrobnosti Mjob.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { page } from '../source/page.js';
import { getMjob, MJOB_SOURCE } from '../source/mjob.js';
import { mergeMjobSnapshot } from '../source/incremental.js';

const publicSnapshot = 'https://machinefhead.github.io/deloradar-si/jobs.json';
const source = process.env.INCREMENTAL_SOURCE || 'mjob';
assert.equal(source, 'mjob', 'Ciljni zajem za ta vir še ni pripravljen');
const maxDetails = Number(process.env.MJOB_NEW_LIMIT || 12);
assert.ok(Number.isInteger(maxDetails) && maxDetails >= 1 && maxDetails <= 50,
  'Mjob: na en zagon dovoli največ 50 podrobnosti');
const fixtureIndex = process.argv.indexOf('--fixture');
let bytes;
if (fixtureIndex >= 0) {
  assert.ok(process.argv[fixtureIndex + 1], 'Za --fixture podaj pot do jobs.json');
  bytes = await readFile(resolve(process.argv[fixtureIndex + 1]));
} else {
  const response = await fetch(publicSnapshot, {
    headers: { accept: 'application/json' }, signal: AbortSignal.timeout(60_000),
  });
  assert.equal(response.status, 200, 'Zadnji javni posnetek ni dosegljiv; objavo prekini');
  assert.ok(Number(response.headers.get('content-length') || 0) <= 35_000_000, 'Javni posnetek je prevelik');
  bytes = Buffer.from(await response.arrayBuffer());
}
assert.ok(bytes.length > 100 && bytes.length <= 35_000_000, 'Javni posnetek je prazen ali prevelik');
const previous = JSON.parse(bytes.toString('utf8'));
const result = await getMjob({ previous: previous.jobs?.filter(j => j.source === MJOB_SOURCE),
  previousState: previous.discovery?.mjob, maxDetails });
const data = mergeMjobSnapshot(previous, result);
await mkdir('dist', { recursive: true });
await Promise.all([
  writeFile('dist/index.html', page, 'utf8'),
  writeFile('dist/jobs.json', JSON.stringify(data), 'utf8'),
]);
console.log(`Ciljni zajem: Mjob ${result.jobs.length} oglasov, skupaj ${data.jobs.length}; ` +
  `ohranjenih ${previous.jobs.length - previous.jobs.filter(j => j.source === MJOB_SOURCE).length} ` +
  'oglasov iz drugih virov; drugi portali niso bili obiskani.');

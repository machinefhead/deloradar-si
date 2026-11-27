// Samo izbrani novi vir: ostale oglase in povezave ohrani iz javnega posnetka.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { page } from '../source/page.js';
import { getMjob, MJOB_SOURCE } from '../source/mjob.js';
import { getKrka, KRKA_SOURCE } from '../source/krka.js';
import { getTelekom, TELEKOM_SOURCE } from '../source/telekom.js';
import { getA1, A1_SOURCE } from '../source/a1.js';
import { mergeMjobSnapshot, mergeKrkaSnapshot, mergeTelekomSnapshot, mergeA1Snapshot } from '../source/incremental.js';

const publicSnapshot = 'https://machinefhead.github.io/deloradar-si/jobs.json';
const source = process.env.INCREMENTAL_SOURCE || 'mjob';
assert.ok(['mjob', 'krka', 'telekom', 'a1'].includes(source), 'Ciljni zajem za ta vir še ni pripravljen');
const maxDetails = Number(process.env.MJOB_NEW_LIMIT || 12);
assert.ok(source !== 'mjob' || (Number.isInteger(maxDetails) && maxDetails >= 1 && maxDetails <= 50),
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
const result = source === 'mjob' ? await getMjob({
  previous: previous.jobs?.filter(j => j.source === MJOB_SOURCE),
  previousState: previous.discovery?.mjob, maxDetails,
}) : source === 'krka' ? await getKrka() : source === 'telekom' ? await getTelekom() : await getA1();
const data = source === 'mjob' ? mergeMjobSnapshot(previous, result) :
  source === 'krka' ? mergeKrkaSnapshot(previous, result) :
    source === 'telekom' ? mergeTelekomSnapshot(previous, result) : mergeA1Snapshot(previous, result);
await mkdir('dist', { recursive: true });
await Promise.all([
  writeFile('dist/index.html', page, 'utf8'),
  writeFile('dist/jobs.json', JSON.stringify(data), 'utf8'),
]);
const sourceName = source === 'mjob' ? MJOB_SOURCE : source === 'krka' ? KRKA_SOURCE :
  source === 'telekom' ? TELEKOM_SOURCE : A1_SOURCE;
console.log(`Ciljni zajem: ${sourceName} ${result.jobs.length} oglasov, skupaj ${data.jobs.length}; ` +
  `ohranjenih ${previous.jobs.length - previous.jobs.filter(j => j.source === sourceName).length} ` +
  'oglasov iz drugih virov; drugi portali niso bili obiskani.');

import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { page } from '../source/page.js';

assert.match(page, /<html lang="sl">/);
assert.match(page, /href="\.\/"/);
assert.match(page, /\.\/jobs\.json/);
assert.match(page, /function configureMulti\(/);
assert.match(page, /function persistFilters\(/);

const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Predloga mora vsebovati odjemalsko skripto');
new Script(script, { filename: 'deloradar-client.js' });

const { parseGovListings } = await import('../source/collector.js');
const row = (status, slug) => `<tr>
  <td class="td-title"><a href="/zbirke/delovna-mesta/${slug}/">Referent javnega sektorja</a></td>
  <td>20. 11. 2026</td><td>4. 12. 2026</td><td>Občina Test</td>
  <td>Javni natečaj</td><td>Nedoločen čas</td><td>Polni delovni čas</td><td><i class="label">${status}</i></td>
</tr>`;
const gov = parseGovListings(`<table><tbody>${row('V teku', 'test-1')}</tbody>${row('Zaključeno', 'test-2')}</tbody></table>`);
assert.equal(gov.length, 1, 'Zaključeni javni razpisi ne sodijo v rezultate');
assert.equal(gov[0].source, 'GOV.SI');
assert.equal(gov[0].date, '2026-11-20');
assert.equal(gov[0].deadline, '2026-12-04');
assert.equal(gov[0].url, 'https://www.gov.si/zbirke/delovna-mesta/test-1/');

console.log('OK: predloga, odjemalski JS in parser GOV.SI');

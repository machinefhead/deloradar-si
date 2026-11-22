import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { page } from '../source/page.js';

assert.match(page, /<html lang="sl">/);
assert.match(page, /href="\.\/"/);
assert.match(page, /\.\/jobs\.json/);
assert.match(page, /function configureMulti\(/);
assert.match(page, /function persistFilters\(/);

const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Predloga mora vsebovati odjemalsko skripto');
new Script(script, { filename: 'deloradar-client.js' });
assert.match(page, /\.multi-option\[hidden\]\{display:none!important\}/, 'Iskanje po večizbirnih možnostih mora dejansko skriti vrstice');
assert.match(page, /Ročni zajem prek GitHuba/);
const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
assert.match(workflow, /cron: '17,47 \* \* \* \*'/, 'Osveževanje mora biti predvideno vsakih 30 minut');

const extract = (start, end) => {
  const a = script.indexOf(start), b = script.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Manjka odsek ${start}`);
  return script.slice(a, b);
};
const selected = { region: ['Podravska'] };
const controls = { search: '', place: '', published: '', deadline: '', myStatus: '' };
const context = {
  jobs: [
    { id: '1', title: 'Električar', company: 'A', location: 'Maribor', region: 'Podravska', sector: 'Elektrotehnika', source: 'Optius' },
    { id: '2', title: 'Programer', company: 'B', location: 'Ptuj', region: 'Podravska', sector: 'IT', source: 'Kariera.si' },
    { id: '3', title: 'Programer', company: 'A', location: 'Ljubljana', region: 'Osrednjeslovenska', sector: 'IT', source: 'Optius' },
    { id: '4', title: 'Programer', company: 'A', location: 'Maribor', region: 'Podravska', sector: 'IT', source: 'GOV.SI' }
  ],
  multiIds: ['sourceFilter', 'region', 'city', 'sector', 'company'],
  selectedValues: id => selected[id] || [],
  regionOf: job => job.region,
  sectorOf: job => job.sector,
  $: id => ({ value: controls[id] || '', checked: false }),
  dateValue: () => NaN,
  getState: () => ({})
};
runInNewContext(
  extract('function normalizeTerm(', 'function configureMulti(') + '\n' +
  extract('function matchesJob(', 'function filtered('), context
);
assert.equal(context.normalizeTerm('Škofja Loka'), 'skofja loka', 'Besedno iskanje mora delovati tudi brez šumnikov');
assert.deepEqual(JSON.parse(JSON.stringify(Array.from(context.facetCounts('city').entries()))), [['Maribor', 2], ['Ptuj', 1]], 'Regija mora zožiti kraje in prikazati število zadetkov');
selected.sector = ['IT'];
assert.deepEqual(JSON.parse(JSON.stringify(Array.from(context.facetCounts('city').entries()))), [['Ptuj', 1], ['Maribor', 1]], 'Vse druge izbire morajo vplivati na možnosti krajev');
selected.city = ['Maribor'];
assert.equal(context.jobs.filter(job => context.matchesJob(job)).length, 1, 'Filtri morajo delovati skupaj');
assert.equal(context.facetCounts('region').get('Podravska'), 1, 'Število pri regiji upošteva ostale filtre');

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

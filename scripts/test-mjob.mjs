import assert from 'node:assert/strict';
import { MJOB_SOURCE, parseMjobSitemap, parseMjobDetail, getMjob } from '../source/mjob.js';

const sitemap = '<?xml version="1.0"?><urlset>' +
  [264665, 264664, 264665].map(id => `<url><loc>https://mjob.si/jobi-studentsko-delo/podrobnosti/${id}</loc></url>`).join('') +
  '<url><loc>https://evil.example/jobi-studentsko-delo/podrobnosti/999999</loc></url></urlset>';
assert.deepEqual(parseMjobSitemap(sitemap, { minimum: 2 }), ['264665', '264664']);
assert.throws(() => parseMjobSitemap('<html>Ni sitemapa</html>', { minimum: 0 }));
assert.throws(() => parseMjobSitemap(sitemap), /nepopoln/, 'Ne objavi okrnjenega uradnega sitemapa');

function detail(id, title = 'Pomoč pri prodaji') {
  return `<html><h1 class="break-word text-h3">${title}</h1>` +
    '<span class="text-[16px] font-extralight">PODJETJE D.O.O.</span>' +
    `<div>Šifra<!-- -->: <span class="rounded-full">${id}</span></div>` +
    '<p>Kraj dela<!-- -->:</span><span>Maribor</span></p>' +
    '<p class="mt-6">Pomagaj pri prodaji in pripravi izdelkov. Piši na kadri@example.com.</p>' +
    '<div><p>Opis dela</p><ul><li>Sprejem strank</li><li>Urejanje polic</li></ul></div>' +
    '<div><p>Nudimo</p><ul><li>Fleksibilen urnik</li></ul></div>' +
    '<div><p>Zahtevana znanja</p><ul><li>Slovenščina</li></ul></div>' +
    '<p>Delovni čas<!-- -->:</span><span>Popoldan</span></p></html>';
}
const parsed = parseMjobDetail(detail(264665), '264665');
assert.equal(parsed.id, 'mjob:264665');
assert.equal(parsed.source, MJOB_SOURCE);
assert.equal(parsed.location, 'Maribor');
assert.equal(parsed.date, '');
assert.equal(parsed.deadline, '');
assert.ok(parsed.description.includes('Sprejem strank'));
assert.ok(!parsed.description.includes('kadri@example.com'));
assert.equal(parsed.workSchedule, 'Popoldan');
assert.equal(parsed.benefits, 'Fleksibilen urnik');
assert.throws(() => parseMjobDetail(detail(264665), '264664'), /ne ustrezajo/);
assert.throws(() => parseMjobDetail('<html><h1>Ni oglasa</h1></html>', '264665'), /ne ustrezajo/);

const requested = [];
const fakeText = async url => {
  requested.push(url);
  if (url.endsWith('/sitemap.xml')) return sitemap;
  return detail(url.slice(-6));
};
const first = await getMjob({ fetchText: fakeText, minimum: 2, maxDetails: 1, pauseMs: 0,
  now: '2026-11-27T10:00:00Z' });
assert.equal(first.jobs.length, 1);
assert.equal(first.progress.total, 2);
assert.equal(first.progress.checked, 1);
assert.equal(requested.length, 2, 'Prvi zajem vsebuje samo sitemap in eno podrobnost');
requested.length = 0;
const second = await getMjob({ fetchText: fakeText, minimum: 2, maxDetails: 1, pauseMs: 0,
  previous: first.jobs, previousState: first.state, now: '2026-11-28T10:00:00Z' });
assert.equal(second.jobs.length, 2);
assert.equal(second.progress.checked, 2);
assert.equal(requested.length, 2, 'Ponovno uporabi predpomnilnik in preveri samo nov ID');
assert.ok(second.jobs.some(job => job.id === first.jobs[0].id), 'Stari oglasi se pri ciljnem uvozu ohranijo');
await assert.rejects(getMjob({ fetchText: fakeText, minimum: 2, maxDetails: 0,
  previousState: { total: 4 }, pauseMs: 0 }), /občutno krajši/);

const removed = await getMjob({ fetchText: async url => url.endsWith('/sitemap.xml') ? sitemap : null,
  minimum: 2, maxDetails: 1, pauseMs: 0, previous: second.jobs,
  previousState: second.state, now: '2026-12-20T10:00:00Z' });
assert.equal(removed.jobs.length, 1, 'Potrjeni HTTP 404 izloči samo svoj oglas');
await assert.rejects(getMjob({ fetchText: async url => {
  if (url.endsWith('/sitemap.xml')) return sitemap;
  throw Error('HTTP 403');
}, minimum: 2, maxDetails: 1, pauseMs: 0 }), /403/, 'Zavrnitev dostopa mora ustaviti uvoz');
await assert.rejects(getMjob({ maxDetails: 51 }), /prevelika/);
console.log('Mjob: javni sitemap, izvirni ID-ji, varni opisi, predpomnilnik, omejitve in 404: uspešno.');

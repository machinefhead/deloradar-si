import assert from 'node:assert/strict';
import { getTelekom, parseTelekomJob, parseTelekomListing, TELEKOM_URL } from '../source/telekom.js';

const urls = [
  'https://zaposlitev.telekom.si/job/tehnik-na-terenu/1458743333/',
  'https://zaposlitev.telekom.si/job/prodajalec-v-Telekomovem-centru-Ptuj/1461096833/',
];
const listing = `<table id="searchresults"><tbody>${urls.map((url, i) =>
  `<tr><td><a href="${new URL(url).pathname}" class="jobTitle-link">naziv ${i}</a>` +
  `<a href="${new URL(url).pathname}" class="jobTitle-link">naziv ${i}</a></td></tr>`).join('')}</tbody></table>` +
  `<span class="paginationLabel">Rezultati <b>1 – 2</b> od <b>2</b></span>`;
const listed = parseTelekomListing(listing);
assert.deepEqual(listed.map(job => job.url), urls);
assert.throws(() => parseTelekomListing(listing.replace('od <b>2</b>', 'od <b>3</b>')), /nepopoln/);
assert.throws(() => parseTelekomListing(listing.replace('<table id="searchresults">', '<table>')), /ni prepoznan/);
const detail = (title, content, deadline = 'Sun Nov 29 23:00:00 UTC 2026') => `
<div itemtype="http://schema.org/JobPosting">
<meta itemprop="datePosted" content="Thu Nov 19 00:00:00 UTC 2026">
<meta itemprop="validThrough" content="${deadline}">
<h1><span itemprop="title" data-careersite-propertyid="title">${title}</span></h1>
<span itemprop="description"><span class="jobdescription"><p>${content}</p>
<p>Opis nalog in pogojev za zaposlitev, prijave ter možnost pridobitve strokovnih izkušenj.</p>
</span></span></div>`;
const descriptions = [
  detail('tehnik na terenu', 'Delo se bo izvajalo na terenu. Iščemo kandidata za izvajanje del na območju Maribora in okolice.'),
  detail('prodajalec v Telekomovem centru Ptuj', 'Delo se bo opravljalo v Telekomovem centru Ptuj, v prodaji izdelkov in storitev.'),
];
const parsed = parseTelekomJob(descriptions[0], urls[0], '2026-11-27T10:00:00Z');
assert.equal(parsed.id, 'telekom:1458743333');
assert.equal(parsed.title, 'tehnik na terenu');
assert.equal(parsed.location, 'Maribor');
assert.equal(parsed.date, '2026-11-19');
assert.equal(parsed.deadline, '2026-11-29');
assert.ok(parsed.description.includes('strokovnih izkušenj'));
assert.equal(parseTelekomJob(descriptions[0], urls[0], '2026-12-01T10:00:00Z'), null);
assert.throws(() => parseTelekomJob(descriptions[0], 'https://example.com/job/x/1458743333/'), /neveljavna/);
assert.throws(() => parseTelekomJob(descriptions[0].replace('itemprop="title"', 'data-title="x"'), urls[0]), /manjkajo/);
const calls = [];
const result = await getTelekom({ fetchImpl: async (url, opts) => {
  calls.push(url);
  assert.equal(opts.redirect, 'manual');
  return new Response(url === TELEKOM_URL ? listing : descriptions[urls.indexOf(url)], { status: 200 });
}, now: '2026-11-27T10:00:00Z', pauseMs: 0 });
assert.equal(result.jobs.length, 2);
assert.deepEqual(result.jobs.map(job => job.location), ['Maribor', 'Ptuj']);
assert.deepEqual(result.progress, { checked: 2, total: 2, pending: false });
assert.deepEqual(calls, [TELEKOM_URL, ...urls]);
await assert.rejects(() => getTelekom({ fetchImpl: async () =>
  new Response('Preveč zahtevkov', { status: 429 }), pauseMs: 0 }), /429/);
console.log('Telekom Slovenije: uradni seznam, tri omejene zahteve, datum, lokacija, opis in zaščita pred nepopolnim zajemom uspešni.');

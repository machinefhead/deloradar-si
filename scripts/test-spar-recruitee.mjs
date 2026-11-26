import assert from 'node:assert/strict';
import { getSpar, parseSparJob, parseSparListingLinks, parseSparRegions } from '../source/spar.js';
import { getMerkurRecruitee, parseMerkurRecruitee } from '../source/recruitee.js';

const origin = 'https://www.spar.si';
const path = '/zaposlitev/vodja-digitalnih-projektov';
const jobHtml = `<section class="job-detail"><h1 class="h2 job-detail__headline">Vodja projektov (m/ž)</h1>
<div class="job-detail__info-container"><h4 class="job-detail__info-headline job-detail__info-headline--info-box">Kraj zaposlitve:</h4><div class="job-detail__info-text">Ljubljana</div></div>
<div class="job-detail__info-container"><h4 class="job-detail__info-headline">Delo obsega</h4><div class="job-detail__info-text text"><ul><li>Razvoj spletnih rešitev za stranke</li></ul></div></div>
<div class="job-detail__info-container"><h4 class="job-detail__info-headline">Kaj pričakujemo</h4><div class="job-detail__info-text text"><ul><li>Izkušnje in dobro poznavanje programske opreme</li></ul></div></div>
<div class="job-detail__info-container"><h4 class="job-detail__info-headline">Nudimo</h4><div class="job-detail__info-text text"><ul><li>Prijetno delovno okolje z mentorstvom</li></ul></div></div>
<div class="job-detail__info-container"><h4 class="job-detail__info-headline">Opomba</h4><div class="job-detail__info-text text">Rok za prijavo kandidatov: 20. 11. 2026 - 30. 11. 2026. Kontakt: kadri@example.com</div></div></section>`;
const directUrl = origin + path;
const parsed = parseSparJob(jobHtml, directUrl, 'Trgovine', ['Podravska'], '2026-11-26');
assert.equal(parsed.url, directUrl);
assert.equal(parsed.location, 'Ljubljana');
assert.equal(parsed.deadline, '2026-11-30');
assert.ok(parsed.description.includes('Razvoj spletnih rešitev'));
assert.ok(parsed.requirements.includes('Izkušnje'));
assert.ok(parsed.benefits.includes('mentorstvo'));
assert.ok(!JSON.stringify(parsed).includes('kadri@example.com'));
assert.equal(parseSparJob(jobHtml, directUrl, 'Trgovine', [], '2026-12-01'), null);
assert.equal(parseSparJob('', directUrl, 'Trgovine'), null);
assert.throws(() => parseSparJob(jobHtml, 'https://example.com/zaposlitev/nekaj', 'Trgovine'));
assert.deepEqual(parseSparListingLinks(`<a href="${path}">Delo</a><a href="${path}">Isto</a>`), [directUrl]);
assert.deepEqual(parseSparRegions('<a href="/zaposlitev-spar/trgovine/podravska">Podravska</a>'),
  [origin + '/zaposlitev-spar/trgovine/podravska']);

const regionSlugs = ['osrednjeslovenska', 'podravska', 'savinjska', 'gorenjska', 'dolenjska'];
let calls = [];
const mockSpar = async url => {
  calls.push(url);
  if (url === origin + '/zaposlitev-spar/trgovine') return regionSlugs
    .map(region => `<a href="/zaposlitev-spar/trgovine/${region}">regija</a>`).join('');
  if (url.startsWith(origin + '/zaposlitev-spar/trgovine/')) return `<a href="${path}">oglas</a>`;
  if (url === directUrl) return jobHtml;
  return '';
};
const first = await getSpar({ fetchHtml: mockSpar, now: '2026-11-26T12:00:00Z' });
assert.equal(first.length, 1);
assert.equal(first[0].regions.length, 5);
assert.equal(calls.filter(url => url === directUrl).length, 1);
calls = [];
const cached = await getSpar({ fetchHtml: mockSpar, previous: first, now: '2026-11-27T12:00:00Z' });
assert.equal(cached.length, 1);
assert.equal(calls.filter(url => url === directUrl).length, 0);

const example = { id: 1234, title: 'Aktuar (m/ž)', country_code: 'SI', status: 'published',
  careers_url: 'https://merkurzavarovalnica.recruitee.com/o/aktuar-mz', city: 'Ljubljana',
  created_at: '2026-11-13 14:06:57 UTC', description: '<p>Strokovno analitično delo na področju aktuarstva, priprava analiz in poročil.</p>',
  requirements: '<p>Aktuarske izkušnje in znanje računovodstva, kadri@example.com.</p>' };
const jobs = parseMerkurRecruitee({ offers: [example, { ...example, id: 2, country_code: 'AT' },
  { ...example, id: 3, status: 'draft' }, { ...example, id: 4, close_at: '2026-11-01' }] }, '2026-11-26');
assert.equal(jobs.length, 1);
assert.equal(jobs[0].date, '2026-11-13');
assert.equal(jobs[0].url, example.careers_url);
assert.ok(jobs[0].description.includes('Strokovno'));
assert.ok(!jobs[0].description.includes('kadri@example.com'));
assert.throws(() => parseMerkurRecruitee({ offers: [{ ...example, careers_url: 'https://evil.example/o/aktuar' }] }));
assert.throws(() => parseMerkurRecruitee({ offers: [example, example] }));
const received = [];
const result = await getMerkurRecruitee({ fetchImpl: async (url, opts) => {
  received.push({ url, accept: opts.headers.accept });
  return Response.json({ offers: [example] });
} });
assert.equal(result.length, 1);
assert.equal(received.length, 1);
assert.equal(received[0].url, 'https://merkurzavarovalnica.recruitee.com/api/offers/');

console.log('SPAR regije in izvirni opisi, Merkur Recruitee JSON, potek, lokacija, kontakti in predpomnilnik: uspešno.');

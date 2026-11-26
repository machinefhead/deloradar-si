import assert from 'node:assert/strict';
import {
  LINKEDIN_SOURCE, parseDelovnaMestaSitemap, parseLinkedinPosting, getLinkedinViaDelovnaMesta,
} from '../source/linkedin-via-delovnamesta.js';

const itemOne = 'https://delovnamesta.si/zaposlitev/inzenir-ljubljana-a1b2c3';
const itemTwo = 'https://delovnamesta.si/zaposlitev/serviser-celje-b2c3d4';
const sitemap = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${itemOne}</loc><lastmod>2026-11-26</lastmod></url>
<url><loc>${itemTwo}</loc><lastmod>2026-11-25</lastmod></url>
<url><loc>https://delovnamesta.si/zaposlitev/strokovni-delavec-rh99925</loc><lastmod>2026-11-26</lastmod></url>
</urlset>`;
const linkedIn = {
  '@context': 'https://schema.org', '@type': 'JobPosting',
  title: 'Inženir programske opreme',
  hiringOrganization: { name: 'Primer d.o.o.' },
  url: 'https://si.linkedin.com/jobs/view/inzenir-primer-4494999236',
  jobLocation: { address: { addressLocality: 'Ljubljana', addressCountry: 'SI' } },
  datePosted: '2026-11-26', validThrough: '2026-12-10', employmentType: ['FULL_TIME'],
  description: '<p>Razvoj aplikacij in testiranje.</p><p>Kontakt: kadri@example.com</p>',
};
const otherPortal = { ...linkedIn, url: 'https://www.kariera.si/sl/delovno-mesto/xyz' };
const posting = value => `<html><script type="application/ld+json">${JSON.stringify(value)}</script></html>`;

assert.deepEqual(parseDelovnaMestaSitemap(sitemap).map(job => job.url), [itemOne, itemTwo]);
const parsed = parseLinkedinPosting(posting(linkedIn), itemOne, '2026-11-26');
assert.equal(parsed.id, 'linkedin:4494999236');
assert.equal(parsed.source, LINKEDIN_SOURCE);
assert.equal(parsed.location, 'Ljubljana');
assert.equal(parsed.deadline, '2026-12-10');
assert.equal(parsed.date, '2026-11-26');
assert.ok(parsed.description.includes('Razvoj aplikacij'));
assert.ok(!parsed.description.includes('kadri@example.com'));
assert.equal(parsed.viaUrl, itemOne);
assert.equal(parseLinkedinPosting(posting(otherPortal), itemTwo), null);
assert.equal(parseLinkedinPosting(posting({ ...linkedIn, validThrough: '2026-11-01' }), itemOne, '2026-11-26'), null);
assert.equal(parseLinkedinPosting(posting({ ...linkedIn, jobLocation: { address: { addressCountry: 'DE' } } }), itemOne), null);
assert.equal(parseLinkedinPosting(posting({ ...linkedIn, url: 'http://si.linkedin.com/jobs/view/4494999236' }), itemOne), null);
assert.equal(parseLinkedinPosting(posting({ ...linkedIn, url: 'https://evil.example/jobs/view/4494999236' }), itemOne), null);

const requested = [];
const fetchText = async url => {
  requested.push(url);
  return url.endsWith('.xml') ? sitemap : url === itemOne ? posting(linkedIn) : posting(otherPortal);
};
const first = await getLinkedinViaDelovnaMesta({ previous: [], previousState: {}, maxScan: 1, fetchText });
assert.equal(first.jobs.length, 1);
assert.equal(first.progress.checked, 1);
assert.equal(first.progress.total, 2);
assert.equal(first.progress.pending, 1);
assert.deepEqual(requested, ['https://delovnamesta.si/sitemap.xml', itemOne]);

requested.length = 0;
const second = await getLinkedinViaDelovnaMesta({
  previous: first.jobs, previousState: first.state, maxScan: 1, fetchText,
});
assert.equal(second.jobs.length, 1);
assert.equal(second.progress.checked, 2);
assert.equal(second.progress.pending, 0);
assert.deepEqual(requested, ['https://delovnamesta.si/sitemap.xml', itemTwo]);

requested.length = 0;
const third = await getLinkedinViaDelovnaMesta({
  previous: second.jobs, previousState: second.state, maxScan: 1, fetchText,
});
assert.equal(third.jobs.length, 1);
assert.deepEqual(requested, ['https://delovnamesta.si/sitemap.xml']);
console.log('LinkedIn prek DelovnaMesta.si: JSON-LD, izvirni URL, država, rok in predpomnilnik uspešni.');

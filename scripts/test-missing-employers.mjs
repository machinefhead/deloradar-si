import assert from 'node:assert/strict';
import { parseTrenkwalderHits, getPublicTrenkwalder } from '../source/trenkwalder-search.js';
import { EMPLOYER_MIRRORS, parseEmployerListings, parseEmployerPosting,
  getEmployerViaDelovnaMesta } from '../source/employers-via-delovnamesta.js';

const trenkwalder = {
  objectID: 'a0tbI00000UwAyfQAF', publishingStatus: 'Published', country: 'SI',
  web: { jobUrl: 'https://si.trenkwalder.com/jobs/a0tbI00000UwAyfQAF', jobAdDate: '2026-11-25T10:00:00Z' },
  jobObject: { title: 'Linijski operater', jobCategory: [{ national: 'Proizvodnja' }] },
  jobLocation: { location: 'Maribor' }, jobParams: { endDate: '2026-12-31' },
  jobContent: { jobDescription: '<p>Priprava proizvodnje.</p>', jobRequirements: '<p>Dobra računalniška znanja.</p>',
    compensationBenefits: '<p>Redna zaposlitev.</p>' },
  jobInfo: { hoursPerWeek: 40, salaryMin: 1700, currency: 'EUR', publishSalary: true },
};
const parsedTrenkwalder = parseTrenkwalderHits([trenkwalder], '2026-11-26')[0];
assert.equal(parsedTrenkwalder.url, trenkwalder.web.jobUrl);
assert.equal(parsedTrenkwalder.description, 'Priprava proizvodnje.');
assert.equal(parsedTrenkwalder.salary.minValue, 1700);
assert.ok(parsedTrenkwalder.requirements.includes('računalniška'));
assert.equal(parseTrenkwalderHits([{ ...trenkwalder, country: 'AT' }]).length, 0);
assert.equal(parseTrenkwalderHits([{ ...trenkwalder, jobParams: { endDate: '2026-10-01' } }], '2026-11-26').length, 0);
assert.throws(() => parseTrenkwalderHits([{ ...trenkwalder, web: { jobUrl: 'https://evil.example/job' } }]));

const mockApp = '"em(\"02IH9HMLGA\",\"0123456789abcdef0123456789abcdef\")"';
const fetched = [];
const mockAlgolia = async (url, options = {}) => {
  fetched.push(url);
  if (url === 'https://si.trenkwalder.com/jobs') return new Response('<script src="/_next/static/chunks/pages/_app-fixture.js"></script>');
  if (url.endsWith('/_app-fixture.js')) return new Response(mockApp);
  if (url.includes('algolia.net/1/indexes/')) {
    const page = Number(new URLSearchParams(JSON.parse(options.body).params).get('page'));
    return Response.json({ nbHits: 101, hits: page === 0 ? Array.from({ length: 100 }, (_, i) => ({
      ...trenkwalder, objectID: 'a0t' + String(i).padStart(15, '0'),
      web: { ...trenkwalder.web, jobUrl: 'https://si.trenkwalder.com/jobs/a0t' + String(i).padStart(15, '0') },
    })) : [{ ...trenkwalder, objectID: 'a0t000000000000999',
      web: { ...trenkwalder.web, jobUrl: 'https://si.trenkwalder.com/jobs/a0t000000000000999' } }] });
  }
  throw Error('Nepričakovana pot');
};
assert.equal((await getPublicTrenkwalder({ fetchImpl: mockAlgolia })).length, 101);
assert.equal(fetched.filter(url => url.includes('algolia.net')).length, 2);
assert.ok(!fetched.some(url => /trenkwalder\.com\/api\//.test(url)));

const novartis = EMPLOYER_MIRRORS.find(item => item.id === 'novartis');
const viaUrl = 'https://delovnamesta.si/zaposlitev/razvijalec-ljubljana-aabbcc';
const companyHtml = `<h3 class="title"><a href="/zaposlitev/razvijalec-ljubljana-aabbcc">Razvijalec</a></h3>`;
const schema = { '@type': 'JobPosting', url: 'https://novartis.wd3.myworkdayjobs.com/Example/job/Slovenia/aabbcc',
  title: 'Razvijalec aplikacij', hiringOrganization: { name: 'Novartis' },
  jobLocation: { address: { addressCountry: 'SI', addressLocality: 'Ljubljana' } },
  datePosted: '2026-11-25', description: '<p>Razvijamo aplikacije in podatkovne rešitve v Sloveniji, izdelujemo varne in zanesljive informacijske sisteme.</p><p>kadri@example.com</p>' };
const posting = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
assert.deepEqual(parseEmployerListings(companyHtml), [viaUrl]);
const sample = parseEmployerPosting(posting(schema), viaUrl, novartis, '2026-11-26');
assert.equal(sample.source, 'Novartis');
assert.equal(sample.url, schema.url);
assert.equal(sample.location, 'Ljubljana');
assert.ok(!sample.description.includes('kadri@example.com'));
assert.equal(parseEmployerPosting(posting({ ...schema, url: 'https://www.ess.gov.si/abc' }), viaUrl, novartis), null);
assert.equal(parseEmployerPosting(posting({ ...schema, jobLocation: { address: { addressCountry: 'AT' } } }), viaUrl, novartis), null);
assert.equal(parseEmployerPosting(posting({ ...schema, validThrough: '2026-11-01' }), viaUrl, novartis, '2026-11-26'), null);

let requested = [];
const mockEmployer = async url => {
  requested.push(url);
  return url === viaUrl ? posting(schema) : companyHtml;
};
const first = await getEmployerViaDelovnaMesta(novartis, { fetchText: mockEmployer, now: '2026-11-26T10:00:00Z' });
assert.equal(first.length, 1);
assert.equal(requested.length, 4); // Tri aliasi delodajalca in en sam opis.
requested = [];
const second = await getEmployerViaDelovnaMesta(novartis, {
  previous: first, fetchText: mockEmployer, now: '2026-11-27T10:00:00Z',
});
assert.equal(second.length, 1);
assert.equal(requested.length, 3); // Opis ostane veljaven iz predpomnilnika.
console.log('Večji manjkajoči delodajalci: popolni opisi, javni JSON, preverjene izvorne povezave in predpomnilnik uspešni.');

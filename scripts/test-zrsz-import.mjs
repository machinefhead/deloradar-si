import assert from 'node:assert/strict';
import { importZrszSnapshot } from '../source/zrsz-import.js';

const now = Date.parse('2026-11-25T17:00:00Z');
const raw = (reference, extra = {}) => ({
  RegStPrijave: ` ${reference} `, NazivDelMesta: 'ELEKTROINŠTALATER - M/Ž',
  PoslovniSubjekt: 'Primer d.o.o.', UEPDM: 'KRANJ',
  RokZaPrijavoKandidatov: '28. 11. 2026', DatumObjave: '25. 11. 2026',
  OpisDelInNalog: '<p>Elektroinštalacijska dela</p>',
  TrajanjeInVrstaZaposlitve: 'nedoločen čas, polni delovni čas',
  Klasius: 'srednja poklicna, elektrotehnika', DelovneIzkusnje: '1 leto',
  PredvidenoPlacilo: '1800 EUR', VozniskiIzpit: ', vozniški izpit B',
  NacinPrijave: 'kandidati naj pošljejo vlogo po e-pošti',
  KontaktZaKandidate: 'Osebni kontakt z e-pošto in telefonom', ...extra,
});
const payload = { DatumObjave: '2026-11-25T00:00:00', SteviloPDM: 2,
  ProstaDelovnaMesta: [raw('RE91400'), raw('RE91401')] };
const first = importZrszSnapshot(payload, [], { now });
assert.equal(first.report.accepted, 2);
assert.equal(first.report.added, 2);
assert.equal(first.jobs[0].reference, 'RE91400');
assert.equal(first.jobs[0].description, 'Elektroinštalacijska dela');
assert.equal(first.jobs[0].salary, '1800 EUR');
assert.equal(first.jobs[0].applicationMethod, 'kandidati naj pošljejo vlogo po e-pošti');
assert.match(first.jobs[0].requirements, /vozniški izpit B/);
assert.equal(JSON.stringify(first).includes('Osebni kontakt'), false, 'Brez osebnih kontaktov');
assert.equal(first.report.directIdsVerified, 0, 'Ni lažno potrjenih idp');
const second = importZrszSnapshot(payload, first.jobs, { now });
assert.equal(second.report.unchanged, 2);
assert.equal(second.report.added, 0);
const tampered = first.jobs.map(job => ({ ...job }));
tampered[0].url = 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/?idp=3509311/#/pdm/3509311';
const third = importZrszSnapshot({ ...payload, ProstaDelovnaMesta: [raw('RE91400', { OpisDelInNalog: 'Nov opis' }), raw('RE91402')] }, tampered, { now });
assert.equal(third.report.updated, 1);
assert.equal(third.report.added, 1);
assert.equal(third.report.removed, 1);
assert.doesNotMatch(third.jobs[0].url, /\?idp=/, 'Ne prevzame nepreverjenega starega ID-ja');
assert.throws(() => importZrszSnapshot({ ...payload, SteviloPDM: 3 }, [], { now }), /nepopoln/);
console.log('OK: ZRSZ lokalni inkrementalni uvoz, profil, varovanje kontaktov in povezav');

import assert from 'node:assert/strict';
import { enrichZrszHttp, parseZrszDetailResponse, zrszDetailId } from '../source/zrsz-http.js';

const base = 'https://www.ess.gov.si/iskalci-zaposlitve/iskanje-zaposlitve/iskanje-dela/';
const job = (reference, idp = '') => ({ id: `zrsz:${reference}`, source: 'ZRSZ / PoiščiDelo',
  reference, title: `Električar ${reference}`, company: 'Test d.o.o.', location: 'UE Maribor',
  date: '2026-11-25', deadline: '2026-12-15', url: idp ? `${base}?idp=${idp}/#/pdm/${idp}` : base });
const now = Date.parse('2026-11-25T17:00:00Z');
const rows = [...Array.from({ length: 600 }, (_, i) => job(`R${i}`)), job('R600', '3510032'), job('R601', '3510033')];
const requests = [];
const fakeFetch = async url => {
  requests.push(url.toString());
  const idp = url.pathname.split('/').at(-1);
  const reference = idp === '3510032' ? 'R600' : 'R601';
  return new Response(JSON.stringify({ reference, idp,
    description: '<p>Servisiranje naprav</p><p>Elektro naloge</p>', requirements: '<ul><li>Izobrazba V.</li></ul>',
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const enriched = await enrichZrszHttp(rows, [], {
  endpointTemplate: 'https://podrobnosti.ess.gov.si/oglas/{idp}', fetchImpl: fakeFetch,
  maxRequests: 2, concurrency: 2, pauseMs: 0, now,
});
assert.equal(enriched.jobs.length, 602);
assert.equal(enriched.jobs[0].id, rows[0].id, 'Nespremenjen vrstni red');
assert.equal(enriched.stats.attempted, 2);
assert.equal(enriched.stats.enriched, 2);
assert.equal(requests.length, 2, 'Po en HTTP zahtevek za posamezni oglas');
assert.equal(enriched.jobs.at(-1).description, 'Servisiranje naprav\nElektro naloge');
assert.equal(enriched.jobs.at(-2).requirements, '• Izobrazba V.');
assert.ok(enriched.jobs.at(-1).detailsFetchedAt);
assert.equal(zrszDetailId(job('R0')), null, 'Brez neposrednega idp ni HTTP zahtevka');
assert.throws(() => parseZrszDetailResponse({ reference: 'DRUGA', description: 'x' }, job('R600', '3510032'), '3510032'), /neujemanje/);
assert.rejects(() => enrichZrszHttp([job('R600', '3510032')], [], {
  endpointTemplate: 'https://zlonamerno.example/oglas/{idp}', fetchImpl: fakeFetch, maxRequests: 1,
}), /domeni ZRSZ/);
const failures = await enrichZrszHttp([job('R600', '3510032')], [], {
  endpointTemplate: 'https://podrobnosti.ess.gov.si/oglas/{idp}',
  fetchImpl: async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
  pauseMs: 0, maxRequests: 1, now,
});
assert.equal(failures.stats.failed, 1);
assert.equal(failures.jobs[0].description, undefined, 'Ne obogati oglasa iz neveljavnega HTTP odgovora');
console.log('OK: ZRSZ HTTP omejitve, preslikava ID-jev, validacija JSON, varno ohranjanje podatkov');

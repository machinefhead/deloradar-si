import assert from 'node:assert/strict';
import { fetchEuresZrszMatches } from '../source/eures-http.js';

const id = Buffer.from('3503870 14').toString('base64url');
const calls = [];
const mockFetch = async (url, options) => {
  calls.push({ url: String(url), method: options.method });
  let data;
  if (String(url).endsWith('/jv-search/search')) {
    const request = JSON.parse(options.body);
    assert.deepEqual(request.locationCodes, ['si']);
    assert.equal(request.resultsPerPage, 2);
    data = { numberRecords: 3085, jvs: [{ id, title: 'Tehnolog' },
      { id: Buffer.from('10001-1003268517-S 1').toString('base64url') }] };
  } else data = { id, source: 'ZRSZ', reference: '3503870', documentId: 'RH54049' };
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
};
const jobs = [{ id: 'zrsz:RH54049', source: 'ZRSZ / PoiščiDelo', reference: 'RH54049' }];
const result = await fetchEuresZrszMatches(jobs, { fetchImpl: mockFetch,
  pageSize: 2, detailLimit: 2, pauseMs: 0, concurrency: 1 });
assert.equal(result.stats.searchReturned, 2);
assert.equal(result.stats.detailsFetched, 1);
assert.equal(result.stats.matchedCandidates, 1);
assert.deepEqual(result.candidates[0], { reference: 'RH54049', idp: '3503870', euresId: id });
assert.equal(calls.length, 2, 'En iskalni in en podatkovni zahtevek');
const skip = await fetchEuresZrszMatches(jobs, { fetchImpl: mockFetch,
  pageSize: 2, detailLimit: 2, excludeEuresIds: [id], pauseMs: 0 });
assert.equal(skip.stats.detailsAttempted, 0);
await assert.rejects(() => fetchEuresZrszMatches(jobs, { pageSize: 100 }), /neveljavne/);
console.log('OK: EURES HTTP iskanje, slovenski filter, podrobnosti in predpomnjenje');

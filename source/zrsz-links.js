// Preverjanje prej prebranih ID-jev je čista podatkovna operacija.
// Brskalniški pilot za odpiranje kartic je odstranjen.
import { zrszDirectUrl } from './portal-probe.js';

export function mergeZrszDirectLinks(jobs, verifiedDetails) {
  const links = new Map();
  const conflicts = new Set();
  for (const item of verifiedDetails) {
    if (!isVerifiedRecord(item)) continue;
    if (links.has(item.reference) && links.get(item.reference) !== item.url) conflicts.add(item.reference);
    links.set(item.reference, item.url);
  }
  return jobs.map(job => {
    const ref = job.source === 'ZRSZ / PoiščiDelo' ? job.reference : '';
    return ref && links.has(ref) && !conflicts.has(ref) ? { ...job, url: links.get(ref) } : job;
  });
}

function isVerifiedRecord(item) {
  return Boolean(item?.reference && item.id === `zrsz:${item.reference}` &&
    /^\d{6,10}$/.test(String(item.idp)) && item.url === zrszDirectUrl(item.idp));
}

// Dnevni izvoz je posnetek; živi javni seznam lahko vsebuje dodatne trenutne
// razpise. Dodamo le strogo preverjene ID-je, ki jih še ni v JSON-u.
export function supplementZrszPublicDetails(jobs, verifiedDetails) {
  const enriched = mergeZrszDirectLinks(jobs, verifiedDetails);
  const references = new Set(enriched.filter(job => job.source === 'ZRSZ / PoiščiDelo').map(job => job.reference));
  const conflictReferences = new Set();
  const seenDetails = new Map();
  for (const item of verifiedDetails) {
    if (!isVerifiedRecord(item)) continue;
    if (seenDetails.has(item.reference) && seenDetails.get(item.reference) !== item.url) conflictReferences.add(item.reference);
    seenDetails.set(item.reference, item.url);
  }
  const supplement = [];
  for (const item of verifiedDetails) {
    if (!isVerifiedRecord(item) || references.has(item.reference) || conflictReferences.has(item.reference)) continue;
    references.add(item.reference);
    supplement.push({
      id: item.id, source: 'ZRSZ / PoiščiDelo', reference: item.reference,
      title: item.title, company: item.company, location: item.location,
      date: item.date, deadline: '', url: item.url,
    });
  }
  return enriched.concat(supplement);
}

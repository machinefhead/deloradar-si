// ZRSZ: preverjene neposredne povezave do izbranih javnih oglasov.
// Podatke pridobimo iz običajnega prikaza, brez dodatnih notranjih API-klicev.
import { parseZrszPilotCard, parseZrszPilotDetail, zrszDirectUrl } from './portal-probe.js';

const vacancySelector = 'a[id^="vacancy-"]';

function registrationFromDetail(page) {
  return page.locator('b').filter({ hasText: 'Registrska št.:' }).first().evaluate(element =>
    element.parentElement?.parentElement?.querySelector('.padding-left')?.textContent?.trim() || '');
}

export async function readZrszPublicDetails(page, count) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw Error('ZRSZ: največ 100 podrobnosti na zajem');
  await page.locator('#vacancy-0').waitFor({ state: 'visible', timeout: 55_000 });

  for (let batch = 0; batch < 4; batch++) {
    const have = await page.locator(vacancySelector).count();
    if (have >= count) break;
    // Točno gumb pod seznamom oglasov (na strani je tudi drug nepovezan »Prikaži več«).
    const next = page.locator('.list-group button.show-more-btn').first();
    if (!await next.count()) throw Error(`ZRSZ: prikazanih ${have} oglasov, gumb »Prikaži več« ni na voljo`);
    await next.dispatchEvent('click', { timeout: 15_000 });
    try {
      await page.waitForFunction(previous => document.querySelectorAll('a[id^="vacancy-"]').length > previous,
        have, { timeout: 15_000 });
    } catch (error) {
      const after = await page.locator(vacancySelector).count();
      throw Error(`ZRSZ: po kliku »Prikaži več« prej ${have}, potem ${after} kartic: ${String(error.message).slice(0, 100)}`);
    }
    await page.waitForTimeout(450);
  }

  const cards = (await page.locator(vacancySelector).evaluateAll(items => items.slice(0, 100).map(item => ({
    title: item.querySelector('h5.list-item-title')?.textContent,
    companyLocation: item.querySelector('p.list-item-text')?.textContent,
    metadata: item.querySelector('p.list-item-text.small')?.textContent,
  })))).slice(0, count);
  if (cards.length !== count) throw Error(`ZRSZ: zahtevanih ${count}, prikazanih le ${cards.length}`);

  const results = [];
  for (let index = 0; index < cards.length; index++) {
    const card = parseZrszPilotCard(cards[index]);
    const currentTitle = await page.locator(`#vacancy-${index} h5`).innerText();
    if (currentTitle.replace(/\s+/g, ' ').trim() !== card.title) {
      throw Error('ZRSZ: vrstni red oglasov se je med zajemom spremenil');
    }
    // Dogodek javne kartice; vsak URL in referenco nato neodvisno validiramo.
    await page.locator(`#vacancy-${index}`).dispatchEvent('click', { timeout: 15_000 });
    await page.waitForURL(/\?idp=\d+\/#\/pdm\/\d+/, { timeout: 20_000 });
    await page.locator('b').filter({ hasText: 'Registrska št.:' }).first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    results.push(parseZrszPilotDetail(card, { url: page.url(), reference: await registrationFromDetail(page) }));
    if (index + 1 < cards.length) {
      await page.locator('.modal-detail div.set-pointer[aria-label="Close"]').click({ timeout: 15_000 });
      await page.locator('.modal-detail').waitFor({ state: 'hidden', timeout: 20_000 });
      await page.waitForURL(url => !url.searchParams.has('idp'), { timeout: 20_000 });
      await page.waitForTimeout(400);
    }
  }
  return results;
}

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

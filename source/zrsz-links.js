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
    const choices = await page.getByText(/Prikaži več/i).evaluateAll(elements => elements.slice(0, 12).map((element, i) => ({
      index: i, tag: element.tagName, text: element.textContent?.trim().slice(0, 90),
      parent: element.parentElement?.outerHTML.slice(0, 300),
    })));
    const aroundLastCard = await page.locator('#vacancy-29').evaluate(element => {
      const result = []; let node = element;
      for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
        result.push({ tag: node.tagName, className: node.className, childCount: node.children.length,
          htmlTail: node.outerHTML.slice(-260) });
      }
      return result;
    });
    console.log('ZRSZ: možnosti »Prikaži več«=' + JSON.stringify(choices));
    console.log('ZRSZ: predniki zadnjega oglasa=' + JSON.stringify(aroundLastCard));
    const next = page.getByText(/Prikaži več/i).last();
    if (!await next.count()) throw Error(`ZRSZ: prikazanih ${have} oglasov, gumb »Prikaži več« ni na voljo`);
    const target = await next.evaluate(element => ({
      tag: element.tagName,
      text: element.textContent?.trim().slice(0, 80),
      parent: element.parentElement?.outerHTML.slice(0, 450),
    }));
    console.log('ZRSZ: javno straničenje, kartic=' + have + ', cilj=' + JSON.stringify(target));
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
    if (!item?.reference || item.id !== `zrsz:${item.reference}` || item.url !== zrszDirectUrl(item.idp)) continue;
    if (links.has(item.reference) && links.get(item.reference) !== item.url) conflicts.add(item.reference);
    links.set(item.reference, item.url);
  }
  return jobs.map(job => {
    const ref = job.source === 'ZRSZ / PoiščiDelo' ? job.reference : '';
    return ref && links.has(ref) && !conflicts.has(ref) ? { ...job, url: links.get(ref) } : job;
  });
}

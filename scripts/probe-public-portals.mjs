// Ročno sprožen pilot: največ 100 oglasov ZRSZ oziroma pet pri ostalih virih.
// Ne spreminja jobs.json, ne objavlja ničesar in ne obhaja preverjanj obiskovalcev.
import {
  ZRSZ_SEARCH_URL, EURES_SLOVENIA_URL, parseZrszPilotCard, parseZrszPilotDetail,
  parseEuresPilotSummary, parseEuresPilotDetail, zrszDirectUrl, careerjetProbeStatus,
} from '../source/portal-probe.js';

const parameter = name => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const count = Number(parameter('limit') || 3);
const requested = (parameter('sources') || 'zrsz,eures,careerjet').split(',').map(x => x.trim());
if (!requested.length || requested.some(x => !['zrsz', 'eures', 'careerjet'].includes(x))) {
  throw Error('Dovoljeni viri: zrsz,eures,careerjet');
}
const maxCount = requested.every(x => x === 'zrsz') ? 100 : 5;
if (!Number.isInteger(count) || count < 1 || count > maxCount) {
  throw Error(`Pilot za izbrane vire podpira samo --limit=1..${maxCount}`);
}
const output = { type: 'DeloRadar portal pilot', countPerSource: count, capturedAt: new Date().toISOString(), sources: {} };

function registrationFromZrsz(page) {
  return page.locator('b').filter({ hasText: 'Registrska št.:' }).first().evaluate(element =>
    element.parentElement?.parentElement?.querySelector('.padding-left')?.textContent?.trim() || '');
}

async function browserSession() {
  const { chromium } = await import('playwright-core');
  const browserPath = process.env.DELORADAR_CHROME_PATH?.trim();
  return chromium.launch(browserPath
    ? { executablePath: browserPath, headless: true, timeout: 70_000 }
    : { channel: 'chrome', headless: true, timeout: 70_000 });
}

async function dismissCookieChoices(page, portal) {
  if (portal === 'zrsz') {
    const dialog = page.locator('#cookieman-modal');
    if (!await dialog.isVisible()) return;
    for (const name of [/zavrni|reject/i, /(?:samo|le|only).{0,30}(?:nujn|necessary|essential)/i, /shrani|save settings/i]) {
      const button = dialog.getByRole('button', { name }).first();
      if (await button.count() && await button.isVisible()) { await button.click(); return; }
    }
    throw Error('ZRSZ: neznana izbira piškotkov');
  }
  const essential = page.getByRole('link', { name: /Accept only essential cookies|samo nujne piškotke/i });
  if (await essential.count() && await essential.first().isVisible()) await essential.first().click();
}

async function zrszSample(browser) {
  const context = await browser.newContext({ locale: 'sl-SI' });
  const page = await context.newPage();
  const startedAt = Date.now();
  try {
    await page.goto(ZRSZ_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await page.locator('#vacancy-0').waitFor({ state: 'visible', timeout: 55_000 });
    await dismissCookieChoices(page, 'zrsz');
    // Naložimo samo toliko dodatnih strani, kot jih potrebuje omejen pilot.
    // Ob vsakem kliku mora na javnem seznamu dejansko pribiti nova kartica.
    for (let batch = 0; batch < 4; batch++) {
      const have = await page.locator('a[id^="vacancy-"]').count();
      if (have >= count) break;
      const next = page.getByText(/Prikaži več/i).last();
      if (!await next.count()) throw Error(`ZRSZ: prikazanih ${have} oglasov, gumb »Prikaži več« ni na voljo`);
      await next.dispatchEvent('click', { timeout: 15_000 });
      await page.waitForFunction(previous => document.querySelectorAll('a[id^="vacancy-"]').length > previous,
        have, { timeout: 30_000 });
      await page.waitForTimeout(450);
    }
    const cards = (await page.locator('a[id^="vacancy-"]').evaluateAll(items => items.slice(0, 100).map(item => ({
      title: item.querySelector('h5.list-item-title')?.textContent,
      companyLocation: item.querySelector('p.list-item-text')?.textContent,
      metadata: item.querySelector('p.list-item-text.small')?.textContent,
    })))).slice(0, count);
    const results = [];
    for (let index = 0; index < cards.length; index++) {
      const card = parseZrszPilotCard(cards[index]);
      const currentTitle = await page.locator(`#vacancy-${index} h5`).innerText();
      if (currentTitle.replace(/\s+/g, ' ').trim() !== card.title) {
        throw Error('ZRSZ: vrsten red oglasov se je med zajemom spremenil');
      }
      // Seznam ima lepljive elemente, ki v brezglavem Chromu lahko prestrežejo
      // koordinatni klik. Sprožimo običajen DOM dogodek na vidnem javnem oglasu;
      // neposreden URL in registrsko številko nato preverimo posebej.
      await page.locator(`#vacancy-${index}`).dispatchEvent('click', { timeout: 15_000 });
      await page.waitForURL(/\?idp=\d+\/#\/pdm\/\d+/, { timeout: 20_000 });
      await page.locator('b').filter({ hasText: 'Registrska št.:' }).first().waitFor({ state: 'visible', timeout: 30_000 });
      results.push(parseZrszPilotDetail(card, { url: page.url(), reference: await registrationFromZrsz(page) }));
      // Zapremo samo javni modal oglasa. Seznam ostane naložen in se ne zahteva znova.
      if (index + 1 < cards.length) {
        // ZRSZ prikazuje dva elementa z aria-label="Close" (mobilni »Nazaj«
        // ter gumb v glavi). Izberemo izrecno gumb v glavi modala.
        await page.locator('.modal-detail div.set-pointer[aria-label="Close"]').click({ timeout: 15_000 });
        await page.locator('.modal-detail').waitFor({ state: 'hidden', timeout: 20_000 });
        await page.waitForURL(url => !url.searchParams.has('idp'), { timeout: 20_000 });
        await page.waitForTimeout(400);
      }
    }
    const elapsedMs = Date.now() - startedAt;
    return { status: results.length === count ? 'ok' : 'partial', tested: results.length,
      elapsedMs, averageMsPerJob: Math.round(elapsedMs / Math.max(1, results.length)), records: results };
  } finally { await context.close(); }
}

async function verifyOnZrsz(page, record) {
  if (!record.zrszIdCandidate) return { status: 'not_applicable' };
  const href = zrszDirectUrl(record.zrszIdCandidate);
  try {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await page.locator('b').filter({ hasText: 'Registrska št.:' }).first().waitFor({ state: 'visible', timeout: 40_000 });
    const actualReference = await registrationFromZrsz(page);
    return actualReference.toUpperCase() === record.reference
      ? { status: 'confirmed', url: href }
      : { status: 'mismatch', actualReference };
  } catch (error) {
    return { status: 'unverified', reason: String(error.message).slice(0, 150) };
  }
}

async function euresSample(browser) {
  const context = await browser.newContext({ locale: 'sl-SI' });
  const search = await context.newPage();
  const details = await context.newPage();
  const verify = await context.newPage();
  try {
    await search.goto(EURES_SLOVENIA_URL, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await dismissCookieChoices(search, 'eures');
    await search.locator('[role="article"][aria-label="Job vacancy result"] a[href*="/jv-details/"]')
      .first().waitFor({ state: 'visible', timeout: 50_000 });
    const listing = await search.locator('[role="article"][aria-label="Job vacancy result"]')
      .evaluateAll(items => items.map(item => ({
        title: item.querySelector('h3 a[href*="/jv-details/"]')?.textContent,
        url: item.querySelector('h3 a[href*="/jv-details/"]')?.href,
        company: item.querySelector('[id^="jv-employer-name-"]')?.textContent,
        location: [...item.querySelectorAll('[id^="location-"]')].map(x => x.textContent.trim()).join('; '),
        publication: item.querySelector('[id^="date-"]')?.textContent,
      })));
    // Za pilot izberemo javne oglase v slovenščini, katerih lokacija vključuje Slovenijo.
    const shortlist = listing.filter(item => item.url?.includes('jvDisplayLanguage=sl') && /Slovenia/i.test(item.location)).slice(0, count);
    const results = [];
    for (const item of shortlist) {
      const summary = parseEuresPilotSummary(item);
      await details.goto(summary.url, { waitUntil: 'domcontentloaded', timeout: 40_000 });
      await details.locator('#jv-detail-document-id').waitFor({ state: 'visible', timeout: 40_000 });
      const rawDetail = await details.evaluate(() => ({
        title: document.querySelector('main h1')?.textContent,
        company: document.querySelector('main h2')?.textContent,
        reference: document.querySelector('#jv-detail-document-id')?.nextElementSibling?.textContent,
        deadline: document.querySelector('#jv-details-how-to-apply-application-date')?.textContent,
      }));
      const record = parseEuresPilotDetail(summary, rawDetail);
      record.zrszLinkCheck = await verifyOnZrsz(verify, record);
      results.push(record);
    }
    return { status: results.length === count ? 'ok' : 'partial', tested: results.length, records: results };
  } finally { await context.close(); }
}

async function careerjetSample() {
  const response = await fetch('https://www.careerjet.si/delovna-mesta', {
    signal: AbortSignal.timeout(20_000),
    headers: { 'user-agent': 'DeloRadar/0.1 (non-commercial metadata pilot)', accept: 'text/html' },
  });
  if (!response.ok) return { status: 'blocked', reason: `HTTP ${response.status}` };
  const html = await response.text();
  if (html.length > 500_000) throw Error('Careerjet: predolg odziv');
  return careerjetProbeStatus(html);
}

let browser;
try {
  if (requested.some(item => item !== 'careerjet')) browser = await browserSession();
  for (const source of requested) {
    try {
      output.sources[source] = source === 'zrsz' ? await zrszSample(browser)
        : source === 'eures' ? await euresSample(browser) : await careerjetSample();
    } catch (error) {
      output.sources[source] = { status: 'error', reason: String(error.message).slice(0, 300) };
    }
  }
} catch (error) {
  for (const source of requested) output.sources[source] = { status: 'unavailable', reason: String(error.message).slice(0, 300) };
  if (requested.includes('careerjet')) output.sources.careerjet = await careerjetSample().catch(e => ({ status: 'error', reason: e.message }));
} finally {
  if (browser) await browser.close();
}
console.log(JSON.stringify(output, null, 2));
if (requested.some(source => source === 'careerjet'
  ? ['error', 'unavailable'].includes(output.sources[source].status)
  : output.sources[source].status !== 'ok')) process.exitCode = 1;

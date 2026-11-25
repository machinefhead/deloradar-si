// Kratek dejanski preizkus prikaza, ki se izvede na GitHub Actions po gradnji.
// Uporabi samo lokalni rezultat dist/, brez obiskovanja zunanjih portalov.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const server = createServer(async (request, response) => {
  const filename = new URL(request.url, 'http://127.0.0.1').pathname === '/jobs.json' ? 'jobs.json' : 'index.html';
  try {
    const content = await readFile(new URL('../dist/' + filename, import.meta.url));
    response.writeHead(200, { 'content-type': filename.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' });
    response.end(content);
  } catch {
    response.writeHead(500);
    response.end('Datoteka ni na voljo');
  }
});

let browser;
try {
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  browser = await chromium.launch({
    ...(process.env.DELORADAR_CHROME_PATH ? { executablePath: process.env.DELORADAR_CHROME_PATH } : { channel: 'chrome' }),
    headless: true, args: ['--no-sandbox'],
  });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, locale: 'sl-SI' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'domcontentloaded' });
    await page.locator('button.jobtitle').first().waitFor({ timeout: 20000 });
    await page.locator('button.jobtitle').first().click();
    await page.locator('#jobDialog[open]').waitFor({ timeout: 5000 });
    const content = await page.locator('#jobDetailBody').innerText();
    assert.match(content, /Podrobnosti razpisa/);
    assert.match(content, /Kje, kdaj in pri kom/);
    assert.ok(/Odpri izvorni oglas|Poišči razpis na ZRSZ/.test(content));
    const bounds = await page.locator('#jobDialog').evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
    assert.ok(bounds.scrollWidth <= bounds.width + 2, 'Dialog ne sme zahtevati vodoravnega drsenja');
    await page.locator('#closeJobDialog').click();
    assert.equal(await page.locator('#jobDialog').evaluate(element => element.open), false);
    assert.deepEqual(errors, [], 'Brskalniška skripta ne sme povzročiti napake');
    await page.close();
  }
  console.log('OK: podrobnosti delujejo na računalniku in mobilni širini');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

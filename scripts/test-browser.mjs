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
  const snapshot = JSON.parse(await readFile(new URL('../dist/jobs.json', import.meta.url)));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, locale: 'sl-SI' });
    const errors = [];
    const downloads = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('download', download => downloads.push(download));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'domcontentloaded' });
    await page.locator('button.jobtitle').first().waitFor({ timeout: 20000 });
    assert.equal(downloads.length, 0, 'JSON se ne sme prenesti samodejno ob odprtju strani');
    assert.ok(await page.locator('#planned .sourcecard').count() >= 10,
      'Na dnu morajo biti vidni vsi raziskani, a nepovezani portali');
    assert.equal(await page.locator('#planned .sourcecard').filter({ hasText: 'LinkedIn Jobs' }).count(), 1,
      'LinkedIn mora ostati v katalogu za kasnejšo raziskavo');
    assert.equal(await page.locator('#sourceStatus a.name').count(), snapshot.sources.length,
      'Vsi povezani viri morajo imeti izvorno povezavo');
    if (snapshot.sources.some(source => source.name === 'EURES')) {
      assert.equal(await page.locator('#planned .sourcecard').filter({ hasText: 'EURES (Slovenija)' }).count(), 0,
        'EURES ne sme biti hkrati povezan in nepovezan');
    }
    assert.equal(await page.locator('#planned .sourcecard').filter({ hasText: 'Competo' }).count(), 0,
      'Competo je povezan neposredno z JSON in ne sme ostati med nepovezanimi');
    if (viewport.width === 1440) {
      const target = snapshot.jobs.find(job => job.source === 'EURES' && /Chauffeur_in/.test(job.title)) || snapshot.jobs[0];
      await page.locator('#search').fill(target.title);
      await page.locator('button.jobtitle').first().waitFor({ timeout: 10000 });
      const [filteredDownload] = await Promise.all([
        page.waitForEvent('download'), page.locator('#exportFiltered').click(),
      ]);
      const filtered = JSON.parse(await readFile(await filteredDownload.path(), 'utf8'));
      assert.match(filteredDownload.suggestedFilename(), /^deloradar-filtrirani-\d{4}-\d{2}-\d{2}\.json$/);
      assert.equal(filtered.scope, 'filtered');
      assert.ok(filtered.jobs.some(job => job.id === target.id), 'Filtrirani JSON mora vsebovati poiskan oglas');
      assert.ok(filtered.total <= snapshot.jobs.length, 'Filtrirani JSON mora upoštevati izbor na strani');
      await page.locator('#search').fill('');
      const [allDownload] = await Promise.all([
        page.waitForEvent('download'), page.locator('#exportAll').click(),
      ]);
      const exported = JSON.parse(await readFile(await allDownload.path(), 'utf8'));
      assert.match(allDownload.suggestedFilename(), /^deloradar-vsi-oglasi-\d{4}-\d{2}-\d{2}\.json$/);
      assert.equal(exported.scope, 'all');
      assert.equal(exported.total, snapshot.jobs.length, 'Celoten JSON mora vsebovati vse oglase');
      if (snapshot.jobs.some(job => job.source === 'EURES')) {
        assert.equal(exported.jobs.filter(job => job.source === 'EURES').length,
          snapshot.jobs.filter(job => job.source === 'EURES').length, 'Izvoz mora vključiti tudi EURES');
      }
    }
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
    if (viewport.width === 1440) {
      const missingZrsz = snapshot.jobs.find(job => job.source === 'ZRSZ / PoiščiDelo' &&
        /^IE\d+$/.test(String(job.reference)) && !String(job.url).includes('?idp='));
      if (missingZrsz) {
        await page.goto('http://127.0.0.1:' + server.address().port + '/?oglas=' + encodeURIComponent(missingZrsz.id));
        await page.locator('#jobDialog[open]').waitFor({ timeout: 20000 });
        assert.equal(await page.locator('#jobDetailBody #detailTitle').innerText(), missingZrsz.title,
          'Deljiva povezava do IE oglasa mora odpreti pravilen in ne poljuben opis');
        assert.match(await page.locator('#jobDetailBody').innerText(), new RegExp(missingZrsz.reference),
          'Pri deljivem opisu mora ostati registrska številka ZRSZ');
        assert.match(await page.locator('#jobDetailBody .detailprimary').innerText(), /Poišči razpis na ZRSZ/,
          'Iskanje ZRSZ mora ostati pošteno označeno, ne kot preverjena neposredna povezava');
        assert.match(await page.locator('#jobDetailBody .detailactions a').last().getAttribute('href'),
          /[?&]oglas=zrsz%3AIE\d+/, 'Iz odprtega oglasa je mogoče kopirati njegovo deljivo povezavo');
      }
    }
    assert.deepEqual(errors, [], 'Brskalniška skripta ne sme povzročiti napake');
    await page.close();
  }
  console.log('OK: prikaz na računalniku in telefonu ter oba JSON izvoza izključno ob kliku');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

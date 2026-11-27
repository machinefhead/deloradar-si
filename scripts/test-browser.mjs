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
    assert.ok(await page.locator('#planned .sourcecard').count() >= 5,
      'Na dnu morajo ostati samo smiselni kandidati za naslednji uvoz');
    assert.equal(await page.locator('#sourceDetails').evaluate(element => element.open), false,
      'Seznam povezanih virov mora biti na telefonu in računalniku privzeto zaprt');
    assert.equal(await page.locator('#sourceStatus').isVisible(), false,
      'Zaprt seznam ne sme podaljševati strani');
    assert.match(await page.locator('#sourceSummary').innerText(), /virov dosegljivih/,
      'Dosegljivost mora biti vidna neposredno ob puščici znotraj panela');
    assert.equal((await page.locator('.sourcespanel .sectionlabel').innerText()).toLocaleLowerCase('sl'), 'stanje povezav',
      'Uokvirjeno stanje povezav mora ohraniti prejšnji naslov');
    assert.match(await page.locator('#nextUpdate').innerText(), /Naslednji predvideni zajem:/,
      'Glava mora kazati predvideni naslednji termin');
    const headerLayout = await page.evaluate(() => ({
      // Produkcijska stran zamenja gumb z varno povezavo na GitHub Actions.
      refresh: document.querySelector('.refreshbox .refresh').getBoundingClientRect().toJSON(),
      metadata: document.querySelector('.refreshmeta').getBoundingClientRect().toJSON(),
      topbar: document.querySelector('.topbar').getBoundingClientRect().toJSON(),
    }));
    assert.ok(headerLayout.refresh.left > headerLayout.metadata.left,
      'Gumb Osveži mora biti na desni strani obeh podatkov o zajemu');
    assert.ok(Math.abs(headerLayout.refresh.right - headerLayout.topbar.right) < 3,
      'Gumb Osveži mora biti poravnan čisto na desni rob glave');
    assert.equal(await page.locator('#sourcesToggle .combo-chevron').count(), 1,
      'Povzetek virov mora imeti eno puščico za razpiranje');
    await page.locator('#sourcesToggle').click();
    assert.equal(await page.locator('#sourceDetails').evaluate(element => element.open), true);
    assert.equal(await page.locator('#sourceStatus').isVisible(), true,
      'Gumb mora omogočiti prikaz vseh povezanih virov');
    const sourceLayout = await page.locator('#sourceStatus').evaluate(element => ({
      height: element.clientHeight, fullHeight: element.scrollHeight,
      badges: [...element.querySelectorAll('.sourceitem .pill')].slice(0, 12).map(badge => badge.getBoundingClientRect().right),
    }));
    assert.ok(sourceLayout.fullHeight <= sourceLayout.height + 1,
      'Celoten seznam se mora odpreti brez notranjega drsnika');
    assert.ok(sourceLayout.badges.every(right => Math.abs(right - sourceLayout.badges[0]) < 2),
      'Število oglasov mora biti pri vseh virih poravnano v isti desni koloni');
    assert.equal(await page.locator('#sourceInsights').evaluate(element => element.open), false,
      'Podrobnosti in dvojniki so privzeto ločeni in zaprti');
    await page.locator('#sourceInsights > summary').click();
    assert.match(await page.locator('#sourceInsightsBody').innerText(), /ZRSZ|LinkedIn|Verjetni dvojniki/,
      'Razširljive tehnične podrobnosti zajema morajo ostati dostopne');
    await page.locator('#sourceInsights > summary').click();
    assert.equal(await page.locator('#sourcesToggle .combo-chevron').evaluate(element => getComputedStyle(element).transform === 'none'), false,
      'Puščica se mora ob razširitvi obrniti');
    assert.equal(await page.locator('#planned .sourcecard').filter({ hasText: 'LinkedIn Jobs' }).count(), 0,
      'LinkedIn se po uspešnem posrednem JSON-LD zajemu ne sme podvajati med nepovezanimi');
    assert.equal(await page.locator('#sourceStatus .sourceitem').filter({ hasText: 'LinkedIn Jobs' }).count(), 1,
      'LinkedIn mora biti med povezanimi viri in prikazati napredek HTTP pregleda');
    assert.equal(await page.locator('#sourceStatus a.name').count(), snapshot.sources.length,
      'Vsi povezani viri morajo imeti izvorno povezavo');
    await page.locator('#sourcesToggle').click();
    assert.equal(await page.locator('#sourceDetails').evaluate(element => element.open), false,
      'Seznam mora biti mogoče ponovno skriti');
    if (snapshot.sources.some(source => source.name === 'EURES')) {
      assert.equal(await page.locator('#planned .sourcecard').filter({ hasText: 'EURES (Slovenija)' }).count(), 0,
        'EURES ne sme biti hkrati povezan in nepovezan');
    }
    assert.equal(await page.locator('#planned .sourcecard').filter({ hasText: 'Competo' }).count(), 0,
      'Competo je povezan neposredno z JSON in ne sme ostati med nepovezanimi');
    if (viewport.width === 1440) {
      const target = snapshot.jobs.find(job => job.source === 'EURES' && /Chauffeur_in/.test(job.title)) || snapshot.jobs[0];
      await page.locator('#search').fill(target.title);
      assert.match(await page.locator('#activeFilters').innerText(), /Iskanje:/,
        'Izbrano iskanje mora biti kot odstranljiv čip pod gumbi JSON');
      await page.locator('button.jobtitle').first().waitFor({ timeout: 10000 });
      const [filteredDownload] = await Promise.all([
        page.waitForEvent('download'), page.locator('#exportFiltered').click(),
      ]);
      const filtered = JSON.parse(await readFile(await filteredDownload.path(), 'utf8'));
      assert.match(filteredDownload.suggestedFilename(), /^deloradar-filtrirani-\d{4}-\d{2}-\d{2}\.json$/);
      assert.equal(filtered.scope, 'filtered');
      assert.ok(filtered.jobs.some(job => job.id === target.id), 'Filtrirani JSON mora vsebovati poiskan oglas');
      assert.ok(filtered.total <= snapshot.jobs.length, 'Filtrirani JSON mora upoštevati izbor na strani');
      await page.locator('#activeFilters [data-remove-filter="search"]').click();
      assert.equal(await page.locator('#search').inputValue(), '',
        'X na zgornjem čipu mora odstraniti iskanje v osnovnem filtru');
      await page.locator('#published').selectOption('7');
      assert.match(await page.locator('#activeFilters').innerText(), /Objava:/,
        'Čip za datum objave mora biti na voljo nad tabelo');
      await page.locator('#activeFilters [data-remove-filter="published"]').click();
      assert.equal(await page.locator('#published').inputValue(), '',
        'X na datumu objave mora ponastaviti prvotni combobox');
      for (const id of ['published', 'deadline', 'myStatus', 'sort']) {
        const look = await page.locator('#' + id).evaluate(element => ({
          appearance: getComputedStyle(element).appearance,
          backgroundImage: getComputedStyle(element).backgroundImage,
        }));
        assert.equal(look.appearance, 'none', 'Izbirnik ' + id + ' mora uporabljati poenoteno puščico');
        assert.notEqual(look.backgroundImage, 'none', 'Puščica mora biti vidna pri ' + id);
      }
      const arrowLook = await page.evaluate(() => ['#published', '#deadline', '#myStatus', '#sort', '#sourcesToggle .combo-chevron']
        .map(selector => {
          const style = getComputedStyle(document.querySelector(selector));
          return { image: style.backgroundImage, size: style.backgroundSize };
        }));
      assert.ok(arrowLook.every(item => item.size === '14px 14px' && item.image === arrowLook[0].image),
        'Vse puščice morajo uporabljati isti SVG in identično velikost 14 × 14 px');
      await page.locator('select.state').first().selectOption('interested');
      assert.notEqual(await page.locator('select.state').first().evaluate(element => getComputedStyle(element).backgroundImage), 'none',
        'Puščica mora ostati vidna tudi pri označenem statusu oglasa');
      await page.locator('#multi-sourceFilter .multi-trigger').click();
      const firstOption = page.locator('#multi-sourceFilter .multi-option input[type="checkbox"]').first();
      await firstOption.check();
      assert.equal(await page.locator('#activeFilters [data-remove-filter="sourceFilter"]').count(), 1,
        'Izbrani portal mora biti prikazan kot odstranljiv čip nad tabelo');
      await page.locator('#activeFilters [data-remove-filter="sourceFilter"]').click();
      assert.equal(await page.locator('#activeFilters [data-remove-filter="sourceFilter"]').count(), 0,
        'X pri portalu mora odstraniti samo označeni portal');
      const [allDownload] = await Promise.all([
        page.waitForEvent('download'), page.locator('#exportAll').click(),
      ]);
      const exported = JSON.parse(await readFile(await allDownload.path(), 'utf8'));
      assert.match(allDownload.suggestedFilename(), /^deloradar-vsi-oglasi-\d{4}-\d{2}-\d{2}\.json$/);
      assert.equal(exported.scope, 'all');
      assert.equal(exported.total, snapshot.jobs.length, 'Celoten JSON mora vsebovati vse oglase');
      assert.deepEqual(exported.planned, snapshot.planned,
        'Celoten JSON mora vključiti tudi stanje še nepovezanih portalov');
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
    assert.ok(/Odpri izvorni oglas|Preveri v iskalniku ZRSZ/.test(content));
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
        assert.match(await page.locator('#jobDetailBody .detailprimary').innerText(), /Preveri v iskalniku ZRSZ/,
          'Iskanje ZRSZ mora ostati pošteno označeno, ne kot preverjena neposredna povezava');
        assert.equal(await page.locator('#jobDetailBody .detailactions a').filter({ hasText: 'Povezava do opisa v DeloRadarju' }).count(), 0,
          'Odvečen lastni link v podrobnostih ni prikazan');
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

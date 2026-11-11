/** Compare the restored app with a read-only, in-memory copy of the pinned baseline.
 * No checkout, production request, extra dependency or generated file in the repo.
 * Optional PRESERVATION_SCREENSHOTS saves real browser captures outside the repo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const baseline = 'a7f1ad63f56393d3effbddec16ef3ac7a5f31de9';
const root = new URL('../', import.meta.url);
const original = path => execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root, maxBuffer: 4000000 });
const text = bytes => bytes.toString('utf8').replace(/\r\n/gu, '\n').trimEnd();
const appURL = process.env.TEST_URL ?? 'http://127.0.0.1:4173';
const modulePath = process.env.PUPPETEER_MODULE ?? 'C:/Users/hp/Documents/Multaqa-Motion-Studio/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const { default: puppeteer } = await import(/^[A-Za-z]:[\\/]|^\//u.test(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

test('original stylesheet, full keyframe cascade, instructions styles and confetti implementation are preserved', async () => {
  assert.equal(text(await readFile(new URL('css/TeiganCss.css', root))), text(original('TeiganCss.css')));
  const oldGuide = text(original('instructions.html')).match(/<style>([\s\S]*?)<\/style>/u)[1];
  const newGuide = text(await readFile(new URL('instructions.html', root))).match(/<style>([\s\S]*?)<\/style>/u)[1];
  assert.equal(newGuide, oldGuide);
  const oldJS = text(original('Teigan.js'));
  const effects = oldJS.slice(oldJS.indexOf('// ===== CONFETTI ANIMATION ====='), oldJS.indexOf('// ===== CONSOLIDATION SECTION')).trim();
  assert.ok(text(await readFile(new URL('js/Teigan.js', root))).includes(effects), 'original effect helpers must remain verbatim');
});

// Use the already pinned canonical data only to make original API responses deterministic.
// This comparison does not claim the old live API is reliable.
async function seedOriginal(page, data) {
  await page.evaluateOnNewDocument(data => {
    const nativeFetch = window.fetch;
    window.fetch = async (input, options) => {
      const url = String(input);
      if (url.startsWith('https://api.alquran.cloud/')) {
        const number = Number(url.match(/\/surah\/(\d+)/u)?.[1]);
        const payload = number ? { ...data.surahs[number - 1], ayahs: data.surahs[number - 1].ayahs.map(ayah => ({ ...ayah, numberInSurah: ayah.number })) } : data.surahs;
        return new Response(JSON.stringify({ code: 200, data: payload }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (url.startsWith('https://api.quran.com/')) return new Response(JSON.stringify({ verses: data.surahs.flatMap(s => s.ayahs.map(a => ({ verse_key: `${s.number}:${a.number}`, text_uthmani: a.text }))) }));
      return nativeFetch(input, options);
    };
  }, data);
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.activeElement?.blur();
    scrollTo(0, 0);
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.effect.getTiming().iterations === Infinity) { animation.pause(); animation.currentTime = 0; }
      else animation.finish();
    }
  });
}

async function metrics(page, selector, pseudo = null) {
  return page.$eval(selector, (node, pseudo) => {
    const css = getComputedStyle(node, pseudo);
    const values = {};
    for (const name of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundImage', 'backgroundColor', 'borderTopWidth', 'borderTopColor', 'borderRadius', 'boxShadow', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'position', 'top', 'transitionProperty', 'transitionDuration', 'transitionTimingFunction', 'animationName', 'animationDuration', 'animationDelay', 'animationTimingFunction', 'animationIterationCount']) values[name] = css[name];
    if (!pseudo) { const rect = node.getBoundingClientRect(); values.width = rect.width; }
    return values;
  }, pseudo);
}

test('real Chromium baseline comparisons at 320/390/768/1024/1440 and threshold-driven celebrations', { timeout: 300000 }, async t => {
  console.log('Preparing RAM baseline');
  const resources = new Map(['index.html', 'TeiganCss.css', 'Teigan.js', 'instructions.html', 'teigan.png', 'favicon_io/favicon.ico'].map(path => [`/${path}`, original(path)]));
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const body = resources.get(path === '/' ? '/index.html' : path);
    if (!body) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.png') ? 'image/png' : path.endsWith('.ico') ? 'image/x-icon' : 'text/html; charset=utf-8');
    response.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  console.log('Launching comparison browser');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const oldURL = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 30000, args: ['--no-first-run'] });
  t.after(() => browser.close());
  const oldPage = await browser.newPage();
  const page = await browser.newPage();
  console.log('Seeding deterministic baseline data');
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const data = JSON.parse(await readFile(new URL('assets/quran/quran.json', root), 'utf8'));
  // Only the Fatiha is needed for the reference reader fixture. Keep the init
  // script small; the complete corpus is independently verified by search tests.
  await seedOriginal(oldPage, { surahs: data.surahs.map(({ number, name, englishName, numberOfAyahs, ayahs }) => ({ number, name, englishName, numberOfAyahs, ayahs: number === 1 ? ayahs : [] })) });
  console.log('Baseline ready');
  const captures = process.env.PRESERVATION_SCREENSHOTS;
  if (captures) await mkdir(captures, { recursive: true });
  t.diagnostic(`Chromium ${await browser.version()}; baseline ${baseline}; reference server is RAM-only`);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await t.test(`${width}px original identity, decoration, navigation, panels, results, reader and instructions`, async () => {
      for (const tab of [oldPage, page]) await tab.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      console.log(`Comparing ${width}px: loading original/restored`);
      await Promise.all([oldPage.goto(oldURL, { waitUntil: 'domcontentloaded' }), page.goto(appURL, { waitUntil: 'domcontentloaded' })]);
      await page.waitForFunction(() => !document.querySelector('#surah-input').disabled, { timeout: 45000 });
      await Promise.all([settle(oldPage), settle(page)]);
      console.log(`Comparing ${width}px: identity and exam sections`);
      for (const selector of ['.header', '.logo', '.brand-name', '.brand-tagline', '.logo-glow', '.logo-ring', '.header-decoration', '.main-navigation', '.nav-tab', '.sub-nav-btn', '.section-title', '.floating-crowns .crown-icon', '.header-particles .particle', '.instructions-btn', '.footer']) {
        assert.deepEqual(await metrics(page, selector), await metrics(oldPage, selector), `${width} ${selector}`);
      }
      assert.deepEqual(await metrics(page, '.header', '::before'), await metrics(oldPage, '.header', '::before'));
      const dimensions = await page.evaluate(() => ({ header: document.querySelector('.header').getBoundingClientRect().height, logo: getComputedStyle(document.querySelector('.logo')).width, nav: document.querySelector('.main-navigation').getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth, particles: document.querySelectorAll('.particle').length, crowns: document.querySelectorAll('.crown-icon').length }));
      assert.equal(dimensions.overflow, false);
      assert.equal(dimensions.particles, 8);
      assert.equal(dimensions.crowns, 3);
      t.diagnostic(`${width}px: ${JSON.stringify(dimensions)}`);
      for (const group of ['review', 'testing', 'consolidation', 'quiz']) {
        await oldPage.evaluate(group => window.switchSection(group), group);
        await page.$eval(`[data-section="${group}"]`, button => button.click());
        await Promise.all([settle(oldPage), settle(page)]);
        const card = `#${group}-content`;
        // New reset/copy/cross-range controls add intentional height, not a new card system.
        const actualCard = await metrics(page, '#shared-calculator');
        const expectedCard = await metrics(oldPage, card);
        assert.deepEqual(actualCard, expectedCard, `${width} ${group} original card system`);
        if (width > 576) {
          // Manual calculation was explicitly removed; all retained original table styling stays identical.
          for (const suffix of ['.calculator-title', '.calculator-table', '.calculator-table th', '.calculator-table td', '.calculator-table input']) {
            assert.deepEqual(await metrics(page, `#shared-calculator ${suffix}`), await metrics(oldPage, `${card} ${suffix}`), `${width} ${group} ${suffix}`);
          }
        }
        const same = await page.evaluate(group => document.querySelector('#shared-mushaf').parentElement.id === `${group}-section`, group);
        assert.equal(same, true);
        assert.equal(await page.$('#calculate'), null, 'approved live scoring has no manual button');
        await oldPage.evaluate(group => group === 'review' ? calculateReviewResults() : group === 'testing' ? calculateTestResults('monthly') : group === 'quiz' ? calculateQuizResults('positions') : calculateConsolidationResults(), group);
        await page.$eval('#marks-body input', input => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
        await page.waitForSelector('#total-result');
        await Promise.all([settle(oldPage), settle(page)]);
        assert.deepEqual(await metrics(page, '.result-table'), await metrics(oldPage, '.result-table'), `${width} ${group} result table`);
        assert.equal(await page.$eval('#total-result', node => node.textContent), await oldPage.$eval('#total-result', node => node.textContent));
        if (group === 'consolidation') {
          assert.equal(await page.$eval('.base-score', node => node.textContent), '100.0');
          assert.equal(await page.$eval('.bonus-score', node => node.textContent), '0');
        }
      }
      await oldPage.evaluate(() => switchSection('review'));
      await page.$eval('[data-section="review"]', button => button.click());
      await Promise.all([settle(oldPage), settle(page)]);
      assert.deepEqual(await metrics(page, '#shared-mushaf'), await metrics(oldPage, '#review-quran-container'), `${width} original reader frame`);
      assert.deepEqual(await metrics(page, '#quran-page'), await metrics(oldPage, '#review-quran-page'), `${width} original page frame`);
      if (captures) {
        for (const [label, tab] of [['original', oldPage], ['restored', page]]) {
          // Confetti remains visually unchanged; omit transient random pieces from static comparisons.
          await tab.evaluate(() => document.querySelectorAll('[style*="confettiFall3D"]').forEach(node => node.remove()));
          await tab.screenshot({ path: join(captures, `${width}-${label}.png`), fullPage: true });
        }
      }
      console.log(`Comparing ${width}px: loaded reader`);
      await oldPage.evaluate(surah => displayVersesInSection({ ...surah, ayahs: surah.ayahs.map(a => ({ ...a, numberInSurah: a.number })) }, 1, 7, document.querySelector('#review-quran-page')), data.surahs[0]);
      console.log(`Comparing ${width}px: reference reader rendered`);
      await page.$eval('#surah-input', input => { input.value = '1'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.$eval('#surah-options [data-number="1"]', option => option.click());
      await page.$eval('#end-ayah', input => { input.value = '7'; });
      await page.$eval('#range-form', form => form.requestSubmit());
      console.log(`Comparing ${width}px: restored reader requested`);
      await Promise.all([oldPage.waitForSelector('#review-quran-page .quran-verses-content'), page.waitForSelector('#quran-page .quran-text')]);
      await Promise.all([settle(oldPage), settle(page)]);
      console.log(`Comparing ${width}px: reader fonts ready`);
      const actualVerses = await metrics(page, '.quran-verses-content');
      const oldVerses = await metrics(oldPage, '.quran-verses-content');
      assert.ok(actualVerses.fontFamily.startsWith('"Teijan Quran"'));
      delete actualVerses.fontFamily;
      delete oldVerses.fontFamily;
      assert.deepEqual(actualVerses, oldVerses, `${width} original verse surroundings/size, approved Noto family only`);
      console.log(`Comparing ${width}px: verse styles matched`);
      const title = await metrics(page, '.quran-surah-name');
      const oldTitle = await metrics(oldPage, '.quran-surah-name');
      assert.ok(title.fontFamily.startsWith('"Teijan Quran"'), 'approved local Noto family for reader title');
      delete title.fontFamily;
      delete oldTitle.fontFamily;
      assert.deepEqual(title, oldTitle, `${width} original title size/weight/color/alignment/spacing/motion, approved Noto family only`);
      const titleSpacing = tab => tab.$eval('.quran-surah-name', node => {
        const css = getComputedStyle(node);
        return Object.fromEntries(['textAlign', 'marginTop', 'marginBottom', 'marginInlineStart', 'marginInlineEnd', 'wordSpacing', 'fontStyle', 'textTransform', 'animationDirection', 'animationFillMode'].map(name => [name, css[name]]));
      });
      assert.deepEqual(await titleSpacing(page), await titleSpacing(oldPage), `${width} title alignment, spacing and animation attributes`);
      assert.equal(await page.$eval('.quran-surah-name', node => node.textContent), data.surahs[0].name, 'title text and diacritics preserved');
      if (captures) for (const [label, tab] of [['original', oldPage], ['restored', page]]) {
        await tab.bringToFront();
        await tab.screenshot({ path: join(captures, `${width}-${label}-reader.png`), fullPage: true });
        console.log(`Captured ${width}px ${label} reader`);
      }
      await Promise.all([oldPage.goto(`${oldURL}/instructions.html`), page.goto(`${appURL}/instructions.html`)]);
      await Promise.all([settle(oldPage), settle(page)]);
      for (const selector of ['.header', '.header-icon', '.intro-card', '.instruction-card', '.instruction-title', '.footer-note-icon']) assert.deepEqual(await metrics(page, selector), await metrics(oldPage, selector), `${width} instructions ${selector}`);
      if (captures) for (const [label, tab] of [['original', oldPage], ['restored', page]]) await tab.screenshot({ path: join(captures, `${width}-${label}-instructions.png`), fullPage: true });
    });
  }
  await t.test('original confetti and pulse fire on every calculate press at or above the original threshold, never on typing, switching or copying', async () => {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(appURL);
    await page.waitForFunction(() => !document.querySelector('#surah-input').disabled, { timeout: 45000 });
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__preservationCopied = text; } } });
      window.__confettiSchedules = 0;
      const originalTimeout = window.setTimeout;
      window.setTimeout = (callback, delay, ...args) => {
        if (String(callback).includes('createConfettiPiece')) window.__confettiSchedules++;
        return originalTimeout(callback, delay, ...args);
      };
    });
    for (const [key, group, threshold] of [['review-save', 'review', 95], ['review-tathbeet', 'review', 95], ['testing-monthly', 'testing', 99], ['testing-cumulative', 'testing', 99], ['consolidation', 'consolidation', 99], ['quiz-positions', 'quiz', 90], ['quiz-narration', 'quiz', 90]]) {
      await page.$eval(`[data-section="${group}"]`, button => button.click());
      if (group !== 'consolidation') await page.$eval(`[data-exam="${key}"]`, button => button.click());
      const setScore = async score => page.$eval('#marks-body .word-openings', (input, score) => { input.value = 100 - score; input.dispatchEvent(new Event('input', { bubbles: true })); }, score);
      const schedules = () => page.evaluate(() => window.__confettiSchedules);
      const before = await schedules();
      const calculate = () => page.$eval('#calculate-marks', button => button.click());
      await setScore(threshold - 1);
      assert.equal(await schedules(), before, `${key}: typing alone never celebrates`);
      assert.equal(await page.$('#total-result'), null, `${key}: no result before pressing calculate`);
      await calculate();
      assert.equal(await schedules(), before, `${key}: below threshold does not celebrate`);
      await setScore(threshold);
      assert.equal(await schedules(), before, `${key}: reaching the threshold by typing does not celebrate`);
      assert.equal(await page.$('#total-result'), null, `${key}: editing hides the previous result`);
      await calculate();
      assert.equal(await schedules(), before + 100, `${key}: pressing calculate at the original threshold celebrates`);
      const pulse = await page.$eval('#total-result', node => node.style.animation);
      assert.equal(pulse.startsWith('resultPulse'), group !== 'review', `${key} pulse matches the original`);
      await calculate();
      assert.equal(await schedules(), before + 200, `${key}: every press celebrates again`);
      await page.$eval('#copy-result', button => button.click());
      await page.waitForFunction(() => typeof window.__preservationCopied === 'string');
      await page.evaluate(() => { window.__preservationCopied = undefined; });
      await page.$eval(`[data-section="${group === 'review' ? 'testing' : 'review'}"]`, button => button.click());
      await page.$eval(`[data-section="${group}"]`, button => button.click());
      assert.equal(await schedules(), before + 200, `${key}: copying and switching do not celebrate`);
    }
  });
  assert.deepEqual(errors, []);
  if (captures) t.diagnostic(`Actual screenshots: ${captures}`);
});

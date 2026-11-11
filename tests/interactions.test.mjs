/** Current-worktree browser checks for continuous reading and added UI motion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { default: puppeteer } = await import(pathToFileURL(process.env.PUPPETEER_MODULE || 'C:/Users/hp/Documents/Multaqa-Motion-Studio/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href);
const url = process.env.TEST_URL || 'http://127.0.0.1:4173';
const data = JSON.parse(await readFile(new URL('../assets/quran/quran.json', import.meta.url)));
const all = data.surahs.flatMap(s => s.ayahs.map(a => ({ key: `${s.number}:${a.number}`, text: a.text })));
const expected = (s, a, e, b) => all.slice(all.findIndex(v => v.key === `${s}:${a}`), all.findIndex(v => v.key === `${e}:${b}`) + 1);
const fill = (page, selector, value) => page.$eval(selector, (n, value) => { n.value = String(value); n.dispatchEvent(new Event('input', { bubbles: true })); }, value);
const getVerses = page => page.$$eval('.quran-verse', ns => ns.map(n => ({ key: n.dataset.verseKey, text: n.querySelector('.quran-text').textContent })));
async function fresh(page) {
  await page.emulateMediaFeatures([]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('#surah-input').disabled);
}
async function choose(page, n, end = false) {
  await fill(page, end ? '#end-surah-input' : '#surah-input', n);
  await page.$eval(`${end ? '#end-surah-options' : '#surah-options'} [data-number="${n}"]`, n => n.click());
}
async function range(page, s, a, e, b) {
  await choose(page, s);
  await fill(page, '#start-ayah', a);
  await page.$eval('#cross-surah', (n, cross) => { n.checked = cross; n.dispatchEvent(new Event('change', { bubbles: true })); }, s !== e);
  if (s !== e) await choose(page, e, true);
  await fill(page, s === e ? '#end-ayah' : '#cross-end-ayah', b);
  await page.$eval('#range-form', n => n.requestSubmit());
  await page.waitForFunction(({ first, last, count }) => {
    const ns = document.querySelectorAll('.quran-verse');
    return document.querySelector('#quran-page').getAttribute('aria-busy') === 'false'
      && ns.length === count && ns[0]?.dataset.verseKey === first && ns[ns.length - 1]?.dataset.verseKey === last;
  }, { timeout: 60000 }, { first: `${s}:${a}`, last: `${e}:${b}`, count: expected(s, a, e, b).length });
}
const settled = page => page.waitForFunction(() => !document.querySelector('#reset-dialog').open && !document.querySelector('#copy-dialog').open);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('continuous reader and native interaction regressions', { timeout: 300000 }, async t => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await t.test('short, 45-Ayah, two-Surah, intermediate-Surah and Quran boundary selections are complete and authentic', async () => {
    await fresh(page);
    for (const args of [[2, 5, 2, 9], [2, 1, 2, 45], [2, 260, 3, 5], [110, 1, 114, 6], [2, 286, 3, 1], [2, 267, 3, 1], [1, 1, 1, 1], [114, 6, 114, 6]]) {
      await range(page, ...args);
      assert.deepEqual(await getVerses(page), expected(...args));
      assert.equal(await page.$eval('#return-selected', n => n.hidden), true);
      assert.equal(await page.$eval('#quran-page', n => n.querySelectorAll('.bismillah').length), 0);
    }
  });

  await t.test('the entire 6236-Ayah Mushaf renders without a cap, omission, normalization or user pagination', async () => {
    await fresh(page);
    // Measure a real marking update DURING automatic off-DOM construction.
    await page.$eval('#range-form', form => form.addEventListener('submit', () => {
      const start = performance.now();
      setTimeout(() => {
        const input = document.querySelector('#marks-body input');
        const tick = performance.now();
        input.value = '1'; input.dispatchEvent(new Event('input', { bubbles: true }));
        window.__largeProbe = { delay: tick - start, inputMs: performance.now() - tick,
          busy: document.querySelector('#quran-page').getAttribute('aria-busy'), score: document.querySelector('.numeric-score').textContent };
      }, 20);
    }, { once: true }));
    const start = performance.now();
    await range(page, 1, 1, 114, 6);
    const renderedMs = performance.now() - start;
    assert.deepEqual(await getVerses(page), all);
    assert.equal(await page.$$eval('.quran-surah-name', ns => ns.length), 114);
    assert.equal(await page.$eval('#previous-page', n => n.disabled), true);
    assert.equal(await page.$eval('#next-page', n => n.disabled), true);
    const probe = await page.evaluate(() => window.__largeProbe);
    assert.equal(probe.busy, 'true', 'the responsiveness probe must run while rendering, not before it');
    assert.equal(probe.score, '98.0');
    assert.ok(probe.inputMs < 250, JSON.stringify(probe));
    t.diagnostic(`Entire Quran: ${Math.round(renderedMs)}ms to complete DOM; ${Math.round(performance.now() - start)}ms including exact text transfer/comparison; marking probe ${JSON.stringify(probe)}`);
  });

  await t.test('delayed dataset readiness preserves live inputs and cross mode; search explicitly selects a new complete location', async () => {
    const slow = await browser.newPage();
    try {
      await slow.evaluateOnNewDocument(() => {
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
          addEventListener(type, listener, options) {
            if (type !== 'message') return super.addEventListener(type, listener, options);
            return super.addEventListener(type, event => {
              if (event.data?.type === 'ready') setTimeout(() => listener(event), 1000);
              else listener(event);
            }, options);
          }
        };
      });
      await slow.goto(url, { waitUntil: 'domcontentloaded' });
      assert.equal(await slow.$eval('#load-verses', n => n.disabled), true);
      await fill(slow, '#marks-body input', 0);
      await slow.$eval('#cross-surah', n => n.click());
      assert.equal(await slow.$eval('.numeric-score', n => n.textContent), '100.0');
      await slow.waitForFunction(() => !document.querySelector('#surah-input').disabled);
      assert.equal(await slow.$eval('#cross-surah', n => n.checked), true);
      await range(slow, 2, 260, 3, 5);
      assert.deepEqual(await getVerses(slow), expected(2, 260, 3, 5));
      await fill(slow, '#verse-search', 'الحمد لله رب العالمين');
      await slow.waitForSelector('#verse-search-results [data-verse-key="1:2"]');
      await slow.$eval('#verse-search-results [data-verse-key="1:2"]', n => n.click());
      await slow.waitForFunction(() => document.querySelector('.quran-verse')?.dataset.verseKey === '1:1');
      assert.deepEqual(await getVerses(slow), expected(1, 1, 1, 7));
      assert.equal(await slow.$eval('#cross-surah', n => n.checked), false);
      assert.equal(await slow.$eval('.numeric-score', n => n.textContent), '100.0');
    } finally { await slow.close(); }
  });

  await t.test('a newer selection cancels unfinished large rendering; exam switching never rebuilds the shared reader', async () => {
    await fresh(page);
    await choose(page, 1); await choose(page, 114, true);
    await page.evaluate(() => {
      const cross = document.querySelector('#cross-surah'); cross.checked = true; cross.dispatchEvent(new Event('change'));
      document.querySelector('#cross-end-ayah').value = '6';
      document.querySelector('#range-form').requestSubmit();
      setTimeout(() => {
        const input = document.querySelector('#surah-input'); input.value = '2'; input.dispatchEvent(new Event('input'));
        document.querySelector('#surah-options [data-number="2"]').click();
        cross.checked = false; cross.dispatchEvent(new Event('change'));
        document.querySelector('#end-ayah').value = '3';
        document.querySelector('#range-form').requestSubmit();
      }, 0);
    });
    await page.waitForFunction(() => document.querySelectorAll('.quran-verse').length === 3 && document.querySelector('.quran-verse').dataset.verseKey === '2:1');
    await sleep(500);
    assert.deepEqual(await getVerses(page), expected(2, 1, 2, 3));
    await page.evaluate(() => { window.__readerNode = document.querySelector('.quran-verse'); });
    await page.$eval('#range-form', form => form.requestSubmit());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.equal(await page.evaluate(() => window.__readerNode === document.querySelector('.quran-verse')), true, 'identical repeated selection does not rebuild Quran nodes');
    for (const group of ['testing', 'consolidation', 'quiz', 'review']) await page.$eval(`[data-section="${group}"]`, n => n.click());
    assert.equal(await page.evaluate(() => window.__readerNode === document.querySelector('.quran-verse')), true);
  });

  await t.test('adjacent navigation retains the selection, its controls and summary and has a direct complete return', async () => {
    await range(page, 2, 260, 3, 5);
    const selection = await page.$eval('#selected-range-summary', n => n.textContent);
    const controls = () => page.evaluate(() => ['surah-input', 'start-ayah', 'end-ayah', 'end-surah-input', 'cross-end-ayah'].map(id => document.getElementById(id).value).concat(document.querySelector('#cross-surah').checked));
    const before = await controls();
    await page.$eval('#next-page', n => n.click());
    assert.deepEqual(await getVerses(page), expected(3, 6, 3, 25));
    assert.deepEqual(await controls(), before);
    assert.equal(await page.$eval('#selected-range-summary', n => n.textContent), selection);
    assert.match(await page.$eval('#page-status', n => n.textContent), /بعد الاختيار/u);
    await page.$eval('#return-selected', n => n.click());
    await page.waitForFunction(() => document.querySelectorAll('.quran-verse').length === 32);
    assert.deepEqual(await getVerses(page), expected(2, 260, 3, 5));
  });

  await t.test('new buttons actually lift, press, expose decorative RTL icons and respect reduced motion', async () => {
    await fresh(page); await fill(page, '#marks-body input', 0);
    const y = selector => page.$eval(selector, n => { const v = getComputedStyle(n).transform; return v === 'none' ? 0 : new DOMMatrixReadOnly(v).m42; });
    for (const selector of ['#copy-result', '#reset-marks']) {
      await page.focus(selector); await sleep(40);
      await page.hover(selector); await sleep(340);
      assert.equal(await y(selector), -2, selector);
      await page.mouse.down(); await sleep(340);
      assert.equal(await y(selector), -1, selector);
      await page.mouse.move(0, 0); await page.mouse.up();
      const icon = await page.$eval(selector, n => {
        const svg = n.querySelector('.action-icon'); const text = document.createRange(); text.selectNodeContents(n.lastChild);
        return { hidden: svg.getAttribute('aria-hidden'), size: svg.getBoundingClientRect().width, rtl: svg.getBoundingClientRect().left >= text.getBoundingClientRect().right, text: n.textContent.trim() };
      });
      assert.equal(icon.hidden, 'true'); assert.ok(icon.size > 0 && icon.size <= 20); assert.equal(icon.rtl, true);
      assert.ok(icon.text.length);
    }
    await page.mouse.move(0, 0); await sleep(340);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.hover('#reset-marks'); await sleep(30);
    assert.equal(await y('#reset-marks'), 0);
    await page.emulateMediaFeatures([]);
  });

  await t.test('native modal has coordinated entrance/exit, concise copy, locked scroll, Escape and one-shot confirmation', async () => {
    await fresh(page); await fill(page, '#marks-body input', 0);
    await page.click('#reset-marks');
    assert.equal(await page.$eval('#reset-title', n => n.textContent), 'تأكيد مسح العلامات');
    assert.equal(await page.$eval('#reset-description', n => n.textContent), 'سيتم مسح علامات الاختبار الحالي فقط. هل أنت متأكد؟');
    const entry = await page.$eval('#reset-dialog', n => ({ transform: getComputedStyle(n).transform, duration: getComputedStyle(n).transitionDuration, backdropDuration: getComputedStyle(n, '::backdrop').transitionDuration }));
    assert.ok(entry.duration.includes('0.3s')); assert.ok(entry.backdropDuration.includes('0.3s'));
    await sleep(340);
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel({ deltaY: 400 }); await sleep(80);
    assert.equal(await page.evaluate(() => scrollY), before, 'background is locked');
    await page.click('#cancel-reset');
    assert.equal(await page.$eval('#reset-dialog', n => n.open), true, 'modal remains open during exit');
    assert.equal(await page.$eval('#reset-dialog', n => n.dataset.motion), 'closing');
    await page.keyboard.press('Escape');
    await settled(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'reset-marks');
    assert.equal(await page.$eval('.numeric-score', n => n.textContent), '100.0');
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) <= 2);
    await page.click('#reset-marks'); await sleep(330);
    await page.focus('#confirm-reset');
    await page.evaluate(() => {
      window.__resetRenders = 0;
      new MutationObserver(events => { window.__resetRenders += events.length; }).observe(document.querySelector('#marks-body'), { childList: true });
      const confirm = document.querySelector('#confirm-reset'); confirm.click(); confirm.dispatchEvent(new Event('click'));
    });
    assert.equal(await page.$eval('#reset-dialog', n => n.open && n.contains(document.activeElement)), true, 'confirmation keeps focus inside the closing modal');
    await settled(page);
    assert.equal(await page.evaluate(() => window.__resetRenders), 1);
    assert.equal(await page.$('#total-result'), null);
    assert.equal(await page.$eval('#marks-body input', n => n.value), '');
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
  });

  await t.test('mouse and Space draw/reverse the real checkmark, rapid toggles stay logical and reduced motion is immediate', async () => {
    await fresh(page);
    const offset = () => page.$eval('.cross-check-stroke', n => parseFloat(getComputedStyle(n).strokeDashoffset));
    assert.equal(await offset(), 100);
    await page.click('#cross-surah'); await sleep(100);
    const middle = await offset(); assert.ok(middle > 0 && middle < 100, `progressive offset ${middle}`);
    assert.equal(await page.$eval('#cross-range-fields', n => n.hidden), false);
    await sleep(250); assert.equal(await offset(), 0);
    await page.focus('#cross-surah'); await page.keyboard.press('Space'); await sleep(100);
    const reverse = await offset(); assert.ok(reverse > 0 && reverse < 100);
    assert.equal(await page.$eval('#cross-range-fields', n => n.hidden), true);
    for (let i = 0; i < 7; i++) await page.keyboard.press('Space');
    await sleep(330); assert.equal(await offset(), 0);
    assert.equal(await page.$eval('#cross-surah', n => n.checked && n.matches(':focus-visible') && getComputedStyle(n).display !== 'none'), true);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.keyboard.press('Space'); assert.equal(await offset(), 100);
    await page.emulateMediaFeatures([]);
  });

  await t.test('all five widths show full ranges and modal content; 320/390 synthetic touch preserves checkbox and dialog semantics', async () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 1000, hasTouch: width < 500, isMobile: width < 500 });
      await fresh(page); await range(page, 2, 260, 3, 5);
      assert.deepEqual(await getVerses(page), expected(2, 260, 3, 5));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width < 500) {
        for (let i = 0; i < 4; i++) await page.tap('#cross-surah');
        assert.equal(await page.$eval('#cross-surah', n => n.checked), true);
        assert.equal(await page.$eval('#cross-range-fields', n => n.hidden), false);
      }
      await fill(page, '#marks-body input', 0); await page.click('#reset-marks'); await sleep(330);
      assert.equal(await page.$eval('#reset-dialog', n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), true);
      await page.keyboard.press('Escape'); await settled(page);
      assert.equal(await page.$eval('.numeric-score', n => n.textContent), '100.0');
    }
  });
  assert.deepEqual(errors, []);
});

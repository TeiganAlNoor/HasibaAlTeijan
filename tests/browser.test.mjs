/**
 * Actual Chromium regression tests; no browser dependency is added to the app.
 * Start scripts/serve.mjs first, then run: node --test tests/browser.test.mjs
 * Overrides: TEST_URL, CHROME_PATH, PUPPETEER_MODULE (absolute path or module name).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { EXAM_CONFIGS } from '../js/exam-model.mjs';

const baseURL = process.env.TEST_URL ?? 'http://127.0.0.1:4173';
const modulePath = process.env.PUPPETEER_MODULE ?? 'C:/Users/hp/Documents/Multaqa-Motion-Studio/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const moduleURL = /^[A-Za-z]:[\\/]|^\//u.test(modulePath) ? pathToFileURL(modulePath).href : modulePath;
const { default: puppeteer } = await import(moduleURL);
const data = JSON.parse(await readFile(new URL('../assets/quran/quran.json', import.meta.url), 'utf8'));
const rawVerse = key => {
  const [surah, ayah] = key.split(':').map(Number);
  return data.surahs[surah - 1].ayahs[ayah - 1].text;
};
const keys = Object.keys(EXAM_CONFIGS);
const markSelector = (row = 0, field = 'corrections') => `#marks-body input[data-row="${row}"][data-field="${field}"]`;

async function fill(page, selector, value) {
  await page.$eval(selector, (element, next) => {
    element.focus();
    element.value = String(next);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function closeModal(page, selector) {
  await page.click(selector);
  await page.waitForFunction(() => !document.querySelector('#reset-dialog').open && !document.querySelector('#copy-dialog').open);
}
async function escapeAndSettle(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#reset-dialog').open && !document.querySelector('#copy-dialog').open);
}

async function openExam(page, key) {
  const section = EXAM_CONFIGS[key].group;
  await page.click(`[data-section="${section}"]`);
  if (key !== 'consolidation') await page.click(`[data-exam="${key}"]`);
  await page.waitForSelector(markSelector());
}

async function ready(page) {
  await page.waitForFunction(() => !document.querySelector('#surah-input').disabled, { timeout: 45000 });
}

async function fresh(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await ready(page);
}

async function chooseSurah(page, number, end = false) {
  const input = end ? '#end-surah-input' : '#surah-input';
  const list = end ? '#end-surah-options' : '#surah-options';
  await page.click(input);
  await fill(page, input, String(number));
  await page.click(`${list} [role="option"][data-number="${number}"]`);
  await page.waitForFunction(selector => document.querySelector(selector).getAttribute('aria-expanded') === 'false', {}, input);
}

async function displayRange(page, surah, start, end) {
  await chooseSurah(page, surah);
  await fill(page, '#start-ayah', start);
  await fill(page, '#end-ayah', end);
  await page.click('#load-verses');
  await page.waitForSelector(`#quran-page .quran-verse[data-verse-key="${surah}:${start}"]`);
}

async function searchVerse(page, query, key) {
  await fill(page, '#verse-search', query);
  await page.waitForFunction(({ text, expectedKey }) => {
    const box = document.querySelector('#verse-search-results');
    return document.querySelector('#verse-search').value === text && !box.hidden
      && (!expectedKey || box.querySelector(`[data-verse-key="${expectedKey}"]`));
  }, { timeout: 15000 }, { text: query, expectedKey: key });
}

async function calculateScore(page, score) {
  // Scoring is live. This helper must never simulate the removed manual action.
  await page.waitForFunction(expected => document.querySelector('#total-result .numeric-score')?.textContent.trim() === expected, {}, score.toFixed(1));
}

async function visible(page, selector) {
  return page.evaluate(selector => {
    const node = document.querySelector(selector);
    return Boolean(node && !node.hidden && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
  }, selector);
}

async function assertUncalculated(page, label = '') {
  assert.equal(await page.$('#total-result'), null, `${label}: no stale score`);
  for (const selector of ['#copy-result', '#reset-marks', '#failure-alert']) {
    assert.equal(await visible(page, selector), false, `${label}: ${selector} must be hidden`);
  }
}

async function values(page) {
  return page.$$eval('#marks-body input', inputs => inputs.map(input => input.value));
}

test('Chromium: calculator, shared Mushaf, Arabic search, mobile and accessibility regressions', { timeout: 420000 }, async t => {
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ['--no-first-run', '--disable-dev-shm-usage'] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => {
        if (window.__clipboardReject) throw new DOMException('Test clipboard denial', 'NotAllowedError');
        window.__copiedText = text;
      },
    } });
  });

  await t.test('all seven configurations are untouched initially, score live with original weights, and clear to no result', async () => {
    await fresh(page);
    assert.equal(await page.$('#calculate'), null, 'manual calculate action is completely removed');
    for (const key of keys) {
      await openExam(page, key);
      assert.equal(await page.$$eval('#marks-body tr', rows => rows.length), EXAM_CONFIGS[key].rowCount, key);
      await assertUncalculated(page, key);
      assert.equal(await visible(page, '#cancel-incomplete'), false, 'untouched has no partial draft action');
      await fill(page, markSelector(), 0);
      await calculateScore(page, 100);
      assert.equal(await visible(page, '#copy-result'), true, key);
      assert.equal(await visible(page, '#reset-marks'), true, key);
      let score = 100;
      for (const item of EXAM_CONFIGS[key].fields) {
        await fill(page, markSelector(0, item.id), 1);
        score -= item.weight;
        await calculateScore(page, score);
      }
      await calculateScore(page, EXAM_CONFIGS[key].group === 'quiz' ? 92.9 : 94.4);
      await fill(page, markSelector(), 2);
      await calculateScore(page, EXAM_CONFIGS[key].group === 'quiz' ? 90.9 : 92.4);
      for (const item of EXAM_CONFIGS[key].fields) await fill(page, markSelector(0, item.id), '');
      await assertUncalculated(page, `${key} cleared`);
      assert.equal(await visible(page, '#cancel-incomplete'), false);
    }
  });

  await t.test('live marking preserves input/table identity, focus, and synchronous score while typing', async () => {
    await fresh(page);
    await page.evaluate(() => {
      window.__liveInput = document.querySelector('#marks-body input');
      window.__liveBody = document.querySelector('#marks-body');
    });
    await page.click(markSelector());
    await page.keyboard.type('12');
    await calculateScore(page, 76);
    assert.equal(await page.evaluate(() => document.activeElement === window.__liveInput
      && document.querySelector('#marks-body input') === window.__liveInput
      && document.querySelector('#marks-body') === window.__liveBody), true, 'no table rebuild or focus loss on keystroke');
    await page.keyboard.press('Backspace');
    await calculateScore(page, 98);
    await page.keyboard.press('Backspace');
    await assertUncalculated(page, 'cleared using keyboard');
    await openExam(page, 'quiz-positions');
    await page.select('#entry-count', '10');
    await assertUncalculated(page, 'row count alone is not marking activity');
    await fill(page, markSelector(9, 'Meaning'), 7);
    await calculateScore(page, 93);
    await page.select('#entry-count', '2');
    await assertUncalculated(page, 'inactive-only marks do not calculate');
    assert.equal(await visible(page, '#cancel-incomplete'), true, 'inactive draft remains cancellable');
    await page.select('#entry-count', '10');
    await calculateScore(page, 93);
  });

  await t.test('review 99/97/95 boundaries, other 90 boundary, negative score and consolidation 101 are preserved', async () => {
    await fresh(page);
    for (const key of ['review-save', 'review-tathbeet']) {
      await openExam(page, key);
      for (const [count, score, grade] of [[1, 99, 'امتياز'], [3, 97, 'ممتاز'], [5, 95, 'جيد جداً'], [6, 94, 'غير مكتمل']]) {
        await fill(page, markSelector(0, 'word-openings'), count);
        await calculateScore(page, score);
        assert.equal(await page.$eval('.verbal-grade', node => node.textContent.trim()), grade);
      }
    }
    for (const key of ['testing-monthly', 'testing-cumulative', 'quiz-positions', 'quiz-narration']) {
      await openExam(page, key);
      await fill(page, markSelector(0, 'word-openings'), 10);
      await calculateScore(page, 90);
      assert.ok((await page.$eval('#result-content', node => node.textContent)).includes('ناجح'));
      await fill(page, markSelector(0, 'word-openings'), 11);
      await calculateScore(page, 89);
      assert.ok(!(await page.$eval('#result-content', node => node.textContent)).includes('ناجح'));
    }
    await openExam(page, 'consolidation');
    await page.click('#bonus-q1');
    await page.click('#bonus-q2');
    await calculateScore(page, 101);
    await fill(page, markSelector(), 51);
    await calculateScore(page, -1);
    await page.click('#bonus-q1');
    await calculateScore(page, -1.5);
  });

  await t.test('seven independent drafts survive navigation; shrinking positions restores inactive rows safely', async () => {
    await fresh(page);
    for (const [index, key] of keys.entries()) {
      await openExam(page, key);
      await fill(page, markSelector(), index + 1);
      await calculateScore(page, 100 - 2 * (index + 1));
    }
    for (const [index, key] of keys.entries()) {
      await openExam(page, key);
      assert.equal(await page.$eval(markSelector(), input => input.value), String(index + 1));
      assert.equal(await page.$eval('#total-result .numeric-score', node => node.textContent.trim()), (100 - 2 * (index + 1)).toFixed(1));
    }
    await openExam(page, 'quiz-positions');
    await page.select('#entry-count', '10');
    await fill(page, markSelector(9, 'Meaning'), 7);
    await page.select('#entry-count', '2');
    await calculateScore(page, 88);
    await openExam(page, 'review-save');
    await openExam(page, 'quiz-positions');
    assert.equal(await page.$eval('#entry-count', select => select.value), '2');
    await page.select('#entry-count', '10');
    assert.equal(await page.$eval(markSelector(9, 'Meaning'), input => input.value), '7');
    await calculateScore(page, 81);
  });

  await t.test('reset cancel and Escape change nothing; confirm clears only current including inactive marks, preserving row count', async () => {
    await fresh(page);
    await openExam(page, 'testing-monthly');
    await fill(page, markSelector(), 2);
    await calculateScore(page, 96);
    await openExam(page, 'consolidation');
    await page.click('#bonus-q1');
    await calculateScore(page, 100.5);
    await openExam(page, 'quiz-positions');
    await page.select('#entry-count', '10');
    await fill(page, markSelector(9, 'Meaning'), 8);
    await fill(page, markSelector(), 3);
    await page.select('#entry-count', '2');
    await calculateScore(page, 94);
    const before = await values(page);
    await page.click('#reset-marks');
    await page.waitForFunction(() => document.querySelector('#reset-dialog').open);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'cancel-reset');
    await page.evaluate(() => document.querySelector('#surah-input').focus());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'cancel-reset', 'native modal keeps focus inside');
    assert.equal(await page.$eval('#reset-description', element => element.textContent), 'سيتم مسح علامات الاختبار الحالي فقط. هل أنت متأكد؟');
    await closeModal(page, '#cancel-reset');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'reset-marks');
    assert.deepEqual(await values(page), before);
    assert.equal(await page.$eval('#total-result .numeric-score', node => node.textContent.trim()), '94.0');
    await page.click('#reset-marks');
    await escapeAndSettle(page);
    assert.deepEqual(await values(page), before);
    await page.click('#reset-marks');
    await closeModal(page, '#confirm-reset');
    assert.ok((await values(page)).every(value => value === ''));
    assert.equal(await page.$eval('#entry-count', element => element.value), '2');
    await assertUncalculated(page, 'reset');
    await page.select('#entry-count', '10');
    assert.equal(await page.$eval(markSelector(9, 'Meaning'), input => input.value), '');
    await openExam(page, 'testing-monthly');
    assert.equal(await page.$eval(markSelector(), input => input.value), '2');
    assert.equal(await page.$eval('#total-result .numeric-score', element => element.textContent.trim()), '96.0');
    await openExam(page, 'consolidation');
    assert.equal(await page.$eval('#bonus-q1', input => input.checked), true);
    assert.equal(await page.$eval('#total-result .numeric-score', element => element.textContent.trim()), '100.5');
    await page.click('#reset-marks');
    await closeModal(page, '#confirm-reset');
    assert.equal(await page.$eval('#bonus-q1', input => input.checked), false);
  });

  await t.test('copy contains only verbal review grade or one-decimal final number; denial has a truthful manual fallback', async () => {
    await fresh(page);
    for (const key of keys) {
      await openExam(page, key);
      await fill(page, markSelector(), 2);
      await calculateScore(page, 96);
      assert.equal(await page.$eval('#copy-result', button => {
        const cell = button.closest('.score-cell');
        return Boolean(cell?.querySelector('#total-result') && button.closest('td') === cell);
      }), true, `${key}: copy is beside final result inside its cell`);
      await page.click('#copy-result');
      await page.waitForFunction(() => typeof window.__copiedText === 'string');
      assert.equal(await page.evaluate(() => window.__copiedText), key.startsWith('review-') ? 'جيد جداً' : '96.0');
      await page.evaluate(() => { window.__copiedText = undefined; });
    }
    await page.evaluate(() => {
      window.__clipboardReject = true;
      document.execCommand = () => false;
    });
    await page.click('#copy-result');
    await page.waitForFunction(() => document.querySelector('#copy-dialog').open);
    assert.equal(await page.$eval('#manual-copy', input => input.value), '96.0');
    assert.equal(await page.$eval('#manual-copy', input => input.selectionEnd - input.selectionStart), 4);
    await closeModal(page, '#close-copy');
    await page.evaluate(() => {
      document.execCommand = command => {
        window.__fallbackText = command === 'copy' ? document.querySelector('#manual-copy').value : null;
        return command === 'copy';
      };
    });
    await page.click('#copy-result');
    await page.waitForFunction(() => window.__fallbackText === '96.0');
    assert.equal(await page.$eval('#copy-dialog', dialog => dialog.open), false);
    await fill(page, markSelector(), 3);
    await calculateScore(page, 94);
    await page.evaluate(() => { window.__clipboardReject = false; window.__copiedText = undefined; });
    await page.click('#copy-result');
    await page.waitForFunction(() => window.__copiedText === '94.0');
    await fill(page, markSelector(), '-1');
    await assertUncalculated(page, 'invalid after successful copy');
  });

  await t.test('prominent failure alerts use the correct business meaning and disappear immediately for valid pass or invalid input', async () => {
    await fresh(page);
    for (const key of keys) {
      await openExam(page, key);
      await assertUncalculated(page, key);
      const review = key.startsWith('review-');
      const threshold = review ? 95 : 90;
      const meaning = review ? 'غير مكتمل' : key === 'consolidation' ? 'يحتاج تحسين' : 'راسب';
      await fill(page, markSelector(0, 'word-openings'), 101 - threshold);
      await calculateScore(page, threshold - 1);
      assert.equal(await visible(page, '#failure-alert'), true, key);
      const alert = await page.$eval('#failure-alert', node => {
        const heading = node.querySelector('h3.failure-heading');
        const box = node.getBoundingClientRect();
        const resultBox = document.querySelector('.result-table').getBoundingClientRect();
        return { text: heading?.textContent.trim(), font: heading ? parseFloat(getComputedStyle(heading).fontSize) : 0,
          icon: Boolean(node.querySelector('[aria-hidden="true"]')), width: box.width, height: box.height,
          gap: Math.max(box.top - resultBox.bottom, resultBox.top - box.bottom, 0), position: getComputedStyle(node).position };
      });
      assert.equal(alert.text, meaning, key);
      assert.ok(alert.font >= 20 && alert.height >= 60 && alert.width >= 180, `${key}: substantial warning ${JSON.stringify(alert)}`);
      assert.equal(alert.icon, true, 'icon accompanies explicit Arabic warning text');
      assert.ok(alert.gap <= 24, 'warning is closely associated with result');
      assert.ok(!['fixed', 'absolute'].includes(alert.position), 'warning does not cover content');
      await fill(page, markSelector(0, 'word-openings'), 100 - threshold);
      await calculateScore(page, threshold);
      assert.equal(await visible(page, '#failure-alert'), false, 'passing hides warning synchronously');
      await fill(page, markSelector(0, 'word-openings'), '-1');
      await assertUncalculated(page, `${key}: invalid`);
    }
  });

  await t.test('invalid and inactive-only drafts have a confirmed current-type-only cancellation without changing Mushaf', async () => {
    await fresh(page);
    await displayRange(page, 2, 5, 9);
    await fill(page, '#verse-search', 'الرحمن');
    await page.evaluate(() => { window.__partialMushaf = document.querySelector('#quran-page'); window.__partialHTML = window.__partialMushaf.innerHTML; });
    await openExam(page, 'testing-monthly');
    await fill(page, markSelector(), 2);
    await openExam(page, 'review-save');
    await fill(page, markSelector(), '-1');
    await assertUncalculated(page, 'invalid draft');
    assert.equal(await visible(page, '#cancel-incomplete'), true);
    assert.equal(await page.$eval('#cancel-incomplete', node => node.textContent.trim()), 'إلغاء الإدخالات غير المكتملة');
    await page.click('#cancel-incomplete');
    await page.waitForFunction(() => document.querySelector('#reset-dialog').open);
    await closeModal(page, '#cancel-reset');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'cancel-incomplete');
    assert.equal(await page.$eval(markSelector(), node => node.value), '-1');
    await page.click('#cancel-incomplete');
    await escapeAndSettle(page);
    assert.equal(await page.$eval(markSelector(), node => node.value), '-1');
    await page.click('#cancel-incomplete');
    await closeModal(page, '#confirm-reset');
    await assertUncalculated(page, 'cancelled invalid draft');
    assert.equal(await visible(page, '#cancel-incomplete'), false);
    assert.equal(await page.$eval(markSelector(), node => node.value), '');
    assert.equal(await page.evaluate(() => window.__partialMushaf === document.querySelector('#quran-page') && window.__partialHTML === document.querySelector('#quran-page').innerHTML), true);
    assert.equal(await page.$eval('#verse-search', input => input.value), 'الرحمن');
    await openExam(page, 'testing-monthly');
    await calculateScore(page, 96);
    await openExam(page, 'quiz-positions');
    await page.select('#entry-count', '10');
    await fill(page, markSelector(9, 'Meaning'), 1);
    await page.select('#entry-count', '2');
    await assertUncalculated(page, 'inactive-only draft');
    assert.equal(await visible(page, '#cancel-incomplete'), true);
    await page.click('#cancel-incomplete');
    await closeModal(page, '#confirm-reset');
    await page.select('#entry-count', '10');
    assert.ok((await values(page)).every(value => value === ''));
  });

  await t.test('one shared Mushaf DOM, range, query, cross-mode and displayed text persist through all seven types and reset', async () => {
    let datasetRequests = 0;
    const countRequest = request => { if (request.url().endsWith('/assets/quran/quran.json')) datasetRequests++; };
    page.on('request', countRequest);
    await fresh(page);
    await displayRange(page, 2, 5, 9);
    await page.click('#cross-surah');
    await chooseSurah(page, 3, true);
    await fill(page, '#cross-end-ayah', 10);
    await fill(page, '#verse-search', 'الرحمن');
    await page.evaluate(() => {
      window.__mushafNode = document.querySelector('#quran-page');
      window.__mushafRoot = document.querySelector('#shared-mushaf');
      window.__mushafHTML = window.__mushafNode.innerHTML;
    });
    for (const key of keys) {
      await openExam(page, key);
      const state = await page.evaluate(() => ({
        sameNode: window.__mushafNode === document.querySelector('#quran-page'),
        sameRoot: window.__mushafRoot === document.querySelector('#shared-mushaf'),
        rootCount: document.querySelectorAll('#shared-mushaf').length,
        section: document.querySelector('#shared-mushaf').parentElement.id,
        sameHTML: window.__mushafHTML === document.querySelector('#quran-page').innerHTML,
        start: document.querySelector('#start-ayah').value,
        end: document.querySelector('#end-ayah').value,
        cross: document.querySelector('#cross-surah').checked,
        crossEnd: document.querySelector('#cross-end-ayah').value,
        query: document.querySelector('#verse-search').value,
        endSurah: document.querySelector('#end-surah-input').value,
      }));
      assert.equal(state.sameNode, true, key);
      assert.equal(state.sameRoot, true, key);
      assert.equal(state.rootCount, 1, key);
      assert.equal(state.section, `${EXAM_CONFIGS[key].group}-section`, key);
      assert.equal(state.sameHTML, true, key);
      assert.deepEqual({ start: state.start, end: state.end, cross: state.cross, crossEnd: state.crossEnd, query: state.query }, { start: '5', end: '9', cross: true, crossEnd: '10', query: 'الرحمن' });
      assert.ok(state.endSurah.startsWith('3.'));
    }
    await fill(page, markSelector(), 0);
    await calculateScore(page, 100);
    await page.click('#reset-marks');
    await closeModal(page, '#confirm-reset');
    assert.equal(await page.evaluate(() => window.__mushafNode === document.querySelector('#quran-page') && window.__mushafHTML === document.querySelector('#quran-page').innerHTML), true);
    assert.equal(await page.$eval('#verse-search', input => input.value), 'الرحمن');
    assert.equal(datasetRequests, 1, 'navigation/reset must not reload Quran data');
    page.off('request', countRequest);
  });

  await t.test('combobox browses all 114, accepts partial/variant names, commits only selection, and supports keyboard/cancel/empty results', async () => {
    await fresh(page);
    await displayRange(page, 1, 1, 3);
    const oldHTML = await page.$eval('#quran-page', node => node.innerHTML);
    await page.click('#surah-input');
    assert.equal(await page.$$eval('#surah-options [role="option"]', options => options.length), 114);
    for (const [query, number] of [['الفاتحه', 1], ['البقره', 2], ['ال عمران', 3], ['الانعام', 6], ['الاسراء', 17]]) {
      await fill(page, '#surah-input', query);
      assert.ok(await page.$(`#surah-options [data-number="${number}"]`), query);
      assert.equal(await page.$eval('#quran-page', node => node.innerHTML), oldHTML);
    }
    await fill(page, '#surah-input', 'عمران');
    await page.keyboard.press('ArrowDown');
    assert.ok(await page.$eval('#surah-input', input => input.getAttribute('aria-activedescendant')));
    await page.keyboard.press('Enter');
    assert.ok((await page.$eval('#surah-input', input => input.value)).startsWith('3.'));
    assert.equal(await page.$eval('#quran-page', node => node.innerHTML), oldHTML, 'selecting a Surah does not silently load or alter displayed verses');
    await page.click('#surah-input');
    await fill(page, '#surah-input', 'اسم لا وجود له');
    assert.equal(await page.$$eval('#surah-options [role="option"]', options => options.length), 0);
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('#quran-page', node => node.innerHTML), oldHTML);
    await escapeAndSettle(page);
    assert.equal(await page.$eval('#surah-options', list => list.hidden), true);
    assert.ok((await page.$eval('#surah-input', input => input.value)).startsWith('3.'));
    await page.click('#surah-input');
    await page.keyboard.press('Tab');
    assert.equal(await page.$eval('#surah-options', list => list.hidden), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'start-ayah');
  });

  await t.test('strict range errors never swap/clamp silently; cross-Surah range includes every intermediate Surah and preserves inactive values', async () => {
    await fresh(page);
    assert.equal(await page.$eval('#cross-surah', input => input.checked), false);
    assert.equal(await page.$eval('#cross-range-fields', node => node.hidden), true);
    await displayRange(page, 1, 1, 3);
    const oldHTML = await page.$eval('#quran-page', node => node.innerHTML);
    for (const [start, end] of [[99, 100], [6, 2], [0, 2], [1.5, 2], ['', 2]]) {
      await fill(page, '#start-ayah', start);
      await fill(page, '#end-ayah', end);
      await page.click('#load-verses');
      assert.ok((await page.$eval('#range-error', node => node.textContent)).trim(), `${start}..${end}`);
      assert.equal(await page.$eval('#quran-page', node => node.innerHTML), oldHTML);
    }
    await chooseSurah(page, 112);
    await fill(page, '#start-ayah', 1);
    await page.click('#cross-surah');
    await chooseSurah(page, 114, true);
    await fill(page, '#cross-end-ayah', 6);
    await page.click('#load-verses');
    await page.waitForSelector('#quran-page [data-verse-key="114:6"]');
    const verseKeys = await page.$$eval('#quran-page .quran-verse', verses => verses.map(node => node.dataset.verseKey));
    assert.deepEqual(verseKeys, ['112:1', '112:2', '112:3', '112:4', '113:1', '113:2', '113:3', '113:4', '113:5', '114:1', '114:2', '114:3', '114:4', '114:5', '114:6']);
    await page.click('#cross-surah');
    assert.equal(await page.$eval('#cross-range-fields', node => node.hidden), true);
    await page.click('#cross-surah');
    assert.ok((await page.$eval('#end-surah-input', input => input.value)).startsWith('114.'));
    assert.equal(await page.$eval('#cross-end-ayah', input => input.value), '6');
    await chooseSurah(page, 111, true);
    await page.click('#load-verses');
    assert.ok((await page.$eval('#range-error', node => node.textContent)).trim());
    assert.deepEqual(await page.$$eval('#quran-page .quran-verse', verses => verses.map(node => node.dataset.verseKey)), verseKeys);
    await chooseSurah(page, 110);
    await fill(page, '#start-ayah', 1);
    await chooseSurah(page, 114, true);
    await fill(page, '#cross-end-ayah', 6);
    await page.click('#load-verses');
    await page.waitForSelector('#quran-page [data-verse-key="110:1"]');
    const firstPage = await page.$$eval('#quran-page .quran-verse', verses => verses.map(node => node.dataset.verseKey));
    assert.equal(firstPage.length, 23);
    const allKeys = data.surahs.slice(109).flatMap(surah => surah.ayahs.map(ayah => `${surah.number}:${ayah.number}`));
    assert.deepEqual(firstPage, allKeys, 'every intermediate verse is visible continuously without next');
    assert.equal(await page.$eval('#next-page', button => button.disabled), true);
    const pageHTML = await page.$eval('#quran-page', node => node.innerHTML);
    await openExam(page, 'quiz-narration');
    assert.equal(await page.$eval('#quran-page', node => node.innerHTML), pageHTML, 'exam navigation preserves the complete selection');
    await page.click('#previous-page');
    await page.click('#return-selected');
    assert.deepEqual(await page.$$eval('#quran-page .quran-verse', verses => verses.map(node => node.dataset.verseKey)), firstPage);
  });

  await t.test('complete selections remain distinct from adjacent browsing and return across Surah boundaries', async () => {
    await fresh(page);
    await fill(page, markSelector(), 2);
    const getKeys = () => page.$$eval('#quran-page .quran-verse', nodes => nodes.map(n => n.dataset.verseKey));
    const controls = () => page.evaluate(() => ['surah-input','start-ayah','end-ayah','end-surah-input','cross-end-ayah'].map(id => document.getElementById(id).value).concat(document.querySelector('#cross-surah').checked));
    await displayRange(page, 2, 5, 9);
    const originalControls = await controls();
    await page.click('#next-page');
    assert.deepEqual(await getKeys(), ['2:10','2:11','2:12','2:13','2:14']);
    assert.deepEqual(await controls(), originalControls, 'browsing never rewrites the saved selection inputs');
    await page.click('#return-selected');
    assert.deepEqual(await getKeys(), ['2:5','2:6','2:7','2:8','2:9']);
    await displayRange(page, 2, 1, 45);
    assert.deepEqual(await getKeys(), Array.from({length:45},(_,i)=>`2:${i+1}`));
    await page.click('#next-page');
    assert.deepEqual(await getKeys(), Array.from({length:20},(_,i)=>`2:${i+46}`));
    await page.click('#previous-page');
    assert.equal((await getKeys()).length,45);
    await displayRange(page, 2, 284, 286);
    await page.click('#next-page');
    assert.deepEqual(await getKeys(), ['3:1','3:2','3:3']);
    assert.equal(await page.$eval('#start-ayah',n=>n.value),'284');
    await page.click('#previous-page');
    assert.deepEqual(await getKeys(), ['2:284','2:285','2:286']);
    await displayRange(page,112,1,4);
    await page.click('#cross-surah');
    await chooseSurah(page,113,true);
    await fill(page,'#cross-end-ayah',5);
    await page.click('#load-verses');
    const crossKeys=await getKeys(), crossControls=await controls();
    assert.equal(crossKeys.length,9);
    await page.click('#next-page');
    assert.deepEqual(await getKeys(),['114:1','114:2','114:3','114:4','114:5','114:6']);
    assert.equal(await page.$eval('#next-page',n=>n.disabled),true);
    assert.deepEqual(await controls(),crossControls);
    await page.click('#return-selected');
    assert.deepEqual(await getKeys(),crossKeys);
    await page.click('#previous-page');
    assert.equal((await getKeys()).length,9);
    assert.deepEqual(await controls(),crossControls);
    await page.focus('#cross-surah');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    await page.click('#cross-surah');
    assert.equal(await page.$eval('#cross-surah', n => n.checked), false);
    await displayRange(page,1,1,3);
    assert.equal(await page.$eval('#previous-page',n=>n.disabled),true);
    await page.click('#next-page');
    assert.deepEqual(await getKeys(),['1:4','1:5','1:6']);
    await page.click('#next-page');
    assert.deepEqual(await getKeys(),['1:7','2:1','2:2']);
    await calculateScore(page,96);
    assert.equal(await page.$eval(markSelector(),n=>n.value),'2');
  });

  await t.test('row-count changes retain select focus and repeated Enter navigates pages with boundary focus fallback', async () => {
    await fresh(page);
    await openExam(page, 'quiz-positions');
    await page.evaluate(() => {
      window.__countControl = document.querySelector('#entry-count');
      window.__countMushaf = document.querySelector('#shared-mushaf');
      document.querySelector('#entry-count').focus();
    });
    await page.select('#entry-count', '4');
    assert.equal(await page.evaluate(() => document.activeElement === window.__countControl
      && document.querySelector('#entry-count') === window.__countControl
      && document.querySelector('#shared-mushaf') === window.__countMushaf), true, 'row count does not reinsert shared roots or lose focus');
    await fill(page, markSelector(), 2);
    const getKeys = () => page.$$eval('#quran-page .quran-verse', nodes => nodes.map(node => node.dataset.verseKey));
    await displayRange(page, 2, 1, 25);
    await page.focus('#next-page');
    await page.keyboard.press('Enter');
    assert.deepEqual(await getKeys(), Array.from({ length: 20 }, (_, i) => `2:${26 + i}`));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next-page');
    await page.keyboard.press('Enter');
    assert.deepEqual(await getKeys(), Array.from({ length: 20 }, (_, i) => `2:${46 + i}`));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next-page');
    await page.focus('#previous-page');
    await page.keyboard.press('Enter');
    assert.deepEqual(await getKeys(), Array.from({ length: 20 }, (_, i) => `2:${26 + i}`));
    await page.keyboard.press('Enter');
    assert.deepEqual(await getKeys(), Array.from({ length: 25 }, (_, i) => `2:${1 + i}`));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'previous-page');
    await displayRange(page, 114, 1, 3);
    await page.focus('#next-page');
    await page.keyboard.press('Enter');
    assert.deepEqual(await getKeys(), ['114:4', '114:5', '114:6']);
    assert.equal(await page.$eval('#next-page', button => button.disabled), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'previous-page', 'Quran end focuses available reverse direction');
    await page.keyboard.press('Enter');
    assert.deepEqual(await getKeys(), ['114:1', '114:2', '114:3']);
    await displayRange(page, 1, 4, 6);
    await page.focus('#previous-page');
    await page.keyboard.press('Enter');
    assert.deepEqual(await getKeys(), ['1:1', '1:2', '1:3']);
    assert.equal(await page.$eval('#previous-page', button => button.disabled), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'next-page', 'Quran start focuses available forward direction');
    await page.keyboard.press('Enter');
    assert.deepEqual(await getKeys(), ['1:4', '1:5', '1:6']);
    await calculateScore(page, 96);
  });

  await t.test('complete local search is not restricted to displayed/cached Surahs; simplified spelling maps onto exact original phrase', async () => {
    await fresh(page);
    await displayRange(page, 1, 1, 3);
    await searchVerse(page, 'الرحمن', '2:163');
    const outsideFatiha = await page.$$eval('#verse-search-results [data-verse-key]', nodes => nodes.some(node => !node.dataset.verseKey.startsWith('1:')));
    assert.equal(outsideFatiha, true);
    await searchVerse(page, 'الحمد لله رب العالمين', '1:2');
    const phrase = await page.$eval('#verse-search-results [data-verse-key="1:2"] .search-result-text', node => ({ text: node.textContent, marks: [...node.querySelectorAll('mark')].map(mark => mark.textContent) }));
    assert.equal(phrase.text, rawVerse('1:2'));
    assert.equal(phrase.marks.length, 1);
    assert.equal(phrase.marks[0], rawVerse('1:2'));
    await searchVerse(page, 'اولئك على', '2:5');
    const repeated = await page.$eval('#verse-search-results [data-verse-key="2:5"] .search-result-text', node => ({ text: node.textContent, marks: [...node.querySelectorAll('mark')].map(mark => mark.textContent) }));
    assert.equal(repeated.marks.length, 1, 'only the matched phrase, not every repeated word, is marked');
    assert.ok(repeated.marks[0].includes('عَلَىٰ'));
    assert.equal(repeated.text, rawVerse('2:5'));
  });

  await t.test('long 2:282 remains searchable, snippets include a late match, outside click dismisses, and display preserves exact Quran text without duplicate Bismillah', async () => {
    await fresh(page);
    assert.ok(rawVerse('2:282').length > 500);
    await searchVerse(page, 'واتقوا الله ويعلمكم الله', '2:282');
    const snippet = await page.$eval('#verse-search-results [data-verse-key="2:282"] .search-result-text', node => ({ text: node.textContent, mark: node.querySelector('mark')?.textContent }));
    assert.ok(snippet.mark?.length > 8, 'late match must be visible and highlighted');
    assert.ok(snippet.text.includes(snippet.mark));
    await page.click('#exam-heading');
    assert.equal(await page.$eval('#verse-search-results', node => node.hidden), true);
    await searchVerse(page, 'اذا تداينتم بدين الى اجل مسمى', '2:282');
    await page.click('#verse-search-results [data-verse-key="2:282"]');
    await page.waitForSelector('#quran-page .quran-verse[data-verse-key="2:282"]');
    assert.equal(await page.$eval('#quran-page [data-verse-key="2:282"] .quran-text', node => node.textContent), rawVerse('2:282'));
    await displayRange(page, 2, 1, 1);
    assert.equal(await page.$eval('#quran-page [data-verse-key="2:1"] .quran-text', node => node.textContent), rawVerse('2:1'));
    assert.equal(await page.$$eval('#quran-page .bismillah', nodes => nodes.length), 0, 'source already contains the opening Bismillah');
    for (const key of ['1:1', '9:1', '112:1']) {
      const [surah, ayah] = key.split(':').map(Number);
      await displayRange(page, surah, ayah, ayah);
      assert.equal(await page.$eval(`#quran-page [data-verse-key="${key}"] .quran-text`, node => node.textContent), rawVerse(key));
    }
  });

  await t.test('an actually delayed older worker response cannot replace a newer query or resurrect cleared/dismissed results', async () => {
    const racePage = await browser.newPage();
    racePage.on('pageerror', error => pageErrors.push(String(error)));
    try {
      await racePage.evaluateOnNewDocument(() => {
        const NativeWorker = window.Worker;
        window.__workerSent = [];
        window.__workerDelivered = [];
        window.Worker = class extends NativeWorker {
          constructor(...args) { super(...args); this.queries = new Map(); }
          postMessage(message, ...rest) {
            this.queries.set(message.id, message.query);
            window.__workerSent.push({ id: message.id, query: message.query });
            return super.postMessage(message, ...rest);
          }
          addEventListener(type, listener, ...rest) {
            if (type !== 'message') return super.addEventListener(type, listener, ...rest);
            return super.addEventListener(type, event => {
              const deliver = () => {
                if (event.data.type === 'results') window.__workerDelivered.push(event.data.id);
                if (typeof listener === 'function') listener.call(this, event);
                else listener.handleEvent(event);
              };
              if (event.data.type === 'results' && this.queries.get(event.data.id) === 'الرحمن') setTimeout(deliver, 600);
              else deliver();
            }, ...rest);
          }
        };
      });
      await fresh(racePage);
      await fill(racePage, '#verse-search', 'الرحمن');
      await racePage.waitForFunction(() => window.__workerSent.some(message => message.query === 'الرحمن'));
      await fill(racePage, '#verse-search', 'الحمد لله رب العالمين');
      await racePage.waitForSelector('#verse-search-results [data-verse-key="1:2"]');
      const expected = ['1:2', '6:45', '10:10', '37:182', '39:75', '40:65'];
      const getKeys = () => racePage.$$eval('#verse-search-results [data-verse-key]', nodes => nodes.map(node => node.dataset.verseKey));
      assert.deepEqual(await getKeys(), expected);
      await racePage.waitForFunction(() => window.__workerDelivered.includes(1));
      assert.deepEqual(await racePage.evaluate(() => window.__workerDelivered.slice(0, 2)), [2, 1], 'fixture must actually deliver the newer response before the older response');
      assert.deepEqual(await getKeys(), expected, 'older completed request must not overwrite the latest result');
      await fill(racePage, '#verse-search', 'الرحمن');
      await racePage.waitForFunction(() => window.__workerSent.filter(message => message.query === 'الرحمن').length >= 2);
      const clearId = await racePage.evaluate(() => window.__workerSent.at(-1).id);
      await fill(racePage, '#verse-search', '');
      await racePage.waitForFunction(id => window.__workerDelivered.includes(id), {}, clearId);
      assert.equal(await racePage.$eval('#verse-search-results', node => node.hidden), true);
      await fill(racePage, '#verse-search', 'الرحمن');
      await racePage.waitForFunction(() => window.__workerSent.filter(message => message.query === 'الرحمن').length >= 3);
      const dismissId = await racePage.evaluate(() => window.__workerSent.at(-1).id);
      await racePage.click('#exam-heading');
      await racePage.waitForFunction(id => window.__workerDelivered.includes(id), {}, dismissId);
      assert.equal(await racePage.$eval('#verse-search-results', node => node.hidden), true);
      await searchVerse(racePage, 'الحمد لله رب العالمين', '1:2');
      await racePage.$$eval('#verse-search-results .search-result', buttons => buttons.at(-1).focus());
      await racePage.keyboard.press('Tab');
      assert.equal(await racePage.$eval('#verse-search-results', node => node.hidden), true, 'Tab out closes results');
      await searchVerse(racePage, 'الحمد لله رب العالمين', '1:2');
      await racePage.click('#verse-search');
      await racePage.keyboard.press('ArrowDown');
      await racePage.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.equal(await racePage.$eval('#verse-search-results', node => node.hidden), true, 'Escape must not reopen through input focus');
    } finally { await racePage.close(); }
  });

  await t.test('invalid negative, decimal, unsafe and native badInput counts show exact nearby errors, never silently truncate or copy', async () => {
    await fresh(page);
    await fill(page, markSelector(), 0);
    await calculateScore(page, 100);
    for (const value of ['-1', '1.9', '1e2', '9007199254740992']) {
      await fill(page, markSelector(), value);
      assert.equal(await page.$eval(markSelector(), input => input.getAttribute('aria-invalid')), 'true');
      await assertUncalculated(page, value);
      assert.equal(await visible(page, '#cancel-incomplete'), true);
      assert.ok((await page.$eval('#exam-error', node => node.textContent)).trim());
      const validation = await page.$eval(markSelector(), input => {
        const error = document.querySelector('.field-error[data-row="0"][data-field="corrections"]');
        return { value: input.value, message: error?.textContent.trim(), linked: Boolean(error?.id && input.getAttribute('aria-describedby')?.split(/\s+/u).includes(error.id)), sameCell: error?.closest('td') === input.closest('td') };
      });
      assert.equal(validation.value, value, 'invalid value remains visible without coercion');
      assert.equal(validation.message, 'يجب إدخال عدد صحيح غير سالب (0 أو أكبر).');
      assert.equal(validation.linked, true);
      assert.equal(validation.sameCell, true, 'error belongs to the affected marking field');
    }
    await fill(page, markSelector(), '');
    await page.click(markSelector());
    await page.keyboard.type('e');
    assert.equal(await page.$eval(markSelector(), input => input.validity.badInput), true, 'fixture uses actual invalid browser input');
    assert.equal(await page.$eval(markSelector(), input => input.getAttribute('aria-invalid')), 'true');
    await assertUncalculated(page, 'native nonnumeric badInput');
    assert.equal(await visible(page, '#cancel-incomplete'), true);
    await fill(page, markSelector(), 2);
    await calculateScore(page, 96);
    assert.equal(await page.$eval(markSelector(), input => input.getAttribute('aria-invalid')), 'false');
    assert.equal(await visible(page, '.field-error[data-row="0"][data-field="corrections"]'), false);
  });

  await t.test('320/390 mobile improvements stay local; 768/1024/1440 retain original tablet/desktop metrics', async () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1, isMobile: width < 769, hasTouch: width < 769 });
      await fresh(page);
      await openExam(page, 'quiz-positions');
      const metrics = await page.evaluate(() => {
        const input = document.querySelector('#marks-body input');
        const box = input.getBoundingClientRect();
        const table = document.querySelector('.table-scroll');
        return {
          pageWidth: document.documentElement.scrollWidth, viewport: innerWidth,
          inputWidth: box.width, inputHeight: box.height,
          font: Number.parseFloat(getComputedStyle(input).fontSize),
          headerFont: Number.parseFloat(getComputedStyle(document.querySelector('#marks-head th')).fontSize),
          inputPadding: Number.parseFloat(getComputedStyle(input).paddingInlineStart),
          cellPadding: Number.parseFloat(getComputedStyle(document.querySelector('#marks-head th')).paddingInlineStart),
          navPadding: Number.parseFloat(getComputedStyle(document.querySelector('.main-nav button')).paddingInlineStart),
          localWidth: table.clientWidth, localScrollWidth: table.scrollWidth,
          missingLabels: [...document.querySelectorAll('input,select')].filter(element => !element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')).map(element => element.id),
        };
      });
      assert.ok(metrics.pageWidth <= metrics.viewport + 1, `${width}: document overflow ${JSON.stringify(metrics)}`);
      if (width <= 576) {
        assert.ok(metrics.inputWidth >= 44 && metrics.inputHeight >= 44, `${width}: touch target ${JSON.stringify(metrics)}`);
        assert.ok(metrics.font >= 16, `${width}: input font ${metrics.font}`);
        assert.ok(metrics.headerFont >= 13, `${width}: compressed table headers`);
        assert.ok(metrics.inputPadding >= 8 && metrics.cellPadding >= 12, `${width}: cramped mobile control/cell padding ${JSON.stringify(metrics)}`);
      } else {
        assert.equal(metrics.inputWidth, width === 768 ? 50 : 70, `${width}: original input width`);
        assert.ok(metrics.inputHeight >= (width === 768 ? 39 : 46), `${width}: original input height`);
        assert.equal(metrics.font, width === 768 ? 14 : 16, `${width}: original input font`);
      }
      assert.deepEqual(metrics.missingLabels, []);
      await fill(page, markSelector(), 6);
      await calculateScore(page, 88);
      const warningLayout = await page.$eval('#failure-alert', node => {
        const box = node.getBoundingClientRect();
        const heading = node.querySelector('.failure-heading');
        const copy = document.querySelector('#copy-result');
        return { left: box.left, right: box.right, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
          heading: heading.textContent.trim(), font: parseFloat(getComputedStyle(heading).fontSize),
          copyInsideCell: Boolean(copy.closest('.score-cell')?.querySelector('#total-result')) };
      });
      assert.ok(warningLayout.left >= -1 && warningLayout.right <= warningLayout.width + 1 && !warningLayout.overflow, `${width}: live failure fits viewport ${JSON.stringify(warningLayout)}`);
      assert.equal(warningLayout.heading, 'راسب');
      assert.ok(warningLayout.font >= 20 && warningLayout.copyInsideCell, `${width}: readable warning and adjacent copy`);
      await fill(page, markSelector(), '-1');
      await assertUncalculated(page, `${width}: invalid draft`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}: field validation must not widen the document`);
      await fill(page, markSelector(), 6);
      if (width <= 576) {
        assert.ok(metrics.localScrollWidth > metrics.localWidth, `${width}: table must scroll locally instead of shrinking`);
        const target = await page.evaluate(() => {
          const input = [...document.querySelectorAll('#marks-body input')].find(element => {
            const rect = element.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= innerWidth;
          });
          input?.scrollIntoView({ block: 'center', inline: 'nearest' });
          const rect = input?.getBoundingClientRect();
          return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
        });
        assert.ok(target, `${width}: visible numeric input`);
        await page.touchscreen.tap(target.x, target.y);
        assert.equal(await page.evaluate(() => document.activeElement.matches('#marks-body input')), true);
        await openExam(page, 'consolidation');
        const bonus = await page.evaluate(() => ({
          font: parseFloat(getComputedStyle(document.querySelector('.bonus-table th')).fontSize),
          cellFont: parseFloat(getComputedStyle(document.querySelector('.bonus-table td')).fontSize),
          target: document.querySelector('.checkbox-container').getBoundingClientRect().height,
          pageWidth: document.documentElement.scrollWidth,
        }));
        assert.ok(bonus.font >= 13 && bonus.cellFont >= 13 && bonus.target >= 44, `${width}: bonus readability ${JSON.stringify(bonus)}`);
        assert.ok(bonus.pageWidth <= width + 1, `${width}: bonus overflow`);
      }
    }
    await page.setViewport({ width: 390, height: 620, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await fresh(page);
    await page.click('#surah-input');
    const comboboxBounds = await page.$eval('#surah-options', element => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportTop: visualViewport.offsetTop, viewportBottom: visualViewport.offsetTop + visualViewport.height };
    });
    assert.ok(comboboxBounds.top >= comboboxBounds.viewportTop && comboboxBounds.bottom <= comboboxBounds.viewportBottom, `mobile Surah popup: ${JSON.stringify(comboboxBounds)}`);
    await escapeAndSettle(page);
    await searchVerse(page, 'الرحمن', '2:163');
    const searchBounds = await page.$eval('#verse-search-results', element => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportTop: visualViewport.offsetTop, viewportBottom: visualViewport.offsetTop + visualViewport.height };
    });
    assert.ok(searchBounds.top >= searchBounds.viewportTop && searchBounds.bottom <= searchBounds.viewportBottom, `mobile search popup: ${JSON.stringify(searchBounds)}`);
    await page.setViewport({ width: 390, height: 380, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.waitForFunction(() => {
      const input = document.querySelector('#verse-search').getBoundingClientRect();
      const popup = document.querySelector('#verse-search-results').getBoundingClientRect();
      const nav = document.querySelector('.main-navigation').getBoundingClientRect();
      return input.top >= Math.max(12, nav.top <= 12 ? nav.bottom : 0)
        && input.bottom < visualViewport.height && popup.top >= nav.bottom
        && popup.bottom <= visualViewport.height;
    }, { timeout: 5000 });
    await page.setViewport({ width: 1440, height: 1000, isMobile: false, hasTouch: false });
  });

  await t.test('new controls use the original transition timing without continuous motion and remain keyboard-focusable', async () => {
    await fresh(page);
    await fill(page, markSelector(), 0);
    for (const selector of ['#copy-result', '#reset-marks', '#surah-input', '#cross-surah']) {
      const transition = await page.$eval(selector, node => {
        const css = getComputedStyle(node);
        return { duration: css.transitionDuration, timing: css.transitionTimingFunction, animations: node.getAnimations().filter(animation => animation.effect.getTiming().iterations === Infinity).length };
      });
      assert.ok(transition.duration.split(', ').every(duration => duration === '0.3s'), `${selector}: ${JSON.stringify(transition)}`);
      assert.ok(transition.timing.split(/(?<=\)), /u).every(easing => easing === 'cubic-bezier(0.4, 0, 0.2, 1)'), `${selector}: original easing`);
      assert.equal(transition.animations, 0);
    }
    await page.click('#surah-input');
    const option = await page.$eval('#surah-options .surah-option', node => ({ duration: getComputedStyle(node).transitionDuration, timing: getComputedStyle(node).transitionTimingFunction }));
    assert.ok(option.duration.includes('0.3s'));
    assert.ok(option.timing.includes('cubic-bezier(0.4, 0, 0.2, 1)'));
    await escapeAndSettle(page);
    await page.click('#reset-marks');
    for (const selector of ['#confirm-reset', '#cancel-reset']) {
      const transition = await page.$eval(selector, node => ({ duration: getComputedStyle(node).transitionDuration, timing: getComputedStyle(node).transitionTimingFunction }));
      assert.ok(transition.duration.includes('0.3s'));
      assert.ok(transition.timing.includes('cubic-bezier(0.4, 0, 0.2, 1)'));
    }
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement.matches('#confirm-reset,#cancel-reset')));
    await escapeAndSettle(page);
  });

  await t.test('original motion remains under reduced motion; search jumps stay instant and verses plus every displayed Surah title use actual local Noto', async () => {
    await page.setViewport({ width: 1440, height: 1000, isMobile: false, hasTouch: false });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await fresh(page);
    await page.evaluate(() => {
      window.__scrollRequests = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (options) { window.__scrollRequests.push(options); return original.call(this, options); };
    });
    await searchVerse(page, 'الحمد لله رب العالمين', '1:2');
    await page.click('#verse-search-results [data-verse-key="1:2"]');
    await page.waitForSelector('#quran-page .quran-text');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => window.__scrollRequests.some(options => options?.behavior === 'smooth')), false);
    const running = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').map(animation => animation.animationName));
    for (const name of ['backgroundShimmer', 'floatParticle', 'floatCrown', 'pulseGlow', 'rotateRing', 'logoFloat']) assert.ok(running.includes(name), `original ${name} must remain unchanged`);
    const client = await page.createCDPSession();
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument');
    const assertNoto = async selector => {
      const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
      assert.ok(fonts.some(font => font.isCustomFont && /Noto/u.test(font.familyName) && font.glyphCount > 0), `${selector}: ${JSON.stringify(fonts)}`);
      assert.ok(!fonts.some(font => !font.isCustomFont && font.glyphCount > 0), `${selector}: unexpected fallback glyphs ${JSON.stringify(fonts)}`);
      assert.ok((await page.$eval(selector, node => getComputedStyle(node).fontFamily)).startsWith('"Teijan Quran"'), 'computed alias is pinned local Noto');
    };
    await assertNoto('#quran-page .quran-text');
    await assertNoto('#quran-page .quran-surah-name');
    await displayRange(page, 112, 1, 4);
    await page.click('#cross-surah');
    await chooseSurah(page, 114, true);
    await fill(page, '#cross-end-ayah', 6);
    await page.click('#load-verses');
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(await page.$$eval('#quran-page .quran-surah-name', nodes => nodes.map(node => node.textContent)), data.surahs.slice(111).map(surah => surah.name), 'all title diacritics remain exact');
    for (let i = 1; i <= 3; i++) await assertNoto(`#quran-page .quran-surah-header:nth-of-type(${i}) .quran-surah-name`);
    for (const selector of ['#surah-input', '.brand-name', '.nav-tab']) {
      assert.ok(!/Teijan Quran|Noto Sans Arabic/u.test(await page.$eval(selector, node => getComputedStyle(node).fontFamily)), `${selector}: general UI typography unchanged`);
    }
    await client.detach();
    await page.emulateMediaFeatures([]);
  });

  await t.test('empty search states have readable insets and instructions keep a sequential heading outline', async () => {
    await fresh(page);
    assert.equal(await page.$('.source-note'), null, 'source footer is removed from main reader');
    await fill(page, '#surah-input', 'zzzzzz');
    assert.ok(await page.$eval('#surah-options .no-options', node => parseFloat(getComputedStyle(node).paddingInlineStart) >= 12));
    await searchVerse(page, 'zzzzzz');
    assert.ok(await page.$eval('#verse-search-results .search-empty', node => parseFloat(getComputedStyle(node).paddingInlineStart) >= 12));
    await fill(page, markSelector(), 2);
    await page.evaluate(() => { window.__beforeGuideMushaf = document.querySelector('#shared-mushaf'); });
    const guideTargetPromise = browser.waitForTarget(target => target.url() === new URL('/instructions.html', baseURL).href, { timeout: 10000 });
    await page.click('#instructions-button');
    const guideTab = await (await guideTargetPromise).page();
    await guideTab.waitForSelector('.header-icon');
    assert.equal(await page.$eval(markSelector(), input => input.value), '2', 'instructions must not reload the marking draft');
    assert.equal(await page.evaluate(() => window.__beforeGuideMushaf === document.querySelector('#shared-mushaf')), true);
    await guideTab.close();
    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 1000, isMobile: false, hasTouch: false });
      await page.goto(new URL('/instructions.html', baseURL).href, { waitUntil: 'domcontentloaded' });
      const outline = await page.evaluate(() => ({
        levels: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(heading => Number(heading.tagName[1])),
        points: [...document.querySelectorAll('.instruction-points')].map(node => node.textContent.trim()),
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.deepEqual(outline.levels, [1, 2, 2, 2, 2, 2, 2, 2]);
      assert.deepEqual(outline.points, ['-0.1', '-0.5', '-2', '-1', '-2']);
      assert.equal(outline.overflow, false, `instructions overflow at ${width}`);
      assert.equal(await page.$('#text-sources'), null, 'the text sources section was removed from the guide');
    }
  });

  await t.test('there are no uncaught browser application errors', () => assert.deepEqual(pageErrors, []));
});

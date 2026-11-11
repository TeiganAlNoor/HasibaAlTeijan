import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createNavigation, getNavigationPage, stepNavigation, returnToSelection,
} from '../js/quran-navigation.mjs';

const data = JSON.parse(await readFile(new URL('../assets/quran/quran.json', import.meta.url)));
const verses = data.surahs.flatMap(surah => surah.ayahs.map(ayah => ({
  surah: surah.number, ayah: ayah.number, text: ayah.text,
})));
const position = (surah, ayah) => verses.findIndex(verse => verse.surah === surah && verse.ayah === ayah);
const keys = state => {
  const { start, end } = getNavigationPage(state);
  return verses.slice(start, end + 1).map(verse => `${verse.surah}:${verse.ayah}`);
};

test('seven-Ayah group moves from Al-Fatiha into Al-Baqara, not by one Ayah', () => {
  const initial = createNavigation(0, 6, verses.length);
  assert.equal(initial.groupLength, 7);
  assert.equal(initial.canPrevious, false);
  assert.equal(initial.canNext, true);
  assert.deepEqual(keys(initial), ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7']);
  const next = stepNavigation(initial, 1);
  assert.deepEqual(keys(next), ['2:1', '2:2', '2:3', '2:4', '2:5', '2:6', '2:7']);
  assert.equal(next.canPrevious, true);
  assert.deepEqual(getNavigationPage(stepNavigation(next, -1)), { start: 0, end: 6 });
  assert.deepEqual(getNavigationPage(stepNavigation(initial, -1)), { start: 0, end: 6 });
  assert.equal(initial.pageIndex, 0);
  assert.ok(Object.isFrozen(initial));
});

test('23 selected Ayahs display together; adjacent groups stay 20 and return to the complete selection', () => {
  const initial = createNavigation(100, 122, verses.length);
  const beyond = stepNavigation(initial, 1);
  assert.deepEqual(getNavigationPage(initial), { start: 100, end: 122 });
  assert.deepEqual(getNavigationPage(beyond), { start: 123, end: 142 });
  assert.deepEqual(getNavigationPage(stepNavigation(beyond, -1)), { start: 100, end: 122 });
  assert.deepEqual(getNavigationPage(stepNavigation(beyond, 1)), { start: 143, end: 162 });
  assert.equal(beyond.groupLength, 20);
  assert.equal(beyond.start, 100);
  assert.equal(beyond.end, 122);
});

test('previous boundary extends before the selected range and reverses to its original first page', () => {
  const initial = createNavigation(35, 57, verses.length);
  const previous = stepNavigation(initial, -1);
  assert.deepEqual(getNavigationPage(previous), { start: 15, end: 34 });
  const first = stepNavigation(previous, -1);
  assert.deepEqual(getNavigationPage(first), { start: 0, end: 14 });
  assert.equal(first.canPrevious, false);
  assert.deepEqual(getNavigationPage(stepNavigation(first, 1)), { start: 15, end: 34 });
  assert.deepEqual(getNavigationPage(stepNavigation(previous, 1)), { start: 35, end: 57 });
});

test('cross-Surah selection traverses complete middle Surahs without gaps or repeated Ayahs', () => {
  const first = position(110, 1);
  const last = position(114, 6);
  let state = createNavigation(first, last, verses.length);
  const seen = [];
  while (true) {
    const { start, end } = getNavigationPage(state);
    seen.push(...verses.slice(start, end + 1));
    if (!state.canNext) break;
    state = stepNavigation(state, 1);
  }
  assert.equal(seen.length, 23);
  assert.deepEqual(seen, verses.slice(first, last + 1));
  assert.deepEqual([...new Set(seen.map(verse => verse.surah))], [110, 111, 112, 113, 114]);
  assert.equal(state.canNext, false);
  assert.equal(getNavigationPage(state).end, 6235);
  assert.deepEqual(getNavigationPage(stepNavigation(state, 1)), getNavigationPage(state));
  assert.deepEqual(getNavigationPage(state), { start: first, end: last });
});

test('navigation continues beyond an originally selected cross-Surah range into the rest of the Mushaf', () => {
  const initial = createNavigation(position(2, 280), position(3, 16), verses.length);
  const second = stepNavigation(initial, 1);
  const after = second;
  assert.equal(keys(initial).length, 23);
  assert.equal(keys(after).length, 20);
  assert.equal(keys(after)[0], '3:17');
  assert.equal(keys(after).at(-1), '3:36');
  assert.deepEqual(keys(stepNavigation(after, -1)), keys(initial));
});

test('short final Quran page does not shrink intended group length when moving back', () => {
  const initial = createNavigation(position(113, 1), position(113, 5), verses.length);
  const next = stepNavigation(initial, 1);
  const final = stepNavigation(next, 1);
  assert.deepEqual(keys(next), ['114:1', '114:2', '114:3', '114:4', '114:5']);
  assert.deepEqual(keys(final), ['114:6']);
  assert.equal(final.groupLength, 5);
  assert.equal(final.canNext, false);
  assert.deepEqual(keys(stepNavigation(final, -1)), keys(next));
  assert.deepEqual(keys(stepNavigation(stepNavigation(final, -1), -1)), keys(initial));
});

test('forward/backward page partition covers every Quran Ayah once, including clipped first/last groups', () => {
  const initial = createNavigation(35, 57, verses.length);
  let state = stepNavigation(initial, -Number.MAX_SAFE_INTEGER);
  const covered = [];
  const pages = [];
  while (true) {
    const page = getNavigationPage(state);
    pages.push(page);
    for (let index = page.start; index <= page.end; index += 1) covered.push(index);
    if (!state.canNext) break;
    state = stepNavigation(state, 1);
  }
  assert.deepEqual(covered, Array.from({ length: verses.length }, (_, index) => index));
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    assert.deepEqual(getNavigationPage(state), pages[index]);
    state = stepNavigation(state, -1);
  }
});

test('single verse, exact 20-Ayah selection, whole Quran and one-item dataset handle boundaries', () => {
  assert.deepEqual(getNavigationPage(stepNavigation(createNavigation(6, 6, verses.length), 1)), { start: 7, end: 7 });
  const exact = createNavigation(100, 119, verses.length);
  assert.deepEqual(getNavigationPage(stepNavigation(exact, 1)), { start: 120, end: 139 });
  const all = createNavigation(0, verses.length - 1, verses.length);
  const last = stepNavigation(all, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(getNavigationPage(last), { start: 0, end: 6235 });
  assert.equal(last.canNext, false);
  const only = createNavigation(0, 0, 1);
  assert.equal(only.canNext, false);
  assert.equal(only.canPrevious, false);
  assert.deepEqual(getNavigationPage(stepNavigation(only, 999)), { start: 0, end: 0 });
});

test('direct return restores the same entire selected range from any browsed location', () => {
  const selected = createNavigation(150, 594, verses.length);
  assert.equal(keys(selected).length, 445);
  for (const delta of [-10000, -2, 1, 10000]) {
    const browsed = stepNavigation(selected, delta);
    const returned = returnToSelection(browsed);
    assert.deepEqual(getNavigationPage(returned), { start: 150, end: 594 });
    assert.equal(returned.pageIndex, 0);
    assert.equal(browsed.start, selected.start);
    assert.equal(browsed.end, selected.end);
  }
});

test('invalid indexes/page sizes and noninteger movement are rejected, never silently normalized', () => {
  for (const args of [[-1, 2, 10], [3, 2, 10], [0, 10, 10], [0, 0, 0], [0, 1, 10, 0], [0.5, 2, 10], [0, 2, Infinity]]) {
    assert.throws(() => createNavigation(...args), RangeError);
  }
  const state = createNavigation(0, 2, 10);
  for (const delta of [NaN, Infinity, -0.5, '1']) assert.throws(() => stepNavigation(state, delta), RangeError);
});

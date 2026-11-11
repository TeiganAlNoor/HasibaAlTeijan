import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  normalizeName, normalizeQuran, normalizeWithOffsets, alignSpellings,
  validateDataset, buildIndex, search,
} from '../js/quran-search.mjs';

const bytes = await readFile(new URL('../assets/quran/quran.json', import.meta.url));
const data = JSON.parse(bytes);
const manifest = JSON.parse(await readFile(new URL('../assets/quran/manifest.json', import.meta.url)));
const index = buildIndex(data);
const sha = value => createHash('sha256').update(value).digest('hex');

test('pinned data bytes and every untouched original verse match the source manifest', () => {
  assert.equal(sha(bytes), manifest.dataset.sha256);
  assert.equal(bytes.length, manifest.dataset.bytes);
  const originalVerses = data.surahs.flatMap(surah => surah.ayahs.map(ayah => [surah.number, ayah.number, ayah.text]));
  assert.equal(sha(JSON.stringify(originalVerses)), manifest.originalVersesSha256);
  assert.deepEqual(manifest.sources.map(source => source.identifier), ['quran-uthmani', 'quran-simple-clean']);
});

test('canonical complete dataset: 114 Surahs, 6236 verse keys, sequential original order', () => {
  assert.equal(validateDataset(data), 6236);
  assert.equal(index.surahs.length, 114);
  assert.equal(index.verses.length, 6236);
  assert.equal(index.byKey.size, 6236);
  assert.equal(index.byKey.get('1:1').text, data.surahs[0].ayahs[0].text);
  assert.equal(index.byKey.get('114:6').text, data.surahs[113].ayahs[5].text);
  assert.throws(() => validateDataset({ ...data, surahs: data.surahs.slice(1) }), /114/);
  const incomplete = structuredClone(data);
  incomplete.surahs[0].ayahs.pop();
  assert.throws(() => validateDataset(incomplete), /count/);
});

test('all 114 Surah names are browsable and permissive name policy accepts requested spellings', () => {
  assert.equal(index.surahs.filter(surah => normalizeName(surah.name).includes(normalizeName(''))).length, 114);
  for (const [query, number] of [['ال عمران', 3], ['الاعراف', 7], ['الانبياء', 21], ['الضحي', 93], ['الفاتحه', 1]]) {
    assert.ok(index.surahs.filter(surah => normalizeName(surah.name).includes(normalizeName(query))).some(surah => surah.number === number), query);
  }
  assert.ok(index.surahs.filter(surah => normalizeName(surah.name).includes(normalizeName('عمر'))).some(surah => surah.number === 3));
  assert.equal(normalizeName('سُورَةُ ٱلْفَاتِحَةِ'), 'الفاتحه');
});

test('normalization removes marks/invisibles and handles Unicode without deleting Quranic Hamza or folding ة into ه', () => {
  assert.equal(normalizeQuran(' \uFEFF\u200Fإِيَّاكَ\u2067 نَعْبُدُ\u2069 '), 'اياك نعبد');
  assert.equal(normalizeQuran('إِيَّاكَ'.normalize('NFD')), normalizeQuran('إِيَّاكَ'.normalize('NFC')));
  assert.equal(normalizeQuran('ٱلْحَمْدُـ'), 'الحمد');
  assert.equal(normalizeQuran('الضُّحَىٰ'), 'الضحي');
  assert.notEqual(normalizeQuran('شيء'), normalizeQuran('شي'));
  assert.notEqual(normalizeQuran('مسؤول'), normalizeQuran('مسوول'));
  assert.notEqual(normalizeQuran('بئر'), normalizeQuran('بير'));
  assert.notEqual(normalizeQuran('رحمة'), normalizeQuran('رحمه'));
  assert.equal(normalizeName('رحمة'), normalizeName('رحمه'));
  assert.equal(normalizeQuran('الله'), normalizeQuran('ﷲ'));
  const smallYeh = normalizeWithOffsets('رَبِّهِۦ');
  assert.equal(smallYeh.text, 'ربه');
  assert.equal(smallYeh.offsets.at(-1).end, 'رَبِّهِۦ'.length);
});

test('all 6236 independently paired spellings have safe, ordered, original grapheme offsets', () => {
  assert.equal(index.diagnostics.pairs, 6236);
  assert.ok(index.diagnostics.minimumSimilarity >= 0.77);
  const boundaries = new Intl.Segmenter('ar', { granularity: 'grapheme' });
  for (const verse of index.verses) {
    const starts = new Set();
    const ends = new Set();
    for (const part of boundaries.segment(verse.text)) {
      starts.add(part.index);
      ends.add(part.index + part.segment.length);
    }
    for (const representation of [verse.raw, verse.simple]) {
      assert.equal(representation.text.length, representation.offsets.length, `${verse.surah}:${verse.ayah}`);
      let previous = -1;
      for (const span of representation.offsets) {
        assert.ok(span.start >= previous && span.end > span.start && span.end <= verse.text.length);
        assert.ok(starts.has(span.start) && ends.has(span.end), `split grapheme at ${verse.surah}:${verse.ayah}`);
        previous = span.start;
      }
    }
    assert.equal(verse.simple.offsets[0].start, verse.raw.offsets[0].start);
    assert.equal(verse.simple.offsets.at(-1).end, verse.raw.offsets.at(-1).end);
  }
  assert.throws(() => alignSpellings('الحمد لله رب العالمين', 'كتب عليكم الصيام'), /Unsafe/);
});

test('full local search is unaffected by partial display caches and deduplicates representations', () => {
  const results = search(index, 'الرحمن');
  assert.equal(results.length, 159);
  assert.ok(results.some(result => result.surah > 1));
  assert.equal(new Set(results.map(result => `${result.surah}:${result.ayah}`)).size, results.length);
  const firstSurahMatches = results.filter(result => result.surah === 1);
  assert.equal(firstSurahMatches.length, 2);
  assert.deepEqual(search(index, '\u200F\u064E\u0640'), []);
  assert.deepEqual(search(index, 'هذا النص ليس من آيات القرآن'), []);
});

test('Uthmani and Imlai phrases map accurately back to exact original text and diacritics', () => {
  const verse = search(index, 'العالمين').find(result => result.surah === 1 && result.ayah === 2);
  assert.ok(verse);
  assert.equal(verse.ranges.length, 1);
  assert.equal(verse.text.slice(verse.ranges[0].start, verse.ranges[0].end), 'ٱلْعَٰلَمِينَ');
  const kursi = search(index, 'الله لا إله إلا هو الحي القيوم').find(result => result.surah === 2 && result.ayah === 255);
  assert.ok(kursi);
  assert.equal(kursi.text.slice(kursi.ranges[0].start, kursi.ranges[0].end), 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ');
  const initialHamza = search(index, 'آمن الرسول').find(result => result.surah === 2 && result.ayah === 285);
  assert.equal(initialHamza.ranges[0].start, 0);
  assert.ok(initialHamza.text.slice(0, initialHamza.ranges[0].end).startsWith('ءَامَنَ'));
  const uthmaniQuery = data.surahs[0].ayahs[1].text;
  assert.ok(search(index, uthmaniQuery).some(result => result.surah === 1 && result.ayah === 2));
  const vocative = search(index, 'يا').find(result => result.surah === 2 && result.ayah === 282);
  assert.equal(vocative.text.slice(vocative.ranges[0].start, vocative.ranges[0].end), 'يَٰٓ');
});

test('phrase highlighting does not highlight unrelated repeats or cut off long-verse matches', () => {
  const original = 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ٱلرَّحْمَٰنِ';
  const synthetic = {
    verses: [{ surah: 1, ayah: 1, surahName: 'اختبار', text: original,
      raw: normalizeWithOffsets(original), simple: alignSpellings(original, 'الرحمن الرحيم الرحمن') }],
  };
  const [result] = search(synthetic, 'الرحمن الرحيم');
  assert.equal(result.ranges.length, 1);
  assert.equal(original.slice(result.ranges[0].start, result.ranges[0].end), 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
  const longVerse = search(index, 'ولا يضار كاتب ولا شهيد').find(result => result.surah === 2 && result.ayah === 282);
  assert.ok(longVerse);
  assert.ok(longVerse.text.length > 500);
  assert.ok(longVerse.ranges[0].start > 80);
  assert.equal(longVerse.text, data.surahs[1].ayahs[281].text);
});

test('indexing and repeated searches never change an authentic source string or its ordering', () => {
  for (const query of ['الرحمن', 'العالمين', 'آمن الرسول', 'ولا يضار كاتب ولا شهيد', 'شيء']) search(index, query);
  assert.equal(sha(JSON.stringify(data)), manifest.dataset.sha256);
  for (const verse of index.verses) assert.equal(verse.text, data.surahs[verse.surah - 1].ayahs[verse.ayah - 1].text);
});

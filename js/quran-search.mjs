/**
 * Read-only Quran search. Normalization never changes the text we display.
 * Name matching is intentionally more permissive than Quran phrase matching.
 */
const segments = new Intl.Segmenter('ar', { granularity: 'grapheme' });
const ignored = /[\p{M}\p{Cf}\u0640\u06D6-\u06ED\u08D3-\u08FF]/gu;
const whiteSpace = /\s/u;

function foldCluster(cluster) {
  return cluster.normalize('NFKC').replace(ignored, '')
    .replace(/[آأإٱ]/gu, 'ا').replace(/[ىی]/gu, 'ي').replace(/ک/gu, 'ك');
}

/** Normalize while retaining UTF-16 spans of the ORIGINAL grapheme clusters. */
export function normalizeWithOffsets(value) {
  const original = String(value ?? '');
  let text = '';
  const offsets = [];
  for (const { segment, index } of segments.segment(original)) {
    const folded = foldCluster(segment);
    // Unicode classifies the Quran's small waw/yeh as modifier letters, not
    // combining marks, so Intl.Segmenter gives them separate clusters. They
    // still annotate the previous letter and should share its highlight.
    if (!folded && /^[\u06E5\u06E6]+$/u.test(segment) && offsets.length && !text.endsWith(' ')) {
      offsets.at(-1).end = index + segment.length;
    }
    for (const character of folded) {
      if (whiteSpace.test(character)) {
        if (!text || text.endsWith(' ')) continue;
        text += ' ';
      } else {
        text += character;
      }
      // All Quran letters in this edition are BMP. Keeping one entry per UTF-16
      // unit also makes this helper correct for pasted supplementary characters.
      for (let unit = 0; unit < character.length; unit++) {
        offsets.push({ start: index, end: index + segment.length });
      }
    }
  }
  if (text.endsWith(' ')) { text = text.slice(0, -1); offsets.pop(); }
  return { text, offsets };
}

export function normalizeQuran(value) { return normalizeWithOffsets(value).text; }

export function normalizeName(value) {
  return normalizeQuran(value).replace(/ة/gu, 'ه').replace(/^سوره\s+/u, '');
}

/**
 * Align two spellings of ONE independently validated verse, never two verses.
 * A minimal-edit alignment handles omitted Uthmani alefs, joined words, etc.
 * Every simplified character gets an original grapheme span; inserted letters
 * attach to their nearest original letter in that word, not the next word.
 */
export function alignSpellings(raw, simplified) {
  const source = normalizeWithOffsets(raw);
  const target = normalizeQuran(simplified);
  const a = source.text;
  const b = target;
  if (!a || !b) throw new Error('Cannot align an empty Quran verse.');
  const width = b.length + 1;
  const matrix = new Uint16Array((a.length + 1) * width);
  for (let i = 0; i <= a.length; i++) matrix[i * width] = i;
  for (let j = 0; j <= b.length; j++) matrix[j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const same = a[i - 1] === b[j - 1];
      // Spaces delimit words; making a letter/space substitution expensive
      // avoids shifting a phrase boundary into an adjacent Quranic word.
      const substitution = same ? 0 : (a[i - 1] === ' ' || b[j - 1] === ' ' ? 3 : 1);
      matrix[i * width + j] = Math.min(
        matrix[(i - 1) * width + j - 1] + substitution,
        matrix[(i - 1) * width + j] + 1,
        matrix[i * width + j - 1] + 1,
      );
    }
  }
  const map = Array(b.length).fill(null);
  const deleted = [];
  let i = a.length;
  let j = b.length;
  let equalCharacters = 0;
  while (i || j) {
    const same = i && j && a[i - 1] === b[j - 1];
    const substitution = same ? 0 : (i && j && (a[i - 1] === ' ' || b[j - 1] === ' ') ? 3 : 1);
    if (i && j && matrix[i * width + j] === matrix[(i - 1) * width + j - 1] + substitution) {
      map[j - 1] = { ...source.offsets[i - 1] };
      if (same) equalCharacters++;
      i--; j--;
    } else if (i && matrix[i * width + j] === matrix[(i - 1) * width + j] + 1) {
      deleted.push({ source: i - 1, target: j });
      i--;
    } else {
      j--;
    }
  }
  for (let position = 0; position < map.length; position++) {
    if (map[position]) continue;
    let before = position - 1;
    let after = position + 1;
    while (before >= 0 && !map[before] && b[before] !== ' ') before--;
    while (after < map.length && !map[after] && b[after] !== ' ') after++;
    const left = before >= 0 && b[before] !== ' ' ? map[before] : null;
    const right = after < map.length && b[after] !== ' ' ? map[after] : null;
    const nearest = left || right || source.offsets[0];
    map[position] = { ...nearest };
  }
  // Original letters absent from Imlai spelling (notably an initial standalone
  // Hamza in ءامن) still belong in that word's highlighted original span.
  for (const item of deleted) {
    if (a[item.source] === ' ') continue;
    const atWordStart = item.source === 0 || a[item.source - 1] === ' ';
    const preferred = atWordStart ? item.target : item.target - 1;
    const alternate = atWordStart ? item.target - 1 : item.target;
    const position = preferred >= 0 && preferred < map.length && b[preferred] !== ' ' ? preferred : alternate;
    if (position >= 0 && position < map.length && b[position] !== ' ') {
      map[position].start = Math.min(map[position].start, source.offsets[item.source].start);
      map[position].end = Math.max(map[position].end, source.offsets[item.source].end);
    }
  }
  // Reject an unrelated or accidentally offset source, not merely verify counts.
  const distance = matrix[a.length * width + b.length];
  const similarity = equalCharacters / Math.max(a.length, b.length);
  if (similarity < 0.68 || distance / Math.max(a.length, b.length) > 0.34) {
    throw new Error(`Unsafe Quran spelling alignment (${similarity.toFixed(3)}).`);
  }
  for (const span of map) {
    if (!span || span.start < 0 || span.end <= span.start || span.end > raw.length) {
      throw new Error('Invalid original Quran offset.');
    }
  }
  return { text: b, offsets: map, distance, similarity };
}

export function validateDataset(data) {
  if (data?.schemaVersion !== 1 || data.surahs?.length !== 114) {
    throw new Error('Expected all 114 Surahs in the local Quran data.');
  }
  let count = 0;
  for (const [position, surah] of data.surahs.entries()) {
    if (surah.number !== position + 1 || surah.ayahs.length !== surah.numberOfAyahs) {
      throw new Error(`Invalid Surah order/count at ${position + 1}.`);
    }
    for (const [ayahPosition, ayah] of surah.ayahs.entries()) {
      if (ayah.number !== ayahPosition + 1 || typeof ayah.text !== 'string' || !ayah.text || typeof ayah.simple !== 'string' || !ayah.simple) {
        throw new Error(`Invalid verse at ${surah.number}:${ayahPosition + 1}.`);
      }
      count++;
    }
  }
  if (count !== 6236) throw new Error(`Expected 6236 verses; got ${count}.`);
  return count;
}

export function buildIndex(data) {
  validateDataset(data);
  const verses = [];
  const byKey = new Map();
  const surahs = data.surahs.map(({ ayahs, ...metadata }) => ({ ...metadata }));
  const diagnostics = { pairs: 0, minimumSimilarity: 1, maximumDistance: 0 };
  for (const surah of data.surahs) {
    for (const ayah of surah.ayahs) {
      let simple;
      try { simple = alignSpellings(ayah.text, ayah.simple); }
      catch (error) { throw new Error(`Quran pair ${surah.number}:${ayah.number}: ${error.message}`); }
      const verse = {
        surah: surah.number, ayah: ayah.number, surahName: surah.name,
        text: ayah.text, simpleText: ayah.simple,
        raw: normalizeWithOffsets(ayah.text), simple,
      };
      verses.push(verse);
      byKey.set(`${verse.surah}:${verse.ayah}`, verse);
      diagnostics.pairs++;
      diagnostics.minimumSimilarity = Math.min(diagnostics.minimumSimilarity, simple.similarity);
      diagnostics.maximumDistance = Math.max(diagnostics.maximumDistance, simple.distance);
    }
  }
  return { surahs, verses, byKey, diagnostics };
}

function occurrences(haystack, needle) {
  const positions = [];
  let offset = 0;
  while (offset <= haystack.length - needle.length) {
    const found = haystack.indexOf(needle, offset);
    if (found === -1) break;
    positions.push(found);
    offset = found + Math.max(1, needle.length);
  }
  return positions;
}

function originalRange(representation, start, length) {
  const spans = representation.offsets.slice(start, start + length);
  return { start: Math.min(...spans.map(span => span.start)), end: Math.max(...spans.map(span => span.end)) };
}

function mergeRanges(ranges) {
  const merged = [];
  for (const range of ranges.sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** Scan already normalized complete local indexes. No remote search or cache bias. */
export function search(index, query) {
  const needle = normalizeQuran(query);
  if (!needle) return [];
  const results = [];
  for (const verse of index.verses) {
    const ranges = occurrences(verse.simple.text, needle)
      .map(position => originalRange(verse.simple, position, needle.length));
    for (const position of occurrences(verse.raw.text, needle)) {
      const rawRange = originalRange(verse.raw, position, needle.length);
      // Prefer the independently aligned standard spelling for an overlapping
      // occurrence. In يَٰٓأَيُّهَا, for example, raw normalization makes ي + أ
      // look like "يا"; Imlai correctly maps the vocative يا to يَٰٓ alone.
      if (!ranges.some(range => rawRange.start < range.end && range.start < rawRange.end)) ranges.push(rawRange);
    }
    if (ranges.length) {
      results.push({ surah: verse.surah, ayah: verse.ayah, surahName: verse.surahName, text: verse.text, ranges: mergeRanges(ranges) });
    }
  }
  return results;
}

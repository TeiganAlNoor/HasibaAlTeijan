// No dependencies or network. Run: node assets/fonts/verify-font.mjs [quran.json]
// Defaults to the application's pinned, complete local Quran dataset.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const fontPath = new URL('./NotoSansArabic-v2.012-e5ee313.ttf', import.meta.url);
const expectedHash = '63111b5b2e074dd48cc67692e0a2726d86ee94c1c37fe8598257b7b4e87e869e';
const font = await fs.readFile(fontPath);
const hash = createHash('sha256').update(font).digest('hex');
if (hash !== expectedHash) throw new Error('Pinned font hash does not match.');

const tables = {};
for (let i = 0; i < font.readUInt16BE(4); i++) {
  const offset = 12 + i * 16;
  tables[font.toString('ascii', offset, offset + 4)] = font.readUInt32BE(offset + 8);
}
const cmap = tables.cmap;
const maps = [];
for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
  const offset = cmap + font.readUInt32BE(cmap + 8 + i * 8);
  const format = font.readUInt16BE(offset);
  if (format === 4 || format === 12) maps.push({ offset, format });
}
function glyphFor(codePoint) {
  for (const { offset, format } of maps) {
    if (format === 12) {
      for (let i = 0; i < font.readUInt32BE(offset + 12); i++) {
        const group = offset + 16 + i * 12;
        const start = font.readUInt32BE(group);
        const end = font.readUInt32BE(group + 4);
        if (codePoint >= start && codePoint <= end) {
          return font.readUInt32BE(group + 8) + codePoint - start;
        }
      }
    } else if (codePoint <= 0xffff) {
      const count = font.readUInt16BE(offset + 6) / 2;
      const end = offset + 14;
      const start = end + count * 2 + 2;
      const delta = start + count * 2;
      const range = delta + count * 2;
      for (let i = 0; i < count; i++) {
        if (codePoint < font.readUInt16BE(start + i * 2) || codePoint > font.readUInt16BE(end + i * 2)) continue;
        const adjustment = font.readInt16BE(delta + i * 2);
        const distance = font.readUInt16BE(range + i * 2);
        if (!distance) return (codePoint + adjustment) & 0xffff;
        const pointer = range + i * 2 + distance + (codePoint - font.readUInt16BE(start + i * 2)) * 2;
        const glyph = font.readUInt16BE(pointer);
        return glyph ? (glyph + adjustment) & 0xffff : 0;
      }
    }
  }
  return 0;
}

const response = JSON.parse(await fs.readFile(process.argv[2] || new URL('../quran/quran.json', import.meta.url), 'utf8'));
const surahs = (response.data || response).surahs;
if (!Array.isArray(surahs) || surahs.length !== 114) throw new Error('Expected the complete 114-Surah source.');
const verses = surahs.flatMap(surah => surah.ayahs);
if (verses.length !== 6236) throw new Error('Expected all 6236 verses.');
const codePoints = [...new Set(verses.flatMap(verse => [...verse.text].map(char => char.codePointAt(0))))].sort((a, b) => a - b);
const missing = codePoints.filter(point => !glyphFor(point));
const report = {
  font: 'Noto Sans Arabic', version: '2.012', sha256: hash,
  bytes: font.length, surahs: surahs.length, verses: verses.length,
  uniqueCodePoints: codePoints.length,
  codePoints: codePoints.map(point => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`),
  missing: missing.map(point => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`),
};
console.log(JSON.stringify(report, null, 2));
if (missing.length) process.exitCode = 1;

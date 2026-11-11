/** Explicit maintenance command: node --use-system-ca scripts/prepare-quran.mjs.
 * Downloads public text editions; never run automatically in the application.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildIndex } from '../js/quran-search.mjs';

const directory = fileURLToPath(new URL('../assets/quran/', import.meta.url));
const editions = ['quran-uthmani', 'quran-simple-clean'];
const copyrightNotice = `Tanzil Quran Text
Copyright (C) 2007-2021 Tanzil Project
License: Creative Commons Attribution 3.0

This copy of the Quran text is carefully produced, highly
verified and continuously monitored by a group of specialists
in Tanzil Project.

TERMS OF USE:

- Permission is granted to copy and distribute verbatim copies
  of this text, but CHANGING IT IS NOT ALLOWED.
- This Quran text can be used in any website or application,
  provided that its source (Tanzil Project) is clearly indicated,
  and a link is made to tanzil.net to enable users to keep
  track of changes.
- This copyright notice shall be included in all verbatim copies
  of the text, and shall be reproduced appropriately in all files
  derived from or containing substantial portion of this text.

Please check updates at: http://tanzil.net/updates/`;
const sources = await Promise.all(editions.map(async identifier => {
  const url = `https://api.alquran.cloud/v1/quran/${identifier}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const content = JSON.parse(bytes.toString('utf8'));
  if (content.code !== 200 || content.data.edition.identifier !== identifier) throw new Error(`Unexpected edition ${identifier}.`);
  return { identifier, url, bytes, content, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
const [uthmani, simple] = sources.map(source => source.content.data);
if (uthmani.surahs.length !== 114 || simple.surahs.length !== 114) throw new Error('Missing Surahs.');
const data = {
  schemaVersion: 1,
  attribution: {
    provider: 'AlQuran Cloud / Islamic Network',
    providerTerms: 'https://alquran.cloud/terms-and-conditions',
    upstreamAcknowledgement: 'Tanzil Project and Quran Academy, as acknowledged by the provider.',
    tanzilSource: 'https://tanzil.net/',
    tanzilLicense: 'https://tanzil.net/docs/text_license',
    copyrightNotice,
  },
  surahs: uthmani.surahs.map((surah, position) => {
  const partner = simple.surahs[position];
  if (surah.number !== partner.number || surah.ayahs.length !== partner.ayahs.length) throw new Error(`Source pair mismatch: ${surah.number}.`);
  return {
    number: surah.number, name: surah.name, englishName: surah.englishName,
    numberOfAyahs: surah.ayahs.length,
    ayahs: surah.ayahs.map((ayah, index) => {
      const matching = partner.ayahs[index];
      if (ayah.number !== matching.number || ayah.numberInSurah !== matching.numberInSurah) throw new Error(`Source verse pair mismatch: ${surah.number}:${ayah.numberInSurah}.`);
      return { number: ayah.numberInSurah, text: ayah.text, simple: matching.text };
    }),
  };
}) };
const index = buildIndex(data); // Refuse writing incomplete/misaligned source data.
const serialized = JSON.stringify(data);
const originalVerses = uthmani.surahs.flatMap(surah => surah.ayahs.map(ayah => [surah.number, ayah.numberInSurah, ayah.text]));
const manifest = {
  schemaVersion: 1, downloadedAt: new Date().toISOString(),
  sources: sources.map(({ identifier, url, bytes, sha256 }) => ({ identifier, url, bytes: bytes.length, sha256 })),
  dataset: { file: 'quran.json', sha256: createHash('sha256').update(serialized).digest('hex'), bytes: Buffer.byteLength(serialized), surahs: 114, verses: index.verses.length },
  originalVersesSha256: createHash('sha256').update(JSON.stringify(originalVerses)).digest('hex'),
  alignment: index.diagnostics,
  note: 'Display text is copied verbatim from quran-uthmani. Simple Clean is used only as an independently paired search representation. No Quran text is corrected or synthesized.',
};
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/quran.json`, serialized, 'utf8');
await writeFile(`${directory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(`${directory}/ATTRIBUTION.txt`, `Provider: AlQuran Cloud / Islamic Network\nhttps://alquran.cloud/terms-and-conditions\n\nAlQuran Cloud acknowledges Tanzil Project and Quran Academy as text sources.\nText is retained verbatim from the named provider editions. The provider does\nnot expose a specific upstream release number; none is inferred here.\n\nUpstream notice, preserved from https://tanzil.net/docs/text_license:\n\n${copyrightNotice}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));

# Local Quran search data

`quran.json` contains 114 Surahs and 6,236 ordered verses. `text` is copied
**verbatim** from AlQuran Cloud's `quran-uthmani` text edition. `simple` is the
same verse's independently paired `quran-simple-clean` text, for searching only.
The application always displays `text`, never reconstructed or normalized text.

The provider includes Bismillah inside the first verse of most Surahs. Do not
prepend another Bismillah or strip any part of the stored verse.

`manifest.json` pins the complete downloaded source-response hashes, the local
dataset byte hash, and a separate hash of all original `[surah, ayah, text]`
triples. Data loading and searching do not depend on a live external API.

The preparation command validates edition identifiers, every Surah and verse
key/count, and all 6,236 original/standard-spelling alignments **before** writing:

```powershell
node --use-system-ca scripts/prepare-quran.mjs
node --test tests/quran-search.test.mjs
```

Regeneration is an explicit maintenance action, not a startup step. Review a
dataset/manifest diff and run the regression tests before accepting new data.
Automatic checks establish pairing, structural bounds, grapheme preservation,
and edit similarity; they do not claim a human scholarly review of every word.

`quran-client.mjs` loads a single module worker. The worker fetches this file
once, prepares the complete normalized/offset index, and performs searches off
the UI thread. Only the display strings and metadata are copied to the page.
On the tested desktop, building the index took approximately 1.3 seconds and a
search approximately 6 ms; the worker keeps controls responsive during setup.
Browsers without module-worker support use the same index on the main thread
as a compatibility fallback, so initial setup may briefly block in that case.

Sources: <https://api.alquran.cloud/v1/quran/quran-uthmani> and
<https://api.alquran.cloud/v1/quran/quran-simple-clean>.

Provider terms: <https://alquran.cloud/terms-and-conditions>. The provider
acknowledges Tanzil Project and Quran Academy as text sources. Tanzil's notice,
source link, and text-license link are retained in `ATTRIBUTION.txt` and the
dataset's `attribution` metadata. No specific upstream release is inferred from
the API edition name. <https://tanzil.net/docs/text_license>

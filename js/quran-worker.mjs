import { buildIndex, search } from './quran-search.mjs';

// Keep the large normalized/offset index off the UI thread and transfer only
// authentic display strings plus metadata to the page once.
const ready = (async () => {
  const response = await fetch(new URL('../assets/quran/quran.json', import.meta.url));
  if (!response.ok) throw new Error(`تعذر تحميل بيانات المصحف (${response.status}).`);
  const index = buildIndex(await response.json());
  self.postMessage({
    type: 'ready',
    data: {
      surahs: index.surahs,
      verses: index.verses.map(({ surah, ayah, surahName, text }) => ({ surah, ayah, surahName, text })),
      diagnostics: { ...index.diagnostics, workerUsed: true },
    },
  });
  return index;
})();

ready.catch(error => self.postMessage({ type: 'error', message: error.message }));
self.addEventListener('message', async event => {
  const { id, query } = event.data ?? {};
  if (!Number.isInteger(id) || typeof query !== 'string') return;
  try {
    const index = await ready;
    self.postMessage({ type: 'results', id, matches: search(index, query) });
  } catch (error) {
    self.postMessage({ type: 'query-error', id, message: error.message });
  }
});

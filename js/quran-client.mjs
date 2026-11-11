/** Shared singleton: one dataset request/index for the entire application. */
let loading = null;
let worker = null;
let fallbackIndex = null;
let serial = 0;
const pending = new Map();

function displayIndex(data) {
  return { ...data, byKey: new Map(data.verses.map(verse => [`${verse.surah}:${verse.ayah}`, verse])) };
}

function failPending(error) {
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
  worker?.terminate();
  worker = null;
  loading = null;
}

async function loadFallback() {
  // A compatibility-only path for browsers without module workers. It uses
  // the same validated index, not a remote API with different text/results.
  const { buildIndex } = await import('./quran-search.mjs');
  const response = await fetch(new URL('../assets/quran/quran.json', import.meta.url));
  if (!response.ok) throw new Error(`تعذر تحميل بيانات المصحف (${response.status}).`);
  fallbackIndex = buildIndex(await response.json());
  return displayIndex({
    surahs: fallbackIndex.surahs,
    verses: fallbackIndex.verses.map(({ surah, ayah, surahName, text }) => ({ surah, ayah, surahName, text })),
    diagnostics: { ...fallbackIndex.diagnostics, workerUsed: false },
  });
}

function initialize() {
  if (typeof Worker === 'undefined') return loadFallback();
  return new Promise((resolve, reject) => {
    let instance;
    try { instance = new Worker(new URL('./quran-worker.mjs', import.meta.url), { type: 'module' }); }
    catch { loadFallback().then(resolve, reject); return; }
    worker = instance;
    let hasLoaded = false;
    instance.addEventListener('message', event => {
      if (instance !== worker) return;
      const message = event.data;
      if (message.type === 'ready') {
        hasLoaded = true;
        resolve(displayIndex(message.data));
      } else if (message.type === 'results' || message.type === 'query-error') {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (message.type === 'results') request.resolve(message.matches);
        else request.reject(new Error(message.message));
      } else if (message.type === 'error') {
        const error = new Error(message.message || 'تعذر تجهيز بحث المصحف.');
        if (!hasLoaded) reject(error);
        failPending(error);
      }
    });
    // A worker that cannot start (blocked module worker, MIME/CSP problem,
    // unreadable startup message) must not disable the Quran features: use the
    // same validated index on the main thread. After a successful start, a crash
    // rejects pending searches and the next call creates a fresh worker.
    const fail = error => {
      if (hasLoaded) { failPending(error); return; }
      worker = null;
      instance.terminate();
      loadFallback().then(resolve, reject);
    };
    instance.addEventListener('error', event => {
      if (instance !== worker) return;
      fail(new Error(event.message || 'تعذر تشغيل عامل بحث المصحف.'));
    });
    instance.addEventListener('messageerror', () => {
      if (instance !== worker) return;
      fail(new Error('تعذر قراءة استجابة بحث المصحف.'));
    });
  });
}

export function loadQuran() {
  if (!loading) {
    loading = initialize().catch(error => {
      failPending(error);
      throw error;
    });
  }
  return loading;
}

export async function searchQuran(query) {
  await loadQuran();
  if (fallbackIndex) {
    const { search } = await import('./quran-search.mjs');
    return search(fallbackIndex, query);
  }
  const id = ++serial;
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('بحث المصحف غير جاهز؛ أعد المحاولة.')); return; }
    pending.set(id, { resolve, reject });
    try { worker.postMessage({ id, query: String(query ?? '') }); }
    catch (error) { pending.delete(id); reject(error); }
  });
}

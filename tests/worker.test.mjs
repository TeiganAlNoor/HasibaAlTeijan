/** Browser-only worker regressions; no dependency is installed by this test.
 * PUPPETEER_MODULE and CHROME_PATH may point at an existing local installation.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const modulePath = process.env.PUPPETEER_MODULE || 'C:/Users/hp/Documents/Multaqa-Motion-Studio/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let puppeteer;
try {
  await access(chromePath);
  puppeteer = (await import(modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href)).default;
} catch {
  test('module-worker browser checks require existing Puppeteer and Chrome', { skip: 'Set PUPPETEER_MODULE and CHROME_PATH; no browser dependency is installed automatically.' }, () => {});
}

if (puppeteer) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  let server;
  let browser;
  let origin;
  let datasetRequests = 0;
  let failNextDataset = false;
  let page;

  before(async () => {
    server = http.createServer(async (request, response) => {
      try {
        if (request.url === '/worker-test') {
          response.setHeader('Content-Type', 'text/html;charset=utf-8');
          response.end('<!doctype html><html lang="ar"><title>Worker regression fixture</title><body>اختبار بحث المصحف</body></html>');
          return;
        }
        if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const filename = path.resolve(root, `.${pathname}`);
        if (!filename.startsWith(path.resolve(root) + path.sep)) throw new Error('Outside test root.');
        if (filename.endsWith(path.join('assets', 'quran', 'quran.json'))) {
          datasetRequests++;
          if (failNextDataset) {
            failNextDataset = false;
            response.writeHead(503);
            response.end('Deliberate regression fixture failure.');
            return;
          }
        }
        response.setHeader('Content-Type', filename.endsWith('.mjs') ? 'text/javascript' : 'application/json');
        response.end(await readFile(filename));
      } catch {
        response.writeHead(404);
        response.end('Not found.');
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
    page = await browser.newPage();
    await page.goto(`${origin}/worker-test`);
  });

  after(async () => {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
  });

  test('module worker indexes once and keeps the browser UI responsive during setup', { timeout: 30000 }, async () => {
    const result = await page.evaluate(async () => {
      const client = await import('/js/quran-client.mjs');
      let ticks = 0;
      let longestGap = 0;
      let last = performance.now();
      const timer = setInterval(() => {
        const now = performance.now();
        longestGap = Math.max(longestGap, now - last);
        last = now;
        ticks++;
      }, 10);
      const first = client.loadQuran();
      const samePromise = first === client.loadQuran();
      const index = await first;
      clearInterval(timer);
      return { samePromise, ticks, longestGap, workerUsed: index.diagnostics.workerUsed, surahs: index.surahs.length, verses: index.verses.length, keys: index.byKey.size };
    });
    assert.equal(result.samePromise, true);
    assert.equal(result.workerUsed, true);
    assert.equal(result.surahs, 114);
    assert.equal(result.verses, 6236);
    assert.equal(result.keys, 6236);
    assert.ok(result.ticks > 10, JSON.stringify(result));
    assert.ok(result.longestGap < 250, JSON.stringify(result));
    assert.equal(datasetRequests, 1);
  });

  test('concurrent worker queries retain their own IDs/results without another dataset request', { timeout: 30000 }, async () => {
    const result = await page.evaluate(async () => {
      const client = await import('/js/quran-client.mjs');
      const [first, second] = await Promise.all([client.searchQuran('الرحمن'), client.searchQuran('العالمين')]);
      const matching = second.find(verse => verse.surah === 1 && verse.ayah === 2);
      return { firstCount: first.length, key: !!matching, original: matching.text.slice(matching.ranges[0].start, matching.ranges[0].end) };
    });
    assert.equal(result.firstCount, 159);
    assert.equal(result.key, true);
    assert.equal(result.original, 'ٱلْعَٰلَمِينَ');
    assert.equal(datasetRequests, 1);
  });

  test('compatibility path without Worker has the same complete text and matches', { timeout: 30000 }, async () => {
    const compatibilityPage = await browser.newPage();
    try {
      await compatibilityPage.goto(`${origin}/worker-test`);
      const result = await compatibilityPage.evaluate(async () => {
        globalThis.Worker = undefined;
        const client = await import('/js/quran-client.mjs');
        const index = await client.loadQuran();
        return { workerUsed: index.diagnostics.workerUsed, verses: index.byKey.size, matches: (await client.searchQuran('الرحمن')).length };
      });
      assert.equal(result.workerUsed, false);
      assert.equal(result.verses, 6236);
      assert.equal(result.matches, 159);
      assert.equal(datasetRequests, 2);
    } finally { await compatibilityPage.close(); }
  });

  test('worker runtime errors reject every pending query and allow a clean new worker', { timeout: 30000 }, async () => {
    const errorPage = await browser.newPage();
    try {
      await errorPage.goto(`${origin}/worker-test`);
      const previousRequests = datasetRequests;
      const result = await errorPage.evaluate(async () => {
        const NativeWorker = globalThis.Worker;
        let latest;
        let holdQueries = false;
        let heldQueries = 0;
        globalThis.Worker = class extends NativeWorker {
          constructor(...arguments_) { super(...arguments_); latest = this; }
          postMessage(message, ...arguments_) {
            if (holdQueries && Number.isInteger(message.id)) { heldQueries++; return; }
            super.postMessage(message, ...arguments_);
          }
        };
        const client = await import('/js/quran-client.mjs');
        await client.loadQuran();
        holdQueries = true;
        const first = client.searchQuran('الرحمن').then(() => false, () => true);
        const second = client.searchQuran('العالمين').then(() => false, () => true);
        await new Promise(resolve => setTimeout(resolve, 0));
        latest.dispatchEvent(new ErrorEvent('error', { message: 'Deliberate worker-error fixture.' }));
        const rejected = await Promise.all([first, second]);
        holdQueries = false;
        const index = await client.loadQuran();
        const matches = await client.searchQuran('الرحمن');
        return { rejected, heldQueries, workerUsed: index.diagnostics.workerUsed, matches: matches.length };
      });
      assert.equal(result.heldQueries, 2);
      assert.deepEqual(result.rejected, [true, true]);
      assert.equal(result.workerUsed, true);
      assert.equal(result.matches, 159);
      assert.equal(datasetRequests - previousRequests, 2);
    } finally { await errorPage.close(); }
  });

  test('failed worker dataset load rejects and a fresh retry succeeds without a stale singleton', { timeout: 30000 }, async () => {
    const retryPage = await browser.newPage();
    try {
      await retryPage.goto(`${origin}/worker-test`);
      failNextDataset = true;
      const previousRequests = datasetRequests;
      const result = await retryPage.evaluate(async () => {
        const client = await import('/js/quran-client.mjs');
        let rejected = false;
        try { await client.loadQuran(); } catch { rejected = true; }
        const index = await client.loadQuran();
        return { rejected, workerUsed: index.diagnostics.workerUsed, verses: index.byKey.size, matches: (await client.searchQuran('الرحمن')).length };
      });
      assert.equal(result.rejected, true);
      assert.equal(result.workerUsed, true);
      assert.equal(result.verses, 6236);
      assert.equal(result.matches, 159);
      assert.equal(datasetRequests - previousRequests, 2);
    } finally { await retryPage.close(); }
  });
}

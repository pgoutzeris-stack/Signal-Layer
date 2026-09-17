// Integration check against a local, mocked API. No production data is written.
// Run with Playwright installed: node tools/check-memo-browser.mjs
// Optional: PLAYWRIGHT_MODULE=/path/to/playwright and BROWSER_CHANNEL=chrome.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = await mkdtemp(resolve(tmpdir(), 'memo-browser-'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1080 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/dev-preview-harness.html`);
  await page.evaluate(async () => {
    const { openAssetStudio, closeAssetStudio } = await import('./asset-studio.js?v=20260917-21');
    const { MEMO_TEMPLATE } = await import('./memo-template.js?v=20260917-21');
    const { MEMO_EXAMPLE } = await import('./memo-example.js?v=20260917-21');
    window.saved = MEMO_TEMPLATE.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, key) => {
      if (key.endsWith('_image')) return MEMO_EXAMPLE.images[key.replace(/_image$/, '').replace(/^(benchmarks|potentials)_/, '$1.')]?.src || '';
      return MEMO_EXAMPLE.html[key] || '';
    });
    window.saves = 0;
    window.reopen = (generated = false) => {
      closeAssetStudio();
      openAssetStudio({ kind: 'memo', assetId: 'local-test', signal: { company: 'Example AG' }, callApi: async (action, body) => {
        if (action === 'get_asset') return { asset: { id: 'local-test', status: 'done', owner_id: 'test-owner',
          payload: { title: 'Neue Strategie', market_title: 'Der Markt bewegt sich', potentials_title: 'Drei Hebel' }, edited_html: generated ? '' : window.saved } };
        if (action === 'list_assets') return { assets: [] };
        if (action === 'get_asset_tone') return { tone_of_voice: '' };
        if (action === 'save_asset') { window.saved = body.edited_html; window.saves++; return { ok: true }; }
        return {};
      } });
    };
    window.reopen();
  });
  const stage = page.locator('[data-stagearea] .as-stage--memo');
  await stage.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await stage.locator('.em-page').count(), 4);
  await page.locator('[data-act="to-edit"]').click();
  const title = stage.locator('[data-field="title"]');
  await title.fill('Eigenmarken mit klarem Profil');
  await title.evaluate(e => { e.style.fontSize = '25px'; e.style.textAlign = 'left'; });
  await stage.locator('[data-imgkey="cover"][data-act="img-zoom"][data-imgdelta="1"]').click({ force: true });
  assert.equal(await title.textContent(), 'Eigenmarken mit klarem Profil');
  await stage.locator('[data-field="document_label"]').first().fill('Strategie 2026');
  assert.deepEqual(await stage.locator('[data-field="document_label"]').allTextContents(), Array(4).fill('Strategie 2026'));
  assert.equal(await stage.locator('[data-ci] [contenteditable], [data-ci] [data-imgslot]').count(), 0);
  assert.equal(await stage.locator('[data-field]:not([contenteditable="true"])').count(), 0);
  for (let i = 0; i < 3; i++) await page.locator('[data-stagearea] [data-act="prev-fwd"]').click();
  await stage.locator('[data-field="contact_name"]').fill('Test Kontakt');
  await stage.locator('[data-field="contact_email"]').fill('memo@example.com');
  await page.locator('[data-act="save"]').click();
  await page.waitForFunction(() => window.saves === 1);
  const saved = await page.evaluate(() => window.saved);
  assert(saved.length < 900000, 'Reference memo exceeds backend save limit');
  assert(saved.includes('mailto:memo@example.com?subject=Strategie%202026'));
  const exportCheck = await page.evaluate(html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { pages: doc.querySelectorAll('.em-page').length, editors: doc.querySelectorAll('[contenteditable], [data-as-chrome]').length,
      hidden: doc.querySelectorAll('.em-page.is-off').length };
  }, saved);
  assert.deepEqual(exportCheck, { pages: 4, editors: 0, hidden: 0 });
  await page.evaluate(() => window.reopen());
  await stage.waitFor();
  assert.equal(await title.textContent(), 'Eigenmarken mit klarem Profil');
  assert.equal(await title.evaluate(e => e.style.fontSize), '25px');
  assert.equal(await stage.locator('[data-field="contact_name"]').textContent(), 'Test Kontakt');
  assert.equal(await stage.locator('img[data-imgkey="cover"]').evaluate(e => e.style.transform), 'scale(1.1)');
  // A real overlong edit must be rejected, even on an inactive page.
  await page.locator('[data-act="to-edit"]').click();
  await title.fill('Zu langer Inhalt '.repeat(500));
  await page.locator('[data-act="save"]').click();
  assert.match(await page.locator('[data-savehint]').textContent(), /läuft über den Rahmen/);
  assert.equal(await page.evaluate(() => window.saves), 1);
  // New signal drafts use the same template without inheriting Deichmann content.
  await page.evaluate(() => window.reopen(true));
  await stage.waitFor();
  assert.equal(await title.textContent(), 'Neue Strategie');
  assert.equal(await stage.locator('[data-field="document_label"]').first().textContent(), 'Example AG');
  assert(!(await stage.textContent()).includes('Deichmann'));
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'memo.html'), saved);
  await page.goto(new URL('file://' + resolve(out, 'memo.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const pages = await page.locator('.em-page').evaluateAll(nodes => nodes.map(e => ({ height: e.clientHeight, scroll: e.scrollHeight })));
  assert(pages.every(p => p.height === 1123 && p.scroll <= 1125), JSON.stringify(pages));
  await page.pdf({ path: resolve(out, 'memo.pdf'), preferCSSPageSize: true, printBackground: true });
  console.log(`Memo browser check passed: 4 pages, editing, image zoom, CI protection, save/reopen, overflow, new drafts, PDF. Artifacts: ${out}`);
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}

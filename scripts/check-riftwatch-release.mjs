// Real, signed-out guest route against the Vite production build. Server-side ranking
// has a separate integration suite which exercises the actual Edge handler and SQL.
import assert from 'node:assert/strict';
import { chromium, expect, webkit } from '@playwright/test';
import { preview } from 'vite';

const engine = process.argv[2] ?? 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;
try {
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}/riftwatch/practice`;
  browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({
    executablePath: process.env.RIFTWATCH_CHROMIUM || undefined,
  });
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 800]]) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: width < 500 ? 2 : 1, hasTouch: true,
      reducedMotion: width === 320 ? 'reduce' : 'no-preference', serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const errors = [];
    const rankedRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/\/arcade-run|\/rpc\/arcade_/.test(request.url())) rankedRequests.push(request.url());
    });
    try {
      await page.goto(url);
      const control = name => page.getByRole('button', { name, exact: true });
      const deck = page.locator('[data-rw-screen]');
      await expect(control('Practice')).toBeEnabled();
      await expect(control('Ranked Run')).toHaveCount(0);
      await control('Settings').tap();
      const contrast = page.getByRole('button', { name: /High contrast/ });
      await contrast.tap();
      await expect(contrast).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await expect(deck).toHaveAttribute('data-rw-screen', 'title');
      // Start, fly, pause and resume with the connection genuinely switched off.
      await context.setOffline(true);
      await control('Practice').tap();
      await expect(deck).toHaveAttribute('data-rw-screen', 'playing');
      const canvas = page.getByLabel('Riftwatch playfield');
      const rect = await canvas.boundingBox();
      assert.ok(rect.width >= 160 && Math.abs(rect.width / rect.height - 160 / 144) < 0.01);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.keyboard.down('Space');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.up('Space');
      await control('Pause menu').tap();
      await expect(control('Resume')).toBeVisible();
      await control('Resume').tap();
      await expect(deck).toHaveAttribute('data-rw-screen', 'playing');
      await context.setOffline(false);
      await page.keyboard.press('Escape');
      await control('Leave run').tap();
      await control('Return to DH').tap();
      await expect(page).toHaveURL(/\/(?:auth|dashboard)(?:[?#].*)?$/);
      await expect(canvas).toHaveCount(0);
      assert.deepEqual(errors, []);
      assert.deepEqual(rankedRequests, []);
      console.log(`PASS ${engine} ${width}×${height} — guest entry, offline controls, pause/resume and return`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server.httpServer.closeAllConnections();
  await new Promise(resolve => server.httpServer.close(resolve));
}

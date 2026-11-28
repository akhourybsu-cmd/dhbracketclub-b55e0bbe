// Check real member routes. Only club/auth data and remote transport are isolated.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, webkit } from '@playwright/test';
import { createServer } from 'vite';
import { installHomeFixture } from './dh-home-fixture.mjs';

const engine = process.env.MESOMON_BROWSER || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const output = process.env.POCKET_OUTPUT || await mkdtemp(join(tmpdir(), 'dh-pocket-'));
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;

async function prepare(context, theme, mesomon = true) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await installHomeFixture(page, { mesomon });
  await page.addInitScript(theme => { localStorage.setItem('theme', theme); }, theme);
  await page.route('**/src/hooks/useOnboardingStatus.ts*', route =>
    route.fulfill({ contentType: 'text/javascript', body: "export const useOnboardingStatus=()=>({state:'approved',loading:false});" }));
  return { page, errors };
}

function assertVisibleBounds(element) {
  return element.evaluate(node => {
    const { left, top, right, bottom } = node.getBoundingClientRect();
    return left >= -1 && top >= -1 && right <= innerWidth + 1 && bottom <= innerHeight + 1;
  }).then(inside => assert.ok(inside, 'The entire control fits inside the handheld viewport'));
}

async function checkViewport(base, { width, height, theme, touch }) {
  const context = await browser.newContext({
    viewport: { width, height }, isMobile: touch, hasTouch: touch,
    reducedMotion: width === 320 ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
  });
  const { page, errors } = await prepare(context, theme);
  const select = element => touch ? element.tap() : element.click();
  const launch = page.getByRole('link', { name: 'Launch DH Pocket', exact: true });
  const title = page.getByRole('heading', { name: 'Select a Game', exact: true });
  const card = page.getByRole('button', { name: 'Play Mesomon', exact: true });
  const exiting = page.getByRole('button', { name: 'Exit game', exact: true });
  const journey = page.getByRole('button', { name: /^(Begin|Continue) journey$/ });
  const screen = name => page.locator('[data-pocket-screen="' + name + '"]');
  const screenshot = name => page.screenshot({ path: join(output, engine + '-' + width + 'x' + height + '-' + name + '.png') });
  try {
    await page.goto(base + '/dashboard');
    await expect(launch).toHaveAttribute('href', '/dh-pocket');
    await launch.scrollIntoViewIfNeeded();
    await screenshot('home');
    await select(launch);
    await expect(page).toHaveURL(base + '/dh-pocket');
    await expect(screen('boot').getByRole('img', { name: 'DH Games' })).toBeVisible();
    if (width === 390) {
      await page.waitForFunction(() => {
        const mark = document.querySelector('[data-pocket-screen="boot"] [data-dh-games-logo]');
        return mark && Number(getComputedStyle(mark).opacity) > .98;
      });
      await screenshot('power-on');
    }
    await expect(title).toBeVisible();
    await expect(card).toBeVisible();
    await expect(page.locator('.app-main-content')).toHaveCount(0);
    await expect(page.getByText('DH POCKET', { exact: true }).first()).toBeVisible();
    await assertVisibleBounds(card);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await screenshot('library');

    // There is one published cartridge. Browsing past either edge must keep it playable.
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(card).toBeVisible();
    if (touch) await select(card);
    else await page.keyboard.press('Enter');
    await expect(screen('loading')).toContainText(/loading.*mesomon/i);
    if (width === 390) await screenshot('insert');
    await expect(journey).toBeEnabled();
    await expect(page).toHaveURL(/\/dh-pocket\?game=mesomon$/);
    await expect(page.locator('.mm-device')).toHaveCount(1);
    await assertVisibleBounds(journey);
    await assertVisibleBounds(page.getByRole('button', { name: 'A — Begin journey' }));
    await screenshot('game');
    await page.reload();
    await expect(journey).toBeEnabled();

    if (width === 390) {
      await select(journey);
      const intro = page.getByRole('dialog', { name: 'Opening cinematic' });
      await select(intro.getByRole('button', { name: 'Skip opening' }));
      await expect(page.locator('.mm-screen')).toHaveAttribute('data-art-ready', 'true');
      await select(page.getByRole('button', { name: 'Start', exact: true }));
      const menu = page.getByRole('dialog', { name: 'Start menu' });
      await select(menu.getByRole('button', { name: 'Exit game', exact: true }));
    } else {
      await select(exiting);
    }
    await expect(title).toBeVisible();
    await expect(screen('boot')).toHaveCount(0);
    await expect(card).toBeFocused();
    await expect(page).toHaveURL(base + '/dh-pocket');

    // The physical A control launches the selected cart without touching its label.
    const confirm = page.getByRole('button', { name: /Launch cartridge/i });
    await assertVisibleBounds(confirm);
    await select(confirm);
    await expect(journey).toBeEnabled();
    if (width === 390) await expect(journey).toHaveText(/Continue journey/i);
    await select(exiting);
    await expect(title).toBeVisible();
    const close = page.getByRole('button', { name: /Close handheld/i }).first();
    await assertVisibleBounds(close);
    await select(close);
    await expect(page).toHaveURL(base + '/dashboard');
    await expect(launch).toBeVisible();
    await expect(page.locator('.mm-device')).toHaveCount(0);
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error('Failed on ' + width + '×' + height, page.url(), errors, await page.locator('body').innerText().catch(() => ''));
    await screenshot('failure').catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

try {
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({
    executablePath: process.env.MESOMON_CHROMIUM || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  for (const size of [
    { width: 390, height: 844, theme: 'dark', touch: true },
    { width: 320, height: 568, theme: 'light', touch: true },
    { width: 844, height: 390, theme: 'dark', touch: true },
    { width: 1440, height: 900, theme: 'light', touch: false },
  ]) await checkViewport(base, size);

  const member = await browser.newContext({ serviceWorkers: 'block' });
  const { page } = await prepare(member, 'dark');
  await page.goto(base + '/mesomon');
  await expect(page.getByRole('button', { name: 'Begin journey' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Exit game' })).toHaveAttribute('href', '/compete');
  await member.close();

  const limited = await browser.newContext({ serviceWorkers: 'block' });
  const { page: noCarts } = await prepare(limited, 'dark', false);
  await noCarts.goto(base + '/dashboard');
  await expect(noCarts.getByRole('heading', { name: 'Hey, Alex.' })).toBeVisible();
  await expect(noCarts.getByRole('link', { name: 'Launch DH Pocket' })).toHaveCount(0);
  await noCarts.goto(base + '/dh-pocket?game=mesomon');
  await expect(noCarts.getByRole('heading', { name: 'No cartridges installed' })).toBeVisible();
  await expect(noCarts).toHaveURL(base + '/dh-pocket');
  await expect(noCarts.getByRole('button', { name: 'Begin journey' })).toHaveCount(0);
  await limited.close();
  console.log('PASS Pocket home, boot, selector, loading, title, saved game exit, close, direct entry and club access in ' + engine);
} finally {
  await browser?.close();
  await server.close();
  console.log('Browser screenshots: ' + output);
}

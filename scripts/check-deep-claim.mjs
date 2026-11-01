// Actual Deep Claim UI, hooks and migrations with local-only identities/RPCs.
// No credentials, remote services, live accounts or production rewards are used.
import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { createDeepClaimMiddleware } from './fixtures/deep-claim-server.mjs';
import { DEEP_CLAIM_ACTORS } from './fixtures/deep-claim-db.mjs';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.DEEP_CLAIM_QA_OUTPUT || await mkdtemp(join(tmpdir(), 'deep-claim-'));
await mkdir(output, { recursive: true });
const base = 'http://127.0.0.1:8106', token = randomUUID();
const sections = new Set((process.env.DEEP_CLAIM_QA_SECTION || 'presentation,journey,reliability,industry').split(','));
const report = { checks: [], errors: [], runtimeErrors: [], artifacts: output,
  fixture: 'Production Deep Claim screens/hooks, real SQL migrations in local isolated PostgreSQL, local identity. No live writes.' };
const endpoint = createDeepClaimMiddleware(token);
let server, browser, currentPage, viteLog;
console.log('Deep Claim artifacts:', output);

async function cleanup() {
  await endpoint.releaseAll();
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await endpoint.close();
  viteLog?.end();
}
process.once('SIGINT', () => { void cleanup().then(() => process.exit(130)); });
process.once('SIGTERM', () => { void cleanup().then(() => process.exit(143)); });

async function start() {
  viteLog = createWriteStream(join(output, 'vite.log'));
  server = await createServer({ root: cwd, server: { host: '127.0.0.1', port: 8106, strictPort: true },
    plugins: [{ name: 'isolated-deep-claim-rpc', configureServer(instance) { instance.middlewares.use(endpoint.middleware); } }],
    customLogger: {
      info: message => viteLog.write(message + '\n'), warn: message => viteLog.write('WARN ' + message + '\n'),
      warnOnce: message => viteLog.write('WARN ' + message + '\n'), error: message => viteLog.write('ERROR ' + message + '\n'),
      clearScreen() {}, hasErrorLogged: () => false, hasWarned: false,
    },
  });
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.DEEP_CLAIM_QA_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
}

async function pageFor(context) {
  const page = await context.newPage(); currentPage = page;
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const stub = (path, body) => page.route(`**/${path}*`, route => route.fulfill({ contentType: 'text/javascript', body }));
  await stub('src/integrations/supabase/client.ts', "export {supabase} from '/scripts/fixtures/deep-claim-transport.ts';");
  await stub('src/contexts/AuthContext.tsx', "const p=new URLSearchParams(location.search);const id=p.get('user')||'00000000-0000-4000-8000-000000000001';export const useAuth=()=>({user:{id,user_metadata:{display_name:'Alex'}},session:null,loading:false,signOut:async()=>{}});");
  await stub('src/contexts/ClubContext.tsx', "const club={id:'00000000-0000-4000-8000-000000001001',name:'Dry My Horse',slug:'dh'};export const useClub=()=>({club,loading:false,isClubAdmin:false,isPrivateSession:false,membership:{club_id:club.id,role:'member'}});");
  // The isolated DB explicitly installs Deep Claim; actual RPC access checks
  // still enforce membership and installation on every read and mutation.
  await stub('src/hooks/useClubAssets.ts', "export const useClubAssets=()=>({loading:false,assets:[],isInstalled:slug=>slug==='deep-claim',refresh:async()=>{}});");
  return page;
}
async function setup(width = 390, height = 844, theme = 'dark', motion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: motion });
  return { context, page: await pageFor(context), theme };
}
async function go(page, { run = 'main', theme = 'dark', user = DEEP_CLAIM_ACTORS.alex } = {}) {
  currentPage = page;
  const params = new URLSearchParams({ run, theme, user, token, route: '/deep-claim' });
  await page.goto(`${base}/scripts/fixtures/deep-claim.html?${params}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.deepClaimReady && window.deepClaimQa && window.deepClaimQueryClient);
  await settle(page);
}
async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  // Wait for finite menu entrance/exit transforms before measuring hit areas.
  // Canvas frames and infinite decorative animations do not block this check.
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'
    || animation.effect?.getTiming().iterations === Infinity), undefined, { timeout: 4000 });
}
function checked(label, value, detail) {
  report.checks.push({ label, ok: Boolean(value), ...(detail ? { detail } : {}) });
  assert.ok(value, `${label}${detail ? ': ' + JSON.stringify(detail) : ''}`);
}
async function shot(page, label) { await settle(page); await page.screenshot({ path: join(output, `${label}.png`) }); }
async function command(page, name, input = {}) {
  const result = await page.evaluate(({ name, input }) => window.deepClaimQa.command(name, input), { name, input });
  return result.data;
}
async function rpc(page, name, args = {}) {
  const result = await page.evaluate(({ name, args }) => window.deepClaimQa.rpc(name, args), { name, args });
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}
async function fit(page, label) {
  await settle(page);
  const issues = await page.evaluate(() => {
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth + 2) problems.push('Horizontal document overflow');
    if (document.documentElement.scrollHeight > innerHeight + 2) problems.push('Fullscreen shell requires document scrolling');
    for (const node of document.querySelectorAll('button,a[href],select')) {
      if (!(node instanceof HTMLElement) || node.closest('[hidden],[aria-hidden="true"],[inert]') || node.matches(':disabled')) continue;
      const box = node.getBoundingClientRect(), style = getComputedStyle(node);
      if (!box.width || !box.height || style.display === 'none' || style.visibility === 'hidden') continue;
      if (box.top >= -1 && box.bottom <= innerHeight + 1 && (box.width < 43.5 || box.height < 43.5)) problems.push(`Small command: ${node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 40)}`);
    }
    return problems;
  });
  checked(`layout-${label}`, issues.length === 0, issues);
}

async function found(page, options = {}) {
  await go(page, options);
  await expect(page.getByRole('textbox', { name: 'Company name', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill('Flint & Vale Mining');
  await page.getByRole('button', { name: 'Found company', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
  return rpc(page, 'dc_get');
}
async function tab(page, label) {
  const choice = page.getByRole('tablist', { name: 'Company views', exact: true }).getByRole('tab', { name: new RegExp(`^${label}(?:\\s|$)`) });
  await choice.click(); await expect(choice).toHaveAttribute('aria-selected', 'true'); await settle(page);
}
async function closeReward(page) {
  await page.getByRole('button', { name: 'Back to the claim', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function intro(page, { confirm = true } = {}) {
  await tab(page, 'Surface');
  await page.getByRole('button', { name: 'Start first shift · 30s', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Work a seam' });
  await expect(dialog.getByRole('combobox', { name: 'Expedition worksite' })).toHaveValue('47:1');
  await dialog.getByRole('button', { name: 'Review dispatch', exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Verified dispatch estimate' })).toBeVisible();
  await expect(dialog.getByText('30s', { exact: true })).toBeVisible();
  if (confirm) {
    await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  return dialog;
}
async function canvasIsDrawn(page, label) {
  const result = await page.getByTestId('deep-claim-canvas').evaluate(canvas => {
    const box = canvas.getBoundingClientRect(), context = canvas.getContext('2d');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let index = 0; index < pixels.length; index += Math.max(4, Math.floor(pixels.length / 4000 / 4) * 4)) colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}`);
    return { width: box.width, height: box.height, colors: colors.size, inView: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 };
  });
  checked(`mine-canvas-drawn-and-contained-${label}`, result.width > 200 && result.height > 100 && result.colors > 12 && result.inView, result);
}
async function presentation() {
  const cases = [[320, 568, 'dark', 'no-preference'], [390, 844, 'light', 'no-preference'], [844, 390, 'dark', 'no-preference'], [1440, 900, 'light', 'no-preference'], [390, 844, 'dark', 'reduce']];
  for (const [index, [width, height, theme, motion]] of cases.entries()) {
    const label = `${width}x${height}-${theme}-${motion}`, run = `presentation-${index}`, { context, page } = await setup(width, height, theme, motion);
    const initial = await found(page, { run, theme });
    await fit(page, `${label}-surface`); await canvasIsDrawn(page, `${label}-surface`); await shot(page, `${label}-surface`);
    for (const name of ['Mine', 'Crew', 'Stores', 'Log', 'Settings']) {
      await tab(page, name); await fit(page, `${label}-${name}`);
      if (name === 'Mine') {
        await expect(page.getByTestId('deep-claim-map')).toHaveAttribute('data-dc-view', 'mine');
        await canvasIsDrawn(page, `${label}-mine`);
        const canvas = page.getByTestId('deep-claim-canvas'); await canvas.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Equal'); await page.keyboard.press('Home');
        await page.getByRole('button', { name: 'Choose a worksite from list', exact: true }).click();
        const explore = page.getByRole('dialog', { name: 'Survey new ground' });
        await explore.getByRole('button', { name: 'Review dispatch', exact: true }).click();
        await expect(explore.getByRole('button', { name: 'Dispatch crew', exact: true })).toBeEnabled();
        await expect(explore.getByText('20 min', { exact: true }).last()).toBeVisible();
        await fit(page, `${label}-exploration-menu`); await shot(page, `${label}-exploration-menu`);
        await explore.getByRole('button', { name: 'Back', exact: true }).click();
      }
      if (name === 'Settings') {
        await expect(page.getByRole('switch', { name: 'Enable sound', exact: true })).toHaveAttribute('aria-checked', 'false');
        if (motion === 'reduce') await expect(page.getByRole('switch', { name: 'Reduced motion', exact: true })).toHaveAttribute('aria-checked', 'true');
        await page.getByRole('switch', { name: 'Reduced graphics', exact: true }).click();
        await expect(page.getByRole('switch', { name: 'Reduced graphics', exact: true })).toHaveAttribute('aria-checked', 'true');
      }
      if (name === 'Crew') {
        await page.getByRole('group', { name: 'Crew view', exact: true }).getByRole('button', { name: 'Hire', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'The hiring office', exact: true })).toBeVisible();
        await fit(page, `${label}-hiring`); await shot(page, `${label}-hiring`);
        await page.getByRole('group', { name: 'Crew view', exact: true }).getByRole('button', { name: /^Staff/ }).click();
      }
      if (name === 'Stores') {
        await workshop(page, 'Smeltery');
        await page.getByRole('button', { name: 'Review Smelt Copper', exact: true }).click();
        const recipe = page.getByRole('dialog', { name: 'Smelt Copper', exact: true });
        await recipe.getByRole('button', { name: 'Review batch', exact: true }).click();
        await expect(recipe.getByRole('button', { name: 'Start production', exact: true })).toBeDisabled();
        await fit(page, `${label}-production-review`); await shot(page, `${label}-production-review`); await page.keyboard.press('Escape');
        await page.getByRole('group', { name: 'Stores view', exact: true }).getByRole('button', { name: 'Stock', exact: true }).click();
      }
      await shot(page, `${label}-${name.toLowerCase()}`);
    }
    await intro(page, { confirm: false }); await fit(page, `${label}-intro-confirmation`); await shot(page, `${label}-intro-confirmation`);
    await page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }).click();
    const after = await rpc(page, 'dc_get');
    checked(`review-never-spends-resources-${label}`, initial.company.cash === after.company.cash && after.workers.every(worker => worker.energy === 6) && after.expeditions.length === 0);
    await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
    await page.getByRole('dialog', { name: 'The surface camp' }).getByRole('button', { name: /Warehouse/ }).click();
    await expect(page.getByRole('dialog', { name: 'Warehouse', exact: true })).toBeVisible();
    await fit(page, `${label}-upgrade-menu`); await shot(page, `${label}-upgrade-menu`); await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Surface', exact: true }).focus(); await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeFocused();
    await page.keyboard.press('Home'); await expect(page.getByRole('tab', { name: 'Surface', exact: true })).toBeFocused();
    checked(`keyboard-company-navigation-${label}`, true);
    await context.close(); console.log('PASS Deep Claim presentation', label);
  }
}
async function journey() {
  const run = 'journey', { context, page } = await setup();
  await found(page, { run }); await intro(page);
  let saved = await rpc(page, 'dc_get'), job = saved.expeditions[0];
  checked('tutorial-dispatch-is-authoritative', job.duration_seconds === 30 && saved.company.cash === 173 && saved.workers.every(worker => worker.energy === 5) && job.cargo === null);
  await tab(page, 'Mine'); await shot(page, 'journey-active-mine');
  await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
  saved = await rpc(page, 'dc_get'); checked('reload-preserves-the-same-dispatch', saved.expeditions.length === 1 && saved.expeditions[0].id === job.id && saved.company.cash === 173);
  await command(page, 'advance_job', { job_id: job.id, seconds: 31 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
  await page.getByRole('button', { name: 'Open haul', exact: true }).click();
  await page.getByRole('button', { name: 'Collect into storage', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Haul secured.', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/units remain staged/)).toHaveCount(0);
  await fit(page, 'journey-central-collection'); await shot(page, 'journey-central-collection'); await closeReward(page);
  saved = await rpc(page, 'dc_get'); checked('tutorial-cargo-collected-once', saved.resources.coal === 10 && saved.resources.stone === 12 && saved.company.warehouse_used === 22 && saved.expeditions[0].status === 'collected');
  await tab(page, 'Stores'); await page.getByRole('button', { name: 'Sell Coal', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Quantity to sell' }).fill('5'); await page.getByRole('button', { name: 'Confirm sale', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Trade recorded.', exact: true })).toBeVisible(); await closeReward(page);
  saved = await rpc(page, 'dc_get'); checked('real-market-sale-updates-stock-and-cash', saved.resources.coal === 5 && saved.company.cash === 193);
  await tab(page, 'Surface'); await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
  await page.getByRole('dialog', { name: 'The surface camp' }).getByRole('button', { name: /Warehouse/ }).click();
  await page.getByRole('button', { name: 'Confirm upgrade', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Warehouse upgraded.', exact: true })).toBeVisible(); await closeReward(page);
  saved = await rpc(page, 'dc_get'); checked('real-upgrade-doubles-storage-and-spends-once', saved.company.cash === 133 && saved.company.warehouse_capacity === 240);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Survey new ground' });
  await dialog.getByRole('combobox', { name: 'Expedition worksite' }).selectOption('47:4');
  await dialog.getByRole('checkbox', { name: 'Send Ivo Vale', exact: true }).uncheck(); await dialog.getByRole('checkbox', { name: 'Send Tessa Pike', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Review dispatch', exact: true }).click(); await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
  saved = await rpc(page, 'dc_get'); job = saved.expeditions.find(value => value.status === 'active');
  checked('normal-exploration-hides-future-ground', job.duration_seconds === 1200 && job.cargo === null && !saved.world.tiles.some(tile => tile.x === 47 && tile.y === 4));
  await command(page, 'advance_job', { job_id: job.id, seconds: 1201 }); await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
  saved = await rpc(page, 'dc_get'); checked('offline-return-reconciles-only-real-work', saved.expeditions.find(value => value.id === job.id).status === 'ready' && saved.world.tiles.some(tile => tile.x === 47 && tile.y === 4) && saved.workers.find(worker => worker.name === 'Mara Flint').assigned_job_id === null);
  await tab(page, 'Mine'); await shot(page, 'journey-expanded-mine'); await context.close(); console.log('PASS Deep Claim journey');
}
async function reliability() {
  const run = 'reliability', { context, page } = await setup();
  await found(page, { run }); await intro(page, { confirm: false });
  await command(page, 'fail_next', { name: 'dc_dispatch', after_commit: true });
  await page.getByRole('dialog', { name: 'Work a seam' }).getByRole('button', { name: 'Dispatch crew', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm sync', exact: true })).toBeVisible();
  let saved = await rpc(page, 'dc_get'); const job = saved.expeditions[0];
  checked('lost-ack-commits-one-dispatch', saved.expeditions.length === 1 && saved.company.cash === 173);
  await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByRole('button', { name: 'Confirm sync', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm sync', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saved action confirmed.', exact: true })).toBeVisible(); await closeReward(page);
  saved = await rpc(page, 'dc_get'); checked('reload-retries-the-original-receipt-once', saved.expeditions.length === 1 && saved.expeditions[0].id === job.id && saved.company.cash === 173);
  const dispatchCalls = (await command(page, 'calls')).filter(value => value.name === 'dc_dispatch');
  checked('lost-ack-retry-keeps-request-identity', dispatchCalls.length === 2 && dispatchCalls[0].args.p_request_id === dispatchCalls[1].args.p_request_id);
  await context.setOffline(true); await expect(page.getByText('Saved camp · read-only until reconnected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dispatch another crew', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
  await page.getByRole('dialog', { name: 'The surface camp' }).getByRole('button', { name: /Warehouse/ }).click();
  await expect(page.getByRole('button', { name: 'Confirm upgrade', exact: true })).toBeDisabled(); await page.keyboard.press('Escape');
  checked('offline-camp-is-explicitly-read-only', true); await context.setOffline(false);
  await expect(page.getByText('Saved camp · read-only until reconnected', { exact: true })).toHaveCount(0);
  await command(page, 'advance_job', { job_id: job.id, seconds: 31 }); await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
  await page.getByRole('button', { name: 'Open haul', exact: true }).click(); await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
  const peer = await pageFor(context); await go(peer, { run }); await expect(peer.getByRole('tablist', { name: 'Company views' })).toBeVisible();
  await tab(page, 'Stores'); await page.getByRole('button', { name: 'Sell Coal', exact: true }).click();
  await tab(peer, 'Stores'); await peer.getByRole('button', { name: 'Sell Coal', exact: true }).click();
  await command(page, 'hold', { name: 'dc_sell' });
  await page.bringToFront(); await page.getByRole('button', { name: 'Confirm sale', exact: true }).click();
  await peer.bringToFront(); await peer.getByRole('button', { name: 'Confirm sale', exact: true }).click();
  await expect.poll(async () => (await command(page, 'calls')).filter(value => value.name === 'dc_sell' && value.status === 'pending').length).toBe(2);
  await command(page, 'release', { name: 'dc_sell' });
  await expect.poll(async () => (await command(page, 'calls')).filter(value => value.name === 'dc_sell' && ['completed', 'rejected'].includes(value.status)).length).toBe(2);
  saved = await rpc(page, 'dc_get'); checked('two-device-sale-never-double-spends', saved.resources.coal === 0 && saved.company.cash === 213);
  const sales = (await command(page, 'calls')).filter(value => value.name === 'dc_sell'); checked('stale-device-sale-conflicts', sales.filter(value => value.status === 'completed').length === 1 && sales.filter(value => value.status === 'rejected').length === 1);
  await shot(page, 'reliability-first-device'); await shot(peer, 'reliability-second-device');
  await context.close(); console.log('PASS Deep Claim reliability');
}
async function clearDialogs(page) {
  for (let attempt = 0; attempt < 4 && await page.getByRole('dialog').count(); attempt++) { await page.keyboard.press('Escape'); await settle(page); }
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function workshop(page, station) {
  await tab(page, 'Stores');
  await page.getByRole('group', { name: 'Stores view', exact: true }).getByRole('button', { name: /^Workshop/ }).click();
  await page.getByRole('group', { name: 'Production station', exact: true }).getByRole('button', { name: station, exact: true }).click();
}
async function harvest(page, x, y, { workers } = {}) {
  await clearDialogs(page); await tab(page, 'Surface');
  await page.getByRole('button', { name: 'Extract', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Work a seam', exact: true });
  await dialog.getByRole('combobox', { name: 'Expedition worksite', exact: true }).selectOption(`${x}:${y}`);
  if (workers) for (const choice of await dialog.getByRole('checkbox', { name: /^Send / }).all()) {
    const name = (await choice.getAttribute('aria-label')).slice(5);
    if (workers.includes(name)) await choice.check(); else if (await choice.isChecked()) await choice.uncheck();
  }
  await dialog.getByRole('button', { name: 'Review dispatch', exact: true }).click();
  await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
  let snapshot = await rpc(page, 'dc_get'), job = snapshot.expeditions.find(value => value.status === 'active');
  assert.ok(job);
  await command(page, 'advance_job', { job_id: job.id, seconds: job.duration_seconds + 1 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
  await page.getByRole('button', { name: 'Open haul', exact: true }).click();
  await page.getByRole('button', { name: 'Collect into storage', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Haul secured.', exact: true })).toBeVisible(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get'); return snapshot;
}
async function sale(page, name) {
  await tab(page, 'Stores');
  await page.getByRole('group', { name: 'Stores view', exact: true }).getByRole('button', { name: 'Stock', exact: true }).click();
  await page.getByRole('button', { name: `Sell ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sale', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Trade recorded.', exact: true })).toBeVisible(); await closeReward(page);
}
async function build(page, name) {
  await clearDialogs(page); await tab(page, 'Surface');
  await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
  await page.getByRole('dialog', { name: 'The surface camp', exact: true }).getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
  await page.getByRole('button', { name: 'Confirm build', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to the claim', exact: true })).toBeVisible(); await closeReward(page);
}
async function workerFile(page, name, view) {
  await clearDialogs(page); await tab(page, 'Crew');
  await page.getByRole('group', { name: 'Crew view', exact: true }).getByRole('button', { name: /^Staff/ }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await card.getByRole('button', { name: 'Crew file', exact: true }).click();
  const file = page.getByRole('dialog', { name, exact: true });
  await file.getByRole('group', { name: 'Worker file views', exact: true }).getByRole('button', { name: view, exact: true }).click();
  return file;
}
async function processRecipe(page, key, { loseAcknowledgement = false } = {}) {
  let snapshot = await rpc(page, 'dc_get'); const recipe = snapshot.recipes.find(value => value.key === key);
  const ownedBefore = snapshot.equipment.map(item => item.id).sort(), outputBefore = Object.fromEntries(Object.keys(recipe.outputs).map(resource => [resource, snapshot.resources[resource] || 0]));
  const names = { smeltery: 'Smeltery', gem_workshop: 'Gem Workshop', tool_station: 'Tool Station' };
  await workshop(page, names[recipe.station]);
  await page.getByRole('button', { name: `Review ${recipe.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: recipe.name, exact: true });
  await dialog.getByRole('spinbutton', { name: 'Production batches', exact: true }).fill('1');
  await dialog.getByRole('button', { name: 'Review batch', exact: true }).click();
  if (loseAcknowledgement) await command(page, 'fail_next', { name: 'dc_start_production', after_commit: true });
  await dialog.getByRole('button', { name: 'Start production', exact: true }).click();
  if (loseAcknowledgement) {
    await expect(dialog.getByRole('alert')).toBeVisible(); await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Confirm sync', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm sync', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Saved action confirmed.', exact: true })).toBeVisible(); await closeReward(page);
    const calls = (await command(page, 'calls')).filter(value => value.name === 'dc_start_production' && value.args.p_recipe_key === key);
    checked(`production-lost-ack-keeps-identity-${key}`, calls.length === 2 && calls[0].args.p_request_id === calls[1].args.p_request_id);
  } else { await expect(page.getByRole('dialog', { name: 'Production queued.', exact: true })).toBeVisible(); await closeReward(page); }
  snapshot = await rpc(page, 'dc_get'); const job = snapshot.production_jobs.find(value => value.recipe_key === key && value.status === 'active');
  assert.ok(job); checked(`production-not-created-before-collection-${key}`, recipe.equipment_output
    ? JSON.stringify(snapshot.equipment.map(item => item.id).sort()) === JSON.stringify(ownedBefore)
    : Object.entries(outputBefore).every(([resource, quantity]) => (snapshot.resources[resource] || 0) === quantity));
  await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
  checked(`production-reload-keeps-job-${key}`, (await rpc(page, 'dc_get')).production_jobs.filter(value => value.id === job.id).length === 1);
  await command(page, 'advance_production', { job_id: job.id, seconds: job.duration_seconds + 1 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click(); await workshop(page, names[recipe.station]);
  await page.getByRole('button', { name: `Collect ${recipe.name}`, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Production secured.', exact: true })).toBeVisible(); await shot(page, `industry-${key}-receipt`); await closeReward(page);
  return rpc(page, 'dc_get');
}
async function industry() {
  const run = 'industry', { context, page } = await setup();
  await found(page, { run }); await intro(page);
  let snapshot = await rpc(page, 'dc_get'); const introJob = snapshot.expeditions[0];
  await command(page, 'advance_job', { job_id: introJob.id, seconds: 31 }); await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
  await page.getByRole('button', { name: 'Open haul', exact: true }).click(); await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
  for (const [x, y] of [[50, 1], [49, 2], [47, 2], [47, 3], [49, 3]]) snapshot = await harvest(page, x, y);
  checked('industry-inputs-are-really-mined', snapshot.resources.copper_ore === 18 && snapshot.resources.iron_ore === 15 && snapshot.resources.tin_ore === 12 && snapshot.resources.quartz === 8 && snapshot.resources.silver_ore === 3);
  for (const name of ['Iron ore', 'Tin ore', 'Silver ore']) await sale(page, name);
  await build(page, 'Smeltery'); await build(page, 'Gem Workshop'); await build(page, 'Workers’ Quarters');
  snapshot = await rpc(page, 'dc_get'); checked('phase2-buildings-have-real-capacity', snapshot.company.worker_capacity === 6 && snapshot.buildings.filter(value => ['smeltery','gem_workshop','workers_quarters'].includes(value.key)).every(value => value.level === 1));
  const candidate = snapshot.candidates.filter(value => !value.hired).sort((first, second) => first.hire_cost - second.hire_cost)[0], beforeHireCash = snapshot.company.cash;
  await tab(page, 'Crew'); await page.getByRole('group', { name: 'Crew view', exact: true }).getByRole('button', { name: 'Hire', exact: true }).click();
  await page.getByRole('button', { name: `Hire ${candidate.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Confirm hire', exact: true }).click(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get'); const hired = snapshot.workers.find(value => value.id === candidate.id);
  checked('hiring-adds-one-paid-persistent-worker', snapshot.workers.length === 4 && hired?.energy === 6 && hired.wage === candidate.wage && snapshot.company.cash === beforeHireCash - candidate.hire_cost);
  let file = await workerFile(page, hired.name, 'Training'); await file.getByRole('combobox', { name: 'Training skill', exact: true }).selectOption('mining');
  await file.getByRole('button', { name: 'Review training', exact: true }).click(); await page.getByRole('button', { name: 'Confirm training', exact: true }).click(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get'); checked('training-is-paid-and-permanent', snapshot.workers.find(value => value.id === hired.id).base_stats.mining === Math.min(100, hired.base_stats.mining + 3));
  file = await workerFile(page, hired.name, 'Training'); await expect(file.getByRole('button', { name: 'Review training', exact: true })).toBeDisabled(); await clearDialogs(page);
  const beforeSmelt = snapshot.resources.copper_ore; snapshot = await processRecipe(page, 'smelt_copper', { loseAcknowledgement: true });
  checked('smelting-consumes-raw-material-once', snapshot.resources.copper_bar === 2 && snapshot.resources.copper_ore === beforeSmelt - 10);
  snapshot = await processRecipe(page, 'craft_copper_pickaxe'); checked('crafted-gear-has-one-owned-id', snapshot.equipment.length === 1 && snapshot.equipment[0].definition_key === 'copper_pickaxe');
  snapshot = await processRecipe(page, 'polish_quartz'); checked('old-world-quartz-produces-distinct-refined-stock', snapshot.resources.polished_quartz === 3 && snapshot.resources.quartz === 2);
  const item = snapshot.equipment[0], beforeStats = snapshot.workers.find(value => value.id === hired.id).stats.mining;
  file = await workerFile(page, hired.name, 'Gear'); await file.getByRole('button', { name: 'Equip Copper Pickaxe', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm equipment', exact: true }).click(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get'); checked('owned-gear-modifies-real-effective-stats', snapshot.equipment[0].worker_id === hired.id && snapshot.workers.find(value => value.id === hired.id).stats.mining > beforeStats);
  snapshot = await harvest(page, 46, 1, { workers: [hired.name] });
  const worn = snapshot.equipment.find(value => value.id === item.id); checked('completed-config2-job-applies-gear-wear', worn.durability === worn.max_durability - 2);
  file = await workerFile(page, hired.name, 'Gear'); await file.getByRole('button', { name: 'Repair Copper Pickaxe', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm repair', exact: true }).click(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get'); checked('repair-restores-owned-item-condition', snapshot.equipment.find(value => value.id === item.id).durability === item.max_durability);
  file = await workerFile(page, hired.name, 'Gear'); await file.getByRole('button', { name: 'Unequip Copper Pickaxe', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm equipment', exact: true }).click(); await closeReward(page);
  file = await workerFile(page, hired.name, 'Gear'); await file.getByRole('button', { name: 'View Copper Pickaxe', exact: true }).click();
  await page.getByRole('button', { name: 'Retire item', exact: true }).click();
  const beforeRetire = await rpc(page, 'dc_get'); await page.getByRole('button', { name: 'Confirm retirement', exact: true }).click(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get'); checked('retirement-removes-gear-without-a-refund', snapshot.equipment.length === 0 && snapshot.company.cash === beforeRetire.company.cash);
  await fit(page, 'industry-complete-staff'); await shot(page, 'industry-complete-staff');
  await context.close(); console.log('PASS Deep Claim workforce and production industry');
}
// Scenarios use production accessible interactions. Fixture commands only move
// existing server timestamps or interrupt local transport, never award money.
async function main() {
  for (const section of sections) assert.ok(['presentation', 'journey', 'reliability', 'industry'].includes(section), `Unknown Deep Claim QA section ${section}`);
  if (sections.has('presentation')) await presentation();
  if (sections.has('journey')) await journey();
  if (sections.has('reliability')) await reliability();
  if (sections.has('industry')) await industry();
}

try {
  await start(); await main(); checked('no-unhandled-browser-errors', report.runtimeErrors.length === 0, report.runtimeErrors);
  console.log(`PASS Deep Claim browser: ${report.checks.length} checks`);
} catch (error) {
  report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  if (browser) for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    if (page.isClosed()) continue;
    await page.screenshot({ path: join(output, `failure-${index}.png`) }).catch(() => {});
    await writeFile(join(output, `failure-${index}.json`), JSON.stringify(await page.evaluate(() => ({ text: document.body.innerText, route: document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route') })).catch(() => ({})), null, 2));
  }
  if (currentPage && !currentPage.isClosed()) await writeFile(join(output, 'calls.json'), JSON.stringify(await command(currentPage, 'calls').catch(() => []), null, 2));
} finally {
  await writeFile(join(output, 'rpc-calls.json'), JSON.stringify(await endpoint.diagnostics(), null, 2));
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Report:', join(output, 'report.json')); await cleanup();
}

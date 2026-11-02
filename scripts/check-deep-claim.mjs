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
import { runPhase5Browser } from './fixtures/deep-claim-phase5-browser.mjs';
import { installDeepClaimRuntimeProbe, runPhase6Browser } from './fixtures/deep-claim-phase6-browser.mjs';
import { runPhase7Browser } from './fixtures/deep-claim-phase7-browser.mjs';
import { runDeepClaimAcademyBrowser, runDeepClaimCampaignBrowser, runDeepClaimMenuBrowser } from './fixtures/deep-claim-training-browser.mjs';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.DEEP_CLAIM_QA_OUTPUT || await mkdtemp(join(tmpdir(), 'deep-claim-'));
await mkdir(output, { recursive: true });
const base = 'http://127.0.0.1:8106', token = randomUUID();
const sections = new Set((process.env.DEEP_CLAIM_QA_SECTION || 'publisher,presentation,quotes,menus,journey,reliability,industry,field,caverns,business,social,runtime,deep,menu,training').split(','));
const visualMatrix = process.env.DEEP_CLAIM_QA_VISUAL_MATRIX === '1';
const visualCases = visualMatrix
  ? [[320,568,'dark','no-preference'],[320,568,'light','no-preference'],[844,390,'dark','no-preference'],[844,390,'light','no-preference'],[1440,900,'dark','no-preference'],[1440,900,'light','no-preference'],[390,844,'dark','reduce']]
  : [[320,568,'dark','no-preference'],[390,844,'light','no-preference'],[844,390,'dark','no-preference'],[1440,900,'light','no-preference'],[390,844,'dark','reduce']];
const report = { checks: [], errors: [], runtimeErrors: [], artifacts: output,
  visual_matrix: visualMatrix,
  optionalRareRevealDismissals: 0,
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

async function pageFor(context, { runtimeProbe = false } = {}) {
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
  // A real server return can introduce this optional presentation before the
  // player opens its haul, not only after a collection receipt. Let Playwright
  // dismiss exactly this overlay whenever it blocks an ordinary action or
  // assertion. Later never resolves the still-pending specimen; earned manual
  // keep/sell/salvage assertions continue through the actual field log.
  await page.addLocatorHandler(page.getByRole('dialog', { name: 'A find from the deep', exact: true }), async dialog => {
    await dialog.getByRole('button', { name: 'Later', exact: true }).click();
    report.optionalRareRevealDismissals++;
  });
  if (runtimeProbe) await installDeepClaimRuntimeProbe(page);
  return page;
}
async function setup(width = 390, height = 844, theme = 'dark', motion = 'no-preference', options = {}) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: motion,
    ...(options.deviceScaleFactor ? { deviceScaleFactor: options.deviceScaleFactor } : {}), ...(options.isMobile ? { isMobile: true } : {}) });
  return { context, page: await pageFor(context, options), theme };
}
async function go(page, { run = 'main', theme = 'dark', user = DEEP_CLAIM_ACTORS.alex, route = '/deep-claim', enter = true, publisher = 'skip' } = {}) {
  currentPage = page;
  const params = new URLSearchParams({ run, theme, user, token, route });
  await page.goto(`${base}/scripts/fixtures/deep-claim.html?${params}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.deepClaimReady && window.deepClaimQa && window.deepClaimQueryClient);
  await settle(page);
  if (publisher === 'skip' && await page.getByTestId('dh-games-intro').isVisible()) {
    // The finite publisher card may finish its fade during pointer stability
    // checks. Its native Escape shortcut is safe throughout that transition.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dh-games-intro')).toHaveCount(0);
  }
  await settle(page);
  if (enter && route.split('?')[0] === '/deep-claim') await continueCompany(page, { required: false });
}
/** Exercise the production front door; never route around its save checks. */
async function continueCompany(page, { required = true } = {}) {
  const company = page.getByRole('tablist', { name: 'Company views', exact: true });
  const resume = page.getByRole('button', { name: 'Continue', exact: true });
  const start = page.getByRole('button', { name: 'New Game', exact: true });
  // Authorized notification links deliberately open the actual Office. Radix
  // hides the background tablist from accessibility while that dialog is open.
  const linkedOffice = page.getByRole('dialog', { name: 'Company Office', exact: true });
  const publisher = page.getByTestId('dh-games-intro');
  await expect(company.or(resume).or(start).or(linkedOffice).or(publisher).first()).toBeVisible();
  if (await publisher.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(publisher).toHaveCount(0);
  }
  if (await linkedOffice.isVisible()) return;
  if (await company.isVisible()) return;
  await expect(page.getByTestId('deep-claim-title')).toHaveAttribute('data-dc-menu-loading', 'false');
  if (await resume.isEnabled()) {
    await resume.click();
    // Resuming the live guide may immediately open its real planner or camp
    // dialog. Verify the company shell mounted; each caller checks the intended
    // foreground view, without interacting with aria-hidden navigation.
    await expect(page.getByRole('tablist', { name: 'Company views', exact: true, includeHidden: true })).toBeAttached();
  }
  else if (required) await expect(company).toBeVisible();
  await settle(page);
}
async function reloadCompany(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await continueCompany(page);
}
async function dismissTutorial(page) {
  // Founding acknowledges the actual bootstrap before the crew introduction
  // appears. Company navigation alone is therefore too early to infer that
  // guidance has finished mounting. Use its real controls, never an RPC patch.
  const dialogue = page.getByRole('button', { name: 'Skip dialogue', exact: true });
  const exit = page.getByRole('button', { name: 'Exit tutorial', exact: true });
  await expect(dialogue.or(exit).first()).toBeVisible();
  if (await dialogue.isVisible()) await dialogue.click();
  await exit.click();
  await expect(page.getByRole('region', { name: 'Tutorial guidance', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await rpc(page, 'dc_tutorial_get')).campaign_status).toBe('paused');
  // The first-shift guide opens the real planner. Pausing guidance leaves that
  // unpaid draft intact; close it explicitly before testing company navigation.
  const planner = page.getByRole('dialog', { name: 'Extraction', exact: true });
  if (await planner.isVisible()) await planner.getByRole('button', { name: 'Back', exact: true }).click();
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
    for (const dialog of document.querySelectorAll('[role="dialog"].dcl-dialog[data-state="open"]')) {
      if (dialog.closest('[hidden],[aria-hidden="true"],[inert]') || !dialog.getBoundingClientRect().width) continue;
      // Read the resolved solid surface, independently of decorative gradients.
      // A transparent panel otherwise lets the live mine obscure item details.
      const surface = document.createElement('canvas'); surface.width = surface.height = 1;
      const paint = surface.getContext('2d'), background = getComputedStyle(dialog).backgroundColor;
      if (paint) {
        paint.fillStyle = background; paint.fillRect(0, 0, 1, 1);
        if (paint.getImageData(0, 0, 1, 1).data[3] < 250) problems.push(`Transparent dialog surface: ${background}`);
      }
    }
    for (const node of document.querySelectorAll('button,a[href],select')) {
      if (!(node instanceof HTMLElement) || node.closest('[hidden],[aria-hidden="true"],[inert]') || node.matches(':disabled')) continue;
      const box = node.getBoundingClientRect(), style = getComputedStyle(node);
      if (!box.width || !box.height || style.display === 'none' || style.visibility === 'hidden') continue;
      if (box.top >= -1 && box.bottom <= innerHeight + 1 && (box.width < 43.5 || box.height < 43.5)) problems.push(`Small command: ${node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 40)}`);
      if (node.closest('[role="dialog"] .dcl-dialog-actions')) {
        if (box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) problems.push(`Confirmation outside viewport: ${node.textContent?.trim()}`);
        else {
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          if (hit && hit !== node && !node.contains(hit)) problems.push(`Occluded confirmation: ${node.textContent?.trim()}`);
        }
      }
    }
    // Instruction actions and fixed reading footers must be genuinely usable,
    // not merely report a 44px layout box underneath an overflow clip. Compact
    // guidance intentionally unmounts its secondary actions, so only retained
    // foreground controls are examined here.
    const panels = '.dct-guidance,.dct-page-footer,.dct-dialogue-controls';
    for (const node of document.querySelectorAll(`${panels.split(',').map(panel => `${panel} :is(button,a[href],select,input:not([type="hidden"]),[role="button"])`).join(',')}`)) {
      if (!(node instanceof HTMLElement) || node.closest('[hidden],[aria-hidden="true"],[inert]') || node.matches(':disabled,[aria-disabled="true"]')) continue;
      const box = node.getBoundingClientRect(), style = getComputedStyle(node), panel = node.closest(panels);
      if (!box.width || !box.height || style.display === 'none' || style.visibility === 'hidden' || !panel) continue;
      const name = node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 44) || node.tagName;
      const boundary = panel.getBoundingClientRect();
      let visible = { left: Math.max(0, box.left, boundary.left), top: Math.max(0, box.top, boundary.top), right: Math.min(innerWidth, box.right, boundary.right), bottom: Math.min(innerHeight, box.bottom, boundary.bottom) };
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const clipping = getComputedStyle(parent), rect = parent.getBoundingClientRect();
        if (/(hidden|clip|scroll|auto)/.test(clipping.overflowX)) { visible.left = Math.max(visible.left, rect.left + parent.clientLeft); visible.right = Math.min(visible.right, rect.left + parent.clientLeft + parent.clientWidth); }
        if (/(hidden|clip|scroll|auto)/.test(clipping.overflowY)) { visible.top = Math.max(visible.top, rect.top + parent.clientTop); visible.bottom = Math.min(visible.bottom, rect.top + parent.clientTop + parent.clientHeight); }
      }
      if (visible.right - visible.left < 43.5 || visible.bottom - visible.top < 43.5) problems.push(`Clipped training target: ${name}`);
      if (visible.left > box.left + 1 || visible.top > box.top + 1 || visible.right < box.right - 1 || visible.bottom < box.bottom - 1) problems.push(`Training action outside its visible panel: ${name}`);
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      if (!hit || hit !== node && !node.contains(hit)) problems.push(`Occluded training action: ${name}`);
    }
    return problems;
  });
  checked(`layout-${label}`, issues.length === 0, issues);
}

async function found(page, options = {}) {
  const { guided = false, ...entry } = options;
  await go(page, { ...entry, enter: false });
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Skip introduction', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Company name', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill('Flint & Vale Mining');
  await page.getByRole('button', { name: 'Review deed', exact: true }).click();
  await page.getByRole('button', { name: 'Found company', exact: true }).click();
  if (guided) await expect(page.locator('[data-dialogue-scene="opening.crew"]')).toBeVisible();
  else { await dismissTutorial(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible(); }
  return rpc(page, 'dc_get');
}
async function tab(page, label) {
  const choice = page.getByRole('tablist', { name: 'Company views', exact: true }).getByRole('tab', { name: new RegExp(`^${label}(?:\\s|$)`) });
  await choice.click(); await expect(choice).toHaveAttribute('aria-selected', 'true'); await settle(page);
}
async function closeReward(page) {
  await page.getByRole('button', { name: 'Back to the claim', exact: true }).click();
  await settle(page);
  // The exact optional-reveal handler also runs before this auto-wait assertion.
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function intro(page, { confirm = true } = {}) {
  await tab(page, 'Surface');
  await page.getByRole('button', { name: 'Start first shift · 30s', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Extraction' });
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
async function publisherIntro() {
  for (const [width, height, theme, motion, mode] of [[320,568,'dark','no-preference','auto'],[844,390,'light','no-preference','keyboard'],[1440,900,'dark','no-preference','button'],[390,844,'dark','reduce','reduced']]) {
    const { context, page } = await setup(width, height, theme, motion, { runtimeProbe: true, isMobile: width < 900 });
    await go(page, { run: 'publisher-opening', theme, enter: false, publisher: 'watch' });
    const intro = page.getByTestId('dh-games-intro'), skip = page.getByRole('button', { name: 'Skip intro', exact: true });
    await expect(intro).toBeVisible();
    await expect(page.getByTestId('deep-claim-shell')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('button', { name: 'New Game', exact: true })).toHaveCount(0);
    const visible = await skip.evaluate(node => {
      const box = node.getBoundingClientRect();
      return { width: box.width, height: box.height, hit: node.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)),
        inert: document.querySelector('[data-testid="deep-claim-shell"]').inert, overflow: document.documentElement.scrollWidth > innerWidth + 2 };
    });
    checked(`publisher-brand-and-skip-fit-${width}x${height}`, visible.width >= 44 && visible.height >= 44 && visible.hit && visible.inert && !visible.overflow, visible);
    await expect(intro.locator('[data-dh-games-logo]')).toBeVisible();
    await page.screenshot({ path: join(output, `publisher-${width}x${height}.png`) });
    checked(`publisher-no-autoplay-or-bootstrap-${width}x${height}`, await page.evaluate(() => window.deepClaimRuntime.contexts.length === 0) && !(await command(page, 'calls')).some(call => call.name === 'dc_bootstrap'));
    if (mode === 'auto') {
      await expect(intro).toHaveAttribute('data-phase', 'fade', { timeout: 5000 });
      await page.waitForTimeout(650);
      const opacity = await intro.evaluate(node => Number(getComputedStyle(node).opacity));
      checked('publisher-crossfade-reveals-the-real-menu', opacity > 0 && opacity < 1, { opacity });
      await page.screenshot({ path: join(output, 'publisher-crossfade.png') });
      await expect(intro).toHaveCount(0, { timeout: 3500 });
    } else if (mode === 'reduced') {
      await expect(intro).toHaveAttribute('data-reduced-motion', 'true');
      await expect(intro).toHaveCount(0, { timeout: 2500 });
    } else if (mode === 'keyboard') await page.keyboard.press('Escape');
    else await skip.click();
    await expect(intro).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New Game', exact: true })).toBeFocused();
    await expect(page.getByTestId('deep-claim-shell')).not.toHaveAttribute('aria-hidden', 'true');
    await fit(page, `publisher-menu-${width}x${height}`);
    checked(`publisher-hands-off-to-usable-menu-${width}x${height}`, true);
    await context.close();
  }
  console.log('PASS DH Games publisher opening, crossfade, skip and reduced motion');
}

async function presentation() {
  const cases = visualCases;
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
        const explore = await operationPlan(page, 'Exploration', { review: false });
        await explore.getByRole('button', { name: 'Review dispatch', exact: true }).click();
        await expect(explore.getByRole('button', { name: 'Dispatch crew', exact: true })).toBeEnabled();
        await expect(explore.getByText('20 min', { exact: true }).last()).toBeVisible();
        await fit(page, `${label}-exploration-menu`); await shot(page, `${label}-exploration-menu`);
        await page.keyboard.press('Escape');
        for (const mode of ['Survey', 'Infrastructure']) {
          const operation = await operationPlan(page, mode, { x: 48, y: 4, review: false });
          await expect(operation.getByRole('group', { name: 'Expedition type' }).getByRole('button')).toHaveCount(4);
          await fit(page, `${label}-${mode.toLowerCase()}-plan`); await shot(page, `${label}-${mode.toLowerCase()}-plan`);
          await operation.getByRole('button', { name: 'Review dispatch', exact: true }).click();
          await expect(operation.getByRole('region', { name: 'Verified dispatch estimate' })).toBeVisible();
          // Surveys are affordable immediately; infrastructure honestly shows
          // required materials until they have actually been mined.
          if (mode === 'Survey') await expect(operation.getByRole('button', { name: 'Dispatch crew', exact: true })).toBeEnabled();
          else await expect(operation.getByRole('button', { name: 'Dispatch crew', exact: true })).toHaveCount(0);
          await fit(page, `${label}-${mode.toLowerCase()}-review`); await page.keyboard.press('Escape');
        }
      }
      if (name === 'Settings') {
        const settingsViews = page.getByRole('tablist', { name: 'Camp settings views', exact: true });
        await settingsViews.getByRole('tab', { name: 'Sound', exact: true }).click();
        await expect(page.getByRole('switch', { name: 'Enable sound', exact: true })).toHaveAttribute('aria-checked', 'false');
        await settingsViews.getByRole('tab', { name: 'Visuals', exact: true }).click();
        if (motion === 'reduce') await expect(page.getByRole('switch', { name: 'Reduced motion', exact: true })).toHaveAttribute('aria-checked', 'true');
        await page.getByRole('switch', { name: 'Reduced graphics', exact: true }).click();
        await expect(page.getByRole('switch', { name: 'Reduced graphics', exact: true })).toHaveAttribute('aria-checked', 'true');
        await settingsViews.getByRole('tab', { name: 'Updates', exact: true }).click();
        const preference = page.getByRole('switch', { name: 'Deep Claim notifications', exact: true });
        await expect(preference).toBeEnabled(); await expect(preference).toHaveAttribute('aria-checked', 'true');
        await preference.click(); await expect(preference).toBeEnabled(); await expect(preference).toHaveAttribute('aria-checked', 'false');
        await reloadCompany(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible(); await tab(page, 'Settings');
        await settingsViews.getByRole('tab', { name: 'Updates', exact: true }).click();
        await expect(preference).toBeEnabled(); await expect(preference).toHaveAttribute('aria-checked', 'false');
        await preference.click(); await expect(preference).toBeEnabled(); await expect(preference).toHaveAttribute('aria-checked', 'true');
        checked(`global-notification-preferences-save-and-reload-under-own-RLS-${label}`, true);
      }
      if (name === 'Crew') {
        await page.getByRole('group', { name: 'Crew view', exact: true }).getByRole('button', { name: 'Hire', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Hiring', exact: true })).toBeVisible();
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
    await page.keyboard.press('Escape');
    const after = await rpc(page, 'dc_get');
    checked(`review-never-spends-resources-${label}`, initial.company.cash === after.company.cash && after.workers.every(worker => worker.energy === 6) && after.expeditions.length === 0);
    await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
    await page.getByRole('dialog', { name: 'Buildings' }).getByRole('button', { name: /Warehouse/ }).click();
    await expect(page.getByRole('dialog', { name: 'Warehouse', exact: true })).toBeVisible();
    await fit(page, `${label}-upgrade-menu`); await shot(page, `${label}-upgrade-menu`); await page.keyboard.press('Escape');
    for (const view of ['Company', 'Research', 'Contracts', 'Records']) {
      const office = await officeView(page, view);
      await fit(page, `${label}-office-${view.toLowerCase()}`); await shot(page, `${label}-office-${view.toLowerCase()}`);
      if (view === 'Research') { await office.getByRole('button', { name: 'Review Cutting Methods', exact: true }).click(); await expect(office.getByRole('button', { name: 'Start research', exact: true })).toBeDisabled(); }
      if (view === 'Contracts') { await office.getByRole('button', { name: 'Review order Yard Foundations', exact: true }).click(); await expect(office.getByRole('button', { name: 'Deliver whole order', exact: true })).toBeDisabled(); }
      if (view === 'Records') { await office.getByRole('button', { name: 'Review milestone First Shift', exact: true }).click(); await expect(office.getByRole('button', { name: 'Claim company credits', exact: true })).toBeDisabled(); }
      if (view !== 'Company') await fit(page, `${label}-office-${view.toLowerCase()}-review`);
      await page.keyboard.press('Escape');
    }
    await page.getByRole('tab', { name: 'Surface', exact: true }).focus(); await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toBeFocused();
    await page.keyboard.press('Home'); await expect(page.getByRole('tab', { name: 'Surface', exact: true })).toBeFocused();
    checked(`keyboard-company-navigation-${label}`, true);
    await context.close(); console.log('PASS Deep Claim presentation', label);
  }
}
/** Financial totals remain beside confirmation while the actual details scroll. */
async function quotes() {
  const run = 'transaction-quotes';
  let { context, page } = await setup();
  await found(page, { run }); await intro(page);
  let snapshot = await rpc(page, 'dc_get');
  await command(page, 'advance_job', { job_id: snapshot.expeditions[0].id, seconds: 31 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
  await page.getByRole('button', { name: 'Open haul', exact: true }).click();
  await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get');
  const economicState = value => ({ cash: value.company.cash, resources: value.resources, workers: value.workers,
    expeditions: value.expeditions, buildings: value.buildings, equipment: value.equipment, jobs: value.production_jobs, business: value.business });
  const before = economicState(snapshot), warehouseCost = snapshot.buildings.find(value => value.key === 'warehouse').upgrade_cost;
  assert.equal(warehouseCost, 60); assert.equal(snapshot.resources.coal, 10);
  await context.close();
  const cases = [[320,568,'dark','no-preference'],[320,568,'light','no-preference'],[844,390,'dark','no-preference'],[844,390,'light','no-preference'],[1440,900,'dark','no-preference'],[1440,900,'light','no-preference'],[390,844,'dark','reduce']];
  async function review(dialog, title, amount, action, label) {
    const details = dialog.getByRole('region', { name: `${title} details`, exact: true });
    const summary = dialog.getByRole('group', { name: 'Transaction summary', exact: true });
    await expect(details.locator('.dcl-trade-summary strong')).toHaveText(`${amount} cr`);
    await expect(summary).toContainText(`${amount} cr`);
    await details.focus(); await expect(details).toBeFocused();
    await page.keyboard.press('PageDown'); await page.keyboard.press('PageDown');
    const hasOverflow = await details.evaluate(node => node.scrollHeight > node.clientHeight + 2);
    if (hasOverflow) await expect.poll(() => details.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    await expect(summary).toBeInViewport({ ratio: 1 });
    await expect(action).toBeInViewport({ ratio: 1 });
    const reachable = await summary.evaluate(node => {
      const box = node.getBoundingClientRect(), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return !!hit && (hit === node || node.contains(hit));
    });
    checked(`fixed-transaction-summary-${label}`, reachable, { amount, details_scrollable: hasOverflow });
    await fit(page, `quotes-${label}`); await shot(page, `quotes-${label}`);
  }
  for (const [width, height, theme, motion] of cases) {
    ({ context, page } = await setup(width, height, theme, motion));
    const label = `${width}x${height}-${theme}-${motion}`;
    await go(page, { run, theme });
    await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
    await page.getByRole('dialog', { name: 'Buildings', exact: true }).getByRole('button', { name: /Warehouse/ }).click();
    const warehouse = page.getByRole('dialog', { name: 'Warehouse', exact: true });
    await review(warehouse, 'Warehouse', warehouseCost, warehouse.getByRole('button', { name: 'Confirm upgrade', exact: true }), `${label}-upgrade`);
    await clearDialogs(page);
    await stockMaterial(page, 'Coal'); await page.getByRole('button', { name: 'Sell Coal', exact: true }).click();
    const saleReview = page.getByRole('dialog', { name: 'Sell Coal', exact: true });
    await saleReview.getByRole('spinbutton', { name: 'Quantity to sell', exact: true }).fill('3');
    await review(saleReview, 'Sell Coal', 12, saleReview.getByRole('button', { name: 'Confirm sale', exact: true }), `${label}-sale`);
    await clearDialogs(page);
    await workshop(page, 'Smeltery'); await page.getByRole('button', { name: 'Review Smelt Copper', exact: true }).click();
    const recipe = page.getByRole('dialog', { name: 'Smelt Copper', exact: true });
    await recipe.getByRole('spinbutton', { name: 'Production batches', exact: true }).fill('2');
    const fee = snapshot.recipes.find(value => value.key === 'smelt_copper').cash_cost * 2;
    await expect(recipe.getByRole('group', { name: 'Transaction summary', exact: true })).toContainText(/2.*reserve|reserve.*2/i);
    await review(recipe, 'Smelt Copper', fee, recipe.getByRole('button', { name: 'Review batch', exact: true }), `${label}-batch`);
    await clearDialogs(page);
    assert.deepEqual(economicState(await rpc(page, 'dc_get')), before, 'Reading or scrolling a fixed transaction quote must never spend or create output');
    checked(`quote-reviews-never-spend-${label}`, true);
    await context.close();
  }
  console.log('PASS Deep Claim fixed transaction summaries and keyboard-scrolled review details');
}
async function journey() {
  const run = 'journey', { context, page } = await setup();
  await found(page, { run }); await intro(page);
  let saved = await rpc(page, 'dc_get'), job = saved.expeditions[0];
  checked('tutorial-dispatch-is-authoritative', job.duration_seconds === 30 && saved.company.cash === 173 && saved.workers.every(worker => worker.energy === 5) && job.cargo === null);
  await tab(page, 'Mine'); await shot(page, 'journey-active-mine');
  await reloadCompany(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
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
  await page.getByRole('dialog', { name: 'Buildings' }).getByRole('button', { name: /Warehouse/ }).click();
  await page.getByRole('button', { name: 'Confirm upgrade', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Warehouse upgraded.', exact: true })).toBeVisible(); await closeReward(page);
  saved = await rpc(page, 'dc_get'); checked('real-upgrade-doubles-storage-and-spends-once', saved.company.cash === 133 && saved.company.warehouse_capacity === 240);
  let dialog = await operationPlan(page, 'Exploration', { review: false });
  await dialog.getByRole('combobox', { name: 'Expedition worksite' }).selectOption('47:4');
  await selectCrew(dialog, ['Mara Flint']);
  await dialog.getByRole('button', { name: 'Review dispatch', exact: true }).click(); await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
  saved = await rpc(page, 'dc_get'); job = saved.expeditions.find(value => value.status === 'active');
  checked('normal-exploration-hides-future-ground', job.duration_seconds === 1200 && job.cargo === null && !saved.world.tiles.some(tile => tile.x === 47 && tile.y === 4));
  await command(page, 'advance_job', { job_id: job.id, seconds: 1201 }); await reloadCompany(page);
  await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
  saved = await rpc(page, 'dc_get'); checked('offline-return-reconciles-only-real-work', saved.expeditions.find(value => value.id === job.id).status === 'ready' && saved.world.tiles.some(tile => tile.x === 47 && tile.y === 4) && saved.workers.find(worker => worker.name === 'Mara Flint').assigned_job_id === null);
  await tab(page, 'Mine'); await shot(page, 'journey-expanded-mine'); await context.close(); console.log('PASS Deep Claim journey');
}
async function reliability() {
  const run = 'reliability', { context, page } = await setup();
  await found(page, { run }); await intro(page, { confirm: false });
  await command(page, 'fail_next', { name: 'dc_dispatch_operation', after_commit: true });
  await page.getByRole('dialog', { name: 'Extraction' }).getByRole('button', { name: 'Dispatch crew', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Confirm sync', exact: true })).toBeVisible();
  let saved = await rpc(page, 'dc_get'); const job = saved.expeditions[0];
  checked('lost-ack-commits-one-dispatch', saved.expeditions.length === 1 && saved.company.cash === 173);
  await reloadCompany(page); await expect(page.getByRole('button', { name: 'Confirm sync', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm sync', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saved action confirmed.', exact: true })).toBeVisible(); await closeReward(page);
  saved = await rpc(page, 'dc_get'); checked('reload-retries-the-original-receipt-once', saved.expeditions.length === 1 && saved.expeditions[0].id === job.id && saved.company.cash === 173);
  const dispatchCalls = (await command(page, 'calls')).filter(value => value.name === 'dc_dispatch_operation');
  checked('lost-ack-retry-keeps-request-identity', dispatchCalls.length === 2 && dispatchCalls[0].args.p_request_id === dispatchCalls[1].args.p_request_id);
  await context.setOffline(true); await expect(page.getByText('Saved camp · read-only until reconnected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dispatch another crew', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Buildings' }).getByRole('button', { name: /Warehouse/ }).click();
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
async function selectCrew(dialog, names) {
  await dialog.getByRole('button', { name: 'Change crew', exact: true }).click();
  const previous = dialog.getByRole('button', { name: 'Previous crew page', exact: true });
  const next = dialog.getByRole('button', { name: 'Next crew page', exact: true });
  // Clear unwanted selected workers before filling other slots. The real UI
  // enforces the three-person crew cap while switching a saved crew.
  for (const checking of [false, true]) {
    for (let index = 0; index < 3 && await previous.isVisible() && await previous.isEnabled(); index++) await previous.click();
    for (let index = 0; index < 3; index++) {
      for (const choice of await dialog.getByRole('checkbox', { name: /^Send / }).all()) {
        const wanted = names.includes((await choice.getAttribute('aria-label')).slice(5));
        if (!checking && !wanted && await choice.isChecked()) await choice.uncheck();
        if (checking && wanted) await choice.check();
      }
      if (!await next.isVisible() || !await next.isEnabled()) break;
      await next.click();
    }
  }
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
}
async function operationPlan(page, mode, { x, y, infrastructure = 'supports', review = true, workers } = {}) {
  await clearDialogs(page); await tab(page, 'Mine');
  await page.getByRole('button', { name: 'Open mine operations', exact: true }).click();
  await page.getByRole('dialog', { name: 'Underground operations', exact: true }).getByRole('group', { name: 'Mine operations', exact: true }).getByRole('button', { name: new RegExp(`^${mode}(?:\\s|$)`) }).click();
  const title = mode === 'Survey' ? 'Survey' : mode === 'Infrastructure' ? 'Infrastructure' : mode === 'Extraction' ? 'Extraction' : 'Exploration';
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  const worksite = dialog.getByRole('combobox', { name: 'Expedition worksite', exact: true });
  assert.ok(await worksite.locator('option').count() <= 65, 'Native worksite controls must stay bounded, including a selected map target');
  if (x !== undefined) {
    if (!await worksite.locator(`option[value="${x}:${y}"]`).count()) await dialog.getByRole('searchbox', { name: 'Depth or material', exact: true }).fill(`${x}:${y}`);
    await worksite.selectOption(`${x}:${y}`);
  }
  if (mode === 'Infrastructure') await dialog.getByRole('combobox', { name: 'Infrastructure project', exact: true }).selectOption(infrastructure);
  if (workers) await selectCrew(dialog, workers);
  if (review) {
    await dialog.getByRole('button', { name: 'Review dispatch', exact: true }).click();
    await expect(dialog.getByRole('region', { name: 'Verified dispatch estimate' })).toBeVisible();
  }
  return dialog;
}
async function harvest(page, x, y, { workers } = {}) {
  await clearDialogs(page); await tab(page, 'Surface');
  await page.getByRole('button', { name: 'Extract', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Extraction', exact: true });
  await dialog.getByRole('combobox', { name: 'Expedition worksite', exact: true }).selectOption(`${x}:${y}`);
  if (workers) await selectCrew(dialog, workers);
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
async function stockMaterial(page, name, { allMaterials = false } = {}) {
  await tab(page, 'Stores');
  await page.getByRole('group', { name: 'Stores view', exact: true }).getByRole('button', { name: 'Stock', exact: true }).click();
  await page.getByRole('group', { name: 'Stock filter', exact: true }).getByRole('button', { name: allMaterials ? 'All materials' : 'In stock', exact: true }).click();
  await page.getByRole('group', { name: 'Material category', exact: true }).getByRole('button', { name: /^All(?:\s|$)/ }).click();
  await settle(page);
  const previous = page.getByRole('button', { name: 'Previous materials', exact: true });
  for (let step = 0; step < 4 && await previous.isEnabled(); step++) await previous.click();
  for (let step = 0; step < 4; step++) {
    const material = page.getByRole('button', { name: `Inspect ${name}`, exact: true });
    if (await material.isVisible()) return material;
    const next = page.getByRole('button', { name: 'Next materials', exact: true });
    if (!await next.isEnabled()) break;
    await next.click();
  }
  throw new Error(`Stored material is not reachable through inventory pages: ${name}`);
}
async function sale(page, name, quantity) {
  await stockMaterial(page, name);
  await page.getByRole('button', { name: `Sell ${name}`, exact: true }).click();
  if (quantity !== undefined) await page.getByRole('dialog', { name: `Sell ${name}`, exact: true }).getByRole('spinbutton', { name: 'Quantity to sell', exact: true }).fill(String(quantity));
  await page.getByRole('button', { name: 'Confirm sale', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Trade recorded.', exact: true })).toBeVisible(); await closeReward(page);
}
async function build(page, name) {
  await clearDialogs(page); await tab(page, 'Surface');
  await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Buildings', exact: true }).getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
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
async function officeView(page, view) {
  await clearDialogs(page); await tab(page, 'Surface');
  await page.getByRole('button', { name: 'Open company office', exact: true }).click();
  const office = page.getByRole('dialog', { name: 'Company Office', exact: true });
  await office.getByRole('group', { name: 'Company office views', exact: true }).getByRole('button', { name: new RegExp(`^${view}(?:\\s|\\d|$)`) }).click();
  return office;
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
    await expect(dialog.getByRole('alert')).toBeVisible(); await reloadCompany(page);
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
  await reloadCompany(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
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

/** Populated menus use one genuinely earned company, then fresh themed clients. */
async function menus() {
  const run = 'populated-menus';
  const cases = [[320,568,'dark','no-preference'],[320,568,'light','no-preference'],[844,390,'dark','no-preference'],[844,390,'light','no-preference'],[1440,900,'dark','no-preference'],[1440,900,'light','no-preference'],[390,844,'dark','reduce']];
  let { context, page } = await setup();
  await found(page, { run }); await intro(page);
  let snapshot = await rpc(page, 'dc_get');
  await command(page, 'advance_job', { job_id: snapshot.expeditions[0].id, seconds: 31 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
  await page.getByRole('button', { name: 'Open haul', exact: true }).click();
  await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
  // Five real one-energy shifts exhaust Mara's remaining daily energy. Ivo
  // later wears the actually crafted pickaxe on the last authored clay seam.
  for (const [x, y] of [[50,1],[49,2],[47,2],[47,3],[49,3]]) snapshot = await harvest(page, x, y, { workers: ['Mara Flint'] });
  checked('menus-stock-comes-from-paid-finite-starter-seams', snapshot.resources.copper_ore === 18 && snapshot.resources.iron_ore === 15
    && snapshot.resources.tin_ore === 12 && snapshot.resources.quartz === 8 && snapshot.resources.silver_ore === 3);
  await sale(page, 'Silver ore'); await sale(page, 'Iron ore', 3); await sale(page, 'Copper ore', 8); await sale(page, 'Tin ore', 2);
  await build(page, 'Smeltery'); await build(page, 'Research Office');
  await processRecipe(page, 'smelt_copper'); snapshot = await processRecipe(page, 'craft_copper_pickaxe');
  const item = snapshot.equipment.find(value => value.definition_key === 'copper_pickaxe'); assert.ok(item);
  let file = await workerFile(page, 'Ivo Vale', 'Gear');
  await file.getByRole('button', { name: 'Equip Copper Pickaxe', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm equipment', exact: true }).click(); await closeReward(page);
  snapshot = await harvest(page, 46, 1, { workers: ['Ivo Vale'] });
  checked('menus-gear-is-owned-assigned-and-really-worn', snapshot.equipment.find(value => value.id === item.id)?.durability === item.max_durability - 2
    && snapshot.equipment.find(value => value.id === item.id)?.worker_id === snapshot.workers.find(value => value.name === 'Ivo Vale').id
    && snapshot.resources.clay === 16 && snapshot.resources.copper_bar === 1);
  const economicState = value => ({ cash: value.company.cash, resources: value.resources, equipment: value.equipment,
    workers: value.workers, buildings: value.buildings, jobs: value.production_jobs, research: value.business.research });
  const beforeMenus = economicState(snapshot);
  await context.close();

  async function visitCases(visit) {
    for (const [width, height, theme, motion] of cases) {
      const client = await setup(width, height, theme, motion), label = `${width}x${height}-${theme}-${motion}`;
      context = client.context; page = client.page;
      await go(page, { run, theme });
      await visit(page, label, motion);
      await context.close();
    }
  }
  await visitCases(async (client, label, motion) => {
    await (await stockMaterial(client, 'Coal')).click();
    let detail = client.getByRole('dialog', { name: 'Coal', exact: true });
    await expect(detail.getByRole('region', { name: 'Used in production', exact: true })).toBeVisible();
    await expect(detail.getByText('Dark fuel seams that power the frontier.', { exact: true })).toHaveCount(0);
    await expect(detail.getByRole('button', { name: 'Sell Coal', exact: true })).toBeEnabled();
    await fit(client, `menus-${label}-material-detail`); await shot(client, `menus-${label}-material-detail`);
    // Inspection hands off to the existing sale confirmation, without selling.
    await detail.getByRole('button', { name: 'Sell Coal', exact: true }).click();
    await expect(client.getByRole('dialog', { name: 'Sell Coal', exact: true }).getByRole('button', { name: 'Confirm sale', exact: true })).toBeEnabled();
    await fit(client, `menus-${label}-sale-review`); await clearDialogs(client);
    await stockMaterial(client, 'Coal', { allMaterials: true });
    await client.getByRole('button', { name: 'Next materials', exact: true }).click();
    await expect(client.getByRole('button', { name: 'Inspect Quartz', exact: true })).toBeVisible();
    await client.getByRole('button', { name: 'Previous materials', exact: true }).click();
    await expect(client.getByRole('button', { name: 'Inspect Coal', exact: true })).toBeVisible();
    const category = client.getByRole('group', { name: 'Material category', exact: true });
    await category.getByRole('button', { name: /^Refined/ }).click();
    await client.getByRole('button', { name: 'Inspect Copper bar', exact: true }).click();
    detail = client.getByRole('dialog', { name: 'Copper bar', exact: true });
    await expect(detail.getByRole('button', { name: 'Sell Copper bar', exact: true })).toBeEnabled();
    await fit(client, `menus-${label}-refined-detail`); await shot(client, `menus-${label}-refined-detail`);
    await detail.getByRole('button', { name: 'Back to inventory', exact: true }).click();
    await category.getByRole('button', { name: /^Crystals/ }).click();
    await expect(client.getByRole('button', { name: 'Inspect Quartz', exact: true })).toBeVisible();
    await fit(client, `menus-${label}-crystal-inventory`); await shot(client, `menus-${label}-crystal-inventory`);

    file = await workerFile(client, 'Ivo Vale', 'Overview');
    await fit(client, `menus-${label}-worker-overview`); await shot(client, `menus-${label}-worker-overview`);
    await file.getByRole('group', { name: 'Worker file views', exact: true }).getByRole('button', { name: 'Training', exact: true }).click();
    await expect(file.getByRole('combobox', { name: 'Training skill', exact: true })).toBeEnabled();
    await fit(client, `menus-${label}-training`);
    await file.getByRole('group', { name: 'Worker file views', exact: true }).getByRole('button', { name: 'Gear', exact: true }).click();
    await expect(file.getByRole('progressbar', { name: 'Copper Pickaxe condition', exact: true })).toHaveAttribute('aria-valuenow', String(item.max_durability - 2));
    await fit(client, `menus-${label}-equipped-gear`); await shot(client, `menus-${label}-equipped-gear`);
    await file.getByRole('button', { name: 'View Copper Pickaxe', exact: true }).click();
    await expect(client.getByRole('dialog', { name: 'Copper Pickaxe', exact: true })).toBeVisible();
    await fit(client, `menus-${label}-gear-detail`); await client.keyboard.press('Escape');
    await file.getByRole('button', { name: 'Repair Copper Pickaxe', exact: true }).click();
    await expect(client.getByRole('dialog', { name: 'Repair Copper Pickaxe', exact: true }).getByRole('button', { name: 'Confirm repair', exact: true })).toBeEnabled();
    await fit(client, `menus-${label}-repair-review`); await shot(client, `menus-${label}-repair-review`); await clearDialogs(client);

    await tab(client, 'Settings');
    const settings = client.getByRole('tablist', { name: 'Camp settings views', exact: true });
    await settings.getByRole('tab', { name: 'Sound', exact: true }).click();
    await expect(client.getByRole('switch', { name: 'Enable sound', exact: true })).toHaveAttribute('aria-checked', 'false');
    for (const name of ['Game sound volume','Music volume','Mining effects volume','Camp ambience volume']) {
      const slider = client.getByRole('slider', { name, exact: true }), value = await slider.inputValue();
      await slider.focus(); await client.keyboard.press('ArrowLeft'); await client.keyboard.press('ArrowRight');
      await expect(slider).toHaveValue(value);
    }
    await fit(client, `menus-${label}-sound-settings`); await shot(client, `menus-${label}-sound-settings`);
    await settings.getByRole('tab', { name: 'Visuals', exact: true }).click();
    if (motion === 'reduce') await expect(client.getByRole('switch', { name: 'Reduced motion', exact: true })).toHaveAttribute('aria-checked', 'true');
    await fit(client, `menus-${label}-visual-settings`); await shot(client, `menus-${label}-visual-settings`);
    await settings.getByRole('tab', { name: 'Updates', exact: true }).click();
    await expect(client.getByRole('switch', { name: 'Deep Claim notifications', exact: true })).toBeEnabled();
    await fit(client, `menus-${label}-update-settings`); await shot(client, `menus-${label}-update-settings`);
  });

  ({ context, page } = await setup(320,568)); await go(page, { run });
  snapshot = await rpc(page, 'dc_get');
  assert.deepEqual(economicState(snapshot), beforeMenus, 'Inspecting inventory, reviewing repair and mixing settings must not mutate the earned economy');
  checked('populated-menus-inspection-never-spends-or-duplicates-stock', true);
  let office = await officeView(page, 'Research');
  await office.getByRole('group', { name: 'Research branches', exact: true }).getByRole('button', { name: /^Geology/ }).click();
  await office.getByRole('button', { name: 'Review Field Assaying', exact: true }).click();
  await office.getByRole('button', { name: 'Start research', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Research underway.', exact: true })).toBeVisible(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get'); const cashAfterResearch = snapshot.company.cash;
  await command(page, 'advance_research', { research_key: 'geology_1', seconds: 150 }); await context.close();
  await visitCases(async (client, label) => {
    office = await officeView(client, 'Research');
    await office.getByRole('group', { name: 'Research branches', exact: true }).getByRole('button', { name: /^Geology/ }).click();
    const progress = office.getByRole('progressbar', { name: 'Research elapsed time', exact: true });
    await expect(office.locator('[data-research-phase="working"]')).toBeVisible();
    const percent = Number(await progress.getAttribute('aria-valuenow'));
    checked(`research-authoritative-progress-${label}`, percent >= 49 && percent < 100, { percent });
    await fit(client, `menus-${label}-research-working`); await shot(client, `menus-${label}-research-working`);
  });
  ({ context, page } = await setup(320,568)); await go(page, { run });
  snapshot = await rpc(page, 'dc_get');
  const research = snapshot.business.research.find(value => value.key === 'geology_1');
  assert.equal(research.status, 'active');
  const remaining = (Date.parse(research.completes_at) - Date.parse(snapshot.server_now)) / 1000;
  assert.ok(remaining > 10, 'The bounded menu matrix must finish within the real research duration');
  await command(page, 'advance_research', { research_key: research.key, seconds: remaining - 8 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
  office = await officeView(page, 'Research');
  await office.getByRole('group', { name: 'Research branches', exact: true }).getByRole('button', { name: /^Geology/ }).click();
  await command(page, 'hold', { name: 'dc_get' });
  try {
    await expect(office.locator('[data-research-phase="awaiting-report"]')).toBeVisible({ timeout: 12000 });
    await expect(office.getByRole('progressbar', { name: 'Research elapsed time', exact: true })).toHaveAttribute('aria-valuenow', '100');
    const cached = await page.evaluate(() => window.deepClaimQueryClient.getQueriesData({ queryKey: ['deep-claim'] }).find(([, data]) => data?.company)?.[1]);
    checked('elapsed-research-awaits-server-and-does-not-grant-a-local-bonus', cached.business.research.find(value => value.key === 'geology_1').status === 'active'
      && !cached.business.research_bonuses.geology && cached.company.cash === cashAfterResearch);
    await fit(page, 'menus-320x568-research-awaiting-report'); await shot(page, 'menus-320x568-research-awaiting-report');
    await office.getByRole('button', { name: 'Check research completion', exact: true }).click();
  } finally { await command(page, 'release', { name: 'dc_get' }); }
  await expect(office.locator('[data-research-phase]')).toHaveCount(0);
  await expect(office.locator('[data-research-state="complete"]').filter({ has: page.getByRole('heading', { name: 'Field Assaying', exact: true }) })).toBeVisible();
  snapshot = await rpc(page, 'dc_get');
  checked('research-report-confirms-one-paid-completion', snapshot.business.research_bonuses.geology === 4 && snapshot.company.cash === cashAfterResearch
    && snapshot.business.stats.completed_research === 1);
  await fit(page, 'menus-research-completed'); await shot(page, 'menus-research-completed'); await clearDialogs(page);

  // Two actual same-station orders must remain sequential, with no output
  // usable before the authoritative ready state and explicit collection.
  for (const key of ['smelt_tin','smelt_iron']) {
    snapshot = await rpc(page, 'dc_get'); const recipe = snapshot.recipes.find(value => value.key === key);
    await workshop(page, 'Smeltery'); await page.getByRole('button', { name: `Review ${recipe.name}`, exact: true }).click();
    const batch = page.getByRole('dialog', { name: recipe.name, exact: true });
    await batch.getByRole('button', { name: 'Review batch', exact: true }).click();
    await batch.getByRole('button', { name: 'Start production', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Production queued.', exact: true })).toBeVisible(); await closeReward(page);
  }
  snapshot = await rpc(page, 'dc_get'); const tinJob = snapshot.production_jobs.find(value => value.recipe_key === 'smelt_tin' && value.status === 'active');
  const ironJob = snapshot.production_jobs.find(value => value.recipe_key === 'smelt_iron' && value.status === 'active');
  assert.ok(tinJob && ironJob);
  checked('menus-paid-production-queue-has-two-distinct-frozen-orders', Date.parse(ironJob.started_at) >= Date.parse(tinJob.completes_at)
    && !snapshot.resources.tin_bar && !snapshot.resources.iron_bar);
  await command(page, 'advance_production', { job_id: tinJob.id, seconds: tinJob.duration_seconds / 2 }); await context.close();
  await visitCases(async (client, label) => {
    await workshop(client, 'Smeltery');
    const queue = client.getByRole('region', { name: 'Production queue', exact: true });
    await expect(queue.locator('[data-production-state="working"]')).toHaveCount(1);
    await expect(queue.locator('[data-production-state="queued"]')).toHaveCount(1);
    await expect(queue.getByRole('button', { name: /^Collect / })).toHaveCount(0);
    await expect(queue.getByRole('progressbar', { name: 'Smelt Iron elapsed time', exact: true })).toHaveAttribute('aria-valuenow', '0');
    await fit(client, `menus-${label}-production-queue`); await shot(client, `menus-${label}-production-queue`);
  });
  ({ context, page } = await setup(320,568)); await go(page, { run });
  snapshot = await rpc(page, 'dc_get');
  const tin = snapshot.production_jobs.find(value => value.id === tinJob.id), untilReady = (Date.parse(tin.completes_at) - Date.parse(snapshot.server_now)) / 1000;
  assert.ok(untilReady > 10, 'The bounded production matrix must finish before this paid work order returns');
  await command(page, 'advance_production', { job_id: tin.id, seconds: untilReady - 8 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click(); await workshop(page, 'Smeltery');
  await command(page, 'hold', { name: 'dc_get' });
  try {
    await expect(page.locator('[data-production-state="awaiting-confirmation"]')).toHaveCount(1, { timeout: 12000 });
    await expect(page.getByRole('button', { name: 'Collect Smelt Tin', exact: true })).toHaveCount(0);
    await fit(page, 'menus-production-awaiting-confirmation'); await shot(page, 'menus-production-awaiting-confirmation');
    await page.getByRole('button', { name: 'Check production', exact: true }).click();
  } finally { await command(page, 'release', { name: 'dc_get' }); }
  await expect(page.getByRole('button', { name: 'Collect Smelt Tin', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Collect Smelt Iron', exact: true })).toHaveCount(0);
  await fit(page, 'menus-production-confirmed-ready'); await shot(page, 'menus-production-confirmed-ready');
  await page.getByRole('button', { name: 'Collect Smelt Tin', exact: true }).click(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get');
  checked('menus-server-ready-production-collects-only-the-returned-order', snapshot.resources.tin_bar === 2 && !snapshot.resources.iron_bar
    && snapshot.production_jobs.filter(value => value.id === tinJob.id && value.status === 'collected').length === 1
    && snapshot.equipment.filter(value => value.id === item.id).length === 1);
  await context.close(); console.log('PASS Deep Claim populated inventory, research, work orders, crew gear and settings');
}
async function field() {
  const run = 'field', { context, page } = await setup();
  await found(page, { run }); await intro(page);
  let snapshot = await rpc(page, 'dc_get'), job = snapshot.expeditions[0];
  await command(page, 'advance_job', { job_id: job.id, seconds: 31 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
  await page.getByRole('button', { name: 'Open haul', exact: true }).click();
  await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
  snapshot = await harvest(page, 46, 1);
  checked('field-inputs-come-from-real-finite-mining', snapshot.resources.stone === 12 && snapshot.resources.clay === 16 && snapshot.company.cash === 166);
  const beforeBuild = snapshot;
  let dialog = await operationPlan(page, 'Infrastructure', { x: 48, y: 1 });
  await expect(dialog.getByText('Timber Supports · grade 1', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Cash committed now: 19 cr. Project materials, if listed, are also consumed. Keep 2 cr operating reserve.', { exact: true })).toBeVisible();
  await fit(page, 'field-installation-verified-review'); await shot(page, 'field-installation-verified-review');
  await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
  snapshot = await rpc(page, 'dc_get'); job = snapshot.expeditions.find(value => value.status === 'active');
  const structure = snapshot.infrastructure[0];
  checked('installation-charges-inputs-before-real-timed-work', job.mode === 'infrastructure' && job.config_version === 7 && structure.status === 'building'
    && structure.installed_at === null && snapshot.company.cash === beforeBuild.company.cash - 19 && snapshot.resources.stone === 4 && snapshot.resources.clay === 14
    && snapshot.workers.every(value => value.energy === 3) && !snapshot.field_reports.some(value => value.job_id === job.id));
  await reloadCompany(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
  snapshot = await rpc(page, 'dc_get'); checked('installation-reload-never-completes-server-work-early', snapshot.infrastructure[0].id === structure.id && snapshot.infrastructure[0].status === 'building');
  await command(page, 'advance_job', { job_id: job.id, seconds: job.duration_seconds + 1 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click(); snapshot = await rpc(page, 'dc_get');
  checked('installation-return-installs-once-without-empty-haul', snapshot.infrastructure[0].status === 'installed' && snapshot.infrastructure[0].installed_at !== null
    && snapshot.expeditions.find(value => value.id === job.id).status === 'collected' && snapshot.field_reports.filter(value => value.kind === 'infrastructure' && value.job_id === job.id).length === 1);
  const beforeSurvey = snapshot;
  dialog = await operationPlan(page, 'Survey', { x: 48, y: 4 });
  await expect(dialog.getByText('Survey radius', { exact: true })).toBeVisible(); await expect(dialog.getByText('Estimated haul', { exact: true })).toHaveCount(0);
  await fit(page, 'field-survey-verified-review'); await shot(page, 'field-survey-verified-review');
  await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
  snapshot = await rpc(page, 'dc_get'); job = snapshot.expeditions.find(value => value.status === 'active');
  checked('survey-dispatch-does-not-reveal-unknown-ground', JSON.stringify(snapshot.world.tiles) === JSON.stringify(beforeSurvey.world.tiles)
    && snapshot.company.cash === beforeSurvey.company.cash - 7 && JSON.stringify(snapshot.resources) === JSON.stringify(beforeSurvey.resources));
  await command(page, 'advance_job', { job_id: job.id, seconds: job.duration_seconds + 1 });
  await reloadCompany(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
  snapshot = await rpc(page, 'dc_get');
  checked('survey-offline-return-reveals-without-excavation-or-resources', snapshot.expeditions.find(value => value.id === job.id).status === 'collected'
    && snapshot.world.tiles.length > beforeSurvey.world.tiles.length && JSON.stringify(snapshot.resources) === JSON.stringify(beforeSurvey.resources)
    && beforeSurvey.world.tiles.every(point => snapshot.world.tiles.some(value => value.x === point.x && value.y === point.y && value.remaining === point.remaining))
    && snapshot.field_reports.some(value => value.kind === 'survey' && value.job_id === job.id && value.tiles_revealed > 0)
    && JSON.stringify(snapshot.discovery_summary) === JSON.stringify(beforeSurvey.discovery_summary));
  // The authored quartz seam is genuinely finite. Recover its specimen only
  // after the real server operation returns, then reconcile a lost sale ACK.
  await tab(page, 'Surface'); await page.getByRole('button', { name: 'Extract', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Extraction', exact: true });
  await dialog.getByRole('combobox', { name: 'Expedition worksite', exact: true }).selectOption('47:3');
  await dialog.getByRole('button', { name: 'Review dispatch', exact: true }).click();
  await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
  snapshot = await rpc(page, 'dc_get'); job = snapshot.expeditions.find(value => value.status === 'active');
  const pendingBeforeQuartz = snapshot.discovery_summary.pending;
  checked('unrecovered-finds-and-reports-remain-private', !snapshot.discoveries.some(value => value.job_id === job.id) && !snapshot.field_reports.some(value => value.job_id === job.id));
  await command(page, 'advance_job', { job_id: job.id, seconds: job.duration_seconds + 1 });
  await page.getByRole('button', { name: 'Refresh company', exact: true }).click(); snapshot = await rpc(page, 'dc_get');
  const find = snapshot.discoveries.find(value => value.x === 47 && value.y === 3 && value.job_id === job.id); assert.ok(find);
  checked('returned-mining-recovers-a-single-real-specimen', find.kind === 'banded_geode' && find.status === 'pending' && snapshot.discovery_summary.pending === pendingBeforeQuartz + 1
    && snapshot.world.tiles.find(value => value.x === 47 && value.y === 3).remaining === 0);
  await page.getByRole('button', { name: 'Open haul', exact: true }).click(); await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
  await tab(page, 'Surface'); await page.getByRole('button', { name: /^Review finds · \d+$/ }).click();
  await page.getByRole('button', { name: `Inspect ${find.name}`, exact: true }).filter({ hasText: 'x47 · 3m' }).click();
  dialog = page.getByRole('dialog', { name: find.name, exact: true });
  await expect(dialog.getByRole('group', { name: 'Find decision' }).getByRole('button')).toHaveCount(3);
  await dialog.getByRole('group', { name: 'Find decision' }).getByRole('button', { name: /^Sell specimen/ }).click();
  await fit(page, 'field-specimen-decision'); await shot(page, 'field-specimen-decision');
  const beforeSale = await rpc(page, 'dc_get');
  await command(page, 'fail_next', { name: 'dc_resolve_discovery', after_commit: true });
  await dialog.getByRole('button', { name: 'Confirm sale', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible();
  await reloadCompany(page); await expect(page.getByRole('button', { name: 'Confirm sync', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm sync', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saved action confirmed.', exact: true })).toBeVisible(); await closeReward(page);
  snapshot = await rpc(page, 'dc_get');
  const calls = (await command(page, 'calls')).filter(value => value.name === 'dc_resolve_discovery');
  checked('specimen-lost-ack-replays-the-same-decision-once', calls.length === 2 && calls[0].args.p_request_id === calls[1].args.p_request_id
    && snapshot.company.cash === beforeSale.company.cash + find.sale_value && snapshot.discovery_summary.pending === beforeSale.discovery_summary.pending - 1
    && snapshot.discovery_summary.sold === beforeSale.discovery_summary.sold + 1);
  await tab(page, 'Log');
  await page.getByRole('group', { name: 'Field log views', exact: true }).getByRole('button', { name: /^Finds/ }).click();
  await page.getByRole('group', { name: 'Find collection', exact: true }).getByRole('button', { name: 'Resolved', exact: true }).click();
  await page.getByRole('button', { name: `Inspect ${find.name}`, exact: true }).click();
  dialog = page.getByRole('dialog', { name: find.name, exact: true });
  await expect(dialog.getByRole('group', { name: 'Find decision' })).toHaveCount(0); await page.keyboard.press('Escape');
  await page.getByRole('group', { name: 'Field log views', exact: true }).getByRole('button', { name: 'Reports', exact: true }).click();
  checked('field-history-keeps-survey-installation-and-recovery-reports', snapshot.field_reports.some(value => value.kind === 'survey') && snapshot.field_reports.some(value => value.kind === 'infrastructure') && snapshot.field_reports.some(value => value.kind === 'discovery'));
  await fit(page, 'field-complete-reports'); await shot(page, 'field-complete-reports');
  await page.getByRole('button', { name: /^Read report: / }).first().click();
  await page.getByRole('button', { name: 'Locate report site', exact: true }).click();
  await expect(page.getByTestId('deep-claim-map')).toHaveAttribute('data-dc-view', 'mine');
  await fit(page, 'field-report-map-location'); await shot(page, 'field-report-map-location');
  checked('report-location-opens-the-real-persistent-mine', true);
  await context.close(); console.log('PASS Deep Claim underground operations and finite discoveries');
}
async function caverns() {
  // Independent private worlds can place their natural rooms away from the
  // first shaft. Try bounded real companies; never reseed one or mint funds.
  for (let attempt = 0; attempt < 24; attempt++) {
    const run = `caverns-${attempt}`, { context, page } = await setup();
    await found(page, { run }); await intro(page);
    let snapshot = await rpc(page, 'dc_get'); const tutorial = snapshot.expeditions[0];
    await command(page, 'advance_job', { job_id: tutorial.id, seconds: 31 });
    await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
    await page.getByRole('button', { name: 'Open haul', exact: true }).click(); await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
    await sale(page, 'Coal'); await sale(page, 'Stone');
    snapshot = await rpc(page, 'dc_get'); assert.equal(snapshot.company.cash, 225);
    await tab(page, 'Surface'); await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
    await page.getByRole('dialog', { name: 'Buildings', exact: true }).getByRole('button', { name: /Mine Shaft/ }).click();
    await page.getByRole('button', { name: 'Confirm upgrade', exact: true }).click(); await closeReward(page);
    snapshot = await rpc(page, 'dc_get'); assert.equal(snapshot.company.cash, 145); assert.equal(snapshot.world.max_depth, 99);
    const candidate = await command(page, 'cavern_survey_site');
    if (!candidate) { await context.close(); continue; }
    const before = snapshot, dialog = await operationPlan(page, 'Survey', { ...candidate.site, workers: ['Ivo Vale'], review: false });
    await dialog.getByRole('group', { name: 'Shift duration', exact: true }).getByRole('button', { name: /^Deep/ }).click();
    await dialog.getByRole('button', { name: 'Review dispatch', exact: true }).click();
    await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
    snapshot = await rpc(page, 'dc_get'); const job = snapshot.expeditions.find(value => value.status === 'active'); assert.ok(job);
    checked('cavern-survey-uses-earned-upgrade-cash-and-real-worker-energy', snapshot.company.cash < 145
      && snapshot.workers.find(value => value.name === 'Ivo Vale').energy === 2 && snapshot.workers.filter(value => value.name !== 'Ivo Vale').every(value => value.energy === 5)
      && !snapshot.world.tiles.some(value => candidate.expected.some(point => point.x === value.x && point.y === value.y)));
    await command(page, 'advance_job', { job_id: job.id, seconds: job.duration_seconds + 1 });
    await reloadCompany(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
    snapshot = await rpc(page, 'dc_get');
    checked('actual-paid-survey-reveals-genuine-generation-three-natural-air', candidate.expected.every(point => snapshot.world.tiles.some(value => value.x === point.x && value.y === point.y && value.formation === point.formation && value.material === null && value.initial_amount === 0 && value.remaining === 0))
      && JSON.stringify(snapshot.resources) === JSON.stringify(before.resources) && snapshot.expeditions.find(value => value.id === job.id).status === 'collected');
    await tab(page, 'Log'); await page.getByRole('group', { name: 'Field log views', exact: true }).getByRole('button', { name: 'Reports', exact: true }).click();
    await page.getByRole('button', { name: /^Read report: / }).first().click(); await page.getByRole('button', { name: 'Locate report site', exact: true }).click();
    await expect(page.getByTestId('deep-claim-map')).toHaveAttribute('data-dc-view', 'mine');
    await fit(page, 'caverns-earned-survey-focused-mine'); await canvasIsDrawn(page, 'caverns-earned-survey-focused-mine'); await shot(page, 'caverns-earned-survey-focused-mine');
    await page.getByRole('button', { name: 'Open mine operations', exact: true }).click();
    await fit(page, 'caverns-deep-site-operations'); await shot(page, 'caverns-deep-site-operations'); await page.keyboard.press('Escape');
    const followup = await operationPlan(page, 'Survey', { review: false });
    const siteCount = await followup.getByRole('combobox', { name: 'Expedition worksite', exact: true }).locator('option').count();
    checked('cavern-survey-site-selector-remains-bounded', siteCount <= 65, { siteCount });
    const search = followup.getByRole('searchbox', { name: 'Depth or material', exact: true });
    if (await search.isVisible()) {
      await search.fill(`48:${candidate.site.y}`);
      await expect(followup.getByRole('combobox', { name: 'Expedition worksite', exact: true }).locator(`option[value="48:${candidate.site.y}"]`)).toHaveCount(1);
      await expect(followup.getByRole('group', { name: 'Worksite pages', exact: true })).toBeVisible();
      await fit(page, 'caverns-worksite-search'); await shot(page, 'caverns-worksite-search');
    }
    await page.keyboard.press('Escape');
    checked('survey-report-focuses-the-newly-revealed-natural-chamber', true, { site: candidate.site, formations: candidate.expected.map(point => point.formation) });
    await context.close(); console.log('PASS Deep Claim actual earned cavern survey'); return;
  }
  assert.fail('QA sampling gap: 24 valid independent worlds had no chamber within the first-shaft survey band; no world or award was fabricated');
}
async function business() {
  for (let attempt = 0; attempt < 24; attempt++) {
    const run = `business-${attempt}`, { context, page } = await setup();
    await found(page, { run }); await intro(page);
    let snapshot = await rpc(page, 'dc_get'); const tutorial = snapshot.expeditions[0];
    await command(page, 'advance_job', { job_id: tutorial.id, seconds: 31 });
    await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
    await page.getByRole('button', { name: 'Open haul', exact: true }).click(); await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
    for (const [x, y] of [[50, 1], [47, 2], [49, 2], [47, 3]]) snapshot = await harvest(page, x, y);
    await sale(page, 'Iron ore'); await sale(page, 'Quartz');
    const site = await command(page, 'stone_worksite');
    if (!site) { await context.close(); continue; }
    let dialog = await operationPlan(page, 'Exploration', { ...site, workers: ['Ivo Vale'] });
    await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
    snapshot = await rpc(page, 'dc_get'); const stoneJob = snapshot.expeditions.find(job => job.status === 'active'); assert.ok(stoneJob);
    await command(page, 'advance_job', { job_id: stoneJob.id, seconds: stoneJob.duration_seconds + 1 });
    await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
    await page.getByRole('button', { name: 'Open haul', exact: true }).click(); await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await closeReward(page);
    snapshot = await rpc(page, 'dc_get');
    checked('business-progression-starts-from-actually-earned-stock-and-normal-energy', snapshot.resources.stone >= 20 && snapshot.resources.copper_ore >= 18 && snapshot.resources.tin_ore >= 12
      && snapshot.workers.find(worker => worker.name === 'Ivo Vale').energy === 0 && snapshot.workers.filter(worker => worker.name !== 'Ivo Vale').every(worker => worker.energy === 1));
    for (const name of ['Research Office', 'Trading Post', 'Smeltery']) await build(page, name);
    snapshot = await processRecipe(page, 'smelt_copper'); snapshot = await processRecipe(page, 'smelt_tin');
    checked('research-inputs-are-real-processed-goods', snapshot.resources.copper_bar === 2 && snapshot.resources.tin_bar === 2 && snapshot.resources.coal >= 6);
    let office = await officeView(page, 'Research');
    await office.getByRole('group', { name: 'Research branches', exact: true }).getByRole('button', { name: /^Processing/ }).click();
    await office.getByRole('button', { name: 'Review Alloy Practice', exact: true }).click();
    await expect(office.getByRole('button', { name: 'Start research', exact: true })).toBeEnabled();
    await fit(page, 'business-earned-research-review'); await shot(page, 'business-earned-research-review');
    const beforeResearch = await rpc(page, 'dc_get');
    await command(page, 'fail_next', { name: 'dc_start_research', after_commit: true });
    await office.getByRole('button', { name: 'Start research', exact: true }).click(); await expect(office.getByRole('alert')).toBeVisible();
    await reloadCompany(page); await expect(page.getByRole('button', { name: 'Confirm sync', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm sync', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Saved action confirmed.', exact: true })).toBeVisible(); await closeReward(page);
    snapshot = await rpc(page, 'dc_get'); const research = snapshot.business.research.find(order => order.key === 'processing_1'); assert.ok(research);
    const researchCalls = (await command(page, 'calls')).filter(call => call.name === 'dc_start_research');
    checked('paid-research-lost-ack-replays-one-order-and-keeps-server-clock', researchCalls.length === 2 && researchCalls[0].args.p_request_id === researchCalls[1].args.p_request_id
      && research.status === 'active' && snapshot.business.processing_speed_percent === 0 && snapshot.company.cash === beforeResearch.company.cash - 80
      && snapshot.resources.copper_bar === beforeResearch.resources.copper_bar - 1 && snapshot.resources.tin_bar === beforeResearch.resources.tin_bar - 1 && snapshot.resources.coal === beforeResearch.resources.coal - 4);
    office = await officeView(page, 'Research'); await shot(page, 'business-active-research'); await page.keyboard.press('Escape');
    await command(page, 'advance_research', { research_key: 'processing_1', seconds: 301 });
    await reloadCompany(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
    snapshot = await rpc(page, 'dc_get');
    checked('research-completes-offline-without-a-second-payment-or-collect-click', snapshot.business.research.find(order => order.key === 'processing_1').status === 'completed'
      && snapshot.business.processing_speed_percent === 5 && snapshot.company.cash === beforeResearch.company.cash - 80 && snapshot.business.stats.completed_research === 1);
    snapshot = await processRecipe(page, 'smelt_bronze');
    const bronzeJob = snapshot.production_jobs.find(job => job.recipe_key === 'smelt_bronze');
    checked('unlocked-bronze-production-uses-paid-inputs-and-frozen-research-timing', snapshot.resources.bronze_bar === 2 && bronzeJob.research_speed_percent === 5 && bronzeJob.duration_seconds === 342
      && bronzeJob.recipe_snapshot.outputs.bronze_bar === 2 && snapshot.business.stats.collected_processed_units === 6);
    office = await officeView(page, 'Contracts'); await office.getByRole('button', { name: 'Review order Yard Foundations', exact: true }).click();
    await expect(office.getByRole('button', { name: 'Deliver whole order', exact: true })).toBeEnabled();
    await fit(page, 'business-whole-delivery-review'); await shot(page, 'business-whole-delivery-review');
    const beforeDelivery = await rpc(page, 'dc_get');
    await office.getByRole('button', { name: 'Deliver whole order', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Order delivered.', exact: true })).toBeVisible(); await closeReward(page);
    snapshot = await rpc(page, 'dc_get');
    checked('persistent-contract-delivers-collected-stock-once-for-frozen-payout', snapshot.resources.stone === beforeDelivery.resources.stone - 20 && snapshot.company.cash === beforeDelivery.company.cash + 24
      && snapshot.business.contracts.find(order => order.key === 'yard_foundations').status === 'completed' && snapshot.business.stats.completed_contracts === 1 && snapshot.business.stats.total_contract_credits === 24);
    await reloadCompany(page); await expect(page.getByRole('tablist', { name: 'Company views' })).toBeVisible();
    office = await officeView(page, 'Contracts'); await office.getByRole('button', { name: 'Review order Yard Foundations', exact: true }).click();
    await expect(office.getByRole('button', { name: 'Deliver whole order', exact: true })).toBeDisabled(); await page.keyboard.press('Escape');
    for (const name of ['First Shift', 'First Batch', 'Better Methods']) {
      office = await officeView(page, 'Records'); await office.getByRole('button', { name: `Review milestone ${name}`, exact: true }).click();
      await expect(office.getByRole('button', { name: 'Claim company credits', exact: true })).toBeEnabled();
      await office.getByRole('button', { name: 'Claim company credits', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Company milestone secured.', exact: true })).toBeVisible(); await closeReward(page);
    }
    snapshot = await rpc(page, 'dc_get');
    checked('legacy-and-new-source-backed-milestones-pay-only-explicit-once-claims', ['first_shift','first_batch','first_research'].every(key => snapshot.business.milestones.find(item => item.key === key).claimed_at)
      && snapshot.company.cash === beforeDelivery.company.cash + 24 + 70);
    office = await officeView(page, 'Records'); await office.getByRole('button', { name: 'Review milestone First Shift', exact: true }).click();
    await expect(office.getByRole('button', { name: 'Claim company credits', exact: true })).toBeDisabled();
    await fit(page, 'business-earned-records-review'); await shot(page, 'business-earned-records-review'); await page.keyboard.press('Escape');
    office = await officeView(page, 'Records'); await office.getByRole('group', { name: 'Company records', exact: true }).getByRole('button', { name: 'Operations', exact: true }).click();
    await fit(page, 'business-source-backed-operations'); await shot(page, 'business-source-backed-operations');
    await context.close(); console.log('PASS Deep Claim earned business development'); return;
  }
  assert.fail('QA sampling gap: no suitable legal finite stone frontier in24 independent worlds; no economy or world was fabricated');
}
// Scenarios use production accessible interactions. Fixture commands only move
// existing server timestamps or interrupt local transport, never award money.
async function main() {
  for (const section of sections) assert.ok(['publisher', 'presentation', 'quotes', 'menus', 'journey', 'reliability', 'industry', 'field', 'caverns', 'business', 'social', 'runtime', 'deep', 'menu', 'training', 'campaign', 'academy'].includes(section), `Unknown Deep Claim QA section ${section}`);
  if (sections.has('publisher')) await publisherIntro();
  if (sections.has('menus')) await menus();
  if (sections.has('presentation')) await presentation();
  if (sections.has('quotes')) await quotes();
  if (sections.has('journey')) await journey();
  if (sections.has('reliability')) await reliability();
  if (sections.has('industry')) await industry();
  if (sections.has('field')) await field();
  if (sections.has('caverns')) await caverns();
  if (sections.has('business')) await business();
  if (sections.has('social')) await runPhase5Browser({ setup, pageFor, go, continueCompany, reloadCompany, found, intro, harvest, operationPlan, officeView, rpc, command, checked, fit, shot, closeReward, clearDialogs, tab, sale, selectCrew, expect, assert, actors: DEEP_CLAIM_ACTORS });
  if (sections.has('runtime')) await runPhase6Browser({ setup, pageFor, go, continueCompany, reloadCompany, found, intro, harvest, operationPlan, officeView, rpc, command, checked, fit, shot, closeReward, clearDialogs, tab, sale, selectCrew, expect, assert, actors: DEEP_CLAIM_ACTORS });
  if (sections.has('deep')) await runPhase7Browser({ setup, pageFor, go, continueCompany, reloadCompany, found, intro, harvest, operationPlan, officeView, rpc, command, checked, fit, shot, closeReward, clearDialogs, tab, sale, selectCrew, processRecipe, workerFile, expect, assert, actors: DEEP_CLAIM_ACTORS });
  const training = { setup, pageFor, go, continueCompany, reloadCompany, dismissTutorial, found, intro, rpc, command, checked, fit, shot, closeReward, clearDialogs, tab, sale, selectCrew, workerFile, officeView, settle, visualCases, expect, assert, actors: DEEP_CLAIM_ACTORS };
  if (sections.has('menu')) await runDeepClaimMenuBrowser(training);
  if (sections.has('training') || sections.has('campaign')) await runDeepClaimCampaignBrowser(training);
  if (sections.has('training') || sections.has('academy')) await runDeepClaimAcademyBrowser(training);
}

try {
  await start(); await main(); checked('no-unhandled-browser-errors', report.runtimeErrors.length === 0, report.runtimeErrors);
  console.log(`PASS Deep Claim browser: ${report.checks.length} checks`);
} catch (error) {
  report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  if (browser) for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    if (page.isClosed()) continue;
    await page.screenshot({ path: join(output, `failure-${index}.png`) }).catch(() => {});
    await writeFile(join(output, `failure-${index}.json`), JSON.stringify(await page.evaluate(() => ({ text: document.body.innerText, route: document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route'),
      runtime: window.deepClaimRuntime ? { samples: window.deepClaimRuntime.samples.slice(-12), menu_samples: window.deepClaimRuntime.menuSamples?.slice(-12),
        audio: window.deepClaimRuntime.controllers.map(controller => controller.getDiagnostics?.()),
        native_contexts: window.deepClaimRuntime.contexts.map(context => context.state),
        context_calls: window.deepClaimRuntime.contextCalls.slice(-30), visibility_mode: window.deepClaimRuntime.visibilityMode } : null })).catch(() => ({})), null, 2));
  }
  if (currentPage && !currentPage.isClosed()) await writeFile(join(output, 'calls.json'), JSON.stringify(await command(currentPage, 'calls').catch(() => []), null, 2));
} finally {
  await writeFile(join(output, 'rpc-calls.json'), JSON.stringify(await endpoint.diagnostics(), null, 2));
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Report:', join(output, 'report.json')); await cleanup();
}

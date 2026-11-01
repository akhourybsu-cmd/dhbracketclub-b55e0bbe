// Production Showdown hub and game selection, isolated browser-local transport.
// No live accounts, notifications, grading, or database writes.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.SHOWDOWN_SELECTOR_QA_OUTPUT || await mkdtemp(join(tmpdir(), 'showdown-selector-'));
await mkdir(output, { recursive: true });
const base = process.env.SHOWDOWN_SELECTOR_QA_URL || 'http://127.0.0.1:8105';
const users = { alex: '00000000-0000-4000-8000-000000000001', blair: '00000000-0000-4000-8000-000000000002', casey: '00000000-0000-4000-8000-000000000003' };
const club = '00000000-0000-4000-8000-000000000010';
const report = { checks: [], errors: [], runtimeErrors: [], artifacts: output,
  fixtures: 'Production Showdown pages/hooks and all three game entry flows with browser-local identity and serialized replay RPC transport. No live writes.' };
let server, browser, currentPage, serverLog;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
console.log('Showdown selector artifacts:', output);

async function cleanup() {
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(1200)]);
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
  }
  serverLog?.end();
}
process.once('SIGINT', () => { void cleanup().then(() => process.exit(130)); });
process.once('SIGTERM', () => { void cleanup().then(() => process.exit(143)); });
async function start() {
  if (!process.env.SHOWDOWN_SELECTOR_QA_URL) {
    serverLog = createWriteStream(join(output, 'vite.log'));
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '8105', '--strictPort'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error('Preview exited; inspect vite.log');
    try { if ((await fetch(`${base}/scripts/fixtures/cipher.html`)).ok) break; } catch { /* Bounded startup. */ }
    if (attempt === 99) throw Error('Showdown preview did not start within twenty seconds.');
    await delay(200);
  }
  browser = await chromium.launch({ executablePath: process.env.SHOWDOWN_SELECTOR_QA_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
}
async function setup(width = 390, height = 844, theme = 'dark', motion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: motion });
  return { context, page: await pageFor(context), theme };
}
async function pageFor(context) {
  const page = await context.newPage(); currentPage = page;
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const stub = (path, body) => page.route(`**/${path}*`, route => route.fulfill({ contentType: 'text/javascript', body }));
  await stub('src/integrations/supabase/client.ts', "export {supabase} from '/scripts/fixtures/showdown-backend.ts';");
  await stub('src/contexts/AuthContext.tsx', "const p=new URLSearchParams(location.search);const id=p.get('user')||'00000000-0000-4000-8000-000000000001';export const useAuth=()=>({user:{id,user_metadata:{display_name:id.endsWith('1')?'Alex':id.endsWith('2')?'Blair':'Casey'}},session:null,loading:false,signOut:async()=>{}});");
  await stub('src/contexts/ClubContext.tsx', "const p=new URLSearchParams(location.search);const club={id:p.get('club')||'00000000-0000-4000-8000-000000000010',name:'Dry My Horse',slug:'dh'};export const useClub=()=>({club,loading:false,isClubAdmin:false,isPrivateSession:false,membership:{club_id:club.id,role:'member'}});");
  return page;
}
async function go(page, route = '/showdown', { user = users.alex, theme = 'dark', run = 'main', clubId = club, fail = '' } = {}) {
  currentPage = page;
  const params = new URLSearchParams({ route, user, theme, run, club: clubId, fail });
  await page.goto(`${base}/scripts/fixtures/cipher.html?${params}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.showdownReady && window.showdownQa && window.showdownQueryClient);
  await expect(page.getByTestId('showdown-shell').or(page.getByTestId('cipher-game')).or(page.getByTestId('cipher-code-maker')).or(page.getByTestId('prism-game')).first()).toBeVisible();
  await settle(page);
}
async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.waitForFunction(() => document.getAnimations().every(animation => {
    if (animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity) return true;
    // The genuine seven-second countdown updates its width every50ms. Waiting
    // for that transition would exhaust the study window before taking a shot.
    const target = animation.effect?.target;
    return target instanceof Element && Boolean(target.closest('.ai-study-clock'));
  }), undefined, { timeout: 4000 });
}
function checked(label, value, detail) {
  report.checks.push({ label, ok: Boolean(value), ...(detail ? { detail } : {}) });
  assert.ok(value, `${label}${detail ? ': ' + JSON.stringify(detail) : ''}`);
}
async function shot(page, label) { await settle(page); await page.screenshot({ path: join(output, `${label}.png`) }); }
async function fit(page, label, { game = false } = {}) {
  await settle(page);
  const issues = await page.evaluate(({ game }) => {
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth + 2) problems.push('Document overflows horizontally.');
    for (const choice of document.querySelectorAll('.sd-game-option')) {
      const art = choice.querySelector('.sd-game-option-art > svg')?.getBoundingClientRect();
      const copy = choice.querySelector('.sd-game-option-copy')?.getBoundingClientRect();
      if (getComputedStyle(choice).flexDirection === 'column' && art && copy && art.bottom > copy.top + 1) problems.push('Game artwork overlaps its title.');
    }
    if (game && document.documentElement.scrollHeight > innerHeight + 2) problems.push('Game needs document scrolling.');
    const board = document.querySelector('[data-testid="afterimage-board"]') || document.querySelector('[data-testid="prism-board"]');
    if (game && board) {
      const bounds = board.getBoundingClientRect();
      if (bounds.left < -1 || bounds.right > innerWidth + 1 || bounds.top < -1 || bounds.bottom > innerHeight + 1) problems.push('Puzzle board escapes viewport.');
    }
    for (const node of document.querySelectorAll('button,a[href],select')) {
      if (!(node instanceof HTMLElement) || node.closest('[hidden],[aria-hidden="true"],[inert]') || node.matches(':disabled')) continue;
      const bounds = node.getBoundingClientRect(), style = getComputedStyle(node);
      if (!bounds.width || !bounds.height || style.display === 'none' || style.visibility === 'hidden') continue;
      // Dense hard boards expose additional full-size selected-mirror controls.
      if (node.hasAttribute('data-prism-cell')) continue;
      if (bounds.top >= -1 && bounds.bottom <= innerHeight + 1 && (bounds.width < 43.5 || bounds.height < 43.5)) problems.push(`Small command: ${node.getAttribute('aria-label') || node.textContent?.trim().slice(0,30)}`);
    }
    return problems;
  }, { game });
  checked(label, issues.length === 0, issues);
}
async function visibleControl(locator, label) {
  const issues = await locator.evaluate(node => {
    const box = node.getBoundingClientRect(), issues = [];
    if (box.top < -1 || box.bottom > innerHeight + 1 || box.left < -1 || box.right > innerWidth + 1) issues.push('Outside viewport.');
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (box.top < rect.top - 1 || box.bottom > rect.bottom + 1)) issues.push('Vertically clipped.');
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (box.left < rect.left - 1 || box.right > rect.right + 1)) issues.push('Horizontally clipped.');
    }
    return issues;
  });
  checked(label, issues.length === 0, issues);
}
const gameNames = { prism_break: 'Prism Break', afterimage: 'Afterimage', cipher_duel: 'Cipher Duel' };
async function rpc(page, name, args) {
  const result = await page.evaluate(({ name, args }) => window.showdownQa.rpc(name, args), { name, args });
  if (result.error) throw Error(`${name}: ${result.error.message}`);
  return result.data;
}
async function requestId(page) { return page.evaluate(() => crypto.randomUUID()); }
async function seed(context, page, run, theme) {
  const matches = {};
  for (const key of ['prism_break', 'afterimage']) matches[key] = (await rpc(page, 'showdown_create', { p_recipient_id: users.blair, p_game_key: key, p_request_id: await requestId(page), p_rematch_of: null })).challenge.id;
  matches.cipher_duel = (await rpc(page, 'showdown_create_cipher', { p_recipient_id: users.blair, p_code: ['red', 'red', 'blue', 'green'], p_request_id: await requestId(page), p_rematch_of: null })).challenge.id;
  const peer = await pageFor(context);
  await go(peer, '/showdown?game=cipher_duel', { run, theme, user: users.blair });
  await rpc(peer, 'showdown_lock_cipher_code', { p_challenge_id: matches.cipher_duel, p_code: ['red', 'red', 'blue', 'blue'], p_request_id: await requestId(peer) });
  await peer.close();
  return matches;
}
function selector(page) { return page.getByRole('radiogroup', { name: 'Showdown games', exact: true }); }
async function select(page, key) {
  await selector(page).getByRole('radio', { name: gameNames[key], exact: true }).click();
  await expect(selector(page).getByRole('radio', { name: gameNames[key], exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('group', { name: `${gameNames[key]} record`, exact: true })).toHaveAttribute('aria-busy', 'false');
  await page.waitForFunction(key => (new URLSearchParams(document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route')?.split('?')[1]).get('game') ?? 'prism_break') === key, key);
}
async function checkLibrary(page, label) {
  await fit(page, `hub-${label}`);
  const radios = selector(page).getByRole('radio');
  checked(`three-games-visible-${label}`, await radios.count() === 3);
  for (const radio of await radios.all()) await visibleControl(radio, `game-choice-in-viewport-${label}-${await radio.getAttribute('aria-label')}`);
  const panel = page.getByRole('tabpanel'), size = await panel.boundingBox();
  checked(`challenge-list-has-usable-height-${label}`, size.height >= 100, size);
  checked(`no-page-scroll-${label}`, await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2));
}
async function flows(page, key, label) {
  await page.getByRole('button', { name: 'Challenge a member', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New showdown' });
  await expect(dialog.getByRole('radiogroup', { name: 'Choose a game' }).getByRole('radio', { name: gameNames[key], exact: true })).toHaveAttribute('aria-checked', 'true');
  await dialog.getByRole('combobox', { name: 'Club member' }).selectOption(users.blair);
  await fit(page, `challenge-menu-${label}-${key}`); await shot(page, `${label}-${key}-challenge-menu`);
  const before = await page.evaluate(() => window.showdownQa.state.challenges.length);
  await dialog.getByRole('button', { name: key === 'cipher_duel' ? 'Create your code' : 'Send challenge', exact: true }).click();
  if (key === 'cipher_duel') {
    await expect(page.getByTestId('cipher-code-maker')).toHaveAttribute('data-cipher-step', 'challenge');
    if (await page.getByTestId('cipher-help').isVisible()) await page.keyboard.press('Escape');
    checked(`cipher-select-opens-setup-without-invite-${label}`, await page.evaluate(() => location.search.includes('/showdown/cipher/new') || document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route')?.startsWith('/showdown/cipher/new')));
    checked(`cipher-select-keeps-confirmation-before-invite-${label}`, await page.evaluate(() => window.showdownQa.state.challenges.length) === before);
  } else {
    await expect(page.getByTestId(key === 'prism_break' ? 'prism-game' : 'afterimage-game')).toBeVisible();
    const created = await page.evaluate(() => window.showdownQa.state.challenges.at(-1));
    checked(`challenge-opens-selected-game-${label}-${key}`, created.game_key === key && created.recipient_id === users.blair);
  }
}
async function main() {
  const cases = [[320, 568, 'dark'], [390, 844, 'light'], [844, 390, 'dark'], [1440, 900, 'light']];
  for (const [index, [width, height, theme]] of cases.entries()) {
    const run = `selector-${index}-${Date.now()}`, label = `${width}x${height}-${theme}`, { context, page } = await setup(width, height, theme);
    await go(page, '/showdown', { run, theme }); const matches = await seed(context, page, run, theme); await go(page, '/showdown', { run, theme });
    for (const key of ['prism_break', 'afterimage', 'cipher_duel']) {
      await select(page, key); await checkLibrary(page, `${label}-${key}`);
      const expected = page.locator(`a[href="/showdown/${matches[key]}"]`); await expect(expected).toBeVisible(); await expected.scrollIntoViewIfNeeded();
      await visibleControl(expected, `selected-match-is-reachable-${label}-${key}`);
      checked(`only-selected-game-matches-${label}-${key}`, (await page.getByTestId('showdown-challenge-card').count()) === 1);
      await shot(page, `${label}-${key}-hub`); await flows(page, key, label); await go(page, `/showdown?game=${key}`, { run, theme });
    }
    const prism = selector(page).getByRole('radio', { name: 'Prism Break', exact: true });
    await prism.focus(); await page.keyboard.press('Home'); await expect(prism).toBeFocused();
    await page.keyboard.press('ArrowRight'); await expect(selector(page).getByRole('radio', { name: 'Afterimage', exact: true })).toBeFocused();
    await expect(selector(page).getByRole('radio', { name: 'Afterimage', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('End'); await expect(selector(page).getByRole('radio', { name: 'Cipher Duel', exact: true })).toBeFocused();
    checked(`keyboard-switches-game-and-focus-${label}`, true);
    await context.close(); console.log('PASS selector', label);
  }
}
try {
  await start(); await main(); checked('no-unhandled-browser-errors', report.runtimeErrors.length === 0, report.runtimeErrors);
  console.log(`PASS Showdown selector: ${report.checks.length} checks`);
} catch (error) {
  report.errors.push(error.stack || String(error)); console.error(error); process.exitCode = 1;
  if (currentPage) { await currentPage.screenshot({ path: join(output, 'failure.png') }).catch(() => {}); await writeFile(join(output, 'failure.json'), JSON.stringify(await currentPage.evaluate(() => ({ text: document.body.innerText, route: document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route'), calls: window.showdownQa?.calls })).catch(() => ({})), null, 2)); }
} finally { await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('Report:', join(output, 'report.json')); await cleanup(); }

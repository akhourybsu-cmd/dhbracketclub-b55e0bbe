// Production Showdown screens and Cipher Duel engine, isolated browser-local transport.
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
const output = process.env.CIPHER_QA_OUTPUT || await mkdtemp(join(tmpdir(), 'cipher-'));
await mkdir(output, { recursive: true });
const base = process.env.CIPHER_QA_URL || 'http://127.0.0.1:8104';
const users = { alex: '00000000-0000-4000-8000-000000000001', blair: '00000000-0000-4000-8000-000000000002', casey: '00000000-0000-4000-8000-000000000003' };
const club = '00000000-0000-4000-8000-000000000010';
const report = { checks: [], errors: [], runtimeErrors: [], artifacts: output,
  fixtures: 'Production pages/hooks/Cipher Duel simulation with browser-local identity and serialized replay RPC transport. No live writes.' };
let server, browser, currentPage, serverLog;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
console.log('Cipher Duel artifacts:', output);

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
  if (!process.env.CIPHER_QA_URL) {
    serverLog = createWriteStream(join(output, 'vite.log'));
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '8104', '--strictPort'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error('Preview exited; inspect vite.log');
    try { if ((await fetch(`${base}/scripts/fixtures/cipher.html`)).ok) break; } catch { /* Bounded startup. */ }
    if (attempt === 99) throw Error('Showdown preview did not start within twenty seconds.');
    await delay(200);
  }
  browser = await chromium.launch({ executablePath: process.env.CIPHER_QA_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
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
async function go(page, route = '/showdown?game=cipher_duel', { user = users.alex, theme = 'dark', run = 'main', clubId = club, fail = '' } = {}) {
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
const pegs = value => value.split('').map(letter => ({ R: 'red', B: 'blue', G: 'green', Y: 'yellow', P: 'purple', O: 'orange' })[letter]);
const codeA = pegs('RRBG'), codeB = pegs('RRBB');
async function matchId(page) { return page.evaluate(() => document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route')?.split('/').pop()?.split('?')[0]); }
async function rpc(page, name, args) {
  const result = await page.evaluate(({ name, args }) => window.showdownQa.rpc(name, args), { name, args });
  if (result.error) throw Error(`${name}: ${result.error.code} ${result.error.message}`);
  assert.ok(result.data); return result.data;
}
async function id(page) { return page.evaluate(() => crypto.randomUUID()); }
async function guide(page, screenshot = false) {
  const dialog = page.getByTestId('cipher-help');
  if (!await dialog.isVisible()) return;
  for (let step = 0; step < 6; step++) {
    if (screenshot && step === 3) { await fit(page, 'tutorial-clues-have-reachable-controls'); await shot(page, 'visual-six-step-tutorial'); }
    await dialog.getByRole('button', { name: step === 5 ? 'Let’s play' : 'Next', exact: true }).click();
  }
  await expect(dialog).not.toBeVisible();
}
async function fill(page, code, type = 'guess', keyboard = false) {
  currentPage = page;
  await page.bringToFront();
  for (let slot = 0; slot < 4; slot++) {
    const target = page.locator(`button[data-cipher-${type === 'secret' ? 'code' : 'guess'}-slot="${slot}"]`), color = page.getByRole('button', { name: `Choose ${code[slot]}`, exact: true });
    if (keyboard) { await target.focus(); await page.keyboard.press('Enter'); await color.focus(); await page.keyboard.press('Enter'); }
    else { await target.tap(); await color.tap(); }
    await expect(target).toHaveAttribute('aria-label', new RegExp(`${code[slot]}$`));
  }
}
async function confirmCode(page, step) {
  await page.getByRole('button', { name: step === 'challenge' ? 'Lock & challenge' : 'Lock & accept', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Lock your code?' });
  await expect(confirm.getByText('Once locked, your code cannot be changed. Your opponent will try to crack this combination.', { exact: true })).toBeVisible();
  await visibleControl(confirm.getByRole('button', { name: 'Lock this code', exact: true }), 'final-code-confirmation-reachable');
  await confirm.getByRole('button', { name: 'Lock this code', exact: true }).click();
}
async function createFlow(page, { loseAck = false, tutorial = false } = {}) {
  const before = await page.evaluate(() => window.showdownQa.state.challenges.length);
  await page.getByRole('button', { name: 'Challenge a member', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'New showdown' });
  await chooser.getByRole('button', { name: /Cipher Duel/i }).click();
  await chooser.getByRole('combobox', { name: 'Club member' }).selectOption(users.blair);
  await chooser.getByRole('button', { name: 'Create your code', exact: true }).click();
  await expect(page.getByTestId('cipher-code-maker')).toBeVisible(); await guide(page, tutorial);
  checked('selecting-cipher-does-not-create-an-invitation', (await page.evaluate(() => window.showdownQa.state.challenges.length)) === before);
  await fill(page, codeA, 'secret', true);
  if (loseAck) await page.evaluate(() => window.showdownQa.failNext('showdown_create_cipher', true));
  await confirmCode(page, 'challenge');
  if (loseAck) {
    await expect(page.getByRole('button', { name: 'Retry this code', exact: true })).toBeVisible();
    const first = await page.evaluate(() => window.showdownQa.calls.find(call => call.name === 'showdown_create_cipher').args);
    await expect(page.locator('button[data-cipher-code-slot]').first()).toBeDisabled();
    await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByTestId('cipher-code-maker')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry this code', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Retry this code', exact: true }).click();
    await expect(page.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'waiting_code');
    const retry = await page.evaluate(() => window.showdownQa.calls.find(call => call.name === 'showdown_create_cipher').args);
    checked('lost-create-ack-reload-keeps-exact-code-and-id', JSON.stringify(first) === JSON.stringify(retry) && (await page.evaluate(() => window.showdownQa.state.challenges.length)) === before + 1);
  }
  await expect(page.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'waiting_code'); return matchId(page);
}
async function rawCreate(page, secret = codeA) { return (await rpc(page, 'showdown_create_cipher', { p_recipient_id: users.blair, p_code: secret, p_request_id: await id(page), p_rematch_of: null })).challenge.id; }
async function rawLock(page, match, secret = codeB) { return rpc(page, 'showdown_lock_cipher_code', { p_challenge_id: match, p_code: secret, p_request_id: await id(page) }); }
async function rawGuess(page, match, guess, expected) { return rpc(page, 'showdown_submit_cipher_guess', { p_challenge_id: match, p_guess: guess, p_expected_guess_count: expected, p_request_id: await id(page) }); }
async function privacy(page, match, label) {
  const detail = await rpc(page, 'showdown_get', { p_challenge_id: match, p_start: false });
  checked(label, detail.rounds.length === 0 && detail.current_round === null && detail.cipher.results === null
    && !('opponent_code' in detail.cipher) && !('opponent_guesses' in detail.cipher) && !('opponent_feedback' in detail.cipher));
}
async function submit(page, match, guess, { retry = false, keyboard = false } = {}) {
  const before = (await rpc(page, 'showdown_get', { p_challenge_id: match, p_start: false })).cipher.own_attempt.guesses_used;
  await fill(page, guess, 'guess', keyboard);
  if (retry) await page.evaluate(() => window.showdownQa.failNext('showdown_submit_cipher_guess'));
  await page.getByRole('button', { name: 'Submit guess', exact: true }).click();
  if (retry) { await expect(page.getByRole('button', { name: 'Retry this guess', exact: true })).toBeVisible(); await fit(page, 'guess-error-is-operable', { game: true }); await shot(page, 'retry-official-guess'); await page.getByRole('button', { name: 'Retry this guess', exact: true }).click(); }
  await page.waitForFunction(({ match, count }) => window.showdownQa.state.challenges.find(row => row.id === match).cipher_data.states[window.showdownQa.userId].guesses.length === count, { match, count: before + 1 });
  if (retry) {
    const calls = await page.evaluate(({ match, before }) => window.showdownQa.calls.filter(call => call.name === 'showdown_submit_cipher_guess' && call.args.p_challenge_id === match && call.args.p_expected_guess_count === before), { match, before });
    checked('guess-retry-reuses-same-id-and-count', calls.length === 2 && JSON.stringify(calls[0].args) === JSON.stringify(calls[1].args));
  }
}
async function accept(page, match, secret = codeB) {
  await expect(page.getByTestId('cipher-code-maker')).toHaveAttribute('data-cipher-step', 'accept'); await guide(page);
  await privacy(page, match, 'recipient-must-lock-code-before-either-attempt');
  await fill(page, secret, 'secret'); await confirmCode(page, 'accept');
  await expect(page.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'codebreaking');
}
async function journey() {
  const run = `cipher-journey-${Date.now()}`, { context, page } = await setup(390, 844, 'dark');
  await go(page, '/showdown?game=cipher_duel', { run }); const match = await createFlow(page, { loseAck: true, tutorial: true });
  await fit(page, 'waiting-for-code-390', { game: true }); await shot(page, '390x844-dark-waiting-code');
  checked('challenger-cannot-guess-before-recipient-lock', await page.getByRole('button', { name: 'Submit guess', exact: true }).count() === 0);
  const recipient = await pageFor(context); await go(recipient, '/showdown?game=cipher_duel', { run, user: users.blair });
  await recipient.getByRole('link', { name: 'Create your code', exact: false }).click(); await accept(recipient, match);
  const clocks = await recipient.evaluate(match => window.showdownQa.state.challenges.find(row => row.id === match), match);
  checked('second-lock-starts-one-new-72-hour-gameplay-window', new Date(clocks.gameplay_expires_at) - new Date(clocks.gameplay_started_at) === 72 * 3600000);
  await go(page, `/showdown/${match}`, { run }); await guide(page); await privacy(page, match, 'opponent-secret-stays-sealed-after-both-lock');
  await submit(page, match, pegs('RBRY'), { retry: true, keyboard: true });
  await expect(page.locator('[data-cipher-guess-row="1"]').getByRole('img', { name: '1 exact match, 2 color matches in different positions' })).toBeVisible();
  await fill(page, pegs('RROO')); await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-cipher-guess-slot="3"]')).toHaveAttribute('aria-label', /orange$/);
  checked('editable-guess-draft-survives-reload-without-spending-a-guess', (await rpc(page, 'showdown_get', { p_challenge_id: match, p_start: false })).cipher.own_attempt.guesses_used === 1);
  await page.getByRole('button', { name: 'Reset current guess', exact: true }).click(); await submit(page, match, codeB);
  await expect(page.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'attempt_sealed'); await privacy(page, match, 'solved-first-player-cannot-read-rival-history'); await shot(page, '390x844-dark-attempt-sealed');
  await submit(recipient, match, pegs('YYYY')); await submit(recipient, match, pegs('GGGG')); await submit(recipient, match, codeA);
  await expect(recipient.getByTestId('showdown-results')).toBeVisible(); await shot(recipient, '390x844-dark-results');
  const final = await rpc(recipient, 'showdown_get', { p_challenge_id: match, p_start: false });
  checked('fewer-successful-guesses-wins-without-numeric-score', final.challenge.winner_id === users.alex && final.cipher.results.map(row => row.attempt.guesses_used).join(',') === '2,3');
  await recipient.getByRole('button', { name: "Inspect Alex's guesses", exact: true }).click();
  const review = recipient.getByRole('dialog'); await expect(review).toHaveAccessibleName('Alex’s guesses');
  await expect(review.getByRole('group', { name: "Blair's target code" })).toBeVisible(); checked('history-shows-official-ten-rows-only', await review.locator('[data-cipher-guess-row]').count() === 10 && await review.locator('button[data-cipher-color]').count() === 0);
  await review.getByRole('button', { name: 'Blair', exact: true }).click(); await expect(review).toHaveAccessibleName('Blair’s guesses'); await expect(review.getByRole('group', { name: "Alex's target code" })).toBeVisible(); await shot(recipient, '390x844-dark-history-review'); await recipient.keyboard.press('Escape');
  await recipient.getByRole('button', { name: 'Rematch', exact: true }).click(); await expect(recipient.getByTestId('cipher-code-maker')).toHaveAttribute('data-cipher-step', 'challenge');
  checked('rematch-opens-fresh-code-creation-without-invite', (await recipient.evaluate(() => window.showdownQa.state.challenges.length)) === 1 && await recipient.locator('[data-cipher-code-slot][aria-label$="empty"]').count() === 4);
  await context.close(); console.log('PASS Cipher asynchronous journey');
}
async function presentation() {
  const cases = [[320, 568, 'dark', 'no-preference'], [320, 568, 'light', 'no-preference'], [390, 844, 'light', 'no-preference'], [844, 390, 'dark', 'reduce'], [768, 1024, 'light', 'no-preference'], [1440, 900, 'dark', 'no-preference'], [1440, 900, 'light', 'reduce']];
  for (const [index, [width, height, theme, motion]] of cases.entries()) {
    const run = `cipher-matrix-${index}-${Date.now()}`, label = `${width}x${height}-${theme}-${motion}`, { context, page } = await setup(width, height, theme, motion);
    await go(page, '/showdown?game=cipher_duel', { run, theme }); await fit(page, `lobby-${label}`); await shot(page, `${label}-lobby`);
    await go(page, `/showdown/cipher/new?recipient_id=${users.blair}`, { run, theme }); await guide(page); await fill(page, codeA, 'secret');
    const symbols = await page.locator('.cipher-palette svg[data-cipher-symbol]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-cipher-symbol')));
    checked(`all-six-colors-have-distinct-symbols-${label}`, symbols.length === 6 && new Set(symbols).size === 6);
    await fit(page, `code-maker-${label}`, { game: true }); await shot(page, `${label}-code-maker`); await confirmCode(page, 'challenge');
    await expect(page.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'waiting_code');
    const match = await matchId(page), other = await pageFor(context); await go(other, `/showdown/${match}`, { run, theme, user: users.blair }); await rawLock(other, match);
    for (let count = 0; count < 9; count++) await rawGuess(page, match, pegs('OOOO'), count);
    await go(page, `/showdown/${match}`, { run, theme }); await guide(page); await fill(page, codeB);
    await expect(page.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'codebreaking'); await fit(page, `active-tenth-guess-${label}`, { game: true });
    await visibleControl(page.getByRole('button', { name: 'Submit guess', exact: true }), `submit-guess-reachable-${label}`);
    await visibleControl(page.locator('[data-cipher-active="true"]'), `active-tenth-row-not-obscured-${label}`); await shot(page, `${label}-tenth-guess`);
    await page.getByRole('button', { name: 'Submit guess', exact: true }).click(); await expect(page.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'attempt_sealed');
    await rpc(other, 'showdown_surrender_cipher', { p_challenge_id: match, p_expected_guess_count: 0, p_request_id: await id(other) });
    await go(page, `/showdown/${match}`, { run, theme }); await expect(page.getByTestId('showdown-results')).toBeVisible(); await fit(page, `results-${label}`); await shot(page, `${label}-results`);
    await page.getByRole('button', { name: "Inspect Alex's guesses", exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Alex’s guesses' })).toBeVisible(); await fit(page, `history-review-${label}`); await shot(page, `${label}-history-review`);
    await context.close(); console.log('PASS presentation', label);
  }
}
async function reliability() {
  const run = `cipher-recovery-${Date.now()}`, { context, page } = await setup(390, 844, 'dark');
  await go(page, '/showdown?game=cipher_duel', { run }); const match = await rawCreate(page), other = await pageFor(context);
  await go(other, `/showdown/${match}`, { run, user: users.blair }); await guide(other); await fill(other, codeB, 'secret');
  await other.evaluate(() => window.showdownQa.failNext('showdown_lock_cipher_code', true)); await confirmCode(other, 'accept'); await expect(other.getByRole('button', { name: 'Retry this code', exact: true })).toBeVisible();
  const before = await other.evaluate(match => window.showdownQa.state.challenges.find(row => row.id === match), match);
  await other.reload({ waitUntil: 'domcontentloaded' }); await expect(other.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'codebreaking');
  const after = await other.evaluate(match => window.showdownQa.state.challenges.find(row => row.id === match), match);
  checked('lost-accept-ack-reload-keeps-code-and-gameplay-deadline', before.gameplay_started_at === after.gameplay_started_at && before.gameplay_expires_at === after.gameplay_expires_at && JSON.stringify(after.cipher_data.codes[users.blair].code) === JSON.stringify(codeB));
  await go(page, `/showdown/${match}`, { run }); await guide(page); await fill(page, pegs('RBRY')); await page.evaluate(() => window.showdownQa.failNext('showdown_submit_cipher_guess', true)); await page.getByRole('button', { name: 'Submit guess', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry this guess', exact: true })).toBeVisible(); await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('[data-cipher-guess-row="1"]')).toHaveAttribute('aria-label', 'Guess 1, submitted');
  checked('lost-guess-ack-resumes-one-official-row', (await rpc(page, 'showdown_get', { p_challenge_id: match, p_start: false })).cipher.own_guesses.length === 1);
  const second = await rawCreate(page, pegs('GGGG')); await go(page, `/showdown/${second}`, { run });
  await expect(page.locator('.cipher-own-code [aria-label="Your secret position 1: green"]')).toBeVisible(); await go(page, `/showdown/${match}`, { run }); await expect(page.locator('.cipher-own-code [aria-label="Your secret position 1: red"]')).toBeVisible();
  checked('multiple-duels-keep-their-own-codes-and-guesses', (await rpc(page, 'showdown_get', { p_challenge_id: match, p_start: false })).cipher.own_guesses.length === 1);
  const excluded = await pageFor(context); await go(excluded, `/showdown/${match}`, { run, user: users.casey }); await expect(excluded.getByRole('alert')).toBeVisible(); checked('bystander-cannot-read-cipher-game', await excluded.getByTestId('cipher-game').count() === 0);
  await go(excluded, `/showdown/${match}`, { run, clubId: '00000000-0000-4000-8000-000000000011' }); await expect(excluded.getByRole('alert')).toBeVisible(); checked('another-club-cannot-read-cipher-game', await excluded.getByTestId('cipher-game').count() === 0);
  currentPage = page; await page.evaluate(match => window.showdownQa.expire(match), match); await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByTestId('cipher-game')).toHaveAttribute('data-cipher-phase', 'closed');
  checked('expired-duel-is-no-contest-and-never-reveals-rival', (await rpc(page, 'showdown_lobby', { p_game_key: 'cipher_duel', p_cursor: null, p_limit: 30 })).record.played === 0 && (await rpc(page, 'showdown_get', { p_challenge_id: match, p_start: false })).cipher.results === null);
  await context.close(); console.log('PASS Cipher reliability');
}
async function concurrency() {
  const run = `cipher-concurrent-${Date.now()}`, { context, page } = await setup(390, 844, 'dark');
  await go(page, '/showdown?game=cipher_duel', { run }); const match = await rawCreate(page), other = await pageFor(context);
  await go(other, `/showdown/${match}`, { run, user: users.blair }); await rawLock(other, match);
  await go(page, `/showdown/${match}`, { run }); await guide(page); await go(other, `/showdown/${match}`, { run, user: users.blair }); await guide(other);
  await page.evaluate(() => window.showdownQa.hold('showdown_submit_cipher_guess')); await other.evaluate(() => window.showdownQa.hold('showdown_submit_cipher_guess'));
  for (const [actor, secret] of [[page, codeB], [other, codeA]]) { await fill(actor, secret); await actor.getByRole('button', { name: 'Submit guess', exact: true }).click(); await actor.waitForFunction(() => window.showdownQa.calls.some(call => call.name === 'showdown_submit_cipher_guess')); }
  checked('both-real-ui-final-guesses-in-flight-before-commit', (await page.evaluate(match => window.showdownQa.state.challenges.find(row => row.id === match), match)).players.every(player => player.finished_at === null));
  await Promise.all([page.evaluate(() => window.showdownQa.release('showdown_submit_cipher_guess')), other.evaluate(() => window.showdownQa.release('showdown_submit_cipher_guess'))]);
  await page.waitForFunction(match => window.showdownQa.state.challenges.find(row => row.id === match).status === 'completed', match);
  await page.reload({ waitUntil: 'domcontentloaded' }); await other.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByTestId('showdown-results')).toBeVisible(); await expect(other.getByTestId('showdown-results')).toBeVisible();
  const result = await page.evaluate(match => ({ match: window.showdownQa.state.challenges.find(row => row.id === match), notices: window.showdownQa.state.notifications.filter(row => row.url === `/showdown/${match}` && row.title === 'CIPHER DUEL result') }), match);
  checked('simultaneous-first-guesses-create-one-draw-two-results', result.match.outcome === 'draw' && result.notices.length === 2);
  await context.close(); console.log('PASS Cipher concurrent completion');
}
async function captureFailure(page) {
  const pages = browser?.contexts().flatMap(context => context.pages()) ?? [], snapshots = [];
  if (page) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  for (const [index, openPage] of pages.entries()) { await openPage.screenshot({ path: join(output, `failure-page-${index}.png`) }).catch(() => {}); snapshots.push(await openPage.evaluate(() => ({ text: document.body.innerText, url: location.href, user: window.showdownQa?.userId, calls: window.showdownQa?.calls, state: window.showdownQa?.state })).catch(error => ({ error: String(error) }))); }
  await writeFile(join(output, 'failure-pages.json'), JSON.stringify(snapshots, null, 2));
}
try {
  const scenarios = { presentation, journey, reliability, concurrency }, requested = (process.env.CIPHER_QA_SECTION || 'all').split(',').map(section => section.trim()).filter(Boolean);
  const selected = requested.includes('all') ? Object.keys(scenarios) : requested;
  if (!selected.length || selected.some(section => !Object.hasOwn(scenarios, section))) throw Error('CIPHER_QA_SECTION must select all, presentation, journey, reliability or concurrency.');
  report.sections = selected; await start(); for (const section of selected) await scenarios[section]();
  checked('no-unhandled-browser-errors', report.runtimeErrors.length === 0, report.runtimeErrors); console.log(`PASS Cipher Duel: ${report.checks.length} checks`);
} catch (error) { report.errors.push(error.stack || String(error)); await captureFailure(currentPage); console.error(error); process.exitCode = 1; }
finally { await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('Report:', join(output, 'report.json')); await cleanup(); }

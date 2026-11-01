// Production Showdown screens and Prism engine, isolated browser-local transport.
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
const output = process.env.SHOWDOWN_QA_OUTPUT || await mkdtemp(join(tmpdir(), 'showdown-'));
await mkdir(output, { recursive: true });
const base = process.env.SHOWDOWN_QA_URL || 'http://127.0.0.1:8102';
const users = { alex: '00000000-0000-4000-8000-000000000001', blair: '00000000-0000-4000-8000-000000000002', casey: '00000000-0000-4000-8000-000000000003' };
const club = '00000000-0000-4000-8000-000000000010';
const report = { checks: [], errors: [], runtimeErrors: [], artifacts: output,
  fixtures: 'Production pages/hooks/Prism simulation with browser-local identity and serialized replay RPC transport. No live writes.' };
let server, browser, currentPage, serverLog;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
console.log('Showdown artifacts:', output);

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
  if (!process.env.SHOWDOWN_QA_URL) {
    serverLog = createWriteStream(join(output, 'vite.log'));
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '8102', '--strictPort'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error('Preview exited; inspect vite.log');
    try { if ((await fetch(`${base}/scripts/fixtures/showdown.html`)).ok) break; } catch { /* Bounded startup. */ }
    if (attempt === 99) throw Error('Showdown preview did not start within twenty seconds.');
    await delay(200);
  }
  browser = await chromium.launch({ executablePath: process.env.SHOWDOWN_QA_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
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
  await page.goto(`${base}/scripts/fixtures/showdown.html?${params}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.showdownReady && window.showdownQa && window.showdownQueryClient);
  await expect(page.getByTestId('showdown-shell').or(page.getByTestId('prism-game')).first()).toBeVisible();
  await settle(page);
}
async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity), undefined, { timeout: 4000 });
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
    const board = document.querySelector('[data-testid="prism-board"]');
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
async function matchId(page) { return page.evaluate(() => document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route')?.split('/').pop()?.split('?')[0]); }
async function fixtureRpc(page, name, args) {
  const response = await page.evaluate(({ name, args }) => window.showdownQa.rpc(name, args), { name, args });
  if (response.error) throw Error(`Fixture RPC ${name} failed: ${response.error.code} ${response.error.message}`);
  if (!response.data) throw Error(`Fixture RPC ${name} returned no authorized data.`);
  return response.data;
}
async function createChallenge(page, name = 'Blair', { loseResponse = false } = {}) {
  await page.getByRole('button', { name: 'Challenge a member', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New showdown' });
  await expect(dialog).toBeVisible();
  const select = dialog.getByRole('combobox', { name: 'Club member' });
  await select.selectOption(users[name.toLowerCase()]);
  checked('challenge-picker-does-not-offer-self', !(await select.locator('option').evaluateAll(options => options.map(option => option.value))).includes(await page.evaluate(() => window.showdownQa.userId)));
  if (loseResponse) await page.evaluate(() => window.showdownQa.failNext('showdown_create', true));
  await dialog.getByRole('button', { name: 'Send challenge', exact: true }).click();
  if (loseResponse) {
    await expect(dialog.getByRole('alert')).toBeVisible();
    await shot(page, 'create-committed-response-interrupted');
    await dialog.getByRole('button', { name: 'Send challenge', exact: true }).click();
  }
  await expect(page.getByTestId('prism-board')).toBeVisible();
  const id = await matchId(page);
  if (loseResponse) {
    const info = await page.evaluate(() => ({ rows: window.showdownQa.state.challenges.length, calls: window.showdownQa.calls.filter(call => call.name === 'showdown_create') }));
    checked('lost-create-response-retries-the-same-identity-once', info.rows === 1 && info.calls.length === 2 && info.calls[0].args.p_request_id === info.calls[1].args.p_request_id);
  }
  return id;
}
async function solveCurrent(page, id, round, { retry = false } = {}) {
  await expect(page.getByTestId('prism-game')).toHaveAttribute('data-prism-round', String(round));
  await expect(page.getByText('Moves saved', { exact: true })).toBeVisible();
  const result = await page.evaluate(({ id, round }) => window.showdownQa.solve(id, round), { id, round });
  checked(`solver-${id}-round-${round}`, result.solvable && !result.exhausted);
  if (retry) await page.evaluate(() => window.showdownQa.failNext('showdown_submit_round'));
  for (const action of result.actions) {
    if (action.type !== 'rotate') throw Error('Offline solver returned a non-rotation action.');
    await page.locator(`[data-prism-cell="${action.cell}"]`).click();
  }
  if (retry) {
    await expect(page.getByRole('button', { name: 'Retry round submission', exact: true })).toBeVisible();
    await shot(page, 'round-verification-retry');
    await fit(page, 'solved-round-retry-stays-operable', { game: true });
    await page.getByRole('button', { name: 'Retry round submission', exact: true }).click();
  }
  await page.waitForFunction(({ id, round }) => window.showdownQa.state.challenges.find(item => item.id === id)?.players.find(player => player.user_id === window.showdownQa.userId)?.attempts[round - 1].submitted, { id, round });
  if (retry) {
    const calls = await page.evaluate(({ id, round }) => window.showdownQa.calls.filter(call => call.name === 'showdown_submit_round' && call.args.p_challenge_id === id && call.args.p_round_number === round), { id, round });
    checked('failed-round-retry-keeps-exact-submission', calls.length === 2 && JSON.stringify(calls[0].args) === JSON.stringify(calls[1].args));
  }
}
async function skipCurrent(page, id, round) {
  await page.getByRole('button', { name: 'Skip puzzle', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Confirm puzzle skip' })).toBeVisible();
  await visibleControl(page.getByRole('button', { name: 'Skip for 0 points', exact: true }), `skip-confirm-round-${round}-visible`);
  await page.getByRole('button', { name: 'Skip for 0 points', exact: true }).click();
  await page.waitForFunction(({ id, round }) => window.showdownQa.state.challenges.find(item => item.id === id)?.players.find(player => player.user_id === window.showdownQa.userId)?.attempts[round - 1].submitted, { id, round });
}
async function rawCreate(page, recipient = users.blair, rematchOf = null) {
  return page.evaluate(async ({ recipient, rematchOf }) => {
    const response = await window.showdownQa.rpc('showdown_create', { p_game_key: 'prism_break', p_recipient_id: recipient, p_rematch_of: rematchOf, p_request_id: crypto.randomUUID() });
    if (response.error) throw Error(response.error.message);
    return response.data.challenge.id;
  }, { recipient, rematchOf });
}
async function arrangeRounds(page, id, count, outcome = 'skipped') {
  return page.evaluate(async ({ id, count, outcome }) => {
    const opening = await window.showdownQa.rpc('showdown_get', { p_challenge_id: id, p_start: true });
    if (opening.error) throw Error(opening.error.message);
    for (let number = 1; number <= count; number++) {
      const snapshot = await window.showdownQa.rpc('showdown_get', { p_challenge_id: id, p_start: false });
      if (snapshot.error) throw Error(snapshot.error.message);
      const round = snapshot.data.rounds[number - 1];
      if (round.me.submitted) continue;
      const actions = outcome === 'skipped' ? round.me.actions : [...round.me.actions, ...window.showdownQa.solve(id, number).actions];
      const response = await window.showdownQa.rpc('showdown_submit_round', { p_challenge_id: id, p_round_number: number, p_actions: actions, p_expected_revision: round.me.revision, p_request_id: crypto.randomUUID(), p_skip: outcome === 'skipped' });
      if (response.error) throw Error(response.error.message);
    }
  }, { id, count, outcome });
}
async function privacy(page, id, label) {
  const check = await page.evaluate(async id => {
    const response = await window.showdownQa.rpc('showdown_get', { p_challenge_id: id, p_start: false });
    const data = response.data;
    if (!data) return { ok: false, reason: 'No authorized snapshot.' };
    const other = data.challenge.players.find(player => player.user_id !== window.showdownQa.userId);
    return { ok: other.total_score === null && other.solved_count === null && other.rotations === null
      && data.rounds.every(round => round.opponent === null && (round.me.submitted || round.minimum_rotations === null)
      && (!round.puzzle || !('validation' in round.puzzle) && !('minimumRotations' in round.puzzle))), data };
  }, id);
  checked(label, check.ok);
}
async function captureFailure(page) {
  if (!page) return;
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  const details = await page.evaluate(() => ({ text: document.body.innerText, route: document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route'), url: location.href, user: window.showdownQa?.userId, club: window.showdownQa?.clubId, calls: window.showdownQa?.calls.slice(-20) })).catch(error => ({ error: String(error) }));
  await writeFile(join(output, 'failure.json'), JSON.stringify(details, null, 2));
  const pages = browser?.contexts().flatMap(context => context.pages()) ?? [];
  const snapshots = [];
  for (const [index, openPage] of pages.entries()) {
    await openPage.screenshot({ path: join(output, `failure-page-${index}.png`) }).catch(() => {});
    snapshots.push(await openPage.evaluate(() => ({ text: document.body.innerText, url: location.href,
      user: window.showdownQa?.userId, club: window.showdownQa?.clubId, calls: window.showdownQa?.calls,
      state: window.showdownQa?.state, round: document.querySelector('[data-prism-round]')?.getAttribute('data-prism-round'),
      phase: document.querySelector('[data-prism-phase]')?.getAttribute('data-prism-phase') })).catch(error => ({ error: String(error) })));
  }
  await writeFile(join(output, 'failure-pages.json'), JSON.stringify(snapshots, null, 2));
}

async function journey() {
  const run = `journey-${Date.now()}`;
  const { context, page } = await setup(390, 844, 'dark');
  await go(page, '/showdown', { run });
  await shot(page, '390x844-dark-lobby');
  await fit(page, 'lobby-390x844-dark');
  const id = await createChallenge(page, 'Blair', { loseResponse: true });
  await privacy(page, id, 'new-match-opponent-and-par-remain-private');
  await fit(page, 'easy-board-390x844-dark', { game: true });
  await shot(page, '390x844-dark-easy');
  const firstCell = await page.evaluate(id => window.showdownQa.solve(id, 1).actions[0].cell, id);
  await page.locator(`[data-prism-cell="${firstCell}"]`).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Reset board', exact: true }).click();
  await solveCurrent(page, id, 1, { retry: true });
  await expect(page.getByTestId('prism-board')).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('prism-board')).toBeVisible();
  const resumed = await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id).players.find(player => player.user_id === window.showdownQa.userId).attempts, id);
  checked('round-one-survives-reload-and-reset-keeps-rotation-cost', resumed[0].submitted && resumed[0].rotations > 2 && !resumed[1].submitted);
  await solveCurrent(page, id, 2);
  await solveCurrent(page, id, 3);
  await privacy(page, id, 'completed-first-player-cannot-read-opponent-score-or-solution');
  await shot(page, '390x844-dark-waiting');
  const recipient = await pageFor(context);
  await go(recipient, '/showdown', { run, user: users.blair });
  await recipient.getByRole('link', { name: 'Play challenge', exact: false }).click();
  await expect(recipient.getByTestId('prism-board')).toBeVisible();
  checked('recipient-enters-directly-without-an-accept-screen', (await matchId(recipient)) === id);
  await privacy(recipient, id, 'recipient-cannot-read-finished-challenger-score');
  for (let round = 1; round <= 3; round++) await solveCurrent(recipient, id, round);
  await expect(recipient.getByTestId('showdown-results')).toBeVisible();
  await shot(recipient, '390x844-dark-results');
  const final = await recipient.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id), id);
  checked('authoritative-score-and-winner', final.status === 'completed' && final.winner_id === users.blair && final.players[1].attempts.reduce((sum, round) => sum + round.score, 0) === 1500);
  checked('real-local-notification-records', (await recipient.evaluate(() => window.showdownQa.state.notifications)).filter(item => item.url === `/showdown/${id}`).length >= 4);
  await recipient.getByRole('button', { name: 'Inspect round 1', exact: true }).click();
  await expect(recipient.getByRole('dialog', { name: 'Round 1 replay' })).toBeVisible();
  await shot(recipient, '390x844-dark-round-inspection');
  await recipient.keyboard.press('Escape');
  await recipient.getByRole('button', { name: 'Rematch', exact: true }).click();
  await expect(recipient.getByTestId('prism-board')).toBeVisible();
  const rematch = await matchId(recipient);
  const rows = await recipient.evaluate(() => window.showdownQa.state.challenges);
  checked('rematch-keeps-reference-and-picks-new-frozen-content', rows.length === 2 && rows[1].rematch_of === id && rows[0].puzzle_keys.every(key => !rows[1].puzzle_keys.includes(key)));
  for (let round = 1; round <= 3; round++) await solveCurrent(recipient, rematch, round);
  await go(page, `/showdown/${rematch}`, { run });
  for (let round = 1; round <= 3; round++) await solveCurrent(page, rematch, round);
  await expect(page.getByTestId('showdown-results')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Perfectly matched.' })).toBeVisible();
  const drawn = await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id), rematch);
  checked('equal-score-solved-count-and-rotations-is-a-legitimate-draw', drawn.outcome === 'draw' && drawn.winner_id === null);
  await shot(page, '390x844-dark-draw');
  await go(recipient, '/showdown?tab=standings', { run, user: users.blair });
  await expect(recipient.getByLabel('Game standings')).toBeVisible();
  const lobby = await fixtureRpc(recipient, 'showdown_lobby', { p_game_key: 'prism_break', p_cursor: null, p_limit: 30 });
  checked('career-and-rivalry-records-count-only-completed-games', lobby.record.played === 2 && lobby.record.wins === 1 && lobby.record.draws === 1 && lobby.rivalries[0].played === 2);
  checked('standings-use-win-draw-normalization', lobby.standings[0].points === 4 && lobby.standings[1].points === 1);
  await shot(recipient, '390x844-dark-standings-rivalry');
  console.log('PASS asynchronous-two-player-journey');
  await context.close();
}

async function presentationMatrix() {
  const cases = [
    [320, 568, 'dark', 'no-preference'], [320, 568, 'light', 'no-preference'],
    [390, 844, 'light', 'no-preference'], [390, 844, 'dark', 'reduce'],
    [844, 390, 'dark', 'no-preference'], [844, 390, 'light', 'reduce'],
    [768, 1024, 'light', 'no-preference'], [1440, 900, 'dark', 'no-preference'], [1440, 900, 'light', 'reduce'],
  ];
  for (let index = 0; index < cases.length; index++) {
    const [width, height, theme, motion] = cases[index];
    const label = `${width}x${height}-${theme}-${motion}`;
    const run = `presentation-${index}-${Date.now()}`;
    const { context, page } = await setup(width, height, theme, motion);
    await go(page, '/showdown', { run, theme });
    await fit(page, `lobby-${label}`);
    await shot(page, `${label}-lobby`);
    await page.evaluate(index => window.showdownQa.selectionOffset(index), index % 6);
    const id = await rawCreate(page);
    await arrangeRounds(page, id, 2);
    await go(page, `/showdown/${id}`, { run, theme });
    await expect(page.getByTestId('prism-game')).toHaveAttribute('data-prism-round', '3');
    const showcase = await page.evaluate(id => window.showdownQa.showcase(id, 3), id);
    for (const action of showcase) await page.locator(`button[data-prism-cell="${action.cell}"]`).click();
    await fit(page, `hard-game-${label}`, { game: true });
    await visibleControl(page.getByRole('button', { name: 'Reset board', exact: true }), `reset-visible-${label}`);
    await visibleControl(page.getByRole('button', { name: 'Skip puzzle', exact: true }), `skip-visible-${label}`);
    await visibleControl(page.getByRole('button', { name: 'Select previous mirror', exact: true }), `full-size-alternative-mirror-controls-${label}`);
    const dimensions = await page.getByTestId('prism-board').boundingBox();
    checked(`hard-board-has-useful-mobile-space-${label}`, dimensions.width >= Math.min(170, width * .4) && dimensions.height >= Math.min(170, height * .4), dimensions);
    const symbols = await page.locator('[data-testid="prism-board"] .is-receiver').first().getAttribute('aria-label');
    checked(`receivers-have-noncolor-identification-${label}`, /receiver.+[A-Z]/.test(symbols));
    if (motion === 'reduce') checked(`reduced-motion-has-no-continuous-board-animation-${label}`, await page.getByTestId('prism-game').evaluate(node => node.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running' || animation.effect?.getTiming().iterations !== Infinity)));
    await shot(page, `${label}-hard-beams`);
    await skipCurrent(page, id, 3);
    await expect(page.getByTestId('showdown-waiting')).toBeVisible();
    const other = await pageFor(context);
    await go(other, '/showdown', { run, theme, user: users.blair });
    await arrangeRounds(other, id, 3);
    await go(page, `/showdown/${id}`, { run, theme });
    await expect(page.getByTestId('showdown-results')).toBeVisible();
    await fit(page, `result-${label}`);
    const scoreRows = await page.locator('.sd-score-player').evaluateAll(players => players.map(player => [
      player.querySelector('.sd-score-total'), ...player.querySelectorAll(':scope > small'),
    ].map(node => node.getBoundingClientRect().y)));
    checked(`side-by-side-scores-and-statistics-align-${label}`, scoreRows.length === 2
      && scoreRows[0].length === 3 && scoreRows[0].every((y, row) => Math.abs(y - scoreRows[1][row]) <= 1), scoreRows);
    await shot(page, `${label}-result`);
    await page.getByRole('button', { name: 'Inspect round 3', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Round 3 replay' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Blair', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Blair', exact: true })).toHaveAttribute('aria-pressed', 'true');
    checked(`completed-board-is-read-only-${label}`, await dialog.locator('button[data-prism-cell]').count() === 0);
    await fit(page, `inspector-${label}`);
    await shot(page, `${label}-round-inspector`);
    await context.close();
    console.log('PASS presentation', label);
  }
}

async function reliability() {
  const run = `reliability-${Date.now()}`;
  const { context, page } = await setup(390, 844, 'light');
  await go(page, '/showdown', { run, theme: 'light', fail: 'showdown_lobby' });
  await expect(page.getByRole('alert')).toBeVisible();
  checked('lobby-failure-does-not-render-fake-challenges', await page.getByTestId('showdown-challenge-card').count() === 0);
  await page.evaluate(() => window.showdownQa.failNext('showdown_lobby', false, 0));
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByTestId('showdown-lobby')).toBeVisible();
  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.delete('fail');
    history.replaceState(null, '', url);
  });
  const id = await createChallenge(page);
  const mirror = page.locator('button[data-prism-cell]').first();
  const cell = Number(await mirror.getAttribute('data-prism-cell'));
  await page.evaluate(() => window.showdownQa.failNext('showdown_save_round', true));
  await mirror.click();
  await expect(page.getByRole('button', { name: 'Retry saving moves', exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('prism-board')).toBeVisible();
  await expect(page.getByTestId('prism-rotations')).toHaveText('1');
  await page.waitForFunction(id => window.showdownQa.state.challenges.find(row => row.id === id).players[0].attempts[0].revision === 1, id);
  const saved = await page.evaluate(({ id, cell }) => ({
    round: window.showdownQa.state.challenges.find(row => row.id === id).players[0].attempts[0],
    pending: [...Array(localStorage.length)].map((_value,index) => localStorage.key(index)).filter(key => key?.startsWith('dh:showdown:outbox:v1:')).map(key => JSON.parse(localStorage.getItem(key))), cell,
  }), { id, cell });
  checked('reload-replays-a-lost-acknowledgement-without-extra-rotations', saved.round.actions.length === 1 && saved.round.actions[0].cell === cell && saved.round.revision === 1);
  const secondDevice = await pageFor(context);
  await go(secondDevice, `/showdown/${id}`, { run, theme: 'light' });
  await expect(secondDevice.getByTestId('prism-rotations')).toHaveText('1');
  await page.getByRole('button', { name: 'Reset board', exact: true }).click();
  await page.waitForFunction(id => window.showdownQa.state.challenges.find(row => row.id === id).players[0].attempts[0].revision === 2, id);
  // The second device still holds revision1, so its different suffix must lose cleanly.
  const originalMirrorLabel = await secondDevice.locator('button[data-prism-cell]').last().getAttribute('aria-label');
  await secondDevice.locator('button[data-prism-cell]').last().click();
  await secondDevice.waitForFunction(id => window.showdownQa.calls.some(call => call.response_for === 'showdown_get'
    && call.data.challenge.id === id && call.data.rounds[0].me.revision === 2), id);
  await expect(secondDevice.getByTestId('prism-rotations')).toHaveText('1');
  await expect(secondDevice.locator('button[data-prism-cell]').last()).toHaveAttribute('aria-label', originalMirrorLabel);
  const restoredOutbox = await secondDevice.evaluate(id => {
    const key = `dh:showdown:outbox:v1:${window.showdownQa.userId}:${window.showdownQa.clubId}:${id}`;
    return JSON.parse(localStorage.getItem(key));
  }, id);
  checked('parallel-device-restores-the-visible-and-durable-board', restoredOutbox.actions.length === 2
    && restoredOutbox.actions[1].type === 'reset' && restoredOutbox.pending === null);
  const authoritative = await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id).players[0].attempts[0], id);
  checked('parallel-device-conflict-restores-the-authoritative-prefix', authoritative.actions.length === 2 && authoritative.actions[1].type === 'reset' && authoritative.rotations === 1);
  await shot(secondDevice, 'second-device-conflict-recovery');
  const excluded = await pageFor(context);
  await go(excluded, `/showdown/${id}`, { run, theme: 'light', user: users.casey });
  await expect(excluded.getByRole('alert')).toBeVisible();
  checked('uninvited-club-member-cannot-open-a-private-match', await excluded.getByTestId('prism-board').count() === 0 && await excluded.getByTestId('showdown-results').count() === 0);
  await go(excluded, `/showdown/${id}`, { run, theme: 'light', clubId: '00000000-0000-4000-8000-000000000011' });
  await expect(excluded.getByRole('alert')).toBeVisible();
  checked('another-club-cannot-open-a-private-match', await excluded.getByTestId('prism-board').count() === 0);
  currentPage = page;
  await page.evaluate(id => window.showdownQa.expire(id), id);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'The light has faded.' })).toBeVisible();
  const afterExpiry = await fixtureRpc(page, 'showdown_lobby', { p_game_key: 'prism_break', p_cursor: null, p_limit: 30 });
  checked('expiry-records-no-win-loss-or-score-improvement', afterExpiry.record.played === 0 && afterExpiry.challenges[0].status === 'expired');
  await shot(page, 'expired-challenge');
  const removedId = await rawCreate(page, users.casey);
  await page.evaluate(user => window.showdownQa.removeMember(user), users.casey);
  await go(page, `/showdown/${removedId}`, { run, theme: 'light' });
  await expect(page.getByRole('heading', { name: 'Challenge closed.' })).toBeVisible();
  checked('removed-opponent-closes-without-result', (await fixtureRpc(page, 'showdown_lobby', { p_game_key: 'prism_break', p_cursor: null, p_limit: 30 })).record.played === 0);
  await go(page, '/showdown', { run, theme: 'light' });
  const cancelledId = await rawCreate(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Cancel invite', exact: true }).click();
  await page.getByRole('dialog', { name: 'Cancel challenge?' }).getByRole('button', { name: 'Cancel challenge', exact: true }).click();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
  checked('cancel-records-no-win-or-loss', (await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id), cancelledId)).status === 'cancelled');
  const declinedId = await rawCreate(page);
  const recipient = await pageFor(context);
  await go(recipient, '/showdown', { run, theme: 'light', user: users.blair });
  await recipient.getByRole('button', { name: 'Decline', exact: true }).click();
  await recipient.getByRole('dialog', { name: 'Decline challenge?' }).getByRole('button', { name: 'Decline challenge', exact: true }).click();
  await recipient.waitForFunction(id => window.showdownQa.state.challenges.find(row => row.id === id)?.status === 'declined', declinedId);
  await expect(recipient.getByText('Challenge declined. Your record is unchanged.', { exact: true })).toBeVisible();
  const declined = await recipient.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id), declinedId);
  checked('recipient-can-decline-before-starting-without-a-record', declined.status === 'declined' && declined.players[1].started_at === null);
  await context.close();
  console.log('PASS reliability-and-permissions');
}

async function simultaneousFinish() {
  const run = `simultaneous-${Date.now()}`;
  const { context, page } = await setup(390, 844, 'dark');
  await go(page, '/showdown', { run });
  const id = await rawCreate(page);
  await arrangeRounds(page, id, 2);
  const other = await pageFor(context);
  await go(other, '/showdown', { run, user: users.blair });
  await arrangeRounds(other, id, 2);
  await go(page, `/showdown/${id}`, { run });
  await go(other, `/showdown/${id}`, { run, user: users.blair });
  const a = await page.evaluate(id => window.showdownQa.solve(id, 3).actions, id);
  const b = await other.evaluate(id => window.showdownQa.solve(id, 3).actions, id);
  await page.bringToFront();
  for (const action of a.slice(0,-1)) await page.locator(`button[data-prism-cell="${action.cell}"]`).click();
  await other.bringToFront();
  for (const action of b.slice(0,-1)) await other.locator(`button[data-prism-cell="${action.cell}"]`).click();
  await expect(page.getByTestId('prism-rotations')).toHaveText(String(a.length - 1));
  await expect(other.getByTestId('prism-rotations')).toHaveText(String(b.length - 1));
  await Promise.all([page.evaluate(() => window.showdownQa.hold('showdown_submit_round')),
    other.evaluate(() => window.showdownQa.hold('showdown_submit_round'))]);
  // Mouse focus belongs to one tab. Complete each actual board in the foreground,
  // then release the pending RPCs together to exercise concurrent result commits.
  for (const [actorPage, solution] of [[page, a], [other, b]]) {
    currentPage = actorPage;
    await actorPage.bringToFront();
    await actorPage.locator(`button[data-prism-cell="${solution.at(-1).cell}"]`).click();
    await expect(actorPage.getByTestId('prism-board')).toHaveAttribute('data-prism-solved', 'true');
    await expect(actorPage.getByTestId('prism-game')).toHaveAttribute('data-prism-phase', 'sending');
    await actorPage.waitForFunction(id => window.showdownQa.calls.some(call => call.name === 'showdown_submit_round'
      && call.args.p_challenge_id === id && call.args.p_round_number === 3), id);
  }
  checked('both-real-ui-solutions-await-authoritative-completion',
    (await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id), id)).players.every(player => player.finished_at === null));
  await Promise.all([page.evaluate(() => window.showdownQa.release('showdown_submit_round')),
    other.evaluate(() => window.showdownQa.release('showdown_submit_round'))]);
  await page.waitForFunction(id => window.showdownQa.state.challenges.find(row => row.id === id).status === 'completed', id);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await other.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('showdown-results')).toBeVisible();
  await expect(other.getByTestId('showdown-results')).toBeVisible();
  const state = await page.evaluate(() => window.showdownQa.state);
  checked('simultaneous-completion-creates-one-draw-and-two-result-notifications', state.challenges.length === 1 && state.challenges[0].outcome === 'draw' && state.notifications.filter(row => row.title === 'Showdown drawn').length === 2);
  await context.close();
  console.log('PASS simultaneous-finish');
}

try {
  const scenarios = { presentation: presentationMatrix, journey, reliability, simultaneous: simultaneousFinish };
  const requested = (process.env.SHOWDOWN_QA_SECTION || 'all').split(',').map(section => section.trim()).filter(Boolean);
  const selected = requested.includes('all') ? Object.keys(scenarios) : requested;
  if (!selected.length || selected.some(section => !Object.hasOwn(scenarios, section))) throw Error('SHOWDOWN_QA_SECTION must select all, presentation, journey, reliability or simultaneous (comma separated).');
  report.sections = selected;
  await start();
  for (const section of selected) await scenarios[section]();
  checked('no-unhandled-browser-errors', report.runtimeErrors.length === 0, report.runtimeErrors);
  console.log(`PASS DH Showdown: ${report.checks.length} checks`);
} catch (error) {
  report.errors.push(error.stack || String(error));
  await captureFailure(currentPage);
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Report:', join(output, 'report.json'));
  await cleanup();
}

// Production Showdown screens and Afterimage engine, isolated browser-local transport.
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
const output = process.env.AFTERIMAGE_QA_OUTPUT || await mkdtemp(join(tmpdir(), 'afterimage-'));
await mkdir(output, { recursive: true });
const base = process.env.AFTERIMAGE_QA_URL || 'http://127.0.0.1:8103';
const users = { alex: '00000000-0000-4000-8000-000000000001', blair: '00000000-0000-4000-8000-000000000002', casey: '00000000-0000-4000-8000-000000000003' };
const club = '00000000-0000-4000-8000-000000000010';
const report = { checks: [], errors: [], runtimeErrors: [], artifacts: output,
  fixtures: 'Production pages/hooks/Afterimage simulation with browser-local identity and serialized replay RPC transport. No live writes.' };
let server, browser, currentPage, serverLog;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
console.log('Afterimage artifacts:', output);

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
  if (!process.env.AFTERIMAGE_QA_URL) {
    serverLog = createWriteStream(join(output, 'vite.log'));
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '8103', '--strictPort'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error('Preview exited; inspect vite.log');
    try { if ((await fetch(`${base}/scripts/fixtures/afterimage.html`)).ok) break; } catch { /* Bounded startup. */ }
    if (attempt === 99) throw Error('Showdown preview did not start within twenty seconds.');
    await delay(200);
  }
  browser = await chromium.launch({ executablePath: process.env.AFTERIMAGE_QA_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
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
async function go(page, route = '/showdown?game=afterimage', { user = users.alex, theme = 'dark', run = 'main', clubId = club, fail = '' } = {}) {
  currentPage = page;
  const params = new URLSearchParams({ route, user, theme, run, club: clubId, fail });
  await page.goto(`${base}/scripts/fixtures/afterimage.html?${params}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.showdownReady && window.showdownQa && window.showdownQueryClient);
  await expect(page.getByTestId('showdown-shell').or(page.getByTestId('afterimage-game')).or(page.getByTestId('prism-game')).first()).toBeVisible();
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
async function matchId(page) { return page.evaluate(() => document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route')?.split('/').pop()?.split('?')[0]); }
async function rpc(page, name, args) {
  const result = await page.evaluate(({ name, args }) => window.showdownQa.rpc(name, args), { name, args });
  if (result.error) throw Error(`${name}: ${result.error.code} ${result.error.message}`);
  assert.ok(result.data, `${name} returned no data`); return result.data;
}
async function unobscuredStudy(page, label) {
  await settle(page);
  const obscured = await page.evaluate(() => {
    const timer = document.querySelector('.ai-study-clock')?.getBoundingClientRect();
    if (!timer) return ['Study countdown is missing.'];
    return [...document.querySelectorAll('[data-testid="afterimage-study"] [data-afterimage-object]')].filter(node => {
      const box = node.getBoundingClientRect();
      return Math.min(box.right, timer.right) - Math.max(box.left, timer.left) > 1
        && Math.min(box.bottom, timer.bottom) - Math.max(box.top, timer.top) > 1;
    }).map(node => node.getAttribute('aria-label'));
  });
  checked(label, obscured.length === 0, obscured);
}
async function rawCreate(page, rematch = null) {
  return (await rpc(page, 'showdown_create', { p_recipient_id: users.blair, p_game_key: 'afterimage', p_request_id: await page.evaluate(() => crypto.randomUUID()), p_rematch_of: rematch })).challenge.id;
}
async function createChallenge(page) {
  await page.getByRole('button', { name: 'Challenge a member', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New showdown' });
  await dialog.getByRole('radio', { name: 'Afterimage', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Club member' }).selectOption(users.blair);
  await dialog.getByRole('button', { name: 'Send challenge', exact: true }).click();
  await expect(page.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-phase', 'ready'); return matchId(page);
}
async function recall(page, id, round, { realTime = false } = {}) {
  await page.bringToFront();
  await expect(page.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-round', String(round));
  await expect(page.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-phase', 'ready');
  checked(`ready-conceals-scene-${round}`, await page.locator('[data-afterimage-object]').count() === 0);
  await page.getByRole('button', { name: 'Ready to study', exact: true }).click();
  await expect(page.getByTestId('afterimage-study')).toBeVisible();
  if (!realTime) {
    await page.evaluate(({ id, round }) => window.showdownQa.expireStudy(id, round), { id, round });
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect(page.getByTestId('afterimage-recall')).toBeVisible({ timeout: 11000 });
  const snapshot = await rpc(page, 'showdown_get', { p_challenge_id: id, p_start: false });
  checked(`recall-has-no-answer-map-${round}`, !snapshot.rounds[round - 1].scene.answers && snapshot.rounds[round - 1].me.correct_count === null);
  return page.evaluate(({ id, round }) => window.showdownQa.answers(id, round), { id, round });
}
async function place(page, answer, method = 'tap') {
  await page.bringToFront();
  const piece = page.locator(`button[data-afterimage-piece="${answer.object_id}"]`), slot = page.locator(`button[data-afterimage-slot="${answer.slot_id}"]`);
  if (method === 'keyboard') { await piece.focus(); await page.keyboard.press('Enter'); await slot.focus(); await page.keyboard.press('Space'); }
  else if (method === 'drag') await piece.dragTo(slot);
  else if (method === 'touch') {
    const start = await piece.boundingBox(), end = await slot.boundingBox(), session = await page.context().newCDPSession(page);
    const from = { x: start.x + start.width / 2, y: start.y + start.height / 2 }, to = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
      for (let step = 1; step <= 5; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 5, y: from.y + (to.y - from.y) * step / 5, id: 1 }] });
      await expect(page.getByTestId('afterimage-drag-preview')).toBeVisible();
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await session.detach(); }
  }
  else { await piece.tap(); await slot.tap(); }
  await expect(slot).not.toHaveAttribute('aria-label', /empty/);
}
async function seal(page, id, round, { retry = false } = {}) {
  if (retry) await page.evaluate(() => window.showdownQa.failNext('showdown_submit_reconstruction'));
  await page.getByRole('button', { name: 'Submit memory', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Confirm final memory' })).toBeVisible();
  await visibleControl(page.getByRole('button', { name: 'Seal this memory', exact: true }), `seal-confirm-reachable-${round}`);
  await page.getByRole('button', { name: 'Seal this memory', exact: true }).click();
  if (retry) {
    await expect(page.getByRole('button', { name: 'Retry memory submission', exact: true })).toBeVisible();
    await fit(page, 'submission-retry-fits', { game: true }); await shot(page, 'memory-submission-retry');
    await page.getByRole('button', { name: 'Retry memory submission', exact: true }).click();
  }
  await page.waitForFunction(({ id, round }) => window.showdownQa.state.challenges.find(row => row.id === id).players.find(player => player.user_id === window.showdownQa.userId).attempts[round - 1].submitted, { id, round });
  if (retry) {
    const calls = await page.evaluate(({ id, round }) => window.showdownQa.calls.filter(call => call.name === 'showdown_submit_reconstruction' && call.args.p_challenge_id === id && call.args.p_round_number === round), { id, round });
    checked('submit-retry-keeps-request-and-layout', calls.length === 2 && JSON.stringify(calls[0].args) === JSON.stringify(calls[1].args));
  }
}
async function arrangeRounds(page, id, count) {
  await rpc(page, 'showdown_get', { p_challenge_id: id, p_start: true });
  for (let round = 1; round <= count; round++) {
    await rpc(page, 'showdown_start_study', { p_challenge_id: id, p_round_number: round, p_request_id: await page.evaluate(() => crypto.randomUUID()) });
    await page.evaluate(({ id, round }) => window.showdownQa.expireStudy(id, round), { id, round });
    const detail = await rpc(page, 'showdown_get', { p_challenge_id: id, p_start: false });
    const placements = await page.evaluate(({ id, round }) => window.showdownQa.answers(id, round), { id, round });
    await rpc(page, 'showdown_submit_reconstruction', { p_challenge_id: id, p_round_number: round, p_placements: placements, p_expected_revision: detail.rounds[round - 1].me.revision, p_request_id: await page.evaluate(() => crypto.randomUUID()) });
  }
}
async function privacy(page, id, label) {
  const detail = await rpc(page, 'showdown_get', { p_challenge_id: id, p_start: false });
  const user = await page.evaluate(() => window.showdownQa.userId), other = detail.challenge.players.find(player => player.user_id !== user);
  checked(label, other.total_score === null && other.perfect_count === null && detail.rounds.every(round => round.opponent === null && !round.scene?.answers));
}
async function journey() {
  const run = `afterimage-journey-${Date.now()}`, { context, page } = await setup(390, 844, 'dark');
  await go(page, '/showdown?game=afterimage', { run }); await shot(page, '390x844-dark-lobby');
  const id = await createChallenge(page); await fit(page, 'ready-390x844', { game: true }); await shot(page, '390x844-dark-ready');
  const answers = await recall(page, id, 1, { realTime: true });
  await fit(page, 'recall-390x844', { game: true }); await shot(page, '390x844-dark-recall');
  await place(page, answers[0]); await place(page, answers[1]);
  await place(page, { object_id: answers[1].object_id, slot_id: answers[0].slot_id });
  await expect(page.locator(`button[data-afterimage-slot="${answers[1].slot_id}"]`)).not.toHaveAttribute('aria-label', /empty/);
  checked('swapping-preserves-both-pieces-without-grading', await page.locator('.ai-scene-slot--correct,.ai-scene-slot--wrong').count() === 0);
  await page.locator(`button[data-afterimage-piece="${answers[1].object_id}"]`).tap();
  await page.getByRole('button', { name: 'Return selected object to tray', exact: true }).tap();
  await expect(page.locator(`button[data-afterimage-slot="${answers[0].slot_id}"]`)).toHaveAttribute('aria-label', /empty/);
  await page.getByRole('button', { name: 'Reset placements', exact: true }).tap();
  await place(page, answers[0], 'keyboard'); await place(page, answers[1], 'drag'); await place(page, answers[2], 'touch');
  await seal(page, id, 1, { retry: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-round', '2');
  const medium = await recall(page, id, 2); await place(page, medium[0]);
  await expect(page.getByText('Layout saved', { exact: true })).toBeVisible(); await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator(`button[data-afterimage-slot="${medium[0].slot_id}"]`)).not.toHaveAttribute('aria-label', /empty/);
  checked('midround-reload-restores-arrangement', (await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id).players[0].attempts[1].placements, id)).length === 1);
  for (const answer of medium.slice(1, 3)) await place(page, answer); await seal(page, id, 2);
  const hard = await recall(page, id, 3); for (const answer of hard) await place(page, answer); await seal(page, id, 3);
  await expect(page.getByTestId('showdown-waiting')).toBeVisible(); await privacy(page, id, 'finished-player-cannot-see-opponent-results');
  const recipient = await pageFor(context); await go(recipient, '/showdown?game=afterimage', { run, user: users.blair });
  await recipient.getByRole('link', { name: 'Play challenge', exact: false }).click();
  await expect(recipient.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-phase', 'ready'); await privacy(recipient, id, 'recipient-cannot-read-finished-player');
  for (let round = 1; round <= 3; round++) { const solution = await recall(recipient, id, round); for (const answer of solution) await place(recipient, answer); await seal(recipient, id, round); }
  await expect(recipient.getByTestId('showdown-results')).toBeVisible();
  const final = await recipient.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id), id);
  checked('authoritative-375-beats-325', final.winner_id === users.blair && final.players[0].attempts.reduce((sum, round) => sum + round.score, 0) === 325 && final.players[1].attempts.every(round => round.score === 125));
  await shot(recipient, '390x844-dark-results');
  await recipient.getByRole('button', { name: 'Inspect round 2', exact: true }).click();
  const review = recipient.getByRole('dialog', { name: 'Round 2 review' });
  await expect(review).toBeVisible(); await review.getByRole('button', { name: 'Alex', exact: true }).click();
  await review.getByRole('button', { name: 'Original scene', exact: true }).click(); await shot(recipient, '390x844-dark-original-review');
  await review.getByRole('button', { name: 'Recall placement', exact: true }).click();
  checked('review-is-read-only-and-grades-only-completed-layouts', await review.locator('button[data-afterimage-slot]').count() === 0);
  await shot(recipient, '390x844-dark-placement-review'); await recipient.keyboard.press('Escape');
  await recipient.getByRole('button', { name: 'Rematch', exact: true }).click(); await expect(recipient.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-phase', 'ready');
  const rematch = await matchId(recipient), rows = await recipient.evaluate(() => window.showdownQa.state.challenges);
  checked('rematch-is-linked-and-avoids-identical-scenes', rows[1].rematch_of === id && rows[1].id === rematch && rows[1].puzzle_keys.every(key => !rows[0].puzzle_keys.includes(key)));
  await context.close(); console.log('PASS Afterimage asynchronous journey');
}
async function presentation() {
  const cases = [[320, 568, 'dark', 'no-preference'], [320, 568, 'light', 'no-preference'], [390, 844, 'light', 'no-preference'], [844, 390, 'dark', 'reduce'], [768, 1024, 'light', 'no-preference'], [1440, 900, 'dark', 'no-preference'], [1440, 900, 'light', 'reduce']];
  for (const [index, [width, height, theme, motion]] of cases.entries()) {
    const label = `${width}x${height}-${theme}-${motion}`, run = `afterimage-matrix-${index}-${Date.now()}`, { context, page } = await setup(width, height, theme, motion);
    await go(page, '/showdown?game=afterimage', { run, theme }); await fit(page, `lobby-${label}`); await shot(page, `${label}-lobby`);
    await page.evaluate(index => window.showdownQa.selectionOffset(index), index % 6);
    const id = await rawCreate(page); await arrangeRounds(page, id, 2); await go(page, `/showdown/${id}`, { run, theme });
    await fit(page, `ready-${label}`, { game: true }); await shot(page, `${label}-ready`);
    await page.getByRole('button', { name: 'Ready to study', exact: true }).click(); await expect(page.getByTestId('afterimage-study')).toBeVisible();
    checked(`15-distinct-study-objects-${label}`, await page.locator('[data-afterimage-object]').count() === 15);
    await unobscuredStudy(page, `all-study-objects-clear-of-countdown-${label}`); await shot(page, `${label}-study`);
    await page.evaluate(id => window.showdownQa.expireStudy(id, 3), id); await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('afterimage-recall')).toBeVisible();
    const answers = await page.evaluate(id => window.showdownQa.answers(id, 3), id); await place(page, answers[0]); await place(page, answers[1]);
    await fit(page, `recall-${label}`, { game: true }); await visibleControl(page.getByRole('button', { name: 'Submit memory', exact: true }), `submit-visible-${label}`);
    checked(`five-targets-seven-pieces-${label}`, await page.locator('button[data-afterimage-slot]').count() === 5 && await page.locator('button[data-afterimage-piece]').count() === 7);
    await shot(page, `${label}-recall`); await seal(page, id, 3);
    const other = await pageFor(context); await go(other, '/showdown?game=afterimage', { run, theme, user: users.blair }); await arrangeRounds(other, id, 3);
    await go(page, `/showdown/${id}`, { run, theme }); await expect(page.getByTestId('showdown-results')).toBeVisible(); await fit(page, `results-${label}`); await shot(page, `${label}-results`);
    const positions = await page.locator('.sd-score-total').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y)); checked(`score-baselines-align-${label}`, positions.length === 2 && Math.abs(positions[0] - positions[1]) <= 1);
    await page.getByRole('button', { name: 'Inspect round 3', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Round 3 review' })).toBeVisible(); await fit(page, `review-${label}`); await shot(page, `${label}-review`);
    await context.close(); console.log('PASS presentation', label);
  }
}
async function reliability() {
  const run = `afterimage-recovery-${Date.now()}`, { context, page } = await setup(390, 844, 'dark');
  await go(page, '/showdown?game=afterimage', { run }); const id = await createChallenge(page);
  await page.evaluate(() => window.showdownQa.failNext('showdown_start_study', true));
  await page.getByRole('button', { name: 'Ready to study', exact: true }).click(); await expect(page.getByRole('button', { name: 'Check study status', exact: true })).toBeVisible();
  const windowBefore = await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id).players[0].attempts[0], id);
  await page.getByRole('button', { name: 'Check study status', exact: true }).click(); await expect(page.getByTestId('afterimage-study')).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('afterimage-study')).toBeVisible();
  const windowAfter = await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id).players[0].attempts[0], id);
  checked('lost-ready-response-and-reload-cannot-restart-study', windowBefore.study_started_at === windowAfter.study_started_at && windowBefore.study_expires_at === windowAfter.study_expires_at && windowAfter.revision === 1);
  await page.evaluate(() => window.showdownQa.failNext('showdown_get', false, 100));
  await expect(page.getByTestId('afterimage-study')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-phase', 'concealed');
  checked('study-original-art-is-concealed-even-offline', await page.locator('[data-afterimage-object]').count() === 0);
  await expect(page.getByRole('button', { name: 'Retry scene refresh', exact: true })).toBeVisible(); await shot(page, 'offline-study-cutoff');
  await page.evaluate(() => window.showdownQa.failNext('showdown_get', false, 0)); await page.getByRole('button', { name: 'Retry scene refresh', exact: true }).click(); await expect(page.getByTestId('afterimage-recall')).toBeVisible();
  const answers = await page.evaluate(id => window.showdownQa.answers(id, 1), id);
  await page.evaluate(() => window.showdownQa.failNext('showdown_save_reconstruction', true)); await place(page, answers[0]);
  await expect(page.getByRole('button', { name: 'Refresh saved layout', exact: true })).toBeVisible(); await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator(`button[data-afterimage-slot="${answers[0].slot_id}"]`)).not.toHaveAttribute('aria-label', /empty/);
  checked('lost-save-ack-reloads-one-authoritative-layout', (await page.evaluate(id => window.showdownQa.state.challenges.find(row => row.id === id).players[0].attempts[0].placements, id)).length === 1);
  const excluded = await pageFor(context); await go(excluded, `/showdown/${id}`, { run, user: users.casey }); await expect(excluded.getByRole('alert')).toBeVisible(); checked('bystander-cannot-open-afterimage', await excluded.getByTestId('afterimage-game').count() === 0);
  await go(excluded, `/showdown/${id}`, { run, clubId: '00000000-0000-4000-8000-000000000011' }); await expect(excluded.getByRole('alert')).toBeVisible(); checked('another-club-cannot-open-afterimage', await excluded.getByTestId('afterimage-game').count() === 0);
  currentPage = page; await page.evaluate(id => window.showdownQa.expire(id), id); await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.getByRole('heading', { name: 'The light has faded.' })).toBeVisible();
  checked('expired-afterimage-does-not-count-as-play', (await rpc(page, 'showdown_lobby', { p_game_key: 'afterimage', p_cursor: null, p_limit: 30 })).record.played === 0);
  await context.close(); console.log('PASS Afterimage reliability');
}
async function captureFailure(page) {
  const pages = browser?.contexts().flatMap(context => context.pages()) ?? [];
  const snapshots = [];
  if (page) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  for (const [index, openPage] of pages.entries()) {
    await openPage.screenshot({ path: join(output, `failure-page-${index}.png`) }).catch(() => {});
    snapshots.push(await openPage.evaluate(() => ({ text: document.body.innerText, url: location.href, user: window.showdownQa?.userId,
      calls: window.showdownQa?.calls, state: window.showdownQa?.state, phase: document.querySelector('[data-afterimage-phase]')?.getAttribute('data-afterimage-phase') })).catch(error => ({ error: String(error) })));
  }
  await writeFile(join(output, 'failure-pages.json'), JSON.stringify(snapshots, null, 2));
}
try {
  const scenarios = { presentation, journey, reliability };
  const requested = (process.env.AFTERIMAGE_QA_SECTION || 'all').split(',').map(section => section.trim()).filter(Boolean);
  const selected = requested.includes('all') ? Object.keys(scenarios) : requested;
  if (!selected.length || selected.some(section => !Object.hasOwn(scenarios, section))) throw Error('AFTERIMAGE_QA_SECTION must select all, presentation, journey or reliability.');
  report.sections = selected; await start(); for (const section of selected) await scenarios[section]();
  checked('no-unhandled-browser-errors', report.runtimeErrors.length === 0, report.runtimeErrors);
  console.log(`PASS Afterimage: ${report.checks.length} checks`);
} catch (error) { report.errors.push(error.stack || String(error)); await captureFailure(currentPage); console.error(error); process.exitCode = 1; }
finally { await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('Report:', join(output, 'report.json')); await cleanup(); }

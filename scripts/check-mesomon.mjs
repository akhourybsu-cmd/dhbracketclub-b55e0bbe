// Exercises the production chapter, Phaser view and local-save hook. Only the
// authentication/club/cloud transport boundary is replaced, with no live writes.
import assert from 'node:assert/strict';
import { trackBattleSprites } from './mesomon-creature-visuals.mjs';
import { fieldContactSheet, sampleField } from './mesomon-zone-visuals.mjs';
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, webkit, expect } from '@playwright/test';

const output = process.env.MESOMON_OUTPUT || await mkdtemp(join(tmpdir(), 'mesomon-'));
await mkdir(output, { recursive: true });
const engine = process.env.MESOMON_BROWSER || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const base = process.env.MESOMON_URL || 'http://127.0.0.1:8097';
const report = { engine, commit: process.env.GITHUB_SHA || null, checks: [], errors: [], runtimeErrors: [],
  scope: 'Production page, reducer, Phaser renderer and local persistence; isolated authentication/club/cloud transport. No production account writes or physical-device performance claim.' };
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
const check = (label, extra = {}) => report.checks.push({ label, ok: true, ...extra });
let server, browser, log, activePage, cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(done => server.once('exit', done)), pause(1000)]);
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
  }
  log?.end();
}
for (const [signal, status] of [['SIGINT', 130], ['SIGTERM', 143]]) process.once(signal, () => { void cleanup().then(() => process.exit(status)); });

async function setup(width, height, theme, guest = false) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 1024, reducedMotion: 'reduce' });
  const p = await context.newPage();
  await preparePage(p,theme,guest);
  return { p, context };
}
async function preparePage(p,theme,guest=false) {
  activePage=p;
  p.setDefaultTimeout(15000);
  p.on('pageerror', error => report.runtimeErrors.push(error.message));
  const fixtureOrigin = new URL(base);
  assert.equal(fixtureOrigin.hostname, '127.0.0.1', 'The fixture requires a loopback origin');
  await p.route('**/*', route => {
    const requested = new URL(route.request().url());
    const allowed = requested.origin === fixtureOrigin.origin &&
      (requested.protocol === fixtureOrigin.protocol || requested.protocol === 'blob:');
    return allowed ? route.continue() : route.abort();
  });
  const stub = (path, body) => p.route(`**/${path}*`, route => route.fulfill({ contentType: 'text/javascript', body }));
  await stub('src/integrations/supabase/client.ts', "export {supabase} from '/scripts/fixtures/mesomon-backend.ts';");
  await stub('src/contexts/AuthContext.tsx', `export const useAuth=()=>({user:${guest ? 'null' : "{id:'11111111-1111-4111-8111-111111111111',user_metadata:{display_name:'Alex'}}"},loading:false});`);
  await stub('src/contexts/ClubContext.tsx', "export const useClub=()=>({club:{id:'22222222-2222-4222-8222-222222222222',name:'Dry My Horse'},loading:false,isClubAdmin:false});");
  await stub('src/hooks/useClubAssets.ts', "export const useClubAssets=()=>({loading:false,isInstalled:slug=>slug==='mesomon',refresh:async()=>{}});");
  await p.goto(`${base}/scripts/fixtures/mesomon.html?${new URLSearchParams({ theme, ...(guest ? { guest: '1' } : {}) })}`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => Boolean(window.mmQa));
  await expect(p.locator('.mesomon')).toBeVisible();
  await p.evaluate(async()=>{await document.fonts.ready;});
}
const save = p => p.evaluate(async () => window.mmQa.readSave());
const controls = (p, name) => p.locator(`[data-mm-action="${name}"]`);
const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const arrowKeys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
const observedDialogues = new Set();
const chapterReaders = new WeakSet();
const narrowPages = new Set();
let longestPage = null;
const positionKey = player => `${player.mapId}:${player.x}:${player.y}`;
const livePlayer = p => p.locator('.mesomon').evaluate(root => ({ mapId: root.dataset.mapId, x: Number(root.dataset.playerX), y: Number(root.dataset.playerY) }));
async function waitForPlayer(p, expected) {
  await expect.poll(async () => positionKey(await livePlayer(p)), { intervals: [16, 32, 50] }).toBe(positionKey(expected));
  await expect.poll(async () => positionKey((await save(p)).player), { intervals: [16, 32, 50] }).toBe(positionKey(expected));
}
async function step(p, direction, keyboard = false) {
  const before = await livePlayer(p), [dx, dy] = directions[direction];
  if (keyboard) await p.keyboard.press(arrowKeys[direction]);
  else await press(p, direction);
  const expected = { ...before, x: before.x + dx, y: before.y + dy };
  await waitForPlayer(p, expected);
  return expected;
}
async function auditBuild() {
  const release=JSON.parse(await readFile('dist/games/mesomon/release.json','utf8'));
  assert.equal(release.schema_version,1,'The build must emit the Mesomon release metadata schema');
  assert.equal(release.chapter,'port-marche');assert.equal(release.rules_version,3);assert.equal(release.assets_version,JSON.parse(await readFile('public/games/mesomon/manifest.json','utf8')).version);
  assert.match(release.source_sha,/^[a-f\d]{40}$/,'Release metadata must contain the actual Git commit');
  assert.equal(typeof release.source_dirty,'boolean','Release metadata must identify uncommitted source');
  if(process.env.GITHUB_SHA)assert.equal(release.source_sha,process.env.GITHUB_SHA,'CI build metadata must identify the checked GitHub commit');
  if((process.env.CI&&process.env.CI!=='false')||process.env.GITHUB_ACTIONS==='true')assert.equal(release.source_dirty,false,'CI must build a clean source checkout');
  check('production-release-metadata-matches-the-built-source',{chapter:release.chapter,rulesVersion:release.rules_version,assetsVersion:release.assets_version,sourceSha:release.source_sha,sourceDirty:release.source_dirty});
  const html = await readFile('dist/index.html', 'utf8');
  const entry = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/);
  assert.ok(entry, 'Production HTML has an application module entry');
  const emitted=await readdir('dist/assets'),routes=emitted.filter(name=>/^MesomonPage-[\w-]+\.js$/.test(name)),engines=emitted.filter(name=>/^phaser-[\w-]+\.js$/i.test(name));
  assert.equal(routes.length,1,'The tested build must actually contain the registered Mesomon route');
  assert.equal(engines.length,1,'The game engine must be emitted in its own lazy chunk');
  const entrySource=await readFile(resolve('dist',entry[1].replace(/^\//,'')),'utf8');
  assert.ok(entrySource.includes(routes[0]),'The application entry must reference its Mesomon lazy route');
  const visited = new Set(), queue = [resolve('dist', entry[1].replace(/^\//, ''))];
  for (let head=0;head<queue.length;head++) {
    const path=queue[head]; if(visited.has(path))continue;visited.add(path);
    assert.ok(!/\/(?:MesomonPage|phaser|mesomon)[\w-]*\.js$/i.test(path), 'Main static graph must not eagerly import the game engine or route');
    const source=await readFile(path,'utf8');
    // Only real static imports are followed. Vite's dynamic dependency map may
    // mention Mesomon by filename; that is not an eager download.
    const imports=/(?:\bimport|\bexport)\s*[^;\n]*?\bfrom\s*["']([^"']+)["']|(?:^|[;\n])\s*import\s*["']([^"']+)["']/g;
    for(const match of source.matchAll(imports)) {
      const target=match[1]||match[2]; if(!target.endsWith('.js')||!target.startsWith('.'))continue;
      queue.push(resolve(path,'..',target));
    }
    assert.ok(visited.size<=200,'Bounded application import graph');
  }
  check('production-main-static-graph-keeps-Mesomon-lazy',{modules:visited.size,route:routes[0],engine:engines[0]});
}
async function press(p, name) { await expect(controls(p, name)).toBeVisible(); await controls(p, name).click(); }
const startMenu = p => p.getByRole('dialog', { name: 'Start menu', exact: true });
async function openStart(p) {
  const key = controls(p, 'menu');
  await expect(key).toHaveAccessibleName('Start');
  await key.click();
  const menu = startMenu(p);
  await expect(menu).toHaveAttribute('data-section', 'start');
  return menu;
}
async function closeStart(p, key = 'Escape') {
  await p.keyboard.press(key);
  await expect(startMenu(p)).toHaveCount(0);
  await expect(controls(p, 'menu')).toBeFocused();
}
async function startSection(menu, name) {
  await menu.getByRole('button', { name, exact: true }).click();
  await expect(menu.getByRole('heading', { name, exact: true })).toBeVisible();
}
async function checkFieldGuide(p, menu, known, label, sizes = [p.viewportSize()]) {
  await startSection(menu, 'Field Guide');
  const species = ['Rillik', 'Muddren', 'Gleamwing', 'Tressel', 'Rift Wretch'];
  await expect(menu.locator('.mm-guide-progress')).toContainText(known.length + ' / 5 seen');
  await expect(menu.locator('.mm-guide-unseen')).toHaveCount(5 - known.length);
  for (const name of species) {
    const button = menu.getByRole('button', {name: 'View ' + name, exact: true});
    if (known.includes(name)) {
      await expect(button).toBeEnabled();
      await button.click();
      const spread = menu.getByRole('figure', {name, exact: true});
      const art = spread.getByRole('img', {name, exact: true});
      await expect(art).toBeVisible();
      await expect.poll(() => art.evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([512, 512]);
      if (name === 'Gleamwing') await expect(spread).not.toContainText('Bonded');
      if (name === 'Rillik' || name === 'Tressel') await expect(spread).toContainText('Bonded');
      if (name === 'Rift Wretch') {
        await expect(spread).toContainText('Demon');
        await expect(spread).not.toContainText('Bonded');
      }
    } else {
      await expect(button).toHaveCount(0);
      await expect(menu).not.toContainText(name);
      assert.equal(await menu.locator('img').evaluateAll((images, id) =>
        images.some(image => new URL(image.src).pathname.toLowerCase().includes(id)),
      name.toLowerCase().replaceAll(' ', '-')), false, 'A locked entry must not reveal its artwork');
    }
  }
  const previous = p.viewportSize();
  try {
    for (const {width, height} of sizes) {
      await p.setViewportSize({width, height});
      if (known.length) {
        const figure = menu.getByRole('figure');
        const contained = await figure.locator('img').evaluate(image => {
          const rect = image.getBoundingClientRect(), panel = image.closest('.mm-menu').getBoundingClientRect();
          return rect.width >= 100 && rect.height >= 100 && rect.left >= panel.left && rect.right <= panel.right;
        });
        assert.ok(contained, 'The field plate must be large enough to inspect and fit within the open guide');
      }
      await audit(p, engine + '-' + label + '-' + width + 'x' + height);
      await p.screenshot({path: join(output, engine + '-' + label + '-' + width + 'x' + height + '.png')});
    }
  } finally {
    if (previous) await p.setViewportSize(previous);
  }
  await startHome(menu);
  check(engine + '-' + label, {known});
}
async function startHome(menu) {
  await menu.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(menu).toHaveAttribute('data-section', 'start');
}
async function noShellCommands(p) {
  await expect(p.locator('.mm-header, .mm-wordmark, .mm-location')).toHaveCount(0);
  await expect(p.getByRole('link', { name: 'Exit game', exact: true })).toHaveCount(0);
  await expect(p.getByRole('button', { name: /^(Open location chart|Settings|Journal|Companions|Field Guide|Map|Save file|Enter full screen|Leave full screen)$/i })).toHaveCount(0);
  await expect(p.getByRole('switch', { name: /^Mute\b/ })).toHaveCount(0);
  await expect(p.locator('.mm-save-status')).toHaveCount(0);
}
const opening = p => p.getByRole('dialog', {name: 'Opening cinematic', exact: true});
async function start(p, captureOpening) {
  const journey = p.getByRole('button', { name: /^(Begin|Continue) journey$/i });
  await expect(journey).toBeEnabled();
  const newFile = /^begin/i.test((await journey.textContent()).trim());
  await journey.click();
  if (newFile) {
    const scene = opening(p);
    await expect(scene).toHaveAttribute('data-shot', 'sea');
    if (captureOpening) {
      for (const shot of ['sea', 'letter', 'quay']) {
        await expect(scene).toHaveAttribute('data-shot', shot);
        await audit(p, captureOpening + '-opening-' + shot + '-fit');
        await p.screenshot({path: join(output, captureOpening + '-opening-' + shot + '.png')});
        await scene.getByRole('button', {name: shot === 'quay' ? 'Arrive at Port Marche' : 'Next scene', exact: true}).click();
      }
    } else {
      await scene.getByRole('button', {name: 'Skip opening', exact: true}).click();
    }
  }
  await expect(opening(p)).toHaveCount(0);
  await expect(p.locator('.mesomon[data-map-id]')).toHaveAttribute('data-map-id', 'ship');
  await expect(p.locator('.mesomon canvas')).toHaveCount(1);
  await expect(p.locator('.mm-screen')).toHaveAttribute('data-art-ready', 'true');
  await expect.poll(() => save(p)).not.toBeNull();
}
async function settleLayout(p) {
  await p.evaluate(async()=>{await document.fonts.ready;await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));});
}
async function conversationLine(p, expectedId) {
  const state = await save(p), dialogue = state?.dialogue;
  assert.ok(dialogue, 'Expected an active saved conversation');
  if (expectedId) assert.equal(dialogue.id, expectedId, 'The expected story beat must be active');
  const line = dialogue.lines[dialogue.index];
  assert.ok(line?.text.trim() && line.speaker.trim(), `${dialogue.id} has a readable, attributed line`);
  const panel = p.getByRole('region', {name: 'Conversation'});
  const voice = await p.evaluate(speaker => window.mmQa.readingVoice(speaker), line.speaker);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-voice', voice.kind);
  // Match the active data, not a fragment of authored prose that changes with edits.
  await expect(panel.locator('.mm-dialogue-text [aria-live="polite"]')).toHaveText(line.text);
  await expect(panel.locator('.mm-speaker strong')).toHaveText(voice.credit);
  const portrait = panel.locator('.mm-speaker img');
  if (voice.portrait) {
    await expect(portrait).toBeVisible();
    await expect.poll(() => portrait.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  } else await expect(portrait).toHaveCount(0);
  observedDialogues.add(dialogue.id);
  return { state, dialogue, panel, voice };
}
async function verifyPrintedPage(p, panel, dialogue) {
  const line = dialogue.lines[dialogue.index];
  const ink = panel.locator('.mm-dialogue-text > [aria-hidden="true"]');
  await expect(ink).toHaveText(line.text + ' ▾');
  const result = await ink.evaluate(ink => {
    const range = document.createRange();
    range.selectNodeContents(ink.firstChild);
    const lines = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
    const panel = ink.closest('.mm-dialogue');
    const box = panel.getBoundingClientRect();
    const controls = [...panel.querySelectorAll('button, .mm-speaker img')].map(node => node.getBoundingClientRect());
    return {
      rows: lines.length,
      inside: lines.every(r => r.left >= Math.max(0, box.left) - 1 && r.right <= Math.min(innerWidth, box.right) + 1 &&
        r.top >= Math.max(0, box.top) - 1 && r.bottom <= Math.min(innerHeight, box.bottom) + 1),
      clear: lines.every(r => controls.every(c => r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom)),
    };
  });
  const id = `${dialogue.id}[${dialogue.index}] ${line.speaker}`;
  assert.ok(result.rows && result.inside && result.clear, `${id} is clipped or covered at 320px: ${JSON.stringify(result)}`);
  narrowPages.add(id + ' ' + line.text);
  if (!longestPage || line.text.length > longestPage.characters) {
    longestPage = { id, characters: line.text.length, rows: result.rows };
    await p.screenshot({path:join(output, engine + '-chapter-longest-page-320x568.png')});
  }
}
async function drain(p, options = {}) {
  if (!chapterReaders.has(p) || !(await save(p))?.dialogue) return readConversation(p, options);
  const previous = p.viewportSize();
  try {
    await p.setViewportSize({width:320,height:568});
    await settleLayout(p);
    return await readConversation(p, options);
  } finally {
    await p.setViewportSize(previous);
    await settleLayout(p);
  }
}
async function readConversation(p, {inspectChoices=false, opening=false, expectedId, choiceId}={}) {
  let choicesInspected=false, selectedChoice=false;
  const readingModes = new Set();
  if (expectedId) await conversationLine(p, expectedId);
  for (let count = 0; count < 180; count++) {
    const state = await save(p);
    if (!state?.dialogue) {
      if (opening) {
        for (const kind of ['document', 'scene', 'speech']) assert.ok(readingModes.has(kind), `The opening must present its ${kind} reading mode`);
        check(engine + '-opening-shows-spoken-lines-narration-and-letter');
      }
      if (choiceId) assert.ok(selectedChoice, `Expected to explicitly select ${choiceId}`);
      return;
    }
    const { dialogue, panel, voice } = await conversationLine(p);
    const atChoices = dialogue.choices?.length && dialogue.index >= dialogue.lines.length - 1;
    if (opening) {
      const kind = voice.kind;
      if (kind && !readingModes.has(kind)) {
        if (!atChoices) {
          await expect(panel.locator('.mm-dialogue-next')).toHaveText('Continue', {timeout: 7000});
        }
        await p.screenshot({path: join(output, engine + '-reading-' + kind + '.png')});
        readingModes.add(kind);
      }
    }
    if (atChoices) {
      if (chapterReaders.has(p)) await verifyPrintedPage(p, panel, dialogue);
      assert.ok(choiceId, `Conversation ${dialogue.id} requires an explicit choice ID; QA will not choose a fallback`);
      assert.equal(dialogue.id, 'closing', 'Only the reviewed closing choice is automated');
      assert.deepEqual(dialogue.choices.map(choice => choice.id).sort(), ['direct', 'warm', 'wry']);
      const choice = dialogue.choices.find(option => option.id === choiceId);
      assert.ok(choice, `Conversation ${dialogue.id} offers the requested ${choiceId} choice`);
      await expect(panel.locator('.mm-tone-choices button')).toHaveCount(dialogue.choices.length);
      await expect(panel.locator('.mm-tone-choices button small')).toHaveText(dialogue.choices.map(option => option.label));
      const beforeChoice = JSON.stringify(dialogue);
      await press(p, 'confirm');
      assert.equal(JSON.stringify((await save(p)).dialogue), beforeChoice, 'Confirm must wait for an actual choice');
      if(inspectChoices&&!choicesInspected){
        const previous=p.viewportSize();
        try{
          await p.setViewportSize({width:320,height:568});await settleLayout(p);
          await audit(p,engine+'-closing-tone-choices-320x568-fit');
          await p.screenshot({path:join(output,engine+'-closing-tone-choices-320x568.png')});
        }finally{if(previous){await p.setViewportSize(previous);await settleLayout(p);}}
        choicesInspected=true;
      }
      const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const option = panel.getByRole('button', { name: new RegExp(`^${escape(choice.label)}\\s*${escape(choice.text)}$`) });
      await expect(option).toHaveCount(1);
      await option.click();
      await expect.poll(async () => (await save(p)).dialogue?.id).toBe('closing-after');
      const after = await save(p);
      assert.equal(after.questFlags.response_tone, choiceId);
      assert.equal(after.dialogue.lines[0].text, choice.text, 'The selected response is spoken in the followup');
      check(engine + '-closing-explicit-choice-persists-and-opens-followup', {choiceId, offeredChoiceIds: dialogue.choices.map(option => option.id)});
      selectedChoice=true;
      continue;
    }
    const next = panel.locator('.mm-dialogue-next');
    // A reveal input can become an advance if the last character lands between
    // reading the button label and sending the key. Read each page before acting.
    await expect(next).toHaveText('Continue', {timeout: 7000});
    if (chapterReaders.has(p)) await verifyPrintedPage(p, panel, dialogue);
    await press(p, 'confirm');
    await expect.poll(async () => {
      const current = (await save(p)).dialogue;
      return current ? `${current.id}:${current.index}` : null;
    }, { intervals: [16, 32, 50] }).not.toBe(`${dialogue.id}:${dialogue.index}`);
  }
  throw new Error('Dialogue did not terminate after 180 real advances.');
}
async function walkTo(p, id, meeting) {
  const route = await p.evaluate(async targetId => {
    const state = await window.mmQa.readSave(), map = window.mmQa.getMap(state), target = window.mmQa.getVisibleObjects(state).find(object => object.id === targetId);
    if (!target) throw new Error(`No object ${targetId} on ${map.id}`);
    const origin = state.player, queue = [{ x: origin.x, y: origin.y, path: [] }], seen = new Set([`${origin.x}:${origin.y}`]);
    const directions = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]];
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head];
      if (Math.abs(node.x - target.x) + Math.abs(node.y - target.y) <= 1) return node.path;
      for (const [direction, dx, dy] of directions) {
        const x = node.x + dx, y = node.y + dy, key = `${x}:${y}`;
        if (seen.has(key) || !window.mmQa.canWalk(state, x, y)) continue;
        seen.add(key); queue.push({ x, y, path: [...node.path, direction] });
      }
    }
    throw new Error(`No walkable route to ${targetId} from ${origin.x},${origin.y}`);
  }, id);
  for (const direction of route) {
    await step(p, direction);
    if (meeting && (await save(p)).dialogue?.id === meeting) return;
  }
  assert.ok(!meeting, `Walking up to ${id} must trigger the meeting without an interact press`);
}
async function interact(p, id, dialogue = true) {
  await walkTo(p, id);
  if (id === 'passage-door' || id === 'chamber-door') {
    // Tap the painted arch beyond the logical door tile after the camera settles.
    await pause(300);
    await tapMapObject(p, id, id === 'passage-door' ? {x:18,y:-5} : {x:0,y:-20});
    await expect(p.locator('.mesomon')).toHaveAttribute('data-map-id', id === 'passage-door' ? 'passage' : 'chamber');
  } else {
    await p.locator(`[data-mm-object="${id}"]`).click();
  }
  if (dialogue) await drain(p);
}
async function automaticMeeting(p, id, trigger) {
  const status = id === 'nia' ? 'Nia approaches.' : 'Bram approaches.';
  // Install before movement so even a slow runner records a brief walk-in.
  await p.evaluate(text => {
    const root = document.querySelector('.mesomon');
    const seen = {approach: false};
    const observer = new MutationObserver(() => {
      if ([...root.querySelectorAll('[role="status"]')].some(node => node.textContent.trim() === text)) {
        seen.approach = true; observer.disconnect();
      }
    });
    observer.observe(root, {childList: true, subtree: true, characterData: true});
    window.mmMeeting = seen;
  }, status);
  await trigger();
  const before = await livePlayer(p);
  await expect.poll(async () => (await save(p)).dialogue?.id).toBe(id);
  await p.keyboard.press('ArrowDown');
  await conversationLine(p, id);
  assert.deepEqual(await livePlayer(p), before, 'The player must not walk away from a meeting');
  assert.equal((await save(p)).dialogue.index, 0, 'A movement key must not skip the opening line');
  assert.equal(await p.evaluate(() => window.mmMeeting.approach), true, 'The resident must approach before the first line');
  await p.screenshot({path: join(output, engine + '-meeting-' + id + '.png')});
  await drain(p, {expectedId: id});
  const final = await save(p);
  assert.equal(final.questFlags[id + '_met'], true);
  const distance = await p.evaluate(async actor => {
    const state = await window.mmQa.readSave();
    const person = window.mmQa.getVisibleObjects(state).find(object => object.id === actor);
    return Math.abs(person.x - state.player.x) + Math.abs(person.y - state.player.y);
  }, id);
  assert.equal(distance, 1, 'The resident finishes beside the player');
  check(engine + '-automatic-meeting-' + id, {position: before, distance});
}
async function tapMapObject(p, id, offset = { x: 0, y: 0 }) {
  const canvas = p.locator('.mesomon canvas');
  const position = await canvas.evaluate(async (node, {id, offset}) => {
    const state = await window.mmQa.readSave();
    const map = window.mmQa.getMap(state);
    const object = window.mmQa.getVisibleObjects(state).find(candidate => candidate.id === id);
    if (!object) throw Error(`No object ${id} on ${map.id}`);
    // The native viewport follows the player's tile center and stops at the map edges.
    const axis = (target, player, mapTiles, pixels, rendered) => {
      const scroll = Math.max(0, Math.min(mapTiles * 16 - pixels, player * 16 + 8 - pixels / 2));
      return (target * 16 + 8 - scroll) * rendered / pixels;
    };
    const rect = node.getBoundingClientRect();
    return {
      x:axis(object.x,state.player.x,map.width,node.width,rect.width) + offset.x * rect.width / node.width,
      y:axis(object.y,state.player.y,map.height,node.height,rect.height) + offset.y * rect.height / node.height,
    };
  },{id, offset});
  await canvas.tap({position});
}
async function waitAtObject(p, id) {
  await expect.poll(async () => {
    const player = await livePlayer(p);
    return p.evaluate(({id, player}) => {
      const object = window.mmQa.getMap(player.mapId).objects.find(object => object.id === id);
      return object ? Math.abs(player.x - object.x) + Math.abs(player.y - object.y) : Infinity;
    }, {id, player});
  }, { intervals: [16, 32, 50] }).toBeLessThanOrEqual(1);
  await waitForPlayer(p, await livePlayer(p));
}
async function tapGround(p, tile) {
  const canvas = p.locator('.mesomon canvas');
  const position = await canvas.evaluate(async (node, tile) => {
    const state = await window.mmQa.readSave(), map = window.mmQa.getMap(state), rect = node.getBoundingClientRect();
    const axis = (target, player, count, pixels, rendered) => {
      const scroll = Math.max(0, Math.min(count * 16 - pixels, player * 16 + 8 - pixels / 2));
      return (target * 16 + 8 - scroll) * rendered / pixels;
    };
    return {x: axis(tile.x, state.player.x, map.width, node.width, rect.width), y: axis(tile.y, state.player.y, map.height, node.height, rect.height)};
  }, tile);
  assert.ok(position.x > 0 && position.y > 0, 'The destination must be in the rendered viewport');
  await canvas.tap({position});
}

async function observeSteps(p) {
  return p.evaluateHandle(() => {
    const root = document.querySelector('.mesomon');
    const steps = [];
    let previous = `${root.dataset.playerX}:${root.dataset.playerY}`;
    const observer = new MutationObserver(() => {
      const key = `${root.dataset.playerX}:${root.dataset.playerY}`;
      if (key === previous) return;
      steps.push({x: Number(root.dataset.playerX), y: Number(root.dataset.playerY), at: performance.now()});
      previous = key;
    });
    observer.observe(root, {attributes:true, attributeFilter:['data-player-x','data-player-y']});
    return {steps, observer};
  });
}

async function readSteps(trace) {
  const steps = await trace.evaluate(({steps, observer}) => { observer.disconnect(); return steps; });
  await trace.dispose();
  return steps;
}

async function checkDeckDetour(p) {
  const spawn = await livePlayer(p);
  const start = await step(p, 'up');
  assert.deepEqual(start, {mapId:'ship', x:8, y:8});
  const stride = await p.evaluate(() => window.mmQa.walkStepMs);
  await pause(stride + 50);
  const trace = await observeSteps(p);
  await press(p, 'up'); // Push directly against the lashed mail chest.
  await pause(stride + 50);
  await waitForPlayer(p, start);
  assert.equal(await trace.evaluate(({steps}) => steps.length), 0);

  const farSide = {mapId:'ship', x:8, y:6};
  await tapGround(p, farSide);
  await waitForPlayer(p, farSide);
  const steps = await readSteps(trace);
  const blocked = ({x,y}) => y === 7 && x >= 7 && x <= 9;
  assert.ok(steps.length >= 6, 'Reaching the far side takes a detour around the three-tile chest');
  assert.ok(!steps.some(blocked), 'A tap route cannot cross the chest');
  assert.ok(steps.some(({x,y}) => y === 7 && (x < 7 || x > 9)), 'The crew aisle must carry the player around the chest');
  steps.forEach((point, index) => {
    const previous = steps[index - 1] ?? start;
    assert.equal(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y), 1);
  });
  check(engine + '-deck-chest-blocks-dpad-and-ground-tap-walks-around-it', {steps:steps.map(({x,y}) => [x,y])});
  await pause(stride + 50);
  await tapGround(p, spawn);
  await waitForPlayer(p, spawn);
  await pause(stride + 50);
}

async function walkingPace() {
  const traces = [];
  for (const mode of ['keyboard-held', 'ground-tap']) {
    const {p, context} = await setup(390,844,'dark');
    let heldKey;
    try {
      await start(p); await drain(p); await settleLayout(p);
      const corridor = await p.evaluate(async () => {
        const state = await window.mmQa.readSave(), origin = state.player;
        for (const [direction, dx, dy] of [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]]) {
          const points = Array.from({length:4}, (_, index) => ({x: origin.x + dx * (index + 1), y: origin.y + dy * (index + 1)}));
          if (points.every(point => window.mmQa.canWalk(state, point.x, point.y)) &&
              !window.mmQa.canWalk(state, origin.x + dx * 5, origin.y + dy * 5))
            return {direction, origin, points, stepMs: window.mmQa.walkStepMs};
        }
        return null;
      });
      assert.ok(corridor, 'The arrival deck needs a visible four-tile straight route ending at a wall for a bounded pace proof');
      const trace = await observeSteps(p);
      if (mode === 'keyboard-held') {
        heldKey = arrowKeys[corridor.direction];
        await p.keyboard.down(heldKey);
      } else await tapGround(p, corridor.points.at(-1));
      await p.waitForFunction(({steps}) => steps.length >= 4, trace, {timeout: 5000});
      if (heldKey) { await p.keyboard.up(heldKey); heldKey = null; }
      const expected = {mapId: corridor.origin.mapId, ...corridor.points.at(-1)};
      await waitForPlayer(p, expected);
      const steps = await readSteps(trace);
      assert.deepEqual(steps.map(({x,y}) => ({x,y})), corridor.points, `${mode} must commit exactly the requested route`);
      const intervals = steps.slice(1).map((step, index) => step.at - steps[index].at);
      const mean = intervals.reduce((sum, duration) => sum + duration, 0) / intervals.length;
      // The first DOM receipt includes React's input-to-paint latency. A late
      // first receipt shortens the next observed interval on a busy browser.
      // Check steady walking and total elapsed time, and still reject an opening burst.
      assert.ok(intervals[0] >= corridor.stepMs / 2, `${mode} commits two opening steps together: ${JSON.stringify(intervals)}`);
      assert.ok(intervals.slice(1).every(duration => duration >= corridor.stepMs - 45), `${mode} must not advance tiles faster than its shared clock: ${JSON.stringify(intervals)}`);
      assert.ok(mean >= corridor.stepMs - 25 && mean <= corridor.stepMs + 100,
        `${mode} must walk at the authored pace (${corridor.stepMs}ms): ${JSON.stringify(intervals)}`);
      traces.push({mode, stepMs: corridor.stepMs, intervals: intervals.map(value => Math.round(value)), mean: Math.round(mean), steps: corridor.points});
    } finally {
      if (heldKey) await p.keyboard.up(heldKey).catch(() => {});
      await context.close();
    }
  }
  assert.ok(Math.abs(traces[0].mean - traces[1].mean) <= 70, 'Holding a key and tapping a destination must share a practical walking pace');
  check(engine+'-keyboard-held-and-ground-tap-share-walking-pace', {traces, timingScope: 'Live DOM tile commits over three intervals; loopback hosted-browser proof, not physical-device frame performance'});
}
async function captureLocation(p, mapId, landmark, label = mapId) {
  await expect(p.locator('.mesomon')).toHaveAttribute('data-map-id', mapId);
  await expect(p.locator('.mesomon canvas')).toBeVisible();
  await expect(p.getByRole('region', {name:'Conversation'})).toHaveCount(0);
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await expect(p.locator(`[data-mm-object="${landmark}"]`)).toBeVisible();
  await settleLayout(p);
  await p.screenshot({path:join(output,`${engine}-location-${label}.png`)});
  const {x,y} = (await save(p)).player;
  check(`${engine}-location-${label}`, {mapId,landmark,x,y});
}
const zoneTitles = { ship: 'The Wayfarer', harbor: 'Lower quay', workshop: 'Edda’s workshop',
  'tide-stairs': 'Old tide stairs', passage: 'Under-wharf passage', chamber: 'Rift chamber' };
const nativeZones = new Map();
const stateBefore = new Map();
const savePng = (name, image) => writeFile(join(output, name + '.png'), Buffer.from(image.split(',')[1], 'base64'));

async function setFieldMotion(p, reduced) {
  if ((await save(p)).settings.reducedMotion === reduced) return;
  const menu = await openStart(p);
  await startSection(menu, 'Settings');
  const toggle = menu.getByRole('switch', {name: /^Reduced motion/i});
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(reduced));
  await closeStart(p, 'm');
  await expect.poll(async () => (await save(p)).settings.reducedMotion).toBe(reduced);
}

async function inspectField(p, mapId, label, { moves = true, state = null, desktop = false, motionWindow } = {}) {
  const name = `${engine}-zone-${label}-${desktop ? 'desktop' : 'phone'}`;
  await expect(p.locator('.mm-screen')).toHaveAttribute('data-art-ready', 'true');
  await expect(p.locator('canvas[data-scene="field"]')).toBeVisible();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await expect(p.getByRole('region', {name: 'Conversation'})).toHaveCount(0);
  await setFieldMotion(p, false);
  // Wait out an in-flight step before translating world coordinates to pixels.
  await pause(650);
  const normal = await sampleField(p, mapId, moves, motionWindow);
  assert.equal(normal.reduced, false);
  assert.equal(normal.missingGreen, 0, name + ' contains the missing texture');
  assert.equal(normal.opaque, 160*144, name + ' has transparent gaps');
  assert.ok(normal.palette >= 24, `${name} expected painted scenery, got ${normal.palette} colors`);
  if (moves) assert.ok(normal.changedPixels > 0, `${name} did not animate its scenery at ${JSON.stringify(normal.zone)}`);
  await savePng(name + '-native', normal.image);
  await p.screenshot({path: join(output, name + '.png')});
  if (!desktop && !nativeZones.has(mapId)) nativeZones.set(mapId, normal.image);

  await setFieldMotion(p, true);
  // NPCs use a 600ms idle cadence. Allow the one transition to their resting
  // pose, then test the entire field over multiple animation phases.
  await pause(800);
  const still = await sampleField(p, mapId, true, motionWindow);
  assert.equal(still.reduced, true);
  assert.deepEqual(still.position, normal.position, 'Changing the motion setting moved Tavian');
  assert.equal(still.changedFieldPixels, 0, `${name} changed pixels while idle in reduced motion`);
  const changedLandmarkPixels = {};
  if (state === 'before') stateBefore.set(mapId, still.landmarks);
  if (state === 'after') {
    const before = stateBefore.get(mapId);
    assert.ok(before?.length, `Missing prior field view for ${mapId}`);
    for (const [i, landmark] of still.landmarks.entries()) {
      // Compare the same part of the fixed world from the same tile, after
      // the renderer has settled into its reduced-motion frame.
      assert.equal(landmark.name, before[i].name);
      for (const axis of ['worldX','worldY','width','height']) {
        assert.equal(landmark.crop[axis], before[i].crop[axis], `${name} sampled a different part of ${landmark.name}`);
      }
      const changed = landmark.pixels.filter((pixel,j) => pixel !== before[i].pixels[j]).length;
      assert.ok(changed >= 12, `${name} did not repaint its ${landmark.name}: ${changed} changed pixels`);
      changedLandmarkPixels[landmark.name] = changed;
    }
  }
  check(name, { position: normal.position, palette: normal.palette, motionWindow: normal.zone,
    changedSceneryPixels: normal.changedPixels, staticFrameChangedPixels: still.changedFieldPixels, changedLandmarkPixels });
  await setFieldMotion(p, false);
}

async function desktopField() {
  const context = await browser.newContext({viewport: {width:1440,height:900}, isMobile:false, hasTouch:false, reducedMotion:'no-preference'});
  try {
    const p = await context.newPage();
    await preparePage(p, 'dark');
    await start(p); await drain(p);
    await walkTo(p, 'gangplank');
    await inspectField(p, 'ship', 'stern', {desktop:true});
  } finally { await context.close(); }
}
async function audit(p, label) {
  await settleLayout(p);
  const measure = () => p.locator('.mesomon').evaluate((root, label) => {
    const issues = [], viewport = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const device = root.closest('.mm-device') ?? root;
    const gapsToViewport = node => {
      const box = node.getBoundingClientRect();
      return [box.left, box.top, viewport - box.right, height - box.bottom];
    };
    const edgeGaps = gapsToViewport(device);
    if (edgeGaps.some(gap => Math.abs(gap) > 1)) issues.push('The console does not fill the viewport');
    for (const [x, y] of [[1, 1], [viewport - 2, 1], [1, height - 2], [viewport - 2, height - 2]]) {
      if (!device.contains(document.elementFromPoint(x, y))) issues.push(`An outer app layer is visible at ${x},${y}`);
    }
    if (/\b(?:DHF?|Dry (?:My )?Horse)\b/i.test(device.innerText)) issues.push('Host branding is visible inside the game');
    const titleArt = root.querySelector('.mm-title-art img');
    const titleGaps = titleArt ? gapsToViewport(titleArt) : null;
    if (titleGaps?.some(gap => gap > 1)) issues.push('Title artwork stops before the edge of the viewport');
    if (label.includes('-opening-') && label.endsWith('-fit')) {
      const art = root.querySelector('.mm-arrival-frame > svg');
      if (!art || gapsToViewport(art).some(gap => gap > 1)) issues.push('Opening artwork does not cover the viewport');
    }
    const menu = root.querySelector('.mm-menu');
    if (menu) {
      const backdrop = getComputedStyle(menu.closest('.mm-modal-backdrop'));
      const safe = [backdrop.paddingLeft, backdrop.paddingTop, backdrop.paddingRight, backdrop.paddingBottom].map(parseFloat);
      const menuGaps = gapsToViewport(menu);
      for (const label of menu.querySelectorAll('.mm-start-command > span')) {
        if (label.getBoundingClientRect().height > parseFloat(getComputedStyle(label).lineHeight) + 1)
          issues.push(`The Start command "${label.textContent}" wraps across rows`);
      }
      if (menuGaps.some((gap, i) => gap < safe[i] - 1)) issues.push('The Start menu is clipped outside the safe area');
      if (viewport >= 320 && height >= 300 && menuGaps.every(gap => gap < 3)) issues.push('The Start menu covers the entire console');
    }
    if (label.endsWith('-game-fit')) {
      const game = root.querySelector('.mm-game');
      const slot = game?.querySelector('.mm-display-slot');
      if (!slot || game.firstElementChild !== slot) issues.push('A shell layer precedes the playable screen');
      else if (Math.abs(slot.getBoundingClientRect().top - game.getBoundingClientRect().top - game.clientTop) > 1)
        issues.push('The display still reserves space for a top bar');
      const deck = root.querySelector('.mm-control-deck');
      if (deck) {
        const [left, , right, bottom] = gapsToViewport(deck);
        const footer = root.querySelector('.mm-footnote')?.getBoundingClientRect().height ?? 0;
        const safe = parseFloat(getComputedStyle(root).paddingBottom);
        if (left > 1 || right > 1 || bottom > footer + safe + 1) issues.push('The controller leaves an unused outer strip');
      }
    }
    for (const [name, node] of [['document', document.documentElement], ['body', document.body], ['game', root]]) {
      if (node.scrollWidth > node.clientWidth + 1) issues.push(`${name} overflows horizontally`);
    }
    for (const button of root.querySelectorAll('button,a')) {
      if(button.closest('[inert],[aria-hidden="true"]'))continue;
      const rect = button.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.width < 43.5 || rect.height < 43.5) issues.push(`${button.getAttribute('aria-label') || button.textContent} target below44px`);
      if (rect.left < -1 || rect.right > viewport + 1) issues.push(`${button.textContent} is clipped horizontally`);
      let scrollable=false;for(let owner=button.parentElement;owner&&owner!==root;owner=owner.parentElement){const style=getComputedStyle(owner);if(/^(auto|scroll)$/.test(style.overflowY)&&owner.scrollHeight>owner.clientHeight+1)scrollable=true;}
      if(!scrollable&&(rect.top< -1||rect.bottom>innerHeight+1))issues.push(`${button.getAttribute('aria-label')||button.textContent} is outside the usable screen`);
    }
    const canvas = root.querySelector('canvas');
    const battleScale = root.classList.contains('mm-phase-battle') ? 4 : 1;
    if (canvas && (canvas.width !== 160 * battleScale || canvas.height !== 144 * battleScale)) issues.push('Unexpected canvas resolution for the scene');
    let display = null;
    if (canvas && root.dataset.playing === 'true') {
      const screen = canvas.closest('.mm-screen');
      const frame = screen.getBoundingClientRect();
      const rect = canvas.getBoundingClientRect();
      const tileWidth = rect.width / 10, tileHeight = rect.height / 9;
      const left = frame.left + screen.clientLeft, top = frame.top + screen.clientTop;
      const gaps = [rect.left - left, left + screen.clientWidth - rect.right,
        rect.top - top, top + screen.clientHeight - rect.bottom];
      display = { width: rect.width, height: rect.height, tileWidth, tileHeight, gaps };
      if (rect.width < 1 || rect.height < 1 || Math.abs(tileWidth - tileHeight) > 0.2)
        issues.push('Rendered canvas must show square 16px source tiles');
      if (Math.min(...gaps) < -1) issues.push('Rendered canvas is clipped by its screen');
      const phone = matchMedia('(max-width: 767px), (orientation: landscape) and (max-height: 600px)').matches;
      if (phone) {
        if (Math.max(...gaps) > 2) issues.push('Active handheld canvas has more than 2px of internal padding');
        const slot = screen.closest('.mm-display-slot');
        const availableScale = Math.min(slot.clientWidth / 160, slot.clientHeight / 144);
        if (rect.width < availableScale * 160 - 2 || rect.height < availableScale * 144 - 2)
          issues.push('Handheld screen undersizes the canvas within the available slot');
        if (label.endsWith('-game-fit') && tileWidth < 24)
          issues.push('Exploration tiles render below 24 CSS pixels');
      }
    }
    return { issues, display, edgeGaps, titleGaps, canvasCount: root.querySelectorAll('canvas').length, rootWidth: root.getBoundingClientRect().width, viewport };
  }, label);
  // A mobile orientation change can reach CSS, ResizeObserver and Phaser on
  // different frames. Record the final geometry at the failing viewport.
  let evidence = await measure();
  if (evidence.issues.length) {
    try {
      await expect.poll(async () => {
        evidence = await measure();
        return evidence.issues;
      }, { timeout: 2500, message: label }).toEqual([]);
    } catch (error) {
      report.checks.push({ label, ok: false, ...evidence });
      await p.screenshot({ path: join(output, label + '-geometry-failure.png') });
      throw error;
    }
  }
  check(label, evidence);
}

// The overworld retains its native handheld grid. Check that both the ship and its
// traveler are actually drawn, independently of the high-resolution encounter art.
async function auditFrame(p, label) {
  const canvas = p.locator('.mesomon canvas');
  const samples = [
    { name: 'ship deck', area: [0, 0, 160, 144], color: 0x916f50, minimum: 500 },
    { name: 'sea', area: [0, 0, 160, 144], color: 0x315e65, minimum: 200 },
    { name: 'Tavian coat', area: [72, 64, 16, 16], color: 0x467778, minimum: 12 },
    { name: 'Tavian hair', area: [72, 64, 16, 16], color: 0x304346, minimum: 12 },
  ];
  let reading;
  try {
    await expect.poll(async () => {
      reading = await canvas.evaluate((node, samples) => {
        const { width, height } = node;
        const pixels = node.getContext('2d').getImageData(0, 0, width, height).data;
        const rgb = index => pixels[index] * 65536 + pixels[index + 1] * 256 + pixels[index + 2];
        let missingGreen = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (rgb(i) === 0x00ff00 && pixels[i + 3]) missingGreen++;
        }
        const counts = samples.map(({ name, area: [left, top, w, h], color, minimum }) => {
          let count = 0;
          for (let y = top; y < top + h; y++) for (let x = left; x < left + w; x++) {
            const i = 4 * (y * width + x);
            if (pixels[i + 3] === 255 && rgb(i) === color) count++;
          }
          return { name, count, minimum };
        });
        return { width, height, missingGreen, counts };
      }, samples);
      return reading.width === 160 && reading.height === 144 && !reading.missingGreen &&
        reading.counts.every(({ count, minimum }) => count >= minimum);
    }, { timeout: 10000, message: label }).toBe(true);
  } catch (error) {
    const png = await canvas.evaluate(node => node.toDataURL('image/png')).catch(() => null);
    if (png) await writeFile(join(output, label + '-native.png'), Buffer.from(png.split(',')[1], 'base64'));
    await p.screenshot({ path: join(output, label + '-failure.png') }).catch(() => {});
    report.checks.push({ label, ok: false, reading });
    throw error;
  }
  check(label, reading);
}

async function smoke(width, height, theme) {
  const label = `${engine}-${width}x${height}-${theme}`;
  const { p, context } = await setup(width, height, theme);
  try {
    await expect(p.getByRole('button', { name: /^Begin journey$/i })).toBeVisible();
    await expect(p.getByRole('button', {name: 'Start', exact: true})).toHaveCount(0);
    await expect(p.getByRole('link', {name: 'Exit game', exact: true})).toHaveAttribute('href', '/compete');
    await p.keyboard.press('m');
    await expect(startMenu(p)).toHaveCount(0);
    await audit(p, label + '-title-fit'); await p.screenshot({ path: join(output, label + '-title.png') });
    const settingsTrigger = p.getByRole('button', {name: 'Settings', exact: true});
    await settingsTrigger.click();
    const titleSettings = p.getByRole('dialog', {name: 'Settings', exact: true});
    await expect(titleSettings.getByRole('switch', {name: /^Mute\b/})).toBeVisible();
    await p.keyboard.press('Escape');
    await expect(titleSettings).toHaveCount(0);
    await expect(settingsTrigger).toBeFocused();
    await start(p, label); await drain(p); await audit(p, label + '-game-fit');
    await auditFrame(p, label + '-ship-art');
    const direction = await p.evaluate(async () => {
      const state = await window.mmQa.readSave(), p = state.player;
      return [['right',1,0],['down',0,1],['left',-1,0],['up',0,-1]].find(([,dx,dy]) => window.mmQa.canWalk(state,p.x+dx,p.y+dy))?.[0];
    });
    assert.ok(direction, 'Ship has an adjacent walkable tile');
    await step(p, direction);
    check(label + '-touch-moves-real-player');
    await step(p, direction, true);
    check(label + '-keyboard-uses-same-actions');
    await noShellCommands(p);
    const menu = await openStart(p);
    for (const name of ['Resume', 'Companions', 'Field Guide', 'Journal', 'Map', 'Settings', 'Save file']) {
      await expect(menu.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(menu.locator('.mm-menu-context .mm-save-status')).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Exit game', exact: true })).toHaveAttribute('href', '/compete');
    await audit(p, label + '-menu-fit');
    await p.screenshot({ path: join(output, label + '-menu.png') });
    await startSection(menu, 'Settings');
    await expect(menu.getByRole('switch', { name: /^Mute\b/ })).toBeVisible();
    const settings=p.locator('.mm-menu-body'),assist=p.getByRole('switch',{name:/Seal Assist/i});
    await assist.focus();await p.keyboard.press('Space');await expect(assist).toBeFocused();check(label+'-settings-keeps-keyboard-focus');
    const pan=await settings.evaluate(node=>{
      const ancestors=[];for(let owner=node;owner;owner=owner.parentElement)ancestors.push(getComputedStyle(owner).touchAction);
      return {blocked:ancestors.includes('none'),height:node.clientHeight,scrollHeight:node.scrollHeight};
    });
    assert.equal(pan.blocked,false,'No ancestor prevents Settings from touch scrolling');
    if (pan.scrollHeight > pan.height + 1) {
      if (engine === 'webkit' && width < 1024) {
        // Mobile WebKit has no mouse-wheel input. Reach an actual control
        // below the fold and check that the settings panel scrolled to it.
        await settings.getByRole('slider', { name: 'Harbor ambience' }).scrollIntoViewIfNeeded();
      } else {
        await settings.hover();
        await p.mouse.wheel(0, 350);
      }
      await expect.poll(() => settings.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    }
    check(label+'-settings-retains-scroll-gesture',{pan});
    await audit(p,label+'-settings-fit');await p.screenshot({path:join(output,label+'-settings.png')});
    await p.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('data-section', 'start');
    await startSection(menu, 'Save file');
    await expect(menu.getByRole('button', { name: 'Save now', exact: true })).toBeEnabled();
    await expect(menu.getByRole('button', {name: /again|erase|delete|replace|restart/i})).toHaveCount(0);
    await p.keyboard.press('x');
    await expect(menu).toHaveAttribute('data-section', 'start');
    await closeStart(p);
    check(label + '-submenus-return-to-start-and-resume-at-the-trigger');
    const persisted = await save(p); await p.reload(); await p.waitForFunction(() => Boolean(window.mmQa));
    const continueButton = p.getByRole('button', { name: /^(Continue|Continue journey)$/i });
    await expect(continueButton).toBeVisible(); await continueButton.click();
    await expect(opening(p)).toHaveCount(0);
    await expect(controls(p,'up')).toBeVisible();
    await expect(p.locator('.mesomon canvas')).toHaveCount(1);
    await expect.poll(async () => { const s = await save(p); return `${s.player.mapId}:${s.player.x}:${s.player.y}`; }).toBe(`${persisted.player.mapId}:${persisted.player.x}:${persisted.player.y}`);
    check(label + '-reload-restores-position-with-one-canvas');
    await expect(p.locator('.mm-screen')).toHaveAttribute('data-art-ready', 'true');
    await auditFrame(p, label + '-restored-ship-art');
    await p.screenshot({ path: join(output, label + '-game.png') });
    await context.setOffline(true);
    const offlineDirection=await p.evaluate(async()=>{
      const state=await window.mmQa.readSave(),p=state.player;return [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]].find(([,dx,dy])=>window.mmQa.canWalk(state,p.x+dx,p.y+dy))?.[0];
    });
    await step(p,offlineDirection);
    await openStart(p);
    await expect(menu.locator('.mm-save-status.mm-save-offline')).toContainText('Offline');
    check(label+'-disconnected-play-saves-locally');
    await context.setOffline(false);
    await menu.getByRole('link', { name: 'Exit game', exact: true }).click();
    await expect(p.getByRole('heading', { name: 'DH Club destination' })).toBeVisible(); await expect(p.locator('canvas')).toHaveCount(0);
    if (engine === 'webkit' && width < 1024) {
      await p.getByRole('button', { name: 'Outside lower control' }).tap();
    } else {
      await p.mouse.wheel(0, 500);
    }
    await expect.poll(() => p.evaluate(() => Math.max(scrollY,document.scrollingElement?.scrollTop||0,document.body.scrollTop))).toBeGreaterThan(0);
    check(label + '-exit-cleans-canvas-and-restores-page-scroll');
    await p.getByRole('link', { name: 'Enter Mesomon' }).click();
    await expect(p.locator('.mesomon')).toBeVisible(); check(label + '-route-remount');
    console.log('PASS ' + label);
  } catch(error) { await p.screenshot({path:join(output,label+'-failure.png')}).catch(()=>{}); throw error; }
  finally { await context.close(); }
}

async function finishPlayback(p) {
  await expect.poll(async () => !!(await save(p)).battle?.playback, {timeout: 18000}).toBe(false);
  await expect(p.locator('.mm-battle-panel')).not.toHaveAttribute('data-battle-stage', 'playback');
}
async function chooseMove(p, name) {
  const turn = (await save(p)).battle.turn;
  await p.getByRole('button', { name: new RegExp(`^${name}`, 'i') }).click();
  await expect.poll(async () => (await save(p)).battle?.turn).toBe(turn + 1);
  await finishPlayback(p);
}
async function inspectPacedTurn(p) {
  const before = (await save(p)).battle;
  const settings = await openStart(p);
  await startSection(settings, 'Settings');
  await settings.getByRole('group', {name:'Battles',exact:true}).getByRole('button', {name:'manual',exact:true}).click();
  const motion = settings.getByRole('switch', {name:/^Reduced motion/i});
  const originalMotion = await motion.getAttribute('aria-checked');
  if (originalMotion !== 'true') await motion.click();
  await closeStart(p, 'm');
  await p.getByRole('button', {name: 'Guard', exact: true}).click();
  const panel = p.locator('.mm-battle-panel');
  await expect(panel).toHaveAttribute('data-battle-stage', 'playback');
  await expect(panel.getByRole('button', {name: /^Brine Snap/i})).toHaveCount(0);
  await expect(panel.getByRole('button', {name: 'Next', exact: true})).toBeVisible();
  await expect(panel.getByRole('meter')).toHaveCount(2);
  await pause(1150); // Beyond the ordinary guard declaration.
  const held = (await save(p)).battle.playback;
  assert.equal(held.index, 0);
  assert.equal(held.beats[held.index].cue, 'guard');
  await p.screenshot({path:join(output,engine+'-guard-manual-motion-reduced.png')});
  await openStart(p);
  const checkpoint = (await save(p)).battle;
  assert.equal(checkpoint.turn, before.turn + 1);
  assert.ok(checkpoint.playback && checkpoint.playback.beats.length >= 2);
  const displayedBeat = checkpoint.playback.beats[checkpoint.playback.index];
  await expect(panel.locator('.mm-turn-readout .mm-battle-log')).toHaveText(displayedBeat.text);
  const meters = await panel.locator('[role="meter"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('aria-valuenow'))));
  assert.deepEqual(meters, [displayedBeat.allyVitality[displayedBeat.activeIndex], displayedBeat.stability], 'The HP and boss stability meters must follow the displayed action');
  await pause(1900); // Longer than the longest authored beat.
  assert.deepEqual((await save(p)).battle, checkpoint, 'Start must freeze playback without resolving a second turn');
  await p.reload();
  await p.waitForFunction(() => Boolean(window.mmQa));
  const resume = p.getByRole('button', { name: /^Continue( journey)?$/i });
  await expect(resume).toBeVisible();
  assert.deepEqual((await save(p)).battle, checkpoint, 'Reload must restore the saved beat and resolved combat outcome');
  await resume.click();
  const next = panel.getByRole('button', {name: 'Next', exact: true});
  await expect(p.locator('.mm-screen')).toHaveAttribute('data-art-ready', 'true');
  await expect(next).toBeEnabled();
  const nextColors = await readButtonContrast(next);
  assert.ok(nextColors.readings[0].ratio >= 4.5, 'Battle Next text contrast: '+JSON.stringify(nextColors));
  await next.click();
  await expect.poll(async () => {
    const battle = (await save(p)).battle;
    return !battle.playback || battle.playback.index > checkpoint.playback.index;
  }).toBe(true);
  await audit(p, engine+'-battle-resolution-fit');
  await p.screenshot({path:join(output,engine+'-battle-resolution.png')});
  const preferences = await openStart(p);
  await startSection(preferences, 'Settings');
  const pace = preferences.getByRole('group', {name:'Battles',exact:true});
  await expect(pace.getByRole('button', {name:'manual',exact:true})).toHaveAttribute('aria-pressed','true');
  await pace.getByRole('button', {name:'normal',exact:true}).click();
  if (originalMotion !== 'true') await preferences.getByRole('switch', {name:/^Reduced motion/i}).click();
  await closeStart(p, 'm');
  await finishPlayback(p);
  const expected = { ...checkpoint };
  delete expected.playback;
  assert.deepEqual((await save(p)).battle, expected, 'Manual and automatic reading must preserve the committed result and item charges');
  check(engine+'-paced-turn-pause-reload-and-deliberate-advance', {turn: expected.turn, beats: checkpoint.playback.beats.length});
}
async function readButtonContrast(control, selector = null) {
  return control.evaluate((button, selector) => {
    const parse=color=>{const values=color.match(/[\d.]+/g)?.map(Number)||[];return[values[0]||0,values[1]||0,values[2]||0,values.length>3?values[3]:1];};
    const composite=(front,back)=>front.slice(0,3).map((channel,index)=>channel*front[3]+back[index]*(1-front[3]));
    const luminance=color=>color.map(channel=>{const c=channel/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;}).reduce((total,c,index)=>total+c*[0.2126,0.7152,0.0722][index],0);
    const chain=[];for(let node=button;node;node=node.parentElement)chain.unshift(node);
    let background=[255,255,255];for(const node of chain)background=composite(parse(getComputedStyle(node).backgroundColor),background);
    const style=getComputedStyle(button),brightness=Number(style.filter.match(/brightness\(([\d.]+)\)/)?.[1]||1);
    const painted=color=>color.map(channel=>Math.min(255,Math.max(0,channel*brightness)));
    const back=painted(background);
    const labels = selector ? [...button.querySelectorAll(selector)] : [button];
    const readings=labels.map(node=>{
      const color=getComputedStyle(node).color,foreground=painted(composite(parse(color),background));
      const values=[luminance(foreground),luminance(back)].sort((a,b)=>a-b);
      return{text:node.textContent,ratio:Math.round(((values[1]+0.05)/(values[0]+0.05))*100)/100,color,background:style.backgroundColor};
    });
    return{brightness,backgroundImage:style.backgroundImage,readings};
  }, selector);
}
async function moveContrast(p) {
  const move=p.getByRole('button',{name:/^Brine Snap/i});
  const measure=()=>readButtonContrast(move, 'strong,small');
  await p.mouse.move(1,1);await pause(180);const normal=await measure();
  await move.hover();await pause(180);const hovered=await measure();
  for(const [state,result]of [['normal',normal],['hover',hovered]]){
    assert.equal(result.backgroundImage,'none','This contrast proof requires the move’s solid painted background');
    assert.equal(result.readings.length,2,'Measure both the move title and its small category/affinity label');
    for(const reading of result.readings)assert.ok(reading.ratio>=4.5,`${state} move text contrast below4.5:1: ${JSON.stringify(reading)}`);
  }
  check(engine+'-boss-move-normal-and-hover-text-contrast',{normal,hovered});
  await p.mouse.move(1,1);
}
async function bossLayouts(p) {
  const previous=p.viewportSize();
  try{
    for(const [width,height]of [[320,568],[844,390],[1440,900]]){
      await p.setViewportSize({width,height});await settleLayout(p);
      await expect(p.getByRole('button',{name:/^Brine Snap/i})).toBeVisible();
      await audit(p,`${engine}-boss-${width}x${height}-fit`);
      if (width === 320) {
        await noShellCommands(p);
        const battleState = (await save(p)).battle;
        const key = p.getByRole('button', { name: 'Start', exact: true });
        await key.tap();
        const menu = startMenu(p);
        await expect(menu).toHaveAttribute('data-section', 'start');
        await startSection(menu, 'Journal');
        await expect(p.getByRole('button', { name: /^Brine Snap/i })).toHaveCount(0);
        await p.keyboard.press('Escape');
        await menu.getByRole('button', { name: 'Resume', exact: true }).tap();
        await expect(p.getByRole('button', { name: /^Brine Snap/i })).toBeEnabled();
        assert.deepEqual((await save(p)).battle, battleState, 'Opening Start must preserve the complete battle state');
        check(engine+'-phone-start-pauses-and-resumes-the-same-battle');
      }
      await p.screenshot({path:join(output,`${engine}-boss-${width}x${height}.png`)});
    }
  }finally{if(previous){await p.setViewportSize(previous);await settleLayout(p);}}
  await moveContrast(p);
}
async function battle(p, mode) {
  await expect.poll(async () => (await save(p))?.battle?.phase).toBe('choosing');
  const opponent = {bond: 'tressel', sighting: 'gleamwing', boss: 'rift-wretch'}[mode];
  await expect(p.locator('.mm-screen')).toHaveAttribute('data-art-ready', 'true');
  const canvas = p.locator('.mesomon canvas');
  await expect(canvas).toHaveAttribute('data-scene', 'battle');
  const backdrop = {bond:'passage-encounter',sighting:'gleamwing-encounter',boss:'chamber-boss'}[mode];
  await expect(canvas).toHaveAttribute('data-battle-backdrop', backdrop);
  check(engine+'-'+mode+'-painted-arena',{backdrop});
  await expect.poll(() => canvas.evaluate(node => [node.width, node.height, getComputedStyle(node).imageRendering])).toEqual([640, 576, 'auto']);
  await trackBattleSprites(p, opponent);
  const seen = () => p.evaluate(() => window.mmCreatureProbe.seen);
  try {
    for (const species of ['rillik', opponent]) {
      await expect.poll(async () => (await seen())[species].rest ?? 0).toBeGreaterThan(.94);
    }
  } catch (error) {
    const closest = await p.evaluate(() => window.mmCreatureProbe.closest);
    report.checks.push({label: engine + '-' + mode + '-battle-art', ok: false, closest});
    const native = await p.locator('.mesomon canvas').evaluate(node => node.toDataURL('image/png'));
    await writeFile(join(output, engine + '-' + mode + '-native.png'), Buffer.from(native.split(',')[1], 'base64'));
    throw error;
  }
  check(engine + '-' + mode + '-battle-art', {opponent, frames: await seen()});
  if (mode === 'sighting') {
    await p.evaluate(() => window.mmCreatureProbe.stop());
    await p.screenshot({path: join(output, engine + '-battle-gleamwing.png')});
    await p.getByRole('button', {name: 'Satchel', exact: true}).click();
    await chooseMove(p, 'Give them space');
    await expect.poll(async () => (await save(p)).battle?.phase).toBe('escaped');
    await p.getByRole('button', {name: 'Continue', exact: true}).click();
    await drain(p);
    return;
  }
  if (mode === 'bond') {
    await p.screenshot({path: join(output, engine + '-battle-tressel.png')});
    await chooseMove(p, 'Resonant Cry');
    const frames = await seen();
    await p.evaluate(() => window.mmCreatureProbe.stop());
    for (const [name, image] of await p.evaluate(() => window.mmCreatureProbe.stills())) {
      await writeFile(join(output, engine + '-pose-' + name + '.png'), Buffer.from(image.split(',')[1], 'base64'));
    }
    for (const [species, pose] of [['rillik', 'action'], ['tressel', 'action'], ['rillik', 'recoil']]) {
      assert.ok(frames[species][pose] > .94, 'Expected rendered ' + species + ' ' + pose + ' artwork: ' + JSON.stringify(frames));
    }
    check(engine + '-battle-poses-match-source-artwork', {frames});
    for (let index=0; index<6 && (await save(p)).battle?.phase === 'choosing'; index++) {
      const state = await save(p);
      if (state.battle.agitation <= 25) { await chooseMove(p,'Resonate'); break; }
      await chooseMove(p,'Resonant Cry');
    }
  } else {
    await p.evaluate(() => window.mmCreatureProbe.stop());
    const resonate = p.getByRole('button', { name: /^Resonate\b/i });
    if (await resonate.count()) await expect(resonate).toBeDisabled();
    check(engine + '-demon-cannot-be-bonded');
    await p.screenshot({path:join(output,engine+'-boss-battle.png')});
    await bossLayouts(p);
    await inspectPacedTurn(p);
    for (let index=0; index<22 && (await save(p)).battle?.phase === 'choosing'; index++) {
      const state = await save(p), active = state.battle.allies[state.battle.activeIndex];
      if (active.vitality <= 18 && state.inventory.tincture > state.battle.usedTinctures) {
        await p.getByRole('button',{name:'Satchel',exact:true}).click();
        await chooseMove(p,'Healing tincture');
        assert.equal((await save(p)).battle.usedTinctures, state.battle.usedTinctures + 1, 'A tincture costs one item across every displayed beat');
        await p.getByRole('button',{name:'Moves',exact:true}).click(); continue;
      }
      if ((state.battle.turn + 1) % 3 === 0) {
        await expect(p.getByText('Double pulse next · Try Guard', {exact:true})).toBeVisible();
        await chooseMove(p, 'Guard');
      } else {
        await chooseMove(p, active.speciesId === 'tressel' ? 'Splinter Swipe' : 'Brine Snap');
      }
    }
  }
  const result = await save(p); assert.ok(['won','resonated'].includes(result.battle?.phase), `Battle did not complete successfully: ${JSON.stringify(result.battle)}`);
  await p.getByRole('button',{name:'Continue',exact:true}).click(); await drain(p);
}
async function chapter() {
  const { p, context } = await setup(390,844,'dark');
  chapterReaders.add(p);
  try {
    await start(p); await drain(p);
    await checkDeckDetour(p);
    await tapMapObject(p,'captain');
    await expect(p.locator('[data-mm-object="captain"]')).toBeVisible();
    await expect(p.getByRole('region',{name:'Conversation'})).toHaveCount(0);
    await waitAtObject(p, 'captain'); await settleLayout(p);
    await tapMapObject(p,'captain');
    await expect(p.getByRole('region',{name:'Conversation'})).toBeVisible();
    check(engine+'-touch-captain-walks-to-adjacency-and-second-tap-speaks');
    await drain(p, {opening: true, expectedId:'captain'});
    assert.equal((await save(p)).questFlags.captain_met, true);
    await captureLocation(p,'ship','captain');
    const settingsMenu = await openStart(p);
    await startSection(settingsMenu, 'Settings');
    const reduceMotion = settingsMenu.getByRole('switch', {name: /^Reduced motion/i});
    if (await reduceMotion.getAttribute('aria-checked') === 'true') await reduceMotion.click();
    await closeStart(p, 'm');
    await walkTo(p, 'gangplank');
    await inspectField(p, 'ship', 'stern');
    await automaticMeeting(p, 'nia', () => p.locator('[data-mm-object="gangplank"]').click());
    await inspectField(p, 'harbor', 'arrival-pier');
    const fieldcase = await openStart(p);
    await checkFieldGuide(p, fieldcase, [], 'field-guide-unseen');
    await startSection(fieldcase, 'Companions');
    await expect(fieldcase.getByText('No bonds yet', {exact:true})).toBeVisible();
    const cuff = fieldcase.getByRole('img', {name:/brass cuff/i});
    await expect(cuff).toBeVisible();
    await expect.poll(() => cuff.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await p.screenshot({path:join(output,engine+'-empty-fieldcase.png')});
    await startHome(fieldcase);
    await startSection(fieldcase, 'Journal');
    const journal = await p.evaluate(async () => {
      const state = await window.mmQa.readSave();
      return {objective: window.mmQa.getObjective(state), steps: window.mmQa.getQuestSteps(state).filter(step => step.complete)};
    });
    assert.deepEqual(journal.steps.map(step => step.id), ['captain_met', 'disembarked', 'nia_met'], 'The journal includes the letter, landing, and Nia’s welcome');
    await expect(fieldcase.locator('.mm-journal-objective')).toHaveText(journal.objective);
    const entries = fieldcase.locator('ol.mm-quest-steps li');
    await expect(entries).toHaveCount(journal.steps.length);
    await expect(entries).toHaveText(journal.steps.map(step => `◆${step.label}`));
    await p.screenshot({path:join(output,engine+'-early-journal.png')});
    check(engine+'-arrival-fieldcase-and-spoiler-safe-journal');
    await closeStart(p, 'm');
    for (const id of ['nia','pell','seli','merchant','dockworker','bell-worker','harbor-crane','rope-worker','lamp-keeper','workshop-door','chart','field-map','satchel-hook','workshop-exit','bram','tide-door','gate-brace','gate-wheel','rillik-bond']) {
      if (id === 'gate-wheel') {
        await walkTo(p,id);
        assert.ok(!(await save(p)).questFlags.gate_opened);
        await captureLocation(p,'tide-stairs',id,'tide-stairs-closed');
        await inspectField(p,'tide-stairs','gate-closed',{moves:false,state:'before'});
      }
      if (id === 'bram') {
        await automaticMeeting(p, 'bram', () => walkTo(p, 'bram', 'bram'));
      } else if (id !== 'nia') {
        await interact(p,id,id !== 'chart');
      }
      if (id === 'gate-wheel') {
        assert.equal((await save(p)).questFlags.gate_opened,true);
        await captureLocation(p,'tide-stairs',id,'tide-stairs-open');
        await inspectField(p,'tide-stairs','gate-open',{state:'after'});
      }
      if (id === 'nia') {
        await p.screenshot({path:join(output,engine+'-harbor.png')});
        const chartDialog = await openStart(p);
        await startSection(chartDialog, 'Map');
        const chart = chartDialog.getByRole('region',{name:'Location chart'});
        await expect(chart).toContainText(/workshop/i);
        await expect(chart.getByRole('list',{name:'Walking directions'})).toBeVisible();
        await p.screenshot({path:join(output,engine+'-harbor-location-chart.png')});
        await startHome(chartDialog);
        await chartDialog.getByRole('button', { name: 'Resume', exact: true }).click();
        await expect(chartDialog).toHaveCount(0);
        check(engine+'-phone-chart-to-workshop');
      }
      if (id === 'bell-worker') await captureLocation(p,'harbor',id);
      if (id === 'rope-worker') {
        const flags = (await save(p)).questFlags;
        assert.equal(flags['heard:onion-lighter'], true);
        assert.equal(flags['heard:crane-bearing'], true);
      }
      if(id==='chart'){
        await conversationLine(p,'chart');
        assert.equal((await save(p)).questFlags.clue_chart, true);
        await p.screenshot({path:join(output,engine+'-workshop.png')});
        await drain(p,{expectedId:'chart'});
        await captureLocation(p,'workshop',id);
        await inspectField(p,'workshop','chart-window',{state:'before'});
      }
    }
    assert.equal((await save(p)).party[0]?.speciesId,'rillik'); check(engine+'-first-bond-after-real-gate-rescue');
    await p.screenshot({path:join(output,engine+'-first-bond.png')});
    await openStart(p);
    await checkFieldGuide(p, fieldcase, ['Rillik'], 'field-guide-first-bond', [{width:320,height:568},{width:1440,height:900}]);
    await startSection(fieldcase, 'Companions');
    const ally = (await save(p)).party[0];
    const stats = fieldcase.locator('.mm-individual-stats').first();
    await expect(stats.locator('dt')).toHaveText(['Attack', 'Defense', 'Speed', 'Resonance']);
    await expect(stats.locator('dd')).toHaveText([ally.power, ally.guard, ally.agility, ally.resonance].map(String));
    await audit(p, engine+'-individual-stats-fit');
    await p.screenshot({path:join(output,engine+'-companion-stats.png')});
    await closeStart(p, 'm');
    check(engine+'-individual-stats-match-the-bonded-companion');
    for(const id of ['stairs-exit','whistle-reeds','pell','fisher','pell','tide-door','passage-door']) await interact(p,id);
    assert.equal((await save(p)).questFlags.whistle_imitation, true, 'After the rescue, Rillik can answer Pell’s whistle');
    assert.equal((await save(p)).questFlags.whistle_returned,true); assert.equal((await save(p)).questFlags.wrong_catch,true); check(engine+'-both-optional-harbor-stories');
    await walkTo(p,'sense-eddy'); await p.getByRole('button',{name:/Current Sense/i}).click();
    await conversationLine(p,'sense-eddy');
    assert.equal((await save(p)).questFlags.current_eddy, true);
    await p.screenshot({path:join(output,engine+'-underwharf.png')});
    await drain(p,{expectedId:'sense-eddy'});
    await walkTo(p,'sluice');
    const crossingIsWalkable = () => p.evaluate(async () => window.mmQa.canWalk(await window.mmQa.readSave(),10,12));
    assert.equal(await crossingIsWalkable(),false);
    await captureLocation(p,'passage','sluice','passage-flooded');
    await inspectField(p,'passage','sluice-flooded',{state:'before'});
    await interact(p,'sluice');
    assert.equal(await crossingIsWalkable(),true);
    await captureLocation(p,'passage','sluice','passage-drained');
    await inspectField(p,'passage','sluice-drained',{moves:false,state:'after'});
    await interact(p,'tressel'); await battle(p,'bond');
    assert.ok((await save(p)).party.length>=2); check(engine+'-optional-wild-resonance');
    await interact(p, 'gleamwing'); await battle(p, 'sighting');
    await walkTo(p,'sense-channel'); await p.getByRole('button',{name:/Current Sense/i}).click(); await drain(p,{expectedId:'sense-channel'});
    assert.equal((await save(p)).questFlags.currents_followed, true);
    await interact(p,'pickup-tincture'); await interact(p,'save-lamp'); await interact(p,'chamber-door');
    await walkTo(p,'rift'); await captureLocation(p,'chamber','rift');
    await inspectField(p,'chamber','rift-open',{state:'before'});
    await interact(p,'rift'); await battle(p,'boss');
    await openStart(p); await startSection(fieldcase, 'Settings');
    const assist=p.getByRole('switch',{name:/Seal Assist/i}); if(await assist.getAttribute('aria-checked')!=='true')await assist.click();
    await closeStart(p, 'm');
    for(let index=0;index<3;index++) await p.getByRole('button',{name:/Seal pulse/i}).click();
    await drain(p); assert.equal((await save(p)).rifts['port-marche'],'sealed'); check(engine+'-three-pulse-assisted-rift-seal');
    await inspectField(p,'chamber','rift-sealed',{state:'after'});
    const zones = Object.entries(zoneTitles).map(([id,title]) => ({title, image: nativeZones.get(id)}));
    assert.ok(zones.every(zone => zone.image), 'The contact sheet needs a real native frame from each room');
    assert.equal(new Set(zones.map(zone => zone.image)).size, 6, 'The six rooms must render distinct frames');
    await savePng(engine+'-six-zone-contact-sheet', await fieldContactSheet(p,zones));
    await interact(p,'page');
    // Door names are authored map objects, not production-only test shortcuts.
    for(const id of ['chamber-exit','passage-exit','stairs-exit','inland-gate','workshop-door']) await interact(p,id);
    assert.equal((await save(p)).questFlags['heard:flour-carter'], true, 'Tavian brings the road keeper’s lead back to Nia');
    await walkTo(p,'chart');
    await inspectField(p,'workshop','kettle-warm',{state:'after',motionWindow:[74,84,13,19]});
    await interact(p,'closing',false);await drain(p,{inspectChoices:true,expectedId:'closing',choiceId:'wry'}); assert.equal((await save(p)).questFlags.chapter_complete,true); check(engine+'-complete-real-chapter-through-closing');
    check(engine + '-chapter-dialogue-readable-at-320x568', { pages: narrowPages.size, longestPage });
    await audit(p, engine + '-chapter-complete-fit');
    await p.screenshot({path:join(output,engine+'-chapter-complete.png')});
    await noShellCommands(p);
    await openStart(p);
    await checkFieldGuide(p, fieldcase, ['Rillik','Muddren','Gleamwing','Tressel','Rift Wretch'], 'field-guide-chapter');
    await fieldcase.getByRole('link', { name: 'Exit game', exact: true }).click();
    await expect(p.getByRole('heading', { name: 'DH Club destination' })).toBeVisible();
  } catch(error) { await p.screenshot({path:join(output,engine+'-chapter-failure.png')}).catch(()=>{}); throw error; }
  finally { await context.close(); }
}

async function guestRoute() {
  const {p,context}=await setup(390,844,'dark',true);
  try {
    await expect(p.getByRole('heading',{name:'Mesomon',exact:true})).toBeVisible();
    await expect(p.locator('canvas')).toHaveCount(0);
    await audit(p, engine + '-guest-gate-fit');
    await p.getByRole('link',{name:'Exit game',exact:true}).click();
    await expect(p.getByRole('heading',{name:'DH Club destination'})).toBeVisible();
    check(engine+'-unauthenticated-route-has-clear-return-without-a-crash');
  } finally {await context.close();}
}

async function touchLaunch() {
  const {p, context} = await setup(390, 844, 'dark');
  try {
    const button = p.getByRole('button', {name: 'Begin journey', exact: true});
    await expect(button).toBeEnabled();
    await p.getByRole('button', {name: 'Settings', exact: true}).tap();
    const titleSettings = p.getByRole('dialog', {name: 'Settings', exact: true});
    const canExpand = await titleSettings.getByRole('button', {name: 'Enter full screen', exact: true}).count();
    await p.keyboard.press('Escape');
    await expect(titleSettings).toHaveCount(0);
    await button.tap();
    await opening(p).getByRole('button', {name: 'Skip opening', exact: true}).tap();
    await expect(p.locator('.mm-screen')).toHaveAttribute('data-art-ready', 'true');
    if (canExpand) {
      const owner = () => p.evaluate(() => (document.fullscreenElement ?? document.webkitFullscreenElement)?.matches('.mm-device') ?? false);
      await expect.poll(owner).toBe(true);
      const menu = await openStart(p);
      await startSection(menu, 'Settings');
      await menu.getByRole('button', {name: 'Leave full screen', exact: true}).tap();
      await expect.poll(owner).toBe(false);
      await closeStart(p, 'm');
    }
    await audit(p, engine + '-trusted-touch-console-fit');
    check(engine + '-touch-begin-plays-and-expands-where-supported', {nativeFullscreenOffered: !!canExpand});
  } finally { await context.close(); }
}

async function offlineTabs() {
  const {p:a,context}=await setup(390,844,'dark');
  let b;
  const position=state=>`${state.player.mapId}:${state.player.x}:${state.player.y}`;
  try{
    await start(a);await drain(a);await step(a,'right');
    const locks=await a.evaluate(()=>typeof navigator.locks?.request==='function');
    b=await context.newPage();await preparePage(b,'dark');
    const beginB=b.getByRole('button',{name:/^(Begin journey|Continue journey)$/i});
    await expect(beginB).toBeVisible();
    if(locks){await expect(beginB).toBeDisabled();await expect(b.getByRole('button',{name:'Reload file',exact:true})).toBeVisible();}
    else{await expect(beginB).toBeEnabled();await beginB.click();await expect(controls(b,'right')).toBeVisible();}
    const readyCanvas = '.mesomon canvas[aria-hidden="true"]';
    await Promise.all([a, b].map(page => expect(page.locator(readyCanvas)).toHaveCount(1)));
    const originalCanvas = await b.locator(readyCanvas).elementHandle();
    const offlineArtRequests = [];
    b.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (/^\/games\/mesomon\/(harbor-tiles|people|mesomon|battle|creature-battle-v1|scenery)\.png$/.test(path)) offlineArtRequests.push(path);
    });
    await context.setOffline(true);await a.bringToFront();
    await step(a,'right');
    const newest=await save(a),head=position(newest);
    await b.bringToFront();
    // A blocked file cannot start. The fallback without Web Locks detects the
    // stale parent on this real attempted movement and blocks its persistence.
    if(locks){await b.keyboard.press('Enter');await b.keyboard.press('ArrowLeft');}
    else await press(b,'left');
    await expect(b.getByRole('button',{name:'Reload file',exact:true})).toBeVisible();
    await expect(beginB).toBeDisabled();
    assert.equal(position(await save(b)),head,'The secondary offline tab must not replace the primary tab’s newer local head');
    if(locks){await b.getByRole('button',{name:'Reload file',exact:true}).click();await expect(beginB).toBeDisabled();assert.equal(position(await save(b)),head);}
    await a.close();
    await b.getByRole('button',{name:'Reload file',exact:true}).click();
    const resume=b.getByRole('button',{name:'Continue journey',exact:true});
    await expect(resume).toBeEnabled();await resume.click();
    await expect(controls(b,'right')).toBeVisible();
    await expect.poll(async()=>`${await b.locator('.mesomon').getAttribute('data-map-id')}:${await b.locator('.mesomon').getAttribute('data-player-x')}:${await b.locator('.mesomon').getAttribute('data-player-y')}`).toBe(head);
    await step(b,'left');
    assert.ok(await b.locator(readyCanvas).evaluate((canvas, original) => canvas === original, originalCanvas),
      'Offline reload must retain the preloaded Phaser canvas');
    assert.deepEqual(offlineArtRequests, [], 'Offline reload must reuse the preloaded world and battle sprite sheets');
    await expect(b.locator('.mm-view-error')).toHaveCount(0);
    check(engine+'-same-context-offline-tabs-preserve-newest-file-and-explicitly-transfer-ownership',{webLocks:locks,preservedHead:head,offlineArtRequests});
    await b.screenshot({path:join(output,engine+'-offline-tab-recovered.png')});
  }catch(error){await b?.screenshot({path:join(output,engine+'-offline-tabs-failure.png')}).catch(()=>{});throw error;}
  finally{await context.close();}
}

try {
  if(process.argv.includes('--build-check')) {
    await auditBuild();
  } else {
  log=createWriteStream(join(output,'vite.log'));
  if(!process.env.MESOMON_URL){ server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','8097','--strictPort'],{cwd:resolve('.'),stdio:['ignore','pipe','pipe']}); server.stdout.pipe(log);server.stderr.pipe(log); }
  for(let index=0;index<100;index++){try{if((await fetch(base+'/scripts/fixtures/mesomon.html')).ok)break;}catch{}if(index===99)throw Error('Vite did not start within20seconds');await pause(200);}
  browser=engine==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:process.env.MESOMON_CHROMIUM||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),args:['--no-sandbox']});
  const sizes=process.env.MESOMON_QUICK?[[390,844,'dark']]:[[320,568,'dark'],[320,568,'light'],[390,844,'dark'],[390,844,'light'],[844,390,'dark'],[844,390,'light'],[1440,900,'dark'],[1440,900,'light']];
  for(const [width,height,theme]of sizes)await smoke(width,height,theme);
  await walkingPace();
  if(!process.env.MESOMON_SMOKE_ONLY){ await chapter(); await desktopField(); }
  await guestRoute();
  await touchLaunch();
  await offlineTabs();
  check(engine+'-active-dialogue-lines-and-reading-voices-match-saved-conversations', {dialogueIds: [...observedDialogues].sort()});
  assert.deepEqual(report.runtimeErrors,[]);console.log(`PASS Mesomon ${engine}: ${report.checks.length} checks`);
  }
}catch(error){report.errors.push(String(error.stack||error));console.error(error);await activePage?.screenshot({path:join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await cleanup();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Mesomon report: '+join(output,'report.json'));}

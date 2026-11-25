// Exercises the production chapter, Phaser view and local-save hook. Only the
// authentication/club/cloud transport boundary is replaced, with no live writes.
import assert from 'node:assert/strict';
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
async function auditBuild() {
  const release=JSON.parse(await readFile('dist/games/mesomon/release.json','utf8'));
  assert.equal(release.schema_version,1,'The build must emit the Mesomon release metadata schema');
  assert.equal(release.chapter,'port-marche');assert.equal(release.rules_version,1);assert.equal(release.assets_version,2);
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
async function start(p) {
  const newJourney = p.getByRole('button', { name: /^(New journey|Begin journey|Begin|Start journey|New game)$/i });
  const continueJourney = p.getByRole('button', { name: /^(Continue|Continue journey)$/i });
  if (await continueJourney.count() && await continueJourney.isVisible()) await continueJourney.click();
  else await newJourney.click();
  await expect(p.locator('.mesomon[data-map-id]')).toHaveAttribute('data-map-id', 'ship');
  await expect(p.locator('.mesomon canvas')).toHaveCount(1);
  await expect.poll(() => save(p)).not.toBeNull();
}
async function settleLayout(p) {
  await p.evaluate(async()=>{await document.fonts.ready;await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));});
}
async function drain(p, {inspectChoices=false}={}) {
  let choicesInspected=false;
  for (let count = 0; count < 180; count++) {
    const state = await save(p);
    if (!state?.dialogue) return;
    const choice = state.dialogue.choices?.[1] || state.dialogue.choices?.[0];
    if (choice && state.dialogue.index >= state.dialogue.lines.length - 1) {
      if(inspectChoices&&!choicesInspected){
        const previous=p.viewportSize();
        try{
          await p.setViewportSize({width:320,height:568});await settleLayout(p);
          await audit(p,engine+'-closing-tone-choices-320x568-fit');
          await p.screenshot({path:join(output,engine+'-closing-tone-choices-320x568.png')});
        }finally{if(previous){await p.setViewportSize(previous);await settleLayout(p);}}
        choicesInspected=true;
      }
      const option = p.getByRole('button', { name: new RegExp(choice.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
      if (await option.count() && await option.isVisible()) { await option.click(); continue; }
    }
    await press(p, 'confirm');
    await pause(20);
  }
  throw new Error('Dialogue did not terminate after 180 real advances.');
}
async function walkTo(p, id) {
  const route = await p.evaluate(async targetId => {
    const state = await window.mmQa.readSave(), map = window.mmQa.getMap(state), target = map.objects.find(object => object.id === targetId);
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
    const before = await save(p);
    await press(p, direction);
    await expect.poll(async () => { const current = await save(p); return `${current.player.x}:${current.player.y}`; }).not.toBe(`${before.player.x}:${before.player.y}`);
  }
}
async function interact(p, id, dialogue = true) {
  await walkTo(p, id);
  await p.locator(`[data-mm-object="${id}"]`).click();
  if (dialogue) await drain(p);
}
async function audit(p, label) {
  await settleLayout(p);
  const measure = () => p.locator('.mesomon').evaluate((root, label) => {
    const issues = [], viewport = document.documentElement.clientWidth;
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
    if (canvas && (canvas.width !== 160 || canvas.height !== 144)) issues.push('Canvas logical resolution changed');
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
    return { issues, display, canvasCount: root.querySelectorAll('canvas').length, rootWidth: root.getBoundingClientRect().width, viewport };
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

// Palette samples come from opaque interiors of the shipped 16px exploration
// and 48px battle frames. Each sprite is measured only within its own bounds.
const FRAME_SAMPLES = {
  ship: [
    { name: 'ship deck', area: [0, 0, 160, 144], color: 0x916f50, minimum: 500 },
    { name: 'sea', area: [0, 0, 160, 144], color: 0x315e65, minimum: 200 },
    { name: 'Tavian coat', area: [72, 64, 16, 16], color: 0x467778, minimum: 12 },
    { name: 'Tavian hair', area: [72, 64, 16, 16], color: 0x304346, minimum: 12 },
  ],
  ally: [
    { name: 'Rillik blue', area: [21, 50, 48, 50], color: 0x577c89, minimum: 100 },
    { name: 'Rillik highlight', area: [21, 50, 48, 50], color: 0x8caaa6, minimum: 35 },
  ],
  bond: [
    { name: 'Tressel ochre', area: [92, 19, 48, 50], color: 0xae7b51, minimum: 100 },
    { name: 'Tressel gold', area: [92, 19, 48, 50], color: 0xc09245, minimum: 20 },
  ],
  boss: [
    { name: 'Rift Wretch body', area: [92, 19, 48, 50], color: 0x221e30, minimum: 250 },
    { name: 'Rift Wretch markings', area: [92, 19, 48, 50], color: 0x8a5c97, minimum: 15 },
  ],
};
async function auditFrame(p, label, scene) {
  const canvas = p.locator('.mesomon canvas');
  const samples = scene === 'ship' ? FRAME_SAMPLES.ship : [...FRAME_SAMPLES.ally, ...FRAME_SAMPLES[scene]];
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
    await audit(p, label + '-title-fit'); await p.screenshot({ path: join(output, label + '-title.png') });
    await start(p); await drain(p); await audit(p, label + '-game-fit');
    await auditFrame(p, label + '-ship-art', 'ship');
    const direction = await p.evaluate(async () => {
      const state = await window.mmQa.readSave(), p = state.player;
      return [['right',1,0],['down',0,1],['left',-1,0],['up',0,-1]].find(([,dx,dy]) => window.mmQa.canWalk(state,p.x+dx,p.y+dy))?.[0];
    });
    assert.ok(direction, 'Ship has an adjacent walkable tile');
    const before = await save(p); await press(p, direction);
    await expect.poll(async () => { const s = await save(p); return `${s.player.x}:${s.player.y}`; }).not.toBe(`${before.player.x}:${before.player.y}`);
    check(label + '-touch-moves-real-player');
    const keyboardBefore = await save(p); await p.keyboard.press({ up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight' }[direction]);
    await expect.poll(async () => { const s = await save(p); return `${s.player.x}:${s.player.y}`; }).not.toBe(`${keyboardBefore.player.x}:${keyboardBefore.player.y}`);
    check(label + '-keyboard-uses-same-actions');
    await press(p, 'menu'); await expect(p.getByRole('dialog')).toBeVisible(); await audit(p, label + '-menu-fit');
    await p.screenshot({ path: join(output, label + '-menu.png') });
    await p.getByRole('dialog').getByRole('button',{name:'Settings',exact:true}).click();
    const settings=p.locator('.mm-menu-body'),assist=p.getByRole('switch',{name:/Seal Assist/i});
    await assist.focus();await p.keyboard.press('Space');await expect(assist).toBeFocused();check(label+'-settings-keeps-keyboard-focus');
    const pan=await settings.evaluate(node=>{
      const ancestors=[];for(let owner=node;owner;owner=owner.parentElement)ancestors.push(getComputedStyle(owner).touchAction);
      return {blocked:ancestors.includes('none'),height:node.clientHeight,scrollHeight:node.scrollHeight};
    });
    assert.equal(pan.blocked,false,'No ancestor prevents the fieldcase from touch scrolling');
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
    await p.keyboard.press('Escape'); await expect(p.getByRole('dialog')).toHaveCount(0); check(label + '-keyboard-cancel-closes-menu');
    const persisted = await save(p); await p.reload(); await p.waitForFunction(() => Boolean(window.mmQa));
    const continueButton = p.getByRole('button', { name: /^(Continue|Continue journey)$/i });
    await expect(continueButton).toBeVisible(); await continueButton.click();
    await expect(controls(p,'up')).toBeVisible();
    await expect(p.locator('.mesomon canvas')).toHaveCount(1);
    await expect.poll(async () => { const s = await save(p); return `${s.player.mapId}:${s.player.x}:${s.player.y}`; }).toBe(`${persisted.player.mapId}:${persisted.player.x}:${persisted.player.y}`);
    check(label + '-reload-restores-position-with-one-canvas');
    await p.screenshot({ path: join(output, label + '-game.png') });
    await context.setOffline(true);
    const offlineBefore=await save(p),offlineDirection=await p.evaluate(async()=>{
      const state=await window.mmQa.readSave(),p=state.player;return [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]].find(([,dx,dy])=>window.mmQa.canWalk(state,p.x+dx,p.y+dy))?.[0];
    });
    await press(p,offlineDirection);await expect.poll(async()=>{const s=await save(p);return`${s.player.x}:${s.player.y}`;}).not.toBe(`${offlineBefore.player.x}:${offlineBefore.player.y}`);
    await expect(p.locator('.mm-save-offline')).toContainText('Offline');check(label+'-disconnected-play-saves-locally');
    await context.setOffline(false);
    await p.evaluate(() => window.mmQa.navigate('/compete'));
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

async function chooseMove(p, name) { await p.getByRole('button', { name: new RegExp(`^${name}`, 'i') }).click(); await pause(60); }
async function moveContrast(p) {
  const move=p.getByRole('button',{name:/^Brine Snap/i});
  const measure=()=>move.evaluate(button=>{
    const parse=color=>{const values=color.match(/[\d.]+/g)?.map(Number)||[];return[values[0]||0,values[1]||0,values[2]||0,values.length>3?values[3]:1];};
    const composite=(front,back)=>front.slice(0,3).map((channel,index)=>channel*front[3]+back[index]*(1-front[3]));
    const luminance=color=>color.map(channel=>{const c=channel/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;}).reduce((total,c,index)=>total+c*[0.2126,0.7152,0.0722][index],0);
    const chain=[];for(let node=button;node;node=node.parentElement)chain.unshift(node);
    let background=[255,255,255];for(const node of chain)background=composite(parse(getComputedStyle(node).backgroundColor),background);
    const style=getComputedStyle(button),brightness=Number(style.filter.match(/brightness\(([\d.]+)\)/)?.[1]||1);
    const painted=color=>color.map(channel=>Math.min(255,Math.max(0,channel*brightness)));
    const back=painted(background);
    const readings=[...button.querySelectorAll('strong,small')].map(node=>{
      const color=getComputedStyle(node).color,foreground=painted(composite(parse(color),background));
      const values=[luminance(foreground),luminance(back)].sort((a,b)=>a-b);
      return{text:node.textContent,ratio:Math.round(((values[1]+0.05)/(values[0]+0.05))*100)/100,color,background:style.backgroundColor};
    });
    return{brightness,backgroundImage:style.backgroundImage,readings};
  });
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
      await p.screenshot({path:join(output,`${engine}-boss-${width}x${height}.png`)});
    }
  }finally{if(previous){await p.setViewportSize(previous);await settleLayout(p);}}
  await moveContrast(p);
}
async function battle(p, mode) {
  await expect.poll(async () => (await save(p))?.battle?.phase).toBe('choosing');
  await auditFrame(p, engine + '-' + mode + '-battle-art', mode);
  if (mode === 'bond') {
    for (let index=0; index<6 && (await save(p)).battle?.phase === 'choosing'; index++) {
      const state = await save(p);
      if (state.battle.agitation <= 25) { await chooseMove(p,'Resonate'); break; }
      await chooseMove(p,'Resonant Cry');
    }
  } else {
    const resonate = p.getByRole('button', { name: /^Resonate\b/i });
    if (await resonate.count()) await expect(resonate).toBeDisabled();
    check(engine + '-demon-cannot-be-bonded');
    await p.screenshot({path:join(output,engine+'-boss-battle.png')});
    await bossLayouts(p);
    await chooseMove(p,'Guard');
    const checkpoint = await save(p); await p.reload(); await p.waitForFunction(() => Boolean(window.mmQa));
    const continueButton = p.getByRole('button', { name: /^(Continue|Continue journey)$/i }); await expect(continueButton).toBeVisible(); await continueButton.click();
    await expect.poll(async () => (await save(p))?.battle?.turn).toBe(checkpoint.battle.turn); check(engine + '-reload-restores-battle-turn');
    for (let index=0; index<22 && (await save(p)).battle?.phase === 'choosing'; index++) {
      const state = await save(p), active = state.battle.allies[state.battle.activeIndex];
      if (active.vitality <= 18 && state.inventory.tincture > state.battle.usedTinctures) {
        await p.getByRole('button',{name:'Satchel',exact:true}).click();
        await p.getByRole('button',{name:/^Healing tincture/i}).click();
        await p.getByRole('button',{name:'Moves',exact:true}).click(); await pause(60); continue;
      }
      await chooseMove(p,'Brine Snap');
    }
  }
  const result = await save(p); assert.ok(['won','resonated'].includes(result.battle?.phase), `Battle did not complete successfully: ${JSON.stringify(result.battle)}`);
  await p.getByRole('button',{name:'Continue',exact:true}).click(); await drain(p);
}
async function chapter() {
  const { p, context } = await setup(390,844,'dark');
  try {
    await start(p); await drain(p);
    for (const id of ['captain','gangplank','nia','pell','seli','dockworker','bell-worker','workshop-door','chart','field-map','satchel-hook','workshop-exit','bram','tide-door','gate-brace','gate-wheel','rillik-bond']) {
      await interact(p,id);
      if(id==='nia')await p.screenshot({path:join(output,engine+'-harbor.png')});
      if(id==='workshop-door')await p.screenshot({path:join(output,engine+'-workshop.png')});
    }
    assert.equal((await save(p)).party[0]?.speciesId,'rillik'); check(engine+'-first-bond-after-real-gate-rescue');
    await p.screenshot({path:join(output,engine+'-first-bond.png')});
    for(const id of ['stairs-exit','whistle-reeds','pell','fisher','tide-door','passage-door']) await interact(p,id);
    await p.screenshot({path:join(output,engine+'-underwharf.png')});
    assert.equal((await save(p)).questFlags.whistle_returned,true); assert.equal((await save(p)).questFlags.wrong_catch,true); check(engine+'-both-optional-harbor-stories');
    await walkTo(p,'sense-eddy'); await p.getByRole('button',{name:/Current Sense/i}).click(); await drain(p);
    await interact(p,'sluice'); await interact(p,'tressel'); await battle(p,'bond');
    assert.ok((await save(p)).party.length>=2); check(engine+'-optional-wild-resonance');
    await walkTo(p,'sense-channel'); await p.getByRole('button',{name:/Current Sense/i}).click(); await drain(p);
    await interact(p,'pickup-tincture'); await interact(p,'save-lamp'); await interact(p,'chamber-door'); await interact(p,'rift'); await battle(p,'boss');
    await press(p,'menu'); await p.getByRole('button',{name:/Settings/i}).click();
    const assist=p.getByRole('switch',{name:/Seal Assist/i}); if(await assist.getAttribute('aria-checked')!=='true')await assist.click();
    await p.keyboard.press('Escape');
    for(let index=0;index<3;index++) await p.getByRole('button',{name:/Seal pulse/i}).click();
    await drain(p); assert.equal((await save(p)).rifts['port-marche'],'sealed'); check(engine+'-three-pulse-assisted-rift-seal');
    await interact(p,'page');
    // Door names are authored map objects, not production-only test shortcuts.
    for(const id of ['chamber-exit','passage-exit','stairs-exit','workshop-door']) await interact(p,id);
    await interact(p,'closing',false);await drain(p,{inspectChoices:true}); assert.equal((await save(p)).questFlags.chapter_complete,true); check(engine+'-complete-real-chapter-through-closing');
    await p.screenshot({path:join(output,engine+'-chapter-complete.png')});
  } catch(error) { await p.screenshot({path:join(output,engine+'-chapter-failure.png')}).catch(()=>{}); throw error; }
  finally { await context.close(); }
}

async function guestRoute() {
  const {p,context}=await setup(390,844,'dark',true);
  try {
    await expect(p.getByRole('heading',{name:'Mesomon',exact:true})).toBeVisible();
    await expect(p.locator('canvas')).toHaveCount(0);
    await p.getByRole('link',{name:'Return to DH Club',exact:true}).click();
    await expect(p.getByRole('heading',{name:'DH Club destination'})).toBeVisible();
    check(engine+'-unauthenticated-route-has-clear-return-without-a-crash');
  } finally {await context.close();}
}

async function offlineTabs() {
  const {p:a,context}=await setup(390,844,'dark');
  let b;
  const position=state=>`${state.player.mapId}:${state.player.x}:${state.player.y}`;
  try{
    await start(a);await drain(a);await press(a,'right');
    await expect.poll(async()=>position(await save(a))).not.toBe('ship:8:9');
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
      if (/^\/games\/mesomon\/(harbor-tiles|people|mesomon|battle)\.png$/.test(path)) offlineArtRequests.push(path);
    });
    await context.setOffline(true);await a.bringToFront();
    const before=position(await save(a));await press(a,'right');
    await expect.poll(async()=>position(await save(a))).not.toBe(before);
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
    await press(b,'left');await expect.poll(async()=>position(await save(b))).not.toBe(head);
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
  if(!process.env.MESOMON_SMOKE_ONLY)await chapter();
  await guestRoute();
  await offlineTabs();
  assert.deepEqual(report.runtimeErrors,[]);console.log(`PASS Mesomon ${engine}: ${report.checks.length} checks`);
  }
}catch(error){report.errors.push(String(error.stack||error));console.error(error);await activePage?.screenshot({path:join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await cleanup();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Mesomon report: '+join(output,'report.json'));}

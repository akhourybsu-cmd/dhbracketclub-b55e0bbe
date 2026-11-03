// Production presentation/runtime checks. All controllers and canvases below
// are the actual application implementations; probes only observe their APIs.
export async function installDeepClaimRuntimeProbe(page) {
  await page.addInitScript(() => {
    const runtime = { samples: [], menuSamples: [], controllers: [], contexts: [], contextCalls: [], visibilityMode: 'native' };
    Object.assign(window, { deepClaimRuntime: runtime });
    const Native = window.AudioContext || window.webkitAudioContext;
    if (Native) {
      const Observed = new Proxy(Native, { construct(Target, args) {
        const context = Reflect.construct(Target, args, Target);
        runtime.contexts.push(context);
        runtime.contextCalls.push({ operation: 'create', gesture: navigator.userActivation?.isActive === true });
        for (const operation of ['resume', 'suspend', 'close']) {
          const original = context[operation].bind(context);
          context[operation] = (...values) => {
            runtime.contextCalls.push({ operation, gesture: navigator.userActivation?.isActive === true });
            return original(...values);
          };
        }
        return context;
      } });
      window.AudioContext = Observed;
      if (window.webkitAudioContext) window.webkitAudioContext = Observed;
    }
  });
  const actual = '?dc_qa_actual=1';
  const canvasPath = '/src/components/deepClaim/renderer/DeepClaimCanvas.tsx';
  await page.route(url => url.pathname === canvasPath && !url.searchParams.has('dc_qa_actual'), route => route.fulfill({
    contentType: 'text/javascript', body: `import {DeepClaimCanvas as Actual} from '${canvasPath}${actual}';
      export function DeepClaimCanvas(props) {
        return Actual({...props,onDiagnostics:sample=>{
          const runtime=window.deepClaimRuntime;
          if(runtime){runtime.samples.push({...sample,observed_at:performance.now()});if(runtime.samples.length>400)runtime.samples.shift();}
          props.onDiagnostics?.(sample);
        }});
      }`,
  }));
  const menuPath = '/src/components/deepClaim/menu/DeepClaimMenuBackdrop.tsx';
  await page.route(url => url.pathname === menuPath && !url.searchParams.has('dc_qa_actual'), route => route.fulfill({
    contentType: 'text/javascript', body: `import {DeepClaimMenuBackdrop as Actual} from '${menuPath}${actual}';
      export * from '${menuPath}${actual}';
      export function DeepClaimMenuBackdrop(props) {
        return Actual({...props,onDiagnostics:sample=>{
          const runtime=window.deepClaimRuntime;
          if(runtime){runtime.menuSamples.push({...sample,observed_at:performance.now()});if(runtime.menuSamples.length>400)runtime.menuSamples.shift();}
          props.onDiagnostics?.(sample);
        }});
      }`,
  }));
  const audioPath = '/src/lib/deepClaim/audio.ts';
  await page.route(url => url.pathname === audioPath && !url.searchParams.has('dc_qa_actual'), route => route.fulfill({
    contentType: 'text/javascript', body: `import {createDeepClaimAudio as actualCreate} from '${audioPath}${actual}';
      export * from '${audioPath}${actual}';
      export function createDeepClaimAudio(userId){const controller=actualCreate(userId);window.deepClaimRuntime?.controllers.push(controller);return controller;}`,
  }));
}

export async function runPhase6Browser(h) {
  const { actors, assert, checked, expect, fit, shot } = h;
  const last = page => page.evaluate(() => window.deepClaimRuntime.samples.at(-1) ?? null);
  const audio = page => page.evaluate(() => window.deepClaimRuntime.controllers.map(controller => ({
    settings: controller.getSnapshot(), diagnostics: controller.getDiagnostics?.() ?? null,
  })));
  const currentAudio = async page => (await audio(page)).filter(value => value.diagnostics?.context_state !== 'closed').at(-1);
  async function soundSettings(page) {
    await h.tab(page, 'Settings');
    await page.getByRole('tablist', { name: 'Camp settings views', exact: true }).getByRole('tab', { name: 'Sound', exact: true }).click();
  }
  async function visualSettings(page) {
    await h.tab(page, 'Settings');
    await page.getByRole('tablist', { name: 'Camp settings views', exact: true }).getByRole('tab', { name: 'Visuals', exact: true }).click();
  }
  async function snapshotState(page) {
    const snapshot = await h.rpc(page, 'dc_get');
    return { company: snapshot.company?.id, cash: snapshot.company?.cash, resources: snapshot.resources,
      workers: snapshot.workers.map(worker => ({ id: worker.id, energy: worker.energy, xp: worker.xp, assigned_job_id: worker.assigned_job_id })),
      expeditions: snapshot.expeditions.map(job => job.id), productions: snapshot.production_jobs?.map(job => job.id) ?? [] };
  }
  async function waitPaint(page) {
    await expect.poll(async () => (await last(page))?.paint_count ?? 0).toBeGreaterThan(0);
  }
  async function assertIdle(page, label) {
    // Browser timers and RAF are left running normally. Repeated public samples
    // must stop without advancing company state or replacing the renderer.
    await page.waitForTimeout(180);
    const before = await last(page);
    await page.waitForTimeout(450);
    const after = await last(page);
    checked(label, before?.paint_count === after?.paint_count && before?.scheduled_wakeups === after?.scheduled_wakeups, { before, after });
  }
  async function setPlatformHidden(page, context, hidden) {
    // Prefer actual headless tab visibility. Some Chromium builds expose every
    // headless tab as visible; explicitly report the DOM lifecycle simulation.
    if (hidden) {
      const cover = await context.newPage(); await cover.goto('about:blank'); await cover.bringToFront();
      const nativeHidden = await page.evaluate(() => document.hidden);
      if (nativeHidden) return { cover, mode: 'native' };
      await cover.close();
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        window.deepClaimRuntime.visibilityMode = 'simulated visibilitychange';
        document.dispatchEvent(new Event('visibilitychange'));
      });
      return { cover: null, mode: 'simulated visibilitychange' };
    }
    await page.evaluate(() => {
      delete document.visibilityState; delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.bringToFront();
    return null;
  }

  const { context, page } = await h.setup(390, 844, 'dark', 'no-preference', { runtimeProbe: true, deviceScaleFactor: 2, isMobile: true });
  try {
    await h.found(page, { run: 'runtime-real-controller', user: actors.alex }); await waitPaint(page);
    const baseline = await snapshotState(page);
    checked('runtime-native-audio-is-silent-before-opt-in', await page.evaluate(() => window.deepClaimRuntime.contexts.length === 0));
    await expect.poll(async () => (await last(page))?.atlas?.state ?? (await last(page))?.atlas?.status).toBe('ready');
    await expect.poll(async () => (await last(page))?.atlas?.draws ?? 0).toBeGreaterThan(0);
    const loaded = await last(page);
    checked('runtime-authored-atlas-decoded-in-production-renderer', (loaded.atlas.state === 'ready' || loaded.atlas.status === 'ready') && loaded.atlas.draws > 0, loaded.atlas);
    checked('runtime-normal-graphics-uses-bounded-dpr2-backing', Math.abs(loaded.viewport.dpr - 2) < .05 && loaded.viewport.backing_width <= loaded.viewport.width * 2 + 1, loaded.viewport);
    await fit(page, 'runtime-dpr2-phone-surface'); await shot(page, 'runtime-dpr2-atlas-surface');

    await soundSettings(page);
    for (const label of ['Game sound volume', 'Music volume', 'Mining effects volume', 'Camp ambience volume']) {
      const slider = page.getByRole('slider', { name: label, exact: true });
      await expect(slider).toBeVisible(); await slider.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
      checked(`runtime-keyboard-volume-${label}`, Number(await slider.inputValue()) > 0);
    }
    await page.getByRole('switch', { name: 'Enable sound', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Enable sound', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.context_state).toBe('running');
    const playing = (await currentAudio(page)).diagnostics;
    checked('runtime-native-audio-reports-bounded-active-voices', playing.voices.total <= 14 && playing.buffer_bytes >= 0, playing);
    checked('runtime-native-audio-created-by-a-real-gesture', await page.evaluate(() => window.deepClaimRuntime.contextCalls.some(call => call.operation === 'create' && call.gesture)));
    const prefs = (await currentAudio(page)).settings;
    checked('runtime-independent-audio-bus-preferences-are-bounded', ['musicVolume', 'ambientVolume', 'sfxVolume'].every(key => Number.isFinite(prefs[key]) && prefs[key] >= 0 && prefs[key] <= 1), prefs);
    await page.getByRole('switch', { name: 'Music', exact: true }).click();
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.voices?.music ?? -1).toBe(0);
    await page.getByRole('switch', { name: 'Camp ambience', exact: true }).click();
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.voices?.ambient ?? -1).toBe(0);
    checked('runtime-native-music-and-ambience-can-be-disabled-independently', true);
    await page.getByRole('switch', { name: 'Music', exact: true }).click();
    await page.getByRole('switch', { name: 'Camp ambience', exact: true }).click();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('deep-claim-title')).toBeAttached();
    await expect(page.getByTestId('dh-games-intro')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('deep-claim-title').getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    checked('runtime-saved-opt-in-never-autoplays-on-reload', await page.evaluate(() => window.deepClaimRuntime.contexts.length === 0));
    // Continue is now an actual user gesture. Check silence on the title
    // before pressing it, rather than incorrectly classifying its permitted
    // gesture unlock as automatic playback.
    await h.continueCompany(page); await waitPaint(page);
    await h.tab(page, 'Mine');
    const canvas = page.getByTestId('deep-claim-canvas'); await canvas.tap({ position: { x: 180, y: 120 } });
    await h.clearDialogs(page);
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.context_state).toBe('running');

    await page.getByRole('button', { name: 'Open mine operations', exact: true }).click();
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.background_paused).toBe(true);
    checked('runtime-occluding-menu-stops-background-score-scheduling', !(await currentAudio(page)).diagnostics.scheduler_active);
    await h.clearDialogs(page);
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.background_paused).toBe(false);
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.voices?.music ?? 0).toBeGreaterThan(0);
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.voices?.ambient ?? 0).toBeGreaterThan(0);
    const score = (await currentAudio(page)).diagnostics;
    checked('runtime-native-original-score-and-ambience-produce-real-voices', score.voices.music > 0 && score.voices.ambient > 0 && score.voices.total <= 14, score);

    await canvas.focus();
    let camera = (await last(page)).camera;
    await page.keyboard.press('ArrowRight'); await expect.poll(async () => (await last(page))?.camera?.x).not.toBe(camera.x);
    camera = (await last(page)).camera;
    await page.keyboard.press('Equal'); await expect.poll(async () => (await last(page))?.camera?.scale).toBeGreaterThan(camera.scale);
    checked('runtime-keyboard-camera-controls-change-real-camera', true);
    await page.getByRole('button', { name: 'Focus crew', exact: true }).click();
    await expect(page.getByText(/depth .* metres\./).last()).toBeAttached();
    await page.getByRole('button', { name: 'Focus surface buildings', exact: true }).click();
    const box = await canvas.boundingBox(); assert.ok(box);
    const cdp = await context.newCDPSession(page);
    async function touch(type, points) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x: box.x + x, y: box.y + y, radiusX: 8, radiusY: 8, force: 1 })) }); }
    camera = (await last(page)).camera;
    await touch('touchStart', [[1, box.width / 2, box.height / 2]]);
    await touch('touchMove', [[1, box.width / 2 + 45, box.height / 2 + 25]]); await touch('touchEnd', []);
    await expect.poll(async () => (await last(page))?.camera?.x).not.toBe(camera.x);
    checked('runtime-native-touch-pan-does-not-open-a-work-order', await page.getByRole('dialog').count() === 0);
    camera = (await last(page)).camera;
    await touch('touchStart', [[1, box.width / 2 - 25, box.height / 2], [2, box.width / 2 + 25, box.height / 2]]);
    await touch('touchMove', [[1, box.width / 2 - 55, box.height / 2], [2, box.width / 2 + 55, box.height / 2]]); await touch('touchEnd', []);
    await expect.poll(async () => (await last(page))?.camera?.scale).toBeGreaterThan(camera.scale);
    checked('runtime-native-pinch-zooms-the-real-camera', true);
    await touch('touchStart', [[1, box.width / 2, box.height / 2]]); await touch('touchCancel', []);
    const pinched = (await last(page)).camera;
    await canvas.focus(); await page.keyboard.press('Home');
    // Diagnostics describe completed paints. Wait for Home's real frame before
    // using its camera as the wheel baseline, rather than the prior pinch frame.
    await expect.poll(async () => (await last(page))?.camera?.scale).not.toBe(pinched.scale);
    checked('runtime-cancelled-touch-keeps-controls-operable', await page.getByRole('dialog').count() === 0);
    camera = (await last(page)).camera;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -180);
    await expect.poll(async () => (await last(page))?.camera?.scale).toBeGreaterThan(camera.scale);
    checked('runtime-browser-wheel-zooms-without-document-scroll', await page.evaluate(() => scrollX === 0 && scrollY === 0));
    await cdp.detach();

    const hidden = await setPlatformHidden(page, context, true);
    await assertIdle(page, 'runtime-hidden-mine-stops-paints-and-scheduling');
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.context_state).toBe('suspended');
    checked('runtime-hidden-page-suspends-native-audio', true, { visibility: hidden.mode });
    await hidden.cover?.close(); await setPlatformHidden(page, context, false);
    await expect.poll(async () => (await currentAudio(page))?.diagnostics?.context_state).toBe('running');
    await soundSettings(page); await assertIdle(page, 'runtime-management-tab-stops-mine-render-work');
    await visualSettings(page);
    const reduced = page.getByRole('switch', { name: 'Reduced motion', exact: true });
    if (await reduced.getAttribute('aria-checked') !== 'true') await reduced.click();
    await h.tab(page, 'Mine'); await waitPaint(page);
    await assertIdle(page, 'runtime-reduced-motion-renders-on-demand-only');
    const staticFrame = await last(page);
    await canvas.focus(); await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await last(page))?.paint_count ?? 0).toBeGreaterThan(staticFrame.paint_count);

    await visualSettings(page);
    const graphics = page.getByRole('switch', { name: 'Reduced graphics', exact: true });
    if (await graphics.getAttribute('aria-checked') !== 'true') await graphics.click();
    if (await reduced.getAttribute('aria-checked') === 'true') await reduced.click();
    await h.tab(page, 'Mine');
    await expect.poll(async () => (await last(page))?.mode).toBe('reduced');
    const start = await last(page); await page.waitForTimeout(1250); const end = await last(page);
    checked('runtime-reduced-graphics-bounds-scheduling-work', end.scheduled_wakeups - start.scheduled_wakeups <= 23 && end.paint_count - start.paint_count <= 22, { start, end, sample_window_ms: 1250 });
    const backing = await canvas.evaluate(node => ({ width: node.width, css: node.getBoundingClientRect().width }));
    checked('runtime-reduced-graphics-caps-backing-pixel-ratio', backing.width <= backing.css + 1, backing);
    const sample = await last(page);
    checked('runtime-visible-public-terrain-and-texture-cache-are-bounded', sample.visible_tiles <= sample.total_tiles && sample.visible_cells >= sample.visible_tiles && sample.terrain_cache_entries <= 384 && sample.visible_chunk_count <= sample.total_chunk_count, sample);
    checked('runtime-animation-frames-reuse-the-public-world-index', start.world_index_builds === end.world_index_builds, { before: start.world_index_builds, after: end.world_index_builds });
    const timing = await page.evaluate(() => window.deepClaimRuntime.samples.map(sample => sample.frame_ms).filter(Number.isFinite).sort((a, b) => a - b));
    checked('runtime-renderer-frame-metrics-are-finite', timing.length > 0 && timing.every(value => value >= 0 && value < 5000), { count: timing.length, p50_ms: timing[Math.floor(timing.length * .5)], p95_ms: timing[Math.floor(timing.length * .95)], max_ms: timing.at(-1), note: 'Headless desktop sample, not a physical-device performance claim.' });

    await page.setViewportSize({ width: 844, height: 390 }); await fit(page, 'runtime-dpr2-landscape-resize'); await shot(page, 'runtime-dpr2-landscape');
    await soundSettings(page); await fit(page, 'runtime-dpr2-landscape-sound'); await shot(page, 'runtime-dpr2-landscape-sound');
    const guideButton = page.getByRole('button', { name: 'Field guide', exact: true }); await guideButton.click();
    const guide = page.getByRole('dialog', { name: 'Field guide', exact: true }); await expect(guide).toBeVisible();
    const first = await guide.getByRole('status').innerText();
    await guide.getByRole('button', { name: 'Next guide page', exact: true }).click(); await expect(guide.getByRole('status')).not.toHaveText(first);
    await fit(page, 'runtime-paged-guide-landscape'); await shot(page, 'runtime-paged-guide-landscape');
    await page.keyboard.press('Escape'); await expect(guide).toHaveCount(0); await expect(guideButton).toBeFocused();
    checked('runtime-paged-guide-restores-keyboard-focus', true);
    assert.deepEqual(await snapshotState(page), baseline);
    checked('runtime-presentation-never-changes-authoritative-economy', true);
    await page.evaluate(() => window.deepClaimNavigate('/compete'));
    await expect(page.getByRole('heading', { name: 'Compete', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.deepClaimRuntime.contexts.every(context => context.state === 'closed'))).toBe(true);
    checked('runtime-route-exit-closes-native-audio-and-renderer', true);
  } catch (error) { throw error; } // Keep failure pages open for the root report.
  await context.close();

  const failed = await h.setup(320, 568, 'light', 'reduce', { runtimeProbe: true, deviceScaleFactor: 2, isMobile: true });
  try {
    await failed.page.route('**/deep-claim/atlas-v1.png*', route => route.abort('failed'));
    await h.found(failed.page, { run: 'runtime-atlas-failure' }); await waitPaint(failed.page);
    await expect.poll(async () => (await last(failed.page))?.atlas?.state ?? (await last(failed.page))?.atlas?.status).toMatch(/failed|fallback/);
    await fit(failed.page, 'runtime-failed-atlas-small-phone'); await shot(failed.page, 'runtime-failed-atlas-small-phone');
    await h.tab(failed.page, 'Mine'); await failed.page.getByRole('button', { name: 'Open mine operations', exact: true }).click();
    await expect(failed.page.getByRole('dialog', { name: 'Underground operations', exact: true })).toBeVisible();
    checked('runtime-atlas-network-failure-retains-production-operation-controls', true);
    checked('runtime-reduced-motion-never-creates-an-audio-context', await failed.page.evaluate(() => window.deepClaimRuntime.contexts.length === 0));
    await failed.context.close();
  } catch (error) { throw error; }

  const dense = await h.setup(390, 844, 'dark', 'no-preference', { runtimeProbe: true, deviceScaleFactor: 2, isMobile: true });
  try {
    const snapshot = await h.found(dense.page, { run: 'runtime-synthetic-public-geometry' });
    const before = await snapshotState(dense.page);
    await dense.page.evaluate(snapshot => {
      window.deepClaimRuntimeSnapshot = snapshot;
      window.deepClaimRuntime.samples.length = 0;
      window.deepClaimNavigate('/deep-claim/render-stress');
    }, snapshot);
    await expect(dense.page.getByRole('heading', { name: 'Synthetic public renderer geometry', exact: true })).toBeVisible(); await waitPaint(dense.page);
    await expect.poll(async () => (await last(dense.page))?.total_tiles ?? 0).toBe(57504);
    await expect.poll(async () => (await last(dense.page))?.camera?.y ?? 0).toBeGreaterThan(280);
    await dense.page.waitForTimeout(900);
    const first = await last(dense.page);
    checked('runtime-synthetic-57504-public-cells-cull-to-the-viewport', first.total_tiles === 57504 && first.visible_tiles > 0 && first.visible_tiles < first.total_tiles / 10 && first.terrain_cache_entries <= 384 && first.visible_chunk_count < first.total_chunk_count, first);
    await fit(dense.page, 'runtime-synthetic-public-dense-mine'); await shot(dense.page, 'runtime-synthetic-public-dense-mine');
    await dense.page.getByRole('button', { name: 'Locate synthetic deep view', exact: true }).click();
    await expect.poll(async () => (await last(dense.page))?.camera?.y ?? 0).toBeGreaterThan(570);
    const moved = await last(dense.page);
    checked('runtime-synthetic-deep-view-retains-bounded-cache-and-culling', moved.visible_tiles < moved.total_tiles / 10 && moved.terrain_cache_entries <= 384, moved);
    await dense.page.getByRole('button', { name: 'reduced rendering', exact: true }).click();
    await expect.poll(async () => (await last(dense.page))?.mode).toBe('reduced');
    await dense.page.waitForTimeout(200); const initial = await last(dense.page); await dense.page.waitForTimeout(1250); const final = await last(dense.page);
    checked('runtime-synthetic-dense-reduced-mode-bounds-render-wakeups', final.scheduled_wakeups - initial.scheduled_wakeups <= 23 && final.paint_count - initial.paint_count <= 22, { initial, final, sample_window_ms: 1250 });
    checked('runtime-synthetic-dense-frames-reuse-a-single-public-index', initial.world_index_builds === final.world_index_builds, { before: initial.world_index_builds, after: final.world_index_builds });
    await dense.page.getByRole('button', { name: 'static rendering', exact: true }).click();
    await expect.poll(async () => (await last(dense.page))?.mode).toBe('static');
    await assertIdle(dense.page, 'runtime-synthetic-dense-static-mode-has-no-render-loop');
    const times = await dense.page.evaluate(() => window.deepClaimRuntime.samples.map(sample => sample.frame_ms).filter(Number.isFinite).sort((a, b) => a - b));
    checked('runtime-synthetic-dense-render-timing-sample', times.length > 0 && times.every(value => value >= 0 && value < 5000), { count: times.length, p50_ms: times[Math.floor(times.length * .5)], p95_ms: times[Math.floor(times.length * .95)], max_ms: times.at(-1), note: 'Synthetic public visual fixture on headless Chromium. No economic actions or physical-device claim.' });
    assert.deepEqual(await snapshotState(dense.page), before);
    checked('runtime-synthetic-geometry-does-not-change-server-company-terrain-or-economy', true);
    await dense.context.close();
  } catch (error) { throw error; }
  console.log('PASS Deep Claim native presentation runtime, accessibility and diagnostics');
}

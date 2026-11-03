// Actual paid staff, two earned crew slots and server-declared stages. The
// optional worker-frame callback observes rendering; it cannot award anything.
export async function runDeepClaimCrewBrowser(h) {
  const { assert, checked, expect, fit, shot } = h;
  const run = 'earned-crew-visuals';
  const protectedState = snapshot => ({ cash: snapshot.company.cash, resources: snapshot.resources,
    workers: snapshot.workers.map(worker => ({ id: worker.id, energy: worker.energy, xp: worker.xp, assignment: worker.assigned_job_id })),
    expeditions: snapshot.expeditions.map(job => ({ id: job.id, workers: job.worker_ids, target: job.target, status: job.status })) });
  const frame = page => page.evaluate(() => window.deepClaimRuntime.workerFrames.at(-1) ?? null);
  async function freshFrame(page, after = -1) {
    await expect.poll(async () => (await frame(page))?.observed_at ?? -1).toBeGreaterThan(after);
    return frame(page);
  }
  async function refresh(page) {
    await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Refresh company', exact: true })).toBeEnabled();
    await h.settle(page);
  }
  async function dismissDeparture(page) {
    const dismiss = page.getByRole('button', { name: 'Dismiss departure', exact: true });
    if (await dismiss.isVisible()) {
      try { await dismiss.click({ timeout: 750 }); }
      catch (error) { if (await dismiss.isVisible()) throw error; }
    }
    await expect(page.locator('[data-dc-departure]')).toHaveCount(0);
  }
  async function advanceTo(page, jobId, stageKey, fraction = .35) {
    const snapshot = await h.rpc(page, 'dc_get');
    const job = snapshot.expeditions.find(entry => entry.id === jobId);
    assert.ok(job?.status === 'active');
    const stage = job.stages.find(entry => entry.key === stageKey); assert.ok(stage);
    const target = Date.parse(stage.starts_at) + (Date.parse(stage.ends_at) - Date.parse(stage.starts_at)) * fraction;
    const seconds = (target - Date.parse(snapshot.server_now)) / 1000;
    assert.ok(seconds > 0, `The real ${stageKey} midpoint must still be ahead of this paid expedition`);
    await h.command(page, 'advance_job', { job_id: jobId, seconds });
    return h.rpc(page, 'dc_get');
  }
  const onRoute = (point, path) => path.some((end, index) => {
    const start = path[Math.max(0, index - 1)];
    if (start.x === end.x) return Math.abs(point.x - start.x) < .001 && point.y >= Math.min(start.y, end.y) - .001 && point.y <= Math.max(start.y, end.y) + .001;
    if (start.y === end.y) return Math.abs(point.y - start.y) < .001 && point.x >= Math.min(start.x, end.x) - .001 && point.x <= Math.max(start.x, end.x) + .001;
    return false;
  });
  function assertWorkers(sample, snapshot, jobs, label) {
    const expectedIds = snapshot.workers.map(worker => worker.id).sort();
    assert.deepEqual(sample.workers.map(worker => worker.worker_id).sort(), expectedIds, 'Every owned worker must be projected exactly once');
    assert.equal(new Set(sample.workers.map(worker => worker.worker_id)).size, expectedIds.length);
    const known = new Map(snapshot.world.tiles.map(tile => [`${tile.x}:${tile.y}`, tile]));
    const crewById = new Map(sample.crews.map(crew => [crew.job_id, crew]));
    assert.equal(crewById.size, 2);
    assert.equal(new Set(sample.crews.map(crew => crew.number)).size, 2);
    for (const job of jobs) {
      const crew = crewById.get(job.id); assert.ok(crew);
      assert.ok(Number.isInteger(crew.number) && crew.number > 0);
      assert.deepEqual([...crew.worker_ids].sort(), [...job.worker_ids].sort());
      assert.equal(crew.stage, job.stage);
    }
    for (const worker of sample.workers) {
      assert.ok(Number.isFinite(worker.x) && Number.isFinite(worker.y));
      assert.ok(worker.x >= 0 && worker.x < snapshot.world.width && worker.y >= 0);
      assert.ok(worker.facing === 1 || worker.facing === -1);
      const owner = snapshot.workers.find(person => person.id === worker.worker_id);
      assert.equal(worker.job_id, owner.assigned_job_id);
      const job = jobs.find(entry => entry.id === worker.job_id); assert.ok(job);
      assert.equal(worker.crew_number, crewById.get(job.id).number);
      assert.equal(worker.stage, job.stage, 'Visual time never invents the next official stage');
      if (worker.y >= 1) {
        const tile = known.get(`${Math.floor(worker.x + .00001)}:${Math.floor(worker.y + .00001)}`);
        assert.ok(tile && tile.remaining === 0, `${worker.worker_id} must stand on disclosed, open ground`);
      }
      if (worker.stage === 'travel' || worker.stage === 'return') {
        if (worker.y === 0 && !onRoute(worker, job.path)) {
          const entrance = job.path.find(point => point.y === 0); assert.ok(entrance);
          assert.ok(worker.x <= entrance.x && entrance.x - worker.x <= Math.max(2, sample.workers.length),
            'A surface queue stays within the small owned entrance vicinity');
        } else assert.ok(onRoute(worker, job.path), 'Underground travel stays on the actual public route');
      }
    }
    checked(label, true, { workers: sample.workers, crews: sample.crews });
  }
  async function followCard(page, jobId) {
    const before = (await frame(page))?.observed_at ?? -1;
    await page.locator(`[data-dc-expedition="${jobId}"]`).getByRole('button', { name: 'Follow crew', exact: true }).click();
    await expect.poll(async () => (await frame(page))?.followed_job_id).toBe(jobId);
    return freshFrame(page, before);
  }
  async function assertFollowGeometry(page, label) {
    const stop = page.getByRole('button', { name: 'Stop following crew', exact: true });
    await expect(stop).toBeVisible();
    const chrome = await stop.evaluate(button => {
      const rect = node => { const box = node.getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; };
      const box = rect(button), hud = rect(document.querySelector('[data-testid="crew-tracking"]'));
      const controls = rect(document.querySelector('.dc-mine-controls'));
      const hit = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
      const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left)
        && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      return { button: box, hud, controls,
        visible: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
        reachable: !!hit && (hit === button || button.contains(hit)), overlap: overlap(hud, controls) };
    });
    checked(`crews-tracking-stop-is-reachable-and-separate-from-map-controls-${label}`,
      chrome.visible && chrome.reachable && chrome.button.width >= 44 && chrome.button.height >= 44 && !chrome.overlap, chrome);
    // The tracking header can resize the real map. Compare body/marker geometry
    // only after the renderer has completed a paint at those actual dimensions.
    await expect.poll(() => page.evaluate(() => {
      const viewport = window.deepClaimRuntime.samples.at(-1)?.viewport;
      const canvas = document.querySelector('.dc-mine-canvas').getBoundingClientRect();
      return !!viewport && Math.round(viewport.width) === Math.round(canvas.width) && Math.round(viewport.height) === Math.round(canvas.height);
    })).toBe(true);
    const current = await frame(page);
    assert.ok(Array.isArray(current.bodies), 'The opt-in frame supplies actual painted body envelopes');
    assert.deepEqual(current.markers.map(marker => marker.job_id).sort(), current.crews.map(crew => crew.job_id).sort(),
      'Both nearby earned crews keep a discoverable marker after camera focus');
    assert.deepEqual(current.bodies.map(body => body.worker_id).sort(),
      current.workers.filter(worker => worker.painted).map(worker => worker.worker_id).sort());
    const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left)
      && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
    const covering = [];
    for (const marker of current.markers) {
      const centerY = (marker.top + marker.bottom) / 2;
      const visual = { left: marker.left, right: marker.right, top: centerY - 11, bottom: centerY + 11 };
      for (const body of current.bodies) {
        assert.ok([body.left, body.top, body.right, body.bottom].every(Number.isFinite) && body.right > body.left && body.bottom > body.top);
        if (overlap(visual, body) || overlap(marker, body)) covering.push({ job_id: marker.job_id, worker_id: body.worker_id, marker, visual, body });
      }
    }
    checked(`crews-marker-art-and-touch-targets-leave-painted-workers-clear-${label}`, covering.length === 0,
      { bodies: current.bodies, markers: current.markers, covering });
    return current;
  }

  let client = await h.setup(390, 844, 'dark', 'no-preference', { runtimeProbe: true });
  let earned, jobIds;
  try {
    const { page } = client;
    await h.found(page, { run }); await h.intro(page);
    let snapshot = await h.rpc(page, 'dc_get');
    const induction = snapshot.expeditions.find(job => job.tutorial && job.status === 'active'); assert.ok(induction);
    await h.command(page, 'advance_job', { job_id: induction.id, seconds: induction.duration_seconds + 1 });
    await refresh(page);
    await page.getByRole('button', { name: 'Open haul', exact: true }).click();
    await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await h.closeReward(page);
    snapshot = await h.rpc(page, 'dc_get');
    const beforeUpgrade = snapshot.company.cash;
    const officeCost = snapshot.buildings.find(building => building.key === 'mine_office').upgrade_cost;
    await h.tab(page, 'Surface'); await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
    await page.getByRole('dialog', { name: 'Buildings', exact: true }).getByRole('button', { name: /^Mine Office/ }).click();
    await page.getByRole('button', { name: 'Confirm upgrade', exact: true }).click(); await h.closeReward(page);
    snapshot = await h.rpc(page, 'dc_get');
    assert.equal(snapshot.company.crew_slots, 2); assert.equal(snapshot.company.cash, beforeUpgrade - officeCost);
    const beforeDispatch = snapshot;
    const crews = [{ x: 50, y: 1, workers: ['Mara Flint', 'Ivo Vale'] }, { x: 49, y: 2, workers: ['Tessa Pike'] }];
    for (const crew of crews) {
      const plan = await h.operationPlan(page, 'extract', { ...crew, review: true });
      await plan.getByRole('button', { name: 'Dispatch crew', exact: true }).click();
      await expect(plan).toHaveCount(0); await dismissDeparture(page);
    }
    snapshot = await h.rpc(page, 'dc_get');
    const active = snapshot.expeditions.filter(job => job.status === 'active');
    assert.equal(active.length, 2);
    jobIds = crews.map(crew => active.find(job => job.target.x === crew.x && job.target.y === crew.y)?.id);
    assert.ok(jobIds.every(Boolean));
    assert.deepEqual(active.map(job => job.worker_ids.length).sort(), [1, 2]);
    assert.equal(new Set(active.flatMap(job => job.worker_ids)).size, 3);
    assert.equal(snapshot.company.cash, beforeDispatch.company.cash - active.reduce((sum, job) => sum + job.wages, 0));
    for (const worker of snapshot.workers) assert.equal(worker.energy, beforeDispatch.workers.find(person => person.id === worker.id).energy - 1);
    checked('crews-two-plus-one-employees-belong-to-two-paid-active-expeditions', true);
    for (const jobId of jobIds) await advanceTo(page, jobId, 'work');
    await refresh(page);
    earned = await h.rpc(page, 'dc_get');
    assert.ok(earned.expeditions.filter(job => jobIds.includes(job.id)).every(job => job.stage === 'work'));
  } finally { await client.context.close(); }

  let numbers;
  for (const [width, height, theme, motion] of h.visualCases) {
    client = await h.setup(width, height, theme, motion, { runtimeProbe: true });
    const { page } = client, label = `${width}x${height}-${theme}-${motion}`;
    try {
      await h.go(page, { run, theme }); await h.tab(page, 'Mine');
      const snapshot = await h.rpc(page, 'dc_get'), jobs = snapshot.expeditions.filter(job => jobIds.includes(job.id));
      const before = protectedState(snapshot);
      let sample = await freshFrame(page);
      assertWorkers(sample, snapshot, jobs, `crews-each-owned-worker-once-with-correct-job-and-open-workspot-${label}`);
      const currentNumbers = Object.fromEntries(sample.crews.map(crew => [crew.job_id, crew.number]));
      if (numbers) assert.deepEqual(currentNumbers, numbers); else numbers = currentNumbers;
      for (const job of jobs) {
        const card = page.locator(`[data-dc-expedition="${job.id}"]`);
        await expect(card).toHaveAttribute('data-dc-crew-number', String(currentNumbers[job.id]));
        await expect(card.getByText(`Crew ${currentNumbers[job.id]}`, { exact: true })).toBeVisible();
      }
      const first = jobs[0], second = jobs[1];
      sample = await followCard(page, first.id);
      assert.equal(sample.followed_job_id, first.id);
      sample = await assertFollowGeometry(page, `card-${label}`);
      assert.ok(sample.workers.some(worker => worker.job_id === first.id && worker.painted));
      await expect(page.getByTestId('crew-tracking')).toHaveAttribute('role', 'group');
      const marker = sample.markers.find(entry => entry.job_id === second.id); assert.ok(marker);
      const canvas = await page.getByTestId('deep-claim-canvas').boundingBox(); assert.ok(canvas);
      const markerPoint = { x: (marker.left + marker.right) / 2, y: (marker.top + marker.bottom) / 2 };
      assert.ok(markerPoint.x >= 0 && markerPoint.x <= canvas.width && markerPoint.y >= 0 && markerPoint.y <= canvas.height,
        'The other active crew marker remains inside the actual mine viewport');
      // These are the actual painted marker hit bounds, observed only through
      // the optional callback. A native pointer must hit the production canvas.
      await page.mouse.click(canvas.x + markerPoint.x, canvas.y + markerPoint.y);
      await expect.poll(async () => (await frame(page))?.followed_job_id).toBe(second.id);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      sample = await assertFollowGeometry(page, `marker-${label}`);
      assert.ok(sample.workers.some(worker => worker.job_id === second.id && worker.painted));
      await expect(page.getByRole('button', { name: /^Stop following/ })).toBeVisible();
      await fit(page, `crews-follow-${label}`); await shot(page, `crews-follow-${label}`);
      checked(`crews-cards-and-markers-follow-the-selected-expedition-${label}`, true, { followed: sample.followed_job_id, camera: sample.camera });

      await page.getByTestId('deep-claim-canvas').focus();
      await expect(page.getByTestId('deep-claim-canvas')).toBeFocused();
      const manualBefore = await frame(page);
      await page.keyboard.press('ArrowRight');
      // The earlier follow sample predates screenshot/layout work and may
      // already have many newer following frames queued before this key. Wait
      // for the actual manual-input transition, not merely any newer paint.
      await expect.poll(async () => (await frame(page))?.followed_job_id).toBe(null);
      const manualAt = await page.evaluate(() => window.deepClaimRuntime.mapInteractionAt);
      await expect.poll(async () => {
        const current = await frame(page);
        return !!current && current.followed_job_id === null && current.observed_at >= manualAt;
      }).toBe(true);
      sample = await frame(page);
      assert.equal(sample.followed_job_id, null);
      assert.ok(sample.camera.x - manualBefore.camera.x >= .5, 'ArrowRight actually moves the camera after ending follow');
      await expect(page.getByRole('button', { name: /^Stop following/ })).toHaveCount(0);
      checked(`crews-manual-camera-navigation-ends-continuous-follow-${label}`, true);

      await h.reloadCompany(page); await h.tab(page, 'Mine');
      sample = await freshFrame(page);
      assert.deepEqual(Object.fromEntries(sample.crews.map(crew => [crew.job_id, crew.number])), numbers);
      assert.deepEqual(protectedState(await h.rpc(page, 'dc_get')), before);
      checked(`crews-reload-preserves-roster-numbers-energy-and-paid-jobs-${label}`, true);
      if (motion === 'reduce') {
        await expect.poll(() => page.evaluate(() => {
          const sample = window.deepClaimRuntime.samples.at(-1);
          return sample?.atlas?.state ?? sample?.atlas?.status;
        })).toBe('ready');
        // Asset decode may request a final redraw after reload. First observe a
        // stable completed-paint window, then verify static mode stays asleep.
        let previousPaint = -1;
        await expect.poll(async () => {
          const current = await page.evaluate(() => window.deepClaimRuntime.samples.at(-1).paint_count);
          const stable = current === previousPaint; previousPaint = current;
          return stable;
        }, { intervals: [100, 150, 200] }).toBe(true);
        const paints = await page.evaluate(() => window.deepClaimRuntime.samples.at(-1).paint_count);
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => window.deepClaimRuntime.samples.at(-1).paint_count), paints);
        checked(`crews-reduced-motion-retains-static-rendering-${label}`, true);
      }
      await fit(page, `crews-reloaded-${label}`); await shot(page, `crews-reloaded-${label}`);
    } finally { await client.context.close(); }
  }

  // A real return stage makes continuous movement measurable without requiring
  // a long wall-clock shift or fabricating a route/crew/world for the renderer.
  client = await h.setup(390, 844, 'dark', 'no-preference', { runtimeProbe: true });
  try {
    const { page } = client;
    await h.go(page, { run }); await h.tab(page, 'Mine');
    await followCard(page, jobIds[0]);
    await advanceTo(page, jobIds[0], 'return', .15); await refresh(page);
    const returningCount = earned.expeditions.find(job => job.id === jobIds[0]).worker_ids.length;
    await expect.poll(async () => {
      const workers = (await frame(page))?.workers.filter(worker => worker.job_id === jobIds[0]) ?? [];
      return workers.length === returningCount && workers.every(worker => worker.stage === 'return' && worker.moving);
    }).toBe(true);
    const before = await frame(page); assert.equal(before.followed_job_id, jobIds[0]);
    await page.waitForTimeout(850);
    const after = await freshFrame(page, before.observed_at);
    const oldCrew = before.crews.find(crew => crew.job_id === jobIds[0]), crew = after.crews.find(entry => entry.job_id === jobIds[0]);
    assert.ok(Math.hypot(crew.x - oldCrew.x, crew.y - oldCrew.y) > .001);
    assert.ok(Math.hypot(after.camera.x - before.camera.x, after.camera.y - before.camera.y) > .001);
    assert.equal(after.followed_job_id, jobIds[0]);
    const latest = await h.rpc(page, 'dc_get'), jobs = latest.expeditions.filter(job => jobIds.includes(job.id));
    assertWorkers(after, latest, jobs, 'crews-return-uses-real-public-route-and-assignment');
    checked('crews-camera-continues-following-server-declared-return-movement', true, { before: before.camera, after: after.camera, crew });
    const walkers = after.workers.filter(worker => worker.job_id === jobIds[0]);
    for (const worker of walkers) {
      const earlier = before.workers.find(person => person.worker_id === worker.worker_id);
      if (Math.abs(worker.x - earlier.x) > .001) assert.equal(worker.facing, worker.x > earlier.x ? 1 : -1);
    }
    checked('crews-return-facing-matches-the-actual-horizontal-route-tangent', true);
    await fit(page, 'crews-moving-return'); await shot(page, 'crews-moving-return');
    assert.ok(earned.company.id === latest.company.id && latest.workers.length === 3);
  } finally { await client.context.close(); }
}

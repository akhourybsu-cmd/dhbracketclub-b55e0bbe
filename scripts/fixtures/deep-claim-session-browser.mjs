// Real company, elapsed SQL work and owned stock. Goals/reports/reused plans
// only organize the existing loop; this fixture never fabricates rewards.
export async function runDeepClaimSessionBrowser(h) {
  const { expect, checked, fit, shot, assert } = h;
  const run = 'company-session-loop';
  const { context, page } = await h.setup(390, 844, 'dark');
  const total = resources => Object.values(resources ?? {}).reduce((sum, amount) => sum + amount, 0);
  const economic = snapshot => ({
    company: snapshot.company,
    resources: snapshot.resources,
    workers: snapshot.workers,
    equipment: snapshot.equipment,
    expeditions: snapshot.expeditions,
    buildings: snapshot.buildings,
    production: snapshot.production_jobs,
    business: snapshot.business,
    discoveries: snapshot.discoveries,
    world: snapshot.world,
  });
  const report = client => client.getByRole('dialog', { name: 'Shift report', exact: true });
  const goalPlanner = client => client.getByRole('dialog', { name: 'Company goals', exact: true });
  async function current(client = page) { return h.rpc(client, 'dc_get'); }
  async function openGoals(client) {
    await h.tab(client, 'Surface');
    await client.getByRole('button', { name: /^(?:Choose company goal|Open company goals)$/ }).click();
    const planner = goalPlanner(client); await expect(planner).toBeVisible();
    await planner.getByRole('button', { name: 'Buildings', exact: true }).click();
    return planner;
  }
  async function warehouseGoal(client) {
    const planner = await openGoals(client);
    await planner.locator('[data-dc-goal-id="building:warehouse:2"]').click();
    await expect(planner.getByRole('button', { name: /^(?:Pin goal|Pinned)$/ })).toBeVisible();
    return planner;
  }
  async function assertNoEconomicCalls(client, start, label) {
    const calls = (await h.command(client, 'calls')).slice(start);
    const economicCalls = calls.filter(call => !['dc_get', 'dc_tutorial_get', 'dc_tutorial_save'].includes(call.name));
    checked(label, economicCalls.length === 0, economicCalls.map(call => call.name));
  }
  try {
    const initial = await h.found(page, { run });
    await expect(report(page)).toHaveCount(0);
    checked('session-first-authorized-visit-is-a-quiet-baseline', initial.expeditions.length === 0 && total(initial.resources) === 0);
    await h.intro(page);
    let snapshot = await current();
    const firstJob = snapshot.expeditions.find(job => job.status === 'active');
    assert.ok(firstJob?.tutorial, 'The return report must follow a real, paid induction');
    checked('session-first-shift-spends-once-and-has-no-unearned-cargo', snapshot.company.cash === initial.company.cash - firstJob.wages
      && firstJob.cargo === null && snapshot.workers.every(worker => worker.energy === 5));
    await h.tab(page, 'Settings');
    await page.getByRole('button', { name: 'Return to Main Menu', exact: true }).click();
    await expect(page.getByTestId('deep-claim-title')).toBeVisible();
    await h.command(page, 'advance_job', { job_id: firstJob.id, seconds: firstJob.duration_seconds + 1 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await h.continueCompany(page);
    const returned = report(page); await expect(returned).toBeVisible();
    snapshot = await current();
    const ready = snapshot.expeditions.find(job => job.id === firstJob.id);
    assert.equal(ready.status, 'ready'); assert.ok(total(ready.cargo) > 0);
    await expect(returned.locator('[data-dc-return-kind="hauls"] .dcl-return-quantity')).toContainText(total(ready.cargo).toLocaleString());
    await expect(returned.locator('[data-dc-return-kind="hauls"]')).toContainText('units awaiting storage');
    checked('session-return-report-describes-real-ready-cargo-before-collection', total(snapshot.resources) === 0
      && snapshot.company.cash === initial.company.cash - firstJob.wages
      && !/(?:offline profit|credits earned|money earned)/i.test(await returned.innerText()));
    await fit(page, 'session-automatic-return-report'); await shot(page, 'session-automatic-return-report');
    await returned.getByRole('button', { name: 'Back to camp', exact: true }).click();
    await h.clearDialogs(page);

    const beforeGoal = await current(), goalCallStart = (await h.command(page, 'calls')).length;
    let planner = await warehouseGoal(page);
    const warehouseCost = beforeGoal.buildings.find(building => building.key === 'warehouse').upgrade_cost;
    await expect(planner.getByRole('list', { name: 'Goal requirements', exact: true })).toContainText(`${Math.min(beforeGoal.company.cash, warehouseCost + 2)} / ${warehouseCost + 2}`);
    await planner.getByRole('button', { name: 'Pin goal', exact: true }).click();
    await expect(planner).toHaveCount(0);
    await h.reloadCompany(page, { acknowledgeReport: false });
    await expect(report(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Review pinned goal', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review pinned goal', exact: true }).click();
    const warehouse = page.getByRole('dialog', { name: 'Warehouse', exact: true });
    await expect(warehouse.getByRole('button', { name: 'Confirm upgrade', exact: true })).toBeEnabled();
    await expect(warehouse.getByRole('group', { name: 'Transaction summary', exact: true })).toContainText('60 cr');
    await fit(page, 'session-pinned-goal-authorized-review'); await shot(page, 'session-pinned-goal-authorized-review');
    await h.clearDialogs(page);
    assert.deepEqual(economic(await current()), economic(beforeGoal));
    await assertNoEconomicCalls(page, goalCallStart, 'session-goal-pin-reload-and-review-never-buy-or-award');
    checked('session-acknowledged-return-does-not-auto-repeat-on-reload', true);

    // Fresh clients use the same earned company. Their first hydration is a
    // quiet baseline; manual reports may still inspect its actual ready work.
    const cases = h.visualCases;
    for (const [index, [width, height, theme, motion]] of cases.entries()) {
      const client = await h.setup(width, height, theme, motion);
      try {
        await h.go(client.page, { run, theme });
        await expect(report(client.page)).toHaveCount(0);
        const before = await current(client.page), start = (await h.command(client.page, 'calls')).length;
        planner = await warehouseGoal(client.page);
        await fit(client.page, `session-${index}-goal-planner`); await shot(client.page, `session-${index}-goal-planner`);
        await planner.getByRole('button', { name: 'Pin goal', exact: true }).click();
        await expect(planner).toHaveCount(0);
        const footprint = await client.page.locator('.dcl-goal-dock').evaluate(dock => {
          const box = dock.getBoundingClientRect(), operation = document.querySelector('.dcl-operation-dock')?.getBoundingClientRect();
          const overlap = operation ? Math.max(0, Math.min(box.right, operation.right) - Math.max(box.left, operation.left)) * Math.max(0, Math.min(box.bottom, operation.bottom) - Math.max(box.top, operation.top)) : 0;
          const buttons = [...dock.querySelectorAll('button')].map(button => {
            const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return { name: button.getAttribute('aria-label'), width: rect.width, height: rect.height, reachable: !!hit && (hit === button || button.contains(hit)) };
          });
          return { overlap, buttons };
        });
        checked(`session-${width}x${height}-${theme}-${motion}-goal-clears-crews-and-controls-stay-reachable`, footprint.overlap === 0 && footprint.buttons.every(button => button.width >= 44 && button.height >= 44 && button.reachable), footprint);
        await fit(client.page, `session-${index}-goal-dock`); await shot(client.page, `session-${index}-goal-dock`);
        await client.page.getByRole('button', { name: 'Open shift report', exact: true }).click();
        const manual = report(client.page); await expect(manual).toBeVisible();
        await expect(manual.locator('[data-dc-return-kind="hauls"] .dcl-return-quantity')).toContainText(total(ready.cargo).toLocaleString());
        await expect(manual.locator('[data-dc-return-kind="hauls"]')).toContainText('units awaiting storage');
        await fit(client.page, `session-${index}-return-report`); await shot(client.page, `session-${index}-return-report`);
        await manual.getByRole('button', { name: 'Back to camp', exact: true }).click();
        await h.clearDialogs(client.page);
        assert.deepEqual(economic(await current(client.page)), economic(before));
        await assertNoEconomicCalls(client.page, start, `session-${width}x${height}-${theme}-${motion}-planning-and-reporting-never-spend`);
      } finally { await client.context.close(); }
    }

    await page.getByRole('button', { name: 'Open shift report', exact: true }).click();
    await report(page).getByRole('button', { name: 'Review returns', exact: true }).click();
    const haul = page.getByRole('dialog', { name: 'The haul is home', exact: true }); await expect(haul).toBeVisible();
    await haul.getByRole('button', { name: 'Collect into storage', exact: true }).click();
    const reward = page.getByRole('dialog', { name: 'Haul secured.', exact: true }); await expect(reward).toBeVisible();
    snapshot = await current();
    checked('session-only-actual-collection-transfers-returned-stock', snapshot.expeditions.find(job => job.id === firstJob.id).status === 'collected'
      && Object.entries(ready.cargo).every(([key, amount]) => snapshot.resources[key] === amount));
    const beforePlan = economic(snapshot), callsBeforePlan = await h.command(page, 'calls');
    await reward.getByRole('button', { name: 'Plan next shift', exact: true }).click();
    const nextPlan = page.getByRole('dialog', { name: /^(?:Mine a deposit|Expand tunnels)$/ }); await expect(nextPlan).toBeVisible();
    await expect(nextPlan.getByRole('checkbox', { name: /First shift/ })).toHaveCount(0);
    await expect(nextPlan.getByRole('group', { name: 'Shift duration', exact: true }).locator('[data-dc-duration="20"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(nextPlan.getByRole('region', { name: 'Verified dispatch estimate', exact: true })).toHaveCount(0);
    const selected = nextPlan.getByRole('group', { name: 'Expedition worksite', exact: true }).getByRole('button', { pressed: true });
    const point = (await selected.getAttribute('data-dc-worksite')).split(':').map(Number);
    const tile = snapshot.world.tiles.find(tile => tile.x === point[0] && tile.y === point[1]);
    checked('session-next-draft-reuses-a-real-available-crew-and-skips-depleted-seam', !!tile?.material && tile.remaining > 0
      && point.join(':') !== `${firstJob.target.x}:${firstJob.target.y}`
      && (await nextPlan.getByRole('group', { name: 'Selected crew', exact: true }).innerText()).includes(snapshot.workers.find(worker => worker.id === firstJob.worker_ids[0]).name));
    const callsAfterPlan = await h.command(page, 'calls');
    checked('session-plan-next-shift-does-not-preview-or-dispatch-automatically', callsAfterPlan.filter(call => /preview|dispatch/.test(call.name)).length
      === callsBeforePlan.filter(call => /preview|dispatch/.test(call.name)).length);
    await fit(page, 'session-next-shift-editable-draft'); await shot(page, 'session-next-shift-editable-draft');
    await nextPlan.getByRole('button', { name: 'Review dispatch', exact: true }).click();
    await expect(nextPlan.getByRole('button', { name: 'Dispatch crew', exact: true })).toBeEnabled();
    await expect(nextPlan.getByText('20 min', { exact: true }).last()).toBeVisible();
    const lastPreview = (await h.command(page, 'calls')).filter(call => call.name === 'dc_preview_operation').at(-1);
    checked('session-next-shift-requires-an-ordinary-server-quote-for-the-exact-draft', lastPreview.args.p_duration_minutes === 20
      && lastPreview.args.p_tutorial === false && lastPreview.args.p_target_x === point[0] && lastPreview.args.p_target_y === point[1]
      && [...lastPreview.args.p_worker_ids].sort().join(':') === [...firstJob.worker_ids].sort().join(':'));
    await h.clearDialogs(page);
    assert.deepEqual(economic(await current()), beforePlan);
    const calls = await h.command(page, 'calls');
    checked('session-entire-new-loop-keeps-exactly-one-real-dispatch-and-collection', calls.filter(call => call.name === 'dc_dispatch_operation').length === 1
      && calls.filter(call => call.name === 'dc_collect').length === 1
      && !calls.some(call => ['dc_upgrade', 'dc_sell', 'dc_start_research', 'dc_fulfill_contract', 'dc_claim_milestone'].includes(call.name)));
    console.log('PASS Deep Claim company goals, honest return reports and ordinary next-shift drafts');
  } finally { await context.close(); }
}

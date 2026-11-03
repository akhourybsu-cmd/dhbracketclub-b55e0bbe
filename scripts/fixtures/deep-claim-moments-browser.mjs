// Real paid crews, cargo transfers and building upgrades. Presentation is never
// replayed with fabricated records; each viewport earns its own operation.
export async function runDeepClaimMomentsBrowser(h) {
  const { expect, checked, fit, shot, assert } = h;
  const total = resources => Object.values(resources ?? {}).reduce((sum, value) => sum + value, 0);
  const steps = ['travel', 'setup', 'work', 'haul', 'return'];
  for (const [index, [width, height, theme, motion]] of h.visualCases.entries()) {
    const label = `${width}x${height}-${theme}-${motion}`;
    const { context, page } = await h.setup(width, height, theme, motion, { runtimeProbe: true, isMobile: width < 900 });
    const current = () => h.rpc(page, 'dc_get');
    const diagnostic = () => page.evaluate(() => window.deepClaimRuntime.samples.at(-1) ?? null);
    try {
      const initial = await h.found(page, { run: `game-moments-${index}`, theme });
      const plan = await h.intro(page, { confirm: false });
      await expect(page.locator('[data-dc-departure]')).toHaveCount(0);
      checked(`moments-${label}-preview-is-not-a-departure`, (await current()).expeditions.length === 0);

      // Capture the real finite presentation atomically as soon as it appears.
      // Its 900/1800ms clock is left untouched, including on a busy device.
      const departed = page.waitForFunction(() => {
        const node = document.querySelector('[data-dc-departure]');
        if (!(node instanceof HTMLElement) || !node.getBoundingClientRect().width) return false;
        return { id: node.dataset.dcDeparture, stage: node.dataset.dcDepartureStage, text: node.innerText,
          crew: [...node.querySelectorAll('[role="img"][aria-label]')].map(image => image.getAttribute('aria-label')) };
      }, undefined, { timeout: 15000 }).then(handle => handle.jsonValue());
      await Promise.all([plan.getByRole('button', { name: 'Dispatch crew', exact: true }).click(), departed]);
      await expect(plan).toHaveCount(0);
      const commission = await departed;
      let snapshot = await current();
      const job = snapshot.expeditions.find(item => item.status === 'active');
      assert.ok(job?.tutorial, 'Moments must follow the real once-per-company induction');
      const crew = snapshot.workers.filter(worker => job.worker_ids.includes(worker.id));
      checked(`moments-${label}-departure-belongs-to-the-confirmed-paid-crew`, commission.id === job.id
        && commission.text.includes('Shift underway') && commission.text.includes('30s')
        && crew.every(worker => commission.crew.includes(worker.name))
        && commission.crew.length === crew.length && snapshot.company.cash === initial.company.cash - job.wages
        && snapshot.workers.every(worker => worker.energy === 5) && total(snapshot.resources) === 0, commission);
      const dismiss = page.getByRole('button', { name: 'Dismiss departure', exact: true });
      if (await dismiss.isVisible()) {
        // Auto-dismiss can legitimately win this race. Only tolerate that exact
        // disappearance; a still-visible, broken dismissal remains a failure.
        try { await dismiss.click({ timeout: 750 }); }
        catch (error) { if (await dismiss.isVisible()) throw error; }
      }
      await expect(page.locator('[data-dc-departure]')).toHaveCount(0);

      const card = page.locator(`[data-dc-expedition="${job.id}"]`);
      await expect(card).toHaveAttribute('data-operation-state', 'active');
      await expect(card.getByRole('button', { name: 'Open haul', exact: true })).toHaveCount(0);
      for (const worker of crew) await expect(card.getByRole('img', { name: worker.name, exact: true })).toBeVisible();
      const stage = await card.getAttribute('data-dc-operation-stage');
      const pips = await card.locator('[data-dc-stage]').evaluateAll(nodes => nodes.map(node => ({ key: node.getAttribute('data-dc-stage'), current: node.getAttribute('aria-current') })));
      checked(`moments-${label}-deck-shows-the-stored-stage-and-actual-crew`, pips.map(item => item.key).join(':') === steps.join(':')
        && pips.filter(item => item.current === 'step').length === 1 && pips.find(item => item.current === 'step')?.key === stage
        && job.worker_ids.length === crew.length, { stage, pips });
      const beforeFocus = (await diagnostic())?.observed_at ?? 0;
      await card.getByRole('button', { name: 'Follow crew', exact: true }).click();
      await expect(page.getByRole('tab', { name: 'Mine', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('deep-claim-map')).toHaveAttribute('data-dc-view', 'mine');
      await expect.poll(async () => (await diagnostic())?.observed_at ?? 0).toBeGreaterThan(beforeFocus);
      const camera = (await diagnostic())?.camera;
      checked(`moments-${label}-following-stays-in-the-disclosed-shallow-operation`, Number.isFinite(camera?.x)
        && Number.isFinite(camera?.y) && camera.x >= 0 && camera.x <= snapshot.world.width && camera.y <= 16, camera);
      await fit(page, `moments-${label}-active-crew`); await shot(page, `moments-${label}-active-crew`);
      await h.tab(page, 'Surface');

      await h.command(page, 'advance_job', { job_id: job.id, seconds: job.duration_seconds + 1 });
      await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
      await expect(card).toHaveAttribute('data-operation-state', 'ready');
      await expect(card.getByRole('button', { name: 'View worksite', exact: true })).toBeVisible();
      await card.getByRole('button', { name: 'Open haul', exact: true }).click();
      snapshot = await current();
      const returned = snapshot.expeditions.find(item => item.id === job.id);
      assert.equal(returned.status, 'ready'); assert.equal(total(returned.cargo), 22);
      checked(`moments-${label}-return-is-staged-before-collection`, total(snapshot.resources) === 0
        && returned.cargo.coal === 10 && returned.cargo.stone === 12);
      await page.getByRole('dialog', { name: 'The haul is home', exact: true }).getByRole('button', { name: 'Collect into storage', exact: true }).click();
      const receipt = page.getByRole('dialog', { name: 'Haul secured.', exact: true }); await expect(receipt).toBeVisible();
      await expect(receipt.locator('[data-dc-reward-receipt]')).toHaveAttribute('data-dc-reward-kind', 'cargo');
      for (const [resource, quantity] of Object.entries(returned.cargo)) {
        await expect(receipt.locator(`[data-dc-reward-resource="${resource}"] strong`)).toHaveText(quantity.toLocaleString());
      }
      await expect(receipt.getByRole('button', { name: 'Plan next shift', exact: true })).toBeVisible();
      await receipt.getByRole('button', { name: 'Back to the claim', exact: true }).focus();
      await expect(receipt.getByRole('button', { name: 'Back to the claim', exact: true })).toBeFocused();
      await fit(page, `moments-${label}-haul-receipt`); await shot(page, `moments-${label}-haul-receipt`);
      snapshot = await current();
      checked(`moments-${label}-ceremony-contains-only-the-actual-transfer`, snapshot.resources.coal === 10 && snapshot.resources.stone === 12
        && snapshot.company.warehouse_used === 22 && snapshot.expeditions.find(item => item.id === job.id).status === 'collected'
        && snapshot.company.cash === initial.company.cash - job.wages);
      await h.closeReward(page);

      const beforeUpgrade = await current(), beforeBuilding = beforeUpgrade.buildings.find(item => item.key === 'warehouse');
      assert.equal(beforeBuilding.level, 1); assert.equal(beforeBuilding.upgrade_cost, 60);
      await page.getByRole('button', { name: 'Open camp buildings', exact: true }).click();
      await page.getByRole('dialog', { name: 'Buildings', exact: true }).getByRole('button', { name: /Warehouse/ }).click();
      const review = page.getByRole('dialog', { name: 'Warehouse', exact: true });
      await expect(review.getByRole('button', { name: 'Confirm upgrade', exact: true })).toBeEnabled();
      await review.getByRole('button', { name: 'Confirm upgrade', exact: true }).click();
      const improved = page.getByRole('dialog', { name: 'Warehouse upgraded.', exact: true }); await expect(improved).toBeVisible();
      const change = improved.locator('[data-dc-building-change="warehouse"]');
      await expect(change).toHaveAttribute('data-from-level', '1'); await expect(change).toHaveAttribute('data-to-level', '2');
      await expect(change.locator('[data-dc-building-portrait="warehouse"][data-level="1"]')).toBeVisible();
      await expect(change.locator('[data-dc-building-portrait="warehouse"][data-level="2"]')).toBeVisible();
      const upgraded = await current(), owned = upgraded.buildings.find(item => item.key === 'warehouse');
      await expect(change).toContainText(owned.effect);
      checked(`moments-${label}-building-ceremony-matches-the-confirmed-owned-upgrade`, owned.level === 2
        && upgraded.company.cash === beforeUpgrade.company.cash - beforeBuilding.upgrade_cost
        && upgraded.company.warehouse_capacity === 240 && upgraded.company.warehouse_used === 22
        && upgraded.resources.coal === 10 && upgraded.resources.stone === 12);
      await fit(page, `moments-${label}-building-receipt`); await shot(page, `moments-${label}-building-receipt`);
      await h.closeReward(page);
      const calls = await h.command(page, 'calls');
      checked(`moments-${label}-visual-actions-never-duplicate-economic-actions`, calls.filter(call => call.name === 'dc_bootstrap').length === 1
        && calls.filter(call => call.name === 'dc_dispatch_operation').length === 1
        && calls.filter(call => call.name === 'dc_collect').length === 1
        && calls.filter(call => call.name === 'dc_upgrade').length === 1
        && !calls.some(call => ['dc_sell', 'dc_start_production', 'dc_start_research', 'dc_fulfill_contract', 'dc_claim_milestone'].includes(call.name)));
      console.log(`PASS Deep Claim real game moments ${label}`);
    } finally { await context.close(); }
  }
}

// The four operation intents use the same actual planner and server quotes.
// These checks inspect unpaid plans only; no company resources are fabricated.
export async function runDeepClaimOperationsBrowser(h, run) {
  const { assert, checked, expect, fit, shot } = h;
  const modes = [
    { id: 'explore', name: 'Expand tunnels', payoff: /new|reveal|tunnel/i },
    { id: 'extract', name: 'Mine a deposit', payoff: /materials|seam|ore|resource|deposit|haul/i },
    { id: 'survey', name: 'Scout the area', payoff: /map|reveal|scout/i },
    { id: 'infrastructure', name: 'Improve the mine', payoff: /protection|future|route|safer|mine/i },
  ];
  const economic = snapshot => ({ company: snapshot.company, workers: snapshot.workers, resources: snapshot.resources,
    buildings: snapshot.buildings, expeditions: snapshot.expeditions, equipment: snapshot.equipment,
    production: snapshot.production_jobs, world: snapshot.world, discoveries: snapshot.discoveries, business: snapshot.business });

  for (const [width, height, theme, motion] of h.visualCases) {
    const { context, page } = await h.setup(width, height, theme, motion);
    const label = `${width}x${height}-${theme}-${motion}`;
    try {
      await h.go(page, { run, theme });
      const before = economic(await h.rpc(page, 'dc_get'));
      await h.tab(page, 'Mine');
      await page.getByRole('button', { name: 'Open mine operations', exact: true }).click();
      const operations = page.getByRole('dialog', { name: 'Underground operations', exact: true });
      const launcher = operations.getByRole('group', { name: 'Expedition type', exact: true });
      await expect(launcher.locator('[data-dc-operation]')).toHaveCount(4);
      await expect(launcher.getByRole('group', { name: 'Mining', exact: true })).toBeVisible();
      await expect(launcher.getByRole('group', { name: 'Planning & improvements', exact: true })).toBeVisible();
      const payoffs = [];
      for (const mode of modes) {
        const choice = launcher.locator(`[data-dc-operation="${mode.id}"]`);
        await expect(choice).toHaveAccessibleName(mode.name);
        await expect(choice).toBeVisible();
        await expect(choice.locator('[data-dc-operation-art]')).toHaveAttribute('data-dc-operation-art', mode.id);
        const outcome = choice.locator('.dcl-intent-outcome');
        await expect(outcome).toBeVisible();
        await expect(outcome).toContainText(mode.payoff);
        await expect(choice).toHaveAccessibleDescription(mode.payoff);
        const payoff = (await outcome.innerText()).trim();
        assert.ok(payoff.length >= 12, `${mode.name} needs a useful payoff beyond its title`);
        payoffs.push(payoff);
      }
      assert.equal(new Set(payoffs).size, 4, 'The four choices must explain distinct purposes');
      await expect(launcher.locator('[data-dc-operation="survey"]')).toContainText(/no cargo/i);
      const reachable = await launcher.locator('[data-dc-operation]').evaluateAll(buttons => buttons.map(button => {
        const box = button.getBoundingClientRect(), dialog = button.closest('[role="dialog"]').getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return { mode: button.getAttribute('data-dc-operation'), width: box.width, height: box.height,
          visible: box.left >= Math.max(0, dialog.left) && box.right <= Math.min(innerWidth, dialog.right)
            && box.top >= Math.max(0, dialog.top) && box.bottom <= Math.min(innerHeight, dialog.bottom),
          reachable: !!hit && (hit === button || button.contains(hit)) };
      }));
      checked(`operations-launcher-four-actions-fit-and-remain-reachable-${label}`,
        reachable.length === 4 && reachable.every(choice => choice.visible && choice.reachable && choice.width >= 44 && choice.height >= 44), reachable);
      await fit(page, `operations-launcher-${label}`); await shot(page, `operations-launcher-${label}`);
      checked(`operations-four-distinct-intents-and-payoffs-${label}`, true);

      // Keyboard users enter the same Scout plan as a touch/pointer user.
      const scout = launcher.locator('[data-dc-operation="survey"]');
      await scout.focus(); await page.keyboard.press('Space');
      const planner = page.getByRole('dialog', { name: 'Scout the area', exact: true });
      await expect(planner).toBeVisible();
      let picker = planner.getByRole('group', { name: 'Expedition type', exact: true });
      await expect(picker.locator('[data-dc-operation="survey"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(picker.locator('[data-dc-operation][aria-pressed="true"]')).toHaveCount(1);
      await expect(picker.locator('[data-dc-operation="survey"] .dcl-intent-outcome')).toBeVisible();
      await expect(picker.locator('[data-dc-operation="survey"] .dcl-intent-outcome')).toContainText(/map only.*no cargo/i);
      let advice = planner.locator('[data-dc-operation-advice]');
      await expect(advice).toHaveAttribute('role', 'status');
      // With no map target supplied, the real public frontier in this earned
      // save has a useful Scout site. Do not silently default to surveyed ground.
      await expect(advice.locator('strong')).toHaveText(/^Up to [1-9]\d* new tiles?$/);
      await expect(advice).toContainText(/no cargo/i);
      await expect(advice).toContainText(/map|reveal|ground|deposit/i);
      checked(`operations-default-scout-selects-useful-unseen-ground-${label}`, true);
      await fit(page, `operations-scout-${label}`); await shot(page, `operations-scout-${label}`);
      checked(`operations-scout-is-clearly-map-only-and-keyboard-operable-${label}`, true);

      // Changing intent updates the very same open planner, with exactly one
      // selected choice. No hidden acceptance or additional dispatch occurs.
      await picker.locator('[data-dc-operation="extract"]').focus();
      await page.keyboard.press('Enter');
      const extraction = page.getByRole('dialog', { name: 'Mine a deposit', exact: true });
      await expect(extraction).toBeVisible();
      picker = extraction.getByRole('group', { name: 'Expedition type', exact: true });
      await expect(picker.locator('[data-dc-operation="extract"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(picker.locator('[data-dc-operation][aria-pressed="true"]')).toHaveCount(1);
      await picker.locator('[data-dc-operation="explore"]').click();
      const expansion = page.getByRole('dialog', { name: 'Expand tunnels', exact: true });
      await expect(expansion).toBeVisible();
      await expect(expansion.getByRole('group', { name: 'Expedition type', exact: true }).locator('[data-dc-operation="explore"]')).toHaveAttribute('aria-pressed', 'true');
      checked(`operations-mining-modes-have-clear-selected-state-${label}`, true);
      await h.clearDialogs(page);

      // An explicitly selected known passage is different from a default. It
      // must remain selected and truthfully warn when nothing new is in reach.
      const knownScout = await h.operationPlan(page, 'survey', { x: 48, y: 1, review: false });
      const selectedScoutSite = knownScout.getByRole('group', { name: 'Expedition worksite', exact: true }).locator('[data-dc-worksite="48:1"]');
      await expect(selectedScoutSite).toHaveAttribute('aria-pressed', 'true');
      await expect(knownScout.getByRole('group', { name: 'Expedition type', exact: true }).locator('[data-dc-operation="survey"] .dcl-intent-outcome')).toContainText(/map only.*no cargo/i);
      const knownAdvice = knownScout.locator('[data-dc-operation-advice]');
      const knownHeading = (await knownAdvice.locator('strong').innerText()).trim();
      if (knownHeading === 'Already surveyed') {
        await expect(knownAdvice).toHaveAttribute('data-tone', 'caution');
        await expect(knownAdvice).toContainText(/nothing new|another site|wider survey/i);
      } else {
        assert.match(knownHeading, /^Up to [1-9]\d* new tiles?$/);
        await expect(knownAdvice).toContainText(/no cargo/i);
      }
      checked(`operations-explicit-scout-site-keeps-selection-and-honest-advice-${label}`, true);
      await fit(page, `operations-scout-known-ground-${label}`); await shot(page, `operations-scout-known-ground-${label}`);
      await h.clearDialogs(page);

      const improvement = await h.operationPlan(page, 'infrastructure', { x: 48, y: 1, infrastructure: 'pump', review: false });
      await expect(improvement).toHaveAccessibleName('Improve the mine');
      const pump = improvement.getByRole('group', { name: 'Infrastructure project', exact: true }).locator('[data-dc-project="pump"]');
      await expect(pump).toHaveAttribute('aria-pressed', 'true');
      advice = improvement.locator('[data-dc-operation-advice]');
      await expect(advice).toContainText(/no water|too shallow|future/i);
      await expect(advice).toContainText(/no (?:current |immediate )?benefit|no water|not (?:needed|useful)|too shallow/i);
      await fit(page, `operations-shallow-pump-${label}`); await shot(page, `operations-shallow-pump-${label}`);
      checked(`operations-shallow-pump-explains-no-current-benefit-${label}`, true);
      await h.clearDialogs(page);

      assert.deepEqual(economic(await h.rpc(page, 'dc_get')), before,
        'Inspecting purposes, changing modes and reviewing shallow equipment must never spend resources or dispatch a crew');
      checked(`operations-intent-inspection-is-economically-read-only-${label}`, true);
    } finally { await context.close(); }
  }
}

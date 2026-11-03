// Review the specimen earned by field() through genuine finite mining. Every
// layout shares that saved company; this helper never seeds stock or finds.
export async function runDeepClaimFindFooterBrowser(h, run, find) {
  const { assert, expect, checked, fit, shot } = h;
  const cases = [[320,568,'dark'],[320,568,'light'],[844,390,'dark'],[844,390,'light']];
  const total = resources => Object.values(resources).reduce((sum, amount) => sum + amount, 0);
  const economic = snapshot => ({ company: snapshot.company, resources: snapshot.resources,
    workers: snapshot.workers, expeditions: snapshot.expeditions, buildings: snapshot.buildings,
    equipment: snapshot.equipment, production: snapshot.production_jobs, business: snapshot.business,
    world: snapshot.world, infrastructure: snapshot.infrastructure, discoveries: snapshot.discoveries,
    discovery_summary: snapshot.discovery_summary, field_reports: snapshot.field_reports });
  const resolutions = async page => (await h.command(page, 'calls')).filter(call => call.name === 'dc_resolve_discovery');
  async function openFind(page) {
    await h.tab(page, 'Log');
    await page.getByRole('group', { name: 'Field log views', exact: true }).getByRole('button', { name: /^Finds/ }).click();
    await page.getByRole('group', { name: 'Find collection', exact: true }).getByRole('button', { name: 'Pending', exact: true }).click();
    await page.locator(`[data-dc-find="${find.id}"]`).click();
    return page.getByRole('dialog', { name: find.name, exact: true });
  }
  async function footerReachable(dialog, label) {
    // Include the disabled initial confirmation: fit() ordinarily examines
    // enabled commands only, but every footer state must retain its footprint.
    const buttons = await dialog.locator('.dcl-dialog-fixed-footer .dcl-dialog-actions button').evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect(), panel = node.closest('[role="dialog"]').getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { name: node.textContent.trim(), width: box.width, height: box.height,
        visible: box.left >= Math.max(0, panel.left) - 1 && box.right <= Math.min(innerWidth, panel.right) + 1
          && box.top >= Math.max(0, panel.top) - 1 && box.bottom <= Math.min(innerHeight, panel.bottom) + 1,
        reachable: !!hit && (hit === node || node.contains(hit)) };
    }));
    checked(`field-footer-two-reachable-commands-${label}`, buttons.length === 2
      && buttons.every(button => button.width >= 43.5 && button.height >= 43.5 && button.visible && button.reachable), buttons);
  }
  const peer = await h.setup();
  try {
    await h.go(peer.page, { run });
    for (const [width, height, theme] of cases) {
      const client = await h.setup(width, height, theme), { page } = client;
      const label = `${width}x${height}-${theme}`;
      try {
        await h.go(page, { run, theme });
        const before = await h.rpc(page, 'dc_get'), start = (await resolutions(page)).length;
        const salvageUnits = total(find.salvage), room = before.company.warehouse_capacity - before.company.warehouse_used;
        assert.ok(salvageUnits <= room, 'The naturally earned field company has room for the complete frozen salvage');
        let dialog = await openFind(page);
        const summary = dialog.getByRole('group', { name: 'Transaction summary', exact: true });
        const details = dialog.getByRole('region', { name: `${find.name} details`, exact: true });
        await expect(dialog.getByRole('button', { name: 'Confirm decision', exact: true })).toBeDisabled();
        await expect(summary).toContainText('Choose an option');
        await footerReachable(dialog, `${label}-initial`);
        for (const option of [
          { button: /^Keep in cabinet/, confirm: 'Confirm keep', summary: 'Keep' },
          { button: /^Sell specimen/, confirm: 'Confirm sale', summary: `${find.sale_value} cr` },
          { button: /^Salvage materials/, confirm: 'Confirm salvage', summary: `${salvageUnits} ${salvageUnits === 1 ? 'unit' : 'units'}` },
        ]) {
          const choice = dialog.getByRole('group', { name: 'Find decision', exact: true }).getByRole('button', { name: option.button });
          await choice.focus(); await choice.press('Space');
          await expect(choice).toHaveAttribute('aria-pressed', 'true');
          await expect(dialog.getByRole('button', { name: option.confirm, exact: true })).toBeEnabled();
          await expect(summary).toContainText('Final choice'); await expect(summary).toContainText(option.summary);
          const review = dialog.getByRole('region', { name: 'Reviewed find decision', exact: true });
          await expect(review).toContainText('This decision is final.');
          if (option.confirm === 'Confirm salvage') {
            await expect(review).toContainText(`Needs ${salvageUnits} free units · ${room} available. All materials must fit together.`);
            assert.deepEqual(await review.locator('.dcl-material-costs b').allTextContents(), Object.values(find.salvage).map(String));
          }
          await details.focus(); await page.keyboard.press('Home');
          await expect.poll(() => details.evaluate(node => node.scrollTop)).toBe(0);
          await footerReachable(dialog, `${label}-${option.confirm.replace('Confirm ', '')}-top`);
          await page.keyboard.press('End');
          const overflow = await details.evaluate(node => ({ scrollable: node.scrollHeight > node.clientHeight + 2, top: node.scrollTop }));
          if (overflow.scrollable) await expect.poll(() => details.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
          await footerReachable(dialog, `${label}-${option.confirm.replace('Confirm ', '')}-bottom`);
          await fit(page, `field-footer-${label}-${option.confirm.replace('Confirm ', '')}`);
          await shot(page, `field-footer-${label}-${option.confirm.replace('Confirm ', '')}`);
        }
        await dialog.getByRole('button', { name: 'Back to finds', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        dialog = await openFind(page);
        await expect(dialog.getByRole('button', { name: 'Confirm decision', exact: true })).toBeDisabled();
        await expect(dialog.getByRole('region', { name: 'Reviewed find decision', exact: true })).toHaveCount(0);
        assert.deepEqual(economic(await h.rpc(page, 'dc_get')), economic(before));
        checked(`field-review-scroll-back-and-reopen-never-change-company-${label}`, (await resolutions(page)).length === start);

        // A different device sells one unit of actually owned Coal. Refresh the
        // existing foreground query without closing/reopening its unpaid draft.
        const salvage = dialog.getByRole('group', { name: 'Find decision', exact: true }).getByRole('button', { name: /^Salvage materials/ });
        await salvage.click();
        await expect(dialog.getByRole('button', { name: 'Confirm salvage', exact: true })).toBeEnabled();
        await h.go(peer.page, { run });
        const coalPrice = await peer.page.evaluate(async () => {
          const { RESOURCE_BY_ID } = await import('/src/lib/deepClaim/catalog.ts');
          return RESOURCE_BY_ID.coal.sell_price;
        });
        await h.sale(peer.page, 'Coal', 1);
        const afterTrade = await h.rpc(peer.page, 'dc_get');
        checked(`field-stale-review-comes-from-one-real-other-device-sale-${label}`,
          afterTrade.revision === before.revision + 1 && afterTrade.resources.coal === before.resources.coal - 1
            && afterTrade.company.cash === before.company.cash + coalPrice
            && afterTrade.company.warehouse_used === before.company.warehouse_used - 1
            && JSON.stringify(afterTrade.discoveries) === JSON.stringify(before.discoveries));
        await page.evaluate(() => window.deepClaimQueryClient.refetchQueries({ queryKey: ['deep-claim'], type: 'active' }));
        await expect(dialog.getByRole('group', { name: 'Transaction summary', exact: true })).toContainText('Company changed. Choose again.');
        await expect(dialog.getByRole('button', { name: 'Confirm salvage', exact: true })).toBeDisabled();
        await footerReachable(dialog, `${label}-stale`);
        await fit(page, `field-stale-${label}`); await shot(page, `field-stale-${label}`);
        await salvage.focus(); await salvage.press('Space');
        await expect(dialog.getByRole('button', { name: 'Confirm salvage', exact: true })).toBeEnabled();
        await expect(dialog.getByRole('region', { name: 'Reviewed find decision', exact: true }))
          .toContainText(`Needs ${salvageUnits} free units · ${room + 1} available. All materials must fit together.`);
        checked(`field-other-device-change-requires-the-current-find-review-${label}`, (await resolutions(page)).length === start);
        await dialog.getByRole('button', { name: 'Back to finds', exact: true }).click();
        assert.deepEqual(economic(await h.rpc(page, 'dc_get')), economic(afterTrade));
        checked(`field-stale-review-and-reselection-never-resolve-the-find-${label}`, true);
      } catch (error) {
        // The outer runner cannot inspect a context after its finally closes
        // it. Evidence is bounded and must never replace the original failure.
        try {
          const evidence = await page.evaluate(() => {
            const rect = node => {
              if (!node) return null;
              const box = node.getBoundingClientRect();
              return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
            };
            const dialog = document.querySelector('.dcl-discovery-dialog'), body = dialog?.querySelector('.dcl-dialog-scroll-body');
            const footer = dialog?.querySelector('.dcl-dialog-fixed-footer');
            return { viewport: { width: innerWidth, height: innerHeight }, scene: rect(document.querySelector('.dcl-scene')),
              dialog: rect(dialog), body: { rect: rect(body), scrollTop: body?.scrollTop, scrollHeight: body?.scrollHeight,
                clientHeight: body?.clientHeight, text: body?.textContent?.slice(0, 2500) },
              footer: { rect: rect(footer), text: footer?.textContent?.slice(0, 500), buttons: [...(footer?.querySelectorAll('button') ?? [])].slice(0, 4)
                .map(button => ({ text: button.textContent?.slice(0, 120), disabled: button.disabled, rect: rect(button) })) },
              text: document.body.innerText.slice(0, 6000) };
          });
          checked(`field-footer-failure-evidence-${label}`, true, evidence);
        } catch { /* Preserve the original scenario failure. */ }
        try { await shot(page, `field-footer-failure-${label}`); }
        catch { /* Preserve the original scenario failure if capture fails. */ }
        throw error;
      } finally { await client.context.close(); }
    }
  } finally { await peer.context.close(); }
}

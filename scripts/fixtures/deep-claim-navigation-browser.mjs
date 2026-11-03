// Navigation-only verification against the real game and isolated SQL. Every
// ledger record below comes from an actual paid/collected operation.
export async function runDeepClaimNavigationBrowser(h) {
  const { assert, expect, checked, fit, shot } = h;
  const run = 'ledger-and-mine-navigation';
  const economic = snapshot => ({ company: snapshot.company, resources: snapshot.resources,
    workers: snapshot.workers, expeditions: snapshot.expeditions, buildings: snapshot.buildings,
    equipment: snapshot.equipment, production: snapshot.production_jobs, business: snapshot.business,
    world: snapshot.world, discoveries: snapshot.discoveries });
  let client = await h.setup();
  let original;
  try {
    await h.found(client.page, { run });
    await h.intro(client.page);
    let snapshot = await h.rpc(client.page, 'dc_get');
    const shift = snapshot.expeditions.find(job => job.status === 'active');
    assert.ok(shift?.tutorial);
    await h.command(client.page, 'advance_job', { job_id: shift.id, seconds: 31 });
    await client.page.getByRole('button', { name: 'Refresh company', exact: true }).click();
    await client.page.getByRole('button', { name: 'Open haul', exact: true }).click();
    await client.page.getByRole('button', { name: 'Collect into storage', exact: true }).click();
    await h.closeReward(client.page);
    for (let sale = 0; sale < 7; sale++) await h.sale(client.page, 'Coal', 1);
    snapshot = await h.rpc(client.page, 'dc_get');
    assert.ok(snapshot.log.length > 6);
    assert.equal(snapshot.log.filter(entry => entry.kind === 'sold').length, 7);
    original = economic(snapshot);
    checked('navigation-ledger-records-come-from-real-finite-haul-and-seven-sales', true);
  } finally { await client.context.close(); }

  for (const [width, height, theme, motion] of h.visualCases) {
    client = await h.setup(width, height, theme, motion, { runtimeProbe: true });
    const { page } = client, label = `${width}x${height}-${theme}-${motion}`;
    try {
      await h.go(page, { run, theme });
      await h.tab(page, 'Log');
      await page.getByRole('group', { name: 'Field log views', exact: true }).getByRole('button', { name: 'Ledger', exact: true }).click();
      const ledger = page.getByRole('region', { name: 'Company ledger', exact: true });
      const activity = ledger.getByRole('list', { name: 'Recent activity', exact: true });
      await expect(activity.getByRole('listitem')).toHaveCount(6);
      const categories = ledger.getByRole('group', { name: 'Activity category', exact: true });
      const trade = categories.getByRole('button', { name: /^Trade/ });
      await trade.focus(); await page.keyboard.press('Space');
      await expect(trade).toHaveAttribute('aria-pressed', 'true');
      await expect(activity.getByRole('listitem')).toHaveCount(6);
      assert.ok((await activity.getByRole('listitem').allTextContents()).every(text => text.includes('units sold')));
      await ledger.getByRole('button', { name: 'Next activity', exact: true }).click();
      await expect(activity.getByRole('listitem')).toHaveCount(1);
      await expect(ledger.getByRole('button', { name: 'Next activity', exact: true })).toBeDisabled();
      await categories.getByRole('button', { name: /^Crew/ }).click();
      await expect(ledger.getByRole('heading', { name: 'No crew activity', exact: true })).toBeVisible();
      await categories.getByRole('button', { name: /^All/ }).click();
      await expect(activity.getByRole('listitem')).toHaveCount(6);
      checked(`navigation-ledger-filter-pagination-and-keyboard-${label}`, true);
      await fit(page, `navigation-ledger-${label}`); await shot(page, `navigation-ledger-${label}`);

      await h.tab(page, 'Surface');
      await page.getByRole('button', { name: 'Focus surface buildings', exact: true }).click();
      await h.settle(page);
      const framed = await page.evaluate(async () => {
        const sample = window.deepClaimRuntime.samples.at(-1);
        const { BUILDING_ART } = await import('/src/components/deepClaim/renderer/artManifest.ts');
        const response = await window.deepClaimQa.rpc('dc_get', {});
        const { camera, viewport } = sample;
        return response.data.buildings.filter(building => building.level > 0).map(building => {
          const art = BUILDING_ART[building.key];
          const point = (x, y) => ({ x: viewport.width / 2 + (x - camera.x) * camera.scale,
            y: viewport.height / 2 + (y - camera.y) * camera.scale });
          return { key: building.key, first: point(art.x, art.y), last: point(art.x + art.width, 0),
            width: viewport.width, height: viewport.height };
        });
      });
      checked(`navigation-surface-buildings-fit-both-axes-${label}`, framed.length > 0 && framed.every(item =>
        item.first.x >= -1 && item.first.y >= -1 && item.last.x <= item.width + 1 && item.last.y <= item.height + 1), framed);
      await fit(page, `navigation-surface-${label}`); await shot(page, `navigation-surface-${label}`);

      // Native touch events exercise the actual pointer handlers. A fixed-size
      // two-finger translation must keep the same mine point under the fingers.
      await h.tab(page, 'Mine');
      const canvas = page.getByTestId('deep-claim-canvas');
      await canvas.focus();
      for (let step = 0; step < 20; step++) await page.keyboard.press('ArrowDown');
      await h.settle(page);
      const box = await canvas.boundingBox(); assert.ok(box);
      const before = await page.evaluate(() => window.deepClaimRuntime.samples.at(-1).camera);
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const touch = await client.context.newCDPSession(page);
      try {
        const points = (dx, dy) => [{ id: 1, x: center.x - 30 + dx, y: center.y + dy }, { id: 2, x: center.x + 30 + dx, y: center.y + dy }];
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0, 0) });
        for (let step = 1; step <= 4; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(step * 5, step * 2) });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally { await touch.detach(); }
      await h.settle(page);
      const after = await page.evaluate(() => window.deepClaimRuntime.samples.at(-1).camera);
      const under = { x: after.x + 20 / after.scale, y: after.y + 8 / after.scale };
      checked(`navigation-two-finger-translation-keeps-anchor-${label}`,
        Math.abs(under.x - before.x) < .12 && Math.abs(under.y - before.y) < .12 && Math.abs(after.scale - before.scale) < .1,
        { before, after, under });
      await expect(page.getByRole('dialog')).toHaveCount(0);
      assert.deepEqual(economic(await h.rpc(page, 'dc_get')), original, 'Browsing the ledger and moving the camera must never change company state');
      checked(`navigation-inspection-preserves-authoritative-state-${label}`, true);
    } finally { await client.context.close(); }
  }
}

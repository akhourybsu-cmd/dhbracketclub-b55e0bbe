// Phase5 production UI against the existing isolated, real-SQL browser fixture.
// Test commands select legal finite sources or advance already-paid clocks only.
// No companies, balances, terrain, energy or contribution records are fabricated.

export async function runPhase5Browser(h) {
  const { expect, assert, checked, fit, shot, actors } = h;
  const metrics = { p_metric: 'weekly_mining_value', p_page: 0 };
  const shared = page => h.rpc(page, 'dc_get_club', metrics);
  async function idle(page) {
    await expect.poll(() => page.evaluate(() => window.deepClaimQueryClient.isFetching()), { timeout: 15000 }).toBe(0);
  }
  async function club(page, view = 'Projects') {
    await page.bringToFront();
    const office = await h.officeView(page, 'Club');
    await expect(office.getByRole('group', { name: 'Club office views', exact: true })).toBeVisible();
    await idle(page);
    await office.getByRole('group', { name: 'Club office views', exact: true }).getByRole('button', { name: 'Projects', exact: true }).click();
    await office.getByRole('button', { name: 'Refresh club projects', exact: true }).click(); await idle(page);
    if (view !== 'Projects') await office.getByRole('group', { name: 'Club office views', exact: true }).getByRole('button', { name: view, exact: true }).click();
    return office;
  }
  async function refreshPrivate(page) {
    await h.clearDialogs(page); await page.getByRole('button', { name: 'Refresh company', exact: true }).click(); await idle(page);
  }
  async function collectReturned(page, job) {
    await h.command(page, 'advance_job', { job_id: job.id, seconds: job.duration_seconds + 1 });
    await page.getByRole('button', { name: 'Refresh company', exact: true }).click();
    await page.getByRole('button', { name: 'Open haul', exact: true }).click();
    await page.getByRole('button', { name: 'Collect into storage', exact: true }).click(); await h.closeReward(page);
    return h.rpc(page, 'dc_get');
  }
  async function tutorial(page, options) {
    await h.found(page, options); await h.intro(page);
    const snapshot = await h.rpc(page, 'dc_get'), job = snapshot.expeditions.find(value => value.status === 'active');
    assert.ok(job?.tutorial, 'The introductory haul must come from a paid real tutorial job');
    return collectReturned(page, job);
  }
  function sampling(message) { const error = new Error(message); error.sampling = true; throw error; }
  async function earnResource(page, resource, target, maxJobs) {
    let snapshot = await h.rpc(page, 'dc_get');
    for (let count = 0; count < maxJobs && (snapshot.resources[resource] || 0) < target; count++) {
      const choice = await h.command(page, 'resource_worksite', { resource, needed: Math.max(1, target - (snapshot.resources[resource] || 0)) });
      if (!choice) sampling(`No legal finite ${resource} worksite with available crew`);
      const before = snapshot.resources[resource] || 0;
      const dialog = await h.operationPlan(page, choice.mode === 'extract' ? 'Extraction' : 'Exploration', choice.point);
      await dialog.getByRole('button', { name: 'Dispatch crew', exact: true }).click(); await expect(dialog).toHaveCount(0);
      snapshot = await h.rpc(page, 'dc_get'); const job = snapshot.expeditions.find(value => value.status === 'active');
      assert.ok(job, 'Resource work must create an actual paid expedition');
      snapshot = await collectReturned(page, job);
      checked(`social-earned-${resource}-${snapshot.company.user_id}-${count}`, (snapshot.resources[resource] || 0) > before, { job_id: job.id, target: choice.point });
    }
    if ((snapshot.resources[resource] || 0) < target) sampling(`Legal ${resource} jobs did not meet the bounded earned-stock plan`);
    return snapshot;
  }
  async function sharing(page, { listed, published, findId } = {}) {
    const office = await club(page);
    await office.getByRole('button', { name: 'Sharing preferences', exact: true }).click();
    const rank = office.getByRole('checkbox', { name: 'List my company in standings', exact: true });
    const showcase = office.getByRole('checkbox', { name: 'Publish my selected specimens', exact: true });
    if (listed !== undefined) await rank.setChecked(listed);
    if (published !== undefined) await showcase.setChecked(published);
    if (findId) await office.locator(`[data-owned-find-id="${findId}"]`).getByRole('checkbox').check();
    await office.getByRole('button', { name: 'Review sharing', exact: true }).click();
    await office.getByRole('button', { name: 'Confirm sharing preferences', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Sharing updated.', exact: true })).toBeVisible(); await h.closeReward(page);
    return shared(page);
  }
  async function projectReview(page, quantities) {
    const office = await club(page);
    await office.getByRole('button', { name: 'Review project Camp Supply', exact: true }).click();
    if (quantities) {
      for (const [resource, quantity] of Object.entries(quantities)) {
        const name = resource === 'stone' ? 'Stone' : resource === 'coal' ? 'Coal' : 'Clay';
        await office.getByRole('spinbutton', { name: `${name} contribution`, exact: true }).fill(String(quantity));
      }
      await office.getByRole('button', { name: 'Review contribution', exact: true }).click();
      await expect(office.getByRole('button', { name: 'Confirm contribution', exact: true })).toBeEnabled();
    }
    return office;
  }
  const visuals = [[320, 568, 'dark', 'no-preference'], [390, 844, 'light', 'no-preference'], [844, 390, 'dark', 'no-preference'], [1440, 900, 'light', 'no-preference'], [390, 844, 'dark', 'reduce']];
  for (const [index, [width, height, theme, motion]] of visuals.entries()) {
    if (process.env.DEEP_CLAIM_QA_SOCIAL_VIEWPORT && process.env.DEEP_CLAIM_QA_SOCIAL_VIEWPORT !== `${width}x${height}`) continue;
    const { context, page } = await h.setup(width, height, theme, motion);
    try {
      const run = `social-presentation-${index}`; await h.found(page, { run, theme, user: actors.alex });
      const initial = await shared(page);
      checked(`social-private-defaults-${index}`, !initial.own.standings_enabled && !initial.own.showcase_enabled && initial.standings.length === 0 && initial.showcases.total === 0);
      let office = await club(page);
      await fit(page, `social-${width}x${height}-${theme}-${motion}-projects`); await shot(page, `social-${index}-projects`);
      await office.getByRole('button', { name: 'Review project Camp Supply', exact: true }).click();
      checked(`social-project-review-starts-at-top-${index}`, await office.locator('.dcl-club-body').evaluate(node => node.scrollTop) < 1);
      await expect(office.getByRole('heading', { name: 'Camp Supply', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(office.getByRole('button', { name: 'Review contribution', exact: true })).toBeDisabled();
      await fit(page, `social-${index}-project-review`); await shot(page, `social-${index}-project-review`);
      office = await club(page, 'Standings'); await fit(page, `social-${index}-standings`); await shot(page, `social-${index}-standings`);
      office = await club(page, 'Showcase'); await fit(page, `social-${index}-showcase`); await shot(page, `social-${index}-showcase`);
      await office.getByRole('button', { name: 'Sharing preferences', exact: true }).click();
      checked(`social-sharing-review-starts-at-top-${index}`, await office.locator('.dcl-club-body').evaluate(node => node.scrollTop) < 1);
      await expect(office.getByRole('checkbox', { name: 'List my company in standings', exact: true })).not.toBeChecked();
      await expect(office.getByRole('checkbox', { name: 'Publish my selected specimens', exact: true })).not.toBeChecked();
      await office.getByRole('button', { name: 'Review sharing', exact: true }).click();
      await fit(page, `social-${index}-explicit-consent-review`); await shot(page, `social-${index}-explicit-consent-review`);
      const calls = await h.command(page, 'calls');
      checked(`social-preview-does-not-publish-or-donate-${index}`, !calls.some(call => ['dc_set_social_preferences', 'dc_contribute_project', 'dc_claim_project'].includes(call.name)));
      await context.close();
    } catch (error) { throw error; } // The root runner captures open failure pages.
  }

  // Allows a focused responsive recheck after all earned-play checks pass.
  if (process.env.DEEP_CLAIM_QA_SOCIAL_VISUAL_ONLY === '1') return;
  for (let attempt = 0; attempt < 24; attempt++) {
    const run = `social-earned-${attempt}`, { context, page: a } = await h.setup();
    try {
      const b = await h.pageFor(context), c = await h.pageFor(context);
      const players = [{ page: a, user: actors.alex, target: { stone: 32, coal: 16, clay: 12 } }, { page: b, user: actors.blair, target: { stone: 32, coal: 16, clay: 12 } }, { page: c, user: actors.casey, target: { stone: 16, coal: 8, clay: 6 } }];
      let keptFind;
      for (const [index, player] of players.entries()) {
        await player.page.bringToFront(); await tutorial(player.page, { run, user: player.user });
        await h.harvest(player.page, 46, 1);
        if (index === 0) {
          const quartz = await h.harvest(player.page, 47, 3);
          const recovered = quartz.discoveries.find(find => find.x === 47 && find.y === 3 && find.status === 'pending');
          assert.ok(recovered?.kind === 'banded_geode', 'The original finite quartz seam must recover its genuine geode after mining');
          await h.tab(player.page, 'Log');
          await player.page.getByRole('group', { name: 'Field log views', exact: true }).getByRole('button', { name: /^Finds/ }).click();
          await player.page.getByRole('button', { name: `Inspect ${recovered.name}`, exact: true }).filter({ hasText: 'x47 · 3m' }).click();
          await player.page.getByRole('button', { name: /^Keep in cabinet/ }).click();
          await player.page.getByRole('button', { name: 'Confirm keep', exact: true }).click(); await h.closeReward(player.page);
          keptFind = recovered;
        }
        await earnResource(player.page, 'stone', player.target.stone, index < 2 ? 2 : 1);
        if (index < 2) await earnResource(player.page, 'coal', player.target.coal, 1);
        const snapshot = await h.rpc(player.page, 'dc_get');
        checked(`social-stock-earned-from-finite-work-${index}`, Object.entries(player.target).every(([key, quantity]) => (snapshot.resources[key] || 0) >= quantity)
          && snapshot.workers.every(worker => worker.energy >= 0) && snapshot.expeditions.length <= (index === 0 ? 6 : index === 1 ? 5 : 3));
      }
      const defaults = await shared(a);
      checked('three-member-project-freezes-fair-cap-with-private-defaults', defaults.projects[0].effective_cap_percent === 40 && !defaults.own.standings_enabled && !defaults.own.showcase_enabled && defaults.standings.length === 0);
      await sharing(a, { listed: true, published: true, findId: keptFind.id }); await sharing(b, { listed: true });
      let board = await shared(a);
      checked('standings-require-explicit-consent-and-do-not-list-private-third-member', board.standings.length === 2 && new Set(board.standings.map(row => row.user_id)).size === 2 && !board.standings.some(row => row.user_id === actors.casey));
      checked('showcase-publishes-only-the-chosen-kept-specimen', board.showcases.total === 1 && board.showcases.companies[0].user_id === actors.alex && board.showcases.companies[0].specimens.length === 1
        && board.showcases.companies[0].specimens[0].name === keptFind.name && Object.keys(board.showcases.companies[0].specimens[0]).sort().join(',') === 'detail,kind,name,quality');
      let office = await club(a, 'Standings');
      const self = board.standings.find(row => row.user_id === actors.alex);
      await expect(office.getByLabel('Club standings').getByText(`${self.display_name} · You`, { exact: true })).toHaveCount(1);
      await expect(office.getByLabel('Club standings').getByRole('article')).toHaveCount(2);
      await fit(a, 'social-earned-unique-standings'); await shot(a, 'social-earned-unique-standings');
      office = await club(a, 'Showcase');
      await office.getByRole('button', { name: `View ${board.showcases.companies[0].company_name} showcase`, exact: true }).click();
      await expect(office.getByRole('heading', { name: keptFind.name, exact: true })).toBeVisible();
      await fit(a, 'social-earned-sanitized-showcase'); await shot(a, 'social-earned-sanitized-showcase');

      const beforeA = await h.rpc(a, 'dc_get'); office = await projectReview(a, players[0].target);
      await fit(a, 'social-earned-permanent-contribution-review'); await shot(a, 'social-earned-permanent-contribution-review');
      await h.command(a, 'fail_next', { name: 'dc_contribute_project', after_commit: true });
      await office.getByRole('button', { name: 'Confirm contribution', exact: true }).click(); await expect(office.getByRole('alert')).toBeVisible();
      await a.reload({ waitUntil: 'domcontentloaded' }); await expect(a.getByRole('button', { name: 'Confirm sync', exact: true })).toBeVisible();
      await a.getByRole('button', { name: 'Confirm sync', exact: true }).click(); await expect(a.getByRole('dialog', { name: 'Saved action confirmed.', exact: true })).toBeVisible(); await h.closeReward(a);
      const afterA = await h.rpc(a, 'dc_get'), donationCalls = (await h.command(a, 'calls')).filter(call => call.user === actors.alex && call.name === 'dc_contribute_project');
      checked('contribution-lost-ack-reuses-one-immutable-request-and-stock-debit', donationCalls.length === 2 && donationCalls[0].args.p_request_id === donationCalls[1].args.p_request_id
        && JSON.stringify(donationCalls[0].args.p_resources) === JSON.stringify(donationCalls[1].args.p_resources)
        && Object.entries(players[0].target).every(([key, quantity]) => (afterA.resources[key] || 0) === (beforeA.resources[key] || 0) - quantity));
      for (const player of players.slice(1)) {
        office = await projectReview(player.page, player.target);
        await office.getByRole('button', { name: 'Confirm contribution', exact: true }).click();
        await expect(player.page.getByRole('dialog', { name: 'Contribution recorded.', exact: true })).toBeVisible(); await h.closeReward(player.page);
      }
      board = await shared(a); const completed = board.projects.find(project => project.key === 'camp_supply');
      checked('actual-three-company-donations-fill-the-finite-project', completed.status === 'completed' && completed.progress.stone === 80 && completed.progress.coal === 40 && completed.progress.clay === 30 && completed.contributors === 3);
      for (const [index, player] of players.entries()) {
        const before = await h.rpc(player.page, 'dc_get'); office = await projectReview(player.page);
        const expected = index < 2 ? 36 : 18;
        await expect(office.getByText(`${expected} cr`, { exact: true })).toBeVisible();
        await office.getByRole('button', { name: 'Claim project credits', exact: true }).click(); await expect(player.page.getByRole('dialog', { name: 'Project reward secured.', exact: true })).toBeVisible(); await h.closeReward(player.page);
        const after = await h.rpc(player.page, 'dc_get'), own = (await shared(player.page)).projects.find(project => project.key === 'camp_supply');
        checked(`qualified-project-claim-pays-once-${index}`, after.company.cash === before.company.cash + expected && own.claimed_at !== null && own.reward_amount === expected);
        office = await projectReview(player.page); await expect(office.getByRole('button', { name: 'Claim project credits', exact: true })).toHaveCount(0); await h.clearDialogs(player.page);
      }
      office = await club(a); await office.getByRole('button', { name: 'Sharing preferences', exact: true }).click();
      await context.setOffline(true);
      await expect(office.getByRole('checkbox', { name: 'List my company in standings', exact: true })).toBeDisabled();
      await expect(office.getByRole('button', { name: 'Review sharing', exact: true })).toBeDisabled();
      await fit(a, 'social-offline-readonly-preferences'); await shot(a, 'social-offline-readonly-preferences');
      await context.setOffline(false); await refreshPrivate(a);
      checked('offline-club-mutations-remain-read-only-and-mine-remains-accessible', await a.getByTestId('deep-claim-map').count() === 1);
      await sharing(a, { listed: false, published: false }); board = await shared(b);
      checked('opt-out-hides-published-company-without-erasing-donations-or-claims', board.standings.length === 1 && board.standings[0].user_id === actors.blair && board.showcases.total === 0
        && (await shared(a)).projects.find(project => project.key === 'camp_supply').claimed_at !== null);
      await h.clearDialogs(a); const beforeWrong = (await h.command(a, 'calls')).filter(call => call.user === actors.alex && call.name === 'dc_get_club').length;
      await h.go(a, { run, user: actors.alex, route: `/deep-claim?club=${actors.otherClub}&office=club&view=projects&project=camp_supply` });
      await expect(a.getByText(/This notification belongs to a different club/)).toBeVisible(); await expect(a.getByRole('dialog', { name: 'Company Office', exact: true })).toHaveCount(0);
      const afterWrong = (await h.command(a, 'calls')).filter(call => call.user === actors.alex && call.name === 'dc_get_club').length;
      checked('foreign-club-notification-never-queries-or-switches-club', beforeWrong === afterWrong);
      await h.go(a, { run, user: actors.alex, route: `/deep-claim?club=${actors.club}&office=club&view=projects&project=camp_supply` });
      await expect(a.getByRole('dialog', { name: 'Company Office', exact: true })).toBeVisible(); await expect(a.getByText('Your reward was claimed', { exact: true })).toBeVisible();
      await fit(a, 'social-matching-project-notification'); await shot(a, 'social-matching-project-notification');
      checked('matching-club-notification-opens-only-its-real-project', true);
      await context.close(); console.log('PASS Deep Claim optional club projects, consent, standings and showcases'); return;
    } catch (error) {
      await context.setOffline(false).catch(() => {});
      if (error.sampling) { await context.close(); console.log(`Deep Claim social sampling ${attempt + 1}/24: ${error.message}`); continue; }
      throw error;
    }
  }
  assert.fail('QA sampling gap:24 independent legal worlds did not supply the bounded earned social stock plan; no rewards, energy or terrain were fabricated.');
}

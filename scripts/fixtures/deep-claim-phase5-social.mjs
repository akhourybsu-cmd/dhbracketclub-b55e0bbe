// Actual collected-stock contributions and finite club rewards, never live data.
import assert from 'node:assert/strict';

export async function runPhase5SocialTests(h) {
  const { check, db, one, A, B, CLUB, actors, request, bootstrap, get, getClub, setSocialPreferences, contributeProject, claimProject, engine } = h;
  const C = actors.casey, project = 'camp_supply';
  const economic = snapshot => ({ cash: snapshot.company.cash, resources: snapshot.resources, revision: snapshot.revision });
  const view = social => social.projects.find(item => item.key === project);
  async function funded(user = A) {
    let snapshot = await bootstrap(user);
    await db.query('update public.dc_companies set cash=10000,warehouse_level=3 where id=$1', [snapshot.company.id]);
    await db.query("update public.dc_inventory set quantity=case resource_key when 'stone' then 80 when 'coal' then 40 when 'clay' then 30 else 0 end where company_id=$1", [snapshot.company.id]);
    return get(user);
  }
  async function completed() {
    const snapshots = new Map();
    for (const user of [A, B, C]) snapshots.set(user, await funded(user));
    const amounts = [{ stone: 32, coal: 16, clay: 12 }, { stone: 32, coal: 16, clay: 12 }, { stone: 16, coal: 8, clay: 6 }];
    for (const [index, user] of [A, B, C].entries()) snapshots.set(user, await contributeProject(user, snapshots.get(user), project, amounts[index]));
    return snapshots;
  }

  await check('Phase5 projects: default-private companies see six fixed finite projects without exposing private economy or forced consent', async () => {
    const snapshot = await funded(), social = await getClub();
    assert.equal(social.version, 1); assert.equal(social.club_id, CLUB); assert.equal(social.user_id, A); assert.equal(social.own_revision, snapshot.revision);
    assert.equal(social.own.standings_enabled, false); assert.equal(social.own.showcase_enabled, false); assert.deepEqual(social.standings, []); assert.deepEqual(social.showcases.companies, []);
    assert.equal(social.projects.length, 6); assert.equal(view(social).status, 'open'); assert.ok(social.projects.slice(1).every(item => item.status === 'locked'));
    const before = economic(snapshot), updated = await contributeProject(A, snapshot, project, { stone: 1 });
    assert.equal(updated.resources.stone, before.resources.stone - 1); assert.equal(updated.company.cash, before.cash);
    const after = await getClub(); assert.equal(after.own.standings_enabled, false); assert.equal(after.own.showcase_enabled, false); assert.equal(view(after).contributors, 1); assert.deepEqual(view(after).own_contribution, { stone: 1 });
    engine.validateSocialCatalog();
  });

  await check('Phase5 projects: malformed, unknown, unpaid, capped and over-remaining quantities reject the whole debit', async () => {
    const snapshot = await funded(), before = economic(snapshot);
    for (const resources of [null, [], {}, { stone: 0 }, { stone: -1 }, { stone: 1.5 }, { stone: '1' }, { stone: true }, { unknown: 1 }, { stone: 33 }, { stone: 2147483648 }, { stone: 1, coal: 17 }]) {
      await assert.rejects(contributeProject(A, snapshot, project, resources)); assert.deepEqual(economic(await get()), before);
    }
    for (const key of ['not_a_project','haul_extension']) await assert.rejects(contributeProject(A, snapshot, key, { stone: 1 }));
    const own = view(await getClub()); assert.equal(own.own_value, 0); assert.equal(own.contributors, 0);
    const updated = await contributeProject(A, snapshot, project, { stone: 32 });
    await assert.rejects(contributeProject(A, updated, project, { stone: 1 })); assert.equal((await get()).resources.stone, 48);
  });

  await check('Phase5 projects: exact contribution retries precede revision and completion checks and cannot duplicate stock', async () => {
    let snapshot = await funded(); const before = snapshot, receipt = request();
    snapshot = await contributeProject(A, snapshot, project, { stone: 32, coal: 16, clay: 12 }, receipt);
    assert.deepEqual(economic(await contributeProject(A, before, project, { stone: 32, coal: 16, clay: 12 }, receipt)), economic(snapshot));
    await assert.rejects(contributeProject(A, snapshot, project, { stone: 1 }, receipt));
    await assert.rejects(setSocialPreferences(A, snapshot, { standings: true }, receipt));
    for (const [user, amounts] of [[B, { stone: 32, coal: 16, clay: 12 }], [C, { stone: 16, coal: 8, clay: 6 }]]) await contributeProject(user, await funded(user), project, amounts);
    assert.equal(view(await getClub()).status, 'completed');
    assert.deepEqual(economic(await contributeProject(A, before, project, { stone: 32, coal: 16, clay: 12 }, receipt)), economic(snapshot));
    await assert.rejects(contributeProject(A, snapshot, project, { stone: 1 }));
  });

  await check('Phase5 projects: contributions roll back stock, progress and receipt if the acknowledged transaction cannot finish', async () => {
    const snapshot = await funded(), before = economic(snapshot), receipt = request();
    await db.exec("create function public.dc_test_project_receipt_failure() returns trigger language plpgsql as $$begin raise exception 'Injected project receipt failure';end$$;create trigger dc_test_project_receipt_failure after insert on public.dc_requests for each row execute function public.dc_test_project_receipt_failure()");
    try { await assert.rejects(contributeProject(A, snapshot, project, { stone: 1, coal: 1 }, receipt), /Injected project receipt failure/); }
    finally { await db.exec('drop trigger dc_test_project_receipt_failure on public.dc_requests;drop function public.dc_test_project_receipt_failure()'); }
    assert.deepEqual(economic(await get()), before); assert.equal(view(await getClub()).own_value, 0);
    assert.equal((await one('select count(*)::int n from public.dc_requests where request_id=$1', [receipt])).n, 0);
    assert.equal((await contributeProject(A, snapshot, project, { stone: 1, coal: 1 }, receipt)).resources.stone, 79);
  });

  await check('Phase5 projects: donating the last recoverable operating reserve rejects atomically and the same failed UUID can recover', async () => {
    let snapshot = await funded();
    await db.query('update public.dc_companies set cash=0 where id=$1', [snapshot.company.id]);
    await db.query("update public.dc_inventory set quantity=case resource_key when 'stone' then 2 else 0 end where company_id=$1", [snapshot.company.id]); snapshot = await get();
    const before = economic(snapshot), receipt = request(), projectBefore = view(await getClub());
    await assert.rejects(contributeProject(A, snapshot, project, { stone: 2 }, receipt), /operating|reserve|stock|cash/i);
    assert.deepEqual(economic(await get()), before); assert.deepEqual(view(await getClub()), projectBefore);
    assert.equal((await one('select count(*)::int n from public.dc_requests where request_id=$1', [receipt])).n, 0);
    await db.query('update public.dc_companies set cash=2 where id=$1', [snapshot.company.id]);
    const recovered = await contributeProject(A, snapshot, project, { stone: 2 }, receipt);
    assert.equal(recovered.resources.stone, 0); assert.equal(recovered.company.cash, 2); assert.equal(view(await getClub()).own_contribution.stone, 2);
  });

  await check('Phase5 projects: two stale devices cannot double-spend or exceed a personal contribution cap', async () => {
    const snapshot = await funded(), attempts = await Promise.allSettled([contributeProject(A, snapshot, project, { stone: 20 }), contributeProject(A, snapshot, project, { stone: 20 })]);
    assert.equal(attempts.filter(attempt => attempt.status === 'fulfilled').length, 1); assert.equal(attempts.filter(attempt => attempt.status === 'rejected' && attempt.reason.code === '40001').length, 1);
    assert.equal((await get()).resources.stone, 60); assert.equal(view(await getClub()).progress.stone, 20);
  });

  await check('Phase5 projects: shared last-unit contention commits one complete action without overfunding or clipping', async () => {
    const D = request(); await db.query('insert into public.profiles(id,display_name) values($1,\'Fourth member\')', [D]); await db.query('insert into auth.users(id) values($1)', [D]); await db.query('insert into public.club_members(user_id,club_id) values($1,$2)', [D, CLUB]);
    const snapshots = new Map(); for (const user of [A, B, C, D]) snapshots.set(user, await funded(user));
    for (const [user, quantity] of [[A, 32], [B, 32], [C, 15]]) snapshots.set(user, await contributeProject(user, snapshots.get(user), project, { stone: quantity }));
    const attempts = await Promise.allSettled([contributeProject(C, snapshots.get(C), project, { stone: 1 }), contributeProject(D, snapshots.get(D), project, { stone: 1 })]);
    assert.equal(attempts.filter(attempt => attempt.status === 'fulfilled').length, 1); assert.equal(attempts.filter(attempt => attempt.status === 'rejected').length, 1);
    assert.equal(view(await getClub()).progress.stone, 80);
    const totalRemaining = (await get(C)).resources.stone + (await get(D)).resources.stone; assert.equal(totalRemaining, 144);
  });

  await check('Phase5 projects: all three qualified claims divide the finite pool exactly and never pay automatically', async () => {
    const snapshots = await completed(); let paid = 0;
    for (const user of [A, B, C]) {
      const before = snapshots.get(user), shared = await getClub(user), item = view(shared), expected = engine.projectReward(item.reward_pool, item.own_value, item.total_value);
      assert.equal(item.status, 'completed'); assert.equal(item.qualified, true); assert.equal(item.claimed_at, null); assert.equal(item.reward_amount, expected.amount);
      const receipt = request(), updated = await claimProject(user, before, project, receipt); paid += updated.company.cash - before.company.cash;
      assert.equal(updated.company.cash - before.company.cash, expected.amount); assert.ok(view(await getClub(user)).claimed_at);
      assert.deepEqual(economic(await claimProject(user, before, project, receipt)), economic(updated)); await assert.rejects(claimProject(user, updated, project));
      assert.equal(shared.projects[1].status, 'open');
    }
    assert.equal(paid, 90); assert.ok(paid <= view(await getClub()).reward_pool);
  });

  await check('Phase5 projects: below-five-percent donations have no claim and never mint a minimum reward', async () => {
    const D = request(); await db.query('insert into public.profiles(id,display_name) values($1,\'Small contributor\')', [D]); await db.query('insert into auth.users(id) values($1)', [D]); await db.query('insert into public.club_members(user_id,club_id) values($1,$2)', [D, CLUB]);
    const small = await contributeProject(D, await funded(D), project, { stone: 1 });
    for (const [user, amounts] of [[A, { stone: 32, coal: 16, clay: 12 }], [B, { stone: 32, coal: 16, clay: 12 }], [C, { stone: 15, coal: 8, clay: 6 }]]) await contributeProject(user, await funded(user), project, amounts);
    const shared = view(await getClub(D)); assert.equal(shared.status, 'completed'); assert.equal(shared.qualified, false); assert.equal(shared.reward_amount, 0);
    const before = economic(small); await assert.rejects(claimProject(D, small, project)); assert.deepEqual(economic(await get(D)), before);
  });

  await check('Phase5 projects: public membership shrink raises caps without rerolling goals, refunds or participant requirements', async () => {
    let snapshot = await funded(), initial = view(await getClub()); assert.equal(initial.effective_cap_percent, 40);
    snapshot = await contributeProject(A, snapshot, project, { stone: 32 });
    await db.query('delete from public.club_members where user_id=$1', [C]); assert.equal(view(await getClub()).effective_cap_percent, 60);
    snapshot = await contributeProject(A, snapshot, project, { stone: 16 });
    await db.query('delete from public.club_members where user_id=$1', [B]); assert.equal(view(await getClub()).effective_cap_percent, 100);
    snapshot = await contributeProject(A, snapshot, project, { stone: 32, coal: 40, clay: 30 });
    const final = view(await getClub()); assert.equal(final.status, 'completed'); assert.deepEqual(final.goals, initial.goals); assert.equal(final.reward_pool, initial.reward_pool);
    assert.equal(snapshot.resources.stone, 0); assert.equal(snapshot.company.cash, 10000);
  });

  await check('Phase5 projects: private actors, removed members and disabled installations cannot read or recover shared operations', async () => {
    const privateCompany = await bootstrap(actors.private); assert.equal(privateCompany.company.user_id, actors.private);
    await assert.rejects(getClub(actors.private), error => error.code === '42501');
    await assert.rejects(setSocialPreferences(actors.private, privateCompany, { standings: true }), error => error.code === '42501');
    let snapshot = await funded(); const original = snapshot, receipt = request(); snapshot = await contributeProject(A, snapshot, project, { stone: 1 }, receipt);
    const outsider = await funded(actors.other); assert.equal(view(await getClub(actors.other)).own_value, 0); assert.equal(view(await getClub(actors.other)).contributors, 0);
    await assert.rejects(contributeProject(actors.other, outsider, project, { stone: 49 }));
    await db.query('delete from public.club_members where user_id=$1', [A]);
    for (const action of [() => getClub(), () => contributeProject(A, original, project, { stone: 1 }, receipt), () => claimProject(A, snapshot, project)]) await assert.rejects(action(), error => error.code === '42501');
    await db.query('insert into public.club_members(user_id,club_id) values($1,$2)', [A, CLUB]);
    assert.equal((await contributeProject(A, original, project, { stone: 1 }, receipt)).resources.stone, snapshot.resources.stone);
    await db.exec("update public.club_installed_assets set enabled=false where asset_id=(select id from public.platform_assets where slug='deep-claim')");
    for (const action of [() => getClub(), () => setSocialPreferences(A, snapshot, { standings: true }), () => contributeProject(A, original, project, { stone: 1 }, receipt), () => claimProject(A, snapshot, project)]) await assert.rejects(action(), error => error.code === '42501');
  });
}

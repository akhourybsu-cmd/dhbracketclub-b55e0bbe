// Actual deployed DH Feats/evaluator/ledger and notifications with real DC RPCs.
// Nothing connects to production or awards points outside this isolated DB.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createDeepClaimFeatsDatabase } from './fixtures/deep-claim-feats-db.mjs';
import { runPhase7FeatsTests } from './fixtures/deep-claim-phase7-feats.mjs';

const fixture = await createDeepClaimFeatsDatabase({ integration: false });
const { db, id, rpc } = fixture, A = id(1), B = id(2), C = id(3), CLUB = id(10);
let sequence = 800000, checks = 0; const request = () => id(++sequence);
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const get = (user = A) => rpc(user, 'dc_get');
const bootstrap = user => rpc(user, 'dc_bootstrap', { p_name: `Claim ${user.slice(-4)}`, p_request_id: request() });
const upgrade = (user, snapshot, key) => rpc(user, 'dc_upgrade', { p_building_key: key, p_expected_revision: snapshot.revision, p_request_id: request() });
const check = async (name, run) => { await run(); checks++; console.log('PASS', name); };
const metrics = async user => (await one('select public.dc_feat_metrics_v5($1) value', [user])).value;
const notifications = async user => (await db.query("select to_jsonb(n) value from public.notifications n where user_id=$1 and type='deep_claim' order by created_at,id", [user])).rows.map(row => row.value);
const unlocks = async user => (await db.query('select to_jsonb(u) value from public.dh_feat_unlocks u where user_id=$1 order by feat_key,tier', [user])).rows.map(row => row.value);
const catalogSource = await readFile('src/lib/feats/deepClaimCatalog.json', 'utf8');
fixture.sources.set('src/lib/feats/deepClaimCatalog.json', catalogSource);
const catalog = JSON.parse(catalogSource);
async function board(user = A) { return rpc(user, 'dh_feats_board', { p_club_id: CLUB }); }
async function funded(user) {
  let snapshot = await bootstrap(user);
  await db.query('update public.dc_companies set cash=20000,warehouse_level=3 where id=$1', [snapshot.company.id]);
  await db.query("update public.dc_inventory set quantity=case resource_key when 'stone' then 80 when 'clay' then 40 when 'coal' then 60 when 'copper_ore' then 100 when 'quartz' then 20 when 'copper_bar' then 10 when 'tin_bar' then 5 else 0 end where company_id=$1", [snapshot.company.id]);
  return get(user);
}
async function startWork(user, snapshot, { mode = 'extract', x = 47, y = 1, tutorial = false, infrastructure = null } = {}) {
  const before = new Set(snapshot.expeditions.map(job => job.id));
  snapshot = await rpc(user, 'dc_dispatch_operation', { p_worker_ids: [snapshot.workers.find(worker => !worker.assigned_job_id && worker.energy > 0).id], p_mode: mode, p_target_x: x, p_target_y: y, p_duration_minutes: 20, p_tutorial: tutorial,
    p_infrastructure_key: infrastructure, p_expected_revision: snapshot.revision, p_request_id: request() });
  return { snapshot, job: snapshot.expeditions.find(job => !before.has(job.id)) };
}
async function finishWork(user, operation) {
  // Exact duration keeps the real source completion AFTER the company's
  // deployment gate, even when all test operations finish within one second.
  await fixture.advanceJob(user, operation.job.id, operation.job.duration_seconds);
  return get(user);
}
async function production(user, snapshot, batches = 5) {
  snapshot = await rpc(user, 'dc_start_production', { p_recipe_key: 'smelt_copper', p_batches: batches, p_expected_revision: snapshot.revision, p_request_id: request() });
  const job = snapshot.production_jobs.find(job => job.status === 'active');
  await fixture.advanceProduction(user, job.id, job.duration_seconds); snapshot = await get(user);
  return { snapshot, job };
}

try {
  // Existing evaluated user and genuine pre-deployment DC activity. The new
  // migration must import only new families as historical, never alter old ones.
  await db.query("insert into public.posts(user_id,club_id,title,content) values($1,$2,'Existing club post','Existing source before DC integration')", [A, CLUB]);
  await board();
  let legacy = await funded(A);
  for (const key of ['research_office','smeltery']) legacy = await upgrade(A, legacy, key);
  const historicalWork = await startWork(A, legacy, { tutorial: true }); legacy = await finishWork(A, historicalWork);
  legacy = await rpc(A, 'dc_collect', { p_job_id: historicalWork.job.id, p_request_id: request() });
  legacy = await rpc(A, 'dc_start_research', { p_research_key: 'geology_1', p_expected_revision: legacy.revision, p_request_id: request() });
  await fixture.advanceResearch(A, 'geology_1', 300); legacy = await get();
  const historicalBatch = await production(A, legacy); legacy = await rpc(A, 'dc_collect_production', { p_job_id: historicalBatch.job.id, p_request_id: request() });
  await db.exec("update public.club_installed_assets set enabled=false where club_id='" + CLUB + "' and asset_id=(select id from public.platform_assets where slug='deep-claim')");
  await board();
  const oldCatalog = (await db.query('select to_jsonb(c) value from public.dh_feat_catalog c order by key')).rows.map(row => row.value), oldUnlocks = await unlocks(A);
  const oldMetrics = (await one('select public.dh_feat_metrics($1) value', [A])).value, oldAccount = await one('select to_jsonb(a) value from public.dh_feat_accounts a where user_id=$1', [A]);
  await fixture.applyIntegration();

  await check('real integration preserves all82 existing families, permanent receipts, evaluator state and non-DC metrics', async () => {
    const current = (await db.query("select to_jsonb(c) value from public.dh_feat_catalog c where key not like 'deep_claim_%' order by key")).rows.map(row => row.value);
    assert.deepEqual(current, oldCatalog); assert.deepEqual((await unlocks(A)).filter(row => !row.feat_key.startsWith('deep_claim_')), oldUnlocks);
    assert.deepEqual(await one('select to_jsonb(a) value from public.dh_feat_accounts a where user_id=$1', [A]), oldAccount);
    const after = (await one('select public.dh_feat_metrics($1) value', [A])).value;
    for (const [key, value] of Object.entries(oldMetrics)) assert.equal(after[key], value, key);
  });
  await check('seven canonical DC families have32 finite tiers and exactly590 total source-backed points', async () => {
    const current = (await db.query("select key,category,title,description,thresholds,points,kind,unit,sort_order from public.dh_feat_catalog where key like 'deep_claim_%' order by sort_order")).rows.map(row => ({ ...row, thresholds: row.thresholds.map(Number) }));
    assert.deepEqual(current, catalog); assert.equal(current.length, 7); assert.equal(current.reduce((sum, row) => sum + row.thresholds.length, 0), 32); assert.equal(current.reduce((sum, row) => sum + row.points.reduce((total, points) => total + points, 0), 0), 590);
    for (const signature of ['dc_feat_metrics_v5(uuid)','dc_completed_activity_v5(uuid)','dc_flush_notifications_v5(uuid,timestamptz)','dh_feat_metrics(uuid)']) for (const role of ['anon','authenticated']) assert.equal((await one('select has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, signature])).allowed, false);
  });
  await check('pre-existing disabled-asset activity imports only DC historical receipts with no reveal, monthly award or notification flood', async () => {
    const current = await unlocks(A), added = current.filter(row => row.feat_key.startsWith('deep_claim_'));
    assert.ok(added.some(row => row.feat_key === 'deep_claim_shifts')); assert.ok(added.some(row => row.feat_key === 'deep_claim_research')); assert.ok(added.some(row => row.feat_key === 'deep_claim_processed'));
    assert.ok(added.every(row => row.historical)); assert.equal((await notifications(A)).length, 0);
    const activity = (await db.query('select * from public.dc_completed_activity_v5($1)', [A])).rows; assert.equal(activity.length, 0);
    assert.deepEqual(current.filter(row => !row.feat_key.startsWith('deep_claim_')), oldUnlocks);
  });
  await check('lifetime DC awards and source metrics survive later opt-out, disabled assets and legitimate club moves', async () => {
    const before = await metrics(A), receipts = await unlocks(A);
    await db.query('update public.club_members set club_id=$2 where user_id=$1', [A, id(11)]); assert.deepEqual(await metrics(A), before); assert.deepEqual(await unlocks(A), receipts);
    await db.query('update public.club_members set club_id=$2 where user_id=$1', [A, CLUB]);
    await db.exec("update public.club_installed_assets set enabled=true where asset_id=(select id from public.platform_assets where slug='deep-claim')");
    assert.deepEqual(await metrics(A), before);
  });
  let future, futureWork, futureBatch;
  await check('actual future source events dirty the owner user rather than a company UUID, with no progress for starts or staging', async () => {
    future = await funded(B); await board(B);
    const before = await metrics(B), begun = await startWork(B, future, { tutorial: true }); futureWork = begun.job;
    assert.deepEqual(await metrics(B), before); future = await finishWork(B, begun);
    assert.equal((await metrics(B)).deep_claim_shifts, 1);
    assert.equal((await one('select dirty from public.dh_feat_accounts where user_id=$1', [B])).dirty, true);
    assert.equal((await one('select count(*)::int n from public.dh_feat_accounts where user_id=$1', [future.company.id])).n, 0);
    future = await rpc(B, 'dc_collect', { p_job_id: futureWork.id, p_request_id: request() }); future = await upgrade(B, future, 'smeltery');
    const result = await production(B, future); future = result.snapshot; futureBatch = result.job;
    assert.equal((await metrics(B)).deep_claim_processed, 0);
    future = await rpc(B, 'dc_collect_production', { p_job_id: futureBatch.id, p_request_id: request() }); assert.equal((await metrics(B)).deep_claim_processed, 10);
  });
  await check('future qualifying work awards finite normal ledger receipts once and source history never depends on mutable output remainder', async () => {
    await board(B); const before = await unlocks(B), current = before.filter(row => row.feat_key.startsWith('deep_claim_'));
    assert.ok(current.some(row => row.feat_key === 'deep_claim_shifts' && row.points === 5 && !row.historical)); assert.ok(current.some(row => row.feat_key === 'deep_claim_processed' && row.points === 5 && !row.historical));
    const raw = await one('select outputs,recipe_snapshot from public.dc_production_jobs where id=$1', [futureBatch.id]); assert.equal(raw.outputs.copper_bar, 0); assert.equal(raw.recipe_snapshot.outputs.copper_bar, 2);
    await get(B); await board(B); assert.deepEqual(await unlocks(B), before); assert.equal((await metrics(B)).deep_claim_processed, 10);
  });
  await check('private workspace accounts retain solo gameplay but never produce DC awards, social source counts or in-app notifications', async () => {
    const user = id(7), snapshot = await funded(user), begun = await startWork(user, snapshot, { tutorial: true }); await finishWork(user, begun);
    assert.ok(Object.values(await metrics(user)).every(value => value === 0)); assert.equal((await notifications(user)).length, 0);
    await assert.rejects(rpc(user, 'dc_get_club'), error => error.code === '42501');
  });
  await check('a restored public account never imports saved private-workspace history after its registry entry is removed', async () => {
    const user = id(7), privateCompany = (await one('select id from public.dc_companies where user_id=$1 and club_id=$2', [user, id(12)])).id;
    await db.query("update public.clubs set settings=jsonb_build_object('private_session',true) where id=$1", [id(12)]);
    await db.query('delete from public.dh_private_accounts where user_id=$1', [user]);
    await db.query('update public.club_members set club_id=$2 where user_id=$1', [user, CLUB]);
    assert.ok(Object.values(await metrics(user)).every(value => value === 0));
    assert.equal((await one('select public.dc_feat_company_v5($1) eligible', [privateCompany])).eligible, false);
    const legitimate = await funded(user), returned = await finishWork(user, await startWork(user, legitimate, { tutorial: true }));
    assert.equal((await metrics(user)).deep_claim_shifts, 1); assert.equal((await one('select public.dc_feat_company_v5($1) eligible', [returned.company.id])).eligible, true);
    assert.equal((await one('select count(*)::int n from public.dc_notification_events where company_id=$1 and (consumed_at is null or notification_id is not null)', [privateCompany])).n, 0, 'Private completion receipts must remain suppressed with no delivered or pending notice');
  });
  await check('notification events batch only real owner completions and remain deduplicated after inbox dismissal', async () => {
    const rows = await notifications(B); assert.ok(rows.length >= 1 && rows.length <= 2); assert.ok(rows.every(row => row.url.startsWith('/deep-claim?') && !/seed|cash|balance|inventory|plan|worker/i.test(row.body)));
    await fixture.actorQuery(B, 'delete from public.notifications where type=\'deep_claim\'');
    await get(B); assert.equal((await notifications(B)).length, 0);
    assert.ok((await one('select count(*)::int n from public.dc_notification_events where company_id=$1 and consumed_at is not null', [future.company.id])).n >= 1);
    assert.equal((await fixture.actorQuery(A, 'select * from public.notifications where user_id=$1', [B])).rows.length, 0);
  });
  await check('disabled notification preferences consume completion events instead of replaying an old digest after re-enable', async () => {
    let snapshot = await funded(C);
    await fixture.actorQuery(C, 'insert into public.notification_preferences(user_id,deep_claim) values($1,false)', [C]);
    const begun = await startWork(C, snapshot, { tutorial: true }); snapshot = await finishWork(C, begun); assert.equal((await notifications(C)).length, 0);
    await fixture.actorQuery(C, 'update public.notification_preferences set deep_claim=true where user_id=$1', [C]); await get(C);
    assert.equal((await notifications(C)).length, 0); assert.equal((await one('select count(*)::int n from public.dc_notification_events where company_id=$1 and consumed_at is null', [snapshot.company.id])).n, 0);
  });
  await check('all seven first-tier awards require real completed sources and qualified completed projects rather than donation or claim clicks', async () => {
    future = await upgrade(B, future, 'research_office');
    future = await rpc(B, 'dc_start_research', { p_research_key: 'excavation_1', p_expected_revision: future.revision, p_request_id: request() });
    assert.equal((await metrics(B)).deep_claim_research, 0); await fixture.advanceResearch(B, 'excavation_1', 300); future = await get(B);
    future = await upgrade(B, future, 'trading_post'); future = await rpc(B, 'dc_fulfill_contract', { p_contract_key: 'yard_foundations', p_expected_revision: future.revision, p_request_id: request() });
    const installation = await startWork(B, future, { mode: 'infrastructure', x: 48, y: 4, infrastructure: 'supports' });
    assert.equal((await metrics(B)).deep_claim_infrastructure, 0); future = await finishWork(B, installation);
    future = await upgrade(B, future, 'mine_shaft');
    await db.query("insert into public.dc_tiles(company_id,x,y,material,initial_amount,remaining) values($1,47,25,'stone',100,100)", [future.company.id]); future = await get(B);
    const deep = await startWork(B, future, { x: 47, y: 25 }); assert.equal((await metrics(B)).deep_claim_depth, 1);
    future = await finishWork(B, deep); assert.equal((await metrics(B)).deep_claim_depth, 25); future = await rpc(B, 'dc_collect', { p_job_id: deep.job.id, p_request_id: request() });
    for (const [index, user] of [A, B, C].entries()) {
      let snapshot = await get(user);
      await db.query("update public.dc_inventory set quantity=case resource_key when 'stone' then 80 when 'coal' then 40 when 'clay' then 30 else 0 end where company_id=$1", [snapshot.company.id]); snapshot = await get(user);
      const amounts = index < 2 ? { stone: 32, coal: 16, clay: 12 } : { stone: 16, coal: 8, clay: 6 };
      await rpc(user, 'dc_contribute_project', { p_project_key: 'camp_supply', p_resources: amounts, p_expected_revision: snapshot.revision, p_request_id: request() });
      if (index < 2) assert.equal((await metrics(B)).deep_claim_club_projects, 0);
    }
    assert.equal((await metrics(B)).deep_claim_club_projects, 1);
    const beforeQueue = (await one("select count(*)::int n from public.dc_notification_events where company_id=$1 and kind='project'", [legacy.company.id])).n; assert.equal(beforeQueue, 0);
    await get(A); await get(A);
    assert.equal((await one("select count(*)::int n from public.dc_notification_events where company_id=$1 and kind='project'", [legacy.company.id])).n, 1);
    assert.ok((await notifications(A)).some(row => row.url.includes('project=camp_supply')));
    future = await get(B); future = await rpc(B, 'dc_claim_project', { p_project_key: 'camp_supply', p_expected_revision: future.revision, p_request_id: request() });
    assert.equal((await metrics(B)).deep_claim_club_projects, 1); await board(B);
    const rows = (await unlocks(B)).filter(row => row.feat_key.startsWith('deep_claim_')); assert.equal(rows.length, 7); assert.ok(rows.every(row => row.tier === 1 && row.points === 5 && !row.historical));
  });
  await check('completion notices suppress off-on stale pending events and permanently suppress the fifth daily summary', async () => {
    const user = id(20); await db.query('insert into auth.users(id) values($1)', [user]); await db.query("insert into public.profiles(id,display_name) values($1,'Notification fixture')", [user]); await db.query('insert into public.club_members(user_id,club_id) values($1,$2)', [user, CLUB]);
    let snapshot = await funded(user);
    await db.query("update public.dc_tiles set initial_amount=10000,remaining=10000 where company_id=$1 and x=47 and y=1", [snapshot.company.id]);
    for (let index = 0; index < 7; index++) {
      if (index >= 3) await db.query("update public.dc_notification_state set last_sent_at=clock_timestamp()-interval '16 minutes' where company_id=$1", [snapshot.company.id]);
      snapshot = await get(user); const work = await startWork(user, snapshot); snapshot = await finishWork(user, work);
      snapshot = await rpc(user, 'dc_collect', { p_job_id: work.job.id, p_request_id: request() });
      if (index === 0) assert.equal((await notifications(user)).length, 1);
      if (index === 2) {
        assert.equal((await notifications(user)).length, 1); assert.equal((await one('select count(*)::int n from public.dc_notification_events where company_id=$1 and consumed_at is null', [snapshot.company.id])).n, 2);
        // Toggle off/on without any intermediate company refresh. Pending
        // cooldown events must be suppressed permanently rather than flushed.
        await fixture.actorQuery(user, 'insert into public.notification_preferences(user_id,deep_claim) values($1,false)', [user]);
        await fixture.actorQuery(user, 'update public.notification_preferences set deep_claim=true where user_id=$1', [user]);
        await db.query("update public.dc_notification_state set last_sent_at=clock_timestamp()-interval '16 minutes' where company_id=$1", [snapshot.company.id]); await get(user);
        assert.equal((await notifications(user)).length, 1);
      }
    }
    assert.equal((await notifications(user)).length, 4); assert.equal((await one('select sent_count from public.dc_notification_state where company_id=$1', [snapshot.company.id])).sent_count, 4);
    assert.equal((await one('select count(*)::int n from public.dc_notification_events where company_id=$1 and consumed_at is null', [snapshot.company.id])).n, 0);
  });
  await check('two genuine production completions in one reconciliation create one in-app summary with no premature source award', async () => {
    const user = id(21); await db.query('insert into auth.users(id) values($1)', [user]); await db.query("insert into public.profiles(id,display_name) values($1,'Batched production fixture')", [user]); await db.query('insert into public.club_members(user_id,club_id) values($1,$2)', [user, CLUB]);
    let snapshot = await funded(user); snapshot = await upgrade(user, snapshot, 'smeltery'); snapshot = await upgrade(user, snapshot, 'gem_workshop');
    for (const recipe of ['smelt_copper','polish_quartz']) snapshot = await rpc(user, 'dc_start_production', { p_recipe_key: recipe, p_batches: 1, p_expected_revision: snapshot.revision, p_request_id: request() });
    assert.equal((await notifications(user)).length, 0);
    for (const job of snapshot.production_jobs) await fixture.advanceProduction(user, job.id, job.duration_seconds);
    snapshot = await get(user); const messages = await notifications(user); assert.equal(messages.length, 1); assert.match(messages[0].body, /2 completed company events/);
    assert.equal((await metrics(user)).deep_claim_processed, 0); assert.ok(snapshot.production_jobs.every(job => job.status === 'ready'));
    assert.equal((await one('select count(*)::int n from public.dc_notification_events where company_id=$1 and notification_id=$2', [snapshot.company.id, messages[0].id])).n, 2);
  });
  await check('integration state and event receipts remain private and the complete member RPC boundary stays exactly twenty-five', async () => {
    for (const table of ['dc_notification_state','dc_notification_events']) {
      assert.equal((await one('select relrowsecurity enabled from pg_class where oid=$1::regclass', [`public.${table}`])).enabled, true);
      for (const role of ['anon','authenticated']) assert.equal((await one('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') allowed', [role, `public.${table}`])).allowed, false);
    }
    assert.equal((await one("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' and has_function_privilege('authenticated',p.oid,'EXECUTE')")).n, 25);
    await assert.rejects(fixture.actorQuery(B, 'insert into public.notification_preferences(user_id,deep_claim) values($1,false) on conflict(user_id) do update set deep_claim=false', [A]), error => error.code === '42501');
  });
  await check('project completion never writes a foreign company notification while the project lock is held', async () => {
    const trigger = (await one("select prosrc from pg_proc where oid='public.dc_integration_event_v5()'::regprocedure")).prosrc;
    const branch = trigger.slice(trigger.indexOf("tg_table_name='dc_club_projects'"), trigger.indexOf("tg_table_name='dc_expeditions'"));
    assert.ok(branch.includes('dc_mark_feat_dirty_v5(contributor,true)')); assert.ok(!branch.includes('dc_queue_notification')); assert.ok(!/insert\s+into|update\s+public\.dc_companies/i.test(branch));
    const reconcile = (await one("select prosrc from pg_proc where oid='public.dc_reconcile_v1(uuid,timestamptz)'::regprocedure")).prosrc;
    assert.ok(reconcile.includes('dc_reconcile_v1_pre_v7'));
    const retained = (await one("select prosrc from pg_proc where oid='public.dc_reconcile_v1_pre_v7(uuid,timestamptz)'::regprocedure")).prosrc;
    assert.ok(retained.includes('dc_queue_notification_v5(p_company')); assert.ok(retained.includes('dc_club_contributions'));
  });
  await runPhase7FeatsTests({ fixture, db, id, rpc, A, B, C, CLUB, request, one, get, bootstrap, upgrade, check, metrics, notifications, unlocks, board, catalog });
  await fixture.assertSourcesUnchanged();
  if (process.argv.includes('--proof')) {
    const bodies = (await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(dc_|dh_feat|dh_feats|dh_home_progress|dh_public_member|dh_visible)' order by signature")).rows;
    await writeFile('/tmp/deep-claim-phase7-integrated-expected-bodies.json', JSON.stringify(Object.fromEntries(bodies.map(row => [row.signature, row.md5])), null, 2));
    await writeFile('/tmp/deep-claim-phase7-integrated-expected-sources.json', JSON.stringify(Object.fromEntries([...fixture.sources].map(([path, text]) => [path, { sha256: createHash('sha256').update(text).digest('hex'), md5: createHash('md5').update(text).digest('hex') }])), null, 2));
    console.log(`PASS integrated proof: ${bodies.length} DC/Feats/privacy function bodies`);
  }
  console.log(`${checks} actual Deep Claim DH Feats and notification groups passed.`);
} finally { await fixture.close(); }

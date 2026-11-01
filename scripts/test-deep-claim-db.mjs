// Real Deep Claim migrations in isolated PostgreSQL. No remote credentials or writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { createDeepClaimDatabase, DEEP_CLAIM_ACTORS as actors, fixtureId } from './fixtures/deep-claim-db.mjs';

const fixture = await createDeepClaimDatabase();
const { db, rpc: rawRpc, actorQuery } = fixture;
const enginePaths = ['src/lib/deepClaim/simulation.ts', 'src/lib/deepClaim/world.ts', 'src/lib/deepClaim/catalog.ts', 'src/lib/deepClaim/types.ts'];
for (const path of enginePaths) fixture.sources.set(path, await readFile(path, 'utf8'));
const built = await build({ entryPoints: enginePaths.slice(0, 2), bundle: true, platform: 'node', format: 'esm', write: false, outdir: '/tmp/deep-claim-db-engine' });
const load = suffix => import(`data:text/javascript;base64,${Buffer.from(built.outputFiles.find(file => file.path.endsWith(suffix)).text).toString('base64')}`);
const { calculateCrewPlan, calendarEnergyDay } = await load('/simulation.js');
const { validateDeepClaimSnapshot, validateDeepClaimPreview } = await load('/world.js');
async function rpc(user, name, parameters = {}, role = 'authenticated') {
  const result = await rawRpc(user, name, parameters, role);
  if (name === 'dc_preview') validateDeepClaimPreview(result);
  else validateDeepClaimSnapshot(result);
  return result;
}
const A = actors.alex, B = actors.blair, CLUB = actors.club;
let serial = 900000, checks = 0;
const request = () => fixtureId(++serial);
const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const get = (user = A) => rpc(user, 'dc_get');
const bootstrap = (user = A, key = request(), name = 'Frontier & Sons') => rpc(user, 'dc_bootstrap', { p_name: name, p_request_id: key });
const previewArgs = (workers, { mode = 'explore', x = 48, y = 4, duration = 20, tutorial = false } = {}) => ({
  p_worker_ids: workers, p_mode: mode, p_target_x: x, p_target_y: y, p_duration_minutes: duration, p_tutorial: tutorial,
});
const preview = (user, snapshot, options = {}) => rpc(user, 'dc_preview', previewArgs(options.workers ?? [snapshot.workers[0].id], options));
const dispatch = (user, snapshot, options = {}, key = request()) => rpc(user, 'dc_dispatch', {
  ...previewArgs(options.workers ?? snapshot.workers.map(worker => worker.id), { mode: 'extract', x: 47, y: 1, ...options }),
  p_expected_revision: snapshot.revision, p_request_id: key,
});
const collect = (user, job, key = request()) => rpc(user, 'dc_collect', { p_job_id: job, p_request_id: key });
const sell = (user, snapshot, resource, quantity, key = request()) => rpc(user, 'dc_sell', { p_resource_key: resource, p_quantity: quantity, p_expected_revision: snapshot.revision, p_request_id: key });
const upgrade = (user, snapshot, building, key = request()) => rpc(user, 'dc_upgrade', { p_building_key: building, p_expected_revision: snapshot.revision, p_request_id: key });
const tile = (snapshot, x, y) => snapshot.world.tiles.find(value => value.x === x && value.y === y);
async function finish(user, snapshot) {
  const job = snapshot.expeditions.find(value => value.status === 'active'); assert.ok(job);
  await fixture.advanceJob(user, job.id, job.duration_seconds + 1);
  return rpc(user, 'dc_reconcile');
}
async function collectAndSell(user, snapshot, jobId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    snapshot = await collect(user, jobId);
    for (const [resource, quantity] of Object.entries(snapshot.resources)) if (quantity > 0) snapshot = await sell(user, snapshot, resource, quantity);
    if (snapshot.expeditions.find(job => job.id === jobId).status === 'collected') return snapshot;
  }
  assert.fail('A bounded finite haul must be fully collectable after stock is sold');
}
const economicState = snapshot => ({ revision: snapshot.revision, company: snapshot.company, workers: snapshot.workers,
  resources: snapshot.resources, world: snapshot.world, expeditions: snapshot.expeditions, buildings: snapshot.buildings });
async function reset() {
  await db.exec('truncate public.dc_companies cascade');
  if ((await one("select to_regclass('public.dc_requests') found")).found) await db.exec('truncate public.dc_requests');
  await db.exec("update public.clubs set status='active',settings='{}';update public.platform_assets set is_active=true where slug='deep-claim';update public.club_installed_assets set enabled=true,visible_to_members=true where asset_id=(select id from public.platform_assets where slug='deep-claim')");
  for (const [user, club] of [[A, CLUB], [B, CLUB], [actors.casey, CLUB], [actors.other, actors.otherClub]]) await db.query('insert into public.club_members(user_id,club_id) values($1,$2) on conflict(user_id) do update set club_id=excluded.club_id', [user, club]);
}
async function check(name, fn) { await reset(); await fn(); checks++; console.log(`PASS ${name}`); }
function noPrivateState(snapshot) {
  const forbidden = new Set(['world_seed', 'seed', 'private_seed', 'plan', 'plans', 'milestones', 'future_cargo', 'expected_cargo', 'request_fingerprint']);
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { assert.ok(!forbidden.has(key), `Private field leaked: ${key}`); walk(child); }
  }
  walk(snapshot);
}
async function proof() {
  await fixture.assertSourcesUnchanged();
  if (!process.argv.includes('--proof')) return;
  const bodies = (await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(dc_|deep_claim_)' order by signature")).rows;
  await writeFile('/tmp/deep-claim-expected-bodies.json', JSON.stringify(Object.fromEntries(bodies.map(row => [row.signature, row.body_md5])), null, 2));
  await writeFile('/tmp/deep-claim-expected-sources.json', JSON.stringify(Object.fromEntries([...fixture.sources].filter(([path]) => path.includes('20261102')).map(([path, source]) => [path, { sha256: createHash('sha256').update(source).digest('hex'), md5: createHash('md5').update(source).digest('hex') }])), null, 2));
  const literal = value => `'${value.replaceAll("'", "''")}'`;
  const expected = bodies.map(row => `(${literal(row.signature)},${literal(row.body_md5)})`).join(',\n');
  const postflight = `-- READ ONLY. Compare the installed release with the independently tested SQL.
-- No company records, seeds, private plans or player balances are returned.
with expected(signature,body_md5) as(values ${expected})
select count(*) expected_functions,count(p.oid) installed_functions,
 coalesce(bool_and(p.oid is not null and md5(p.prosrc)=e.body_md5),false) all_bodies_match
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature);

with allowed(name) as(values('dc_bootstrap'),('dc_get'),('dc_reconcile'),('dc_preview'),('dc_dispatch'),('dc_collect'),('dc_sell'),('dc_upgrade'))
select count(*) total_functions,
 count(*) filter(where has_function_privilege('authenticated',p.oid,'EXECUTE')) member_rpc_count,
 bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')=(a.name is not null)) member_acl_exact,
 bool_and(not has_function_privilege('anon',p.oid,'EXECUTE')) anonymous_denied,
 bool_and(has_function_privilege('service_role',p.oid,'EXECUTE')) service_access
from pg_proc p join pg_namespace n on n.oid=p.pronamespace left join allowed a on a.name=p.proname
where n.nspname='public' and p.proname like 'dc_%';

select count(*) private_tables,bool_and(c.relrowsecurity) all_rls_enabled,
 bool_and(not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')) members_denied,
 bool_and(not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')) anonymous_denied
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'dc_%';

select slug,name,category,placement_area,is_active,requires_configuration from public.platform_assets where slug='deep-claim';
-- Compare this aggregate with the same preflight aggregate: existing club choices must not change.
select count(*) installations,md5(coalesce(string_agg(row_to_json(i)::text,',' order by i.id),'')) installation_fingerprint
from public.club_installed_assets i;
select version,config from public.dc_rules order by version;
select count(*) company_records from public.dc_companies;
select count(*) exposed_realtime_tables from pg_publication_tables where schemaname='public' and tablename like 'dc_%';
select c.relname table_name,pg_get_constraintdef(k.oid) constraint_definition from pg_constraint k
join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('dc_companies','dc_worlds','dc_chunks','dc_tiles','dc_expeditions','dc_inventory')
order by c.relname,k.conname;
`;
  await writeFile('/tmp/deep-claim-postflight.sql', postflight);
  console.log(`PASS proof: ${bodies.length} installed function bodies and exact Deep Claim migration sources`);
}

try {
  if (process.argv.includes('--schema-only')) { console.log('PASS Deep Claim migrations compile against real Asset Library schema'); }
  else {
    await check('all Deep Claim tables reject direct member and anonymous CRUD, and internal helpers are not public RPCs', async () => {
      const tables = (await db.query("select tablename from pg_tables where schemaname='public' and tablename like 'dc_%'")).rows;
      assert.ok(tables.length >= 7);
      for (const { tablename } of tables) for (const role of ['anon', 'authenticated']) {
        assert.deepEqual(await one("select has_table_privilege($1,$2,'SELECT') r,has_table_privilege($1,$2,'INSERT') i,has_table_privilege($1,$2,'UPDATE') u,has_table_privilege($1,$2,'DELETE') d", [role, `public.${tablename}`]), { r: false, i: false, u: false, d: false }, `${role} ${tablename}`);
        assert.equal((await one('select relrowsecurity enabled from pg_class where oid=$1::regclass', [`public.${tablename}`])).enabled, true);
      }
      const allowed = new Set(['dc_bootstrap', 'dc_get', 'dc_reconcile', 'dc_preview', 'dc_dispatch', 'dc_collect', 'dc_sell', 'dc_upgrade']);
      const functions = (await db.query("select p.proname name,p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(dc_|deep_claim_)'")).rows;
      for (const row of functions) {
        assert.equal((await one("select has_function_privilege('authenticated',$1,'EXECUTE') allowed", [row.signature])).allowed, allowed.has(row.name), `Member ${row.signature}`);
        assert.equal((await one("select has_function_privilege('anon',$1,'EXECUTE') allowed", [row.signature])).allowed, false, `Anonymous ${row.signature}`);
      }
      assert.deepEqual(new Set(fixture.functions.keys()), allowed);
      await assert.rejects(actorQuery(A, 'select * from public.dc_companies'), /permission denied/);
      await assert.rejects(rpc(null, 'dc_get', {}, 'anon'), /permission denied/);
    });

    await check('new accounts see no company and bootstrap creates one private company with authoritative starting resources', async () => {
      const empty = await get(); assert.equal(empty.company, null); assert.deepEqual(empty.workers, []); assert.equal(empty.world, null);
      const first = await bootstrap(); noPrivateState(first);
      assert.equal(first.schema_version, 1); assert.equal(first.company.user_id, A); assert.equal(first.company.club_id, CLUB);
      assert.equal(first.company.name, 'Frontier & Sons'); assert.equal(first.company.cash, 180); assert.equal(first.company.timezone, 'America/New_York');
      assert.equal(first.company.crew_slots, 1); assert.equal(first.company.tutorial_used, false);
      assert.equal(first.workers.length, 3); assert.equal(new Set(first.workers.map(worker => worker.name)).size, 3);
      for (const worker of first.workers) {
        assert.equal(worker.energy, 6); assert.equal(worker.assigned_job_id, null);
        assert.deepEqual(Object.keys(worker.stats).sort(), ['mining', 'geology', 'engineering', 'logistics', 'safety', 'endurance', 'leadership'].sort());
        assert.ok(Object.values(worker.stats).every(stat => Number.isInteger(stat) && stat >= 1 && stat <= 100));
      }
      assert.equal(first.world.width, 96); assert.equal(first.world.chunk_size, 32); assert.ok(first.world.tiles.length < 96 * 32);
      assert.deepEqual(first.buildings.map(building => building.key).sort(), ['mine_office', 'mine_shaft', 'warehouse', 'tool_station'].sort());
      const other = await get(B); assert.equal(other.company, null); assert.deepEqual(other.resources, {});
      assert.notEqual((await bootstrap(B)).company.id, first.company.id);
    });

    await check('bootstrap retries are stable and a second request cannot create or rename a duplicate company', async () => {
      const key = request(), first = await bootstrap(A, key);
      const retry = await bootstrap(A, key); assert.equal(retry.company.id, first.company.id); assert.equal(retry.company.cash, 180);
      const second = await bootstrap(A, request(), 'Another name'); assert.equal(second.company.id, first.company.id);
      assert.equal((await one('select count(*)::int n from public.dc_companies where user_id=$1 and club_id=$2', [A, CLUB])).n, 1);
      await assert.rejects(bootstrap(A, key, 'Changed request payload'));
    });

    await check('missing, inactive, hidden or disabled installation never grants access, including receipt retries', async () => {
      const key = request(); await bootstrap(A, key);
      for (const [disable, restore] of [
        ["update public.club_installed_assets set enabled=false", "update public.club_installed_assets set enabled=true"],
        ["update public.club_installed_assets set visible_to_members=false", "update public.club_installed_assets set visible_to_members=true"],
        ["update public.platform_assets set is_active=false where slug='deep-claim'", "update public.platform_assets set is_active=true where slug='deep-claim'"],
        ["update public.clubs set status='inactive' where id=$1", "update public.clubs set status='active' where id=$1"],
      ]) {
        await db.query(disable, disable.includes('$1') ? [CLUB] : []);
        await assert.rejects(get()); await assert.rejects(bootstrap(A, key));
        await db.query(restore, restore.includes('$1') ? [CLUB] : []);
      }
      const install = await one('delete from public.club_installed_assets where club_id=$1 and asset_id=(select id from public.platform_assets where slug=$2) returning *', [CLUB, 'deep-claim']);
      await assert.rejects(get());
      await db.query('insert into public.club_installed_assets(club_id,asset_id) values($1,$2)', [CLUB, install.asset_id]);
      assert.equal((await get()).company.cash, 180);
    });

    await check('removed members, outsiders and cross-club company IDs cannot bypass authorization', async () => {
      const first = await bootstrap();
      await assert.rejects(get(actors.outsider));
      await db.query('delete from public.club_members where user_id=$1', [A]); await assert.rejects(get());
      await db.query('insert into public.club_members(user_id,club_id) values($1,$2)', [A, actors.otherClub]);
      const switched = await get(); assert.equal(switched.company, null);
      const second = await bootstrap(); assert.notEqual(second.company.id, first.company.id); assert.equal(second.company.club_id, actors.otherClub);
      await db.query('update public.club_members set club_id=$2 where user_id=$1', [A, CLUB]);
      assert.equal((await get()).company.id, first.company.id);
    });

    await check('discovery reapply preserves platform flags and every existing club installation choice', async () => {
      assert.equal(fixture.initialInstallations, 0, 'Discovery must not automatically install Deep Claim in any club');
      const source = [...fixture.sources].find(([path]) => path.endsWith('_deep_claim_discovery.sql'))?.[1]; assert.ok(source);
      await db.exec("update public.platform_assets set is_active=false,is_premium=true,requires_configuration=true,default_configuration_json='{\"custom\":true}',sort_order=913 where slug='deep-claim';update public.club_installed_assets set enabled=false,visible_to_members=false,configuration_json='{\"saved\":7}',sort_order=117 where asset_id=(select id from public.platform_assets where slug='deep-claim')");
      const before = (await db.query("select club_id,asset_id,enabled,visible_to_members,configuration_json,sort_order from public.club_installed_assets order by club_id,asset_id")).rows;
      const flags = await one("select is_active,is_premium,requires_configuration,default_configuration_json,sort_order from public.platform_assets where slug='deep-claim'");
      await db.exec(source);
      assert.deepEqual(await one("select is_active,is_premium,requires_configuration,default_configuration_json,sort_order from public.platform_assets where slug='deep-claim'"), flags);
      assert.deepEqual((await db.query("select club_id,asset_id,enabled,visible_to_members,configuration_json,sort_order from public.club_installed_assets order by club_id,asset_id")).rows, before);
    });

    await check('preview is read-only and server prices all three durations and the one-time tutorial', async () => {
      const initial = await bootstrap();
      for (const [duration, energy] of [[20, 1], [60, 2], [180, 3]]) {
        const estimate = await preview(A, initial, { mode: 'extract', x: 47, y: 1, duration });
        assert.equal(estimate.allowed, true, JSON.stringify(estimate.reasons)); assert.equal(estimate.energy_per_worker, energy);
        assert.equal(estimate.duration_seconds, duration * 60); assert.ok(estimate.wages > 0);
        assert.ok(estimate.estimated_yield.max >= estimate.estimated_yield.min && estimate.estimated_yield.min >= 0);
        assert.equal(estimate.stages.reduce((sum, stage) => sum + stage.duration_seconds, 0), duration * 60);
        assert.deepEqual(estimate.stages.map(stage => stage.key), ['travel', 'setup', 'work', 'haul', 'return']);
      }
      const tutorial = await preview(A, initial, { mode: 'extract', x: 47, y: 1, tutorial: true, workers: initial.workers.map(worker => worker.id) });
      assert.equal(tutorial.allowed, true); assert.equal(tutorial.duration_seconds, 30); assert.equal(tutorial.energy_per_worker, 1); assert.equal(tutorial.wages, 7);
      assert.deepEqual(tutorial.stages.map(stage => stage.duration_seconds), [5, 3, 15, 3, 4]);
      assert.deepEqual(economicState(await get()), economicState(initial));
    });

    await check('invalid target, duration, mode and foreign or duplicate workers cannot mutate the company', async () => {
      const initial = await bootstrap(), foreign = await bootstrap(B);
      for (const options of [
        { workers: [] }, { workers: [initial.workers[0].id, initial.workers[0].id] }, { workers: [foreign.workers[0].id] },
        { x: -1 }, { x: 96 }, { y: -1 }, { y: 150 }, { duration: 5 }, { mode: 'teleport' },
        { mode: 'explore', x: 47, y: 4, tutorial: true },
      ]) {
        try { const result = await preview(A, initial, options); assert.equal(result.allowed, false, JSON.stringify(options)); assert.ok(result.reasons.length); }
        catch (error) { assert.match(error.code || '', /^(22|P0001|42501)/, `Unexpected validation failure: ${error.message}`); }
      }
      assert.deepEqual(economicState(await get()), economicState(initial));
    });

    await check('negative, fractional, unknown and unavailable market quantities or buildings are rejected atomically', async () => {
      const initial = await bootstrap();
      for (const quantity of [null, 0, -1, 1.5, 2147483648, 'NaN']) await assert.rejects(rpc(A, 'dc_sell', { p_resource_key: 'coal', p_quantity: quantity, p_expected_revision: initial.revision, p_request_id: request() }));
      for (const resource of ['credits', 'gold_ore', null, 'COAL']) await assert.rejects(rpc(A, 'dc_sell', { p_resource_key: resource, p_quantity: 1, p_expected_revision: initial.revision, p_request_id: request() }));
      await assert.rejects(rpc(A, 'dc_sell', { p_resource_key: 'coal', p_quantity: 1, p_expected_revision: initial.revision, p_request_id: request() }));
      for (const building of ['casino', null, 'WAREHOUSE']) await assert.rejects(rpc(A, 'dc_upgrade', { p_building_key: building, p_expected_revision: initial.revision, p_request_id: request() }));
      assert.deepEqual(economicState(await get()), economicState(initial));
    });

    await check('a tutorial dispatch freezes its plan, charges every worker once and hides unearned cargo', async () => {
      const initial = await bootstrap(), key = request(), started = await dispatch(A, initial, { tutorial: true }, key);
      assert.equal(started.company.cash, 173); assert.equal(started.company.tutorial_used, true);
      assert.ok(started.workers.every(worker => worker.energy === 5 && worker.assigned_job_id));
      assert.equal(started.expeditions.length, 1); const job = started.expeditions[0];
      assert.equal(job.duration_seconds, 30); assert.equal(job.cargo, null); assert.equal(job.status, 'active');
      assert.equal(Date.parse(job.completes_at) - Date.parse(job.started_at), 30000);
      assert.deepEqual(started.world.tiles, initial.world.tiles); noPrivateState(started);
      const retry = await dispatch(A, initial, { tutorial: true }, key);
      assert.equal(retry.company.cash, 173); assert.equal(retry.expeditions[0].id, job.id); assert.equal(retry.revision, started.revision);
      await assert.rejects(dispatch(A, initial, { tutorial: true }));
      assert.equal((await one('select count(*)::int n from public.dc_expeditions')).n, 1);
      assert.equal((await one('select count(*)::int n from public.dc_reservations')).n, 2);
      await assert.rejects(db.query("update public.dc_plans set content='{}' where job_id=$1", [job.id]), /immutable/);
      await assert.rejects(db.query("update public.dc_expeditions set completes_at=completes_at+interval '1 minute' where id=$1", [job.id]), /immutable/);
      await assert.rejects(db.query("update public.dc_milestones set due_at=due_at+interval '1 minute' where job_id=$1", [job.id]), /immutable/);
    });

    await check('reconciliation commits only elapsed milestones and settles finite terrain, XP and cargo once', async () => {
      const initial = await bootstrap(), started = await dispatch(A, initial, { tutorial: true }), job = started.expeditions[0];
      await fixture.advanceJob(A, job.id, 15);
      const partial = await get(); assert.equal(partial.expeditions[0].status, 'active'); assert.equal(partial.expeditions[0].cargo, null);
      assert.equal(tile(partial, 47, 1).remaining, tile(initial, 47, 1).remaining - 7);
      assert.equal(tile(partial, 49, 1).remaining, tile(initial, 49, 1).remaining);
      assert.ok(partial.workers.every(worker => worker.assigned_job_id === job.id && worker.xp === 0));
      assert.equal((await one('select count(*)::int n from public.dc_milestones where job_id=$1 and applied_at is not null', [job.id])).n, 1);
      await fixture.advanceJob(A, job.id, 20);
      const ready = await get(); assert.equal(ready.expeditions[0].status, 'ready'); assert.deepEqual(ready.expeditions[0].cargo, { coal: 10, stone: 12 });
      assert.equal(tile(ready, 47, 1).remaining, tile(initial, 47, 1).remaining - 10); assert.equal(tile(ready, 49, 1).remaining, tile(initial, 49, 1).remaining - 12);
      assert.ok(ready.workers.every(worker => worker.assigned_job_id === null && worker.xp === 12 && worker.energy === 5));
      assert.equal((await one('select count(*)::int n from public.dc_reservations')).n, 0);
      assert.equal((await one('select count(*)::int n from public.dc_milestones where job_id=$1 and applied_at is not null', [job.id])).n, 4);
      assert.deepEqual(economicState(await rpc(A, 'dc_reconcile')), economicState(ready));
      assert.deepEqual(economicState(await get()), economicState(ready));
      const blocked = await preview(A, ready, { mode: 'extract', x: 49, y: 2 }); assert.equal(blocked.allowed, false); assert.match(blocked.reasons.join(' '), /staged cargo/i);
      const collected = await collect(A, job.id); assert.equal(collected.resources.coal, 10); assert.equal(collected.resources.stone, 12); assert.equal(collected.company.warehouse_used, 22);
      assert.equal(collected.expeditions[0].status, 'collected'); assert.equal(collected.company.cash, 173);
      assert.deepEqual(economicState(await collect(A, job.id)), economicState(collected));
      assert.equal((await preview(A, collected, { mode: 'extract', x: 47, y: 1, tutorial: true })).allowed, false);
    });

    await check('collection, market sales and functional upgrades use real earned stock and retry-safe receipts', async () => {
      const ready = await finish(A, await dispatch(A, await bootstrap(), { tutorial: true })), job = ready.expeditions[0], collectKey = request();
      const collected = await collect(A, job.id, collectKey);
      assert.deepEqual(economicState(await collect(A, job.id, collectKey)), economicState(collected));
      const saleKey = request(), sold = await sell(A, collected, 'coal', 10, saleKey);
      assert.equal(sold.company.cash, 213); assert.equal(sold.resources.coal, 0); assert.equal(sold.company.warehouse_used, 12);
      assert.deepEqual(economicState(await sell(A, collected, 'coal', 10, saleKey)), economicState(sold));
      await assert.rejects(sell(A, sold, 'coal', 1));
      const cost = sold.buildings.find(building => building.key === 'warehouse').upgrade_cost, upgradeKey = request();
      const improved = await upgrade(A, sold, 'warehouse', upgradeKey);
      assert.equal(improved.company.cash, 213 - cost); assert.equal(improved.company.warehouse_capacity, collected.company.warehouse_capacity * 2);
      assert.equal(improved.buildings.find(building => building.key === 'warehouse').level, 2);
      assert.deepEqual(economicState(await upgrade(A, sold, 'warehouse', upgradeKey)), economicState(improved));
      await assert.rejects(upgrade(A, sold, 'tool_station'));
      assert.ok(improved.log.some(entry => entry.kind === 'sold')); assert.ok(improved.log.some(entry => entry.kind === 'upgraded'));
    });

    await check('all eight authored resources are actually reachable, extractable and sellable, and depleted seams stay depleted', async () => {
      let snapshot = await bootstrap();
      const goals = [['coal', 47, 1], ['stone', 49, 1], ['clay', 46, 1], ['copper_ore', 50, 1], ['tin_ore', 47, 2], ['iron_ore', 49, 2], ['quartz', 47, 3], ['silver_ore', 49, 3]];
      const earned = new Set();
      for (const [resource, x, y] of goals) {
        for (let attempt = 0; attempt < 6; attempt++) {
          if (snapshot.workers.some(worker => worker.energy < 3)) { await fixture.expireEnergyDay(A); snapshot = await get(); }
          const options = { mode: 'extract', x, y, duration: resource === 'coal' || resource === 'stone' ? 180 : 20 };
          const estimate = await preview(A, snapshot, { ...options, workers: snapshot.workers.map(worker => worker.id) });
          assert.equal(estimate.allowed, true, `${resource}: ${estimate.reasons.join(' ')}`);
          const ready = await finish(A, await dispatch(A, snapshot, options)), job = ready.expeditions.find(job => job.status === 'ready');
          assert.ok(job.cargo[resource] > 0, `${resource} must be earned by real extraction`); earned.add(resource);
          const remaining = tile(ready, x, y).remaining;
          snapshot = await collectAndSell(A, ready, job.id);
          if (!['coal', 'stone'].includes(resource) || remaining === 0) break;
          assert.ok(attempt < 5, `${resource} should deplete within the bounded crew capacity`);
        }
      }
      assert.equal(earned.size, 8); assert.ok(snapshot.company.cash > 180);
      for (const [x, y] of [[47, 1], [49, 1]]) {
        assert.equal(tile(snapshot, x, y).remaining, 0);
        assert.equal((await preview(A, snapshot, { mode: 'extract', x, y })).allowed, false);
      }
      assert.equal(tile(await get(), 47, 1).remaining, 0); assert.equal(tile(await get(), 49, 1).remaining, 0);
    });

    await check('a full warehouse preserves staged cargo exactly and blocks new shifts until the remainder is collected', async () => {
      let snapshot = await bootstrap(), readyJob;
      for (let iteration = 0; iteration < 35; iteration++) {
        if (snapshot.workers[0].energy < 1) { await fixture.expireEnergyDay(A); snapshot = await get(); }
        const worker = snapshot.workers[0].id;
        const open = snapshot.world.tiles.filter(value => value.remaining === 0), known = new Set(snapshot.world.tiles.map(value => `${value.x}:${value.y}`));
        const targets = snapshot.world.tiles.filter(value => value.material && value.remaining > 0).map(value => ({ mode: 'extract', x: value.x, y: value.y }));
        for (const point of open) for (const [x, y] of [[point.x - 1, point.y], [point.x + 1, point.y], [point.x, point.y + 1]]) if (x >= 0 && x < 96 && y > 0 && !known.has(`${x}:${y}`)) targets.push({ mode: 'explore', x, y });
        let options;
        for (const target of targets) if ((await preview(A, snapshot, { ...target, workers: [worker] })).allowed) { options = { ...target, workers: [worker] }; break; }
        assert.ok(options, 'A reachable finite worksite must exist while the warehouse fills');
        const ready = await finish(A, await dispatch(A, snapshot, options)); readyJob = ready.expeditions.find(value => value.status === 'ready');
        const before = ready.resources, originalCargo = readyJob.cargo;
        snapshot = await collect(A, readyJob.id);
        const remaining = snapshot.expeditions.find(value => value.id === readyJob.id);
        for (const resource of Object.keys(originalCargo)) assert.equal(snapshot.resources[resource] + (remaining.status === 'ready' ? remaining.cargo[resource] || 0 : 0), before[resource] + originalCargo[resource]);
        if (remaining.status === 'ready') break;
        assert.ok(iteration < 34, 'Real finite extraction should exceed120storage within a bounded number of shifts');
      }
      const partial = snapshot, job = readyJob;
      assert.equal(partial.company.warehouse_used, partial.company.warehouse_capacity);
      assert.equal(partial.expeditions.find(value => value.id === job.id).status, 'ready');
      assert.ok(partial.workers.every(worker => worker.assigned_job_id === null));
      assert.deepEqual(economicState(await collect(A, job.id)), economicState(partial));
      assert.match((await preview(A, partial, { mode: 'extract', x: 49, y: 2 })).reasons.join(' '), /staged cargo/i);
      const completed = await collectAndSell(A, partial, job.id);
      assert.equal(completed.expeditions.find(value => value.id === job.id).status, 'collected');
    });

    await check('calendar boundaries follow New York civil days through 23-hour and 25-hour DST transitions', async () => {
      const calendar = async (time, zone = 'America/New_York') => (await one('select public.dc_calendar_v1($1::timestamptz,$2) data', [time, zone])).data;
      const before = await calendar('2026-01-02T04:59:59Z'), after = await calendar('2026-01-02T05:00:00Z');
      assert.equal(before.day, '2026-01-01'); assert.equal(after.day, '2026-01-02');
      assert.equal(Date.parse(before.next_reset_at), Date.parse('2026-01-02T05:00:00Z'));
      const spring = await calendar('2026-03-08T05:00:00Z'), fall = await calendar('2026-11-01T04:00:00Z');
      assert.equal(Date.parse(spring.next_reset_at) - Date.parse('2026-03-08T05:00:00Z'), 23 * 3600000);
      assert.equal(Date.parse(fall.next_reset_at) - Date.parse('2026-11-01T04:00:00Z'), 25 * 3600000);
      assert.equal((await calendar('2026-01-02T05:00:00Z', 'Pacific/Honolulu')).day, '2026-01-01');
      await db.query('update public.clubs set settings=$2::jsonb where id=$1', [CLUB, JSON.stringify({ timezone: 'Pacific/Honolulu' })]);
      const company = await bootstrap(); assert.equal(company.company.timezone, 'Pacific/Honolulu');
      assert.equal(company.company.energy_day, calendarEnergyDay(company.server_now, 'Pacific/Honolulu'));
      await db.query('update public.clubs set settings=$2::jsonb where id=$1', [CLUB, JSON.stringify({ timezone: 'not/a/zone' })]);
      await fixture.expireEnergyDay(A); assert.equal((await get()).company.timezone, 'America/New_York');
    });

    await check('daily energy refresh happens once on the server, preserves active assignments and never accrues wages while away', async () => {
      const started = await dispatch(A, await bootstrap(), { tutorial: true }), job = started.expeditions[0];
      assert.ok(started.workers.every(worker => worker.energy === 5));
      await fixture.expireEnergyDay(A);
      const refreshed = await get(); assert.ok(refreshed.workers.every(worker => worker.energy === 6 && worker.assigned_job_id === job.id));
      assert.equal(refreshed.company.cash, 173); assert.equal(refreshed.company.energy_day, calendarEnergyDay(refreshed.server_now));
      assert.deepEqual(economicState(await get()), economicState(refreshed));
      await fixture.advanceJob(A, job.id, 86400);
      const returned = await get(); assert.equal(returned.company.cash, 173); assert.ok(returned.workers.every(worker => worker.energy === 6));
      assert.deepEqual(returned.expeditions[0].cargo, { coal: 10, stone: 12 });
    });

    await check('the SQL preview matches the independent integer-rational engine for every crew size and preset', async () => {
      const snapshot = await bootstrap();
      for (const duration of [20, 60, 180]) for (const size of [1, 2, 3]) {
        const workers = snapshot.workers.slice(0, size), quote = await preview(A, snapshot, { mode: 'extract', x: 47, y: 1, duration, workers: workers.map(worker => worker.id) });
        const plan = calculateCrewPlan({ workers, mode: 'extract', duration_minutes: duration, path_edges: quote.route.length - 1,
          target_depth: 1, tool_level: 1, material: 'coal', remaining: tile(snapshot, 47, 1).remaining });
        assert.deepEqual(quote.stages, plan.stages); assert.equal(quote.wages, plan.wages); assert.equal(quote.cargo_capacity, plan.capacity);
        assert.equal(quote.energy_per_worker, plan.energy_per_worker); assert.equal(quote.duration_seconds, plan.duration_seconds);
        assert.deepEqual(quote.estimated_yield, plan.estimated_yield); assert.equal(quote.risk_level, plan.risk_level);
      }
    });

    await check('every worker stat has a functional server effect and remains in exact engine parity', async () => {
      let snapshot = await bootstrap(); const stats = ['mining', 'geology', 'engineering', 'logistics', 'safety', 'endurance', 'leadership'];
      const baseline = Object.fromEntries(stats.map(stat => [stat, 1]));
      // A controlled, unmined test seam prevents tiny starter-assay depletion
      // from hiding differences in the formula. No inventory or wallet is granted.
      await db.query('update public.dc_tiles set initial_amount=100000,remaining=100000 where company_id=$1 and x=49 and y=3', [snapshot.company.id]);
      await db.query('update public.dc_workers set stats=$2::jsonb where company_id=$1', [snapshot.company.id, JSON.stringify(baseline)]);
      snapshot = await get();
      const original = await preview(A, snapshot, { mode: 'extract', x: 49, y: 3, duration: 180, workers: snapshot.workers.map(worker => worker.id) });
      for (const stat of stats) {
        await db.query('update public.dc_workers set stats=$2::jsonb where company_id=$1', [snapshot.company.id, JSON.stringify({ ...baseline, [stat]: 100 })]);
        const current = await get(), workers = current.workers;
        const quote = await preview(A, current, { mode: 'extract', x: 49, y: 3, duration: 180, workers: workers.map(worker => worker.id) });
        assert.notDeepEqual([quote.stages, quote.estimated_yield, quote.cargo_capacity, quote.risk_level], [original.stages, original.estimated_yield, original.cargo_capacity, original.risk_level], `${stat} must affect a real preview`);
        const plan = calculateCrewPlan({ workers, mode: 'extract', duration_minutes: 180, path_edges: quote.route.length - 1,
          target_depth: 3, tool_level: 1, material: 'silver_ore', remaining: tile(current, 49, 3).remaining });
        assert.deepEqual(quote.stages, plan.stages, stat); assert.deepEqual(quote.estimated_yield, plan.estimated_yield, stat); assert.equal(quote.cargo_capacity, plan.capacity, stat);
      }
    });

    await check('two devices can retry the same dispatch, collection and sale without duplicated wages or rewards', async () => {
      const bootstrapKey = request(), companies = await Promise.all([bootstrap(A, bootstrapKey), bootstrap(A, bootstrapKey)]);
      assert.equal(companies[0].company.id, companies[1].company.id);
      const key = request(), attempts = await Promise.all([dispatch(A, companies[0], { tutorial: true }, key), dispatch(A, companies[0], { tutorial: true }, key)]);
      assert.equal(attempts[0].expeditions[0].id, attempts[1].expeditions[0].id); assert.equal(attempts[1].company.cash, 173);
      const ready = await finish(A, attempts[0]), job = ready.expeditions[0].id, collectKey = request();
      const collections = await Promise.all([collect(A, job, collectKey), collect(A, job, collectKey)]);
      assert.equal(collections[0].resources.coal, 10); assert.equal(collections[1].resources.coal, 10);
      const saleKey = request(), sales = await Promise.all([sell(A, collections[0], 'coal', 5, saleKey), sell(A, collections[0], 'coal', 5, saleKey)]);
      assert.equal(sales[0].company.cash, 193); assert.equal(sales[1].resources.coal, 5);
      assert.equal((await one('select count(*)::int n from public.dc_expeditions')).n, 1);
      assert.equal((await one("select count(*)::int n from public.dc_logs where kind='sold'")).n, 1);
      await assert.rejects(collect(A, job, bootstrapKey), /identity already used/i);
      await assert.rejects(bootstrap(B, bootstrapKey), /identity already used/i);
    });

    await check('different stale-device requests produce one dispatch or sale and a conflict instead of double spending', async () => {
      const initial = await bootstrap();
      const dispatches = await Promise.allSettled([dispatch(A, initial, { tutorial: true }), dispatch(A, initial, { tutorial: true })]);
      assert.equal(dispatches.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(dispatches.find(result => result.status === 'rejected').reason.code, '40001');
      const started = dispatches.find(result => result.status === 'fulfilled').value, ready = await finish(A, started);
      const collected = await collect(A, ready.expeditions[0].id);
      const sales = await Promise.allSettled([sell(A, collected, 'coal', 8), sell(A, collected, 'coal', 8)]);
      assert.equal(sales.filter(result => result.status === 'fulfilled').length, 1); assert.equal(sales.find(result => result.status === 'rejected').reason.code, '40001');
      const saved = await get(); assert.equal(saved.resources.coal, 2); assert.equal(saved.company.cash, 205);
      assert.equal((await one('select count(*)::int n from public.dc_expeditions')).n, 1);
    });

    await check('dispatch failure rolls back terrain, assignments, energy, cash, reservations and request receipt atomically', async () => {
      const initial = await bootstrap(), key = request();
      await db.exec("create function public.qa_dc_fail() returns trigger language plpgsql as $$begin raise exception 'Injected isolated delivery failure';end$$;create trigger qa_dc_fail before insert on public.dc_logs for each row execute function public.qa_dc_fail()");
      try { await assert.rejects(dispatch(A, initial, { tutorial: true }, key), /Injected isolated/); }
      finally { await db.exec('drop trigger qa_dc_fail on public.dc_logs;drop function public.qa_dc_fail()'); }
      assert.deepEqual(economicState(await get()), economicState(initial));
      for (const table of ['dc_expeditions', 'dc_plans', 'dc_milestones', 'dc_reservations']) assert.equal((await one(`select count(*)::int n from public.${table}`)).n, 0);
      assert.equal((await one('select count(*)::int n from public.dc_requests where request_id=$1', [key])).n, 0);
      assert.equal((await dispatch(A, initial, { tutorial: true }, key)).company.cash, 173);
    });

    await check('collection failure rolls back inventory and remaining cargo and its exact request can be retried', async () => {
      const ready = await finish(A, await dispatch(A, await bootstrap(), { tutorial: true })), job = ready.expeditions[0].id, key = request();
      await db.exec("create function public.qa_dc_fail() returns trigger language plpgsql as $$begin raise exception 'Injected isolated inventory failure';end$$;create trigger qa_dc_fail before update on public.dc_inventory for each row execute function public.qa_dc_fail()");
      try { await assert.rejects(collect(A, job, key), /Injected isolated/); }
      finally { await db.exec('drop trigger qa_dc_fail on public.dc_inventory;drop function public.qa_dc_fail()'); }
      assert.deepEqual(economicState(await get()), economicState(ready));
      assert.equal((await one('select count(*)::int n from public.dc_requests where request_id=$1', [key])).n, 0);
      assert.equal((await collect(A, job, key)).resources.coal, 10);
    });

    await check('a failed sale rolls back both wallet and inventory while retaining an independently retryable identity', async () => {
      const ready = await finish(A, await dispatch(A, await bootstrap(), { tutorial: true })), collected = await collect(A, ready.expeditions[0].id), key = request();
      await db.exec("create function public.qa_dc_fail() returns trigger language plpgsql as $$begin raise exception 'Injected isolated ledger failure';end$$;create trigger qa_dc_fail before insert on public.dc_logs for each row execute function public.qa_dc_fail()");
      try { await assert.rejects(sell(A, collected, 'coal', 5, key), /Injected isolated/); }
      finally { await db.exec('drop trigger qa_dc_fail on public.dc_logs;drop function public.qa_dc_fail()'); }
      assert.deepEqual(economicState(await get()), economicState(collected));
      assert.equal((await sell(A, collected, 'coal', 5, key)).company.cash, 193);
    });

    await check('office slots enable distinct crews but never permit overlapping workers or reserved deposits', async () => {
      let state = await bootstrap(); const workerIds = state.workers.map(worker => worker.id);
      state = await upgrade(A, state, 'mine_office'); assert.equal(state.company.crew_slots, 2);
      state = await dispatch(A, state, { workers: [workerIds[0]] });
      assert.match((await preview(A, state, { workers: [workerIds[1]], mode: 'extract', x: 47, y: 1 })).reasons.join(' '), /reserved/i);
      assert.match((await preview(A, state, { workers: [workerIds[0]], mode: 'extract', x: 49, y: 1 })).reasons.join(' '), /already on/i);
      state = await dispatch(A, state, { workers: [workerIds[1]], x: 49, y: 1 });
      assert.equal(state.expeditions.filter(job => job.status === 'active').length, 2);
      assert.match((await preview(A, state, { workers: [workerIds[2]], mode: 'extract', x: 49, y: 2 })).reasons.join(' '), /slots/i);
    });

    await check('shaft upgrades create actual accessible infrastructure and shallow companies cannot dispatch below their technology', async () => {
      const initial = await bootstrap(); assert.equal((await preview(A, initial, { x: 47, y: 50 })).allowed, false);
      const upgraded = await upgrade(A, initial, 'mine_shaft'); assert.equal(upgraded.world.max_depth, 99);
      assert.ok(upgraded.world.tiles.some(value => value.x === 48 && value.y === 50 && value.remaining === 0));
      assert.equal((await preview(A, upgraded, { x: 47, y: 50 })).allowed, true);
      assert.equal((await preview(A, upgraded, { x: 47, y: 100 })).allowed, false);
    });

    await check('normal earned work raises XP, levels and effective stats without resetting the persistent crew identity', async () => {
      let snapshot = await bootstrap(); const original = snapshot.workers;
      for (const [x, y] of [[47, 1], [49, 1], [46, 1], [50, 1], [47, 2]]) {
        snapshot = await finish(A, await dispatch(A, snapshot, { x, y }));
        snapshot = await collectAndSell(A, snapshot, snapshot.expeditions.find(job => job.status === 'ready').id);
      }
      for (const worker of snapshot.workers) {
        const before = original.find(value => value.id === worker.id); assert.ok(before);
        assert.equal(worker.xp, 60); assert.equal(worker.level, 2); assert.equal(worker.energy, 1);
        for (const stat of Object.keys(worker.stats)) assert.equal(worker.stats[stat], Math.min(100, before.stats[stat] + 1));
      }
    });

    await check('private geology is deterministic across chunks, clustered into veins and biased toward deep industrial resources', async () => {
      const snapshot = await bootstrap(), company = snapshot.company.id;
      const first = (await db.query("select x,y,public.dc_cell_v1($1,x,y) cell from generate_series(0,95)x cross join generate_series(1,149)y where x<>48", [company])).rows;
      const cells = new Map(first.map(value => [`${value.x}:${value.y}`, value.cell.material]));
      let adjacent = 0, agreement = 0, bands = 0, bandCoal = 0, outside = 0, outsideCoal = 0, shallow = 0, shallowMetal = 0, deep = 0, deepMetal = 0;
      for (const value of first) {
        const material = value.cell.material, next = cells.get(`${value.x + 1}:${value.y}`);
        if (next) { adjacent++; if (next === material) agreement++; }
        if ([8, 9].includes(value.y % 20)) { bands++; if (material === 'coal') bandCoal++; } else { outside++; if (material === 'coal') outsideCoal++; }
        if (value.y < 50) { shallow++; if (['iron_ore', 'silver_ore'].includes(material)) shallowMetal++; }
        if (value.y >= 100) { deep++; if (['iron_ore', 'silver_ore'].includes(material)) deepMetal++; }
      }
      assert.ok(agreement / adjacent > 0.4, 'Neighboring cells should form meaningful veins rather than independent confetti');
      assert.ok(bandCoal / bands > outsideCoal / outside + 0.3, 'Coal strata should be visually and mechanically coherent');
      assert.ok(deepMetal / deep > shallowMetal / shallow + 0.1, 'Deep exploration should change the resource mix');
      for (const [x, y] of [[31, 31], [32, 32], [63, 63], [64, 64], [95, 149], [33, 320]]) {
        const before = (await one('select public.dc_cell_v1($1,$2,$3) cell', [company, x, y])).cell;
        await db.query('select public.dc_reveal_v1($1,$2,$3)', [company, x, y]);
        const revealed = await one('select material,initial_amount,remaining from public.dc_tiles where company_id=$1 and x=$2 and y=$3', [company, x, y]);
        assert.equal(revealed.material, before.material); assert.equal(revealed.initial_amount, before.initial_amount);
        await db.query('select public.dc_reveal_v1($1,$2,$3)', [company, x, y]);
        assert.deepEqual((await one('select public.dc_cell_v1($1,$2,$3) cell', [company, x, y])).cell, before);
        assert.equal((await one('select remaining from public.dc_tiles where company_id=$1 and x=$2 and y=$3', [company, x, y])).remaining, revealed.remaining);
      }
      assert.ok((await one('select count(*)::int n from public.dc_chunks where company_id=$1', [company])).n < 12, 'Untouched world chunks must remain uncreated');
      await assert.rejects(db.query('update public.dc_worlds set seed=gen_random_uuid() where company_id=$1', [company]), /immutable/i);
    });

    await check('request rate limiting rejects fresh writes but permits exact acknowledged retries without changing the economy', async () => {
      const key = request(), initial = await bootstrap(A, key);
      for (let index = 1; index < 120; index++) await bootstrap();
      await assert.rejects(bootstrap(), /Too many updates/i);
      await assert.rejects(dispatch(A, initial, { tutorial: true }), /Too many updates/i);
      const acknowledged = await bootstrap(A, key);
      assert.equal(acknowledged.company.id, initial.company.id); assert.equal(acknowledged.company.cash, 180); assert.equal(acknowledged.expeditions.length, 0);
    });

    await check('upgrade reserve boundaries and dispatch solvency reject stranded states without minting bailout money', async () => {
      let snapshot = await bootstrap(); const cost = snapshot.buildings.find(building => building.key === 'warehouse').upgrade_cost;
      await db.query('update public.dc_companies set cash=$2 where id=$1', [snapshot.company.id, cost]); snapshot = await get();
      await assert.rejects(upgrade(A, snapshot, 'warehouse'), /operating cash/i); assert.deepEqual(economicState(await get()), economicState(snapshot));
      await db.query('update public.dc_companies set cash=$2 where id=$1', [snapshot.company.id, cost + 2]); snapshot = await get();
      snapshot = await upgrade(A, snapshot, 'warehouse'); assert.equal(snapshot.company.cash, 2);
      const worker = snapshot.workers.find(worker => worker.name === 'Ivo Vale');
      await db.query('update public.dc_tiles set remaining=1 where company_id=$1 and x=49 and y=1', [snapshot.company.id]); snapshot = await get();
      const before = economicState(snapshot), key = request();
      await assert.rejects(dispatch(A, snapshot, { workers: [worker.id], x: 49, y: 1 }, key), /operating cash|recoverable stock/i);
      assert.deepEqual(economicState(await get()), before); assert.equal((await one('select count(*)::int n from public.dc_requests where request_id=$1', [key])).n, 0);
      await db.query('update public.dc_tiles set remaining=1 where company_id=$1 and x=47 and y=1', [snapshot.company.id]); snapshot = await get();
      snapshot = await dispatch(A, snapshot, { workers: [worker.id], x: 47, y: 1 }); assert.equal(snapshot.company.cash, 0);
      snapshot = await finish(A, snapshot); snapshot = await collect(A, snapshot.expeditions.find(job => job.status === 'ready').id);
      snapshot = await sell(A, snapshot, 'coal', 1); assert.equal(snapshot.company.cash, 4);
    });

    await check('multi-cell scouting withdraws adjacent finite cells in order and conserves its frozen cargo through milestones', async () => {
      // A deterministic test-only seed makes this regression independent of
      // random company UUIDs. The real production generator still builds it.
      await db.exec(`create function public.qa_dc_seed() returns trigger language plpgsql as $$begin new.seed='${fixtureId(42042)}';return new;end$$;create trigger qa_dc_seed before insert on public.dc_worlds for each row execute function public.qa_dc_seed()`);
      let initial;
      try { initial = await bootstrap(); }
      finally { await db.exec('drop trigger qa_dc_seed on public.dc_worlds;drop function public.qa_dc_seed()'); }
      let target;
      for (const [x, y] of [[47, 4], [49, 4], [47, 5], [49, 5], [47, 6], [49, 6]]) {
        const cell = (await one('select public.dc_cell_v1($1,$2,$3) cell', [initial.company.id, x, y])).cell;
        if (cell.initial_amount < 18) { target = { mode: 'explore', x, y }; break; }
      }
      assert.ok(target, 'The fixed regression world must contain a reachable soft frontier');
      const started = await dispatch(A, initial, target), job = started.expeditions[0];
      assert.deepEqual(started.world.tiles, initial.world.tiles); assert.equal(job.cargo, null); noPrivateState(started);
      const plan = (await one('select content from public.dc_plans where job_id=$1', [job.id])).content;
      assert.ok(plan.extractions.length >= 2);
      for (const [index, extraction] of plan.extractions.entries()) {
        const before = (await one('select public.dc_cell_v1($1,$2,$3) cell', [initial.company.id, extraction.x, extraction.y])).cell;
        assert.ok(extraction.quantity > 0 && extraction.quantity <= before.initial_amount);
        if (index < plan.extractions.length - 1) assert.equal(extraction.quantity, before.initial_amount, 'Prior cells must clear before the work advances');
        if (index) assert.equal(Math.abs(extraction.x - plan.extractions[index - 1].x) + Math.abs(extraction.y - plan.extractions[index - 1].y), 1);
      }
      const firstMilestone = await one('select due_at,payload from public.dc_milestones where job_id=$1 and sequence=1', [job.id]);
      const seconds = Math.ceil((new Date(firstMilestone.due_at).getTime() - Date.parse(job.started_at)) / 1000) + 1;
      await fixture.advanceJob(A, job.id, seconds); const partial = await get();
      const applied = firstMilestone.payload.extractions;
      for (const extraction of plan.extractions) {
        const committed = applied.find(value => value.x === extraction.x && value.y === extraction.y)?.quantity || 0;
        const initialCell = (await one('select public.dc_cell_v1($1,$2,$3) cell', [initial.company.id, extraction.x, extraction.y])).cell;
        const visible = tile(partial, extraction.x, extraction.y);
        if (committed) assert.equal(visible.remaining, initialCell.initial_amount - committed);
        else if (visible) assert.equal(visible.remaining, initialCell.initial_amount, 'Revealed later cells must not be excavated early');
      }
      const ready = await finish(A, partial), returned = ready.expeditions.find(value => value.id === job.id);
      assert.deepEqual(returned.cargo, plan.cargo);
      const total = plan.extractions.reduce((sum, extraction) => sum + extraction.quantity, 0);
      assert.equal(Object.values(returned.cargo).reduce((sum, quantity) => sum + quantity, 0), total);
      for (const extraction of plan.extractions) {
        const original = (await one('select public.dc_cell_v1($1,$2,$3) cell', [initial.company.id, extraction.x, extraction.y])).cell;
        assert.equal(tile(ready, extraction.x, extraction.y).remaining, original.initial_amount - extraction.quantity);
      }
    });

    await check('mine routing finds a shortest excavated path through cycles, terminates when unreachable and stays company-scoped', async () => {
      const company = (await bootstrap()).company.id, peer = (await bootstrap(B)).company.id;
      for (const [x, y] of [[47, 4], [46, 4], [46, 5], [47, 5]]) {
        await db.query('select public.dc_reveal_v1($1,$2,$3)', [company, x, y]);
        await db.query('update public.dc_tiles set remaining=0 where company_id=$1 and x=$2 and y=$3', [company, x, y]);
      }
      const route = (await one('select public.dc_route_v1($1,45,4) route', [company])).route;
      assert.deepEqual(route[0], { x: 48, y: 0 }); assert.deepEqual(route.at(-1), { x: 45, y: 4 });
      assert.equal(route.length, 8); assert.equal(new Set(route.map(point => `${point.x}:${point.y}`)).size, route.length);
      for (let index = 1; index < route.length; index++) assert.equal(Math.abs(route[index].x - route[index - 1].x) + Math.abs(route[index].y - route[index - 1].y), 1);
      assert.deepEqual((await one('select public.dc_route_v1($1,10,10) route', [company])).route, []);
      assert.deepEqual((await one('select public.dc_route_v1($1,45,4) route', [peer])).route, []);
    });

    await check('a fully excavated phase-one grid routes within a bounded budget and removes its private temporary queue', async () => {
      const company = (await bootstrap()).company.id;
      await db.query('insert into public.dc_tiles(company_id,x,y,material,initial_amount,remaining) select $1,x,y,null,0,0 from generate_series(0,95)x cross join generate_series(0,149)y on conflict(company_id,x,y) do update set remaining=0', [company]);
      const started = performance.now(), route = (await one('select public.dc_route_v1($1,95,149) route', [company])).route;
      assert.ok(performance.now() - started < 10000, 'Indexed routing must remain usable on the full supported grid');
      assert.equal(route.length, 197); assert.deepEqual(route[0], { x: 48, y: 0 }); assert.deepEqual(route.at(-1), { x: 95, y: 149 });
      assert.equal((await one("select to_regclass('pg_temp.dc_route_queue_v1') queue")).queue, null);
    });
  }
  await proof();
  console.log(`${checks} Deep Claim database integration checks passed.`);
} finally { await fixture.close(); }

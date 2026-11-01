// Composes real legacy DH Feats/evaluator/ledger with every Deep Claim migration.
// All source activity, accounts and notification rows exist only in this DB.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createFeatsFixture } from '../dh-feats-fixture.mjs';

export async function createDeepClaimFeatsDatabase({ phase = 5, integration = true, integrate } = {}) {
  assert.ok([4, 5].includes(phase), 'Composed Deep Claim fixtures support the pre-social and current schemas');
  if (integrate !== undefined) integration = integrate;
  const base = await createFeatsFixture(), { db, id } = base, sources = new Map();
  const source = async path => { const text = await readFile(path, 'utf8'); sources.set(path, text); await db.exec(text); };
  try {
    await db.exec(`create role service_role bypassrls;grant usage on schema auth,public to service_role;
      create function auth.role() returns text language sql stable as $$select nullif(current_setting('test.role',true),'')$$;
      create or replace function public.current_user_club_id() returns uuid language sql stable security definer set search_path=public as $$select club_id from public.club_members where user_id=auth.uid() order by joined_at nulls last limit 1$$;
      create table public.user_roles(user_id uuid references public.profiles(id),role text);
      alter table public.clubs add column status text not null default 'active';
      insert into auth.users(id) select id from public.profiles on conflict do nothing;
      insert into public.clubs(id,name,slug) values('${id(11)}','Other Club','outside'),('${id(12)}','Private Club','private');
      insert into public.profiles(id,display_name) values('${id(4)}','Darcy'),('${id(7)}','Private member');
      insert into auth.users(id) values('${id(4)}'),('${id(7)}');
      insert into public.club_members(user_id,club_id) values('${id(4)}','${id(11)}'),('${id(7)}','${id(12)}');
      insert into public.dh_private_accounts(user_id,workspace_id,profile_snapshot,membership_snapshot) values('${id(7)}','${id(12)}','{}','{}');
    `);
    // The base fixture's empty asset placeholder predates Asset Library. Replace
    // that empty shape using the actual schema/RLS migration, retaining all DH
    // Feats function bodies, catalog and permanent records.
    assert.equal((await db.query('select count(*)::int n from public.club_installed_assets')).rows[0].n, 0);
    await db.exec('drop table public.club_installed_assets');
    await source('supabase/migrations/20260509210000_platform-assets.sql');
    // Preserve the actual legacy private-identity trigger on the inbox while
    // completing its captured source shape before applying inbox permissions.
    await db.exec(`alter table public.notifications add column type text not null,add column url text,add column read_at timestamptz,add column created_at timestamptz not null default now();
      alter table public.notifications alter column user_id set not null;alter table public.notifications alter column title set not null;
      alter table public.notifications add foreign key(user_id) references auth.users(id),add foreign key(actor_user_id) references auth.users(id),add foreign key(club_id) references public.clubs(id);
      create publication supabase_realtime;
    `);
    await source('supabase/migrations/20260724145021_b4911520-da24-4833-b627-fa9fd3c201a8.sql');
    await source('supabase/migrations/20260329211250_7ff52ba8-3052-4ab3-8e33-477b2a2191a0.sql');
    await source('supabase/migrations/20260526032201_7b3c83c3-3d84-490f-8ae1-900bbcfaeb9b.sql');
    // Supabase's normal public-table defaults supply these grants; PGlite
    // starts without platform default privileges. Actual owner RLS still gates.
    await db.exec('grant select,insert,update on public.notification_preferences to authenticated');
    // Install every released Feat extension in its real chronological order.
    // This produces the same evaluator body as production, including Rune,
    // Prism Break, Afterimage and Cipher; unrelated awards are never stubbed.
    await db.exec('create table public.rune_delve_heroes(user_id uuid primary key);create table public.rune_delve_wallet(user_id uuid primary key,shards integer not null default 0,lifetime_shards_earned integer not null default 0,slots_unlocked integer not null default 2)');
    for (const path of [
      '20261030140000_rune_delve_expeditions.sql',
      '20261031010000_rune_expedition_feats.sql',
      '20261031050000_rune_delve_spatial_puzzles.sql',
      '20261031060000_rune_puzzle_feats.sql',
      '20261031090000_rune_delve_adventures.sql',
      '20261031100000_rune_adventure_progression.sql',
      '20261101010000_showdown_foundation.sql',
      '20261101020000_prism_break_library.sql',
      '20261101030000_showdown_discovery_feats.sql',
      '20261101040000_afterimage_foundation.sql',
      '20261101050000_afterimage_library.sql',
      '20261101060000_cipher_duel_foundation.sql',
      '20261101070000_cipher_duel_feats.sql',
    ]) await source(`supabase/migrations/${path}`);
    const expectedBodies = {
      'dh_feat_metrics(uuid)': '4d5028eef20908582446ec558795ff6c',
      'dh_feats_refresh_user(uuid)': '66b699d5124a0801527961ceed8101df',
      'dh_public_member(uuid)': '68408d4185e1585e6bbdb8e47db295eb',
      'dh_visible_club(uuid)': '18eabd39507a7343e445f1bf34b81cf2',
      'dh_visible_member(uuid)': '18dcb98b8fbd7fe38b28042dc588cec2',
    };
    for (const [signature, md5] of Object.entries(expectedBodies)) assert.equal((await db.query('select md5(prosrc) md5 from pg_proc where oid=$1::regprocedure', [signature])).rows[0].md5, md5, `The composed legacy ${signature} must match the production baseline`);
    assert.equal((await db.query('select count(*)::int n from public.dh_feat_catalog')).rows[0].n, 82);
    const migrations = (await readdir('supabase/migrations')).filter(path => /^20261102\d+_deep_claim.*\.sql$/.test(path)).sort();
    const ceiling = phase === 4 ? '20261102060000_' : '20261102061000_';
    for (const path of migrations.filter(path => path < ceiling)) await source(`supabase/migrations/${path}`);
    await db.exec("insert into public.club_installed_assets(club_id,asset_id,enabled,visible_to_members) select c.id,a.id,true,true from public.clubs c cross join public.platform_assets a where a.slug='deep-claim'");
    const integrationPath = 'supabase/migrations/20261102061000_deep_claim_dh_integration.sql';
    async function applyIntegration() { assert.ok(!sources.has(integrationPath)); await source(integrationPath); }
    if (integration) await applyIntegration();
    async function rpc(user, name, args = {}) {
      const signature = (await db.query("select p.proargnames names,array(select format_type(t,null) from unnest(p.proargtypes::oid[])t) types from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1", [name])).rows;
      assert.equal(signature.length, 1, `Expected one real ${name} function`);
      const definition = signature[0], names = definition.names ?? [], selected = names.map((name, index) => ({ name, index })).filter(({ name }) => Object.hasOwn(args, name));
      for (const key of Object.keys(args)) assert.ok(names.includes(key));
      const values = selected.map(({ name, index }) => definition.types[index] === 'jsonb' ? JSON.stringify(args[name]) : args[name]);
      const result = await base.actorQuery(user, `select public.${name}(${selected.map(({ name, index }, position) => `${name}=>$${position + 1}::${definition.types[index]}`).join(',')}) data`, values);
      return result.rows[0].data;
    }
    async function assertSourcesUnchanged() { for (const [path, text] of sources) assert.equal(await readFile(path, 'utf8'), text, `${path} changed during verification`); }
    async function advanceJob(user, jobId, seconds) {
      assert.ok(seconds > 0 && seconds <= 86400);
      await db.transaction(async transaction => {
        assert.ok((await transaction.query('select e.id from public.dc_expeditions e join public.dc_companies c on c.id=e.company_id where e.id=$1 and c.user_id=$2', [jobId, user])).rows[0]);
        await transaction.exec('alter table public.dc_expeditions disable trigger dc_job_guard;alter table public.dc_milestones disable trigger dc_milestone_guard;alter table public.dc_field_events disable trigger dc_field_event_guard');
        await transaction.query("update public.dc_expeditions set started_at=started_at-$2*interval '1 second',completes_at=completes_at-$2*interval '1 second',stages=(select jsonb_agg(value||jsonb_build_object('starts_at',(value->>'starts_at')::timestamptz-$2*interval '1 second','ends_at',(value->>'ends_at')::timestamptz-$2*interval '1 second') order by ordinality) from jsonb_array_elements(stages)with ordinality)where id=$1", [jobId, seconds]);
        await transaction.query("update public.dc_milestones set due_at=due_at-$2*interval '1 second' where job_id=$1", [jobId, seconds]);
        await transaction.query("update public.dc_field_events set due_at=due_at-$2*interval '1 second' where job_id=$1", [jobId, seconds]);
        await transaction.exec('alter table public.dc_expeditions enable trigger dc_job_guard;alter table public.dc_milestones enable trigger dc_milestone_guard;alter table public.dc_field_events enable trigger dc_field_event_guard');
      });
    }
    async function advanceProduction(user, id, seconds) {
      await db.transaction(async transaction => {
        assert.ok((await transaction.query('select j.id from public.dc_production_jobs j join public.dc_companies c on c.id=j.company_id where j.id=$1 and c.user_id=$2', [id, user])).rows[0]);
        await transaction.exec('alter table public.dc_production_jobs disable trigger dc_production_guard');
        await transaction.query("update public.dc_production_jobs set started_at=started_at-$2*interval '1 second',completes_at=completes_at-$2*interval '1 second' where id=$1", [id, seconds]);
        await transaction.exec('alter table public.dc_production_jobs enable trigger dc_production_guard');
      });
    }
    async function advanceResearch(user, key, seconds) {
      await db.transaction(async transaction => {
        const row = (await transaction.query('select r.company_id from public.dc_research_orders r join public.dc_companies c on c.id=r.company_id where c.user_id=$1 and r.research_key=$2', [user, key])).rows[0]; assert.ok(row);
        await transaction.exec('alter table public.dc_research_orders disable trigger dc_research_order_guard');
        await transaction.query("update public.dc_research_orders set started_at=started_at-$3*interval '1 second',completes_at=completes_at-$3*interval '1 second' where company_id=$1 and research_key=$2", [row.company_id, key, seconds]);
        await transaction.exec('alter table public.dc_research_orders enable trigger dc_research_order_guard');
      });
    }
    return { ...base, sources, applyIntegration, rpc, assertSourcesUnchanged, advanceJob, advanceProduction, advanceResearch };
  } catch (error) { await base.close(); throw error; }
}

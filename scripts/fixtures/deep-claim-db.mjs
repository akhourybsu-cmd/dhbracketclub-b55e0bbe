// Isolated PostgreSQL fixture shared by the Deep Claim SQL and browser checks.
// It never reads application credentials or connects to a remote database.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const fixtureId = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
export const DEEP_CLAIM_ACTORS = {
  alex: fixtureId(1), blair: fixtureId(2), casey: fixtureId(3),
  other: fixtureId(4), outsider: fixtureId(6), private: fixtureId(7),
  club: fixtureId(1001), otherClub: fixtureId(1002), privateClub: fixtureId(1003),
};

export async function createDeepClaimDatabase({ install = true, phase = 7, notificationPreferences = false, database } = {}) {
  const db = database ?? new PGlite();
  const sources = new Map();
  async function source(path) {
    const contents = await readFile(path, 'utf8');
    sources.set(path, contents);
    await db.exec(contents);
  }
  try {
    await source('scripts/fixtures/showdown-db.sql');
    await db.exec(`
      create table auth.users(id uuid primary key);
      insert into auth.users select id from public.profiles;
      create table public.user_roles(user_id uuid references public.profiles(id),role text);
      alter table public.clubs add column settings jsonb not null default '{}';
    `);
    // Reuse the actual private-account visibility definitions for shared data.
    // The rest of this migration manages unrelated application tables.
    const privacyPath = 'supabase/migrations/20261029060000_private_sessions.sql';
    const privacySource = await readFile(privacyPath, 'utf8'); sources.set(privacyPath, privacySource);
    const privacyStart = privacySource.indexOf('create table if not exists public.dh_private_accounts');
    const privacyEnd = privacySource.indexOf('-- Register an explicit identity once;');
    assert.ok(privacyStart >= 0 && privacyEnd > privacyStart);
    await db.exec(privacySource.slice(privacyStart, privacyEnd));
    await db.query("insert into public.dh_private_accounts(user_id,workspace_id,profile_snapshot,membership_snapshot) values($1,$2,'{}','{}')", [DEEP_CLAIM_ACTORS.private, DEEP_CLAIM_ACTORS.privateClub]);
    if (notificationPreferences) {
      for (const path of ['20260329211250_7ff52ba8-3052-4ab3-8e33-477b2a2191a0.sql','20260330023039_e2bff897-a4e4-446e-8ffc-c1ef81144593.sql','20260331234750_52a764b4-5117-4c54-9e31-5382845a493a.sql','20260526032201_7b3c83c3-3d84-490f-8ae1-900bbcfaeb9b.sql']) {
        const pathName = `supabase/migrations/${path}`, text = await readFile(pathName, 'utf8'); sources.set(pathName, text);
        // The mentions migration also changes unrelated chat tables. Reuse its
        // exact preference extension alone in this focused browser fixture.
        if (path.startsWith('20260330023039')) { const preference = text.match(/ALTER TABLE public\.notification_preferences ADD COLUMN IF NOT EXISTS mentions[^;]+;/i)?.[0]; assert.ok(preference); await db.exec(preference); }
        else await db.exec(text);
      }
      const path = 'supabase/migrations/20261102061000_deep_claim_dh_integration.sql', text = await readFile(path, 'utf8'); sources.set(path, text);
      const preference = text.match(/alter table public\.notification_preferences add column deep_claim[^;]+;/i)?.[0]; assert.ok(preference); await db.exec(preference);
      await db.exec('grant select,insert,update on public.notification_preferences to authenticated');
    }
    // Use the application's actual asset schema, RLS policies and catalog.
    await source('supabase/migrations/20260509210000_platform-assets.sql');
    const migrations = (await readdir('supabase/migrations')).filter(path => /^20261102\d+_deep_claim.*\.sql$/.test(path)).sort();
    const phaseCeilings = { 1: '20261102030000_', 2: '20261102040000_', 3: '20261102050000_', 4: '20261102060000_', 5: '20261102061000_', 7: '20261102071000_' };
    assert.ok(phaseCeilings[phase], `Unsupported Deep Claim fixture phase ${phase}`);
    assert.ok(migrations.length, 'Deep Claim migrations must exist before running this fixture');
    //0610 composes the real DH Feats ledger and runs in the separate composed
    // fixture. Core/browser PostgreSQL still executes every gameplay migration.
    const coreMigrations = migrations.filter(path => path !== '20261102061000_deep_claim_dh_integration.sql');
    for (const path of coreMigrations.filter(path => path < phaseCeilings[phase])) await source(`supabase/migrations/${path}`);
    const initialInstallations = (await db.query("select count(*)::int n from public.club_installed_assets i join public.platform_assets a on a.id=i.asset_id where a.slug='deep-claim'")).rows[0].n;
    if (install) await db.exec(`
      insert into public.club_installed_assets(club_id,asset_id,enabled,visible_to_members)
      select c.id,a.id,true,true from public.clubs c cross join public.platform_assets a
      where a.slug='deep-claim' on conflict(club_id,asset_id) do update set enabled=true,visible_to_members=true;
    `);
    const functions = new Map();
    let installedBodies = [];
    async function refreshFunctions() {
      functions.clear();
      const rows = (await db.query(`
        select p.proname name,p.proargnames names,
          array(select format_type(t,null) from unnest(p.proargtypes::oid[]) t) types,
          p.pronargs-p.pronargdefaults required
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname ~ '^(dc_|deep_claim_)'
          and has_function_privilege('authenticated',p.oid,'EXECUTE')
      `)).rows;
      for (const row of rows) {
        assert.ok(!functions.has(row.name), `RPC overload requires explicit fixture handling: ${row.name}`);
        functions.set(row.name, row);
      }
      installedBodies = (await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' order by signature")).rows;
    }
    await refreshFunctions();
    async function applyPendingMigrations({ phase: targetPhase = 7 } = {}) {
      assert.ok(phaseCeilings[targetPhase], `Unsupported Deep Claim fixture phase ${targetPhase}`);
      for (const path of coreMigrations.filter(path => path < phaseCeilings[targetPhase])) if (!sources.has(`supabase/migrations/${path}`)) await source(`supabase/migrations/${path}`);
      await refreshFunctions();
    }
    async function actorQuery(user, sql, values = [], role = 'authenticated') {
      assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
      return db.transaction(async transaction => {
        await transaction.exec(`set local role ${role}`);
        await transaction.query("select set_config('test.user',$1,true),set_config('test.role',$2,true)", [user ?? '', role]);
        return transaction.query(sql, values);
      });
    }
    async function rpc(user, name, parameters = {}, role = 'authenticated') {
      const signature = functions.get(name);
      assert.ok(signature, `Unknown member RPC: ${name}`);
      const names = signature.names ?? [];
      for (const key of Object.keys(parameters)) assert.ok(names.includes(key), `Unexpected ${name} argument ${key}`);
      const selected = names.map((name, index) => ({ name, index })).filter(({ name }) => Object.hasOwn(parameters, name));
      const values = selected.map(({ name, index }) => signature.types[index] === 'jsonb' && parameters[name] !== null ? JSON.stringify(parameters[name]) : parameters[name]);
      const argumentsSql = selected.map(({ name, index }, position) => `${name} => $${position + 1}::${signature.types[index]}`);
      const result = await actorQuery(user, `select public.${name}(${argumentsSql.join(',')}) data`, values, role);
      return result.rows[0].data;
    }
    async function assertSourcesUnchanged() {
      for (const [path, contents] of sources) assert.equal(await readFile(path, 'utf8'), contents, `${path} changed during verification`);
      const current = (await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dc_%' order by signature")).rows;
      assert.deepEqual(current, installedBodies, 'Temporary fixture entropy/functions must be restored before release proof');
    }
    /** Move an existing immutable job's clocks only in this isolated owner fixture. */
    async function advanceJob(user, jobId, seconds) {
      assert.ok(Number.isFinite(seconds) && seconds > 0 && seconds <= 86400);
      await db.transaction(async transaction => {
        const found = (await transaction.query('select e.id from public.dc_expeditions e join public.dc_companies c on c.id=e.company_id where e.id=$1 and c.user_id=$2', [jobId, user])).rows[0];
        assert.ok(found, 'The isolated clock command requires an existing owned job');
        const fieldEvents = (await transaction.query("select to_regclass('public.dc_field_events') found")).rows[0].found;
        await transaction.exec('alter table public.dc_expeditions disable trigger dc_job_guard;alter table public.dc_milestones disable trigger dc_milestone_guard');
        if (fieldEvents) await transaction.exec('alter table public.dc_field_events disable trigger dc_field_event_guard');
        await transaction.query(`
          update public.dc_expeditions set started_at=started_at-$2*interval '1 second',completes_at=completes_at-$2*interval '1 second',
            stages=(select jsonb_agg(value||jsonb_build_object('starts_at',(value->>'starts_at')::timestamptz-$2*interval '1 second','ends_at',(value->>'ends_at')::timestamptz-$2*interval '1 second') order by ordinality)
              from jsonb_array_elements(stages) with ordinality)
          where id=$1
        `, [jobId, seconds]);
        await transaction.query("update public.dc_milestones set due_at=due_at-$2*interval '1 second' where job_id=$1", [jobId, seconds]);
        if (fieldEvents) {
          await transaction.query("update public.dc_field_events set due_at=due_at-$2*interval '1 second' where job_id=$1", [jobId, seconds]);
          await transaction.exec('alter table public.dc_field_events enable trigger dc_field_event_guard');
        }
        await transaction.exec('alter table public.dc_expeditions enable trigger dc_job_guard;alter table public.dc_milestones enable trigger dc_milestone_guard');
      });
    }
    async function expireEnergyDay(user) {
      await db.query("update public.dc_companies set energy_day=(clock_timestamp() at time zone timezone)::date-1,energy_reset_at=clock_timestamp()-interval '1 second' where user_id=$1", [user]);
    }
    /** Shift only an existing owned research clock in this isolated database. */
    async function advanceResearch(user, researchKey, seconds) {
      assert.ok(Number.isFinite(seconds) && seconds > 0 && seconds <= 86400);
      await db.transaction(async transaction => {
        const found = (await transaction.query('select r.company_id from public.dc_research_orders r join public.dc_companies c on c.id=r.company_id where c.user_id=$1 and r.research_key=$2 and r.completed_at is null', [user, researchKey])).rows[0];
        assert.ok(found, 'The isolated research clock requires an existing owned active order');
        await transaction.exec('alter table public.dc_research_orders disable trigger dc_research_order_guard');
        await transaction.query("update public.dc_research_orders set started_at=started_at-$3*interval '1 second',completes_at=completes_at-$3*interval '1 second' where company_id=$1 and research_key=$2", [found.company_id, researchKey, seconds]);
        await transaction.exec('alter table public.dc_research_orders enable trigger dc_research_order_guard');
      });
    }
    /** Shift a company's unfinished production queue together, preserving lane order. */
    async function advanceProduction(user, jobId, seconds) {
      assert.ok(Number.isFinite(seconds) && seconds > 0 && seconds <= 86400);
      await db.transaction(async transaction => {
        const found = (await transaction.query('select p.company_id from public.dc_production_jobs p join public.dc_companies c on c.id=p.company_id where p.id=$1 and c.user_id=$2', [jobId, user])).rows[0];
        assert.ok(found, 'The isolated production clock command requires an existing owned job');
        await transaction.exec('alter table public.dc_production_jobs disable trigger dc_production_guard');
        await transaction.query("update public.dc_production_jobs set started_at=started_at-$2*interval '1 second',completes_at=completes_at-$2*interval '1 second' where company_id=$1 and status<>'collected'", [found.company_id, seconds]);
        await transaction.exec('alter table public.dc_production_jobs enable trigger dc_production_guard');
      });
    }
    return { db, sources, functions, initialInstallations, actorQuery, rpc, applyPendingMigrations, advanceJob, advanceProduction, advanceResearch, expireEnergyDay, assertSourcesUnchanged, close: () => db.close() };
  } catch (error) {
    await db.close();
    throw error;
  }
}

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

export async function createDeepClaimDatabase({ install = true } = {}) {
  const db = new PGlite();
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
    // Use the application's actual asset schema, RLS policies and catalog.
    await source('supabase/migrations/20260509210000_platform-assets.sql');
    const migrations = (await readdir('supabase/migrations')).filter(path => /^20261102\d+_deep_claim.*\.sql$/.test(path)).sort();
    assert.ok(migrations.length, 'Deep Claim migrations must exist before running this fixture');
    for (const path of migrations) await source(`supabase/migrations/${path}`);
    const initialInstallations = (await db.query("select count(*)::int n from public.club_installed_assets i join public.platform_assets a on a.id=i.asset_id where a.slug='deep-claim'")).rows[0].n;
    if (install) await db.exec(`
      insert into public.club_installed_assets(club_id,asset_id,enabled,visible_to_members)
      select c.id,a.id,true,true from public.clubs c cross join public.platform_assets a
      where a.slug='deep-claim' on conflict(club_id,asset_id) do update set enabled=true,visible_to_members=true;
    `);
    const functions = new Map();
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
    }
    /** Move an existing immutable job's clocks only in this isolated owner fixture. */
    async function advanceJob(user, jobId, seconds) {
      assert.ok(Number.isFinite(seconds) && seconds > 0 && seconds <= 86400);
      await db.transaction(async transaction => {
        const found = (await transaction.query('select e.id from public.dc_expeditions e join public.dc_companies c on c.id=e.company_id where e.id=$1 and c.user_id=$2', [jobId, user])).rows[0];
        assert.ok(found, 'The isolated clock command requires an existing owned job');
        await transaction.exec('alter table public.dc_expeditions disable trigger dc_job_guard;alter table public.dc_milestones disable trigger dc_milestone_guard');
        await transaction.query(`
          update public.dc_expeditions set started_at=started_at-$2*interval '1 second',completes_at=completes_at-$2*interval '1 second',
            stages=(select jsonb_agg(value||jsonb_build_object('starts_at',(value->>'starts_at')::timestamptz-$2*interval '1 second','ends_at',(value->>'ends_at')::timestamptz-$2*interval '1 second') order by ordinality)
              from jsonb_array_elements(stages) with ordinality)
          where id=$1
        `, [jobId, seconds]);
        await transaction.query("update public.dc_milestones set due_at=due_at-$2*interval '1 second' where job_id=$1", [jobId, seconds]);
        await transaction.exec('alter table public.dc_expeditions enable trigger dc_job_guard;alter table public.dc_milestones enable trigger dc_milestone_guard');
      });
    }
    async function expireEnergyDay(user) {
      await db.query("update public.dc_companies set energy_day=(clock_timestamp() at time zone timezone)::date-1,energy_reset_at=clock_timestamp()-interval '1 second' where user_id=$1", [user]);
    }
    return { db, sources, functions, initialInstallations, actorQuery, rpc, advanceJob, expireEnergyDay, assertSourcesUnchanged, close: () => db.close() };
  } catch (error) {
    await db.close();
    throw error;
  }
}

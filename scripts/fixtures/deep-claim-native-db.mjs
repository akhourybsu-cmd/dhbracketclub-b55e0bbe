// Optional real PostgreSQL adapter for isolated, multi-connection release QA.
// There is deliberately no production URL/environment-variable fallback.
import assert from 'node:assert/strict';
import postgres from 'postgres';

const MARKER = 'phase7-local-native-only';
const CONNECTION = { host: '127.0.0.1', port: 54329, database: 'dh_dc_phase7', username: 'postgres' };

function adapter(sql, owner = false, control = sql) {
  return {
    exec: async text => { await control.unsafe(text, [], { prepare: false }); },
    query: async (text, parameters = []) => ({ rows: [...await control.unsafe(text, parameters, { prepare: false })] }),
    transaction: callback => owner
      ? sql.begin(transaction => callback(adapter(transaction)))
      : sql.savepoint(transaction => callback(adapter(transaction))),
    close: async () => { if (owner) { try { await control.unsafe('rollback'); } catch { /* A failed migration may have closed its control connection. */ } control.release(); await sql.end({ timeout: 5 }); } },
  };
}

/** Requires an explicitly prepared disposable Docker database on one fixed port. */
export async function createDeepClaimNativeDatabase({ reset = false } = {}) {
  const sql = postgres({ ...CONNECTION, max: 8, idle_timeout: 5, connect_timeout: 4, prepare: false,
    connection: { application_name: 'dh_deep_claim_phase7_native_qa', statement_timeout: 30000, lock_timeout: 5000 },
    onnotice: () => {} });
  // Released SQL files contain explicit BEGIN/COMMIT. Keep their ordinary
  // queries on one reserved connection; actor transactions use the other seven.
  const control = await sql.reserve(), db = adapter(sql, true, control);
  try {
    const identity = await db.query("select current_database() name,current_setting('server_version_num')::integer version,(select marker from public._dh_local_pg_fixture limit 1) marker");
    assert.equal(identity.rows[0].name, CONNECTION.database, 'Native QA can only use its disposable database');
    assert.equal(identity.rows[0].marker, MARKER, 'Native QA marker is required before any fixture DDL');
    assert.ok(identity.rows[0].version >= 170000 && identity.rows[0].version < 180000, 'Native QA requires PostgreSQL 17');
    if (reset) {
      // Schema removal is confined to the fixed, marker-verified local database.
      await db.exec(`drop publication if exists supabase_realtime;drop schema if exists supabase_migrations cascade;drop schema if exists auth cascade;drop schema public cascade;create schema public;
        do $$declare r text;begin foreach r in array array['authenticated','anon','service_role'] loop
          if exists(select 1 from pg_roles where rolname=r) then execute format('drop owned by %I',r);execute format('drop role %I',r);end if;
        end loop;end$$;
        create table public._dh_local_pg_fixture(marker text primary key);
        insert into public._dh_local_pg_fixture values('${MARKER}');`);
    } else {
      const populated = await db.query("select to_regclass('public.dc_companies') populated");
      assert.equal(populated.rows[0].populated, null, 'Use --reset only for this dedicated marked fixture before repeating native QA');
    }
    return { ...db, info: { ...identity.rows[0], connections: 8, fixtureOnly: true } };
  } catch (error) { await db.close(); throw error; }
}

/** Unlike the legacy fixture queue, each call acquires a distinct transaction. */
export async function nativeActorQuery(db, userId, text, parameters = [], role = 'authenticated') {
  assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
  return db.transaction(async transaction => {
    await transaction.exec(`set local role ${role}`);
    await transaction.query("select set_config('test.user',$1,true),set_config('test.role',$2,true)", [userId ?? '', role]);
    return transaction.query(text, parameters);
  });
}

export async function nativeRpc(db, userId, name, args = {}) {
  assert.match(name, /^dc_[a-z0-9_]+$/);
  const found = await db.query("select p.proargnames names,array(select format_type(t,null) from unnest(p.proargtypes::oid[])t) types from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1 and has_function_privilege('authenticated',p.oid,'EXECUTE')", [name]);
  assert.equal(found.rows.length, 1, `One authorized ${name} signature is required`);
  const definition = found.rows[0], names = definition.names ?? [];
  for (const key of Object.keys(args)) assert.ok(names.includes(key), `Unknown ${name} parameter ${key}`);
  const selected = names.map((key, index) => ({ key, index })).filter(({ key }) => Object.hasOwn(args, key));
  const values = selected.map(({ key, index }) => definition.types[index] === 'jsonb' && args[key] !== null ? JSON.stringify(args[key]) : args[key]);
  const result = await nativeActorQuery(db, userId, `select public.${name}(${selected.map(({ key, index }, offset) => `${key}=>$${offset + 1}::${definition.types[index]}`).join(',')}) data`, values);
  return result.rows[0].data;
}

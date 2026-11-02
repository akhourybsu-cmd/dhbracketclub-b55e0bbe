// Independent educational extension fixture. Released gameplay/Feats suites
// keep their Phase7 defaults; this file alone applies0800 after their real SQL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDeepClaimFeatsDatabase } from './deep-claim-feats-db.mjs';

export const TUTORIAL_MIGRATION = 'supabase/migrations/20261102080000_deep_claim_training_journal.sql';
export const TUTORIAL_CRITICAL_PATTERN = '^(dc_|dh_feat|dh_feats|dh_home_progress|dh_public_member|dh_visible)';

export async function createDeepClaimTutorialDatabase({ database, beforeApply, applyTutorial = true } = {}) {
  // Native injected adapters need an explicit transaction for the released0700
  // table locks. The ordinary PGlite path retains its already-tested loader.
  const fixture = await createDeepClaimFeatsDatabase({ phase: database ? 5 : 7, integration: true, database });
  const { db } = fixture;
  const functionBodies = async () => (await db.query(`select p.oid::regprocedure::text signature,p.oid function_oid,md5(p.prosrc) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '${TUTORIAL_CRITICAL_PATTERN}' order by signature`)).rows;
  async function tableHashes(tables) {
    const captured = {};
    for (const table of tables) {
      assert.match(table, /^[a-z_][a-z_0-9]*$/);
      captured[table] = (await db.query(`select md5(to_jsonb(record_row)::text) hash,count(*)::integer copies from public.${table} record_row group by md5(to_jsonb(record_row)::text) order by hash`)).rows;
    }
    return captured;
  }
  try {
    if (database) {
      const expansionPath = 'supabase/migrations/20261102070000_deep_claim_ancient_deep.sql';
      const expansionSource = await readFile(expansionPath, 'utf8');
      await db.transaction(transaction => transaction.exec(expansionSource));
      fixture.sources.set(expansionPath, expansionSource);
    }
    const setup = await beforeApply?.(fixture);
    const oldTables = (await db.query("select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname ~ '^dc_' order by name")).rows.map(row => row.name);
    assert.equal(oldTables.length, 33);
    const preservedPublicTables = ['dh_feat_accounts','dh_feat_catalog','dh_feat_progress','dh_feat_unlocks','notifications','notification_preferences','club_installed_assets','platform_assets','clubs','profiles','club_members'];
    const beforeBodies = await functionBodies(); assert.equal(beforeBodies.length, 153);
    const beforeRows = await tableHashes([...oldTables, ...preservedPublicTables]);
    const source = await readFile(TUTORIAL_MIGRATION, 'utf8'); fixture.sources.set(TUTORIAL_MIGRATION, source);
    if (applyTutorial) await db.transaction(transaction => transaction.exec(source));
    const installedBodies = await functionBodies();
    assert.equal(installedBodies.length, applyTutorial ? 161 : 153);
    for (const original of beforeBodies) assert.deepEqual(installedBodies.find(current => current.signature === original.signature), original, `The educational migration changed ${original.signature}`);
    async function assertEconomicUnchanged() {
      assert.deepEqual(await tableHashes([...oldTables, ...preservedPublicTables]), beforeRows, 'Training must never change any original company/economic/ledger/inbox/install record');
      const current = await functionBodies();
      for (const original of beforeBodies) assert.deepEqual(current.find(row => row.signature === original.signature), original, `Training changed ${original.signature}`);
    }
    async function ageTutorialReceipts(companyId) {
      // Only this new metadata table is shifted in the isolated owner fixture.
      // No game/energy/job clock or authoritative source is changed.
      await db.transaction(async transaction => {
        await transaction.exec('alter table public.dc_tutorial_requests disable trigger dc_tutorial_request_guard');
        await transaction.query("update public.dc_tutorial_requests set created_at=created_at-interval '2 minutes' where company_id=$1", [companyId]);
        await transaction.exec('alter table public.dc_tutorial_requests enable trigger dc_tutorial_request_guard');
      });
    }
    await assertEconomicUnchanged();
    return { ...fixture, setup, source, oldTables, beforeBodies, installedBodies, beforeRows, tableHashes, functionBodies, assertEconomicUnchanged, ageTutorialReceipts };
  } catch (error) { await fixture.close(); throw error; }
}

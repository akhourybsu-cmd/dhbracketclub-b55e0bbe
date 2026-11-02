# Deep Claim native PostgreSQL QA

These optional harnesses use the existing `postgres` development dependency and actual application migrations on a disposable PostgreSQL 17 server. They do not read an application URL or credentials. The adapter permits only `127.0.0.1:54329/dh_dc_phase7` and requires a local fixture marker before any schema reset.

## Current menu/Training Journal extension — 14 groups passed

`scripts/test-deep-claim-tutorial-native.mjs` passed **fourteen groups** on the restored runtime using PostgreSQL **17.11** and eight connections. It extends the same marker-verified adapter with an independent reconstruction of all released sources and the new educational migration. This is a fresh journal concurrency result, separate from the historical fourteen-group Phase 7 result below.

The run proved actual overlapping actor sessions, identical UUID replay, competing cursor compare-and-swap, stale-safe set unions, cross-owner UUID collision, current-club/install checks and direct-access denial. It derived the 161-function postcondition inside a rollback, intentionally failed a guarded release postcondition, waited on a real company lock during the valid release and rejected repeat application. An overdue paid job remained active and unapplied throughout journal reads/writes. Every group checked that the original economic rows/functions remained exact. Native JSONB arguments are supplied as raw objects to the PostgreSQL driver; the old gameplay adapter and PGlite serialization are unchanged.

`scripts/lib/deep-claim-training-release.mjs` constructs the single transaction but never executes it. The transaction requires 153 prior critical functions and eight exact old migration-history sources, preserves all thirty-three original private table-row multisets and company revisions, adds only the educational source, validates `161` critical functions / `27` member RPCs / `35` private RLS tables, and stores the original `0800` source as one array entry. It returns aggregate counts/hashes only. No player training rows or awards are seeded by the migration.

The frozen source is `20261102080000_deep_claim_training_journal.sql`, SHA256 `787670491647a61f49ad967a980acf6805255c7ecbbc29c5d0b253699c81a670`, MD5 `8cdd87f5834c5bfaf91a7089f059b637`. It is **not applied to production** at this checkpoint. A separate twenty-group actual-SQL extension pass ran in the previous PGlite runtime; it does not establish native parallel behavior or replace a fresh final release run.

After preparing the disposable server using the setup below, the independently resetting journal command is:

```sh
node scripts/test-deep-claim-tutorial-native.mjs --reset --proof
```

The fresh `--proof` run produced `/tmp/deep-claim-tutorial-native-report.json`, the baseline/expected body maps and `/tmp/deep-claim-tutorial-release.sql` only after all fourteen groups passed. The exact tested transaction is **101,153 bytes**, SHA256 `143ab335dabda0431015a1b9ad8a08561693d0c4171f3dfb40061f0d5fa5df46`, MD5 `b74129b41103204aa2ba0d05755726cc`. Independent construction reproduced those exact bytes from the frozen source and proof maps. These local checks do not apply `0800` to production or establish browser/publication readiness. No production URL substitution or live fixture write is authorized.

## Disposable setup and historical Phase 7 harness

In the managed cloud environment, read the cloud runtime Docker/network instructions first. Preserve the configured proxy and registry credentials. Use the local Docker socket, rather than an inherited remote Docker context.

```sh
docker --host=unix:///var/run/docker.sock run --rm -d --name dh-dc-phase7-pg \
  --publish 127.0.0.1:54329:5432 \
  --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=dh_dc_phase7 \
  postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b
docker --host=unix:///var/run/docker.sock exec dh-dc-phase7-pg \
  psql -U postgres -d dh_dc_phase7 -v ON_ERROR_STOP=1 -c \
  "create table public._dh_local_pg_fixture(marker text primary key); insert into public._dh_local_pg_fixture values('phase7-local-native-only');"
node scripts/test-deep-claim-native.mjs --reset --proof
docker --host=unix:///var/run/docker.sock rm -f dh-dc-phase7-pg
```

The published port is loopback-only and contains fictional local fixture identities. `--reset` removes only that marker-verified database's fixture schemas, publication and roles. It never targets a Supabase project. Stop the container after QA; no persistent volume is needed.

The adapter reserves one control connection for original SQL files containing explicit transactions, while seven additional connections can execute independent role-scoped actor transactions. The harness verifies distinct overlapping backend sessions, exact bootstrap/dispatch/collection/upgrade retries, competing sales, legacy/new completion, authorization and a real company-lock cutover. It derives the 153-function postcondition inside a rolled-back migration, then proves a deliberately wrong release postcondition rolls back schema, data and history. The same valid transaction is tested under contention and repeat application is rejected without another revision change.

`scripts/lib/deep-claim-release.mjs` only constructs SQL; it never connects to a database. Its reviewed transaction requires the seven original history sources and 133-function baseline, fingerprints current private rows and earned awards dynamically, preserves old OIDs and permissions, applies the original 0700 source, validates 153 function bodies and records that exact source. It returns aggregate verification only. The tested SQL and body maps are written under `/tmp` for the authorized release runner; do not substitute a production URL into the native harness.

Phase 7 evidence used PostgreSQL **17.11**, eight connections and **14 passing groups**. The production server was **17.6** when inspected. These checks establish the tested concurrency and rollback cases, not exhaustive deadlock freedom. Browser emulation, native database concurrency and physical Android/iOS installation/audio interruption remain separate kinds of evidence.

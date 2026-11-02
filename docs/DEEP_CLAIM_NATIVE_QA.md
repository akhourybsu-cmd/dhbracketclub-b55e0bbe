# Deep Claim native PostgreSQL QA

This optional harness uses the existing `postgres` development dependency and actual application migrations on a disposable PostgreSQL 17 server. It does not read an application URL or credentials. The adapter permits only `127.0.0.1:54329/dh_dc_phase7` and requires a local fixture marker before any schema reset.

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

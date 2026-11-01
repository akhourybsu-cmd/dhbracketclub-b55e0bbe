# Deep Claim implementation ledger

## Delivered phase

Phase 0 architecture and Phase 1 first playable mining operation are implemented. Baseline was main `c0c786e409a6eb1384458802da631e4e68352483`. This release is the commit containing this ledger; its final SHA, push confirmation and Lovable synchronization are reported after the commit is published.

## Demonstrably functional

An installed club member can found a private company, see the animated frontier camp and persistent underground mine, choose one to three named employees, review a server quote, dispatch a real shift, leave/reload, reconcile elapsed excavation, collect finite cargo, sell stock, upgrade and repeat. The introduction lasts thirty server seconds and leads into first sale/upgrade guidance. Normal shifts last twenty, sixty and 180 minutes. Each employee has six daily energy, seven functional stats, XP/levels and functional traits.

Exploration and extraction both modify the real mine. Terrain uses version-one private generation, global mineral clusters, coal bands, sparse reveals and permanent depletion. Eight usable resources and four buildings have real economic functions. Warehouse overflow stays staged; partial collection is safe and unresolved cargo blocks new dispatches. The camera supports touch pan/pinch, wheel, keyboard and crew focus; an operational worksite/building list provides an accessible alternative. All four starter buildings fit the initial phone overview.

The game reuses DH authentication, clubs, asset installation, Compete discovery, lazy routing, immersive navigation and onboarding. No duplicate global systems or DH currency are introduced. Original procedural pixel art and synthesized opt-in audio are explicitly Phase 1 presentation; a finished commercial atlas and full soundtrack are not claimed.

## Changed areas

- `src/lib/deepClaim/`: public types/catalogs, validation, explanatory simulation, trusted-RPC service and audio manager.
- `src/hooks/useDeepClaim.ts`: scoped queries, server-time display anchor, monotonic responses, durable interrupted-action identities and offline/retry handling.
- `src/pages/DeepClaimPage.tsx`, `src/components/deepClaim/`: management shell, functional menus, Canvas rendering, original art and device settings.
- Existing App/navigation/asset/onboarding/Compete/home shortcut integration; AuthContext clears private pending-action keys on sign-out.
- `src/test/deepClaim*`, `scripts/test-deep-claim-db.mjs`, `scripts/check-deep-claim.mjs`, `scripts/simulate-deep-claim.mjs` and isolated fixtures.
- The five required design/protocol/balance/assets/implementation documents and the concise CLAUDE feature/storage index.

## SQL deployment — applied and verified

Both additive migrations were applied together in one transaction and recorded in Supabase migration history. No player company or test account was created in production, and the game was not automatically installed in any club. Existing installation count remained 52; Deep Claim installation count was zero at verification.

| Migration | Purpose | SHA256 |
|---|---|---|
| `20261102010000_deep_claim_foundation.sql` | Fourteen private tables, deterministic finite world, eight secured RPCs, transactional workforce/economy, immutable plans and receipts, lazy elapsed-time reconciliation. | `1d370b6b66261c53440a60e43a7801a52f8c100d1e9cd57c4966026dae0c3197` |
| `20261102020000_deep_claim_discovery.sql` | Global asset registration only; existing installer/onboarding/navigation provide discovery. No automatic installs or currency awards. | `94720663733be2af208c403daa85e5ac0bee86a320d0d5d702bf7d8c2bc45593` |

Read-only production postflight confirmed 26/26 tested function bodies match, exactly eight authenticated member RPCs, no anonymous execution, all fourteen tables under RLS with no anonymous/authenticated CRUD, no private Realtime tables, and both recorded migration versions. Future installs use the existing Club Asset Library; owners do not need to invent or paste SQL.

## Verification

- Application project checked with `npx tsc --noEmit -p tsconfig.app.json`.
- Scoped lint covers the new module, hook, tests and touched integration surfaces. New code has zero lint errors. The existing AuthContext fast-refresh warning remains; CompetePage's pre-existing explicit-any issues were not changed by its import/render insertion.
- Full unit/component suite: 182 files, 1,607 tests passed. A final targeted recovery regression adds first-open-offline coverage: 35 service/hook/UI tests passed. The extra case was not counted as if it had been present in the preceding full-suite total.
- `node scripts/test-deep-claim-db.mjs --proof`: 32 actual PostgreSQL groups, including access/installation/visibility, finite resource conservation, ordered scouting, every stat, wages/energy, midnight/DST/zone updates, immutable plans, partial storage, retries, rollback, concurrent delivery and route correctness.
- `node scripts/simulate-deep-claim.mjs`: 168 crew/duration/material scenarios plus conservation, operating-capital and finite-starter-stock proofs. Starter stock plus initial cash is at most 924 before wages, below the 6,080 cost of all upgrades; an initial upgrade is immediately reachable.
- `node scripts/check-deep-claim.mjs`: 80 checks across five phone/landscape/desktop, theme and reduced-motion combinations, actual-SQL complete progression, reload, lost acknowledgement, offline protection and two-device conflict handling. The 66 presentation checks were repeated successfully after final Surface camera framing. These fixtures run the production pages/hooks and actual isolated SQL, not a fabricated browser economy.
- Final production build passed with `npm run build` in 17.16 seconds; the application project typecheck and final scoped lint also passed. No deployment claim relies only on a local build.
- A fully excavated 96×149 route returned the correct 197-point shortest path in approximately 762ms in the isolated benchmark, with temporary queue cleanup. The original JSON queue exceeded fifteen seconds and was replaced before release.

Parallel browser/build work caused older CPU-bound Nexus/Rune tests to exceed their existing five-second timeouts in one run. The full unit suite passed when run without those competing jobs; no unrelated game logic or timeout was changed.

## Decisions that matter to later phases

The logical world can expand vertically; launch shaft technology currently caps access at 149m. Existing world versions, frozen job plans and earned records remain stable during future content changes. The client never receives the private seed or future cargo. Indexed temporary routing queues are company-scoped and ephemeral. Daily energy uses a validated server-owned club timezone with New York fallback, persists the next UTC reset, and adopts zone changes at that boundary.

Offline progression uses deterministic elapsed milestones reconciled on authorized reads/mutations. Phase 1 does not require a permanently open browser or dependable cron, and does not yet send unattended completion notifications. A disconnected client cannot commit dispatches or purchases. An uncertain response retains its exact request ID; definitive rejected transactions clear the intent and permit reviewed recovery.

## Genuine remaining work and verification limits

Phase 2 is next: hiring, equipment/durability, workforce development, smelting/gem processing/crafting and more industrial demand. These do not have placeholder navigation in this release. Phase 3 expands regions, routes, hazards, surveying and special discoveries; Phase 4 adds research/contracts/industrial depth; Phase 5 adds source-backed DH Feats, club projects/standings and notifications; Phase 6 finishes authored presentation, soundtrack and broader performance/balance tuning.

Recent collected jobs are currently shown for twelve expeditions and twenty log entries, with the full history retained in the database. Cursor-based history can extend that UI. This slice is not the complete commercial-length economy or all six geological regions.

PGlite serializes SQL transactions: retry/stale-device/concurrent-delivery behavior and actual SQL were tested, while native multi-connection PostgreSQL deadlock stress was not. Row-lock ordering and temporary-table isolation received an independent source review. Production schema/permissions/bodies were verified without impersonating a live player. Authenticated production play and a public-domain deployment are not claimed from the isolated playthrough or Lovable preview synchronization alone.

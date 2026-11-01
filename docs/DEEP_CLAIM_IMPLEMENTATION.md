# Deep Claim implementation ledger

## Current release — Phase 3 underground operations

Phase 3 is implemented on baseline main `ed02c36da1ddb8624eecc78fed7737998164d790`. Existing ownership, terrain, earned inventory and configuration-one/two jobs remain intact. The final release SHA and verified GitHub/Lovable synchronization are reported after publishing this commit; this document does not invent its own future SHA.

### Working vertical slice

- Survey operations reveal a bounded area at actual elapsed work checkpoints without mining its ore. Surveys require a known, connected, depleted worksite, respect crew energy/wages/slots, and finish with a persistent report rather than an empty cargo claim.
- Supports, ventilation, pumps and rail are paid, timed construction projects with three grades. Inputs, wages and fees are spent atomically; benefits begin only after return. Engineering changes their real coverage/strength. The strongest covering mitigation applies; rail is weighted across the actual route, so an entrance track cannot accelerate an entire deep trip.
- New configuration-three expeditions can encounter bounded rockfall, gas and water delays. Quotes show risk and possible extra time. Incidents publish only when due and never kill workers, destroy cargo, consume additional energy or rewrite old jobs. The tutorial remains thirty seconds and has no incident chance.
- Newly generated chunks below 32m can contain coherent natural, wet and crystal chambers and ruins. Existing chunks retain their original generation, including unseen cells. Natural air is usable only after actual revelation and connection. The new level-five shaft opens genuine access through 556m with a supported operating depth of 599m.
- Six finite specimen definitions have frozen quality, details, sale value and salvage. Recovery requires actual depletion by mining, not a remote survey. Players permanently keep, sell or salvage a find; whole-bundle capacity checks prevent loss. A company/cell never awards the same discovery twice. Pending finds have no timer and are bounded; a full pending queue pauses new dispatches without losing existing returns.
- The existing mobile shell adds accessible field reports, installation planning and a collection decision panel. Canvas shows committed formations, projects and recovered finds, with focus controls and reduced graphics/motion support. Worksite browsing is bounded to 64 options plus a selected target, with search/paging for larger mines.
- Existing workforce, equipment, processing, sale, offline and durable retry flows remain functional. Preview errors are distinguished from uncertain writes; exact pre-migration request receipts remain recoverable after the rollout.

### Changed files and boundaries

Production extends `src/lib/deepClaim/{types,catalog,world,simulation,production,service,field}.ts`, `src/hooks/useDeepClaim.ts`, `src/pages/DeepClaimPage.tsx`, the existing dispatch/settings/styles and isolated Canvas renderer. New UI modules are `DeepClaimField.tsx`, `fieldLabels.ts` and renderer `fieldAtlas.ts`, `fieldSprites.ts`, `fieldVisuals.ts`. The public, answer-free canonical catalog is `supabase/seed/deep-claim-phase3-catalog.json`.

Tests extend `src/test/deepClaim*`, add the Phase 3 fixture/component/logic suites, and extend SQL, headless and browser scripts with `deep-claim-phase3-{extra,preservation,world}.mjs`. All five Deep Claim documents and the CLAUDE feature index agree with the release. No dependency, unrelated game, authentication, club, installation or global currency system was replaced.

### SQL deployment — applied and verified

`20261102040000_deep_claim_underground_operations.sql` was applied transactionally, with its exact original source recorded in Supabase migration history. SHA256: `f5cd959948231619d1396bed64592f1623a6e5939bbde8842c83a56733b85063`.

The additive migration introduces `dc_infrastructure`, `dc_discoveries`, `dc_field_events`, secured operation preview/dispatch and discovery resolution, generation/configuration-three helpers and immutable guards. It preserves the fifteen earlier RPC signatures. Cutover takes company/expedition barriers in application lock order, pins all missing old-plan extraction and reveal chunks using the old generation selector, and invalidates stale quotes without changing earned balances or old job outcomes. New jobs pin their planned chunks too. The first three migration files remain unchanged.

Production postflight verified **73/73 function bodies**, exactly **18 member RPC grants**, service access, anonymous denial and **24/24 private tables under RLS with no member/anonymous direct CRUD**. Both installed catalogs and the recorded migration source match the tested originals. Private tables are absent from Realtime publication. Existing installation count remains 52 and its full fingerprint remains `a57ebe1314691ab1449c666997ad8faf`. Deep Claim has zero installations at verification: club admins install it through the existing Asset Library. No live company or test account was created.

### Verification evidence

- Actual application typecheck, `npx tsc --noEmit -p tsconfig.app.json`, passed. Scoped ESLint passed for modified Deep Claim modules, tests and scripts.
- Full unit/component suite: **186 files, 1,725 tests passed**, run without competing heavy jobs.
- Actual-migration PostgreSQL suite: **85 groups passed**, preserving all 55 baseline groups. Coverage includes configuration-one/two whole and partly elapsed jobs, absent extraction/reveal chunk borders, independent cavern geometry, finite resources, delayed incidents, weighted rail, operating reserves, every discovery decision, immutable receipts, tenant/asset access and private-data denial.
- The exact release transaction was separately exercised against an existing isolated pre-migration company and active job. Original-source migration history, lost-acknowledgement legacy dispatch recovery, old-state preservation and repeat-apply rejection passed. Production preflight matched all 47 prior function bodies before applying 0400.
- Headless balance passed **210 mining scenarios**, field arithmetic, all **24 specimen/quality combinations**, finite conservation and no salvage arbitrage. A route-coverage case reduces an entrance rail's nominal 28 strength to a real 3% transport benefit. Existing first-smelter/pickaxe progression remains attainable with 56 cash left in its tested route.
- Final browser run: **152 checks passed, zero errors and zero runtime errors** across 320px/390px phones, landscape, desktop, light/dark themes and reduced motion. It covers the actual SQL-backed mining/reload/offline/two-device journey, workforce/production, paid surveying and infrastructure, finite discovery keep/sell/salvage with interrupted-response recovery, reports and map focus. The cavern case earned tutorial cargo, sold it, bought shaft two and completed a deep survey to reveal an actual natural room; no fake production records or frontend currency overrides were used.
- Final production build passed with `npm run build` in **13.95 seconds**. The game remains lazy loaded, with no new game-engine dependency.

### Remaining work and decisions

Phase 4 is next: dependency-based research, persistent contracts, advanced industry/logistics and company milestones. Phase 5 club projects/standings/source-backed DH Feats/notifications and Phase 6 finished authored atlas/music/presentation remain separate work. Initial procedural art and synthesized audio are original working presentation, not a claimed finished commercial asset pack or soundtrack.

The full six-region content roadmap, surveying-specific future discoveries, pumps that drain actual blocked water routes, advanced rail networks and a paged lifetime museum are not claimed. Current hazards cause delay only, while pumps mitigate the corresponding risk. Field history is bounded in public snapshots while all records persist. Offline progression reconciles on authorized reads/mutations; no unattended cron/notification delivery is claimed. Company credits remain isolated from DH Score. PGlite serializes transactions, so native multi-connection deadlock stress remains unverified. Production schema/security/source checks do not impersonate a live member. Preview synchronization and public publishing are separate deployment facts.

## Phase 2 historical release record

The following records describe the earlier Phase 2 release and verification at that time. Current Phase 3 behavior and verification above supersede forward-looking references below.

Phase 2 is implemented on baseline main `4baca192378d68d11ddd25a553dc2874ec75ac3a`. Phase 0/1 integration, ownership, terrain and economic records remain intact. The final release SHA and verified GitHub/Lovable synchronization are reported after publishing this commit; this document does not invent its own future SHA.

### Working vertical slice

- Three persisted daily candidates rotate across seven specialties. Hiring pays the displayed fee/wage, preserves candidate identity/appearance, and respects quarters capacity of 3/6/9/12 employees.
- Idle employees can buy one permanent skill course per operating day. Base statistics, XP and effective equipment bonuses remain distinct.
- Ten equipment definitions in two tiers provide real mining, safety, engineering, logistics and geology bonuses through three exclusive slots. Dispatch freezes effects; configuration-two completion applies wear once. Broken equipment removes its bonus while basic work remains possible. Repairs consume credits/materials; permanent unassigned-item retirement grants no refund.
- Sixteen frozen, server-timed recipes smelt four metals, polish quartz, cut amethyst and craft equipment. Inputs/fuel/cash are spent atomically; one serial lane per station and three uncollected jobs bound production. Actual ready materials respect warehouse staging, and owned equipment is created once on collection. Owned plus pending equipment is capped at 48.
- Workers’ Quarters, Smeltery and Gem Workshop are actual buildable/upgradable surface buildings. The existing Tool Station crafts gear. Office crew slots support simultaneous expeditions; individual crews remain limited to three workers.
- Shaft level four reaches 299m. New deep chunks contain finite amethyst/gold-bearing deposits. Existing seeds, chunks, unseen version-one cells and in-flight version-one expedition plans remain unchanged; old jobs receive no retroactive equipment wear.
- Crew Staff/Hire and Stores Stock/Workshop extend the existing six-tab shell. Surface actions lead to real operations, ready production leads directly to collection, and centered receipts identify actual materials/owned item IDs. Reload, offline inspection, interrupted writes and cross-device revision conflicts use the existing safe recovery protocol.

### Changed files and boundaries

Production changes live in `src/lib/deepClaim/{types,catalog,world,simulation,production,service}.ts`, `src/hooks/useDeepClaim.ts`, `src/pages/DeepClaimPage.tsx`, the new `DeepClaimWorkforce.tsx`/`DeepClaimIndustry.tsx`, existing Deep Claim panels/settings/dispatch/styles and the isolated Canvas/art modules. The canonical public catalog is `supabase/seed/deep-claim-phase2-catalog.json`; it contains no seed, hidden world or future expedition answers.

Verification extends `src/test/deepClaim*`, `src/test/fixtures/deepClaimPhase2.ts`, the existing SQL/browser/headless scripts and their local-only fixtures, including `scripts/fixtures/deep-claim-phase2-extra.mjs`. All five working Deep Claim documents and the CLAUDE feature index are updated. No dependency, unrelated game, authentication, club, installation or global currency system was replaced.

### SQL deployment — applied and verified

`20261102030000_deep_claim_workforce_production.sql` was applied in one transaction with its exact original source recorded in Supabase migration history. SHA256: `c27b82ed2f5f5daf41b6ac2a514cfa44832b0ddec37d8a3b7e0abaa1f2927d12`.

The migration adds seven private tables for catalogs, candidates, owned equipment, training, production and frozen wear; preserves the original eight RPC entry points; and adds seven secured economic RPCs. It extends permitted inventory/depth and updates only the existing asset description. The prior two migration files are unchanged.

Production postflight verified **47/47 function bodies**, exactly **15 member RPC grants**, service access, anonymous denial, and **21/21 tables under RLS with no member/anonymous direct CRUD**. The installed catalog equals the tested canonical JSON; recorded migration source matches exactly. Private tables are absent from Realtime publication. Existing installation count remains 52 and the entire installation fingerprint remains `a57ebe1314691ab1449c666997ad8faf`. Deep Claim has zero installations at verification: admins install it through the existing Asset Library; this release does not override club choices. No live company or test account was created.

### Verification evidence

- Actual application typecheck: `npx tsc --noEmit -p tsconfig.app.json` passed. Scoped lint passed across all modified Deep Claim production modules, tests and scripts.
- Full unit/component suite run without competing heavy jobs: **184 files, 1,664 tests passed**.
- Actual-migration PostgreSQL suite: **55 groups passed**, including all 32 original mining groups, a real pre-0300 company/chunks/running expedition, tenant/asset authorization, daily candidate/training rules, input rollback, frozen equipment/wear, staged production, capacities, retries and idempotent collection.
- Exact release transaction separately exercised against an existing isolated company: original-source migration history, preservation, and repeat-apply guard passed. Production baseline's 26 previous function bodies matched before applying 0300.
- Headless balance: **210 mining scenarios**, 16 recipes, 10 gear definitions, finite conservation and an acyclic material graph. Processing margins are 6–34 credits per batch after input value and fees. A first smelter/copper pickaxe is attainable from mined inputs with 56 cash left in the tested route; no NPC input buying or equipment resale exists.
- Browser QA: **109 unique passing checks across split runs**, five 320px/390px/landscape/desktop, theme and reduced-motion cases, the original mining journey and reliability checks, and **20 complete industry checks**. Real SQL-backed screens performed mining/sales/builds/hire/train/smelt/craft/polish/equip/work/wear/repair/retire, including reload and a lost committed acknowledgement. The first combined run stopped on a test locator that expected an exact Stores label despite its ready-count badge; only that fixture was corrected, then the full industry section passed. No production code changed between those runs and neither run had browser runtime errors.
- Final production build passed in **14.01 seconds**. The game remains lazy loaded; no large engine or asset dependency was added.

### Remaining work and limits

Phase 3 is next: richer geological caverns, environmental hazards, surveying, infrastructure/routes and special discoveries. Phase 4 research/contracts/industrial depth, Phase 5 club projects/standings/source-backed DH Feats/notifications, and Phase 6 finished authored atlas/music/presentation remain separate work. Existing procedural art and synthesized sound are original initial presentation, not a claimed finished commercial art pack or soundtrack.

Recent history remains bounded in the public snapshot while full records persist. Offline progress is reconciled on authorized reads/mutations; no cron or unattended notification delivery is claimed. Company credits remain isolated from DH Score. PGlite serializes transactions, so native multi-connection deadlock stress remains unverified. Production schema/security/source were checked without impersonating a live member; authenticated public-domain play and public publishing require separate deployment evidence.

## Phase 1 historical release record

The following records describe the earlier Phase 1 release and its verification at that time. Current Phase 2 behavior and verification above supersede its forward-looking phase references.

## Delivered phase

Phase 0 architecture and Phase 1 first playable mining operation were published as `4baca192378d68d11ddd25a553dc2874ec75ac3a`, from baseline main `c0c786e409a6eb1384458802da631e4e68352483`.

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

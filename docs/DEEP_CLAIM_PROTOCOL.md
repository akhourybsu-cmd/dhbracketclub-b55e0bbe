# Deep Claim technical protocol

Phase 0 architecture, Phase 1 mining, and Phase 2 workforce/production protocol. The implementation ledger records actual verification and deployment; this protocol describes the implemented contracts rather than asserting that a migration is already live.

## Ownership and authority

An authenticated member owns one company in their active club. Authentication, membership, asset installation, and onboarding belong to DH Club. `deep-claim` must be installed and enabled; private game state is never a public club leaderboard. Every backend entry point independently validates access. Changing clubs or removing membership removes access to that club's company without transferring its property.

PostgreSQL is authoritative for money, energy, assignments, terrain mutations, finite deposits, rewards and timestamps. Clients have no direct write grants to these records. Backend functions use a fixed search path, company row locks, validated references, and transactional receipts. Internal generation and reconciliation helpers have no anonymous or authenticated execution grants.

## World and version boundaries

The logical mine is 96 tiles wide, with 32×32 chunk addressing. Surface is y=0; positive y is underground. Generation expands only into needed chunks; the representation has no fixed bottom. Shaft levels support 49/99/149/299m. Phase 2 adds amethyst/gold-bearing deep seams; complete later-region hazards, caverns and infrastructure remain future content.

The company seed, unrevealed terrain, reward plans and future discoveries remain private. Global 4×3 mineral clusters cross chunk boundaries; coal follows horizontal bands and deeper geology favors iron and silver. Eight small hand-authored starter assay seams are explicitly separate from ordinary generated geology. A versioned immutable procedural base is distinct from sparse reveal, excavation and remaining-deposit mutations. Existing chunks retain their generation version. Completed expeditions and their receipts are never rerolled by a balance update.

The client receives explicitly revealed terrain only. A renderer must not reconstruct unknown tiles from a public seed or generate plausible-but-uncommitted tunnels. Fog represents missing information; it is not a second world generator.

World-generation versions and expedition rules are independent. The company world/seed and every existing chunk remain unchanged. A new chunk at chunk-y five or deeper uses generation version two; an existing version-one chunk continues to generate its unseen cells with the original algorithm. Only new dispatches use expedition configuration two. An in-flight version-one expedition keeps its original milestones, cargo, and equipment-free settlement.

## Expedition transaction and reconciliation

1. Preview checks the requested crew, objective, target, duration, energy, wages, access, storage and slots without spending anything. Estimates are ranges.
2. Dispatch locks company state, validates the current configuration again, checks the idempotency fingerprint, deducts wages and each worker's energy, reserves workers, and freezes the rule/configuration snapshot and server timestamps.
3. Private deterministic milestones encode travel, preparation, work, haul and return. Only milestones whose server offsets have elapsed may be applied.
4. Reading or mutating a company lazily reconciles elapsed milestones. Offline progression does not depend on a browser timer, an online competitor or reliable cron delivery.
5. A return milestone settles exactly once, releases workers, persists the expedition log, and leaves cargo ready for collection. Three preceding work checkpoints commit cumulative ordered withdrawals, clearing one cell before excavation proceeds beyond it.
6. Collection transfers actual settled cargo in registry order exactly once per request. Partial collection leaves the remainder ready and blocks every new dispatch until resolved. Already-dispatched crews can still return, so staging is bounded by crew slots. A new partial transfer after making room is a new intentional request; retrying the previous receipt never transfers twice.

The visual system may interpolate a worker along a disclosed route or animate a pickaxe. It cannot create resource balances or excavate new cells. Closing the browser, changing local time, or returning on another device does not change the outcome.

## Workforce and owned equipment

The server persists three hiring candidates per company/operating day, rotating through seven specialist profiles. Refreshing cannot reroll the pool. Hiring atomically checks housing, cash and the candidate's immutable identity; a hired worker retains that identity and appearance. Housing starts at three and quarters levels one/two/three increase capacity to six/nine/twelve. Existing starter workers, IDs, XP and energy are preserved. Wages are explicit worker data and apply at dispatch only.

Training costs thirty credits and raises one base statistic by up to three, capped at 100. One immutable receipt per worker/operating day enforces the limit. An assigned worker cannot train. Public worker `stats` already include level and functioning equipment bonuses; consumers must not add those bonuses again.

Each owned equipment item has an ID, frozen definition, durability, and at most one worker assignment. Slots are tool/head/utility; lanterns, cargo gear and survey instruments compete for utility. Replacing or removing gear checks that both the previous and proposed worker are idle. Dispatch freezes effective stats and item wear obligations. On completion of a configuration-two expedition, each assigned item loses two durability per energy spent exactly once. Configuration-one expeditions incur no retroactive wear. Broken items provide no bonus but never prevent basic work.

Repairs consume server-quoted credits and actual materials. Retiring an unassigned item is permanent, returns no currency or materials, and preserves its audit record. Owned non-retired gear plus uncollected crafting outputs is capped at 48. Retirement makes room without creating an equipment-resale profit loop.

## Production transaction and collection

Sixteen versioned recipes cover four metals, quartz polishing, amethyst cutting and ten equipment items. A real station and its required level are mandatory. The tool station is also the equipment workshop; Deep Claim does not create another DH FORGE module. Raw minerals and refined inventory IDs are separate, and refined goods can never appear as terrain.

Starting production locks company state, validates one to ten batches, consumes all input materials and credits atomically, and freezes the recipe, equipment definition, station speed, output quantities and server timestamps. Each station has one serial timeline. Jobs whose start is in the future remain `active` in storage but display as queued. A company can have at most three uncollected production jobs across stations. Upgrading a station shortens future jobs only.

Authorized reads/mutations reconcile elapsed jobs to ready exactly once. A client countdown cannot mint outputs. Material collection uses real warehouse space and leaves overflow staged, with later intentional partial transfers using new receipts. Equipment is instantiated once on collection. Both the job status and request receipt prevent duplicate outputs, including a retry with a lost acknowledgement. Any ready mining haul or production job must be collected before another mining dispatch; ready production also occupies its queue slot until resolved. Starting more work cannot evade the three-job or equipment-cap limits. There is no automatic production loop, NPC input purchase, or cancellation refund.

## Energy and operating calendar

Each worker starts with six energy per operating day. Quick/Standard/Deep shifts cost one/two/three energy for every assigned worker and last 20/60/180 minutes. The one-time induction run is accelerated on the server. The server validates `clubs.settings.timezone` against PostgreSQL IANA names, using America/New_York when absent or invalid. The company persists its next UTC reset boundary; zone changes are adopted at the next reset, rather than granting repeated energy immediately. Timestamps remain UTC and database timezone conversion handles 23/25-hour daylight-saving days. Offline days never accumulate more than six energy.

## Retry, isolation and client behavior

Every economic mutation carries a UUID request identity and a validated argument fingerprint. Reusing the identity with different arguments is rejected. Retrying a committed request restores authorized current state without spending or awarding again. Company locking serializes conflicting device actions; independent companies do not share a lock.

React Query keys include account and club. Responses carry a company revision; an older response cannot replace newer state. Pending mutation identities survive interrupted requests, are account/club scoped, and are never silently replayed as a new purchase. Loading uses the shared timeout guard and exposes a retry. Cached data is informational while disconnected; purchases, dispatches and collection require server confirmation.

## Database and public API

Phase 1 has fourteen private tables: `dc_rules`, `dc_companies`, `dc_worlds`, `dc_chunks`, `dc_tiles`, `dc_workers`, `dc_expeditions`, `dc_expedition_workers`, `dc_plans`, `dc_milestones`, `dc_reservations`, `dc_inventory`, `dc_requests` and `dc_logs`. Phase 2 adds `dc_equipment_catalog`, `dc_recipes`, `dc_candidates`, `dc_equipment`, `dc_training`, `dc_production_jobs` and `dc_job_equipment`. All 21 tables use RLS and deny anonymous/member direct CRUD. `dc_tiles` contains only revealed/mutated cells, not millions of untouched blocks. Versioned chunk seeds, original plans, definitions and argument receipts are immutable. Reservations protect every finite cell affected by an expedition.

Fifteen RPCs are executable by authenticated members. The original eight retain their names and authorization boundaries:

| RPC | Inputs / behavior |
|---|---|
| `dc_get()` | Authorized lazy reconciliation and bounded public snapshot. |
| `dc_reconcile()` | Same trusted-time operation; no client time override. |
| `dc_bootstrap(p_name,p_request_id)` | One company per owner/club; exact retry checks before creation. |
| `dc_preview(p_worker_ids,p_mode,p_target_x,p_target_y,p_duration_minutes,p_tutorial)` | Read-only authorized quote with costs, capacity, risk-efficiency label, route and blocking reasons. |
| `dc_dispatch(...preview inputs,p_expected_revision,p_request_id)` | Revalidate, reserve, pay wages/energy, freeze plan. |
| `dc_collect(p_job_id,p_request_id)` | Atomic partial/full settled-cargo transfer. |
| `dc_sell(p_resource_key,p_quantity,p_expected_revision,p_request_id)` | Server-priced sale; no client price or money authority. |
| `dc_upgrade(p_building_key,p_expected_revision,p_request_id)` | Permanent validated level/capacity/depth/tool improvement. |
| `dc_hire(p_candidate_id,p_expected_revision,p_request_id)` | Hire one available daily candidate within housing capacity. |
| `dc_train(p_worker_id,p_stat,p_expected_revision,p_request_id)` | Paid daily idle-worker training. |
| `dc_assign_equipment(p_item_id,p_worker_id,p_expected_revision,p_request_id)` | Assign, replace or remove an item; null worker removes. |
| `dc_repair_equipment(p_item_id,p_expected_revision,p_request_id)` | Consume the quoted repair cost/materials. |
| `dc_retire_equipment(p_item_id,p_expected_revision,p_request_id)` | Permanently retire unassigned gear without a refund. |
| `dc_start_production(p_recipe_key,p_batches,p_expected_revision,p_request_id)` | Spend inputs and queue a frozen server-timed recipe. |
| `dc_collect_production(p_job_id,p_request_id)` | Collect actual ready materials/equipment without duplication. |

Public snapshots contain schema/server time/revision, company, stock, workers, revealed world, expeditions, building levels and recent logs. Schema two adds daily candidates, owned equipment, production jobs and public recipe/equipment catalogs. The new client also reads schema one for safe rollout; version-two payloads require complete version-two collections. Active expedition cargo remains null. Ready cargo is what remains staged; collected expedition history retains the original haul and must never be interpreted as pending stock. Recent collected jobs and visible logs are bounded; full underlying history remains persisted. Cursor history remains a future extension.

Fresh receipt writes, including no-op company creation requests, are limited to 120 per member per minute. Authorization is checked before retry lookup. Argument fingerprints include scope and optimistic revision; exact retries are checked before changing eligibility. Reused UUIDs with changed arguments are rejected. The client stores only unfinished action identity/arguments in `dh:deep-claim:pending:v1:<user>:<club>` and clears that namespace on sign-out. A definitive SQL rule rejection clears the intent; an uncertain response retains it for explicit confirmation.

Economic investments preserve two operating credits. Dispatch also requires cash after wages plus liquid stock plus guaranteed finite cargo to preserve that recoverable minimum, preventing a depleted one-stone seam from bankrupting an otherwise empty company. No bailout currency is minted. Risk remains a transparent operational-efficiency category; random injuries, cave-ins and permanent loss are not implemented.

## Deferred extension points

Surveying, infrastructure and recovery objectives; full regional hazards; contracts, research, DH Feats, club projects and notifications remain phase extensions. They must reuse the same ownership, version, transaction and inventory boundaries. No parallel DH Score or global currency is introduced.

## Deployment

SQL migrations are reviewed and exercised in isolated PostgreSQL before application. Discovery registers the global asset without installing it in clubs. Actual applied migration versions and verification results belong in `DEEP_CLAIM_IMPLEMENTATION.md`; a file on disk is not evidence of production deployment.

# Deep Claim technical protocol

Phase 0 architecture and Phase 1 protocol. This document distinguishes the supported launch loop from future systems. The implementation ledger records actual verification and deployment.

## Ownership and authority

An authenticated member owns one company in their active club. Authentication, membership, asset installation, and onboarding belong to DH Club. `deep-claim` must be installed and enabled; private game state is never a public club leaderboard. Every backend entry point independently validates access. Changing clubs or removing membership removes access to that club's company without transferring its property.

PostgreSQL is authoritative for money, energy, assignments, terrain mutations, finite deposits, rewards and timestamps. Clients have no direct write grants to these records. Backend functions use a fixed search path, company row locks, validated references, and transactional receipts. Internal generation and reconciliation helpers have no anonymous or authenticated execution grants.

## World and version boundaries

The logical mine is 96 tiles wide, with 32×32 chunk addressing. Surface is y=0; positive y is underground. Generation expands only into needed chunks; the representation has no fixed bottom. Launch shaft technology limits accessible depth. Initial supported geological bands are Surface Seams and Ironworks. Later geological zones are future content, not clickable unfinished destinations.

The company seed, unrevealed terrain, reward plans and future discoveries remain private. Global 4×3 mineral clusters cross chunk boundaries; coal follows horizontal bands and deeper geology favors iron and silver. Eight small hand-authored starter assay seams are explicitly separate from ordinary generated geology. A versioned immutable procedural base is distinct from sparse reveal, excavation and remaining-deposit mutations. Existing chunks retain their generation version. Completed expeditions and their receipts are never rerolled by a balance update.

The client receives explicitly revealed terrain only. A renderer must not reconstruct unknown tiles from a public seed or generate plausible-but-uncommitted tunnels. Fog represents missing information; it is not a second world generator.

## Expedition transaction and reconciliation

1. Preview checks the requested crew, objective, target, duration, energy, wages, access, storage and slots without spending anything. Estimates are ranges.
2. Dispatch locks company state, validates the current configuration again, checks the idempotency fingerprint, deducts wages and each worker's energy, reserves workers, and freezes the rule/configuration snapshot and server timestamps.
3. Private deterministic milestones encode travel, preparation, work, haul and return. Only milestones whose server offsets have elapsed may be applied.
4. Reading or mutating a company lazily reconciles elapsed milestones. Offline progression does not depend on a browser timer, an online competitor or reliable cron delivery.
5. A return milestone settles exactly once, releases workers, persists the expedition log, and leaves cargo ready for collection. Three preceding work checkpoints commit cumulative ordered withdrawals, clearing one cell before excavation proceeds beyond it.
6. Collection transfers actual settled cargo in registry order exactly once per request. Partial collection leaves the remainder ready and blocks every new dispatch until resolved. Already-dispatched crews can still return, so staging is bounded by crew slots. A new partial transfer after making room is a new intentional request; retrying the previous receipt never transfers twice.

The visual system may interpolate a worker along a disclosed route or animate a pickaxe. It cannot create resource balances or excavate new cells. Closing the browser, changing local time, or returning on another device does not change the outcome.

## Energy and operating calendar

Each worker starts with six energy per operating day. Quick/Standard/Deep shifts cost one/two/three energy for every assigned worker and last 20/60/180 minutes. The one-time induction run is accelerated on the server. The server validates `clubs.settings.timezone` against PostgreSQL IANA names, using America/New_York when absent or invalid. The company persists its next UTC reset boundary; zone changes are adopted at the next reset, rather than granting repeated energy immediately. Timestamps remain UTC and database timezone conversion handles 23/25-hour daylight-saving days. Offline days never accumulate more than six energy.

## Retry, isolation and client behavior

Every economic mutation carries a UUID request identity and a validated argument fingerprint. Reusing the identity with different arguments is rejected. Retrying a committed request restores authorized current state without spending or awarding again. Company locking serializes conflicting device actions; independent companies do not share a lock.

React Query keys include account and club. Responses carry a company revision; an older response cannot replace newer state. Pending mutation identities survive interrupted requests, are account/club scoped, and are never silently replayed as a new purchase. Loading uses the shared timeout guard and exposes a retry. Cached data is informational while disconnected; purchases, dispatches and collection require server confirmation.

## Database and public API

Fourteen private tables implement the slice: `dc_rules`, `dc_companies`, `dc_worlds`, `dc_chunks`, `dc_tiles`, `dc_workers`, `dc_expeditions`, `dc_expedition_workers`, `dc_plans`, `dc_milestones`, `dc_reservations`, `dc_inventory`, `dc_requests` and `dc_logs`. `dc_tiles` contains only revealed/mutated cells, not millions of untouched blocks. Versioned chunk seeds, original plans and argument receipts are immutable. Reservations protect every finite cell affected by an expedition.

Exactly eight RPCs are executable by authenticated members:

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

Public snapshots contain schema/server time/revision, company, stock, workers, revealed world, expeditions, building levels and recent logs. Active cargo is null. Ready cargo is what remains staged; collected history retains the original haul and must never be interpreted as pending stock. Recent collected jobs are bounded to twelve and visible logs to twenty; full underlying history remains persisted. Phase 2 can add cursor history without rewriting those records.

Fresh receipt writes, including no-op company creation requests, are limited to 120 per member per minute. Authorization is checked before retry lookup. Argument fingerprints include scope and optimistic revision; exact retries are checked before changing eligibility. Reused UUIDs with changed arguments are rejected. The client stores only unfinished action identity/arguments in `dh:deep-claim:pending:v1:<user>:<club>` and clears that namespace on sign-out. A definitive SQL rule rejection clears the intent; an uncertain response retains it for explicit confirmation.

Upgrades preserve two operating credits. Dispatch also requires cash after wages plus liquid stock plus guaranteed finite cargo to preserve that recoverable minimum, preventing a depleted one-stone seam from bankrupting an otherwise empty company. No bailout currency is minted. Risk is a transparent operational-efficiency category in Phase 1; random injuries, cave-ins and permanent loss are not implemented.

## Deferred extension points

Surveying, infrastructure and recovery objectives; equipment, processing and hiring; expanded regions and hazards; contracts, research, DH Feats, club projects and notifications are phase extensions. They must reuse the same ownership, version, transaction and inventory boundaries. No parallel DH Score or global currency is introduced.

## Deployment

SQL migrations are reviewed and exercised in isolated PostgreSQL before application. Discovery registers the global asset without installing it in clubs. Actual applied migration versions and verification results belong in `DEEP_CLAIM_IMPLEMENTATION.md`; a file on disk is not evidence of production deployment.

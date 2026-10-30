# Rune Delve persistence

The campaign, hero identity, class tracks, owned relics and shard wallet remain account-wide. The visual redesign and Expeditions preserve existing campaign progress; migration `20261031000000_rune_delve_settlement.sql` does not reset players.

## Campaign settlement

`rune_delve_save_run(p_run, p_request_id)` commits the saved result, class and hero totals, XP, campaign unlock, failure counter, shard reward and third relic slot in one transaction. It locks the authenticated account, verifies the canonical chamber and class unlock, merges independent personal bests, and records an immutable acknowledgement in `rune_delve_action_receipts`.

Retries with the same request ID and input return that acknowledgement without paying or counting the run again. Reusing an ID with different input fails. The client retains unacknowledged IDs in session storage under `rd-action-v1:` and freezes the pending submission until it is acknowledged. A confirmed action clears its pending key. Receipts are readable only by their owner; member clients cannot insert or update receipts.

XP comes from the server score formula, with the existing new-personal-best rule. Class XP and lifetime counters use relative additions. Class levels and titles reach level 150. The server computes clear/replay/failure shard bases from saved first-clear state, failure count, equipped owned Compass rank and the path choice. Optional treasure/mastery/secondary-goal telemetry is bounded. Campaign combat remains the existing client simulation; this protocol is a transaction and retry guarantee, not authoritative replay validation.

Migration `20261031020000_rune_delve_quality_fixes.sql` includes bounded boss-phase progress in failed boss rewards and commits campaign quest events with the run receipt when the client includes the explicit `quest_context` handoff. Cached older clients without that field retain their existing client-side reporting, so deploying the migration cannot double-count their events. Kill, chain, score, shard and XP progress use the settled run; ability count, boss defeats and damage-free clears use bounded optional telemetry. Every finished attempt advances run-completion quests; clear quests require a victory. Receipt retries return the original quest-completion acknowledgement without repeating any progress.

`rune_delve_ensure_level(p_definition)` creates a missing canonical chamber ID so member runs always have a valid foreign key. It never overwrites existing chamber rows. The deterministic generator still hydrates all gameplay fields on read.

## Relics and rewards

- `rune_delve_buy_relic(p_relic_id, p_expected_rank, p_request_id)` debits the wallet and delivers ownership or the next rank together. Null expected rank buys; an integer upgrades. Costs and tier gates come from the server catalog. Already-owned purchases cost nothing; stale upgrade ranks fail without spending. Future catalog price changes need a corresponding migration.
- `rune_delve_equip(p_class, p_slot_1, p_slot_2, p_slot_3)` enforces ownership, unique relics and the wallet's third-slot unlock.
- `rune_delve_save_daily(p_kills, p_score, p_class, p_request_id)` saves the UTC-day best and streak atomically. Only the day's first submitted attempt grants currency/XP and lifetime-run credit, and reports daily completion plus actual score, kills, shards and XP to quests. Better later attempts can improve the record without a second reward or quest increment.
- `rune_delve_claim_quest(p_quest_id)` claims a completed owned quest and credits both currencies together. A failed payment leaves the quest claimable; an already-claimed quest returns zero additional reward.
- `rune_delve_report_quest(p_event)` applies relative progress to the currently displayed quests in current UTC day/week periods, with max semantics for chain length. Prior periods and quests belonging to another class do not accrue incidental progress.

The internal XP helper is unavailable to member clients. Existing RLS and DH Feats triggers on campaign run rows remain in place. Optional relic drops are displayed only after ownership is confirmed; optional bestiary/quest requests do not hold the acknowledged result screen open.

## Loading and standings

All Rune data hooks use a 12-second request deadline and explicit retry controls instead of silently converting fetch errors into empty equipment or a fresh save. Lazy creation uses insert-if-missing semantics so a competing tab cannot reset an existing wallet or class track.

Campaign, daily and chamber standings use the active club's verified public directory. Their cache identities include account and club. Private testing identities are excluded, including from their own competitive standings.

Production account tables retain a historical `club_id` column. New rows inherit the member's current club, while existing rows keep their original values. Account owners can read their saves after a club transfer; peer standings require current shared club membership. The existing restrictive member/workspace privacy policies remain in force. These changes do not rewrite or reset player rows.

## Expedition DH Feats

Migration `20261031010000_rune_expedition_feats.sql` adds three Rune families: banked rooms, six-room victories and highest cleared expedition tier. The original 63 definitions stay unchanged; the deployed board has 66 families and 329 tier unlocks. The additive client manifest lives in `src/lib/feats/runeExpeditionCatalog.json`; feat actions open `/rune-delve/expedition`.

Only banked runs with positive cleared rooms qualify. Active/replaced tickets do not progress feats. The existing server evaluator and permanent receipt system award DH points; finish acknowledgements cannot double-count. Meaningful expedition dates participate in the existing deduplicated active-day metric, and Expedition/campaign activity contributes one Rune feature to All-Rounder. Existing private-account standings exclusions remain in force. The first bank acknowledgement also advances gameplay score/shard quests; a six-room victory reports class completion and its boss defeat. Receipt retries do not repeat these events.

## Verification

```bash
node node_modules/vitest/vitest.mjs run src/test/runedelve/persistence.test.tsx
RUNE_PGLITE_MODULE=/path/to/pglite/dist/index.js node scripts/test-rune-settlement-db.mjs
node scripts/test-rune-feats-db.mjs
```

The PostgreSQL script creates an isolated in-memory database using the production column defaults, nullability, checks, club foreign keys and RLS policies in `scripts/fixtures/rune-schema.sql`. It exercises migration reruns, acknowledged retries, best-of merges, class gates, transaction rollback, catalog spending, rank races, equipment validation, daily rewards, atomic campaign quest sources, boss failure rewards, quest counters/claims, club transfers, private-account exclusions and receipt privileges. Its queued concurrent requests share PGlite's single connection; the SQL per-account locks also serialize independent production connections.

# Rune Delve persistence

The campaign, hero identity, class tracks, owned relics and shard wallet remain account-wide. The balance migration `20261031030000_rune_delve_balance_pass.sql` preserves XP totals, currency, relic ranks, campaign records and historical receipts. Existing earned levels never decrease; the new XP curve can raise levels and unlock the third relic slot sooner.

## Campaign settlement

`rune_delve_save_run(p_run, p_request_id)` commits the saved result, class and hero totals, XP, campaign unlock, failure counter, shard reward and third relic slot in one transaction. It locks the authenticated account, verifies the canonical chamber and class unlock, merges independent personal bests, and records an immutable acknowledgement in `rune_delve_action_receipts`.

Retries with the same request ID and input return that acknowledgement without paying or counting the run again. Reusing an ID with different input fails. The client retains unacknowledged IDs in session storage under `rd-action-v1:` and freezes the pending submission until it is acknowledged. A confirmed action clears its pending key. Receipts are readable only by their owner; member clients cannot insert or update receipts.

The server awards first-clear XP from chamber depth: `30 + floor(1.2 × max(0, chamber − 50))`, plus up to 10 score XP and 25 XP at every 25th first clear. Meaningful replays award 25% of that base, bounded to 8–45 XP, plus a bounded improvement bonus; a one-point record no longer repays a full clear. Meaningful defeats award diminishing progress XP. Each next hero level costs `100 + 10 × (level − 1)` XP, up to level 150. Class XP and lifetime counters use relative additions, and recomputation preserves any higher previously earned level. The server computes clear/replay/failure shard bases from saved first-clear state, failure count, equipped owned Compass rank and the path choice. Optional treasure/mastery/secondary-goal telemetry is bounded. Campaign combat remains the existing client simulation; this protocol is a transaction and retry guarantee, not authoritative replay validation.

Campaign settlement includes bounded boss-phase progress in failed boss rewards and commits quest events with the run receipt. The balance migration makes this the sole producer, including bounded default events for cached clients without `quest_context`; direct client quest reporting is denied. Kill, chain, score, shard and XP progress use the settled run; ability count, boss defeats and damage-free clears use bounded optional telemetry. Every finished attempt advances run-completion quests; clear quests require a victory. Receipt retries return the original quest-completion acknowledgement without repeating any progress.

`rune_delve_ensure_level(p_definition)` creates a missing canonical chamber ID so member runs always have a valid foreign key. It never overwrites existing chamber rows. The deterministic generator still hydrates all gameplay fields on read.

## Relics and rewards

- `rune_delve_buy_relic(p_relic_id, p_expected_rank, p_request_id)` debits the wallet and delivers ownership or the next rank together. Null expected rank buys; an integer upgrades. Costs and tier gates come from the server catalog. Already-owned purchases cost nothing; stale upgrade ranks fail without spending. Future catalog price changes need a corresponding migration.
- `rune_delve_equip(p_class, p_slot_1, p_slot_2, p_slot_3)` enforces ownership, unique relics and the wallet's third-slot unlock.
- `rune_delve_save_daily(p_kills, p_score, p_class, p_request_id)` saves the UTC-day best and streak atomically. Zero kills grants no new currency, completion or lifetime-run credit. The first positive attempt counts completion once; higher daily bests award only the missing reward difference, with totals capped at 900 shards and 500 XP per UTC day. Shard thresholds are 1/3/6/10/15/22/30 kills for 25/75/150/250/400/600/900 shards. Stars require 3/8/16 kills. Existing payments remain paid, including historical zero-kill awards; receipts recover the actual amount when an old unpaid attempt improved the best. Streak credit requires at least one star.
- `rune_delve_claim_quest(p_quest_id)` claims a completed owned quest and credits both currencies together. A failed payment leaves the quest claimable; an already-claimed quest returns zero additional reward.
- `rune_delve_report_quest(p_event)` is internal to authenticated source settlements. It applies relative progress to current UTC day/week quests, with max semantics for chain length. Prior periods and quests belonging to another class do not accrue incidental progress. Members cannot call it directly or modify assignments, progress, status or catalog rewards.

The internal XP/drop helpers and legacy arbitrary shard mint/spend RPCs are unavailable to member clients. Rune wallet, relic ownership/ranks, class XP, campaign progress, run records, loadouts and quest state cannot be mutated directly. Safe bootstrap, class selection and quest assignment RPCs derive their defaults and entitlements on the server; the only direct hero update is the owner's cosmetic name. Existing RLS and DH Feats triggers on campaign run rows remain in place. Optional relic drops are delivered by campaign settlement and stored in its receipt, then displayed after ownership is confirmed; optional bestiary/quest requests do not hold the acknowledged result screen open.

## Loading and standings

All Rune data hooks use a 12-second request deadline and explicit retry controls instead of silently converting fetch errors into empty equipment or a fresh save. Lazy creation uses the account-locked, insert-if-missing bootstrap RPC so a competing tab cannot reset an existing wallet or class track.

Campaign, daily and chamber standings use the active club's verified public directory. Their cache identities include account and club. Private testing identities are excluded, including from their own competitive standings.

Production account tables retain a historical `club_id` column. New rows inherit the member's current club, while existing rows keep their original values. Account owners can read their saves after a club transfer; peer standings require current shared club membership. The existing restrictive member/workspace privacy policies remain in force. These changes do not rewrite or reset player rows.

## Expedition DH Feats

Migration `20261031010000_rune_expedition_feats.sql` adds three Rune families: banked rooms, six-room victories and highest cleared expedition tier. The original 63 definitions stay unchanged; the deployed board has 66 families and 329 tier unlocks. The additive client manifest lives in `src/lib/feats/runeExpeditionCatalog.json`; feat actions open `/rune-delve/expedition`.

Only banked runs with positive cleared rooms qualify. Active/replaced tickets do not progress feats. The existing server evaluator and permanent receipt system award DH points; finish acknowledgements cannot double-count. Meaningful expedition dates participate in the existing deduplicated active-day metric, and Expedition/campaign activity contributes one Rune feature to All-Rounder. Existing private-account standings exclusions remain in force. The first positive-room bank acknowledgement credits equal shard and class-XP rewards (112–238 for a full clear), advances gameplay score/shard/XP and class-completion quests, and reports its boss defeat for a six-room victory. Zero-room and abandoned runs earn no currency or XP. Receipt retries do not repeat these events.

## Verification

```bash
node node_modules/vitest/vitest.mjs run src/test/runedelve/persistence.test.tsx
RUNE_PGLITE_MODULE=/path/to/pglite/dist/index.js node scripts/test-rune-settlement-db.mjs
node scripts/test-rune-feats-db.mjs
node scripts/test-rune-balance-db.mjs
```

The PostgreSQL script creates an isolated in-memory database using the production column defaults, nullability, checks, club foreign keys and RLS policies in `scripts/fixtures/rune-schema.sql`. It exercises migration reruns, acknowledged retries, best-of merges, class gates, transaction rollback, catalog spending, rank races, equipment validation, daily rewards, atomic campaign quest sources, boss failure rewards, quest counters/claims, club transfers, private-account exclusions and receipt privileges. Its queued concurrent requests share PGlite's single connection; the SQL per-account locks also serialize independent production connections.

The balance contract runs as `SET ROLE authenticated` with a JWT user identity in the isolated database. It verifies denied arbitrary writes and minting, safe account/quest bootstrap, preserved legacy balances/XP/earned levels/receipts, first-clear and replay rewards, bounded finite treasure, receipt-backed drops, daily best differences and old-payment recovery, and durable Expedition XP settlement. It applies the balance migration twice to verify safe reruns.

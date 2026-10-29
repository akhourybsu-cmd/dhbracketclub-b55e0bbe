# Nexus Defense — Endless balance audit, ruleset 4

The sweep ran the actual deterministic combat engine **864 times**: six equipment loadouts × six purchase/ability policies × eight seeds × three research tiers (0, 3 and 10 in all tracks). Policies act every 0.75 simulated seconds. The outcome includes real projectiles, mortar impacts, chains, collisions, armor, abilities, purchases and energy accounting. These are repeatable automated policies, not optimal human play or live telemetry.

## Survival by loadout

Medians below combine five active purchase policies and eight seeds per research tier (40 runs per cell). Idle runs are reported separately.

| Loadout | Fresh median wave (range) | Level-3 research | Level-10 research | Fresh median minutes |
| --- | --- | --- | --- | --- |
| Starter pulse only | 14 (13–16) | 16 (14–18) | 19 (18–20) | 10.2 |
| Orbit + repair | 14 (14–17) | 17 (16–19) | 19 (19–21) | 11.6 |
| Arc + orbit + stasis | 17 (15–18) | 19 (17–21) | 22 (20–23) | 14.3 |
| Rail + orbit + repair | 16 (16–17) | 18 (17–19) | 21 (21–23) | 11.5 |
| Arc + mortar + siphon | 17 (15–19) | 19 (18–20) | 22 (21–23) | 12.3 |
| Mortar + orbit + stasis | 19 (16–20) | 20 (19–22) | 23 (21–25) | 15.2 |

Every run ended before the 30-minute simulation ceiling. Every run conserved its energy budget: earned = spent + unspent. Fresh active starter builds clear 13–16 waves; more advanced loadouts push further. Research improves survival across every loadout. The strongest tested maximum-research run reached wave 25.

## Purchase and ability policy sensitivity

Medians combine all six loadouts and eight seeds for each policy.

| Policy | Fresh median wave | Level-3 median | Level-10 median |
| --- | --- | --- | --- |
| Balanced | 17 | 19 | 23 |
| Gunner | 17 | 19 | 21 |
| Bulwark | 16 | 18 | 21.5 |
| Control | 16 | 18 | 21.5 |
| Economy | 16 | 17 | 21 |
| Idle | 4 | 6 | 9 |

## Equipment tradeoffs

- Rail uses 3 power, so only the 1-power orbit fits beside it. It does concentrated armor-piercing damage to bosses, while orbit handles hull attackers.
- Arc and mortar fit together at 4 power. Arc applies immediate chained damage; mortar delivers delayed splash to clustered enemies. Siphon trades protection for more run upgrades.
- Mortar + orbit + stasis was the strongest general-purpose combination in this benchmark. The slower first line and dense inner ring favor area damage. This is a known tuning bias, not a claim that every combination is equally strong.
- Orbit + repair adds an inner defensive layer and improves several policies, but has the same fresh median as starter when all policies are combined. Buying additional blade/repair levels early can delay pulse investment. Its lower power cost and later pairing with rail/mortar are part of its value.
- Idle policies clear materially fewer waves than active ones and cannot create an immortal core, even at maximum research.

## Permanent progression pacing

The wave payout is `min(1800, 3w + floor(w²/8))`; personal wave milestones 5/10/15/20/25 pay 20/35/55/85/120 once. Zero-wave runs pay nothing. Equipment costs 1,530 credits in total, and six level-3 research tracks cost 878.

Four sequential progression journeys (two seeds, arsenal-first and research-first priorities) use real balanced-policy combat outcomes. They bank each run, buy equipment/research at the real prices and change the next loadout as weapons become available. They are illustrative savings paths, not fixed promises for players.

| Savings policy | First auxiliary | All equipment | All research tracks at level 3 | Total simulated play for both goals |
| --- | --- | --- | --- | --- |
| Arsenal first | Run 1 | Run 17 | Run 24 | 5.5–5.5 hours |
| Research first | Run 1 | Run 25 | Run 10 | 5.5–5.5 hours |

Both journey seeds produce the same purchase-run milestones. The arsenal-first path unlocks everything by run 17, while the research-first path reaches level-3 core research by run 10 and completes the armory at run 25. These choices intentionally compete for the same permanent currency. Early cash-outs and different purchases change the timing. Faster 2× combat reduces wall-clock play time; the table uses simulated 1× time.

## Verification and limits

- 363 unit tests across 42 files passed, including current loadout/progression guardrails, real mortar geometry and delayed hits, archived weapon mechanics and checkpoint validation.
- Isolated PostgreSQL tests apply the migration twice and compare all 103 upgrade-level points, all 60 research prices and all seven equipment unlocks with the client. Free initial weapon levels, module restrictions, power budgets, ownership, milestone retries, old-protocol isolation, ledger RLS and club records are covered.
- Browser checks use actual production UI/hooks/engine with an isolated backend. They cover starter locks, earning/purchasing/equipping, loadout persistence, cash-out, offline reward retry, actual weapon damage, abilities and both themes. Touch checks span eight portrait/landscape/tablet/desktop sizes and dynamic safe areas.
- Combat remains client-simulated. Server settlement checks accounting and session consistency; it is not authoritative anti-cheat.
- Human testing is still needed to assess the feel of 10–16 minute runs, the late-game mortar/stasis bias, first-weapon impact and long-term retention. This is a measured first balance pass.

## Reproduce

```sh
node --import tsx scripts/balance-nexus-core.ts --output=/tmp/nexus-balance.json
node --import tsx scripts/balance-nexus-progression.ts
node --import tsx scripts/nexus-endless-contract.ts > /tmp/nexus-endless-contract.json
# With optional @electric-sql/pglite available:
node scripts/test-nexus-endless.mjs
```

`src/test/nexus/coreBalance.test.ts` guards starter viability, access to the first weapon, loadout contribution, research gains, survival bands and finite endgame runs. Full sweep JSON includes per-run wave, duration, damage, purchases and currency budgets.

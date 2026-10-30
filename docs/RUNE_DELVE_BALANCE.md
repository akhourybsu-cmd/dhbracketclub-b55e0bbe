# Rune Delve balance pass · October 2026

Campaign, Expeditions and the daily Arena now share honest class damage, ability costs and long-chain damage tiers. This pass makes late encounters demand build choices while keeping early progression attainable. Existing player progress is retained.

## Combat and builds

- Warrior red chains deal +20%; Rogue earns +15% on five-or-longer red chains and Shadowstep costs two mana. Mage and Cleric use the shared base rune damage, without hidden class multipliers.
- Opening Strike waits for the first red chain. Primed Shadowstep cannot stack. Mage Overflow counts paid mana, preventing free casts from generating refunds.
- Every equipped relic rank above one grants two maximum health, in addition to its named effect. Opening-mana, free-cast, lifesteal and reflection ranks have bounded, distinct effects; Spiked Aegis improves reflection more than the cheaper Brambleward.
- Automatic campaign power reaches 1.10× at chamber 50, 1.25× at 100 and 1.45× at 150. Equipment and mastery progression supply the rest. Scaling remains continuous beyond 150.
- Score objectives require combat-earned damage/defeats; opening health and unused turns cannot clear a chamber. Treasure coordinates pay once per encounter. Boss rules remain attached to their authored owner when minions appear.

## Campaign pressure

Later rooms favor their native chapter roster. Role-specific HP ceilings preserve fragile/support/tank differences. A wave contains at most one durable regular foe and one independent ability, avoiding stacked attack spikes. Bosses have meaningful floors, phases and reinforcement budgets.

The final sweep used **14,400 encounters**: 24 varied boards for each of four classes across all 150 chambers. Affordable profiles follow earned class levels 1/5/12/24/40 at chambers 1/15/50/100/150, with rank 1–3 equipment and the third slot when earned.

| Class   | Chapter 2 clears | Chapter 3 clears | Chamber 150 clears | Chapter 3 minimum HP, average |
| ------- | ---------------: | ---------------: | -----------------: | ----------------------------: |
| Warrior |            85.4% |            90.5% |              70.8% |                          54.7 |
| Mage    |            87.5% |            93.5% |              58.3% |                          54.5 |
| Rogue   |            92.2% |            90.5% |              62.5% |                          49.2 |
| Cleric  |            98.0% |            98.1% |               100% |                          61.9 |

Under the prior encounter curve, comparable affordable profiles cleared nearly every late chamber with substantially more health and shorter fights. Cleric retains a sustain advantage: its final boss win averages 16.5 turns versus 10–12 for the other classes. The goal is distinct strengths rather than identical clear rates. First-chapter attentive-policy clears remain above 99%.

A separate 600-case canonical-board check uses each actual campaign seed once. It is a deterministic reachability check, not 600 independent probability trials. The immediate-utility solver loses some canonical boards that need different planning/builds; varied-board percentages are not predicted human win rates.

## Expedition pressure and drafts

Vault adds three moves and four blessing choices. Drafts always offer an offense or tempo option and stop offering capped Battery/Firstlight/Phoenix ranks; old saves retain already-earned ranks. Fury grants damage at full health and more below half health. Long chains gain the shared damage tiers but still consume one Expedition move.

Upper Ascensions introduce visible escalating attack pressure; the final boss accelerates below half health. Move budgets stay humane. In the larger **400-run Ascension 8 sweep**, every failure came from health loss rather than move exhaustion.

| Class   | Ascension 1, smart 50 | Ascension 4, smart 50 | Ascension 8, smart 100 |
| ------- | --------------------: | --------------------: | ---------------------: |
| Warrior |                  100% |                   96% |                    69% |
| Mage    |                  100% |                  100% |                    65% |
| Rogue   |                  100% |                  100% |                    75% |
| Cleric  |                  100% |                   98% |                    74% |

The ordinary three-to-five-rune policy clears Ascension 4 in 32–54% of runs, demonstrating a useful strategy advantage. Policies have bounded search and fixed draft preferences, not human learning or multi-turn foresight. Ascension 8 winners remain diverse: 95–99 distinct blessing builds across 100 seeds per class.

## Arena pace and rewards

The production clock now shares guarded attacks and reflection with other modes. Long chains gain tier damage, later regular HP is bounded, and each field has at most one promoted elite. Pressure increases through attack cadence and simultaneous enemies rather than oversized HP.

**1,200 timed simulations**, 75 seeds per class at four decision cadences, use the actual clock and class-only combat. At a two-second chain cadence, mean kills are Warrior 13.7, Mage 14.9, Rogue 10.4 and Cleric 10.6, with 99–100% survival. At 3.5 seconds, survival falls to 68–96%; at five seconds, 32–84%. Cleric trades kill speed for endurance. The fastest 1.3-second policy averages 15–21 kills, leaving high reward tiers as stretch goals.

Daily totals by kills: **1→25, 3→75, 6→150, 10→250, 15→400, 22→600, 30→900 shards**. Stars require 3/8/16 kills; XP is ten per kill, capped at 500. Retries retain the best result and pay only unpaid improvements. Zero-kill attempts grant no new reward, completion credit or streak. Historical paid rewards remain intact.

## Progression and persistence

Class-level costs grow by ten XP per level after the initial 100. Fresh late clears pay more XP; replays pay a smaller amount and bounded record-improvement credit. Boss replay bonuses are eight shards while first-clear/boss/chapter milestones stay rewarding. Finite treasure and diminishing failure rewards reduce trivial farming. Banked Expedition results grant class XP as well as shards.

The source-backed reward migration retains total XP, shards, relic ranks, unlocks and historical receipts. Earned levels never decrease; the revised XP curve can raise levels and equipment entitlements. Campaign continuation past chamber 150 remains available. Direct wallet/XP/relic/progress/quest mutations and the arbitrary mint/report functions are revoked; authenticated bootstrap, class selection and assignment RPCs supply canonical state. Combat remains client-simulated, so bounded result telemetry is not competitive replay validation.

Live rollout verification compared aggregate fingerprints for nine player-data groups before and after migration. Currency, XP, equipment, relics, heroes, campaign frontiers/records and daily/Expedition records matched exactly, excluding intended level/title changes and new receipt columns. QA uses isolated data and never awards live accounts.

## Reproduce

```bash
node node_modules/esbuild/bin/esbuild scripts/balance-rune-campaign.ts --bundle --platform=node --format=esm --outfile=/tmp/rune-campaign.mjs
node /tmp/rune-campaign.mjs --all --runs=24 --profile=earned-affordable --output=/tmp/rune-campaign.json
node node_modules/esbuild/bin/esbuild scripts/balance-rune-expedition.ts --bundle --platform=node --format=esm --outfile=/tmp/rune-expedition.mjs
RUNE_EXP_SAMPLES=100 RUNE_EXP_ASCENSIONS=8 RUNE_EXP_POLICIES=smart node /tmp/rune-expedition.mjs
node node_modules/esbuild/bin/esbuild scripts/balance-rune-arena.ts --bundle --platform=node --format=esm --outfile=/tmp/rune-arena.mjs
node /tmp/rune-arena.mjs --samples=75 --output=/tmp/rune-arena.json
node scripts/test-rune-balance-db.mjs
```

The [checked-in measurements](balance/rune-delve-2026-10.json) include seeds, model assumptions and summaries. Validation passed 779 unit tests, app TypeScript, production build, and changed production/harness lint. The repository-wide lint command still reports unrelated legacy errors; the dynamic browser transport fixture retains its existing permissive row typing. Database runtime checks passed 17 balance, 21 settlement, 10 Expedition and 8 Feat groups.

Final browser reruns for this pass were not completed: the cloud sandbox blocked local browser/network execution while additional-permission calls remained pending. The updated menu, viewport, complete-journey and daily-retry scripts are committed for a later run. Prior viewport results are not claimed as verification of this balance revision.

# Nexus long-game pass — ruleset 6

The release expands the endless build game and removes upgrade scrolling during combat. It targets an ongoing career beyond fifty hours; this is a pacing model, not a claim of fifty hours of human playtesting or fifty hours of unique authored levels.

## Playability

All upgrades in the selected Attack, Weapons, Defense or Utility tab fit on the command deck. A compact numeric preview, level, energy price and accessible mechanical description remain on every purchase. The battlefield, health, abilities and four tabs remain visible. Grid space stays stable when switching categories. Research/equipment bays wrap their selectors while keeping purchase/equip/deploy actions visible. Reference dialogs may scroll independently.

## Build space

The pulse cannon is permanent. Two auxiliary hardpoints share four power; one of five support modules accompanies them. Seven auxiliary choices include close-contact blades, chains, piercing rail, delayed mortar, heat-ramping laser, corrosion and flak. Distinct delivery, targeting, reach, armor interactions and costs create different weaknesses. Corrosion refreshes instead of stacking; laser heat resets after losing its target. Capacitor encourages active ability timing. Retaliation trades sustain for damage after enemies make contact; its health-scaled component is capped at four times its flat damage.

New equipment arrives after the early armory: flak (140 lifetime waves, 850 credits), laser (250 / 1,400), capacitor (400 / 1,800), corrosion (650 / 2,800) and retaliation (1,000 / 3,500). There are six progressively unlocked threats, 180 research levels, eleven career ranks through 15,000 lifetime waves and twelve medals. Early equipment and the original research prices remain attainable; later progress competes with saving for different builds.

## Combat evidence

A 37-run actual-engine sweep covered representative builds, research levels 0/10/30 and threats 1/3/6. All runs ended and conserved energy. These are scripted purchase/ability policies, not optimal play.

| Build | Frontier, research 0 | Frontier, research 30 | Singularity, research 30 |
| --- | --- | --- | --- |
| Rail + blades / repair | 29 waves, 15.0 min | 52 waves, 22.8 min | 28 waves, 13.1 min |
| Laser + flak / capacitor | 24 waves, 12.3 min | 48 waves, 22.3 min | 26 waves, 13.2 min |
| Corrosion + arc / stasis | 27 waves, 13.9 min | 52 waves, 23.8 min | 28 waves, 14.0 min |

Times above are game time at 1×; 2× halves combat clock time. Starter pulse without research reached 23 waves in 12.25 minutes under the balanced policy. Unresearched builds on Singularity reached only 2–3 waves, so unlocking a threat does not imply being ready for it. Mature builds are finite and no tested weapon pair wins indefinitely.

## Career pacing model

`balance-nexus-long-game.ts` simulates sequential careers with the actual engine. It banks only real wave rewards, buys eligible equipment/research at real prices, and updates the next build. It uses two deterministic seeds, cheapest eligible equipment and research, reserves for near-term equipment, conservative entry to higher threats, and the **fastest 2× combat speed**. It excludes menu time, offline time and arbitrary waits. Repeated identical build/research/tier/seed states reuse the corresponding actual-engine result.

The 60-hour model evaluated 224 distinct combat states. At one hour it owned seven equipment items, at five hours eight; at 25 hours ten; by 50 hours all twelve. Research ranged from level 22 to 24 at 50 hours, with the conservative policy still using threat 5. By 60 hours it had reached threat 6, research 24–25 and roughly 14,677 lifetime waves. The final career rank and full research were still ahead. Unlock availability, spending preferences, earlier cash-outs, chosen loadouts and human ability timing change these timings. Players can enter unlocked threats sooner than this conservative policy.

This provides a measurable long-term foundation. Live play feedback is still needed to judge repetition, progression friction, weapon preferences and retention. Further content should add tactical choices rather than extend the same price curve alone.

## Reproduce

Release checks passed: 437 unit tests, application type checking, scoped lint, production build, nine PostgreSQL contract groups, the 37-run combat sweep, the 60-hour career model, and eight-size combat/equipment/game-feel browser matrices. The live migration and its migration-history entry were applied and verified before frontend sync.

```sh
npx tsc -p tsconfig.app.json --noEmit
npm run test:unit
npm run build
node --import tsx scripts/balance-nexus-long-game.ts --hours=60
node --import tsx scripts/balance-nexus-expansion.ts > /tmp/nexus-expansion.jsonl
NEXUS_QA_URL=http://127.0.0.1:8080 node scripts/check-nexus-mobile.mjs
NEXUS_QA_URL=http://127.0.0.1:8080 node scripts/check-nexus-game-feel.mjs
NEXUS_QA_URL=http://127.0.0.1:8080 node scripts/check-nexus-threats.mjs
NEXUS_QA_URL=http://127.0.0.1:8080 node scripts/check-nexus-expanded-menus.mjs
node --import tsx scripts/nexus-long-game-contract.ts > /tmp/nexus-long-game-contract.json
node scripts/test-nexus-long-game.mjs # optional @electric-sql/pglite required
```

The browser checks use production screens/hooks/engine with isolated accounts. Nine PostgreSQL contract groups cover exact prices, caps, immutable tickets, atomic payouts, research through 30, old protocol settlement and records scoped by threat. No test sends game rewards to real accounts.

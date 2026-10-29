# Nexus Defense — Endless balance audit, ruleset 5

The final sweep ran the actual deterministic combat engine **3,456 times**: all 36 legal weapon/support combinations × six purchase/ability policies × four seeds × four research tiers (0, 3, 6 and 10 in every track). Policies act every 0.75 simulated seconds. Outcomes include real projectiles, delayed mortar impacts, chains, collisions, armor, abilities, purchases and energy accounting. These are repeatable automated policies, not optimal human play or a forecast of live performance.

## Pace of play

- Enemies enter at radius 410 instead of 455 and move 30% faster. First fire occurs at **6.65 seconds**; first kills occur within 6.65–8 seconds across fresh active builds.
- The first boss arrives within **81–96 seconds**, with a median of 87 seconds across fresh active builds.
- Ordinary wave breaks drop from seven seconds to **3.5 seconds**. Boss clears give **6.5 seconds** of recovery. Pausing remains available for upgrade decisions.
- Active starter runs have an **eight-minute median at 1×**, compared with 10.2 minutes in the ruleset-4 benchmark. Developed builds generally have medians of about 10–13 minutes. The 2× option halves combat wall time.
- Fresh representative builds make a median of **six to eight purchases in the first minute**. Wave breaks occupy roughly 11–13% of run time. Timing instrumentation also records individual wave lengths, approach time, peak enemy counts and every purchase time.

Faster contact increases pressure. The health ramp therefore uses `1 + 0.20(w − 1) + 0.09 max(0, w − 7)^1.3`, compounded by `1.12^max(0,w − 10)`. Enemy counts, damage and speed continue rising. This leaves room to develop weapons and reach late milestones while preserving a finite defense.

## Survival by loadout

Medians combine five active policies and four seeds per research tier (20 runs per cell). The level-6 tier is included in the full JSON; idle runs are separate below. Wave counts mean fully cleared waves.

| Loadout | Fresh median wave (range) | Level-3 research | Level-10 research | Fresh median minutes |
| --- | --- | --- | --- | --- |
| Starter pulse only | 14 (14–18) | 18 (16–19) | 20 (19–22) | 8.0 |
| Orbit only | 18 (17–19) | 19 (19–21) | 22 (22–23) | 10.7 |
| Orbit + repair | 19 (18–19) | 19 (19–21) | 22 (22–24) | 11.1 |
| Arc + orbit + stasis | 20 (19–22) | 22 (19–23) | 24 (23–26) | 12.0 |
| Rail + orbit + repair | 20 (19–22) | 22 (21–23) | 24 (24–27) | 10.5 |
| Arc + mortar + siphon | 18 (17–19) | 20 (19–22) | 23.5 (23–25) | 9.9 |
| Mortar + orbit + stasis | 19 (18–21) | 22 (20–24) | 24 (23–26) | 11.3 |

All **3,456 runs ended** before the 30-minute ceiling, and all conserved energy: earned = spent + unspent. The strongest run cleared wave **27**. Maximum research can now reach the wave-25 milestone. A separate stress test installs every eligible upgrade at its cap with maximum research: each representative full loadout still falls before wave 40 and within 20 simulated minutes.

## Weapon and support changes

| System | Ruleset-5 tuning and role |
| --- | --- |
| Pulse | Retains 11 base damage and reliable homing fire. Haste, critical chance and multishot remain specific to pulse. |
| Orbital blades | Contact damage 12.8 → 18; contact radius 28 → 36. Small swarms attacking the hull can now be hit. A visible contact aura follows the actual reach. |
| Chain arc | Base damage 36 → 40; recharge 2.8 → 2.5 seconds; jump reach 110 → 135; retained damage per jump 82% → 86%. Chains cover separated crowds and can extend beyond detection range through neighbors. |
| Rail lance | Base damage 140 → 170; starting recharge 4.8 → 4.4 seconds. Strongest-target aim, piercing geometry and armor bypass retain its anti-armor role. |
| Siege mortar | Base damage 75 → 56; starting blast radius 85 → 74; recharge 3.8 → 4.2 seconds. Radius grows by five per additional level. Delayed, committed ground impacts still reward dense clusters. |
| Repair nanites | Starting repair 0.5 → 2.5 hull/second plus 20% maximum hull. Hull purchases gain the same fortification multiplier; upgrade previews show the correct restored amount. |
| Stasis | Starting slow 12% → 10%; upgrades add 6% each, for a maximum of 34%. Slowing remains useful without extending every engagement as strongly. |
| Siphon | Retains 10% starting energy income and exclusive income upgrades, trading protection for investment. Fractional income carries forward. |

The first orbital unlock now produces a clear gain: fresh orbit-only median survival is four waves above pulse-only. Representative full builds cluster within two fresh median waves, compared with a five-wave gap between the former orbit/repair and mortar/stasis builds. Rail/orbit/stasis remains the strongest general build in this benchmark (fresh median 21.5, maximum-research median 25). Stasis often adds about one wave; repair now helps several fresh loadouts and competes better at higher research. Equipment is not expected to give identical outcomes under every purchase policy.

Actual damage attribution confirms that auxiliaries contribute: representative fresh builds get roughly 27% of damage from arc, 34% from rail and 18–22% from mortar. Orbit/repair gets about 24% from blades. Nova uses its own permanent research track; amplifier copy now explicitly describes pulse and auxiliary damage.

## Purchase and ability policy sensitivity

Medians below combine all 36 loadouts and four seeds per policy. Build plans compete for the same energy and use Nova/Overdrive in response to threats.

| Policy | Fresh | Level 3 | Level 6 | Level 10 |
| --- | --- | --- | --- | --- |
| Balanced | 19 | 21 | 23 | 24 |
| Gunner | 19 | 20 | 22 | 23 |
| Bulwark | 18 | 19 | 22 | 23 |
| Control | 18 | 19 | 22 | 23 |
| Economy | 18 | 19 | 21 | 22 |
| Idle | 4 | 5 | 6 | 9 |

Idle cores finish substantially earlier than active builds, even with maximum research. Extra research and unlocked weapons do not create perpetual idle income.

## Permanent progression

Prices, upgrade caps and currency payouts are retained. Run energy never converts to permanent credits. Wave pay is `min(1800, 3w + floor(w²/8))`; personal milestones 5/10/15/20/25 pay 20/35/55/85/120 once. Zero-wave runs pay nothing. The armory costs 1,530 credits; level 3 in all six research tracks costs 878.

Four sequential journeys use real balanced-policy combat, two seeds and the actual purchase gates. They bank each run, buy equipment/research and change the next loadout. These are illustrative savings paths, not fixed promises.

| Savings priority | First auxiliary | All equipment | All research tracks at level 3 | Total play for both goals at 1× |
| --- | --- | --- | --- | --- |
| Arsenal first | Run 1 | Run 13 | Run 20 | 3.85–3.88 hours |
| Research first | Run 1 | Run 19 | Run 8 | 3.63 hours |

The first unlock arrives early, with hours of further equipment/research progression. Early cash-outs, purchase choices and manual ability use change these timings. At 2×, combat takes about half the listed wall time. Account-wide milestone history is preserved across balance releases, preventing duplicate milestone payouts.

## Compatibility and verification

- **376 unit tests across 43 files pass.** Coverage includes pacing bounds, real current-rules chain reach, orbital contacts, repair healing and fortified hull purchases, finite fully capped defenses and existing mechanics.
- Exact ruleset-4 starter, rail/repair and mortar/stasis simulation outcomes remain unchanged. Restored runs use their original combat rules, speed and breaks; unknown future rulesets are rejected.
- **13 isolated PostgreSQL contract groups pass**, including repeated migrations, all 103 upgrade-level points, 60 research prices, seven unlocks, loadout eligibility, accounting, milestones, RLS, version matching, cached-client settlement and separate current records.
- Type checking, scoped lint and the production build pass. Browser checks cover actual pages/hooks/engine with an isolated backend, reward retries, loadout purchases, actual weapon damage and both themes. Mobile/menu checks cover eight portrait, landscape, tablet and desktop sizes, touch controls, safe areas, pausing and saved resumes.
- Combat remains client-simulated; server settlement validates accounting and session consistency. The benchmark measures repeatable automated play. Human play sessions remain the next source for judging ability timing, upgrade clarity and retention.

## Reproduce

```sh
node --import tsx scripts/balance-nexus-core.ts --all --output=/tmp/nexus-balance.json
node --import tsx scripts/balance-nexus-progression.ts
node --import tsx scripts/nexus-endless-contract.ts > /tmp/nexus-endless-contract.json
# With optional @electric-sql/pglite available:
node scripts/test-nexus-endless.mjs
```

`--quick` runs the six representative builds with fewer seeds and policies. `--version=4` reproduces the previous combat rules. The JSON includes per-run survival, duration, weapon damage, timing and currency budgets. `coreBalance.test.ts` and `corePacing.test.ts` keep the intended survival bands, early tempo, research gains, finite endgame and save compatibility under regression checks.

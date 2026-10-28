# Nexus Defense — balance audit, ruleset 3

The final sweep uses the actual fixed-step combat engine: 1,248 runs, 13 scenarios, six policies, eight seeds, and fresh / level-3 permanent research. Policies make purchase and ability decisions every 0.75 simulated seconds. Seeded geometry, critical hits, actual projectiles, chained hits, armor, and currency spending are included. This is a repeatable tuning benchmark; it does not replace human playtesting.

## Campaign clear rates

Five active build policies per research tier; unattended runs are tracked separately.

| Sector | Fresh core clears | Level-3 research clears |
| --- | --- | --- |
| 1 | 40/40 | 40/40 |
| 2 | 40/40 | 40/40 |
| 3 | 40/40 | 40/40 |
| 4 | 40/40 | 40/40 |
| 5 | 40/40 | 40/40 |
| 6 | 40/40 | 40/40 |
| 7 | 16/40 | 40/40 |
| 8 | 2/40 | 28/40 |

The opening sector was cleared by every active policy; idle cores failed all eight seeds. The last two sectors raise pressure during the run rather than overwhelming every defensive build in wave one. Fresh balanced cores cleared the finale in 2/8 seeds. With level-3 research, balanced and bulwark policies cleared 8/8, control and economy 6/8. Pure gunner policies failed the finale at this tier: players must add fortification, adjust their build, or research further.

## Endless survival

| Policy | Fresh median wave | Level-3 median wave | Level-3 range |
| --- | --- | --- | --- |
| Balanced | 19 | 21 | 21–21 |
| Gunner | 16 | 19 | 19–19 |
| Bulwark | 17 | 19 | 19–19 |
| Control | 17.5 | 19 | 19–19 |
| Economy | 16.5 | 18.5 | 18–19 |
| Idle | 2 | 4 | 4–4 |

All endless runs terminated. Active level-3 policies stayed within approximately three waves of one another; idle play was substantially weaker. These policies are static examples, not optimal play.

## Challenge clear rates

| Challenge | Fresh clears | Level-3 clears |
| --- | --- | --- |
| Rush | 40/40 | 40/40 |
| Glass | 40/40 | 40/40 |
| Siege | 40/40 | 40/40 |
| Blackout | 40/40 | 40/40 |

Challenges are currently alternate rulesets that are accessible with competent builds, rather than endgame difficulty gates. No-upgrade policies failed all of them.

## Currency pacing

- Energy is an integer run budget. Fractional siphon bonuses carry forward instead of disappearing to per-kill rounding. Starting energy + collected energy = purchased upgrades + unspent energy. There is no conversion into permanent credits.
- First six campaign clears pay 932 research credits. Level 3 in all six research tracks costs 878 credits, putting the intended research tier within reach before the final two sectors.
- First-clear bonuses are paid once per account/scenario. Repeat victories still pay for waves: 20 for sector 1, 96 for sector 8.
- Endless payouts increase with depth: 65 at wave 10, 180 at wave 20, capped at 1,500. A zero-wave loss pays zero.
- Research costs grow by 1.35 per level. All 60 displayed research prices and 83 cumulative in-battle upgrade prices were compared against real PostgreSQL settlement logic.

## Correctness fixes behind the tuning

- Cooldown overshoot is preserved, so fire-rate improvements match displayed shots per second, including overdrive.
- Pulse shots reserve expected lethal damage and retarget if their enemy dies.
- Arc chains visit each target once; rail beams pierce their line and bypass armor. Orbital collision reaches enemies attacking the hull.
- Damage counters record actual HP removed, including armor and overkill; kills are credited to the responsible system.
- Shield regeneration waits three seconds after a hit. Stasis and nova use the stronger movement slow.
- Server-issued deployment IDs, immutable research snapshots, bounded run counters, and an energy ledger guard credit settlement. First-clear allocation and research spending are serialized by profile row locks.
- Every new credit debit/award has an account-scoped receipt; duplicate result retries reuse the existing award. Combat remains client-simulated, rather than being an authoritative anti-cheat server.

## Reproduce

`node --import tsx scripts/balance-nexus-core.ts --output=/tmp/nexus-balance.json`

`src/test/nexus/coreBalance.test.ts` guards onboarding viability, research progression, survival bands, and finite maximum-research endless runs. The JSON report includes per-run purchases, damage by weapon, budgets, score, duration, and outcomes.

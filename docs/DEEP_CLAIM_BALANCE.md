# Deep Claim balance reference

Version-one Phase 1 values. SQL is authoritative; the public arithmetic model exists for explanations and headless verification, never client rewards.

## Session rhythm

| Shift | Server duration | Energy per worker |
|---|---:|---:|
| Induction, once per company | approximately 30 seconds | 1 |
| Quick run | 20 minutes | 1 |
| Standard shift | 60 minutes | 2 |
| Deep expedition | 180 minutes | 3 |

Each persistent worker receives six energy per America/New_York operating day. Workers cannot overlap jobs. Wages are paid at dispatch; no unattended recurring payroll drains a returning player's account. A small crew is an investment in distinct capabilities, not an anonymous population counter.

## Functional workforce statistics

Mining controls excavation efficiency. Geology improves deposit identification and useful yield. Engineering affects hard-rock efficiency and travel machinery. Logistics improves cargo. Safety reduces operational losses. Endurance improves sustained work. Leadership rewards crew coordination. The version-one formulas must be shared by server preview and settlement, and described in worker/dispatch tooltips. Cosmetic statistics are not launch content.

## Launch economy

Eight launch material IDs are stone, clay, coal, copper_ore, tin_ore, iron_ore, quartz and silver_ore. Each must be genuinely obtainable and saleable; later raw/refined IDs remain separate. The initial warehouse is deliberately finite. Full warehouses leave cargo staged and require a storage decision, not a disappearing reward.

Upgrade branches compete for the same isolated company money: office capacity, shaft depth/travel, warehouse capacity and tool efficiency. They must retain a viable operating reserve or another bounded recovery path so buying an upgrade cannot permanently strand a new company.

Coal remains a useful commodity at launch and becomes processing fuel in later phases. Common-material crafting demand, quality specimens, fluctuating markets, research and contracts are not silently counted as completed launch systems.

## Measurement requirements

The headless balance script must check casual and active schedules, exploration and extraction strategies, wage coverage, finite deposit exhaustion, storage staging, reachable first upgrades and the absence of repeat-claim profit. Device performance and network speed do not influence mining output. Random outcomes use private, versioned server seeds and bounded work budgets.

## Version-one prices and finite starter claim

| Material | Credits per unit | Initial assay units |
|---|---:|---:|
| Stone | 1 | 12 |
| Clay | 2 | 16 |
| Coal | 4 | 10 |
| Copper ore | 8 | 18 |
| Tin ore | 10 | 12 |
| Iron ore | 14 | 15 |
| Quartz | 12 | 8 |
| Silver ore | 30 | 3 |

These are finite samples, not regenerating daily awards. Their total gross sale value is 744 credits. With the initial 180 credits, the company can realize at most 924 before wages from all starter stock; this cannot fund all upgrades. Normal generated deposits form clustered seams, with small host-rock stone/clay and larger industrial veins. Scouting can clear consecutive adjacent host cells within a bounded withdrawal quota; ore and work are conserved.

| Building | Level 1→2 | Level 2→3 | Functional levels |
|---|---:|---:|---|
| Office | 90 | 1,200 | 1 / 2 / 3 simultaneous crews |
| Shaft | 80 | 2,000 | 49 / 99 / 149m supported depth; infrastructure through 6 / 56 / 106m |
| Warehouse | 60 | 1,000 | 120 / 240 / 480 units |
| Tool station | 50 | 1,600 | 100 / 125 / 150% extraction output |

First upgrades total 280; final upgrades total 5,800; all eight cost 6,080. The two-credit operating reserve applies in addition. Existing frozen expeditions use their dispatch plan, so a new tool upgrade cannot recalculate an active haul.

Mara/Ivo/Tessa have base wages 3/2/2 multiplied by the preset energy cost. The tutorial consumes ten actual coal and twelve actual stone and clears two passages. A solo Mara induction costs three and returns gross value 52: 49 net, cash 229 after sale. The default three-worker crew costs seven and reaches cash 225 after sale. Both can immediately afford a first upgrade, with several competing investments.

XP is twelve per preset energy on completion. Level = min(10,1+floor(XP/60)); effective stats gain level−1, capped at 100. Versioned rational calculations preserve exact floor/ceiling parity with PostgreSQL numeric arithmetic. Logistics limits cargo, travel and haul; engineering affects setup; mining/geology/safety/endurance and leadership affect productivity; the six starter traits provide distinct travel, output, reveal or carrying effects. The risk label describes operational demand, not a promised injury probability.

## Headless evidence and limits

Run `node scripts/simulate-deep-claim.mjs`. The initial harness covers 168 crew/duration/material combinations, cargo and finite-deposit conservation, operating-capital protection and the starter-stock bound. Early rich-seam analysis exposed the original one-hour all-upgrades path; the finite three-unit silver sample and revised final-tier prices close that specific path. This is not proof of a universal minimum playtime for every future geological seed.

Manufacturing, hiring and research strategy simulations belong to their implementation phases. The launch harness must not claim to simulate systems that do not exist. Longer multi-day field balancing and richer market/resource demand should be repeated as those systems arrive.

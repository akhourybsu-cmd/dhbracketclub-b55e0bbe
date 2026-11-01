# Deep Claim balance reference

Version-one mining values plus version-two workforce/production. SQL is authoritative; the public arithmetic model exists for explanations and headless verification, never client rewards. The canonical public Phase 2 catalog is `supabase/seed/deep-claim-phase2-catalog.json`; SQL embeds the same versioned values.

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

Coal is both a commodity and processing fuel. Stone/clay feed crafting and repairs. Quality specimens, fluctuating markets, research and contracts remain future systems.

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

Phase 2 extends the harness with production/workforce arithmetic and reachable first manufacturing investments. Longer multi-day field balancing and richer market/resource demand should be repeated as those systems arrive; a bounded simulator is not proof of a universal commercial-length progression curve. Research strategies remain unimplemented.

## Phase 2 workforce and equipment

Daily hiring offers three of seven persistent specialist profiles. Hire costs range from 80 to 125 credits and wages from two to four per preset energy. These are visible before hiring and paid at dispatch, never as unlimited unattended payroll. Quarters build/upgrade costs are 90/450/1,200 and provide six/nine/twelve total worker slots, compared with three before construction. Crew size remains one to three; office levels still allow one/two/three simultaneous expeditions.

Training costs 30 credits for up to three base-stat points, once per idle worker per operating day, capped at 100. It grants no energy. Higher levels still add the original capped XP bonus. Effective statistics are computed once by the backend, including functioning gear.

Ten craftable items cover two tiers of pickaxes, helmets, lanterns, cargo gear and survey instruments. Tool/head/utility slots force a choice between utility benefits. Tier-one durability is 100; tier two is 140. Configuration-two shifts wear each equipped item by two/four/six for Quick/Standard/Deep. A basic item therefore lasts fifty Quick or sixteen full Deep shifts before breaking. Old configuration-one shifts have no new wear.

Tier-one repairs cost `ceil(missing durability × 0.20)` plus the item's material bundle; tier-two repairs use 0.30. Materials range from common stone/clay/coal/quartz to an iron bar or finished crystal for advanced items. No repair is free when damaged. Full condition is not a paid improvement. There are at most 48 owned/pending equipment items; unassigned items can be permanently retired with no resale or material refund.

## Phase 2 production economy

Each station has one serial production lane and the company has at most three uncollected jobs. One to ten batches may be committed together. Station levels two/three use 85/70% of the base per-batch seconds, rounded up before multiplying by batches. Station upgrades do not accelerate existing jobs. Inputs and credits are consumed at job creation; outputs are unavailable until real server time has elapsed and collection succeeds.

| Recipe | Inputs per batch | Credits | Base seconds | Outputs | Net sale value added |
|---|---|---:|---:|---|---:|
| Copper | 10 copper ore + 2 coal | 8 | 180 | 2 copper bars | 14 |
| Tin | 10 tin ore + 2 coal | 10 | 240 | 2 tin bars | 12 |
| Iron | 12 iron ore + 3 coal | 12 | 300 | 3 iron bars | 18 |
| Silver | 8 silver ore + 3 coal | 16 | 420 | 2 silver bars | 22 |
| Quartz | 6 quartz | 6 | 180 | 3 polished quartz | 6 |
| Amethyst | 4 amethyst | 16 | 480 | 2 cut amethyst | 34 |

The added value rewards industry but always consumes finite mined inputs, operating credits and station time. There is no NPC input purchase, automatic loop, cancellation refund, equipment resale or conversion back into raw ore. Copper bars sell at 55, tin 65, iron 70, silver 145, polished quartz 28 and cut amethyst 125. New raw amethyst/gold ore sell at 50/45. Gold ore is also an advanced survey-kit input.

Smeltery build/upgrade costs are 90/350/900; gem workshop costs are 120/450/1,100. The existing tool station crafts equipment, with tier-two recipes requiring level two. A first copper pickaxe costs one copper bar, four stone, twenty credits and four processing minutes after smelting. Keeping some starter coal/copper/stone instead of selling every material therefore creates a real early investment choice. Every new economic action preserves the existing operating-reserve rule.

Shaft level four costs 5,000 and supports 299m, extending the shaft corridor to 256m. Deep generation adds amethyst and gold-bearing clusters in newly generated version-two chunks from 160m; previously frozen version-one chunks and unseen cells inside them retain their original geology. This is a depth expansion, not completion of the full six-region/hazard roadmap.

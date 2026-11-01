# Deep Claim balance reference

Version-one mining, version-two workforce/production, version-three underground operations and version-four business development. SQL is authoritative; public arithmetic exists for explanations and headless verification, never client rewards. Canonical public catalogs are `supabase/seed/deep-claim-phase2-catalog.json`, `supabase/seed/deep-claim-phase3-catalog.json` and `supabase/seed/deep-claim-phase4-catalog.json`; SQL embeds the same versioned values.

Phase 5's separate social catalog is `supabase/seed/deep-claim-phase5-catalog.json`. It changes neither the private snapshot schema nor existing mining/research/production formulas. DH Feat definitions live in `src/lib/feats/deepClaimCatalog.json` and extend the existing permanent score ledger.

## Session rhythm

| Shift | Server duration | Energy per worker |
|---|---:|---:|
| Induction, once per company | approximately 30 seconds | 1 |
| Quick run | 20 minutes | 1 |
| Standard shift | 60 minutes | 2 |
| Deep expedition | 180 minutes | 3 |

Each persistent worker receives six energy per operating day in the authoritative club timezone, with America/New_York as the fallback. Workers cannot overlap jobs. Wages are paid at dispatch; no unattended recurring payroll drains a returning player's account. A small crew is an investment in distinct capabilities, not an anonymous population counter.

## Functional workforce statistics

Mining controls excavation efficiency. Geology improves deposit identification and useful yield. Engineering affects hard-rock efficiency and travel machinery. Logistics improves cargo. Safety reduces operational losses. Endurance improves sustained work. Leadership rewards crew coordination. The version-one formulas must be shared by server preview and settlement, and described in worker/dispatch tooltips. Cosmetic statistics are not launch content.

## Launch economy

Eight launch material IDs are stone, clay, coal, copper_ore, tin_ore, iron_ore, quartz and silver_ore. Each must be genuinely obtainable and saleable; later raw/refined IDs remain separate. The initial warehouse is deliberately finite. Full warehouses leave cargo staged and require a storage decision, not a disappearing reward.

Upgrade branches compete for the same isolated company money: office capacity, shaft depth/travel, warehouse capacity and tool efficiency. They must retain a viable operating reserve or another bounded recovery path so buying an upgrade cannot permanently strand a new company.

Coal is both a commodity and processing fuel. Stone/clay feed crafting, repairs and infrastructure. Phase 3 introduces finite quality specimens with permanent keep/sell/salvage choices. Phase 4 adds paid research, finite delivery contracts and company milestones; fluctuating markets remain a future system.

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

Phase 2 extends the harness with production/workforce arithmetic and reachable first manufacturing investments. Phase 4 adds research dependencies, alloy production and finite business rewards. Longer multi-day field balancing and richer market/resource demand should be repeated as those systems arrive; a bounded simulator is not proof of a universal commercial-length progression curve.

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

## Phase 3 field operations

Shaft level five costs 12,000, supports 599m and extends the main corridor to 556m. No other original building price, inventory sale price or worker/production cap changes. Generation-three rooms can appear only in previously absent chunks from row one/depth 32. Existing generation-one/two chunks and frozen plans retain their geology. New companies can encounter rooms earlier; an older company's already-defined chunks remain intact.

Survey and infrastructure presets use grade one/two/three for Quick/Standard/Deep. Each participating employee pays the original one/two/three energy and their wage. Surveys return no cargo and cannot fund their own wages; they require sufficient operating cash or liquid stock. They provide safe information and open choices for subsequent extraction, rather than free materials.

Cash must cover the complete wage and project fee upfront. Recoverable reserve is `cash − wages − project fee + collected stock sale value − consumed project material sale value + actual guaranteed cargo value`, and must remain at least two. Survey/construction cargo is zero. Pending finds, owned gear and unfinished processing are excluded. Recompute the quote after rail improves the known extraction estimate, and enforce the final check against the actual frozen haul. Consuming construction inputs cannot be counted twice or left in the reserve calculation.

Survey radius is `min(4, grade + floor(average geology / 50))`. The unknown-tile limit is `min(41, 8 × grade + floor(average geology / 10) + 2 × Ore Eye workers)`. Cells use a stable distance/x/y order within the Manhattan diamond and current supported depth. No-new-ground scans are rejected. Revealing a deposit never removes its rock or makes a disconnected chamber reachable.

| Project | Grade-one fee | Grade-one material inputs | Benefit |
|---|---:|---|---|
| Supports | 12 | 8 stone + 2 clay | Reduce rockfall chance at covered sites |
| Ventilation | 18 | 1 copper bar + 2 coal | Reduce gas chance at covered sites |
| Pump | 22 | 1 iron bar + 4 stone | Reduce water-delay chance at covered sites |
| Rail | 16 | 1 iron bar + 2 stone | Improve the covered portion of actual transport routes |

Multiply each construction fee/input by grade; wages are additional. Construction reserves real employees and a site until return. Radius is `6 + 2 × (grade − 1) + floor(average engineering / 50)`, spanning six through twelve logical tiles. Safety-project strength is `3 + 2 × grade + floor(average engineering / 25)` percentage points. Rail strength is `min(40, 5 + 10 × grade + floor(average engineering / 20))` percent. Engineering is frozen at dispatch, and benefits activate only after completion.

Use the strongest applicable installed safety project of each type at the target. For rail, select the strongest covering track independently at each route point; effective route bonus is `floor(sum(point strengths) / route point count)`. Overlap never stacks, while separate track sections extend coverage. Reduce travel and return by that effective percentage, rounded up with the original twenty-second minimum. Saved travel increases productive work inside the chosen base shift; it does not award materials beyond finite deposits or carrying capacity. A small entrance track therefore cannot improve an entire deep route at full strength.

At most 128 construction/installed records may exist per company, with one project per cell. Place different project types on adjacent connected cells when their coverage should overlap. There is no resale, demolition refund or automatic recurring construction. This initial limit and absence of maintenance are explicit balance boundaries; later deep networks can expand the versioned rules without editing existing assets.

## Phase 3 risk and bounded delays

New configuration-three operations expose three depth-based severities:

- Instability: `min(3, 1 + floor(depth / 100))`.
- Gas: zero above 50m; otherwise `min(3, 1 + floor(depth / 150))`.
- Water: zero above 100m; otherwise `min(3, 1 + floor((depth − 100) / 150))`.

Base chance is `min(25, 4 + floor(depth / 25) + 2 × instability + gas + water)`. Subtract `floor(average safety / 10)` and the strongest corresponding installed protection for each active condition, with a minimum of zero. Tutorial jobs and depth below eight meters always have zero chance. Public quotes explain the actual mitigations; future private rolls are not client inputs.

A triggered incident adds `min(300, 60 × energy + floor(depth / 10))` seconds to setup, shifting work and return consistently. Zero chance has zero possible delay. The server freezes the roll and schedule once. The preset minutes remain 20/60/180, while actual job seconds include the delay. Neither cargo nor extra employee energy is lost; equipment still wears only two per energy. Safety has a real risk benefit without turning an unattended company into a punitive loss timer. Original configuration-one/two jobs retain their exact rules.

## Phase 3 specimens

Six original recoverable finds are Banded Geode, Fern Fossil, Survey Journal, Rail Relic, Crystal Cluster and Meteorite Fragment. Catalog base sale values are 30/45/60/80/150/180, subject to each definition's depth eligibility. Normal eligible fully depleted mining cells have a one-in-thirteen find chance, with at most one lifetime find per company/cell and eight per job. The original finite quartz assay at x47/y3 supplies a first geode only when newly cleared by configuration-three work; old depleted saves receive no retroactive bonus.

| Quality | Weight | Sale-value percentage | Mass percentage | Salvage multiplier |
|---|---:|---:|---:|---:|
| Common | 60 | 100 | 100 | 1 |
| Fine | 25 | 150 | 115 | 1 |
| Exceptional | 12 | 220 | 135 | 2 |
| Flawless | 3 | 300 | 160 | 3 |

Frozen sale value is `clamp(floor(base value × percentage / 100), 15, 500)`. Salvage uses only the actual displayed bundle of existing inventory IDs, with the quality multiplier. Keeping a specimen preserves its collection entry; selling or salvaging consumes the same find permanently. Salvage requires complete warehouse space and cannot partially consume a specimen. No choice grants DH Score or resets employee energy.

Twenty-four pending discoveries stop new dispatches until a decision is made. Existing crews may still return safely, keeping staging bounded to 48. The current snapshot displays all pending finds, the latest 24 kept, latest 12 other resolved and latest 24 field reports; older records persist. Longer collection browsing and a full museum remain future work.

## Phase 4 research and company development

Research office construction/upgrade costs are 80/250 credits for levels one/two. Trading-post construction/upgrades cost 60/200/500 for levels one/two/three. They do not replace the mine office, increase worker energy or alter the original building prices. Each purchase retains the two-credit operating-capital safeguard.

Fourteen once-only research nodes form seven branches with two tiers each. Tier-one orders take 300 seconds and cost 60–90 credits plus finite materials, including original processed bars for industrial branches. Tier-two orders take 1,200 seconds and cost 220–450 plus processed materials. A tier-two node requires its branch's first tier and its catalog cross-links; research-office level one/two gates the corresponding tier. One paid research order can be active at a time. Costs are consumed at start, and server-time completion activates the frozen benefit without a second collection action. Research has no cancellation or refund path.

| Node | Credits | Materials | Completed prerequisites |
|---|---:|---|---|
| Cutting Methods (`excavation_1`) | 70 | 12 stone, 6 clay | None |
| Precision Extraction (`excavation_2`) | 280 | 3 iron bars, 2 polished quartz | Excavation 1, Geology 1 |
| Field Assaying (`geology_1`) | 60 | 4 quartz, 4 clay | None |
| Crystal Analysis (`geology_2`) | 300 | 1 silver bar, 4 polished quartz | Geology 1, Deep Operations 1 |
| Alloy Practice (`processing_1`) | 80 | 1 copper bar, 1 tin bar, 4 coal | None |
| Industrial Metallurgy (`processing_2`) | 400 | 4 iron bars, 1 silver bar, 3 polished quartz | Processing 1, Excavation 2 |
| Route Planning (`logistics_1`) | 60 | 10 stone, 8 clay | None |
| Freight Engineering (`logistics_2`) | 300 | 2 steel bars, 2 copper bars | Logistics 1, Processing 2 |
| Crew Coordination (`workforce_1`) | 70 | 8 clay, 4 coal | None |
| Long Shift Training (`workforce_2`) | 220 | 2 iron bars, 2 polished quartz | Workforce 1, Safety 1 |
| Safe Work Practice (`safety_1`) | 60 | 10 stone, 4 coal | None |
| Reliable Operations (`safety_2`) | 260 | 3 iron bars, 2 copper bars | Safety 1, Deep Operations 1 |
| Worksite Engineering (`deep_operations_1`) | 90 | 1 copper bar, 10 stone | None |
| Deep Cutting Systems (`deep_operations_2`) | 450 | 3 steel bars, 1 cut amethyst | Deep Operations 1, Excavation 2, Processing 2 |

All research costs 2,700 credits and consumes materials with a combined fixed sale value of 2,673. The fourteen server timers total 175 minutes, serialized through the one-active-order limit; gathering their materials and funding the research office add real progression. Original smelting supplies the first industrial research inputs, so no new research/recipe dependency cycle prevents entry.

| Branch | First-tier benefit | Additional second-tier benefit |
|---|---|---|
| Excavation | +4 Mining | +6 Mining |
| Geology | +4 Geology | +6 Geology |
| Processing | 5% faster future production | Another 10 percentage points, 15% total |
| Logistics | +4 Logistics | +6 Logistics |
| Workforce | +4 Leadership | +6 Endurance |
| Safety | +4 Safety | +6 Safety |
| Deep Operations | +4 Engineering | +6 Engineering |

Sum completed stat bonuses after base training, XP and functioning equipment, then cap each effective statistic at 100. Public workers already contain that result. The separate research breakdown is explanatory, not another modifier to apply in the client. New expeditions freeze effective statistics through the existing configuration-three planner; old expedition plans remain unchanged.

Processing research applies only to newly started production: first apply the existing station-level modifier with its integer ceiling, then apply the research percentage with another integer ceiling and a 20-second per-batch floor. Multiply that final per-batch duration by the batch count. Research cannot accelerate an already-paid job or alter its inputs or outputs. Existing queue and equipment limits remain three uncollected jobs and 48 owned/reserved items.

## Phase 4 finite industry and rewards

Bronze, steel and gold bars are processed inventory identities with fixed positive sale prices. They never appear in generated terrain. Five new version-one recipes make these three goods, a steel pickaxe and a steel cargo harness using finite inputs, upfront credits and real station time. Their research and station requirements are validated before payment. The original sixteen recipes and ten equipment definitions remain available with their existing versions; research is not a retroactive tax on old capabilities.

| Recipe | Inputs per batch | Credits | Base seconds | Output | Required research / station |
|---|---|---:|---:|---|---|
| Bronze | 1 copper bar, 1 tin bar, 2 coal | 12 | 360 | 2 bronze bars | Processing 1 / smeltery 1 |
| Steel | 2 iron bars, 4 coal | 18 | 600 | 2 steel bars | Processing 2 / smeltery 2 |
| Gold | 8 gold ore, 3 coal | 18 | 600 | 2 gold bars | Processing 2 / smeltery 2 |
| Steel pickaxe | 3 steel bars, 1 bronze bar, 2 polished quartz | 95 | 900 | 1 owned pickaxe | Deep Operations 2 / tool station 3 |
| Steel cargo harness | 3 steel bars, 2 bronze bars, 8 clay | 85 | 840 | 1 owned harness | Logistics 2 / tool station 3 |

Bronze/steel/gold bars sell for 80/105/210 credits each. Their net added sale value after input opportunity cost and recipe credits is 20/36/30 per batch. They cannot be converted back into raw inputs. Tier-three gear has 180 durability: the pickaxe adds 26 Mining, 8 Engineering and 4 Endurance; the harness adds 26 Logistics, 8 Endurance and 4 Leadership. Missing-durability repair rates are 0.50/0.40 credits, rounded up, plus one steel bar and one polished quartz/bronze bar respectively. Existing two-per-energy wear applies; equipment has no resale value.

Contracts are twelve permanent authored deliveries, four per trading-post tier. Each order freezes its input bundle and payout and can be completed only once per company. Prerequisite deliveries and research must be complete. Fulfillment consumes the entire bundle from actual collected inventory in one transaction, then grants the documented company-credit reward. There is no partial delivery, cancellation, expiry, daily reroll or automatic repeat order. A completed order cannot consume goods or pay again under a new request UUID.

Every payout is greater than the delivered goods' fixed sale value and at most 120% of it. The premium is the finite bonus; the full payout is not free money because the delivered goods leave stock. Goods are never purchased from an NPC, so processing and contracts cannot form a buy/convert/sell loop. Neither an uncollected production output nor staged mining cargo can fund a delivery.

| Delivery | Tier | Whole input bundle | Payout | Premium over ordinary sale |
|---|---:|---|---:|---:|
| Yard Foundations | 1 | 20 stone | 24 | 4 |
| Boiler Fuel | 1 | 10 coal | 46 | 6 |
| Pottery Clay | 1 | 20 clay | 46 | 6 |
| Copper Assay | 1 | 10 copper ore | 92 | 12 |
| Copper Fittings | 2 | 4 copper bars | 250 | 30 |
| Structural Iron | 2 | 6 iron bars | 483 | 63 |
| Alloy Stock | 2 | 4 bronze bars | 368 | 48 |
| Optical Quartz | 2 | 8 polished quartz | 257 | 33 |
| Steel Bracing | 3 | 4 steel bars | 483 | 63 |
| Gold Commission | 3 | 2 gold bars | 483 | 63 |
| Crystal Instruments | 3 | 4 cut amethyst, 4 polished quartz | 703 | 91 |
| Frontier Industry | 3 | 4 steel bars, 4 bronze bars, 2 gold bars | 1,334 | 174 |

The complete catalog consumes goods worth 3,976 credits and pays 4,569: a finite 593-credit premium. Delivery/research prerequisites remain part of each frozen definition. The final order requires the preceding steel, gold and crystal commissions plus Deep Operations 2 and Logistics 2, so it cannot be claimed immediately with unrelated starter stock.

Eight company milestones pay 10–120 credits each, totaling at most 600 across the finite catalog. They recognize first completed mining, collected production, installed infrastructure, completed research, mining at 100 meters, three completed deliveries, three kept finds and industrial production. Qualifying older work contributes to progress, but payment always requires an explicit, once-only claim. No business reward grants DH Score, energy, equipment or a resource bundle.

| Milestone | Required durable progress | Credits |
|---|---|---:|
| First Shift | 1 completed mining expedition | 10 |
| First Batch | 1 fully collected production batch | 20 |
| Built to Last | 1 installed infrastructure project | 30 |
| Better Methods | 1 completed research node | 40 |
| One Hundred Down | Completed mining at depth 100m or deeper | 50 |
| Trusted Supplier | 3 completed contracts | 70 |
| Cabinet Curator | 3 kept discoveries | 80 |
| Industrialist | 40 fully collected processed material units | 100 |

These eight rewards total exactly 400 credits. Combined with the 593-credit delivery premium, Phase 4 introduces 993 credits of finite business bonuses. Deliveries also return the ordinary value of consumed goods; research, buildings, wages, recipe fees and material consumption remain real sinks. This reward budget cannot independently buy the 5,000/12,000-credit deep shaft upgrades, and supplies no repeatable daily income.

Milestone and company-record quantities come from durable server rows, including history beyond the bounded UI lists. Collected production units use frozen recipe outputs multiplied by batches, never the staged-output remainder. Partial collection and repeated requests cannot inflate production, delivery or milestone counts. Exact node costs, recipe definitions, contract inputs/payouts and milestone targets are versioned in the Phase 4 canonical catalog and must remain identical in SQL and the public arithmetic.

## Phase 5 finite club projects

Six permanent projects form the following chain. Each consumes real collected goods and freezes its goal values and pool when opened. The canonical pools are approximately thirty percent of required material sale value, always below the forty-percent ceiling.

| Project | Whole club goal | Frozen goal value | Credit pool |
|---|---|---:|---:|
| Camp Supply | 80 stone, 40 coal, 30 clay | 300 | 90 |
| Haul Extension | 12 iron bars, 40 coal, 100 stone | 1,100 | 330 |
| Clean Air Works | 10 copper bars, 8 iron bars, 50 coal | 1,310 | 393 |
| Assay Observatory | 24 polished quartz, 6 silver bars, 12 bronze bars | 2,502 | 750 |
| Deep Freight Works | 16 steel bars, 12 bronze bars, 16 iron bars | 3,760 | 1,128 |
| Geological Pavilion | 12 cut amethyst, 6 gold bars, 30 polished quartz | 3,600 | 1,080 |

Together these projects consume goods worth 12,572 company credits and offer at most 3,771 credits across the entire club. This is a finite shared material sink; the pool is not paid to every contributor in full, and projects cannot repeat or refund their inputs.

For each resource, the personal cap is `floor(goal × effective cap percent / 100)`. The frozen cap is 100%/60%/40% for one/two/three-or-more eligible public members at project creation. The effective cap is the greater of that frozen percentage and the current membership-based percentage, allowing smaller remaining groups to finish without retroactively penalizing earlier valid donations. A contribution beyond any personal/global remaining limit rejects completely.

Qualification requires `own frozen contribution value ≥ ceil(total frozen goal value × 5 / 100)`. A qualifying member's one-time company-credit award is `floor(pool × own value / total goal value)`. At most twenty participants can meet the five-percent requirement. Total claims cannot exceed the frozen pool; integer rounding and unclaimed or subthreshold contributions leave the remainder undistributed. Membership and installation must be eligible when claiming, while real prior donations and unclaimed entitlement persist after leaving or opting out of public listings.

## Phase 5 DH Score budget and comparison metrics

Seven permanent Feat families provide thirty-two unlocks, worth at most 590 DH points for this versioned collection. Five-tier families award 5/10/15/25/40; four-tier families award 5/10/20/35. These account-wide points cannot buy company goods, research or worker energy.

| Family | Source-backed thresholds |
|---|---|
| Returned mining/exploration shifts | 1 / 10 / 40 / 120 / 300 |
| Deepest completed mining | 25 / 100 / 200 / 400 / 599m |
| Fully collected processed material units | 10 / 50 / 250 / 1,000 / 5,000 |
| Completed research nodes | 1 / 4 / 8 / 14 |
| Fulfilled permanent contracts | 1 / 3 / 6 / 12 |
| Installed infrastructure | 1 / 5 / 20 / 60 / 128 |
| Qualified completed club projects | 1 / 2 / 4 / 6 |

Project Feats require the actual five-percent contribution and completed project, regardless of whether its credit award has been claimed. Raw donated amounts, preview clicks, active jobs, uncollected production and repeated requests grant no additional progress. Historical source achievements import as historical awards. Only real post-integration completions contribute new general engagement dates; none of these changes rewrites an old award.

Public comparisons are separate named records: original mining haul value in a club-local Monday week, maximum completed mining depth, or highest recovered-find frozen value. They are not added together. Weekly value uses recorded original cargo rather than staged remainder, so collection and selling cannot create or reduce ranked value. Other companies synchronize their own returns; a standings read never excavates their private worlds.

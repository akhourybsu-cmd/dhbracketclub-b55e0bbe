# Deep Claim: A Prospector’s Empire

Deep Claim is a persistent, personal mining company inside DH Club. The player makes business and crew decisions, then returns to see the consequences in a mine that changes permanently. The company belongs to one member within one club; it is not a shared club treasury or a live multiplayer mine.

This document records the design and integration contracts through Phase 7, the Ancient Deep. [DEEP_CLAIM_IMPLEMENTATION.md](DEEP_CLAIM_IMPLEMENTATION.md) is the delivery ledger for what has actually been verified. [DEEP_CLAIM_PROTOCOL.md](DEEP_CLAIM_PROTOCOL.md) owns the transport, authorization and transaction details; [DEEP_CLAIM_BALANCE.md](DEEP_CLAIM_BALANCE.md) owns exact calculations and costs. Later systems below are plans, not unlocked features or completed work.

## Player promise and first session

The core loop is **plan → dispatch → return → collect → sell or invest → explore deeper**. Decisions should be understandable in a short visit: which workers to spend energy on, whether to reveal ground or extract a known deposit, how long to commit the crew, and whether the next cash purchase should improve storage, tools, access or capacity.

The first session introduces a private company, three named workers and a short, real expedition. A once-per-company tutorial dispatch lasts approximately 30 seconds, consumes one energy per assigned worker and follows the same server settlement rules as ordinary work. It supplies useful cargo and makes an early upgrade reachable. It is not a repeatable instant-reward button.

The existing DH onboarding system provides three short entry steps: meet the crew, plan a descent, and return to collect and invest. The game itself teaches its first dispatch in context. No separate account, club, onboarding store or achievement system is introduced.

## Phase 1 playable scope

| System | Phase 1 contract |
|---|---|
| Company | One private company for each `(club, user)`, with persistent business cash, inventory, terrain and workers. |
| Workers | Three persistent named starters; seven functional attributes, levels/XP and useful positive/negative traits. |
| Expeditions | Exploration and extraction, real crew commitments, preview estimates and explicit dispatch confirmation. |
| Energy | Six daily energy per worker. Quick: 20 minutes/one energy each; Standard: 60 minutes/two each; Deep: 180 minutes/three each. |
| Calendar | Authoritative club timezone when available, otherwise `America/New_York`; persist UTC timestamps and handle daylight saving correctly. |
| Resources | At least eight obtainable, finite resources, with useful sell or upgrade outlets. Initial registry: stone, clay, coal, copper ore, tin ore, iron ore, quartz and silver ore. |
| Buildings | Mine office, mine shaft, warehouse and tool station; upgrades change mechanics and appearance. |
| Mine | A side-on, persistent, chunked world with fog, revealed/excavated terrain and permanently depleted deposits. |
| Return visit | Reconcile elapsed server stages, show committed terrain, release completed crews and expose ready cargo. |
| Integration | Installable game in the existing Asset Library, Compete, navigation and home shortcut system. No automatic club installation. |

Exact launch values live in the balance and protocol documents and must agree with the versioned engine/backend source. A preview is an estimate, never a guaranteed reward. The implementation ledger must record any difference from this contract rather than presenting a future system as shipped.

## Phase 2 workforce and production

Phase 2 extends the existing company instead of starting a separate save. Keep the original three workers, company identity, cash, energy, XP, inventory, mined terrain and expeditions. Its loop adds **hire → train and equip → dispatch → process real stock → collect → craft and invest**.

| System | Phase 2 contract |
|---|---|
| Hiring | A small server-generated roster frozen for each company operating day, with visible names, specialties, stats, traits, wages and hire costs. Refresh does not reroll it, and a candidate can be hired only once. |
| Housing | Three initial staff slots; workers’ quarters increase the cap to six, nine and twelve. No dismissal or worker resale loop. |
| Training | One paid stat course per idle worker per operating day, with a visible benefit and a validated 100-point stat cap. |
| Equipment | Persistent owned item IDs, real slots and exclusive worker assignments. Pickaxe, light, safety, hauling and survey gear provide functional benefits to new jobs. |
| Wear and repairs | Deterministic wear once for each completed configuration-v2 expedition; broken items lose their bonuses. Repair consumes actual company cash/materials. Baseline work remains possible without a paid tool. |
| Production | Server-timed smelting, mineral/gem finishing and equipment crafting, with upfront resource/fuel/cash consumption and bounded station capacity. |
| Inventory | Raw and refined goods have separate stable IDs. Smelted copper/tin/iron/silver and finished quartz/amethyst cannot appear as raw ore or become usable before collection. |
| Buildings | Keep the existing four buildings; add workers’ quarters, smeltery and gem workshop. The existing tool station also handles equipment crafting. New construction starts at level zero with a working Build action. |
| Depth | A fourth shaft level supports operations through 299 meters. New deep chunks can contain amethyst and gold ore; old chunk geology is preserved. |

Exact hiring limits, course improvements, item effects, recipe inputs, costs and queue caps are versioned public catalog data described in the balance/protocol documents. The server validates them independently; a client-supplied price, duration or benefit has no authority.

Training, assignment changes, unequipping and repairs require affected workers to be idle. An item cannot be assigned to two workers or share an occupied worker slot. Freeze effective skills, equipped item identities, bonuses and wear rules when dispatching. Equipment changes after a crew returns apply to future jobs, never to a frozen expedition already in progress.

Owned gear and reserved crafting outputs share a finite equipment limit. An unassigned item can be retired without a refund to free space; keep its historical record for old expedition references. Retired gear cannot be equipped or repaired, and a completed crafting order cannot mint its equipment twice. This is a storage safeguard, not an equipment resale economy.

Processing recipes consume the actual raw goods, fuel and cash atomically at queue creation. Batches are bounded from one to ten, with real elapsed server time and a finite lane/queue policy. Recipe definitions are frozen with each job; later tuning cannot change an existing order’s paid inputs or promised outputs. Quartz finishing is useful in the original mine, while amethyst recipes require genuinely obtainable deeper deposits.

Finished production follows the cargo principle: output remains staged until collection makes room in inventory. It cannot be used as crafting input while waiting, collected twice or lost silently to warehouse overflow. Queue limits and staging prevent unbounded unattended automation. There is no NPC resource-buyback or trading loop to turn purchases and sales into unlimited cash.

The interface reuses the company shell: hiring, staff profiles, training and gear belong with Crew; production and crafting use functional Stores/workshop views. Surface building targets open those same operations. Do not fit another row of tiny tabs into a small phone or advertise a station that cannot perform its action.

## Phase 3 underground operations

Phase 3 adds geological rooms, paid surveying, installed infrastructure, bounded delays and decisions about recovered finds. It extends the same company, crew, world, inventory, production and request ledger. The four modes are **explore, extract, survey and infrastructure**; the first two retain their mining purpose, while the latter two are timed fieldwork rather than disguised ore rewards.

| System | Phase 3 contract |
|---|---|
| Caverns | Coherent empty chambers, wet/crystal variants and ruins in eligible new generation-three chunks. Only revealed terrain is projected or walkable. |
| Survey | A crew works from a revealed, excavated, connected site; three elapsed milestones reveal a bounded unknown-cell diamond without excavating or withdrawing ore. Geology and the expedition preset affect coverage. |
| Infrastructure | Supports, ventilation, pumps and rail are real paid crew projects on known, depleted, connected ground. Grade, Engineering, radius and strength affect new job quotes. |
| Conditions | Public depth-based instability, gas and water severity; Safety and installed protection reduce the quoted incident chance. An incident delays setup only. |
| Discoveries | Six recovered-find definitions with frozen quality, detail, sale value and salvage choices; only actual mining and crew return can publish a find. |
| Depth | A fifth shaft level supports 599 meters, with constructed central access through 556 meters. Earlier levels, buildings and upgrade benefits remain intact. |
| Navigation | Mine field operations and Log/Discoveries extend the existing six-tab shell. No separate research, museum game, currency or club competition is introduced. |

Surveying consumes normal crew energy and wages and must leave the operating reserve intact even though its cargo is empty. Unknown cells are selected in stable distance/x/y order within the public coverage bound, then frozen privately. They appear only when due work milestones commit. A finished survey goes directly to collected state with a field report; the player does not have to collect an empty haul.

Infrastructure likewise consumes its full displayed project fee, materials, wages and energy atomically at dispatch. The 20/60/180-minute presets select grades one/two/three. Supports reduce instability risk, ventilation reduces gas risk, pumps reduce water risk, and rail reduces both travel and return time along covered known route points. One project occupies a cell, with at most 128 building/installed records per company. There is no demolition, resale or automatic upkeep loop.

A project remains building until the crew returns; only installed infrastructure supplies benefits. Coverage uses Manhattan distance and the strongest applicable protection of each type. Rail uses the strongest installed track at each actual route point, then averages those strengths over the full known route, with a 40% cap. Overlapping tracks do not stack, and a short entrance track cannot supply its full bonus to an entire deep route. Engineering improves coverage/strength, while the resulting rail savings can become productive work. Existing expeditions retain their frozen effects and quantities when a new structure is installed.

### Delay-only incidents

Rockfall, gas and water incidents are bounded operational delays. There are no employee deaths or injuries, destroyed tunnels, stolen ore or random cargo losses in Phase 3. Tutorial work and depths below eight meters have zero incident chance. Other sites display the authoritative chance, protection and maximum delay before confirmation; chance is capped at 25%, and the maximum delay is capped at 300 seconds.

The server chooses and freezes the outcome using a private seed, independently of the client request UUID. An incident adds its delay to setup, shifting work milestones and the return time equally. Actual mining quantities and routes remain unchanged, and equipment wear remains two durability per spent energy. The real job clock includes the delay while the selected preset stays 20/60/180 minutes. An uncertain response or reload cannot reroll it.

Incident details become public only when the setup stage ends. Before that, the interface may explain the quoted risk and delay range, not reveal a future event or imply that a local animation has resolved it.

### Recovered finds

The six original find identities are banded geode, fern fossil, survey journal, rail relic, crystal cluster and meteorite fragment. Quality is common, fine, exceptional or flawless, with a bounded frozen sale value and material salvage. A special first geode can come from fully mining the original quartz assay at `(47, 3)` under the new rules; already-depleted older cells do not receive retroactive rewards.

Other eligible finds use a deterministic private per-cell decision. A find must come from a cell actually fully depleted by a configuration-three mining job, and becomes public only after the crew returns. Remote survey reveals and inaccessible cavities cannot mint finds. Each company can recover at most one find per coordinate forever, with at most eight per mining job.

The player chooses **keep, sell or salvage**. Keep records a permanent cabinet entry without invented research or DH points. Sell pays the frozen server value once. Salvage grants the displayed frozen materials only if the entire salvage fits storage; insufficient space rejects the complete decision without consuming the find. This all-or-nothing choice differs deliberately from partial ore/production collection. Decisions do not expire, and retries cannot duplicate a payment or material grant.

New dispatches pause at 24 pending decisions; already-active crews can still return their finds, yielding a bounded maximum of 48 pending entries. The public snapshot includes all pending finds, recent kept/resolved history and complete summary counts while preserving full server history. A complete museum and cursor-based collection history remain future work.

## Phase 4 business development

Phase 4 makes company planning a lasting part of the existing mining loop: **research → produce → deliver → reinvest**. Fourteen research nodes, twelve finite delivery orders and eight company milestones share the same company cash, collected stock, authorization and request ledger. There is no research currency, recurring contract stipend or automatic resource purchase.

The research office is a functional new building with levels zero through two; the trading post has levels zero through three. Their actual levels gate research tiers and delivery tiers. Both have surface targets and accessible Office entry points. The existing six main navigation tabs remain intact; Company, Research, Contracts and Records are bounded views within the company office. Hiring retains a clear shortcut.

### Research with dependencies

Seven branches each contain two permanent nodes: Excavation, Geology, Processing, Logistics, Workforce, Safety and Deep Operations. A second-tier node requires its first tier and specified cross-branch prerequisites. The dependency tree uses real completed research and research-office levels; it never retroactively locks an existing recipe, item or shaft upgrade.

Starting research consumes all displayed company credits and materials atomically, preserves the operating reserve and freezes the paid definition. Only one research order can be active. The server records its start and completion times; authorized reconciliation completes it once without another collection click. There is no cancellation, refund or reload reroll. Tier-one projects take five minutes; tier-two projects take twenty minutes.

Stat research adds bounded bonuses to effective worker statistics after training, XP and functioning equipment, with the existing 100-point cap. The public research-bonus breakdown explains that contribution; consumers must not add it to already-effective statistics again. New dispatches freeze those statistics normally, while every old expedition retains its original plan and outcome. Processing research reduces future production time by five percent and then another ten percentage points. Existing production orders retain their paid inputs, outputs, station speed and completion times.

### Advanced industry and finite deliveries

Bronze, steel and gold bars are processed inventory goods, never terrain. Five additional recipes produce those goods, a steel pickaxe and a steel cargo harness from actual paid inputs and station time. Research requirements are enforced by the server and explained before a locked recipe can be started. The existing sixteen recipes and ten equipment definitions retain their versions and availability. New gear uses the existing exclusive slots, wear/repair rules, owned-item IDs and combined 48-item ownership/reservation cap; production keeps its three-job queue limit.

Twelve authored contracts form three tiers of four deliveries. Every company retains each order's frozen definition and status. Trading-post level, prerequisite deliveries and specified research determine eligibility. There are no expiry timers, acceptance clicks, partial deliveries, cancellation refunds or daily rerolls.

Fulfilling an eligible contract consumes its complete input bundle from collected inventory and pays its frozen company-credit reward once, in one transaction. Cargo awaiting collection, unfinished production and unresolved finds cannot be delivered. Rewards include a bounded premium over the normal sale value of those consumed goods. A contract can never be completed twice, including with a different request UUID after completion. The twelve-order catalog is finite; it supplies industrial goals rather than an endless credit faucet.

### Earned milestones and company records

Eight once-only company milestones recognize completed work: a first mining shift, collected production, installed infrastructure, completed research, a completed mining operation at 100 meters, three deliveries, three kept finds and sustained industrial production. Each displays server-derived progress and an explicit claim action. Qualifying historical actions remain eligible without silently minting credits during migration or hydration. Claims pay finite company-credit rewards, never DH Score, worker energy or equipment.

Records derive from durable source rows rather than the visible recent log: completed mining expeditions and surveys, actual surveyed tiles, installed infrastructure, deepest completed mining, collected production batches and processed units, completed research/contracts, contract credits and kept discoveries. Production quantities come from frozen recipe outputs multiplied by batches once collection is complete; the mutable staged-output remainder cannot represent lifetime production. A partial collection, retry, refresh or duplicate browser tab cannot advance the same underlying achievement twice.

Snapshot schema four extends schema three with the business catalog, orders, milestone progress and source-backed records. Clients retain safe reads for earlier schemas. Expedition configuration stays three because the mining algorithm and world generation do not change; new production freezes its research modifier separately. The migration preserves every existing seed, chunk, revealed tile, active expedition, production order and request receipt.

## Phase 5 club operations and DH integration

Club operations add voluntary social goals around the same private company. The Office has a Club view for Projects, Standings and Showcase; the six main game tabs remain unchanged. Private snapshot schema four, business catalog four, expedition rules three, geology and existing company receipts retain their contracts. A separate, lazy social read returns a narrowly defined public projection rather than another member's save.

### Deliberate sharing

Standings and showcase publishing have separate consent switches, both initially off. A member may contribute to a club project without enabling either listing. Shared reads include only current public members of the same eligible club with an enabled, visible installation. Private testing identities have no shared listing, contribution or notification path, while their solo company remains available privately.

Standings offer three named comparisons rather than a combined gamer rating: weekly original mining-haul value, deepest completed mining and best recovered-find value. Weekly boundaries use the authoritative club-local Monday week with UTC timestamps and correct daylight saving. Original frozen haul value cannot shrink after collection or increase after a sale. Only recorded returns count; another company's elapsed work appears after its own synchronization. Ties share a real rank, with stable identity ordering. The top fifty plus the caller's own row appear once each.

A showcase publishes a company label and up to three explicitly selected owned, kept finds. Public specimen data is limited to kind, name, quality and descriptive detail. It excludes coordinates, job/company IDs, sale/salvage data, stock, workers, balances, terrain and private plans. Turning sharing off hides it immediately without deleting the owner's progress, earned awards or donations. An older featured find remains selected even when the private recent-history window no longer includes it; its owner can retain or unpublish it.

### Finite shared construction

Six authored projects form one permanent prerequisite chain. Each freezes its goals, unit values, reward pool and initial membership-based per-resource contribution cap. A contribution consumes exactly the reviewed whole quantities from collected company stock. Over-stock, over-goal or over-cap actions reject completely; there is no silent clipping, partial spend, cancellation, expiry, reset or refund.

The cap begins at 100% for a one-member club, 60% for two and 40% for three or more. If the club shrinks, the effective cap can rise so remaining members can finish; new arrivals never reduce a previously frozen entitlement. Project history retains departed members' real donations. Shared views expose aggregate participation and the caller's own contribution, without publishing former or private donors' identities.

A completed project offers a bounded company-credit pool. A member must have contributed at least five percent of frozen total goal value to qualify; their once-only credit claim is proportional to actual contributed value. Claiming requires current eligible membership. A returning member can recover an unclaimed legitimate entitlement. Source-backed DH Feats recognize qualified completed participation independently of the optional credit claim. These projects are finite material sinks, not a communal treasury or recurring money generator.

### One existing DH Score and inbox

Seven Deep Claim families extend the existing DH Feats catalog, collector, dirty queue and permanent receipts: returned mining shifts, completed depth, fully collected processed units, completed research, fulfilled deliveries, installed infrastructure and qualified completed club projects. Their thirty-two tier unlocks total 590 DH points. They do not grant spendable company cash or energy. Private company milestones remain a separate, explicitly named source of company-credit rewards.

DH Score remains account-lifetime: legitimate owned company history continues to qualify after a club move or source-app removal. Registered or persistently marked private workspaces and private accounts are excluded independently of caller identity. Already-recorded completed Deep Claim history imports only the new families as historical receipts, preserving every old family and prior point snapshot and excluding imported awards from monthly standings and unlock celebrations. Migration does not settle another company's overdue private jobs; if first recorded later, they use normal dedicated-family collector timing, while their pre-cutover timestamps remain silent for notifications and general engagement. Only actual post-integration completion timestamps add Deep Claim to general active days and feature exploration.

The shared notification preference controls batched in-app company updates. Actual crew returns, ready processing, completed research, major recovered finds and completed projects can produce one summary during the owner's synchronization, subject to a fifteen-minute cooldown and four notifications per club-local day. Durable event receipts survive inbox dismissal. Disabled preferences or ineligible/private ownership suppress events permanently instead of accumulating an opt-in flood. Migration history does not notify. Project completion queues each contributor's notification only on that contributor's own later sync, avoiding cross-company locks while a project is held. This uses the existing inbox, realtime/polling and settings; unattended delivery and device push are not claimed.

Deep links carry the expected club and a whitelisted Office destination. A mismatched current club produces a clear notice rather than silently changing clubs or selecting another club's private state.

## Phase 6 original presentation and runtime polish

Phase 6 improves the experience around the same authoritative game. It introduces a versioned original pixel-art pack, composed Web Audio arrangements, clearer presentation controls and runtime safeguards. It does not create a new mining rule, reset a company or alter any paid job, recipe, project, research benefit or reward. All seven published migrations, canonical economic catalogs and rule calculations remain unchanged.

The authored pack covers the current mineral, worker, equipment, building, infrastructure and discovery identities with stable sprite references. Build levels, crew poses, functioning gear, installed projects and production activity continue to derive from actual disclosed state. Atlas loading and decoding are optional presentation work: a missing image falls back to the existing local painters and cannot prevent dispatch, inspection, collection or navigation. Pixel illustrations are original source-authored project work, not a claim of commissioned commercial painting.

Music and ambient arrangements respond to the visible surface/mine setting and known depth or formation. They never anticipate an undiscovered room, a hidden find or a future job outcome. Material cues use only disclosed visible materials. Separate music, ambient and effects levels supplement the existing master volume, with compatibility for older saved settings. Audio still requires an opt-in gesture and the app's sound gates. Scheduling and voices are bounded and stop on mute, hidden/inactive views or disposal. The score is composed and synthesized in Web Audio, with no claim of recorded orchestration.

Compact settings and a paged guide explain the working game without replacing the six primary navigation tabs. Existing server-confirmed findings may receive a centered, dismissible reveal; seeing or skipping presentation never sells, keeps, salvages or claims an item. Remembered reveal state is a local account/club/company-scoped interface preference, distinct from authoritative ownership and reward receipts.

Camera and sprite feedback remain short and interruptible. Reduced motion preserves current server-derived positions on explicit invalidation without running a decorative animation loop. Reduced graphics lowers rendering work without hiding functional terrain, workers or installed projects. Keyboard/list alternatives, focus restoration, native gesture cancellation and small-phone safe areas are part of the presentation contract, not optional replacements for pointer-only controls.

Performance claims require recorded budgets and measurements. Viewport culling, bounded texture/path caches, frame scheduling, audio cleanup and graceful atlas failure are checked independently. Browser timing and headless interaction checks are useful evidence, but do not establish physical-device frame rates or battery behavior. Presentation also cannot establish a universal playtime: the current world, research, contracts and project goals are finite versioned content, with no asserted fifty-hour minimum.

## Phase 7: the Ancient Deep

The Ancient Deep extends playable operations from 600 through 999 meters with hydrothermal basalt, finite nickel-bearing seams and sulfur beds. It is one complete region rather than an indefinite depth multiplier. A sixth shaft level supplies constructed central access through 956 meters and a functioning powered lift. Existing Deep Operations 2 research gates the upgrade; its 24,000-credit price uses no below-cap mineral, so entry does not depend on a resource the upgrade itself must unlock.

### Travel and useful work are different decisions

The lift discounts the actual constructed, known shaft portion of a route. Only vertical center-shaft edges with both endpoints known and excavated, within the built corridor, qualify. Their length is weighted against the complete Manhattan route. Branching tunnels and ground below the corridor do not inherit a blanket seventy-five-percent reduction. Existing weighted rail then reduces the remaining travel/return cost, with the established minimum stage duration. The result is a practical reason to prepare access and transport rather than teleporting a crew through unknown rock.

Deep mining also introduces a predictable heat penalty to useful work. Below 600 meters, heat has no effect. At deeper mining/exploration sites, effective Engineering, the strongest installed applicable ventilation and functioning heat shields assigned to the selected crew mitigate the quoted load. A larger crew averages shield protection, so one specialist item does not protect every worker at full strength. Broken, unassigned or another crew's equipment supplies no thermal benefit.

Heat reduces productive output rather than destroying earned cargo, injuring workers or extending every server clock. Survey and infrastructure work remain unaffected so a company can prepare a difficult site with its current crew. The quote explains raw work, mitigation and effective work before payment. The server freezes the applied modifiers into configuration-seven plans; later gear wear, assignment changes or construction cannot rewrite that expedition's outcome. Existing configuration-one/two/three expeditions retain their own travel, yield, wear and receipts.

### A short, real industrial chain

Nickel ore and sulfur are finite new raw minerals; nickel alloy is processed inventory only. Existing research unlocks two paid recipes: nickel-alloy smelting and a specialized head-slot Nickel Heat Shield. The shield competes with other real head gear and supplies thermal protection plus bounded Safety/Endurance bonuses. Smelting consumes actual nickel, an iron bar, coal, cash and station time. Crafting and repairs require real alloy/sulfur, making both new resources useful without an NPC input-purchase or recursive conversion loop.

This slice adds no research tree, contract, milestone, cooperative project or DH Feat family. The original fourteen research nodes, twelve deliveries, eight company milestones, six club projects and 590-point Deep Claim Feat budget remain intact. Existing source-backed volume records can recognize legitimate new work without rewriting an earlier threshold or permanent award. The sixth shaft raises infrastructure capacity from 128 to 192 while other company caps remain unchanged.

### Preserve the old mine

Generation four applies only to previously absent chunks from row nineteen, at 608 meters. The region begins at 600 meters, but 600–607 is inside the existing 576–607 chunk: its recorded generation and all unseen cells remain authoritative. Every old seed, chunk, revealed/depleted tile and frozen plan stays intact. Cutover pins pending legacy work before changing the chooser; no terrain is revealed early. The seven released migrations and five old canonical catalogs remain byte-for-byte preserved under an additive migration.

Private snapshot schema five adds the Ancient Deep catalog and capacity/lift presentation while retaining older schema adapters, field catalog three, business catalog four, production configuration four and the same twenty-five member RPC signatures. New configuration-seven cargo has explicit nickel/sulfur weekly valuation; original mineral prices and earlier records remain fixed.

Known-ground depth navigation and mode changes preserve a legal selected worksite. Hidden cells are not promoted into selectable jobs by a camera control. Original art pack v1 and its published bytes remain frozen; a small v2 add-on supplies the sixth shaft and known Ancient Deep/resource/shield art. No new main navigation layer or client-generated terrain is introduced. Content below 999 meters, broader automation and additional regions remain future work.

## Crew decisions

The specialty framework supports Miner, Geologist, Hauler, Engineer, Surveyor, Demolitionist and Safety Officer. Phase 1 starts with mining, geology and hauling specialists; Phase 2’s daily candidate system makes the broader workforce available without replacing those starters.

Each attribute has a visible reason to matter. Mining affects extraction work; Geology affects exploration and survey coverage; Engineering affects setup and infrastructure strength/radius; Logistics affects hauling; Safety improves reliable work efficiency and reduces Phase 3 incident chance; Endurance supports sustained work; Leadership affects crew coordination. Exact coefficients, caps, trait modifiers and displayed preview contributions belong to the balance contract. A stat that does not participate in a current calculation must not be advertised as functional.

Workers cannot overlap expeditions. Energy and wages are checked and consumed atomically at dispatch; wages are paid upfront, with no unbounded wage debt accumulating while the player is away. An initially limited simultaneous-crew capacity makes assignment a decision. Any additional slot must come from a functional upgrade, not a decorative lock.

Phase 2’s hiring, training and equipment are real management actions with server receipts and costs. Workers still have six daily energy, jobs still take at most three crew members, and office upgrades still control simultaneous expeditions. A larger roster supplies rested alternatives and multiple crews; it does not waive wages, assignment conflicts or daily energy.

## A mine that remembers

World generation is deterministic and versioned, with a private server seed. The mine is 96 logical tiles wide, using 32×32 chunks; surface is depth zero, and mining begins at positive depth. Approximately one logical vertical tile represents one meter. The central shaft starts around column 48.

Only needed chunks are generated and projected to the client. Preserve immutable generation versions alongside sparse changes for revealed cells, excavation and remaining deposit quantities. Existing chunks and expeditions keep their versions when later content expands the world. Vertical coordinates and chunk addresses should allow future depth expansion without rewriting the saved mine.

Phase 1 introduced surface seams through 49 meters and an ironworks band through 149 meters. Those original bands and their committed geology remain intact. Every extraction site needs a plausible route from accessible infrastructure; locked deposits and active jobs cannot be mined twice by overlapping expeditions. Finite ore stays depleted after reload, a new tab or a different device.

Phase 2 extended the supported depth to 299 meters through shaft level four. Its generation helper applied only to eligible new deep chunks, beginning around chunk row five/depth 160. A chunk’s recorded generation version remains authoritative: existing version-one chunks, including their still-unrevealed cells, keep version-one geology. Never edit an applied migration, reseed an existing world or retroactively insert a new mineral into an old saved deposit.

Phase 3 adds generation-three geometry only to previously absent chunks at chunk row one or deeper, so new chambers can appear soon after the second shaft upgrade. Chunk row zero remains the original surface geology. Existing version-one/two chunks retain every seed, committed mutation and still-unrevealed cell. Known natural empty rooms are walkable only after they have actually been revealed and connected through known depleted cells; hidden chambers cannot create secret walking routes. Wet caverns are damp working spaces, not impassable lakes.

Before changing generation, the migration blocks expedition writers, waits for in-flight transactions and pins missing private chunk metadata for every future extraction/reveal coordinate of unapplied configuration-one/two work. It changes neither public terrain nor frozen plans. New configuration-three dispatches also pin their private planned-coordinate chunks before returning, protecting them from a later cutover. A latest-configuration insert guard rejects stale pre-cutover code trying to create an old ticket after migration; existing tickets can still settle normally.

## Time, cargo and trust

An expedition has server-controlled travel, setup, work, haul, return and ready stages. Freeze its rules, configuration, crew and internal plan at dispatch. Reconcile elapsed milestones lazily when the company is read or mutated. A browser timer communicates remaining time; it cannot create cargo, dig terrain, assign XP or move the authoritative clock forward.

The public snapshot contains actual committed terrain and safe presentation data for worker stages/routes. It excludes the world seed, hidden expedition plans and unreconciled extraction rewards. Known recipe outputs may be shown as order information, but are not spendable inventory before collection. The renderer can animate a worker at work without inventing extra extraction.

Settlement and collection are separate. Cargo can wait safely if warehouse space is insufficient. Collection accepts a clearly reported partial quantity in resource-registry order and retains the remainder as staged cargo. Never silently discard overflow. Block new dispatches while staged cargo would exceed the bounded crew/capacity model.

Every mutation uses the existing authenticated Supabase connection, a request UUID and a payload fingerprint. Serialize company writes, validate ownership and membership on the server, and return the current authorized snapshot when retrying a committed receipt. A stale device cannot undo a newer company revision. Clients never submit authoritative cash, energy, inventory, XP, terrain or reward totals.

When offline or hydration fails, show a clearly stale/read-only state and an explicit retry. Cached information is useful for inspection; purchases, dispatch and collection require a server response. Every request needs a timeout and a recoverable loading state.

The additive Phase 2 migration upgrades the public snapshot to schema two while keeping schema-one state readable by the current client. In-flight configuration-one expeditions retain their original plans, rewards and rules and incur no retroactive equipment wear. New dispatches must use the current rules even when requested through an older public endpoint; an old client cannot bypass gear wear, crew/housing limits or production safeguards. New hire/train/equip/repair/production operations reuse the same company lock, revision checks and request receipts.

Phase 3 adds schema three and current operation preview/dispatch endpoints plus discovery resolution. Old preview/dispatch names delegate to the current rules, so they cannot bypass hazards, wear or the latest ticket version. The client continues to read schema-one/two state during rollout, while every new economic action retains the existing company lock, revision and fingerprinted receipt. Existing configuration-one/two jobs keep their original timings, cargo and wear behavior.

## Application integration

`AuthContext` and `ClubContext` remain the identity and active-club sources. `/deep-claim` uses the existing lazy route and `ProtectedPage`/`AssetGuard`, within the existing `ProtectedRoute` and `ClubGate`. The frontend guard is navigation protection; the backend independently checks current membership, company ownership and the installed/enabled/visible asset.

`platform_assets` registers the global `deep-claim` game. The discovery migration does not insert `club_installed_assets`, install the game, change another asset, grant currency or mutate saved companies. Club admins use the existing Asset Library install/enable/visibility controls. Existing global asset identity, flags, ordering and configuration remain stable on repeated migration application.

Canonical navigation supplies the drawer/sidebar entry, title, mobile Compete context and immersive game-shell detection. Compete shows the game only under the existing installed-asset gate. Existing home shortcut maps resolve Deep Claim to `/deep-claim`; this adds a usable installed app destination without adding a new homepage feed or promotional panel.

The mine has an immersive shell and a clear return to DH. Primary mobile operations stay within reachable controls, with safe-area spacing and accessible alternatives to manipulating the Canvas. The Canvas is a view of the company, not the sole way to inspect jobs or activate buildings.

## Future phase boundaries

Phase 4 adds dependency-based research, finite delivery contracts, source-backed company milestones and alloy/advanced-equipment production to the Phase 3 underground systems. Expanded hazards with destructive consequences, broader collection/museum history and later industrial systems remain future work. Do not reserve visible inactive tabs as substitutes for those systems.

Phase 5 adds opt-in club standings/showcases, finite shared projects, existing-ledger DH Feats and batched in-app updates. Company credits and worker energy remain isolated resources; DH Score is never spendable, and there is no cross-game combined ranking or public mine save.

Phase 6 supplies the original pixel pack and composed synthesized presentation, with local painter fallbacks; Phase 7 adds a separately versioned Ancient Deep pack. Additional authored animation, recorded music, content beyond 999 meters and physical-device profiling remain further work; see [DEEP_CLAIM_ASSETS.md](DEEP_CLAIM_ASSETS.md). This release does not claim a commissioned commercial atlas, a recorded soundtrack or proof of a fixed minimum game length.

## Verification gates

Before release, verify member/install/visibility/cross-club authorization; private seed and future-plan redaction; request replay and multi-device revision handling; correct daily energy across midnight and DST; overlapping-worker rejection; persistent terrain/deposit depletion; upfront wages; capacity-safe collection; once-only settlement; and rollback on failed mutations. UI checks must cover mobile and desktop, both app themes, reduced motion, keyboard alternatives, and recovery after reload or a failed request.

Phase 2 additionally verifies candidate-day stability and hire caps; daily/idle/capped training; item ownership, slot exclusivity, frozen job bonuses and once-only wear; repair inputs; finite recipe inputs and batch/queue limits; staging/collection retries; old-endpoint wear enforcement; schema-one reads; and version-one jobs/chunks surviving the migration unchanged. Economy checks must cover initial smelting/crafting access and the absence of instant buy/sell or recursive recipe arbitrage. Timed production may add sale value to finite paid inputs; that intended margin is distinct from a repeatable free-resource loop.

Phase 3 verifies wholly pending and partially applied legacy plans across absent chunk boundaries; stale-ticket rejection; known-only cavern routing; elapsed survey reveals without ore; project fees/materials/grade/uniqueness and delayed installation; strongest-only mitigation and real rail travel savings; private incident outcomes and delayed publication; once-only finds from actual depleted mining; all discovery choices and salvage rollback; pending bounds; and new rules through the oldest public endpoints. The isolated database harness serializes transactions, so native concurrent-lock behavior must not be claimed as empirically stress-tested there.

Phase 4 verifies research prerequisites, one active order, exact costs, elapsed completion and frozen old effects; research-aware effective statistics and production clocks; persistent contract eligibility, whole-input delivery and once-only rewards; historical source-backed milestone progress and explicit claims; rollback after economic writes; collected-production statistics beyond bounded public history; and unchanged old receipt fingerprints, geology and active jobs. Canonical catalog parity, finite reward totals, recipe dependency reachability and the absence of circular resource conversions are required economy checks.

Phase 5 additionally verifies opt-in/out, private-account and cross-club isolation; exact public-field allowlists and retained old featured finds; frozen weekly cargo, ties and calendar boundaries; whole-donation rollback, individual/global caps and once-only qualified claims; old metrics/receipts preserved by real Feats composition; historical import versus new monthly awards; lifetime history across club/install changes; notification preferences, cooldowns, daily limits, dismissal-safe dedupe and owner-only project notification queueing. Shared-project/account locks and foreign-key locks require explicit review; the isolated harness remains insufficient evidence of native parallel stress behavior.

Phase 6 verifies reproducible original atlas outputs and byte/decoded-memory budgets; stable rule/catalog/migration hashes; disclosed-state-only art/audio; old preference migration and independent sound levels; gesture-only audio startup, background/mute/disposal cleanup and resume races; bounded rendering/caches; native pointer/wheel/keyboard cancellation; reduced-motion invalidation; focus restoration and atlas-failure fallback. Performance reports distinguish measured browser behavior from untested physical hardware, and every gameplay/retry/privacy regression remains required.

Phase 7 verifies frozen old sources/art and old plans through cutover; absent-chunk-only generation and the 600/608 boundary; actual known-edge lift weighting and rail order; quoted/server heat parity, crew-average protection, broken/foreign gear exclusion and frozen effects through wear; finite nickel production/crafting/repair; 128/192 infrastructure limits; unchanged legacy catalogs, score receipts and RPC security; known-ground navigation, forced-colors/focus behavior and production PWA caching. Browser emulation remains distinct from physical-device testing, and serialized PostgreSQL fixtures do not prove native parallel stress behavior.

Installation, migration, commit, push and deployment status must be recorded from actual evidence in the implementation ledger. This design document does not assert that a live deployment or live database migration has occurred.

# Deep Claim: A Prospector’s Empire

Deep Claim is a persistent, personal mining company inside DH Club. The player makes business and crew decisions, then returns to see the consequences in a mine that changes permanently. The company belongs to one member within one club; it is not a shared club treasury or a live multiplayer mine.

This document records the design and integration contracts for the Phase 1 company foundation and Phase 2 workforce/production expansion. [DEEP_CLAIM_IMPLEMENTATION.md](DEEP_CLAIM_IMPLEMENTATION.md) is the delivery ledger for what has actually been verified. [DEEP_CLAIM_PROTOCOL.md](DEEP_CLAIM_PROTOCOL.md) owns the transport, authorization and transaction details; [DEEP_CLAIM_BALANCE.md](DEEP_CLAIM_BALANCE.md) owns exact calculations and costs. Later systems below are plans, not unlocked features or completed work.

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

## Crew decisions

The specialty framework supports Miner, Geologist, Hauler, Engineer, Surveyor, Demolitionist and Safety Officer. Phase 1 starts with mining, geology and hauling specialists; Phase 2’s daily candidate system makes the broader workforce available without replacing those starters.

Each attribute has a visible reason to matter. Mining affects extraction work; Geology affects finding and understanding resources; Engineering affects setup and infrastructure work; Logistics affects hauling; Safety improves reliable work efficiency (random hazard incidents are deferred); Endurance supports sustained work; Leadership affects crew coordination. Exact coefficients, caps, trait modifiers and displayed preview contributions belong to the balance contract. A stat that does not participate in a current calculation must not be advertised as a functional Phase 1 feature.

Workers cannot overlap expeditions. Energy and wages are checked and consumed atomically at dispatch; wages are paid upfront, with no unbounded wage debt accumulating while the player is away. An initially limited simultaneous-crew capacity makes assignment a decision. Any additional slot must come from a functional upgrade, not a decorative lock.

Phase 2’s hiring, training and equipment are real management actions with server receipts and costs. Workers still have six daily energy, jobs still take at most three crew members, and office upgrades still control simultaneous expeditions. A larger roster supplies rested alternatives and multiple crews; it does not waive wages, assignment conflicts or daily energy.

## A mine that remembers

World generation is deterministic and versioned, with a private server seed. The mine is 96 logical tiles wide, using 32×32 chunks; surface is depth zero, and mining begins at positive depth. Approximately one logical vertical tile represents one meter. The central shaft starts around column 48.

Only needed chunks are generated and projected to the client. Preserve immutable generation versions alongside sparse changes for revealed cells, excavation and remaining deposit quantities. Existing chunks and expeditions keep their versions when later content expands the world. Vertical coordinates and chunk addresses should allow future depth expansion without rewriting the saved mine.

Phase 1 introduced surface seams through 49 meters and an ironworks band through 149 meters. Those original bands and their committed geology remain intact. Every extraction site needs a plausible route from accessible infrastructure; locked deposits and active jobs cannot be mined twice by overlapping expeditions. Finite ore stays depleted after reload, a new tab or a different device.

Phase 2 extends the supported depth to 299 meters through shaft level four. The new generation helper applies only to eligible new deep chunks, beginning around chunk row five/depth 160. A chunk’s recorded generation version remains authoritative: existing version-one chunks, including their still-unrevealed cells, keep version-one geology. Never edit the applied Phase 1 migration, reseed an existing world or retroactively insert a new mineral into an old saved deposit. Expanded hazards and large cavern systems remain later-phase work.

## Time, cargo and trust

An expedition has server-controlled travel, setup, work, haul, return and ready stages. Freeze its rules, configuration, crew and internal plan at dispatch. Reconcile elapsed milestones lazily when the company is read or mutated. A browser timer communicates remaining time; it cannot create cargo, dig terrain, assign XP or move the authoritative clock forward.

The public snapshot contains actual committed terrain and safe presentation data for worker stages/routes. It excludes the world seed, hidden expedition plans and unreconciled extraction rewards. Known recipe outputs may be shown as order information, but are not spendable inventory before collection. The renderer can animate a worker at work without inventing extra extraction.

Settlement and collection are separate. Cargo can wait safely if warehouse space is insufficient. Collection accepts a clearly reported partial quantity in resource-registry order and retains the remainder as staged cargo. Never silently discard overflow. Block new dispatches while staged cargo would exceed the bounded crew/capacity model.

Every mutation uses the existing authenticated Supabase connection, a request UUID and a payload fingerprint. Serialize company writes, validate ownership and membership on the server, and return the current authorized snapshot when retrying a committed receipt. A stale device cannot undo a newer company revision. Clients never submit authoritative cash, energy, inventory, XP, terrain or reward totals.

When offline or hydration fails, show a clearly stale/read-only state and an explicit retry. Cached information is useful for inspection; purchases, dispatch and collection require a server response. Every request needs a timeout and a recoverable loading state.

The additive Phase 2 migration upgrades the public snapshot to schema two while keeping schema-one state readable by the current client. In-flight configuration-one expeditions retain their original plans, rewards and rules and incur no retroactive equipment wear. New dispatches must use the current rules even when requested through an older public endpoint; an old client cannot bypass gear wear, crew/housing limits or production safeguards. New hire/train/equip/repair/production operations reuse the same company lock, revision checks and request receipts.

## Application integration

`AuthContext` and `ClubContext` remain the identity and active-club sources. `/deep-claim` uses the existing lazy route and `ProtectedPage`/`AssetGuard`, within the existing `ProtectedRoute` and `ClubGate`. The frontend guard is navigation protection; the backend independently checks current membership, company ownership and the installed/enabled/visible asset.

`platform_assets` registers the global `deep-claim` game. The discovery migration does not insert `club_installed_assets`, install the game, change another asset, grant currency or mutate saved companies. Club admins use the existing Asset Library install/enable/visibility controls. Existing global asset identity, flags, ordering and configuration remain stable on repeated migration application.

Canonical navigation supplies the drawer/sidebar entry, title, mobile Compete context and immersive game-shell detection. Compete shows the game only under the existing installed-asset gate. Existing home shortcut maps resolve Deep Claim to `/deep-claim`; this adds a usable installed app destination without adding a new homepage feed or promotional panel.

The mine has an immersive shell and a clear return to DH. Primary mobile operations stay within reachable controls, with safe-area spacing and accessible alternatives to manipulating the Canvas. The Canvas is a view of the company, not the sole way to inspect jobs or activate buildings.

## Future phase boundaries

The Phase 2 boundary includes daily hiring, paid training, owned equipment, repairs, basic production/crafting and the new deep region described above. Broader resource-quality/specimen systems, expanded hazards, large caverns and later industry remain future work. Do not reserve visible inactive tabs as substitutes for those systems.

**Phase 5 social and DH Feats integration is deferred.** Phases 1–2 have no club competition, global ranking, DH Score rewards or DH Score spending. Business cash and worker energy remain isolated company resources. Later engagement awards must extend the existing permanent DH Feats ledger and privacy conventions, rather than introducing a second score system.

**Phase 6 finished presentation is deferred.** Phases 1–2 use original procedural pixel illustration and initial synthesized audio. A complete commercial sprite atlas, expanded animation set and full soundtrack are not claimed as delivered; see [DEEP_CLAIM_ASSETS.md](DEEP_CLAIM_ASSETS.md).

## Verification gates

Before release, verify member/install/visibility/cross-club authorization; private seed and future-plan redaction; request replay and multi-device revision handling; correct daily energy across midnight and DST; overlapping-worker rejection; persistent terrain/deposit depletion; upfront wages; capacity-safe collection; once-only settlement; and rollback on failed mutations. UI checks must cover mobile and desktop, both app themes, reduced motion, keyboard alternatives, and recovery after reload or a failed request.

Phase 2 additionally verifies candidate-day stability and hire caps; daily/idle/capped training; item ownership, slot exclusivity, frozen job bonuses and once-only wear; repair inputs; finite recipe inputs and batch/queue limits; staging/collection retries; old-endpoint wear enforcement; schema-one reads; and version-one jobs/chunks surviving the migration unchanged. Economy checks must cover initial smelting/crafting access and the absence of instant buy/sell or recursive recipe arbitrage. Timed production may add sale value to finite paid inputs; that intended margin is distinct from a repeatable free-resource loop.

Installation, migration, commit, push and deployment status must be recorded from actual evidence in the implementation ledger. This design document does not assert that a live deployment or live database migration has occurred.

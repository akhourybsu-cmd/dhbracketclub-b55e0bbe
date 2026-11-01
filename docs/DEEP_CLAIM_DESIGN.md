# Deep Claim: A Prospector’s Empire

Deep Claim is a persistent, personal mining company inside DH Club. The player makes business and crew decisions, then returns to see the consequences in a mine that changes permanently. The company belongs to one member within one club; it is not a shared club treasury or a live multiplayer mine.

This document records the design and integration contract for Phase 1. [DEEP_CLAIM_IMPLEMENTATION.md](DEEP_CLAIM_IMPLEMENTATION.md) is the delivery ledger for what has actually been verified. [DEEP_CLAIM_PROTOCOL.md](DEEP_CLAIM_PROTOCOL.md) owns the transport, authorization and transaction details; [DEEP_CLAIM_BALANCE.md](DEEP_CLAIM_BALANCE.md) owns exact calculations and costs. Future systems below are plans, not unlocked features or completed work.

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

## Crew decisions

The specialty framework supports Miner, Geologist, Hauler, Engineer, Surveyor, Demolitionist and Safety Officer. Three starters can cover mining, geology and hauling; the existence of the seven-role framework does not imply that hiring all seven roles is available in Phase 1.

Each attribute has a visible reason to matter. Mining affects extraction work; Geology affects finding and understanding resources; Engineering affects setup and infrastructure work; Logistics affects hauling; Safety improves reliable work efficiency (random hazard incidents are deferred); Endurance supports sustained work; Leadership affects crew coordination. Exact coefficients, caps, trait modifiers and displayed preview contributions belong to the balance contract. A stat that does not participate in a current calculation must not be advertised as a functional Phase 1 feature.

Workers cannot overlap expeditions. Energy and wages are checked and consumed atomically at dispatch; wages are paid upfront, with no unbounded wage debt accumulating while the player is away. An initially limited simultaneous-crew capacity makes assignment a decision. Any additional slot must come from a functional upgrade, not a decorative lock.

Advanced hiring, equipment, training and a larger role roster are deferred. Their menus should appear when their actions are implemented; Phase 1 should not direct players into dead ends.

## A mine that remembers

World generation is deterministic and versioned, with a private server seed. The mine is 96 logical tiles wide, using 32×32 chunks; surface is depth zero, and mining begins at positive depth. Approximately one logical vertical tile represents one meter. The central shaft starts around column 48.

Only needed chunks are generated and projected to the client. Preserve immutable generation versions alongside sparse changes for revealed cells, excavation and remaining deposit quantities. Existing chunks and expeditions keep their versions when later content expands the world. Vertical coordinates and chunk addresses should allow future depth expansion without rewriting the saved mine.

Phase 1 supports surface seams through 49 meters and an ironworks band through 149 meters. Deeper regions are future content, not visible empty destinations. Every extraction site needs a plausible route from accessible infrastructure; locked deposits and active jobs cannot be mined twice by overlapping expeditions. Finite ore stays depleted after reload, a new tab or a different device.

## Time, cargo and trust

An expedition has server-controlled travel, setup, work, haul, return and ready stages. Freeze its rules, configuration, crew and internal plan at dispatch. Reconcile elapsed milestones lazily when the company is read or mutated. A browser timer communicates remaining time; it cannot create cargo, dig terrain, assign XP or move the authoritative clock forward.

The public snapshot contains actual committed terrain and safe presentation data for worker stages/routes. It excludes the world seed, hidden future plans and unreconciled rewards. The renderer can animate a worker at work without inventing extra extraction.

Settlement and collection are separate. Cargo can wait safely if warehouse space is insufficient. Collection accepts a clearly reported partial quantity in resource-registry order and retains the remainder as staged cargo. Never silently discard overflow. Block new dispatches while staged cargo would exceed the bounded crew/capacity model.

Every mutation uses the existing authenticated Supabase connection, a request UUID and a payload fingerprint. Serialize company writes, validate ownership and membership on the server, and return the current authorized snapshot when retrying a committed receipt. A stale device cannot undo a newer company revision. Clients never submit authoritative cash, energy, inventory, XP, terrain or reward totals.

When offline or hydration fails, show a clearly stale/read-only state and an explicit retry. Cached information is useful for inspection; purchases, dispatch and collection require a server response. Every request needs a timeout and a recoverable loading state.

## Application integration

`AuthContext` and `ClubContext` remain the identity and active-club sources. `/deep-claim` uses the existing lazy route and `ProtectedPage`/`AssetGuard`, within the existing `ProtectedRoute` and `ClubGate`. The frontend guard is navigation protection; the backend independently checks current membership, company ownership and the installed/enabled/visible asset.

`platform_assets` registers the global `deep-claim` game. The discovery migration does not insert `club_installed_assets`, install the game, change another asset, grant currency or mutate saved companies. Club admins use the existing Asset Library install/enable/visibility controls. Existing global asset identity, flags, ordering and configuration remain stable on repeated migration application.

Canonical navigation supplies the drawer/sidebar entry, title, mobile Compete context and immersive game-shell detection. Compete shows the game only under the existing installed-asset gate. Existing home shortcut maps resolve Deep Claim to `/deep-claim`; this adds a usable installed app destination without adding a new homepage feed or promotional panel.

The mine has an immersive shell and a clear return to DH. Primary mobile operations stay within reachable controls, with safe-area spacing and accessible alternatives to manipulating the Canvas. The Canvas is a view of the company, not the sole way to inspect jobs or activate buildings.

## Future phase boundaries

Broader hiring, equipment, training, resource-quality/specimen systems, raw-to-refined production chains and deeper regions belong to later phases. Raw and refined goods require separate stable IDs when processing is introduced. Do not reserve visible inactive tabs as substitutes for these systems.

**Phase 5 social and DH Feats integration is deferred.** Phase 1 has no club competition, global ranking, DH Score rewards or DH Score spending. Business cash and worker energy remain isolated company resources. Later engagement awards must extend the existing permanent DH Feats ledger and privacy conventions, rather than introducing a second score system.

**Phase 6 finished presentation is deferred.** Phase 1 uses original procedural pixel illustration and initial synthesized audio. A complete commercial sprite atlas, expanded animation set and full soundtrack are not claimed as delivered; see [DEEP_CLAIM_ASSETS.md](DEEP_CLAIM_ASSETS.md).

## Verification gates

Before release, verify member/install/visibility/cross-club authorization; private seed and future-plan redaction; request replay and multi-device revision handling; correct daily energy across midnight and DST; overlapping-worker rejection; persistent terrain/deposit depletion; upfront wages; capacity-safe collection; once-only settlement; and rollback on failed mutations. UI checks must cover mobile and desktop, both app themes, reduced motion, keyboard alternatives, and recovery after reload or a failed request.

Installation, migration, commit, push and deployment status must be recorded from actual evidence in the implementation ledger. This design document does not assert that a live deployment or live database migration has occurred.

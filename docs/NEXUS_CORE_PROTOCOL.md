# Nexus Defense — Endless Arsenal, ruleset 5

Nexus is one endless, mobile-first central-core survival game. Enemies approach directly from every angle at different speeds. The player prepares a permanent equipment loadout, upgrades the core during combat, banks credits and returns with a stronger arsenal. There are no lanes, placed towers, campaign selections or challenge modes in the current player flow.

## Player loop

1. Enter the full-screen title menu. Play launches the saved build directly. New players start with the pulse cannon, zero credits and no other equipment.
2. Equip up to two unlocked auxiliary weapons within **4 power**, plus **one support module**. The pulse cannon is always equipped and uses no power. Empty slots are valid.
3. Deploy. Selected weapons start online at level 1 without costing battle energy. Only equipped weapons and the selected support module can receive their battle upgrades.
4. Earn energy from kills and wave clears. Buy attack, weapon, defense and support upgrades. Trigger Nova (20-second cooldown) and Overdrive (six seconds, 30-second cooldown).
5. End the run when the core falls, or choose **End run & collect** in the pause menu. Spend the permanent credits on equipment or core research. Save & exit preserves an unfinished local defense without collecting it.
6. Repeat. Credits, research, equipment ownership and saved loadout sync across devices; active combat checkpoints stay on the current device. Lifetime waves advance eight defender ranks, while permanent achievements fill an eight-medal career collection. The title recommends a milestone, an affordable unlock or an owned weapon to equip. See [career progression](NEXUS_CAREER.md).

## Loadout choices

| Equipment | Role and limitation | Power | Unlock credits | Lifetime waves |
| --- | --- | --- | --- | --- |
| Pulse cannon | Always equipped. Reliable homing shots; multishot and crit are pulse-specific. | 0 | Free | 0 |
| Orbital blades | Repeated close-range collision damage; cannot reach distant threats. | 1 | 90 | 5 |
| Chain arc | Instant chaining through distinct neighbors, 86% damage per subsequent jump. | 2 | 160 | 15 |
| Rail lance | Heavy strongest-target beam, piercing aligned enemies and bypassing armor; slow cycle. | 3 | 300 | 35 |
| Siege mortar | Delayed, stationary splash impact targets the densest cluster; fast enemies can escape. | 2 | 450 | 60 |
| Repair nanites | +20% max hull and 2.5 hull repaired/s at deployment; enables repair upgrades. | Support | 100 | 10 |
| Energy siphon | +10% kill/wave energy at deployment; enables income upgrades. | Support | 180 | 25 |
| Stasis field | 10% inner-ring movement slow at deployment; enables stasis upgrades. | Support | 250 | 40 |

Unlocks are permanent purchases, not consumables. Changing a loadout is free. Rail + orbit fits the power budget; rail + arc does not. Arc + mortar uses both slots and all 4 power. A support module replaces the other two support choices. Starting weapon levels are excluded from settlement spending; subsequent weapon upgrades use their level-1 price, not the installation price from the archived ruleset.

## Endless ramp and combat

Wave 1 is drones only. Runners join at 2, swarms at 3, armored bulwarks at 4, and splitters at 6. Every fifth wave adds a siege boss. Splitters release three swarms. Wave size increases to 100 regular enemies; spawn cadence, movement speed, enemy damage and health increase with waves. Health follows `1 + 0.20(w − 1) + 0.09 max(0, w − 7)^1.3`, then compounds at 1.12 per wave after wave 10. There is no final wave or independent difficulty selector.

Enemies enter at radius 410 and move 30% faster than ruleset 4, producing first fire at about 6.65 seconds. Standard wave breaks last 3.5 seconds; a cleared boss wave gives 6.5 seconds for recovery. Players can pause to make upgrades at any point.

The engine advances in deterministic 50ms steps. Cooldown overshoot carries forward. Pulse projectiles reserve lethal damage and retarget after a target dies. Rails pierce a line; arcs jump to distinct neighbors; orbitals collide with enemies, including hull attackers. Mortars mark a ground location, then hit after 0.65 seconds. All enemies within the blast receive full splash damage before armor mitigation. Armor reduces non-rail/non-Nova damage by 25% on bulwarks and bosses.

Weapon power improves the arsenal; amplifier research improves pulse and auxiliary damage. Nova uses its dedicated permanent research track. Pulse haste, multishot and crit affect only pulse. Overdrive doubles pulse fire rate, arc/rail/mortar recharge speed and orbital damage. Shields wait three seconds after the last hit before recharging. Actual damage, kills, shots, shield absorption and energy budgets are recorded. Fractional siphon income carries forward rather than disappearing to per-kill rounding.

## Currency and pacing

**Energy** is the temporary run budget. Start with 80, plus 12 per reserves research level. Kills and wave clears supply more. It resets at deployment and never converts into permanent credits.

**Credits** belong to the account. Each completed run pays `min(1800, 3 × cleared + floor(cleared² / 8))`. Zero-wave runs pay zero; there is no kill, duration or unused-energy payout. Repeat runs always pay their wave credits.

| Newly cleared personal wave milestone | One-time bonus |
| --- | --- |
| 5 | 20 |
| 10 | 35 |
| 15 | 55 |
| 20 | 85 |
| 25 | 120 |

A first wave-10 run pays 42 + 55 = 97 credits; a repeat pays 42. A first wave-15 run pays 73 + 110 = 183. Lifetime waves accumulate across runs for equipment access. The first auxiliary should be reachable after one solid defense or two shorter active runs. Saving for the whole armory competes with core research; equipment costs 1,530 credits in total. Six research tracks each have 10 levels, with prices growing by 1.35 per level. Level 3 in all tracks costs 878 credits. See [the measured balance report](NEXUS_BALANCE_REPORT.md) for run lengths, survival bands and tuning limitations.

## Implementation and persistence

| Concern | Source |
| --- | --- |
| Engine and telemetry | `src/lib/nexus/core/engine.ts` |
| Versioned combat rules | `src/lib/nexus/core/rules.ts` |
| Weapon values, upgrade previews, research prices | `src/lib/nexus/core/systems.ts` |
| Career ranks, medals and contextual goals | `src/lib/nexus/core/career.ts`, `CoreCareer.tsx`, `CoreUnlockReveal.tsx`, `career.css` |
| Equipment, loadout validation, upgrade gates, milestones | `src/lib/nexus/core/progression.ts` |
| Enemy/upgrade/research catalog and archived scenarios | `src/lib/nexus/core/catalog.ts` |
| Checkpoint validation and migration | `src/lib/nexus/core/persistence.ts` |
| Account RPCs and ledger | `src/hooks/useNexusCore.ts` |
| Shared loadout editor | `src/components/nexus/core/CoreLoadoutEditor.tsx` |
| Animated menu presentation | `CoreMotion.tsx`, `CoreSelectionDeck.tsx`, `game-feel.css` in `src/components/nexus/core/` |
| Full-viewport combat and thumb controls | `src/pages/NexusBattlePage.tsx`, `src/components/nexus/core/battle.css` |
| Database migrations | `supabase/migrations/20261029020000_nexus_endless_loadouts.sql`, `20261029030000_nexus_combat_pacing.sql` |

Current checkpoints retain `version: 2`, `balanceVersion: 5` and `nexus_core_run_v2:<user-id>:<club-id>`. They include the deployed loadout, mortar cooldown and in-flight ground-impact shells. Invalid loadouts, hidden unequipped upgrades, unknown future rulesets and missing starting weapons are rejected on restore. Ruleset-4 checkpoints continue using their original weapon values, enemy ramp, approach speed and breaks. Restores pause. The game pauses on blur/tab hide, and checkpoints flush on exit, backgrounding, purchases, abilities and completion. An unclaimed result must sync before another local deployment can overwrite it.

All game menus and combat own the dynamic viewport through portals to `document.body`, escaping page-transition transforms. `menus.css` defines the persistent game frame, animated SVG title core, compact item cards, bottom navigation and fixed deployment/replay actions. The title offers Play, Arsenal and Research without an introductory essay. Moving nebulae, particles and scan lines establish the game scene; screen and item transitions use Framer Motion with reduced-motion support. Loadout and lab use `CoreSelectionDeck`: one animated equipment/research bay, all item selectors visible, keyboard arrows/Home/End and a nearby equip/unlock/upgrade action. Purchased equipment deep-links to its loadout selection. Wave milestones, credit history, item mechanics and run telemetry open in focused dialogs. The guide keeps one accordion group open at a time. Records adapt their page size to the available height. Results animate wave, score and reward counts, with replay always visible. The field guide starts folded. Title, loadout, lab, results and records fit inside the viewport without vertical scrolling. Long reference material and dialogs scroll internally. Document scrolling is restored when Nexus unmounts.

Play, Deploy and Play Again use a fresh server ticket and launch intent to enter wave one directly. Restoring an existing checkpoint always pauses. Fresh launch intent is accepted only for its matching ready checkpoint, so refreshing an active run cannot bypass pause. The ready-screen intro remains available for previously saved pre-launch checkpoints.

Combat fills the screen. The app header is hidden, document scrolling is locked, and the lower portrait command deck contains 44px controls, abilities, speed, pause, systems and swipeable upgrades. Inspection pauses combat. Intro, pause and systems panels adapt to portrait, landscape, safe areas and dynamic browser height. Reduced motion suppresses the entry reveal. Wave entrances, siege announcements/health, impact edges, ready abilities, Overdrive glow and successful upgrade feedback reinforce combat events. These cues do not change simulation timing or pause behavior. `useCoreFeedback` expires notices and replaces the previous notice when an action succeeds. Leaving Nexus restores normal document scrolling.

## Server boundary

The four core tables use RLS. Clients cannot directly write progression, sessions, runs or the credit ledger. Profile row locks serialize equipment purchases, research, loadout changes, deployments and settlement. Equipment prices, ownership and lifetime requirements are checked server-side. New deployments receive an immutable seed, research snapshot, loadout and ruleset version; only one active deployment exists per account. Retries reuse the original ticket even if the player changes equipment afterward.

`nexus_core_begin_endless(p_id, p_club_id, p_loadout, p_balance_version)`, `nexus_core_finish_endless`, `nexus_core_unlock` and `nexus_core_loadout` implement the new protocol. Settlement validates membership, session ownership, phase, integer bounded counters, duration, upgrade eligibility/caps/prices, free starting levels and energy conservation. The server calculates wave pay and newly crossed milestone bonuses. New clients request ruleset 5 and simulate the returned ticket version. The version parameter defaults to 4 for cached clients. Settlement accepts registered versions 4 and 5, requires matching version claims for version 5 and persists the ticket version on the result. Run UUIDs make duplicate claims idempotent. Every purchase and positive payout writes an account-scoped ledger receipt.

Combat is client-simulated. The settlement checks are consistency checks, not authoritative anti-cheat. Club records select each member's best ruleset-5 Endless run by waves, then score, before limiting to 50 members.

## Archived compatibility

Existing credit balances and research are retained. Earlier campaign/challenge data, path-game tables and old Endless records remain archived. `best_wave` is historical; `endless_best` and `total_waves` retain account-wide Endless Arsenal progress across rulesets 4 and 5, so milestones cannot pay again after a balance release. Old registered runs can finish with their prior receipt rules; older accounts retain their one legacy checkpoint import. The old deployment RPC rejects new non-import starts, and the old reward RPC rejects ruleset-4/5 sessions. Mortars cannot be installed in archived runs.

Campaign/challenge and old numeric loadout URLs redirect to the Endless loadout. Legacy battle/result URLs can finish existing local checkpoints. Keep the installed-asset gate on every active player route. The scoped game skin remains dark in both app themes.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`
- `npm run test:unit`
- `npm run build`
- `node --import tsx scripts/balance-nexus-core.ts --all --output=/tmp/nexus-balance.json` — 3,456 actual-engine runs across all 36 legal weapon/support combinations, six policies, four seeds and four research tiers. `--version=4` reproduces archived tuning; the default six-build sweep remains available without `--all`.
- Against Vite on port 8080: `node scripts/check-nexus-core-ui.mjs`, `node scripts/check-nexus-mobile.mjs` and `node scripts/check-nexus-menus.mjs`. These use production pages, hooks, CSS and engine with an isolated account backend, never live account mutations.
- Generate `node --import tsx scripts/nexus-endless-contract.ts > /tmp/nexus-endless-contract.json`, then run `scripts/test-nexus-endless.mjs` with optional `@electric-sql/pglite` available. It applies the real loadout and pacing migrations twice and exercises real PostgreSQL constraints, all 103 upgrade-level points, 60 research prices, seven unlocks, free starting levels, loadout ownership/power, reward retries, milestones, archived-protocol isolation, ledger RLS and club records.

The older database scripts reproduce historical migrations only. Use the Endless contract for the current protocol.

The dedicated menu browser check covers eight viewport sizes, a direct body portal, concise title copy, 44px controls, fixed Deploy/Play Again actions, modal geometry, safe areas, viewport resizing, one-tap fresh starts, replay, paused restores, exit cleanup and centered SVG animation with reduced-motion support.

The game-feel browser check, `node scripts/check-nexus-game-feel.mjs`, verifies no vertical scrolling on the primary screens at all eight viewport sizes. It visits every equipment and research selection, checks 44px targets, keyboard focus, adaptive record pages, result dialogs, exclusive guide expansion, reduced motion, moving equipment/backgrounds and actual purchase/equip/combat feedback. `check-nexus-core-ui.mjs` follows the same selection workflow for economy and saved-loadout regression checks.

`node scripts/check-nexus-career.mjs` covers ranks, medals, contextual objectives, acquisition reveals and direct equip links at all eight screen sizes. It checks zero credit grants from viewing career, failed purchases without acquisition feedback, promotion only after reward settlement, and receipt refresh without duplicate progression or celebrations. Career uses saved `total_waves`, `endless_best`, `unlocks` and `research`; ranks and medals grant no additional currency and require no new database schema.

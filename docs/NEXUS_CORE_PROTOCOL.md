# Nexus Defense — Core Protocol v2

Nexus Defense is a mobile-first, central-core survival game inspired by the upgrade decisions in games such as The Tower. The player fortifies one stationary nexus. Enemies approach directly from every angle at different speeds; there are no lanes, path maps, build tiles, or placed towers.

## Player loop

1. Choose a campaign sector, challenge, or endless run.
2. The nexus automatically fires homing pulse projectiles within its targeting radius. Prioritize nearest, strongest, or fastest enemies.
3. Kills and cleared waves award **energy**. Spend energy during the run on attack, defense, and utility systems. Purchases take effect immediately.
4. Trigger **Nova burst** (area damage, knockback, temporary slow; 20-second cooldown) and **Overdrive** (2× weapon output for six seconds; 30-second cooldown).
5. Enemies that reach the core keep attacking every second until destroyed. Shields absorb damage first and recharge three seconds after the last hit. Armor reduces incoming damage, and repair systems restore hull.
6. Every completed run awards **research credits**. Permanent research improves the next run; energy and in-battle upgrades reset.

## Modes

- **Campaign:** eight sequential sectors, five to twelve waves each. Clear a sector to unlock the next. Bosses arrive every fifth wave and guard each sector finale. Sector eight has two bosses in its final wave. Victory earns one star; finishing with 40% hull earns two, and 80% earns three. Replays preserve the highest star rating.
- **Endless:** open from the start, with no final wave. A boss arrives every fifth wave. Enemy health increases exponentially after wave ten, so fully upgraded cores eventually face overwhelming pressure. The best cleared wave is the primary club ranking metric.
- **Velocity:** eight waves, 60% faster enemies.
- **Glass cannon:** six waves, one hull point, no defensive upgrades or shield, double weapon damage.
- **Heavy metal:** nine waves, armored enemies from wave one, a boss every third wave.
- **Blackout:** eight waves, no hull repair or shield recharge. Hull/shield capacity purchases still restore the capacity they add.

Enemies: drones, runners, swarms, armored bulwarks, splitters that spawn three swarms on death, and armored siege bosses. Orbital blades are moving weapons with actual collision-based damage; stasis slows enemies in the inner ring.

## Economy and progression

- Fourteen energy upgrade tracks: pulse damage, fire rate, targeting range, multishot, critical strike, hull, shield, nanite repair, armor, energy siphon, orbital blades, stasis, chain arc, and rail lance.
- Six permanent research tracks: damage, fire rate, hull, shield, starting energy, and nova damage. Each has ten levels; prices grow by 1.35 per level.
- Cleared campaign waves earn 4–8 credits depending on the sector; challenge waves earn 6. Endless pays `4 × waves + floor(waves² / 4)`, capped at 1,500. First-clear sector/challenge bonuses are paid once per account. Replays earn wave credits, and zero-wave losses earn nothing. Energy cannot be converted into research credits. Abandoning an unfinished run does not earn credits.
- Research and campaign progress belong to the authenticated player across clubs. Run records belong to the club where the run finished. The club leaderboard selects each member's best run before limiting to the top 50; repeated runs cannot crowd out other players.

## Implementation

| Concern | Source |
| --- | --- |
| Fixed-step, deterministic combat | `src/lib/nexus/core/engine.ts` |
| Modes, enemies, upgrades, research | `src/lib/nexus/core/catalog.ts` |
| Versioned checkpoint validation | `src/lib/nexus/core/persistence.ts` |
| Account progression and reward RPCs | `src/hooks/useNexusCore.ts` |
| SVG arena and game design system | `src/components/nexus/core/` |
| Player pages and routing | `src/pages/Nexus*Page.tsx`, `src/App.tsx` |
| Tables, RLS, atomic mutations | `supabase/migrations/20261029000000_nexus_core_overhaul.sql` + `20261029010000_nexus_core_economy.sql` |

The engine advances in pure 50ms steps. Fractional cooldown overshoot carries forward so displayed weapon rates match combat. Pulse projectiles reserve expected lethal damage and retarget after a target dies. Chain arc visits distinct nearby targets with damage falloff; rail lance pierces aligned enemies and ignores armor. Research and weapon power amplify all systems; fire rate, critical strike, and multishot modify the pulse cannon. Overdrive doubles pulse fire rate, arc/rail recharge speed, and orbital damage. Telemetry counts actual HP removed and credits kills to their weapon. Energy siphon carries fractional bonuses instead of rounding each kill. 2× speed executes two steps per interval. The seeded random state is part of the checkpoint, so restoring a run preserves its simulation. Runtime entities and transient effects are bounded. The game pauses when the document is hidden or the window loses focus. Checkpoints flush on route changes, backgrounding, purchases, abilities, and run completion.

Active runs save **on the current device**, under `nexus_core_run_v2:<user-id>:<club-id>`. Research and completed records sync through Supabase. A restored run begins paused. Starting another run requires explicitly replacing an unfinished checkpoint. Unclaimed completed runs must sync their rewards before a new deployment can overwrite them. If storage is unavailable, the UI warns the player and carries the completed run through router state.

`nexus_core_profiles`, `nexus_core_runs`, `nexus_core_sessions`, and `nexus_core_ledger` have row-level security. Deployments are registered before a new run starts; the server supplies a stable seed and research snapshot. One active deployment per account prevents parallel claims from abandoned runs. Existing accounts may import one pre-upgrade checkpoint without losing previously earned progression. Clients cannot write these tables directly. Research purchases lock the profile row and calculate prices on the server to prevent concurrent overspending. Reward claims also lock the profile and are idempotent by run UUID. The server validates deployment IDs, scenario IDs, membership, campaign unlocks, wave limits, durations, bounded counters, upgrade prices/caps, and energy-budget consistency. It calculates rewards and one-time clear bonuses itself. Every new research purchase and positive run payout creates a receipt in the account-scoped credit ledger. Combat and score generation remain client-side, consistent with the original casual game; this is not an authoritative anti-cheat server.

## Legacy compatibility

The old path engine, mission configurations, progress, cosmetics, and run tables remain intact for historical data. They do not affect v2 combat, credits, research, or rankings. `/nexus/loadout/100` still resolves to endless. Retired co-op and path-tuning routes redirect to relevant new surfaces; admin menus no longer advertise tuning tools that do not control the new engine. The original co-op operation system is not part of v2.

Keep the `nexus-defense` installed-asset gate on every player route. The scoped game skin deliberately stays dark in either app theme. Do not reintroduce lanes or placeable towers.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`
- `npm run test:unit` (includes `src/test/nexus/coreEngine.test.ts`)
- `npm run build`
- Run the Vite dev server on port 8080, then `node scripts/check-nexus-core-ui.mjs`. The browser fixture uses production components, hooks, and engine with in-memory auth/database responses; it never writes to a live account. It covers 320/390/768/1440 widths, both app themes, research, upgrades, pause/resume, replacement, campaign locks, and reward retry.
- `node scripts/test-nexus-core-db.mjs` with optional `@electric-sql/pglite` installed. This creates an isolated PostgreSQL database, exercises the real migration twice, and verifies RLS, credits, research spending, duplicate claims, campaign unlocks, leaderboard selection, and club isolation.

## Future work

Add more sectors, enemy behaviors, challenge rotations, research branches, and core cosmetics through the v2 catalog and engine. Any future co-op should be designed for central-core combat. Cloud checkpoints and authoritative score verification can be added separately without mixing the old path-engine state into v2 saves.

## Economy and balance regression checks

- `node --import tsx scripts/balance-nexus-core.ts --output=/tmp/nexus-balance.json` runs the actual engine with six policies, eight seeds, thirteen scenarios, and two research tiers (1,248 runs). The report records weapon damage and energy budgets, not theoretical DPS. See [NEXUS_BALANCE_REPORT.md](NEXUS_BALANCE_REPORT.md) for the measured baseline and limitations.
- `src/test/nexus/coreSystems.test.ts` checks actual fire rates, crits, retargeting, arc chains, rail piercing, orbitals at the hull, damage accounting, shield delays, slows, energy conservation, every upgrade cap, and payout policy. `coreBalance.test.ts` guards build viability and research progression.
- Generate the frontend economy contract with `node --import tsx scripts/nexus-economy-contract.ts > /tmp/nexus-economy-contract.json`, then run `node scripts/test-nexus-core-economy.mjs` with optional `@electric-sql/pglite` installed. It applies the real economy migration twice and compares all 83 upgrade levels and 60 research prices to the server.

## Mobile battle presentation

Combat owns the full dynamic viewport and renders through a portal to `document.body`, so route-transition transforms cannot constrain fixed positioning. The site header is hidden during battle. The document is locked while the game is mounted and restored on exit; only upgrade strips and inspection panels scroll.

Portrait phones keep the arena above a fixed command deck: large Nova/Overdrive buttons, pause, energy, speed, systems, a swipeable upgrade strip, and category tabs. Controls have at least 44px touch targets and stay in the lower half of the screen. Landscape uses a compact arena/sidebar arrangement. Both layouts account for safe areas and changing browser viewport heights.

Fresh deployments open on a full-screen mission introduction with a bottom-positioned Start button and a brief arena reveal. Reduced-motion preferences remove the reveal animation. Resuming a paused battle returns directly to combat. Pause and systems panels open near the thumb on portrait phones; inspecting systems stops the simulation. Desktop and landscape menus remain within the available height. Native browser fullscreen is offered in the pause menu when supported.

The scoped layout lives in `src/components/nexus/core/battle.css`. Run `node scripts/check-nexus-mobile.mjs` against Vite on port 8080 for real touch-swipe, viewport, safe-area, pause, and scroll-cleanup checks across eight phone/tablet/desktop sizes. The account backend is isolated through `scripts/nexus-ui-fixture.mjs`; production components and the actual engine are used.

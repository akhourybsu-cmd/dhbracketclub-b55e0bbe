# Nexus Defense — Core Protocol v2

Nexus Defense is a mobile-first, central-core survival game inspired by the upgrade decisions in games such as The Tower. The player fortifies one stationary nexus. Enemies approach directly from every angle at different speeds; there are no lanes, path maps, build tiles, or placed towers.

## Player loop

1. Choose a campaign sector, challenge, or endless run.
2. The nexus automatically fires homing pulse projectiles within its targeting radius. Prioritize nearest, strongest, or fastest enemies.
3. Kills and cleared waves award **energy**. Spend energy during the run on attack, defense, and utility systems. Purchases take effect immediately.
4. Trigger **Nova burst** (area damage, knockback, temporary slow; 20-second cooldown) and **Overdrive** (2.2× fire rate for six seconds; 30-second cooldown).
5. Enemies that reach the core keep attacking every second until destroyed. Shields absorb damage first. Armor reduces incoming damage, and repair systems restore hull.
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

- Twelve energy upgrade tracks: pulse damage, fire rate, targeting range, multishot, critical strike, hull, shield, nanite repair, armor, energy siphon, orbital blades, stasis.
- Six permanent research tracks: damage, fire rate, hull, shield, starting energy, and nova damage. Each has ten levels.
- Finishing a run earns 5 credits + 6 per cleared wave (wave component capped at 500), plus a sector/challenge victory bonus. Replaying victories earns the bonus again. Abandoning an unfinished run does not earn credits.
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
| Tables, RLS, atomic mutations | `supabase/migrations/20261029000000_nexus_core_overhaul.sql` |

The engine advances in pure 50ms steps. 2× speed executes two steps per interval. The seeded random state is part of the checkpoint, so restoring a run preserves its simulation. Runtime entities and transient effects are bounded. The game pauses when the document is hidden or the window loses focus. Checkpoints flush on route changes, backgrounding, purchases, abilities, and run completion.

Active runs save **on the current device**, under `nexus_core_run_v2:<user-id>:<club-id>`. Research and completed records sync through Supabase. A restored run begins paused. Starting another run requires explicitly replacing an unfinished checkpoint. Unclaimed completed runs must sync their rewards before a new deployment can overwrite them. If storage is unavailable, the UI warns the player and carries the completed run through router state.

`nexus_core_profiles` and `nexus_core_runs` have row-level security. Clients cannot write either table directly. Research purchases lock the profile row and calculate prices on the server to prevent concurrent overspending. Reward claims also lock the profile and are idempotent by run UUID. The server validates scenario IDs, membership, campaign unlocks, wave limits, and outcomes, and calculates rewards itself. Combat and score generation remain client-side, consistent with the original casual game; this is not an authoritative anti-cheat server.

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

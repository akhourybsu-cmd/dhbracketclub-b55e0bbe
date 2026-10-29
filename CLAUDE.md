# DH Club — Claude Context

Mobile-first social/competition app for clubs. React + Vite + TypeScript + Supabase + Tailwind + shadcn/ui + framer-motion + lucide-react.

## Mental model

DH Club is a **multi-tenant club app**. Each user has a single active **club**; that club installs **assets/plugins** from a global catalog. Almost every UI surface gates on whether a given asset is installed for the current club.

```
Auth → Club → Installed Assets → Plugin UI surfaces (Home / Settings / Profile / Dedicated routes)
```

**Never assume a feature is available — always gate on `useClubAssets().isInstalled(slug)`.** If you want a quick "what slug am I checking?" answer, look in [`src/types/assets.ts`](src/types/assets.ts) → `NAV_ASSET_SLUGS`.

## Core systems (read these first)

| Concern | Where it lives |
|---|---|
| Authentication | [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) (`useAuth()`) |
| Active club + admin flag | [`src/contexts/ClubContext.tsx`](src/contexts/ClubContext.tsx) (`useClub()` → `club`, `membership`, `isClubAdmin`, `isPlatformOwner`, `isAppAdmin`) |
| Installed plugins | [`src/hooks/useClubAssets.ts`](src/hooks/useClubAssets.ts) — `installedAssets`, `allAssets`, `isInstalled(slug)`, optimistic install/uninstall/toggle with rollback, `pendingInstall/Uninstall/Toggle` sets |
| Asset catalog | `platform_assets` table (DB) — names, slugs, categories, descriptions, sort_order |
| Per-club installs | `club_installed_assets` table — joined `(club_id, asset_id)` with `enabled` + `visible_to_members` flags |
| Asset library UI | [`src/components/clubAssets/`](src/components/clubAssets/) — `ClubAssetLibrary`, `AssetCard`, `InstallAssetSheet` |
| Onboarding framework | [`src/lib/onboarding/`](src/lib/onboarding/) + [`src/components/onboarding/`](src/components/onboarding/) + [`src/hooks/useOnboarding.ts`](src/hooks/useOnboarding.ts) |
| Home screen orchestrator | [`src/pages/DashboardPage.tsx`](src/pages/DashboardPage.tsx) — slim composer of `home/` modules |
| Home modules | [`src/components/home/`](src/components/home/) — `HomeHero`, `QuickBar`, `RightNowCard`, `AssetLauncher`, `LeagueSnapshot`, `EventsStrip`, `ClubPulse`, `Highlights`, `MembersOnline`, `DiscoverStrip`, `EmptyClubState` |
| Shared app navigation | [`src/lib/appNavigation.ts`](src/lib/appNavigation.ts) — canonical route labels, icons, sections, active matching, mobile tabs, and game-shell detection |
| Shared mobile shell primitives | [`src/components/mobile/`](src/components/mobile/) — accessible 44px icon buttons, screen headers, and token-driven surfaces |

## Asset/plugin system — how to add a new one

1. Insert a row into `platform_assets` via a Supabase migration (slug, name, category, short_description, full_description, icon_name, placement_area, sort_order).
2. (Optional) Create per-plugin tables + RLS policies in the same migration.
3. Add the slug → route to `NAV_ASSET_SLUGS` in [`src/types/assets.ts`](src/types/assets.ts) so nav filtering works.
4. Add an entry to the onboarding registry in [`src/lib/onboarding/registry.ts`](src/lib/onboarding/registry.ts) — the existing "What's New" flow will auto-surface a 3-step tutorial when the asset is installed.
5. Add the lazy route in [`src/App.tsx`](src/App.tsx).
6. Gate every plugin surface on `isInstalled('your-slug')`.
7. (Optional) Add per-plugin settings table and an admin panel — mount it inside `ClubSettingsPage` conditionally.

Existing slugs (canonical list in `NAV_ASSET_SLUGS`):
`draft-arena`, `rune-delve`, `nexus-defense`, `nfl-pickem`, `brackets`, `portfolio-wars`, `lockbox`, `chat`, `events`, `lore`, `feed`, `polls`, `rankings`, `posts`, `shared-media`, `birthdays-milestones`, `narrative-rpg`, `workout-competition`.

## Conventions

- **Mobile-first.** Bottom-sheet modals via `createPortal(node, document.body)` to escape transform contexts (PageTransition, framer-motion route wrappers). The first time someone forgets this, the sheet ends up positioned relative to a transformed ancestor instead of the viewport.
- **Do not add app-wide pull-to-refresh.** It intercepts downward scrolling at the top of long mobile pages and conflicts with native browser/PWA gestures. Use explicit page refresh/retry controls for surfaces that need them.
- **Non-game pages use the member-page system.** Add `.member-page` to member/community page roots and reuse `.page-toolbar`, `.page-toolbar-actions`, `.page-action`, `.page-header`, and `.back-link` for consistent spacing and touch targets. Do not apply this system to bespoke game shells.
- **Navigation has one source of truth.** Add or reorder shared shell routes in [`src/lib/appNavigation.ts`](src/lib/appNavigation.ts); the drawer, desktop sidebar, mobile tabs, page titles, active-route matching, and game-shell detection consume it.
- **Tailwind + shadcn/ui.** Don't introduce new icon libraries; use `lucide-react`. Colors via `hsl(var(--...))` tokens — full set in [`src/index.css`](src/index.css).
- **Light/dark mode.** Always test both; never use raw hex/rgb that fails contrast in one mode.
- **`(supabase as any).from('...')`** is the pattern for tables whose types aren't in the generated Supabase types yet. Use real types once they're generated.
- **Optimistic updates with rollback** is the standard for mutations. Pattern: capture snapshot → optimistic state update → await Supabase call → catch + restore snapshot on error. See `useClubAssets` for the canonical implementation.
- **Stale-closure gotcha**: long-lived callbacks (toast onClick, portaled buttons) capture state at their creation time. If your mutator's `useCallback` depends on a state array and the array updates before the callback fires, you'll get stale reads. Mirror the array in a `useRef` updated via `useEffect`. See `useClubAssets.installedRef` for the canonical fix.
- **Perpetual-loading defense (REQUIRED for every data-loading hook)**: any `Promise.allSettled([...queries])` only resolves when EVERY query settles. A single hung Supabase fetch (dropped WebSocket, throttled background tab, network stall) traps the awaiter forever — `finally { setLoading(false) }` never runs and the user is stuck on a skeleton. **Always wrap each query and the outer race in [`withTimeout`](src/lib/asyncGuards.ts)** with `QUERY_TIMEOUT_MS` / `HYDRATE_TIMEOUT_MS`. Page-level skeletons should also expose a manual retry escape hatch after ~10s as a last-resort UX safety net (see `DetailSkeleton` in `NarrativeCampaignDetailPage.tsx`). Canonical hook implementation: [`useNarrativeCampaign.ts`](src/hooks/useNarrativeCampaign.ts) `refresh()`.
- **Onboarding for new plugins is automatic** — just register in `registry.ts`. The What's New flow + admin Preview button + first-time tour all pick it up.
- **RLS policies are the security boundary.** Hooks trust policies; don't double-filter unless you also need to hide rows from a client's local view (e.g., `visibility === 'hidden'`).
- **Rune Delve balance auto-applies to seeded levels.** `useLevel` runs every `rune_delve_levels` row through `hydrateLegacy` ([`useRuneDelveCampaign.ts`](src/hooks/useRuneDelveCampaign.ts)), which overlays the deterministic generator's `enemy_config` + `turn_limit` (+ generator modifiers) in-memory on read — for ALL levels, not just boss levels. So tuning [`levelGenerator.ts`](src/lib/runedelve/levelGenerator.ts) (HP caps, boss/elite-slot caps, turn budgets, the depth curve) takes effect on existing DB rows with **no data migration**; the stored row is never mutated (run FK history preserved). Corollary: don't rely on a hand-edited `enemy_config` in the DB sticking — it's overwritten by the generator on read. Boss/elite HP is capped AFTER the tier multiplier via `bossHpCap`/`eliteHpCap` — the promoted slot was previously uncapped and made deep levels unwinnable for non-Mage classes. Validate balance with the headless [`simulator.ts`](src/lib/runedelve/simulator.ts) (`simulateLevel`), remembering it models NO relics/masteries/board-mechanics and scores only kill-all (survive/reach_score under-counted).
- **Rune Delve shards are spent via atomic RPCs.** `useEarnShards`/`useSpendShards` ([`useRuneShards.ts`](src/hooks/useRuneShards.ts)) call the `rune_delve_earn_shards`/`rune_delve_spend_shards` SECURITY DEFINER functions (relative arithmetic + overdraw guard) — never client-side read-modify-write, which double-spent under concurrency. Anything that grants/spends shards after another action (shop) must refund on failure.

## Major features (last six months)

These are stable; reference them as patterns, don't reinvent.

| Feature | Surfaces | Key files |
|---|---|---|
| Compete reorg | `/compete` (banner list of installed games), `/drafts` (Drafts / Season / Commissioner tabs) | [`src/pages/CompetePage.tsx`](src/pages/CompetePage.tsx), [`src/pages/DraftsListPage.tsx`](src/pages/DraftsListPage.tsx) |
| Nexus Defense — Endless Arsenal / ruleset 5 | `/nexus`: one Endless mode. Starter pulse + two auxiliary hardpoints within 4 power and one support module. Four permanent weapon unlocks (orbit, arc, rail, mortar), three modules, six research tracks, lifetime-wave access and personal milestone credits. Equipped weapons start online; only deployed equipment can upgrade. Server-issued loadout snapshots, atomic purchases and idempotent rewards; ruleset-5 records stay separate from archives; earlier saves keep their original rules. Versioned specialist weapons, stronger repair support and a faster opening with shorter wave breaks. Full-viewport mobile combat and menus: animated world/title, one-tap Play, no-scroll equipment/research bays, fixed actions, animated results, adaptive record pages and optional detail dialogs. `CoreMotion.tsx`, `CoreSelectionDeck.tsx`, `game-feel.css` + `check-nexus-game-feel.mjs`; reduced motion is respected. Eight career ranks and eight medals derive from cloud-saved progression; contextual goals, post-settlement promotions and weapon acquisition reveals use `career.ts`, `CoreCareer.tsx`, `CoreUnlockReveal.tsx` and `career.css`. See `docs/NEXUS_CAREER.md` + `scripts/check-nexus-career.mjs`. `menus.css` + `scripts/check-nexus-menus.mjs`; battle retains thumb controls. See [`docs/NEXUS_CORE_PROTOCOL.md`](docs/NEXUS_CORE_PROTOCOL.md) and [`docs/NEXUS_BALANCE_REPORT.md`](docs/NEXUS_BALANCE_REPORT.md). | [`src/lib/nexus/core/`](src/lib/nexus/core/), [`src/components/nexus/core/`](src/components/nexus/core/), [`useNexusCore.ts`](src/hooks/useNexusCore.ts) |
| DH Score + Feats | `/feats`: account-wide lifetime score, 63 source-backed families / 314 tier unlocks across 18 areas, three tracked goals, adaptive collection and club lifetime/monthly standings. Server-only awards and permanent receipts; source writes invalidate accounts; historical import excludes monthly/reveals. Cards in Home/Profile/Club; shared shell sync. Home progress RPC and goal detail links use migration `20261029050000`. | `src/lib/feats/`, `src/hooks/useDHFeats.ts`, `src/pages/DHFeatsPage.tsx`, `src/components/feats/`, migration `20261029040000`, [protocol](docs/DH_FEATS.md), `scripts/test-dh-feats-db.mjs`, `scripts/check-dh-feats.mjs` |
| Rune Delve chamber layouts | Home, Level Map | [`src/lib/runedelve/runeLayouts.ts`](src/lib/runedelve/runeLayouts.ts), [`src/lib/runedelve/chamberAssignment.ts`](src/lib/runedelve/chamberAssignment.ts), [`src/components/runedelve/`](src/components/runedelve/) |
| DH Home | `/dashboard`: one responsive composition across mobile/desktop. Theme-aware score/rank + tracked feat, prioritized action, saved app dock, sourced Drop/Portfolio/Nexus/FORGE cards, and tabbed club activity. Independent source recovery; optional widgets/presence/tools mount in Club extras only. Current scoped Nexus resume and direct Drop/feat entry. | `src/pages/DashboardPage.tsx`, `src/components/home/MobileHome.tsx`, `HomeProgressCard.tsx`, `HomeFeatureGrid.tsx`, `src/hooks/useHomeSignals.ts`, `src/lib/home/signals.ts`, migration `20261029050000`, [protocol](docs/DH_HOME.md), `scripts/check-dh-home.mjs` |
| Shared notification inbox | Mobile safe-area header + collision-aware bell popover; exact unread count, shared account-scoped React Query cache, optimistic read/dismiss with rollback, timestamp + ID pagination, realtime with 30-second polling fallback. No schema change. | [`src/hooks/useNotifications.ts`](src/hooks/useNotifications.ts), [`src/components/NotificationBell.tsx`](src/components/NotificationBell.tsx), [`src/components/mobile/MobileAppHeader.tsx`](src/components/mobile/MobileAppHeader.tsx), [`scripts/check-mobile-home-ui.mjs`](scripts/check-mobile-home-ui.mjs) (isolated browser QA, no live writes) |
| Customizable QuickBar + screen-filling modules | Home dock + What's New, Members Online, Discover, Highlights | [`src/components/home/QuickBar.tsx`](src/components/home/QuickBar.tsx), [`src/components/home/useQuickBar.ts`](src/components/home/useQuickBar.ts) |
| Asset Library with optimistic install + undo | `/club/assets` | [`src/components/clubAssets/`](src/components/clubAssets/), [`src/hooks/useClubAssets.ts`](src/hooks/useClubAssets.ts) |
| Onboarding framework (club intro + What's New + admin preview) | Auto-mounts on Home + Asset Library | [`src/lib/onboarding/`](src/lib/onboarding/), [`src/components/onboarding/`](src/components/onboarding/), [`src/hooks/useOnboarding.ts`](src/hooks/useOnboarding.ts) |
| Birthdays & Milestones (first installable plugin) | `/celebrations`, Home widget, Club Settings panel, Profile section | [`src/components/celebrations/`](src/components/celebrations/), [`src/hooks/useCelebrations.ts`](src/hooks/useCelebrations.ts), [`src/lib/celebrations/dates.ts`](src/lib/celebrations/dates.ts) |
| FORGE (Workout Competition engine) | Immersive game shell at `/workouts/*` ([`ForgeLayout`](src/components/workout/ForgeLayout.tsx) + [`ForgeHUD`](src/components/workout/ForgeHUD.tsx) + [`ForgeBoot`](src/components/workout/ForgeBoot.tsx), `.fg-mode` ember skin in index.css, added to `isGameShell` in AppLayout). Weekly gauntlets run Monday→Monday ([`week.ts`](src/lib/workout/week.ts) `mondayWeekBounds`/`useCountdown`; admin defaults to Monday bounds). `/workouts` (member week screen: live segmented countdown, animated count-up score, rank/level/streak, per-exercise ember progress + few-seconds logging with goal-cleared burst, leaderboard, club group-goal card), `/workouts/admin` (measurement-type-driven exercise builder + Monday week builder + optional group goal), `/workouts/recap/:weekId` (final standings + derived Awards). Engine-driven: an exercise's `measurement_type` picks its logger (Rep, Timer, Duration, Countdown, Distance, Steps, Sets×Reps, Round, Completion), all writing ONE normalized `workout_activities` row. Score/XP/leaderboard/records/streaks/milestones/achievements/awards are all **derived on read** in the scoring lib from raw values (client never submits computed totals). Timers timestamp-based + localStorage-persisted. `source_type`/`source_activity_id` ready for future Apple Health/Fitbit/Garmin imports. **Self-running (no commissioner):** the first member to open FORGE on/after Monday auto-creates that week via the `ensure_forge_week` SECURITY DEFINER RPC (members can't write weeks under RLS), seeded from a built-in curated library ([`library.ts`](src/lib/workout/library.ts) — ~15 home exercises, each with logging preset, baseline, and a **tutorial** shown via [`TutorialSheet`](src/components/workout/TutorialSheet.tsx) one-tap "How to"). `pickWeeklySet` rotates a category-balanced set by week index. **Personal goals** are derived per member from their own history (`personalGoal` in scoring.ts — progressive overload, baseline for newcomers) and drive each tile's target/bar; the **club goal** auto-scales to member count. Competition scoring stays on the shared normalized basis so the leaderboard is consistent for all viewers. Admin builder still exists as an optional override. **Club flame** ([`ClubFlame`](src/components/workout/ClubFlame.tsx)) is the hero: a collective SVG flame whose intensity = club fuel / target; it surges + spits an ember burst on each log and fires a one-shot [`FullBlazeCelebration`](src/components/workout/FullBlazeCelebration.tsx) when maxed (once per club per week, localStorage-guarded). **Freeform workout log** (`/workouts/log`, [`WorkoutLogPage`](src/pages/WorkoutLogPage.tsx)): an always-on second logger alongside the gauntlet. A DB-backed **session** you fill in pieces (each entry autosaves, resumable across reloads); search a ~870-move public-domain catalog ([`exerciseCatalog.ts`](src/lib/workout/exerciseCatalog.ts), from free-exercise-db) or add a custom movement; log weights (weight×reps sets), bodyweight reps, timed holds, cardio (distance+time), or completion; each entry earns **fuel** ([`logScoring.ts`](src/lib/workout/logScoring.ts) point model — cached on the row at save, honor-system, raw values also stored). Session fuel **stokes the flame + adds lifetime XP but NOT the gauntlet leaderboard** (that stays featured-exercise only). Hook [`useWorkoutLog.ts`](src/hooks/useWorkoutLog.ts); sheets [`ExerciseSearchSheet`](src/components/workout/ExerciseSearchSheet.tsx) + [`LogEntrySheet`](src/components/workout/LogEntrySheet.tsx). **Weekly notification cycle**: pure-SQL pg_cron drops in-app `notifications` rows Mon (new gauntlet) / Thu (hasn't-logged nudge) / Sun (final hours). | [`src/lib/workout/`](src/lib/workout/) (types, measurement, scoring, achievements, useStopwatch, library, week, exerciseCatalog, logScoring), [`src/components/workout/`](src/components/workout/), [`src/hooks/useWorkoutArena.ts`](src/hooks/useWorkoutArena.ts), [`src/hooks/useWorkoutLog.ts`](src/hooks/useWorkoutLog.ts), [`src/hooks/useWorkoutAdmin.ts`](src/hooks/useWorkoutAdmin.ts), [`src/pages/WorkoutPage.tsx`](src/pages/WorkoutPage.tsx), [`WorkoutLogPage.tsx`](src/pages/WorkoutLogPage.tsx), [`WorkoutAdminPage.tsx`](src/pages/WorkoutAdminPage.tsx), [`WorkoutRecapPage.tsx`](src/pages/WorkoutRecapPage.tsx), migrations `20260811090000` + `20260811093000` + `20260811095000` + `20260812090000` (auto-weeks RPC) + `20260812093000` (cron reset) + `20260812110000` (notifications) + `20260812120000` (freeform log) |
| Narrative RPG (Chronicle Engine) | `/narrative` campaigns list, `/narrative/new` proposal, `/narrative/:id` detail with Story/Characters/World/Log tabs + GM Console drawer (Scene · Chapters · NPCs · Clues · Items · Factions · Clocks · Memory · Notes · AI). Reusable `EntityEditSheet` for inline edit of every GM-managed row. Real AI via `narrative-ai` edge function + `LOVABLE_API_KEY`, gated client-side by `VITE_NARRATIVE_AI_ENABLED`. SceneSummaryWizard for manual memory updates with structured diff review. MemberManagementSheet (invite/role/remove, guards against losing the only GM). LiveSessionControls (start/end + Live Now pill + duration). Player composer AI assist (public scope only). Computed campaign status (Waiting on GM / Waiting on Players / Live Now). | [`src/lib/narrative/`](src/lib/narrative/) (ruleset, templates, ai service, types, applyStateUpdates, campaignStatus), [`src/components/narrative/`](src/components/narrative/), [`src/hooks/useNarrativeCampaigns.ts`](src/hooks/useNarrativeCampaigns.ts), [`src/hooks/useNarrativeCampaign.ts`](src/hooks/useNarrativeCampaign.ts), [`supabase/functions/narrative-ai/`](supabase/functions/narrative-ai/) |

## Routing patterns

Single-club model (no `/clubs/:clubId/...` in user-facing routes). Plugin routes look like `/drafts`, `/celebrations`, `/nexus`, etc.

Auth + club guards live in [`src/App.tsx`](src/App.tsx):
- `<ProtectedPage>` — requires auth
- `<ClubAdminRoute>` — requires admin role in active club

## Migrations

`supabase/migrations/` — timestamp-prefixed SQL files. Conventions:
- Reuse the existing `set_updated_at()` trigger function.
- Always include `enable row level security` + named, idempotent (`drop policy if exists` then `create policy`) policies.
- Asset library inserts use `on conflict (slug) do update set ...` so re-running is safe.
- When adding plugin tables, write RLS that joins via `public.club_members` to enforce club-scoped visibility.

## Storage namespaces (localStorage keys)

| Key prefix | Owner |
|---|---|
| `dh_home_quickbar_v1:` | QuickBar pinned apps per (user, club) |
| `dh_onboarding_v1:` | Onboarding status per (user, club) |
| `dh_chat_draft_v1:` | Unsent Chat composer draft per (user, channel); cleared on sign-out |
| `nexus_core_run_v2:` | Current-device Nexus v2 checkpoints per (user, club); restored paused; old v1 saves stay archived |
| `nexus_endless_layout_v1` | Archived path-game map choice; unused by central-core combat |
| `dh_workout_timer_v1:` | In-progress Workout Arena timer (timed hold / countdown) per exercise — timestamp-based, survives reload |
| `dh_workout_log_timer_v1:` | In-progress FORGE freeform-log entry timer (timed / cardio) per exercise — timestamp-based, survives reload |
| `fg_blaze_v1:` | FULL BLAZE celebration already shown, per (club, week) |

## Don'ts

- Don't bypass `useClubAssets().isInstalled(slug)` to access plugin UI — clubs that haven't installed the asset must see nothing.
- Don't hardcode the 5-game launcher tile grid (deleted from the old Dashboard).
- Don't put per-feature long lists on the Home screen — they belong on the feature's own page.
- Don't use the `posts` flow as a generic "compose" surface without checking the existing route params it accepts (`?title=`, `?body=` are supported via `URLSearchParams`).
- Don't introduce drag-and-drop libraries (no `@dnd-kit` etc.) — arrow buttons for reordering have been the convention.
- Don't write to `installedAssets` directly — always go through `useClubAssets` mutators for the optimistic-rollback semantics.

## Dev workflow

```bash
npm run dev      # Vite dev server on :8080
npx tsc --noEmit # Type check (must pass before commit)
npx vite build   # Production build
```

`tsc --noEmit` is the gate. Use `npx tsc -p tsconfig.app.json --noEmit` (the root config alone does not check the app), `npm run test:unit`, `vite build`, and relevant browser checks. Nexus has isolated PostgreSQL and touch-browser scripts documented in its protocol guide.

## Notes for future sessions

- This file is auto-loaded by Claude Code. Keep it tight — index, not encyclopedia.
- When adding a new major feature/plugin, update the **Major features** table and the **Storage namespaces** table if applicable.
- Add new gotchas to **Conventions** so they don't get re-discovered.

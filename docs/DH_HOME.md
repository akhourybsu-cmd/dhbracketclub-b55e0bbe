# DH Home

`/dashboard` uses one responsive composition on phone, tablet and desktop. `DashboardPage` owns the base profile/activity/calendar/draft queries and assembles the data. `useHomeSignals` owns independent, cached feature signals; `MobileHome` (the retained export name) presents the same Home at every breakpoint. The legacy desktop dashboard is no longer mounted.

## Hierarchy and themes

The opening pairs DH Score, current rank and a next/tracked feat with the highest-ranked action. Urgent actions come first on phones; desktop places the two cards side by side. A quiet club gets a useful invitation rather than invented urgency. The saved app dock follows, then a maximum of four feature summaries and the Latest / Upcoming / In progress activity view.

Light mode uses paper surfaces, deep green ink and restrained category colors. Dark mode uses layered charcoal surfaces and softer accents. Both use the same typography, spacing and information hierarchy. Entrance and hover motion respect reduced motion. Keyboard navigation, native progress labels, 44px controls and portaled sheets are retained.

## Real signals

- DH progress comes from `dh_home_progress(p_club_id)`, an authenticated, membership-checked RPC. It reconciles the same public member cohort as the board before ranking, then returns only the caller's lifetime score, unlocked count, current club standing and up to eight unfinished goal candidates. Private sessions receive no public rank. Pinned goals sort first; Home filters candidates to available features. It never marks achievement reveals as viewed. Opening Home is not an engagement event; evaluation can settle already-earned feats from saved activity.
- The Drop reads the current club's three newest contributions, including title, kind and author. These also enter the activity view when The Drop is enabled, independently of the Feed plugin. Add a Drop opens the actual composer using `?compose=1`; opening it creates no post.
- Portfolio Wars reads the member's active portfolio in the current club, its actual starting capital and up to seven recorded values. Season return uses that starting balance. The chart contains actual observations and is omitted when insufficient data exists. Values are explicitly recorded/as-of values, not live quotes; a chart-fetch failure does not hide a valid recorded portfolio value.
- Nexus reads the account's saved endless best and the current-device v2 checkpoint for exactly this user and club. Only registered current endless checkpoints produce Resume; ended, unregistered and old path-game saves do not. Resume uses `/nexus/battle/endless`.
- FORGE reads the member's latest unfinished freeform session in the current club. Home does not start a workout or create a competition week.
- Feed rows include stored topic/title metadata. Draft urgency continues to use derived pick order instead of trusting a potentially stale current-picker column.

Each feature request has its own query state and a bounded timeout. A failed feature signal cannot blank the rest of Home. Base data also settles independently, retaining successful profile/calendar/activity responses and providing a retry for failed sources. Refresh updates the base data and eligible signals. Cache keys include the account and club; new signal queries only run for available apps.

## Secondary content and navigation

Profile settings and the shared navigation remain unchanged. App shortcuts retain `dh_home_quickbar_v1:<user>:<club>` preferences, six-pin limit and reorder controls. Larger app widgets, presence, season/story details, What's New, admin discovery and PWA install remain available in the portaled Club extras sheet. They mount only when that sheet opens. First-time onboarding remains a single page-level flow.

Tracked-goal links use `/feats?goal=<key>` and open the actual feat detail. A new-unlock reveal takes precedence over the detail, then returns to it on dismissal. Empty clubs retain their setup guidance. Availability/visibility checks gate app links, shortcuts, activity and signals.

## Validation

- `npm run test:unit`: 398 tests; includes dashboard scope, partial-source failures, updates, canonical Nexus resume, finite portfolio charts and saved-capital calculations.
- `npx tsc -p tsconfig.app.json --noEmit`, scoped ESLint and `npm run build`.
- `node scripts/test-dh-home-db.mjs`: real PostgreSQL Home/Feats protocol in isolated PGlite. Tests member-only access, fresh/complete careers, thresholds, pinned order, club standing, repeat evaluation without new score, and preserved achievement acknowledgements. Requires the same optional PGlite setup as `docs/DH_FEATS.md`.
- `node scripts/check-dh-home.mjs` against Vite :8080: actual Dashboard/shared shell/signals, goal detail and Drop composer with isolated data/peripheral hooks. Eight viewport sizes in both themes; readable secondary-text contrast, no horizontal overflow, own-data filters, no feature creation, lazy extras, customization, activity, direct links, scoped Nexus resume, unavailable apps and independent error recovery.
- `node scripts/check-mobile-home-ui.mjs`: shared inbox, notifications, theme contrast, shortcut persistence, enlarged six-pin layout, keyboard focus, reduced motion and live resizing regression checks. These QA scripts perform no live account writes.

The only database addition is migration `20261029050000_dh_home_progress.sql`; existing source records and game economies are unchanged.

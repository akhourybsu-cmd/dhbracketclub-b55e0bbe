# Mesomon — DH Club integration

Mesomon is a separate game at `/mesomon`, with a lazy-loaded `MesomonPage` and the existing DH authentication and active-club flow. The shared `AssetGuard` requires the club's installed `mesomon` asset. The page also checks installation directly because the shared guard intentionally allows application administrators to inspect uninstalled features.

The existing `appNavigation.ts` registry owns the menu destination, title, Compete context, and immersive-shell recognition. Mesomon matches only `/mesomon` and its children; neighboring route names do not gain its shell. `AppLayout` suppresses ordinary mobile navigation and shared desktop chrome using its established immersive-game behavior. Gesture restrictions belong to the Mesomon game surface, not shared DH CSS or document scrolling.

The Compete card appears only when `useClubAssets().isInstalled('mesomon')` is true. It loads a small original chapter cover lazily and imports no engine, game state, audio, or chapter data. The route imports the game page through `lazyWithRetry`; Phaser and chapter assets remain behind that route boundary. Existing games retain their routes and shells.

`src/lib/onboarding/registry.ts` registers three short steps in the existing installation and What's New framework. The game remains responsible for its playable opening rather than introducing a second onboarding service.

## Asset migration

`supabase/migrations/20261125193500_mesomon_asset.sql` adds or refreshes the `mesomon` catalog row. It follows Deep Claim's catalog-only installation policy: it does not install or enable the game in anyone's club, alter existing installations, or award DH Score. A club administrator can install Mesomon through **Club Apps** after the migration is deployed. The migration is additive and safe to run again.

The independent save migration, `20261125193000_mesomon.sql`, owns `public.mesomon_save_slots`, the atomic `public.mesomon_save` operation and `public.mesomon_can_play` access helper. Catalog registration alone does not prove cloud saves are deployed. SQL application, authenticated RLS verification, commit/push and public deployment must each be reported from their own evidence.

## Authentication and offline behavior

DH Club's existing sign-in and club gates remain authoritative. This integration does not create a public guest route or duplicate accounts. Local saves can continue to function inside an already loaded game when the network is unavailable; starting the authenticated DH application on a cold offline launch still depends on its existing session and cached-asset availability. No cloud write should be presented as successful while disconnected.

Chapter snapshots use `dh:mesomon:save:v1:${encodeURIComponent(userId || 'guest')}:${slot}`, with `:backup` and `:diagnostic` companions, in IndexedDB `dh-mesomon-v1` / `slots` and the bounded fallback. These are durable game saves, not temporary composer drafts. Sign-out retains the chapter; the hook resets on identity change and the account-specific key prevents another account from receiving it. Cloud slots remain user-owned rather than duplicating a chapter in each club.

Mesomon is an independent, non-canon story set in Mesoplasia's Halcyon Age. This integration does not modify any broader world canon database, narrative campaign, or other DH game.

## Verification

The starting main commit was `63dcaae3988d2150b052b20fbd84633ab5d1b565`, with a clean worktree, the correct GitHub origin, and the npm lockfile synchronized with Lovable. Before this feature, that commit passed application TypeScript, member lint, 252 unit files / 2,702 tests, production build and all ten GitHub checks.

`src/test/mesomonIntegration.test.ts` checks canonical navigation/asset grouping, exact immersive-route boundaries, preserved ordinary/previous game routes, concise registered onboarding and the accessible lightweight discovery link. Full feature tests and release verification are recorded in the main implementation report.

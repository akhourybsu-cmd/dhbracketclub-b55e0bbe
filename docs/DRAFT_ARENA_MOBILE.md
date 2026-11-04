# Draft Arena mobile scrolling

At widths below 1024px, the Arena main viewport owns vertical page scrolling. Draft headings, view tabs and content move together beneath the compact game HUD. Room panes, the pick-history list, lobby lists, creation stages, Green Room content and in-room ceremony lineups use their natural height. Desktop workspaces, portaled dialogs, the private player-screen dialog and the standalone projector retain their existing viewport boundaries.

Phone round panels use the full available width. Picks show full participant names and snake-order pick numbers; titles wrap without a two-line clamp on mobile, including landscape. Pick-log and team-card actions occupy a separate row so they cannot squeeze the artwork or title away. The history fade is limited to its desktop scrolling list. View changes reset the actual vertical owner while preserving horizontal board position.

No changes to draft turns, pick validation, ratings, invitation permissions, live clocks, persisted settings or results. No database migration or dependency is required. Gameplay-preservation checks compare protected declarations and files against `de38b3c8839de09d42b2c62eff3355e2fc2c4d7e`.

Local verification: 21 Draft Arena test files / 132 tests pass, application TypeScript passes and production build passes in 15.50 seconds. New modules and changed Board/Layout tests have clean scoped lint. The existing DraftDetailPage has the same 67 ESLint errors and one warning as the baseline; no new findings were introduced. The existing large-chunk build advisory remains.

The read-only browser workflow uses production screens with isolated identity, database/image transport and fixture content. Focused Chromium and WebKit checks cover one vertical owner, title/tab/content movement, full pick titles and access to the last Board/Log/Teams entries at 320×568, 390×844 and 844×390. Chromium phones use native emulated touch; WebKit uses mobile layout and scroll-chain input. This is browser emulation rather than physical-iPhone testing. The complete existing Chromium suite also covers desktop, live drafts and projectors. Browser execution and publication verification are pending.

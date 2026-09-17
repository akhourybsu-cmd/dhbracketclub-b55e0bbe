# Draft Arena Visual Redesign — Heritage Ledger

Visual-only redesign. No gameplay/logic changes. Foundation: near-black + warm charcoal + selective bronze/champagne, Space Grotesk (titles/data) + DM Sans (body), premium quiet ledger surfaces.

## Tasks
- [x] 1. Fonts: Space Grotesk + DM Sans (fontsource), imported in main.tsx
- [x] 2. Scoped `.da-lounge`/`.dl-*` tokens in index.css
- [x] 3. Compact persistent status header (DraftStatusHeader): Round X · Pick n/total, current picker, "X picks until you", elapsed clock, Make Selection CTA
- [x] 4. DraftBoard: desktop rounds×participants grid; mobile swipeable round panels with snap; imagery cells; gold-ringed current/your cells — verified desktop + mobile
- [x] 5. "Since your last visit" via useDraftLastVisit (localStorage per user+draft) + new-pick markers
- [x] 6. Make Selection bottom sheet (MakePickSheet, portaled) with preserved AI/duplicate checks — type-checked; no my-turn draft available for live sheet test
- [x] 7. Drafts list page: light typography pass (Space Grotesk on hero stats + season titles); existing war-room styling already matched lounge language
- [x] 8. tsc passes; esbuild parse passes; browser smoke verified on mobile + desktop (detail, board, round nav)
- [x] 9. Extend Heritage Ledger shell and shared primitives across the complete Draft Arena
- [x] 10. Polish hub, setup, results, seasons, stats, and commissioner surfaces
- [x] 11. Verify representative Draft Arena screens on mobile and desktop

# Crazy Chain refresh and responsive polish

- [x] 12. Surface Crazy Chain scoring and board-refresh outcomes from the manual NFL check
- [x] 13. Refresh NFL and Crazy Chain screen data in place after a manual check
- [x] 14. Polish Crazy Chain board, history, leaderboard, and controls for mobile and desktop
- [x] 15. Verify focused tests, type safety, and representative phone/desktop screens

# NFL Game Center + Draft Arena light/dark modes

- [x] 16. Give the NFL Game Center complete daylight and night theme tokens across shared screens and dialogs
- [x] 17. Restore a true parchment-light Heritage Ledger variant across the complete Draft Arena
- [x] 18. Add an accessible theme switch to both standalone center headers
- [x] 19. Verify representative NFL, Crazy Chain, Draft hub, and Draft room screens in both themes on phone and desktop

# Portfolio Wars — live trading league
- [x] 20. Wire Trade / Standings / Club tape / History screens into app routes
- [x] 21. Replace weekly-game header wording with live market open/closed status + countdown
- [x] 22. Retire weekly game schedules; add hourly market-hours revaluation, end-of-day snapshot, nightly symbol sync, daily season roll-over
- [x] 23. Fix season bootstrap (server-side membership check) — season + portfolio now created on first visit
- [x] 24. Verify screens, search, live quote and market-closed blocker in browser
- [ ] 25. Place one real buy/sell end to end — blocked until the US market is open (next open 09:30 ET)

# Pick’em sharing + chat interaction polish
- [x] 26. Share a locked weekly Pick’em card directly into an eligible DH chat channel
- [x] 27. Render shared Pick’em weeks as verified, live-data chat cards
- [x] 28. Move phone chat tools and message actions into consistent bottom sheets
- [x] 29. Stabilize chat scroll, keyboard, channel-switch, and menu behavior
- [x] 30. Verify focused tests plus phone/desktop light and dark chat flows

- [x] 31. Portfolio Wars trading desk: watchlists, stock detail pages, target-price orders, orders queued while closed, price alerts

# FORGE cleanup and logging polish
- [ ] 32. Make the FORGE Compete banner feel like a proper game entry point with current week and collaboration status
- [ ] 33. Streamline daily workout and freeform logging so members can start with fewer taps
- [ ] 34. Clean up collaborative flame, roster, and club-goal presentation
- [ ] 35. Verify FORGE screens and logging flows in browser

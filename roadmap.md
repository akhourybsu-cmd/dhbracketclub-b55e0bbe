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
- [x] 32. Make the FORGE Compete banner feel like a proper game entry point with current week and collaboration status
- [x] 33. Streamline daily workout and freeform logging so members can start with fewer taps
- [x] 34. Clean up collaborative flame, roster, and club-goal presentation
- [x] 35. Verify FORGE screens and logging flows in browser
- [x] 36. Add polished, reduced-motion-safe FORGE animations for logging, progress, sheets, and quick starts

# Home screen widget hub
- [x] 37. Rebuild Home as a crisp, widget-first hub with subtle micro-animations
- [x] 38. Add installed-app widgets for active modules, including Portfolio Wars, NFL Pick'em, Draft Arena, and FORGE
- [x] 39. Keep widget visibility gated by club-installed assets and active/current data
- [x] 40. Verify Home on mobile and desktop without changing app game logic


41. Live draft hosting (early access, host-only): live-draft feature flag, shared pick clock on the draft row, host command center (pause/resume/+30s/reset/clock off/pass pick), projector kiosk at /drafts/:id/kiosk with big board, on-deck, ticker tape, pick announcements and sound, plus a real Admin > Feature Flags switchboard. Live drafts stay out of season standings. — done
42. Cinematic kiosk pick sequence: conceal fresh picks, stage lock/confirmation/slow reveal, animate into the board, queue rapid picks, and provide reduced-motion behavior. — done
43. Extend kiosk reveal beats to 2–2.5 seconds and partition desktop live drafts into a high-intensity command center with clock controls, board state, and selection log. — done
44. Polish each player's live Draft command center on desktop and mobile; add persistent Heritage Bronze, Broadcast Blue, Club Emerald, and Signal Red palettes with full light/dark support across Draft Arena. — done
45. Unify palette styling across the complete Draft Arena, including nested draft boards and the projector kiosk, with more distinct dual-accent identities and board states. — done

# Draft Arena first phase
- [ ] 46. Add the private Personal Draft Desk with saved ideas, notes, favorites, ordering, and on-deck selection
- [ ] 47. Add synchronized pre-draft ceremony with randomized order reveal and host controls
- [ ] 48. Add factual live broadcast moments to draft rooms and projector kiosk
- [ ] 49. Add a dedicated post-draft magazine and connect completed drafts to it
- [ ] 50. Apply secure schema changes and verify the full phase on mobile and desktop

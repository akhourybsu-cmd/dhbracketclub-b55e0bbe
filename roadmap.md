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
- [ ] 9. Extend Heritage Ledger shell and shared primitives across the complete Draft Arena
- [ ] 10. Polish hub, setup, results, seasons, stats, and commissioner surfaces
- [ ] 11. Verify representative Draft Arena screens on mobile and desktop

# Draft Arena Visual Redesign — Private Club Lounge

Visual-only redesign. No gameplay/logic changes. Foundation: charcoal/black + selective warm gold (#D4AF37), Space Grotesk (titles/data) + DM Sans (body), premium quiet surfaces.

## Tasks
- [ ] 1. Fonts: add Space Grotesk + DM Sans (fontsource), wire into draft-arena scope
- [ ] 2. Design tokens: scoped `.da-*` CSS — charcoal surfaces, gold accents, hairlines, no heavy glow
- [ ] 3. Draft room (DraftDetailPage, in-progress): compact persistent status header (Round X · Pick n/total, current picker, "Your Pick"/"X picks until you", "18h remaining" contextual)
- [ ] 4. Draft board: desktop full rounds×participants grid; mobile swipeable round-by-round board with snap; imagery-filled completed cells, gold-ringed current cell
- [ ] 5. "Since your last visit" pill + gold tick on new picks (localStorage per draft)
- [ ] 6. Pick submission moves to bottom sheet ("Make Selection" universal language), doesn't obscure board
- [ ] 7. Drafts list page: restyle to lounge language (quiet stats strip, gold only for your-turn)
- [ ] 8. Keep setup/results/report/judging-scope functionality intact; verify tsc + build + browser smoke

# Crazy Chain refresh and responsive polish

## Goal
Make the manual NFL check reliably refresh Crazy Chain scores, cards, standings, and board data, while improving the Crazy Chain experience on phones and desktops.

## Changes
- Make the manual check detect and report Crazy Chain scoring failures instead of treating them as successful NFL refreshes.
- Refresh all Crazy Chain and NFL screen data immediately after a successful manual check without requiring a full page reload.
- Add the same manual check to the Crazy Chain control room, with clear scoring and board-refresh feedback.
- Refine the Crazy Chain board, leaderboard, history, and controls for compact mobile reading and a denser two-column desktop layout.
- Preserve current rules, deadlines, saved picks, scoring, and the existing Stadium Night visual system.

## Verification
- Run focused Crazy Chain and NFL tests plus the TypeScript check.
- Exercise the manual refresh and inspect Crazy Chain on phone and desktop viewports.

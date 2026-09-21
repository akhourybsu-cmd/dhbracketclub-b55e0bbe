# Live Draft Command Center

## Experience
- Extend each standard kiosk reveal stage to roughly 2–2.5 seconds: locked suspense, confirmation, selection reveal, and board landing.
- Preserve the short crossfade path for people who prefer reduced motion.
- On desktop, turn each live draft room into a dedicated command-center layout with the active clock and host controls in a fixed left rail.
- Keep the full draft board as the dominant center workspace, with draft state and recent picks clearly separated below it.
- Preserve the current compact, stacked mobile layout and all existing draft behavior.

## Visual structure
- Add a desktop-only command masthead identifying the live room, connection state, board progress, and host role.
- Give clock controls, board state, and pick history distinct labeled zones using the existing Draft Arena bronze/charcoal design language.
- Use restrained status pulses and panel-entry motion, with full reduced-motion support and light/dark parity.

## Technical details
- Adjust the existing kiosk reveal phase timing without changing queueing or realtime behavior.
- Recompose existing `LiveHostPanel`, `DraftStatusHeader`, `DraftBoard`, and history content rather than duplicating controls or data.
- Add focused semantic classes for the live desktop grid and control zones while leaving regular drafts unchanged.
- Verify production build and browser behavior at desktop and phone sizes.

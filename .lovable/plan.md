# Smoother Drop scrolling

## Changes
- Replace browser-native fullscreen with the existing distraction-free in-app view, removing the browser warning while keeping the same expand/exit control.
- Relax the feed’s hard snap-stop behavior and add momentum-friendly scrolling so moving between Drops feels continuous while still settling one Drop at a time.
- Keep reduced-motion behavior, current likes/comments/share controls, and the existing mobile navigation behavior unchanged.

## Verification
- Check mobile and desktop scrolling, enter and exit distraction-free view, and confirm no warning, overflow, or broken controls.
- Confirm type checks and the production build remain clean.

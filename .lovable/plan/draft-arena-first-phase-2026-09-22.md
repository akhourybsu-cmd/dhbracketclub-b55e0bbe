# Draft Arena First Phase

## Goal
Turn every draft into a complete event while preserving the existing snake-draft rules, grading, seasons, live clock, kiosk, and palette system.

## What will be built

### 1. Personal Draft Desk
- Add a private, per-player desk inside each draft room for shortlist entries, ordering, favorites, notes, and an “on deck” choice.
- Keep desk content visible only to its owner through database access rules.
- Let players add, edit, remove, and reorder ideas before and during a draft.
- Surface the desk inside the selection sheet so an available saved idea can be chosen in one tap; mark ideas already taken without deleting private notes.
- Use optimistic updates with rollback and timeout/retry protection.

### 2. Pre-Draft Ceremony
- Replace the immediate start with a host-controlled ceremony that introduces the topic and participants, then reveals the randomized order one player at a time before the draft begins.
- Persist ceremony state so every connected device and the projector stay synchronized and late joiners see the correct stage.
- Give the host skip/finish controls, include sound only where already supported, and provide reduced-motion fallbacks.
- Keep standard asynchronous drafts lightweight: the ceremony is optional, while live drafts default to using it.

### 3. Broadcast Layer
- Expand the existing pick announcement into a derived live broadcast feed: pick locked, round changes, consecutive-category runs, late-round steals after grading, fastest pick, and draft completion.
- Present concise broadcast cards in the room and richer full-screen treatments on the kiosk without slowing pick submission.
- Derive factual moments from picks, timing, order, and saved results; do not add extra AI calls during drafting.
- Add host controls to enable announcements, ticker items, and ceremony behavior through the existing live settings.

### 4. Post-Draft Magazine
- Add a dedicated recap route for completed drafts with a cover, final board, podium, MVP pick, biggest steal, timing records, streaks, player summaries, and the full selection timeline.
- Reuse the verified grading report and enrichment imagery; show deterministic stats even if AI grading is unavailable.
- Add share actions for the recap and direct entry points from the completed draft room and Draft archive.
- Ensure the magazine inherits the player’s Draft Arena palette in both light and dark mode and prints cleanly.

## Data and security
- Add a private `draft_desk_items` table scoped to `auth.uid()` with explicit authenticated/service grants and owner-only RLS.
- Add persisted ceremony fields to drafts, with writes restricted to the draft creator or app admin and reads restricted to the current club.
- Avoid storing derived broadcast and magazine facts unless synchronization requires it; existing picks/results remain the source of truth.
- Add indexes, realtime publication where synchronization needs it, and cleanup through draft deletion cascades.

## Integration
- Keep all Draft Arena surfaces gated by the installed `draft-arena` asset.
- Split new behavior into focused hooks/components rather than expanding the existing draft page further.
- Extend the kiosk, live settings, selection sheet, completed room, archive links, and app routing without changing turn calculations or scoring.

## Verification
- Apply and verify the database migration and access rules, including proof that another member cannot read a player’s desk.
- Run focused draft tests, TypeScript checks, and the production build.
- Browser-test setup → ceremony → live picks from the desk → completion → magazine on phone and desktop.
- Verify ordinary and live drafts, all four Arena palettes, light/dark modes, reload persistence, realtime synchronization, keyboard access, overflow, and reduced motion.

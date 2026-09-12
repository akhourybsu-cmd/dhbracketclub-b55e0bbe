# Extend the NFL Game Center visual system

## Goal
Carry the selected Stadium Night command-center design through every NFL Game Center route without changing game rules, data, or existing actions.

## Scope
- Restyle the shared NFL shell and top navigation so every screen uses the same wide, responsive command-center frame.
- Add a compact in-game menu for Game Center, Pick’em, Crazy Chain, standings, history, and playbook, with commissioner links shown only to admins.
- Standardize page headers, tactical panels, stat strips, status badges, inputs, selectors, tabs, empty states, retry states, and action rows.
- Apply the system to Pick’em home, weekly slate, weekly results, standings, history, rules, and commissioner tools.
- Apply the system to Crazy Chain board, leaderboard, history, and commissioner control room.
- Preserve the Stadium Night palette, Sora/Manrope typography, restrained glass depth, team-logo emphasis, mobile touch targets, and reduced-motion behavior.
- Keep every existing route, score, pick, lock deadline, refresh action, sharing action, and admin workflow intact.

## Technical approach
- Create shared NFL presentation primitives for page headers, panels, stats, and the route menu under the existing Pick’em component area.
- Update the shared layout and HUD first so all routes inherit the correct width, typography, colors, and navigation.
- Replace legacy turf-heavy and generic `glass-card` compositions screen by screen with the shared NFL primitives and scoped semantic classes.
- Keep game-specific interactive components such as matchup pick cards and the sticky pick card, but retune their surrounding surfaces and controls.
- Consolidate scoped NFL styles in the global design-token layer; remove page-local style definitions where touched.

## Verification
- Run the TypeScript check and focused Pick’em/Crazy Chain tests.
- Browser-check the hub, weekly picks, standings, history, rules, Crazy Chain, and commissioner views at mobile and desktop sizes.
- Confirm menus fit safely, controls remain usable, data states remain readable, and no existing action or route regresses.

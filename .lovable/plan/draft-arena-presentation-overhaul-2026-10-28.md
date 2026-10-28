# Draft Arena presentation overhaul

Goal: keep every feature, rule, and piece of content, but change how it is presented — less text walls, clearer hierarchy, consistent spacing, purposeful color and motion. Works in all four palettes (Heritage Bronze, Broadcast Blue, Club Emerald, Signal Red), light and dark, phone first then desktop.

## Guiding principles

- One primary action per screen, visible without scrolling.
- Turn paragraphs into structure: stat chips, labeled rows, icons, progress bars, collapsible "details".
- Numbers big, labels small. Status shown by color + icon, never color alone.
- One spacing scale and one card style family across all Draft Arena screens.
- Motion only to explain change (pick landed, turn changed, tab switched); always reduced-motion safe.
- No sportsbook styling, no "Select Player" language, no reuse of the three previously declined prototype directions.

## Phase 1 — Foundation (shared visual kit)

Build a small set of reusable Draft Arena pieces so every screen gets the same look:
- Section header (eyebrow label, title, optional action).
- Stat tile and stat strip (big number, small label, optional trend).
- Status pill (Setup / In Progress / Complete / On the clock / Your turn) with icon.
- Player chip (avatar, name, palette-tinted seat color).
- Info row (icon, label, value) to replace sentence-style metadata.
- Collapsible "More details" block for long rules/descriptions.
- Empty state and skeleton variants matching the palette.
- Spacing/radius/elevation tokens scoped to Draft Arena, plus motion presets (enter, tab switch, pick land, number tick).

## Phase 2 — Drafts hub (list, season, commissioner)

- Draft cards: title + status pill + 3 stat chips (players, picks made, deadline) instead of text lines; your-turn cards highlighted with palette accent edge.
- Group sections (Your turn, In progress, Setup, Complete, One-off) with sticky compact headers and counts.
- Season tab: standings as a ranked list with podium accents and a points bar; schedule as a timeline.
- Commissioner tab: tools as an icon grid of grouped actions instead of stacked buttons and explanations.

## Phase 3 — Create draft flow

- Convert the long form into a stepped flow (Basics, Players and order, Rules and clock, Live options, Review) with a progress indicator.
- Each option as a choice card with a one-line hint; advanced settings collapsed.
- Final review screen summarizing choices as info rows.

## Phase 4 — Draft room (regular drafts)

- Compact sticky status bar: round/pick, who is on the clock, countdown ring.
- Board as the dominant element; refined cell states (filled, current, upcoming, yours, skipped) with clearer contrast per palette.
- "Since your last visit" as a dismissible summary strip of chips.
- Pick sheet: cleaner input, suggestion chips, desk ideas as a tidy list, confident submit button state.
- Secondary panels (AI context, broadcast feed, desk, settings) moved into tabs or collapsibles instead of a long scroll.

## Phase 5 — Live draft surfaces

- Host command center: tighten the three zones (Clock and Control, Board State, Selection Log) with consistent headers, grouped controls, and fewer labels.
- Personal kiosk: larger clock, clearer "You're up" state, calmer idle state, compact host tools.
- Projector kiosk: typography and spacing pass for readability at distance; ticker and order reveal polish.
- Pick-reveal overlay timings stay as they are; only visual polish.

## Phase 6 — Results, report, and magazine

- End report: scoreboard header with podium, then per-player score cards with factor bars instead of text blocks; AI reasoning collapsed under "Why".
- Missed picks as a ranked visual list.
- Magazine: editorial layout polish, pull-quote stats, consistent section rhythm, clean print/share.
- Disputes and judging scope shown as compact badges and sheets.

## Phase 7 — Stats, archive, and menu

- Player stats: headline stat strip, trend sparklines, achievements as badges.
- Archive: filterable grid with season and status chips.
- Draft Arena menu and header: spacing and icon alignment pass.

## Phase 8 — QA pass

- Check every screen at phone (411 wide) and desktop (1440 wide), all four palettes, light and dark, and reduced motion.
- Confirm no text clipping, 44px touch targets, no layout jumps on load.

## Delivery

Each phase ships on its own so you can review it in the preview before the next one starts. Phase 1 and 2 first, since every later screen builds on them.

## Technical notes

- New shared primitives under `src/components/draft/ui/`, styled only with existing Draft Arena palette tokens (extend tokens in `src/index.css`, no hardcoded colors).
- Large files (`DraftDetailPage.tsx` ~2.6k lines, `DraftsListPage.tsx` ~2k lines) get split into presentational sections while keeping hooks, data loading, and gameplay logic unchanged.
- No database, scoring, clock, or reveal-timing changes. Existing tests (broadcast, navigation, live draft) must keep passing.
- framer-motion presets in one file; all gated by reduced motion.

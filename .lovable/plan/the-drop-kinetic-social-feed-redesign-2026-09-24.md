# The Drop — Kinetic Social Feed Redesign

## Goal
Transform The Drop into a cleaner, faster social feed that feels energetic and collectible on phones while remaining organized on desktop. Preserve the existing one-per-day rule, club visibility, reactions, comments, sharing, tags, search, and archive.

## Build
- Replace the boxed bulletin header with a compact editorial masthead using the locked Editorial Ink palette, Instrument Serif headings, and Work Sans body text.
- Recompose the main view as an immersive focused feed: stronger media, short headlines, clear author context, visible freshness badges, and thumb-friendly reaction/comment/share controls.
- Add an opaque sticky navigation bar for Club, Calendar, and Search. Keep the selected section in the URL and restore it after leaving and returning to The Drop.
- Redesign Calendar and Search as first-class feed views with stable loading, empty, error, and selected states rather than separate-looking utility panels.
- Rebuild compose and share menus as fully opaque, portaled surfaces with clear hierarchy, safe-area spacing, reliable scrolling, and no background bleed-through.
- Improve responsive behavior: edge-aware mobile presentation, a focused desktop feed column, stable card dimensions, readable media crops, and no overlapping controls.
- Add restrained motion inspired by the selected Kinetic Collection Feed: freshness indicators, card entry/settle, reaction pops, and section transitions, all disabled for reduced-motion users.

## Technical details
- Reuse the existing data hooks and mutations; this is a presentation and navigation-state update only.
- Persist the last active Drop section per user/device while continuing to support direct `?tab=` links.
- Scope new semantic tokens and font rules to `.drop-page` / `.drop-surface`; retain complete light and dark mode support.
- Keep sheets on the existing portal-based primitive and give Drop sheets explicit opaque surfaces.
- Verify mobile and desktop in light and dark modes, section persistence, compose/share menus, loading/error states, and existing interaction behavior.

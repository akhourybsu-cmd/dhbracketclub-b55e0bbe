# Home screen widget hub

## Goal
Make Home feel like a clean, crisp command center where every installed club app can show a useful widget, while active/current items rise to the top.

## What will change
- Add a reusable Home widget section that works on phone and desktop.
- Keep the existing greeting, priority actions, shortcuts, and activity feed, but make widgets the main middle layer.
- Add polished micro-animations for widget entrance, live dots, progress bars, and tap/hover feedback.
- Gate every widget by installed asset visibility, so disabled apps disappear automatically.

## Widgets to include first
- Portfolio Wars: live portfolio value, return, day change, cash, and market status.
- NFL Game Center: current week, picks made/remaining, live/locked state, and season rank when available.
- Draft Arena: active season progress, active draft count, “your turn” signal, and route to drafts.
- FORGE: weekly fuel, personal/freeform fuel, current gauntlet count, and quick entry to logging.
- General app widgets: installed apps with no specialized widget still appear as compact launch cards with status when available.

## Technical notes
- Use existing Home data where possible and add small scoped hooks/components for module widgets.
- Reuse current backend tables and hooks; no game rules or database schema changes.
- Use design tokens and semantic classes only; no hardcoded component colors.
- Respect reduced-motion settings.
- Validate with focused build/type checks and a browser smoke test on mobile and desktop.

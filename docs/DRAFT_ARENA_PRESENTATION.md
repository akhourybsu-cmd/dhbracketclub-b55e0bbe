# Draft Arena presentation

The arena uses a fixed visible-viewport shell, an accessible side drawer, focused workspaces and a shared material system. Existing Heritage Bronze, Broadcast Blue, Club Emerald and Signal Red palettes work in light and dark mode. The shell exposes the visible viewport height to portaled dialogs so the pick composer can adapt when a mobile keyboard reduces the available space.

## Organization

- **Lobby:** a compact season/turn hero, real career statistics, search and status filters, season-group selectors, and collectible-style room cards. A room appears once in the list; the hero links directly to the next relevant draft. Season overview, standings, playoffs, history and commissioner management remain available in their own views.
- **Draft room:** a persistent context header and horizontal workspace navigation replace long stacks. Board, pick log, personal desk, live host controls and briefing have distinct views. Completed drafts expose saved results and teams. Existing topic, judging-scope, enrichment, season, edit, delete, dispute and retry actions retain their original permission conditions.
- **Personal live kiosk:** the clock and current-turn action remain visible beside Board, My team, Draft desk, Live feed and eligible Host views. Existing fullscreen, wake-lock, live settings and pick-reveal behavior remain connected.
- **Creation:** the existing Basics, Judging, Format and Review wizard keeps its rules, with a bounded form stage and reachable navigation.
- **Pick composer:** a focused Radix dialog preserves the original input, duplicate warnings, advisory suggestions, shortlist and submission callbacks. It traps focus, closes with Escape and layers above the personal kiosk.

## Images and motion

The existing enrichment providers and all judging metadata remain unchanged. Detailed surfaces request bounded higher-resolution versions only from known image CDNs. Cards retry the selected artwork through its available full/thumbnail variants before showing a neutral identity fallback. The image picker offers a preview, source labels, six options per page and visible failure states. Candidate parsing and asynchronous session guards prevent an old request or image save from replacing another draft's presentation. Image selection still updates only `image_url`, `thumbnail_url` and `source_provider` for the same enrichment ID.

The entrance is finite and skippable. Section changes and pick announcements use short feedback; historical boards/results do not celebrate as new events on mount. Pick highlights expire and count animations stop when backgrounded or reduced motion is selected. Drawing never advances a turn, submits a pick, generates a score or changes a timer.

## Gameplay preservation

This pass changes presentation and local view state. Forty critical handler/turn declarations match commit `48b28035795ca3dcf0deac30c13c18c788b515bc` after TypeScript formatting is normalized. Twelve protected rules, judging, season and live-state files remain byte-identical. The projector has one narrowly audited presentation exception: its initials helper delegates to the shared Unicode-aware formatter. After that helper and its exact import are normalized, the rest of the projector AST must match, including JSX, queries and persisted settings/results behavior. A separate JSX review of the original redesign confirmed all 71 existing core action bindings retained their expressions and permission branches. Live Draft settings continue to come from `drafts.live_settings`; completed projector reports continue to display persisted `draft_results`.

`scripts/audit-draft-arena-preservation.mjs` compares the protected source with the baseline Git commit. It also accepts a previously exported baseline through `--baseline-file` in read-only execution environments. No schema migration, live account write or backend-provider change is part of this pass.

## Verification

The unit suite, app TypeScript and production build cover the presentation changes alongside existing draft judging, grading, snake-order and broadcast tests. New regressions cover artwork fallback and stale requests, pick-announcement lifecycle, palette ownership, finite arrival markers, reduced motion and backgrounded counters.

The original presentation pass completed 1,029 unit tests and 128 browser checks. The subsequent asset and alignment pass completes 1,039 unit tests and 321 browser checks without unhandled browser errors. The expanded matrix includes 320×568, 360×740, 390×844, 430×932, 768×1024, 844×390, 1440×900 and 1920×1080, light/dark themes and reduced motion. All four creation steps retain their inputs and default five rounds, with fully visible focused fields and a separate very-short-viewport fallback. Newly added files and changed shared components pass scoped ESLint; pre-existing `no-explicit-any` findings in older draft pages remain outside this presentation pass.

`node scripts/check-draft-arena.mjs` mounts production pages with the production font stack against browser-local identity and transport fixtures. It exercises actual pick submission and canonical snake order, duplicate blocking, persisted results, artwork selection, the side drawer, creation, live-kiosk navigation and composer focus. Stress journeys add 20-player/10-round drafts, 120 saved picks, portrait/wide/broken/slow artwork, paginated image choices, palette changes, 200% root text sizing, phone rotation, archived season recaps, magazine navigation and career charts. It starts and cleans up its own preview on port 8098 and makes no live player writes. See [the asset pass](DRAFT_ARENA_ASSETS.md) for delivery and fallback details.

# Deep Claim crew presentation

## Authority and coordinates

`crewPresentation.ts` derives the scene from the authenticated company snapshot. An active worker must appear in the expedition's roster and have that same `assigned_job_id`. The current server-declared stage and its stored timestamps bound movement. Reaching a timestamp stops its animation and exposes an awaiting-sync state; the client cannot advance a stage, reveal terrain or create cargo.

The original versioned world/simulation and both compiled atlases remain unchanged. Crew staging is a separate presentation layer, shared by drawing, camera following and game-moment focus.

Positions name logical grid-cell origins, with fractional coordinates along orthogonal route edges. The shared `crewFootPoint` places underground feet at `(x + .5, y + .94)` and surface feet on `y = 0`, with a continuous blend through the first shaft cell. Body scale blends from the surface size to .7 underground so entering or leaving the shaft does not pop to a new position or size. Equipment and individual appearance remain derived from actual assignments and stable worker identity.

## Placement and work

- Public routes stop at the first undisclosed or unexcavated cell. Workers approach rock from open ground instead of standing in its contents.
- Travel uses single-file route spacing, including surface queue positions when the crew is entering/leaving. Horizontal facing follows the local route tangent. No arbitrary side-to-side offsets enter shaft walls.
- Stationary crews reserve distinct, nearby open positions, preferring underground floor over surface staging. Several crews use a common occupancy plan. Very constrained space uses small in-cell offsets.
- The strongest relevant crew statistic determines the visual lead. Mining, geology, cargo and engineering/safety assistance have different existing poses. These illustrations describe work within the same existing aggregate crew simulation; they do not introduce new individual production or bonuses.
- A depleted extraction site uses cargo/support poses while the official work stage finishes. Exploration can continue according to its private server plan, so the client does not infer that it has stopped merely from the first target becoming empty.
- Worker-ID animation phases break synchronized steps/swings without changing timing, output or progress. Stationary hauling, stale stages and reduced motion do not march in place.

Crew numbers are cosmetic ordinals over retained snapshot history, ordered by start time and ID. They stay consistent between the map and operation cards, across roster reorder/reload, and when a companion crew finishes. They are not permanent crew records or separately saved team assignments.

## Navigation and legibility

Map markers show objective, crew number and worker count. Their 54×44 hit areas are placed in separate lanes around actual painted worker bodies and control rectangles, and connect to the actual crew location. Both label artwork and its larger touch area stay clear of helmets and bodies. At distant zoom the marker replaces unreadable tiny bodies. The existing crew button and `C` key provide a keyboard alternative to tapping a marker; operation cards retain their Follow crew action.

Following fits and continuously tracks the displayed crew, including safe approaches to undisclosed worksites. A compact HUD names the crew, action, stage and depth. In the game it docks in the existing map heading, replacing its title while following; it cannot cover the camera toolbar or mine. The heading portal target remains mounted across tab changes. On short landscape screens, active operation cards sit beside the mine using their existing horizontal carousel, and camera controls stay in the header. This preserves a readable map rather than squeezing it below a fixed-height action shelf; hidden scenes retain their hidden state. Standalone Canvas consumers retain a compact bottom overlay. The selected operation card carries the same current-state highlight. Marker taps, keyboard crew cycling and Follow crew reveal that card by scrolling only its horizontal carousel, with smooth scrolling disabled for reduced motion. Manual pan, zoom, Home or Stop following releases the camera and clears the card highlight. Company changes and completed jobs clear tracking. Reduced motion paints only on invalidation rather than introducing an animation loop.

The hook requests one authoritative refresh at each current stage boundary. Attempts are scoped and bounded; simultaneous deadlines share a read, in-flight requests are joined, and a stale/error response cannot cause a tight retry loop. Existing normal polling remains recovery. Hidden/offline/uninstalled scopes and unmounts cancel timers.

## Performance and verification

Immutable world, roster and route arrays key weak caches. Route expansion and nearby workspot planning occur when disclosed state changes, not on every frame. Frame work is bounded by actual staff and at most seven crew labels. Overlay rectangles are measured during layout/resize, outside the drawing loop.

Aggregate diagnostics remain anonymous. An optional `onWorkerFrame` callback observes already-authorized scene data and actual painted body envelopes for local QA only; production does not publish worker IDs or positions through telemetry. The native harness retains a bounded frame history and uses paid, real SQL expeditions.

Unit and integration coverage includes narrow shafts, solid/fogged targets, facing in both directions, simultaneous crews, persistent appearances and gear, exhausted ore, camera continuity, marker taps, manual cancellation, company changes, reduced motion, stage refreshes and immutable state. Release results and public deployment evidence are recorded in the implementation ledger.

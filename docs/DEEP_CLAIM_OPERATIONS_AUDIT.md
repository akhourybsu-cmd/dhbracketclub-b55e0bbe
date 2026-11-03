# Deep Claim operation clarity

## Decisions

Keep four distinct server operations. Present two mining choices and two optional planning/improvement choices. Saved mode IDs and versioned expedition snapshots retain their original meaning.

| Player action | Existing ID | What the player gets | When to use it |
| --- | --- | --- | --- |
| Expand tunnels | `explore` | Excavated frontier and revealed geology; possible incidental cargo | Reach new deposits and extend routes |
| Mine a deposit | `extract` | Cargo from a known, accessible, finite seam; a depleted cell becomes a passage | Earn money or supply processing |
| Scout the area | `survey` | Nearby unknown ground revealed in a field report; no excavation, ore or specimens | Learn where to expand before committing to digging |
| Improve the mine | `infrastructure` | Permanent local installation, active after the crew returns | Improve the routes and conditions of later shifts |

All four consume crew time, energy, wages and applicable equipment wear. Construction also consumes the quoted fee and materials. Scouting and construction have no cargo collection step; their completed field reports describe the outcome.

## Why the previous choices were confusing

Exploration and surveying both promised to reveal ground without explaining that only one digs passages. Four equal abstract labels hid the difference between earning resources and investing in later work. Every support site looked like the same connected passage. Duration choices described both support jobs in construction grades. A shallow pump could be bought despite water having no effect there.

The shared illustrated selector now names player intentions. Scouting explicitly says “Map only · No cargo”; improvements are separate optional preparation. Sites use action-specific headings, and scouting shows the current unknown-cell count for the selected crew and duration. Construction keeps real grades; scouting uses Local/Wide/Thorough coverage choices with the same existing durations and energy costs.

## Actual infrastructure benefits

| Project | Effect | Important limit |
| --- | --- | --- |
| Timber Supports | Reduce incident delay probability | No incident risk below 8m; risk cannot fall below zero |
| Ventilation | Reduce gas delays; mitigate deep mining heat | Gas starts at 50m; deep heat at 600m |
| Drainage Pump | Reduce water delays | Water starts at 100m; does not unlock flooded routes |
| Haul Rail | Reduce covered travel/return time, leaving more work inside the same shift | Does not generally shorten the whole expedition or guarantee extra cargo |

Same-type protection does not stack. Only installed projects count. Later installations do not alter an active expedition's frozen conditions. Protection currently prevents setup delays, not injuries, lost cargo or tunnel destruction.

Advisories use only disclosed terrain, installed projects and server quotes. They warn about shallow locations, redundant coverage, zero current risk and minimum travel time. Preparation remains allowed: an apparently low-value site can serve future nearby work. The server still determines allowed dispatch, costs, routes, conditions, simulation and rewards.

## Verification and scope

New pure advisory tests cover unknown-only survey footprints, crew/duration changes, depth boundaries, overlapping protection, deep ventilation, rail limits and input immutability. UI tests exercise canonical dispatch IDs, optional grouping, selected/disabled controls and authoritative review. Browser checks exercise the actual app and local SQL at phone and desktop widths. Release receipts and final check results belong in the implementation ledger.

No migration or economic rebalance is required for this presentation pass. Frozen rules, assets and historical expeditions remain intact. A later balance phase can measure scouting's opportunity cost and infrastructure payback before changing prices, durations or coverage.

# Draft Arena Heritage Ledger Polish

## Goal
Extend the selected premium club-ledger visual system across every Draft Arena screen while preserving all existing gameplay, data, permissions, AI judging, reports, season workflows, and commissioner actions.

## Visual foundation
- Use the locked Heritage Ledger palette: near-black `#11100E`, warm charcoal `#25221C`, bronze `#B98B3D`, and champagne `#E8DDC8`.
- Keep Space Grotesk for titles/data and DM Sans for body text.
- Use bronze selectively for current turns, winners, active states, and primary actions.
- Replace green arena washes, heavy glow, and nested-card density with quiet ledger surfaces, fine rules, compact section labels, and restrained depth.
- Keep mobile as the primary layout; desktop gains width and columns only where comparison benefits.

## Implementation
1. **Shared shell and primitives**
   - Retheme the Draft Arena shell, header, cards, controls, statuses, forms, dialogs, and loading states.
   - Add reusable structured-section, section-heading, metric-strip, action, and row treatments.
   - Preserve accessibility, safe areas, touch targets, and reduced-motion behavior.

2. **Draft hub and discovery**
   - Reorder the hub around immediate responsibilities: Your Turn, Waiting on Others, upcoming/setup drafts, recently completed drafts, then season groups.
   - Make each draft row show topic, round/pick progress, current participant, the viewer’s turn relationship, and available recent-change context.
   - Retain search, filters, tabs, creation, archives, and all existing links.

3. **Active and setup draft rooms**
   - Bring setup, participant management, active draft header, board, pick sheet, history, and playoff rooms into one visual system.
   - Keep the compact status → board/current round → pick action → recent context hierarchy.

4. **Completed drafts and AI reports**
   - Establish winner/result → final board → AI judging → pick-by-pick detail → historical context.
   - Standardize podiums, report states, expandable participant results, disputes, regeneration, and original pick lists.

5. **Seasons, stats, and commissioner screens**
   - Recompose seasons as status → standings → current/upcoming draft → recent results.
   - Recompose stats as performance summary → records/achievements → trends → detailed breakdowns.
   - Polish create and commissioner controls without changing their workflows.

6. **Verification**
   - Run TypeScript and focused Draft tests.
   - Browser-check representative hub, active, completed, season, stats, create, and commissioner states on mobile and desktop.

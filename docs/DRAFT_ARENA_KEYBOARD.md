# Draft Arena keyboard visibility

The Arena now follows the complete visible viewport: top, left, width and height. Safari can pan that rectangle while its keyboard is open; tracking height alone centered typing dialogs above the usable screen. Resize and pan events are coalesced into one animation frame, transient invalid measurements retain the last valid bounds, and leaving Arena restores the previous CSS variables and listeners.

The pick composer has one scrolling body for the field, advice and shortlist. React autofocus is disabled inside this portal; Radix focuses the field once with `preventScroll`. Viewport changes never refocus or replace the field. On focus or resize, only the field's actual Arena scroll owner may move enough to keep it visible. Panning updates the bounds without fighting deliberate scrolling. No window scroll commands are issued.

Mobile and touch-device editable fields use at least 16px text to prevent Safari's focus zoom. Browser zoom remains available. Dialog positioning accounts for visible safe-area insets without subtracting the home-indicator space again after the keyboard has already covered it. Dispute, rejection and planner confirmation forms have bounded details and reachable actions; their content and typed reasons survive ordinary refresh/retry. The previous full-page mobile draft scrolling remains intact.

No authentication, club permissions, draft rules, pick validation, clocks, rating calculations, mutation handlers or saved results change. No migration or dependency is required. Preservation against `a2ef24f7335af25c8dcf75af12982bdc8b3a5880` passes 40 protected gameplay declarations and 13 protected files. Existing DraftDetailPage lint findings remain unchanged; new modules and the changed typed components pass scoped lint.

Local checks pass 150 Draft/planner tests, seven final viewport/focus/input cases, application-project TypeScript and the production build. The forms agent also verified 22 planner/workspace/review cases. The new browser matrix simulates keyboard viewport geometry with nonzero offsets on production screens and PageTransition, across Chromium and mobile WebKit. It checks typing, caret/value retention, advice, failed/pending submission, nested live-player composing and other draft forms. This is a controlled viewport model, not a physical iPhone or OS keyboard.

Exact-source browser/CI execution, screenshot review and public publication are pending.

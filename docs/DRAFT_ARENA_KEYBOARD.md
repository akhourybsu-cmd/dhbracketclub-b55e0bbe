# Draft Arena keyboard visibility

The Arena now follows the complete visible viewport: top, left, width and height. Safari can pan that rectangle while its keyboard is open; tracking height alone centered typing dialogs above the usable screen. Resize and pan events are coalesced into one animation frame, transient invalid measurements retain the last valid bounds, and leaving Arena restores the previous CSS variables and listeners. Focus adjustment runs after the new viewport layout settles and is cancelled on unmount.

The pick composer has one scrolling body for the field, advice and shortlist. React autofocus is disabled inside this portal; Radix focuses the field once with `preventScroll`. Viewport changes never refocus or replace the field. On focus or resize, only the field's actual Arena scroll owner may move enough to keep it visible. Panning updates the bounds without fighting deliberate scrolling. No window scroll commands are issued.

Mobile and touch-device editable fields use at least 16px text to prevent Safari's focus zoom. Browser zoom remains available. Dialog positioning accounts for visible safe-area insets without subtracting the home-indicator space again after the keyboard has already covered it. Dispute, rejection and planner confirmation forms have bounded details and reachable actions; their content and typed reasons survive query refreshes and failed requests. The previous full-page mobile draft scrolling remains intact.

No authentication, club permissions, draft rules, pick validation, clocks, rating calculations, mutation handlers or saved results change. No migration or dependency is required. Preservation against `a2ef24f7335af25c8dcf75af12982bdc8b3a5880` passes 40 protected gameplay declarations and 13 protected files. Existing DraftDetailPage lint findings remain unchanged; new modules and the changed typed components pass scoped lint.

Local checks pass 150 Draft/planner tests, eight final viewport/focus/input cases, application-project TypeScript and the production build. The forms agent also verified 22 planner/workspace/review cases. The new browser matrix simulates keyboard viewport geometry with nonzero offsets on production screens and PageTransition, across Chromium and mobile WebKit. It checks typing, caret/value retention, advice, failed/pending submission, nested live-player composing and other draft forms. This is a controlled viewport model, not a physical iPhone or OS keyboard.

## Verified source

Source: `7bec6b5fcd97bcac68120af6094bd4db03ef356f`. CI [41963016475](https://github.com/akhourybsu-cmd/dhbracketclub-b55e0bbe/actions/runs/41963016475) passes application-project TypeScript, member lint, 248 test files / 2,628 unit tests and the production build. The existing page lint findings remain unchanged (67 errors, one warning); this is not a claim that repository-wide lint is clean.

Browser run [41963016442](https://github.com/akhourybsu-cmd/dhbracketclub-b55e0bbe/actions/runs/41963016442) passes all five jobs with no assertion or runtime errors:

| Suite | Chromium | WebKit |
| --- | --- | --- |
| Full desktop, live, projector and mobile journeys | 622 checks | — |
| Mobile scrolling and pick readability | 105 checks | 105 checks |
| Keyboard resize, pan, typing and retry | 78 checks | 78 checks |

The keyboard matrix covers 320×568 dark, 390×844 light with normal motion, and 844×390 landscape with reduced motion. Visible heights are 260, 330 and 210px with nonzero top/left offsets. It verifies the actual pick mutation/retry, caret preservation, expanded shortlist, nested player composing, draft creation, private notes, pick editing, room codes and planner fields. It opens the real collapsed Desk before typing. Strict geometry, hit testing and 44px control checks remain enabled.

Reviewed screenshots from both engines confirm visible input, submit and close controls; creation and planner fields fit their reading areas. Keyboard artifacts: WebKit `13386800554`, Chromium `13386182140`. These are browser viewport simulations, not a physical iPhone keyboard test. Physical-device confirmation remains useful.

## Publication

Lovable was ready and synchronized to the exact checked source before deployment `75c475dd-c991-4f80-ad88-470b6946ba80` was requested. Independent public-content proof [41963743140](https://github.com/akhourybsu-cmd/dhbracketclub-b55e0bbe/actions/runs/41963743140) then passed at **2026-11-05T03:47:27.183Z**. Receipt artifact: `13386407507` (`draft-mobile-publication-41963743140-1`). The verifier's eight offline tests also pass.

The canonical [public site](https://dryhorse.app/) served its actual HTML, module entry, Arena CSS and three Arena JavaScript bundles with HTTP 200 over normal TLS. The stylesheet is `DraftArenaLayout-DMLZqmFl.css`, SHA-256 `f209327cfcc46facc3d06f8d85e405acf6b4b9013658d1b05e27812330d50681`, matching the tested build exactly. All viewport, form, pick-composer and previous mobile-scrolling release markers passed. The verifier follows the served entry graph and reads public files only.

The receipt associates the checked source SHA through release metadata; the hosting server does not expose a Git revision. This proves the expected deployed content, rather than claiming a server-reported Git SHA or a physical-device gameplay session. Subsequent documentation-only commits leave the tested application source unchanged.

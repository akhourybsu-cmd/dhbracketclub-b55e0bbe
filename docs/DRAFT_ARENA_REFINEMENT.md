# Draft Arena refinement and interaction fixes

This pass retains the existing rules, judging, snake order, permissions and saved reports. It extends the asset pass into loading/recovery states, navigation and asynchronous UI behavior.

| Area | Result |
| --- | --- |
| Room transitions | A room presentation is scoped to its draft and account. Navigating away discards its composer, local view state and pending read results instead of displaying them under another draft's route. |
| Private desk | Account/draft changes reset the local session. Late requests cannot populate another session or show obsolete save feedback. Repeated Enter/click submits one idea while the fields are disabled; failure preserves the text for retry. Existing hook queries and writes are unchanged. |
| Artwork picker | Paging uses the displayed page after refreshed candidates shrink the range, so Previous and Next move immediately. The same image metadata fields and providers are retained. |
| Host settings | Radix dialog supplies a focus trap, Escape and focus restoration. A bounded scrolling body keeps Save reachable. All seven toggles, duration options, timeout behaviors and the complete settings payload are retained. Errors remain visible for retry and a pending save is not duplicated. |
| Navigation | Palette choices support arrow keys, Home/End and roving focus. The palette popover is named and bounded by available space. Route changes dismiss stale navigation/exit overlays. Nested link/button targets in the lobby are replaced by single links. |
| Visual details | Branded arrival and unavailable-room states, concise small-phone turn labels, bounded season labels, 44px exit/creation targets and reduced-motion behavior on dialog roots. The projector header wraps on phones while retaining its 44px controls. |

The standalone projector fixture imports production fonts and `index.css` without the lazy Arena stylesheet or `DraftArenaLayout`, matching production ownership. It exercises live state and persisted final reports at phone, landscape and desktop sizes. The projector's intentional document scrolling is allowed; horizontal overflow and hit-target checks remain strict. Arena routes retain the no-document-scroll requirement.

Additional browser journeys hold a real asynchronous room response while navigating away, discard typed composer text without submitting, exercise empty/search/missing states, verify the 320px turn label and cancel actual live-host settings without changing persisted settings. These journeys run alongside the full existing asset, palette, creation, large-board, rotation and gameplay matrix.

The browser transport and identity are isolated fixtures. No live player writes or schema changes are part of this pass. The original emblem master and optimized delivery asset are retained unchanged.

## Verification

- 1,055 unit tests across 131 files, app TypeScript and the production build pass.
- 348 browser checks pass at eight distinct sizes, with no runtime errors. The existing 321 checks remain alongside 27 new projector, recovery and settings checks.
- The asset audit finds zero missing references. Preservation checks retain all 40 protected declarations, all 71 existing action bindings and the protected core files; the projector source has no additional changes beyond the previously audited initials helper.
- New and shared files pass scoped ESLint. Older draft pages retain their existing explicit-any findings and one dependency-array warning; no broad rules or hook rewrite is included.

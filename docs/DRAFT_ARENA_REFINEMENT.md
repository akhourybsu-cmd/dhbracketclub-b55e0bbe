# Draft Arena refinement and interaction fixes

This pass retains the existing rules, judging, snake order, permissions and saved reports. It extends the asset pass into loading/recovery states, navigation and asynchronous UI behavior.

| Area | Result |
| --- | --- |
| Room transitions | A room presentation is scoped to its draft and account. Navigating away discards its composer, local view state and pending read results instead of displaying them under another draft's route. |
| Private desk | Account/draft changes reset the local session. Late requests cannot populate another session or show obsolete save feedback. Repeated Enter/click submits one idea while the fields are disabled; failure preserves the text for retry. Enter during IME composition cannot save an unfinished idea. Existing hook queries and writes are unchanged. |
| Artwork picker | Paging uses the displayed page after refreshed candidates shrink the range, so Previous and Next move immediately. The same image metadata fields and providers are retained. |
| Host settings | Radix dialog supplies a focus trap, Escape and focus restoration. A bounded scrolling body keeps Save reachable. All seven toggles, duration options, timeout behaviors and the complete settings payload are retained. Unsaved edits and retry errors survive realtime hydration; reopening reads current saved values. Actual external changes have a visible notice. |
| Turn safety | Every composer entrance captures the current pick count and consumed slot, including choosing an existing desk idea. A pick, host pass, auto-skip or phase change closes the expired composer. Shared and playoff inputs ignore IME confirmation Enter. Core submission, duplicate and judging rules are unchanged. |
| Host commands | Pass confirmation belongs to one draft/slot and offers Cancel. A turn change invalidates it immediately. Pending commands are serialized before parent busy state renders, and failures offer scoped retry without unhandled rejections. Retrying a failed pass requires fresh confirmation. |
| LIVE room list | Background refresh retains the last successful rooms, selected filter and scroll. Failure adds compact retry feedback; initial failures still use the existing full recovery state. Code entry keeps focus while a lookup is pending and restores it after a lookup error. |
| Order ceremony | A central current-player card and actual revealed/total progress accompany a bounded keyboard-accessible lineup. Host controls remain visible with 20 players in portrait and landscape. The projector uses the same scoped ceremony stylesheet and stays read-only. |
| Navigation | Palette choices support arrow keys, Home/End and roving focus. The palette popover is named and bounded by available space. Route changes dismiss stale navigation/exit overlays. Nested link/button targets in the lobby are replaced by single links. |
| Visual details | Branded arrival and unavailable-room states, concise small-phone turn labels, bounded season labels, 44px exit/creation targets and reduced-motion behavior on dialog roots. The projector header wraps on phones while retaining its 44px controls. |

The standalone projector fixture imports production fonts, `index.css` and the ceremony's shared stylesheet without the lazy Arena stylesheet or `DraftArenaLayout`, matching production ownership. It exercises live state and persisted final reports at phone, landscape and desktop sizes. The projector's intentional document scrolling is allowed; horizontal overflow and hit-target checks remain strict. Arena routes retain the no-document-scroll requirement.

Additional browser journeys hold a real asynchronous room response while navigating away, discard typed composer text without submitting, exercise empty/search/missing states, verify the 320px turn label and cancel actual live-host settings without changing persisted settings. These journeys run alongside the full existing asset, palette, creation, large-board, rotation and gameplay matrix.

The browser transport and identity are isolated fixtures. No live player writes or schema changes are part of this pass. The original emblem master and optimized delivery asset are retained unchanged.

## Verification

- 1,146 unit tests across 139 files, app TypeScript and the production build pass.
- 475 browser checks pass at eight distinct sizes, with no runtime errors. The prior 398-check LIVE matrix remains alongside turn safety, IME, retained-room recovery, report navigation, five-character code readability and 20-player ceremony coverage.
- The asset audit finds zero missing references. All 40 protected core declarations and protected core files retain their preservation guarantees; the projector source has no additional changes beyond the previously audited initials helper. Composer-entry UI bindings now delegate to a slot-aware helper, and host command bindings add confirmation and pending guards while retaining their canonical callbacks and payloads.
- New and shared files pass scoped ESLint. Older draft pages retain their existing explicit-any findings and one dependency-array warning; no broad rules or hook rewrite is included.

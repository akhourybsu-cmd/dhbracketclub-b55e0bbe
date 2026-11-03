# Deep Claim UI, interaction and recovery audit

Audit date: 2026-11-03. Original audit baseline: `3dfd021b779c0b583a2b652e1ff5aeb4322d5406`. Integrated release parent: `5b375b28f85f9e60d1db54700d9fd59eca90ea85`.

This release refines the existing game rather than adding a new progression phase. The matrix records source inspection, implemented corrections and targeted regression evidence. It does not mean every device, game state or production account has been exercised. The final integrated checks, browser evidence, commit and deployment status belong in `DEEP_CLAIM_IMPLEMENTATION.md`.

## Scope and authority

- Existing authentication, club membership, installation requirements, immersive shell and game navigation are retained.
- No SQL migration, RPC contract, RLS policy, resource catalog, economic formula, world-generation rule, terrain record or authored art atlas changes are included.
- Cash, energy, purchases, resource transfers, results and completion still require the established server operations. Local guards and saved request metadata provide interaction/recovery safeguards, not additional economic authority.
- Existing illustrations and themed selectors remain in use. This pass adds no native dropdown, game engine, animation library or other dependency.
- The pending-action journal is distinct from the Training Journal. It retains unfinished mutation identities for explicit retry, not an alternate company save or automatic offline purchase queue.

## Audit matrix

| Area inspected | Implemented correction or retained behavior | Regression evidence |
| --- | --- | --- |
| Title, founding and protected saves | Continue remains disabled during protected pending actions. Founding submissions are single-flight; failure retains the deed. Member/club changes isolate the correct draft and invalidate old asynchronous responses. | `deepClaimEntryRefinement.test.tsx`; existing menu suites |
| Founding keyboard navigation | Introduction, name entry, deed review and editing focus their relevant heading/control. | Entry refinement suite |
| Tutorial dialogue and history | Escape closes history before the conversation; focus returns to its opener. Changing conversations closes stale history. Invalid line indices cannot produce invalid progress. Dialogue content and economic tutorial proofs are preserved. | Entry refinement; existing tutorial suites |
| Audio and settings | Sound unlock requires a gesture, prevents repeat requests, permits a real retry and ignores late responses from replaced/unmounted controllers. Visual preferences remain independent. An unavailable Updates view returns to an available settings tab. | Entry refinement; existing settings/audio suites |
| Dispatch and selected crews | Current worker assignments and selected duration energy determine eligibility. Invalid selections remain visible for correction, and missing employees can be removed. Preview/dispatch cannot run twice before a parent busy render; late completion cannot close a newer screen. | `deepClaimFieldAudit.test.tsx`; Phase 3 and next-shift suites |
| Mine lift and worksite selection | Refresh preserves manual browsing; an explicit new map selection is followed. Short lists cannot remain invisibly filtered by a hidden old search. Existing depth/branch selectors continue to use disclosed sites. | Field audit suite |
| Finds and collection decisions | The selected decision and navigation remain steady while a request resolves. Failures retain a retryable decision; an earlier response cannot clear a different selected find or call stale confirmation after unmount. Find locations use readable depth/branch labels. | Field audit; Phase 3 suites |
| Warehouse inventory and sale routing | Inspected catalog paging, stock-only filtering, page clamping, material inspection, actual quantities, read-only/busy sale guards and staged-haul links. Existing inventory behavior required no separate source change. Sales still open the existing confirmation flow. | `deepClaimInventory.test.tsx` |
| Production review | Invalid batch counts display unknown quantities instead of negative/fractional/invalid material amounts. A disappearing recipe closes its review with an actionable recovery message. A changed company revision still requires review again. | `deepClaimIndustryAudit.test.tsx`; Phase 2 UI suite |
| Work orders and storage | A full warehouse blocks material-only no-op collection and offers Make room in Stores. Partial capacity explains that the remainder stays staged. Equipment-only jobs remain collectable when material storage is full and no longer claim zero material output. Queued/elapsed work still requires authoritative readiness. | Industry audit; industry visuals; Phase 2 UI suites |
| Employees, hiring and training | Confirmation reevaluates current fee, housing, daily eligibility, assignments and applicant identity. Changed source state requires a new review. Paid requests and exits are guarded while saving. | `deepClaimWorkforceAudit.test.tsx`; existing workforce/Phase 2 suites |
| Owned gear and roster navigation | Stale/disappeared or newly assigned items cannot be used from old reviews. Replacement shows the actual equipped item. Six-worker and six-item pages bound the lists and clamp after stock changes; direct worker requests open the relevant roster page. Confirmation/crew footers remain accessible. | Workforce audit suite |
| Research and company office | Already funded research shows progress and effects without a second purchase prompt or misleading material shortfall. New projects still enforce current requirements. Removed catalog entries cannot leave an actionable empty review. | `deepClaimBusinessAudit.test.tsx`; Phase 4/research suites |
| Goals | A goal removed by a refreshed catalog closes through the displayed one-tap Back to camp action. Existing source-backed goal progress is unchanged. | Business audit; goal suites |
| Club projects and sharing | A contribution remains fixed until its request settles; duplicate requests/exits are guarded and failures retain review. A changed avatar URL can recover after an earlier image failed. Consent and server contribution contracts remain unchanged. | Business audit; existing club suites |
| Building and sale/collection page actions | Building reviews track revision, level and price; changed reviews require explicit review again. Page-level guards prevent rapid repeat actions. Collection presentation uses actual observed transfers and does not label a no-transfer production response as secured output. A collected/removed haul closes its stale review. | `deepClaimPageAudit.test.tsx`; existing Phase 2 UI coverage |
| Uncertain actions and multiple tabs | Compatible per-request journal leaves preserve independently started requests. Scoped storage/local events inform mounted hooks, which also reread durable state before a new write. Cleanup removes only the acknowledged/rejected UUID. Foreign-scope returned snapshots remain uncertain; an old receipt replay returns the newer cached snapshot when available. | `deepClaimPendingActions.test.ts`; `deepClaimRecoveryAudit.test.tsx`; existing hook suites |
| Shared buttons, dialogs and meters | Source review retained semantic buttons, pending disabling, accessible dialog titles/descriptions, focus restoration, busy dismissal guards, fixed-footer regions and finite/clamped progress values. No shared primitive change was needed. | Existing primitive/dialog tests; pre-interruption native keyboard checks; final rerun limited as described below |
| Immersive shell and responsive styles | Source review retained Return to DH, installation gating, safe-area layout, focus indicators, reduced motion and forced-color rules. Mine rendering and its operational-list alternative retain their existing authority boundary. | Pre-interruption seven-case native layout matrix; final rerun limited as described below |

## Changed files

Source changes are concentrated in:

- `src/components/deepClaim/DeepClaimBusiness.tsx`, `DeepClaimClub.tsx`, `DeepClaimCompanyGoals.tsx`.
- `src/components/deepClaim/DeepClaimDispatch.tsx`, `DeepClaimField.tsx`, `deepClaimSelectors.css`, `deepClaimDepthPicker.css`.
- `src/components/deepClaim/DeepClaimIndustry.tsx`, `deepClaimIndustry.css`.
- `src/components/deepClaim/DeepClaimPanels.tsx`, `DeepClaimWorkforce.tsx`, `deepClaimWorkforceMenus.css`.
- `src/components/deepClaim/DeepClaimSettings.tsx`, `menu/DeepClaimPrologue.tsx`, `menu/DeepClaimTitleScreen.tsx`, `tutorial/DeepClaimTutorialDialogue.tsx`.
- `src/hooks/useDeepClaim.ts`, new `src/lib/deepClaim/pendingActions.ts`, and `src/pages/DeepClaimPage.tsx`.
- `scripts/check-deep-claim.mjs` extends the native reliability flow to distinguish shared-storage tabs from independent-device contexts.
- New focused regression suites are listed in the matrix. This document and the pending-action protocol appendix describe the implemented client boundary.

## Verified integrated release checks

- Full application unit/component run: **228 files / 2,398 tests passed**, 156.09 seconds. This run includes all eight new audit suites, 32 journal tests including 14 preview-format migration cases, and the preserved remote generated Supabase types.
- `npm run typecheck` now runs `tsc --noEmit -p tsconfig.app.json`; the actual application project passed.
- Scoped ESLint, CSS parsing and `git diff --check` passed. The unchanged Phase 8 gate preserved frozen rules, catalogs, migrations and original atlases.
- Production build passed in **16.49 seconds**. Deep Claim remains lazy loaded; its existing large-chunk advisory remains (823.68 KB JavaScript / 198.32 KB gzip).
- The existing npm lock was repaired without changing declared dependency ranges. A separate clean `npm ci --ignore-scripts --no-audit --no-fund` installed 533 packages successfully. The exact repaired parent `5b375b28` then passed GitHub CI's actual `npm ci`, application typecheck, member lint, unit tests and build. Final feature-commit CI and publication evidence are recorded in the implementation ledger after push.

Evidence retained under `/workspace/checkpoints/deep-claim-audit-final/`: `unit.log`, `typecheck.log`, `lint.log`, `build.log`, `preservation.log`, original audit backup/manifest and the verified remote-object import receipt. No old local test count is substituted for this integrated source run.

## Browser verification and limits

Before the execution interruption, staged native runs exercised the actual components and isolated SQL. **431 passing checks** covered the publisher, populated inventory/research/work orders/gear/settings, all seven viewport/theme/motion cases, fixed transaction summaries and the core mining journey. Additional staged runs passed lost acknowledgement/reload, an already-open sibling tab, offline protection, independent-device conflicts, complete workforce/production operations, field discoveries, genuine cavern surveying, research/contracts/milestones, three Records layouts, and social privacy/earned finite stock/fair contribution caps. Independent image review found no blocking clipping, overlap or contrast problems across representative 320px phone, 844px landscape and 1440px desktop frames.

Several older harness assumptions were corrected: ordinary reload/reward helpers acknowledge the real Shift report; report-specific tests explicitly opt out; find selection follows its actual public identity; recovery passes through the publisher/title shell; and the audio reload check waits for the finite publisher before inspecting silence. None of those adjustments fabricates stock, terrain, energy, completion or rewards.

The final native-browser and built-PWA reruns after reconnect were **not completed**: the execution sandbox rejected localhost binding, public HTTPS and the Docker socket with `EPERM`. Therefore the pre-interruption browser evidence is not represented as a fresh full-browser pass for the final preview-migration and focus refinements. Those changes passed the integrated regression suite and source checks. Physical-device installation, hardware/audio performance and authenticated production-player testing are not claimed.

## Remaining limits

Browser storage can be blocked or cleared. An active hook retains its in-memory receipt when storage is unavailable, but cross-reload durability cannot be promised after device data is removed. The journal is not a cross-device lock; existing server authorization, company locks, revisions and idempotent receipts remain authoritative.

The short-lived connected-editor preview's alternate UUID leaves and optional timestamp are normalized safely into the single journal. Original request arguments are preserved; an unrelated request is never cleared by another acknowledgement. Its redundant helper/test implementation is consolidated into the source-backed journal and regression suites.

No new progression content, economy rebalance, migration, save reset, new production artwork or replacement mining simulation is claimed by this refinement release. Commit/push/publication status must be checked in the implementation ledger.

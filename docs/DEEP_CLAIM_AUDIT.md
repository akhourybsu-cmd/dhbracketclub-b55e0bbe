# Deep Claim reliability audit

Pass on main `3dfd021b` (head `83b6bf29` added only regenerated Supabase types). No migration, save reset, economy/catalog/atlas change or new dependency.

## Implemented and verified

| # | Area | Change | Evidence |
|---|---|---|---|
| 1 | Uncertain-action recovery (`useDeepClaim`) | New `src/lib/deepClaim/pendingJournal.ts`: validated (operation, UUID, label ≤80, entry ≤16KB, ≤12 entries) per-request leaves + compatibility pointer; legacy pointer migrated; own-only clearing; storage + same-window sync; durable re-read before each write; memory fallback for blocked storage; retry uses the oldest exact intent. | `src/test/deepClaimPendingJournal.test.tsx` (multi-tab clear, legacy migration/corrupt entries, two mounted hooks block + exact retry) and 29 existing `deepClaimHooks` recovery tests |
| 2 | Returned snapshots | Foreign/empty snapshot ⇒ uncertain `data` error, receipt kept, cache untouched; success returns the monotonic cache snapshot. | Same file: foreign snapshot, older-replay tests |
| 3 | Page actions | Synchronous latch; frozen building review + Review current upgrade; stale haul review closes; truthful zero/partial production receipts; haul deposit sound only when cargo moved. | Type check + existing UI suites; no dedicated page test for the new copy yet |
| 6 (part) | Company goals | Invalidated inspector closes in one Back tap. | Existing goals UI tests |
| 7 | Milestone copy | Already source-backed: cards/inspector use `milestoneDetail` metric text with `m` for depth; the quoted boilerplate is not in current main. No change needed. | Source inspection |
| 11 | Focus rings | Inner input outline suppressed under `.deep-claim`/`.dcl-dialog` scope; outer focus-within ring, clear-button focus and forced-colors kept. | Source only (no visual check) |

## Not implemented in this pass (open)

Items 4 (Industry batch/full-storage/missing recipe), 5 (Workforce review latches, 6-item pages), 6 rest (funded research, office/club latches, avatar retry), 8 (Dispatch crew revalidation), 9 (Field find guards, lift, depth labels, find-ID attribute), 10 (sound unlock/founding guards, draft isolation, dialogue-history Escape, Updates fallback) and the native `scripts/check-deep-claim.mjs` harness changes. These remain as audited findings; none were changed.

## Verification run

- `npx tsc --noEmit -p tsconfig.app.json` — exit 0
- ESLint over touched files — exit 0
- `vitest run src/test/deepClaim*` — 46 files; 742/743 on the first full run (one `deepClaimUI` session test timed out under load; it passed 26/26 in three isolated reruns)
- `npm run test:unit -- --maxWorkers=2` — exit 1: 2293/2295; the two failures are 5s timeouts in `src/test/nexus/coreBalance.test.ts` (Nexus, untouched by this change)
- `node scripts/check-deep-claim-presentation.mjs --phase=8` — exit 0
- `npx vite build` — exit 0
- Unrun: native/Docker `scripts/check-deep-claim.mjs`, browser QA. The remote CI result could not be read from the sandbox; CI runs typecheck, `lint:member`, `test:unit`, build — the Nexus timeouts above would fail `test:unit` independently of this change.

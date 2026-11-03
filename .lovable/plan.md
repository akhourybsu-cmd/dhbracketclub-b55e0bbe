# Deep Claim "Maximum update depth" — stack capture (read-only)

## Evidence already available (checked this turn, no execution beyond reads)
- Checkout HEAD: `ec48adefe2a98c87eb0ae51a22a253e6bc07503a`, working tree clean (`git status --porcelain` empty).
- `/tmp/dc-navigation-final/report.json`: last passing checks `layout-844x390-dark-no-preference-office-records` and `...-office-records-review`; then one error (Surface tab not found, `toBeFocused` at `scripts/check-deep-claim.mjs:469`, called from `main` :1264) and two runtimeErrors, both only the message text "Maximum update depth exceeded...".
- `/tmp/dcnav.log` (56 lines): only the same Playwright locator failure; no React frames.
- Why no stack exists: the script's line 66 stores `error.message` only, and there is no `page.on('console')` listener. **No component stack or JS stack frames were ever captured.** Any named culprit component would currently be a guess.

## What I would run once approved (temp copy only, no project changes)
1. Record `git rev-parse HEAD` + `git status --porcelain` before.
2. Copy `scripts/check-deep-claim.mjs` to `/tmp/dc-stack/check-deep-claim-stack.mjs`; make relative imports absolute under `/dev-server/scripts/...`; run with cwd `/dev-server`.
3. Only instrumentation changes in the copy:
   - `pageerror` → push `error.message` and `error.stack`.
   - add `console` listener saving all `error`/`warning` text with `msg.location()` and args (React dev logs "The above error occurred in the <X> component" plus component stack there).
   - timestamped trace of each step label/key press so the sequence before Escape is logged.
   - optionally narrow `visualCases` to 844x390 dark only. No assertion edits.
4. Run: `DEEP_CLAIM_QA_CHROMIUM=/bin/chromium DEEP_CLAIM_QA_VISUAL_MATRIX=1 DEEP_CLAIM_QA_SECTION=presentation DEEP_CLAIM_QA_OUTPUT=/tmp/dc-stack-qa timeout 580 node /tmp/dc-stack/check-deep-claim-stack.mjs`.
5. Report: exit code, report counts, full error stack, React component stack (first frames to the looping component), preceding step sequence, then HEAD/clean tree again. No fix, no edge-function or source changes.

Note: plan mode blocks running the browser harness, so step 3–4 need approval to execute.

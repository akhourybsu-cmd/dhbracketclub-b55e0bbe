# Deep Claim implementation ledger

## Current follow-up — illustrated ledger and mine navigation

Built on clean main `d41c4ebf2f4582ca37ce6e0449307fc3dbeff6b3`. This presentation pass adds six illustrated activity categories, six-record pages, timezone-aware receipt dates and explicit mappings for all 20 current event kinds. The latest-record count describes the bounded recent feed. Original receipt data/timestamp attributes remain intact; singular-unit wording is corrected only in the display; unknown future kinds remain in All. Filter/paging focus and refreshed-source recovery have regression coverage.

Mine navigation now focuses each active expedition once, retains an idle-worker fallback and tracks identities across roster changes. Surface framing uses both building axes. Two-finger gestures preserve their moving world anchor, and right/middle mouse clicks cannot move/select the mine. No SQL, RPC, RLS, economic rules, world generation, saved progress, atlas bytes or dependencies changed. See the follow-up in `DEEP_CLAIM_AUDIT.md` for scope.

| Verification | Evidence |
|---|---|
| Full app unit suite | **230 files / 2,432 tests passed** in 294.69 seconds, one worker. Includes 33 new ledger/map regressions and existing games. |
| Source checks | Actual app-project TypeScript, scoped ESLint, existing member lint, CSS parsing, browser-script syntax and whitespace checks passed. |
| Preservation | Unchanged Phase 8 source/SQL/catalog/atlas gate passed. |
| Production build | Final layout build passed in **18.90 seconds**. Existing large-chunk advisory remains. |
| Native browser / publication | Initial `3c1b23a` run: **282/282 passed**, zero errors/runtime errors. Screenshot review found HUD/pager issues; final layout corrections and stronger native intersection/hit-target assertions are being verified before publication. |

Evidence: `/workspace/checkpoints/deep-claim-navigation/`. The new isolated `navigation` browser section derives records from a real tutorial haul and seven actual one-unit coal sales. It checks category keyboard controls, real pagination, all owned-building bounds, native touch anchoring and unchanged authoritative company state over the phone/landscape/desktop matrix. Root browser execution remains blocked by the sandbox's socket `EPERM`; the existing connected editor is the verification fallback. Final browser, commit and public-content receipts will follow after those operations actually complete.


## Current release — menu, interaction and recovery audit

The full UI audit is integrated and publicly verified. The [audit matrix](DEEP_CLAIM_AUDIT.md) records every inspected area, implemented correction, changed module and verification limit. Existing generated Supabase types, mining rules, catalogs, SQL, earned saves and original atlases are preserved. No migration or reset is required.

- Workforce reviews with fixed action footers, six-worker/tool pages and explicit equipment replacement make management easier to navigate. Building/hiring/training/gear reviews recheck source state and guard rapid duplicate or stale purchases.
- Funded research shows progress/effects; milestones show actual objectives and depth units. Production handles invalid batches, full/partial storage, equipment-only jobs, missing recipes and queue limits. Collection receipts show observed positive transfers; zero-transfer production and hauls use neutral acknowledgement rather than an acquisition sound.
- Dispatch rechecks selected energy/assignments. Find decisions lock while saving and recover after failure; stale callbacks cannot close a newer decision. Depth navigation follows explicit contextual selections and clears hidden filters. Search retains one visible keyboard indicator, including forced colors.
- Founding/audio controls prevent repeat requests, preserve retry and isolate account/controller changes. Tutorial-history Escape restores focus correctly; protected saves and unavailable settings views keep functional navigation.
- One bounded per-request journal protects uncertain UUIDs across tabs, reload, legacy pointers and preview-format leaves. Exact retry arguments, monotonic snapshots, existing authorization and server idempotency remain authoritative. The redundant alternate preview implementation was consolidated safely.
- The portable npm lock matches existing dependency ranges; `npm run typecheck` checks the actual app project. CI runs unit files serially to avoid CPU contention in existing simulation tests, preserving every assertion, timeout and test case.

| Verification | Actual evidence |
|---|---|
| Final GitHub CI | Source **`58f0cb280a7ada1c2df9f9697289ee606a84d89c`**, [run 41641698847](https://github.com/akhourybsu-cmd/dhbracketclub-b55e0bbe/actions/runs/41641698847): clean install, actual application typecheck, member lint, **228 files / 2,399 tests passed** in 236.78 seconds, production build passed in 14.61 seconds. |
| Local source checks | Full 2,398-case suite passed; final feedback correction passed 37 focused checks. Actual app types, scoped ESLint, CSS parsing, whitespace and unchanged Phase 8 preservation passed. |
| Final local build | Passed in **22.60 seconds**; `DeepClaimPage-C8LiNKce.js` (823.70 KB / 198.33 KB gzip), `DeepClaimPage-h7kg4hyk.css` (272.23 KB / 41.63 KB gzip). Existing chunk advisory remains. |
| Fresh real game browser | **126/126 checks passed**, zero assertion/runtime errors, exact final source `58f0cb28`. Existing session/moments sections with real isolated SQL and seven phone/landscape/desktop, light/dark/reduced-motion cases. |
| Built PWA | **12/12 checks passed**, zero assertion/runtime errors; 390×844 portrait and 844×390 landscape. Signed-out local bootstrap, icons/manifest/worker and overflow checks, source `5f572b73` before the audio-only correction. No physical standalone install is claimed. |
| Earlier broad native checks | Pre-interruption staged coverage and independent image review include populated inventory, workforce, production, research/business, field/caverns and recovery. These are not presented as a fresh repeated full matrix; see the audit for exact scope. |

The principal 36-file game audit was pushed normally as **`2c1aecb0f51b99d5fadb3fa9cd5b7cffefb29f4f`**, tree `608e484fd677747398afa2ea4337a21659359b36`, from the expected `5b375b28` parent. CI scheduling followed as **`5f572b73df6200d7893eaa3e048db7d3a379e25a`**; the final no-transfer audio regression/correction is **`58f0cb280a7ada1c2df9f9697289ee606a84d89c`**, tree `12ff555605cf06ab953c10a2a01f796fb6d697e6`. Uploaded blob/tree hashes matched the tested workspace, all main updates used expected-parent CAS with `force=false`, and exact local imports/readbacks agree. No unrelated remote work was overwritten.

Lovable reported exact final source `58f0cb28` ready with no project error before publication. Deployment **`557c4a0f-74b0-4b36-85a1-474640e46021`** was then verified by actual public HTTPS on **2026-11-03T13:19:49Z** at **https://dhbracketclub.lovable.app/**. The site serves entry `index-D4nsBHyT.js`, game `DeepClaimPage-DQgWNfcq.js` and `DeepClaimPage-h7kg4hyk.css`, all HTTP 200. All required game markers/styles were present. Public game CSS SHA256 **`b2a88a5a7158b64e84949a5683cd3af9a6b68cacab6634282a2b4f4caf192830`** exactly matches the tested build. Both original atlas hashes match unchanged. Public build metadata reports `1793711366653`.

Commit readiness/deployment identity were checked through the hosting API; public HTTP does not expose either identifier directly. The content proof independently confirms the served new UI, CSS and atlases. Lovable rebuilds JavaScript, so local/hosted JS byte equality is not claimed; the public build ID is not a Git SHA. The read-only public probe used normal TLS, no login, no-cache headers and unique cache-busting queries. No project files or live company/resource/achievement/notification records were changed by verification.

Evidence is retained under `/workspace/checkpoints/deep-claim-audit-final/`, including `verification.json` and `publication-receipt.json`. Browser execution was read-only through the connected editor because the root sandbox denies sockets. Genuine remaining limits: the full all-section matrix was not repeated after reconnect; physical-device/installed-standalone testing, hardware audio/performance and authenticated production-player actions are not claimed. This receipt is a documentation-only follow-up to the verified release.

## Previous release — crews and confirmed game moments

This presentation release builds on clean main `90762a0efc95c9f6fe76e1c6e9e00a6266500e86`. It connects existing dispatch, mining, collection and building growth with clearer game moments. No SQL migration, economic rule, hidden terrain, atlas, dependency or rendering-engine change is introduced.

- Operations cards identify the actual assigned workers, known destination and five server-declared stages. Follow crew uses the existing public projection and a revealed grid location/known approach. Returned crews expose View worksite. Expired active clocks still require Check return; only confirmed ready cargo exposes Open haul. Cards keep a bounded 140px portrait / 122px short-wide footprint and 44px action controls.
- A short, skippable original pixel-lift departure follows only a new active expedition in the resolved dispatch snapshot, matching company, revision, input and worker assignments. Previews, unchanged retries, reloads and unrelated updates cannot trigger it. It does not trap focus or award anything; the active tutorial and other dialogs retain priority. Timers clean up on dismissal, identity change and unmount. Reduced motion uses a static 900ms presentation instead of the normal 1,800ms sequence.
- Central collection receipts use original pixel crate/ledger art, real transferred quantities, actual equipment IDs and the remaining staged amount. Cash is labelled Company balance. Building receipts compare the actual owned before/after levels with the returned effect. The effect appears once. New construction/upgrades retain their existing sound settings; no new audio engine or continuous render loop is introduced.
- The existing Back to the claim and Plan next shift actions, tutorial markers, transaction guards, company goals, return reports and public world remain connected. Failed or unconfirmed actions create no success ceremony. Saved-action recovery remains generic when exact before/after evidence is unavailable.

| Verification | Evidence |
|---|---|
| Full app suite | **220 files / 2,289 tests passed** in 141.29 seconds; `/tmp/dc-feel-unit.log`. |
| Final focused tests | **83 tests across five suites passed** in 11.10 seconds; `/tmp/dc-feel-focused-final.log`. Includes the final one-copy effect check, source-matching departure, public crew focus, unchanged/foreign updates, official stage/ready handling, timer cleanup, actual receipts and existing Page integration. |
| Broad native regression | **192 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-edXWFG/report.json`. Seven screen/theme/motion cases cover real paid dispatch/departure, public Follow crew, actual cargo collection, paid Warehouse 1→2 upgrade, existing goals/next-shift flow and native 30-second sale/Keep tutorial paths. |
| Final native moments | **56 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-HGnpwI/report.json`. Five layouts/themes/motion cases repeat genuine collection and paid upgrade with the duplicate effect removed. The full earlier 21-frame moments matrix received an independent visual review; final phone upgrade/collection frames retain readable artwork and visible controls. |
| Source checks | Explicit application-project TypeScript, scoped ESLint, CSS parsing and whitespace checks passed. Phase 8 preserves all 27 frozen gameplay sources, catalogs, SQL and both original atlases; `/tmp/dc-feel-preservation.log`. |
| Production build | Passed in **23.21 seconds**; `DeepClaimPage-To7_uI7G.js` 810.22 KB / 194.58 KB gzip and `DeepClaimPage-J42TEcz_.css` 271.07 KB / 41.44 KB gzip. The existing large-chunk advisory remains. |
| Built production PWA | All **12 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-pwa-JOhw7c/report.json`. This verifies the production-build authentication boundary and PWA bootstrap without claiming physical-device installation. |

Native scenarios use production components and authoritative isolated PostgreSQL; no live member company, stock or achievement is changed. No SQL migration is required.

The 20-file feature was pushed normally to main as **`ca7c7720458c023faa2798582f24825779b374db`**, tree `897dd475d61def8ac4152446c857313db51e9fa2`, from the expected `90762a0e` parent. All uploaded blob SHA values and the remote tree match the tested workspace; main readback and hash-verified local commit import agree. No force update or protection bypass occurred. Lovable reported this exact source revision ready with no project error before publication.

Deployment **`21961daa-0042-4a3c-be31-28daec2ff10b`** was verified through actual public HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-03T03:31:38Z**, build `1793675838152`. The public game serves `DeepClaimPage-CFZdwEPJ.js` and `DeepClaimPage-J42TEcz_.css`, including the operation/stage identities, Follow crew, confirmed departure, building comparisons and Company balance wording. Public CSS SHA256 **`ee593c29484df878c5320f9d5240b5b514266417535669069553c9f736d1734e`** exactly matches the tested build. Both original atlas hashes remain unchanged. Proof: `/tmp/dc-feel-public-proof/proof.json`.

Lovable rebuilds JavaScript, so local/hosted JavaScript byte equality is not claimed. Source synchronization and served content were verified separately; the public build ID is not a Git SHA. This receipt is a documentation-only follow-up. Public asset verification does not claim authenticated production-player testing, physical-device installation or hardware/audio QA.

## Previous release — connected mobile company loop

This release builds on clean main `9a69b714ba9f948a10a66d8fa926d6765248c7e9`. The [mobile comparison and design record](DEEP_CLAIM_MOBILE_LOOP.md) explains the reference review and the implemented loop: choose an investment, confirm work, inspect a factual return, collect and plan again. Existing company systems supply all progress and rewards. No SQL migration, mining/economic balance, atlas, dependency or global-service change is introduced.

- A company goal can target the next building level, a research project, an existing delivery order or a finite company milestone. The compact surface dock and four-card planner show real collected materials, operating reserve, prerequisites and confirmed progress. Pinning stores only an identity; Review opens the exact existing transaction without paying or claiming automatically.
- The Shift report summarizes newly ready cargo, ready production, pending finds and confirmed research after Continue. First hydration is quiet, other dialogs/tutorials retain priority, and acknowledgement prevents repeated automatic presentation. Manual review can inspect currently ready work. Active elapsed timers and cash differences never become invented completion or idle profit.
- Positive, fully confirmed haul collection can offer Plan next shift. The ordinary editable draft reuses eligible workers and duration, replaces an exhausted destination with a legal public site, and retains every capacity/energy/slot/storage check. An induction follow-up is a normal 20-minute plan. A fresh server estimate and explicit dispatch confirmation remain mandatory.
- Goal pins and report-read receipts are bounded device/company preferences; the underlying company remains server-persistent across devices. Foreign/corrupt/blocked metadata cannot authorize actions or supply progress. These UI preferences do not synchronize between devices. No new reward, prestige reset, purchase pressure, streak penalty or notification loop is added.
- Existing Office direct reviews validate catalog identities and retain revision/permission checks. The new panels reuse original pixel artwork, concise operational labels, light/dark themes, 44px controls and reduced-motion/forced-color support. The short-wide goal dock is compact enough to clear the crew dock; explicit native hit/overlap checks cover all seven layouts.

| Verification | Evidence |
|---|---|
| Full app suite | **216 files / 2,231 tests passed** in 145.29 seconds; `/tmp/dc-loop-unit-final.log`. Two older UI suites now clear device preferences between independent tests; within-test persistence remains exercised. |
| Focused feature tests | **94 tests across six suites passed**, plus **14 Office tests**; `/tmp/dc-loop-focused-final.log` and `/tmp/dc-loop-business-tests.log`. The final goal UI recheck passes all **10 tests** after correcting Testing Library type options; `/tmp/dc-loop-goal-ui-checked.log`. |
| Final native session | **49 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-258tVa/report.json`. Real paid induction, return, pin/reload/review, actual collection and ordinary follow-up draft use production components and isolated authoritative PostgreSQL. All seven screen/theme/motion cases have zero goal/crew overlap and reachable controls at least 44px wide/high. |
| Tutorial regression | **108 native checks passed** across the initial session and genuine 30-second sale/Keep campaign paths; `/tmp/deep-claim-LucWCj/report.json`. The subsequent source correction only compacts the short-wide goal dock; the final native run verifies that layout. |
| Source checks | Explicit application-project TypeScript, scoped ESLint, CSS parsing and whitespace checks passed. The Phase 8 gate preserves all 27 frozen gameplay sources, catalogs, SQL and both original atlases; `/tmp/dc-loop-preservation.log`. |
| Production build | Passed in **17.09 seconds**; `DeepClaimPage-CofIyOBP.js` 794.71 KB / 189.77 KB gzip and `DeepClaimPage-WWYiuvnj.css` 253.51 KB / 39.04 KB gzip. The existing large-chunk advisory remains. |
| Built production PWA | All **12 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-pwa-cKfYCY/report.json`. This verifies production-build authentication and PWA bootstrap without claiming physical-device installation. |

Native QA changes no live member company, stock or achievement. No SQL migration is required.

The 29-file feature was pushed normally to main as **`980e6a938a2c5c5028113edc816a967f058b1486`**, tree `699587a7e2742c5ee966fadd12dde10fbe5ebbcd`, from the expected `9a69b714` parent. All uploaded blobs and the remote tree match the tested workspace; main readback and hash-verified local import agree. No force update or protection bypass occurred. Lovable reported the exact source revision ready with no project error before publication.

Deployment **`60552f21-76ea-4025-b1c5-b87a982f2043`** was verified through actual public HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-03T01:36:17Z**, build `1793669634303`. The public game serves `DeepClaimPage-AUYg1zkE.js` and `DeepClaimPage-WWYiuvnj.css`, with the company-goal IDs/planner, report metadata/sections and Plan next shift action. Shared goal/requirement/report/worksite styles are present, and the old coordinate-dropdown prose stays absent. Public CSS SHA256 **`4fabc1841ddf2dee2b9e5dcf8293f184e54bcb61e6911ba19c9ee2ac3936089f`** exactly matches the tested build. Both original atlas hashes remain unchanged. Proof: `/tmp/dc-loop-public-proof/proof.json`.

Lovable rebuilds JavaScript, so local/hosted JavaScript byte equality is not claimed. Source synchronization and served content were verified separately; the public build ID is not a Git SHA. This receipt is a documentation-only follow-up. Public asset verification does not claim authenticated production-player testing, physical-device installation, measured retention or hardware/audio QA. Goal selection and report-read preferences remain device-local; all economic progression remains server-authoritative.

## Previous release — thematic selectors

This presentation release builds on clean main `862993fe1ed327c33bc0f6d5f4b2e3ebc650e598`. All five native dropdowns in Deep Claim are replaced with direct game controls. No schema, economic rule, world-generation, atlas, dependency or authorization change is introduced.

- Dispatch uses illustrated worksite cards with a small map of already revealed ground, resource art, depth, branch location, remaining stock and an explicit selected state. Raw x/y coordinates are internal IDs rather than visible destination prose. Four-card pages, depth/material search and a pinned selection keep large mines bounded and preserve the exact chosen destination while browsing. A refreshed small list cannot retain an inaccessible hidden filter.
- Infrastructure uses original illustrated project tiles with concise functional labels. Mine navigation uses a pixel-art lift with six known stops per page, an optional pinned stop, known-depth search and an explicit Locate action. Hidden or disconnected ground never becomes an available stop.
- Worker training uses seven skill buttons with actual base values. The Training Journal uses a compact horizontal section strip and keeps all existing lessons, search and pagination. Selection, confirmation, costs, daily limits and read-only guards remain unchanged.
- Public map context, authoritative estimate/revision checks, starter-shift selection and tutorial event IDs are preserved. Exact internal worksite identities remain available to tests through stable data attributes; neither illustrations nor local selection can dispatch a crew or award resources.

| Verification | Evidence |
|---|---|
| Full app suite | **211 files / 2,153 tests passed** in 138.41 seconds; `/tmp/dc-selectors-unit.log`. |
| Final focused regressions | **139 tests across six suites passed** in 23.40 seconds; `/tmp/dc-selectors-focused-final.log`. Includes the final small-list filter recovery, exact target/quote behavior, bounded 600-site browsing, public-only deep navigation, selected-course confirmation, read-only controls and journal filter resets. |
| Native browser | **320 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-gr1qqx/report.json`. Seven screen/theme/motion cases cover all five selectors, actual keyboard selection, exact server estimates, no-spend browsing, finite underground work, collection and native 30-second sale/Keep tutorial paths. All 28 selector screenshots were separately reviewed. |
| Source checks | Explicit application-project TypeScript, scoped ESLint, CSS parsing and whitespace checks passed. The Phase 8 preservation gate retains all 27 frozen gameplay sources, catalogs, SQL and both original atlases; `/tmp/dc-selectors-preservation.log`. |
| Production build | Passed in **30.64 seconds**; `DeepClaimPage-QGac5IKp.js` 764.31 KB / 181.00 KB gzip and `DeepClaimPage-DbzdRCM6.css` 240.06 KB / 37.09 KB gzip. The existing large-chunk advisory remains. |
| Built production PWA | All **12 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-pwa-gXj3L7/report.json`. This verifies production-build authentication and PWA bootstrap without claiming physical-device installation. |

Native QA uses real production components and authoritative isolated local PostgreSQL transport. No live member company, stock or achievement was changed. No SQL migration is required.

The 21-file feature was pushed normally to main as **`4ac758aa770e30d994d594406363e3a8256853ae`**, tree `f590be5669ffb61d50ec3f0d59189e2aa3741bf7`, from the expected `862993fe` parent. Uploaded blobs and the remote tree match the tested workspace; main readback and hash-verified local import agree. No force update or protection bypass occurred. Lovable reported the exact source revision ready with no project error before publication.

Deployment **`11d72576-2a34-4563-a381-92c3e83a5493`** was verified through actual public HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-02T23:59:43Z**, build `1793663923059`. The public game serves `DeepClaimPage-Be_bfSBd.js` and `DeepClaimPage-DbzdRCM6.css`, with all five selector identities, the worksite map/card, lift-stop and journal-rail styles. Old coordinate-search placeholder and pinned-selection explanatory prose are absent. Public CSS SHA256 **`1a07110ba572271cc92b5b4892e0ea874b6d652aafa01460ee0fc039b47f2edb`** exactly matches the tested build; both original atlas hashes remain unchanged. Proof: `/tmp/dc-selectors-public-proof/proof.json`.

Lovable rebuilds JavaScript, so local/hosted JavaScript byte equality is not claimed. Source synchronization and public content were verified separately; the build ID is not a Git SHA. This receipt is recorded in a documentation-only follow-up. Public verification does not claim authenticated production-player testing, physical-device installation or hardware/audio QA.

## Previous release — unified visual finish

This visual release builds on clean main `eb4abe0bf8771f8f30e35e91a6b17adbdb3aa110`. It keeps the concise menus, existing game behavior and original industrial-frontier artwork. No database, economic rule, asset installation, world-generation, atlas or dependency change is introduced.

- Shared charcoal/brass/ivory surfaces, restrained hardware frames, stronger theme contrast, clearer state badges and readable disabled controls unify the HUD and dialogs. Map controls use the same solid instrument panels without backdrop blur. Fixed action footers and established safe-area behavior remain.
- Inventory, workshop, workforce and settings use consistent recessed artwork stages, sharper native-grid artwork sizes, readable item quantities, aligned output/material displays and clearer selection. The actual production/research status still comes from the existing server snapshots and schedules.
- Phone Office navigation uses one compact row of five labelled controls where 44px targets fit, with an extreme-narrow fallback. Research branch cards and active gauges are denser so more actual research content fits; all completion/Maxed and elapsed-versus-confirmed rules remain unchanged.
- Raw clay, coal, copper and iron UI illustrations have distinct original pixel silhouettes and inclusions using the existing palette. Refined, gem and crystal artwork is preserved. Every resource illustration exposes a stable artwork ID and retains its labels/decorative accessibility. Building portraits, settlement, world tiles, title and prologue continue using the original shared painters and unchanged atlases.
- Buildings, dispatch estimates, specimen reveals, public projects and reward framing receive the same visual treatment. Reduced motion, high contrast, touch targets and keyboard interaction remain part of the presentation boundary. No new menu prose is added.

Implementation is scoped to eight existing stylesheets and `renderer/DeepClaimIcons.tsx`. The browser harness now waits for the real first-shift planner before pausing the guide, follows the current concise cash summary, and verifies the real pending-find priority without selling or discarding a specimen to force the upgrade prompt. These harness changes do not alter the game.

| Verification | Evidence |
|---|---|
| Full app suite | **211 files / 2,145 tests passed** in 136.59 seconds with two workers; `/tmp/dc-polish-unit.log`. |
| Native visual and interaction checks | **375 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-Nr2j5H/report.json`. Populated inventory, earned materials, worn equipment, worker profiles, settings, real research progress/completion, production queues, fixed transaction summaries, keyboard-scrolled details and finite underground discoveries are covered. The seven-case matrix includes 320px phones, 844px landscape, 1440px desktop, both themes and reduced motion. |
| First-shift regression | **62 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-0GRYAr/report.json`. Native 30-second first-shift sale and Keep paths, real collection, optional help, retained stock, pending-find priority and title/reload recovery remain intact. |
| Source checks | Application-project TypeScript, scoped ESLint, PostCSS parsing and whitespace checks passed. Phase 8 preserves all **27 frozen gameplay sources**, catalogs, SQL and original atlases; `/tmp/dc-polish-preservation-final.log`. |
| Theme contrast | Core text, muted text and semantic foreground tokens exceed **4.5:1** against each of the four solid theme surfaces; `/tmp/dc-polish-contrast.log`. This numeric check does not claim an exhaustive audit of every composited selector. Phone, landscape and desktop screenshots were separately reviewed. |
| Production build | Passed in **18.54 seconds**; `DeepClaimPage-CeY-zY_P.js` 758.89 KB / 179.47 KB gzip and `DeepClaimPage-Dxd3wYp8.css` 230.70 KB / 35.72 KB gzip. The existing large-chunk advisory remains. |
| Built production PWA | All **12 checks passed**, no assertion/runtime errors; `/tmp/deep-claim-pwa-0LbdDj/report.json`. This covers the production-build authentication boundary and PWA bootstrap, without claiming physical-device installation. |

Native browser scenarios use production components with authoritative isolated local PostgreSQL transport. No live member stock, company or achievement was changed by QA. Independent final visual review found no material clipping, hidden action or art-style regression in the reviewed phone/landscape/desktop frames.

The 13-file feature was pushed normally to main as **`90defd1fa242ab5addfb1e25fd6af82c2f58a21c`**, tree `d561f48636851c6ec3ca9fca85dd4a5fb3c50660`, from the expected `eb4abe0b` parent. Uploaded blob SHA values and the remote tree match the tested workspace; remote main readback and hash-verified local commit import agree. No force update or protection bypass occurred. Lovable reported this exact source revision ready with no project error before publication.

Deployment **`686d16d4-c864-44b8-bbc8-eb04f3fecd5c`** was verified through actual public HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-02T23:08:42Z**, build `1793660858454`. The public game serves `DeepClaimPage-Pjv3gh5_.js` and `DeepClaimPage-Dxd3wYp8.css`, including the new original clay/coal SVG paths, stable resource-art IDs, recessed artwork stages, hardware dialog frames and research states. Public CSS SHA256 **`96abe654d06ee9f2d784a66f7a68a7aadb83245dd6772d0789c3a09241c0e67b`** exactly matches the tested build. Both original atlas hashes remain unchanged, and the earlier introductory menu prose remains absent. Proof: `/tmp/dc-polish-public-proof/proof.json`.

Lovable rebuilds JavaScript, so local/hosted JavaScript byte equality is not claimed. The public build ID is not a Git SHA; source synchronization and served content were verified separately. This receipt is a documentation-only follow-up. No SQL migration is required or claimed. Public asset verification does not claim authenticated production-player testing, physical-device installation or hardware/audio QA.

## Previous release — concise menus and research completion

This presentation release builds on clean main `069cf947e4c0476808426a1d60858271fdd29344`. Deep Claim menus use plain section names and actual operational information. Introductory slogans, branch-count prose and repeated explanations of what a menu contains are removed. Costs, materials, effects, prerequisites, irreversible choices, privacy controls and error recovery remain available. No database, catalog, ruleset, atlas, dependency, authentication or economic authority changes are introduced.

- Research presents a simple heading, one overall completion meter and illustrated branch selectors with progress tracks and explicit Maxed states. Totals derive from unique confirmed completed research keys in the current catalog, excluding active, unknown and duplicate records. Elapsed time alone cannot mark research complete.
- Research tiles show actual stat bonuses, production-time reductions and illustrated recipe unlocks. Completed research retains its effects and details while removing obsolete costs and paid-start controls; the confirmation handler also guards completed entries. Live research continues to use persisted timestamps and the existing completion refresh.
- Crew, hiring, inventory, production, discoveries, reports, club projects, showcases, buildings and settings lose promotional subtext. Functional explanations remain beside the actual item or decision. Club reward details use a disclosure; social sharing stays opt-in.
- Shared dialogs retain their accessible descriptions without inserting a visible fallback sentence or empty description row. Existing focus, busy, escape, safe-area and transaction-footer behavior is unchanged. Empty menus can use a title without a redundant paragraph. Main menu save protection remains explicit and names the one-company-per-member/per-club rule.

Implementation is in the existing Deep Claim menu components, Page and scoped `businessMenu.css`. Six research-state regressions extend the existing suite. Other test/browser changes update the actual accessible labels and keep interaction, cost, persistence and authorization assertions intact.

Item and building inspectors use their actual quantities, effects, recipes and upgrade panels instead of catalog-flavor subtitles. Worker profiles retain skills, traits, energy and equipment details without another general introduction. The discovery reveal keeps the actual specimen details and choices while removing its generic handover sentence.

| Verification | Evidence |
|---|---|
| Full app suite | **211 files / 2,145 tests passed** in 136.13 seconds with two workers; `/tmp/dc-concise-unit-delivery.log`. Existing UI assertions follow the concise names and retain their transaction, slot, condition, cost and source-state checks. |
| Focused coverage | **134 tests across nine suites passed**; `/tmp/dc-concise-focused-final.log`. The final research and Ancient Deep UI recheck passed **24 tests**, including all six new completion/maxima regressions; `/tmp/dc-concise-final-targeted.log`. |
| Final native browser | **170 checks passed**, zero assertion/runtime errors; `/tmp/deep-claim-qS0QL5/report.json`. Seven screen/theme/motion cases cover earned materials, worn equipped gear, settings, real research progress/completion, sequential work orders, sale/upgrade/batch totals, and keyboard-scrolled review details. Coal's flavor sentence is explicitly absent while its actual production uses and sale controls remain available. |
| Navigation and tutorial regression | The title, save protection, native 30-second first-shift sale/Keep paths and the broader populated-menu pass also completed with **278 passing checks**; `/tmp/deep-claim-jd340r/report.json`. This run preceded only the final inspector subtitle removal; the final 170-check run covers those updated inspectors. |
| Source checks | Application-project TypeScript, scoped ESLint and whitespace checks passed. The Phase 8 gate preserved all **27 frozen gameplay sources**, catalogs, SQL and original atlases; `/tmp/dc-concise-preservation-final.log`. |
| Production build | Passed in **22.95 seconds**; `DeepClaimPage-Dg5i3rbv.js` 757.01 KB / 178.86 KB gzip and `DeepClaimPage-Bx9-YKgV.css` 192.18 KB / 31.55 KB gzip. The existing large-chunk advisory remains. |
| Built production PWA | All **12 checks passed**, no runtime/assertion errors; `/tmp/deep-claim-pwa-5M0taB/report.json`. This verifies local production-build authentication and PWA bootstrap, without claiming physical-device installation. |

Native scenarios use the real production components and authoritative isolated local PostgreSQL transport. No live member stock, company or achievement was created or changed by QA. Final phone inspector, small-phone completed research, desktop active research and landscape transaction screenshots were visually reviewed.

The 30-file feature was pushed normally to main as **`c8c7d2cfdd061b73df291eefa940a9bd85e437b7`**, tree `c85b7391e23ddbc75c5a09b2e7199209edadba24`, from the expected `069cf947` parent. All uploaded blob SHA values and the remote tree matched the tested workspace. Main readback and exact local commit import matched; no force update or protection bypass occurred. Lovable reported the exact source commit ready with no project error before publication.

Deployment **`b24b5075-3992-48bc-bea8-d1bb95f44e7c`** was verified through actual public HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-02T22:01:13Z**, build `1793656803305`. The site serves `DeepClaimPage-C-PSS_9e.js` and `DeepClaimPage-Bx9-YKgV.css`, including the research overview, branch tracks, recipe unlocks, Maxed states and simplified save-protection heading. The old Applied knowledge / Seven branches introduction is absent. Public CSS SHA256 **`f46cdb223a64a62be0b2c12826f4d2784b1e8f70934adfef6af28b1ebd5ab936`** exactly matches the tested build; both original atlas SHA values remain unchanged. Lovable rebuilds JavaScript, so local/hosted JavaScript byte equality is not claimed. The build ID is not a Git SHA; source synchronization and public content were independently verified. Proof: `/tmp/dc-concise-public-proof/proof.json`.

This receipt is recorded in a documentation-only follow-up. No SQL migration is required or claimed. Public asset readback does not claim authenticated production-player testing, physical-device installation or hardware/audio QA.

## Previous release — first-shift guide and natural camp dialogue

This refinement builds on clean main `004dc699704cdc07b9add464badef1672f4167ff`. It replaces the compulsory opening inspection sequence with six existing guided tasks: quote, dispatch, return, collection, sell-or-keep and upgrade inspection. The full 42-topic library remains available, with existing 84 step / 67 dialogue identities and saved records intact. No migration, economic rule, authored atlas, authentication or DH Score change is introduced.

- Founding no longer points back at its missing name field. The new guide starts at a useful dispatch estimate. Actual actions advance the caption; intermediate chapter speeches and repeated Next clicks are removed from the first-shift track. Operation/receipt gating preserves the real result presentation before navigation.
- Keep materials is an explicit alternative that records review without selling or inventing profit. A real partial sale also advances the Surface upgrade cue without requiring an empty warehouse. Upgrade guidance opens the actual building list; purchasing remains optional. Clicking an already selected Extraction mode preserves the 30-second induction.
- The Journal presents one first-shift entry and an optional reference library. Topic details have a real guided-start action; examples and manual review are secondary. The concise guide reserves its own space inside dialogs, retaining readable instructions and a labelled Keep action without covering transaction controls. Landscape shares the footer row; the camp list scrolls above the guide. Keyboard, focus and reduced-motion behavior are preserved.
- The opening falls from 294 to 180 words (about 50 seconds of optional reading); authored dialogue is shorter and the four speakers retain distinct voices. All lesson instructions/references, advice and 42 examples use plain player language. Immediate instructions are about a fifth shorter and at most fourteen words. The sale ending acknowledges actual revenue, and the general handover does not claim a sale or profit.
- Pending operations and receipts defer both automatic progress and step navigation. Keep/Skip controls remain unavailable until the real operation and receipt finish; deferred navigation then resumes. No guide action cancels an economic request or invents a result.

Implementation is in the existing tutorial Director, Journal, Overlay, dialogue/practice/advice components and data modules, with `firstShiftGuide.ts`, a focused guide regression suite, Page cue fixes and a selected-mode safety fix. Curriculum IDs/actions/predicates retain their original registry; the resolver repairs navigation at presentation time. The protocol and menu/tutorial document distinguish the six-task walkthrough from the retained full reference curriculum.

| Verification | Evidence |
|---|---|
| Full app tests | All **211 files / 2,139 tests passed** in 127.34 seconds with two workers; `/tmp/dc-tutorial-unit-idle-final.log`. An earlier concurrent build/browser run hit two unrelated CPU-test timeouts; both isolated retries and the subsequent full run passed without changing their assertions or timeout limits. |
| Focused guide and UI tests | **100 tests passed**, including 16 first-shift Director regressions, receipt/pending-sale navigation, genuine versus reviewed progress, reselected Extraction safety and retained-stock cues; `/tmp/dc-tutorial-focused-final.log`. |
| Native first-shift and examples | **130 checks passed**, zero assertion/runtime errors; `/tmp/deep-claim-gEbNzJ/report.json`. Both paths use real 30-second server-time shifts, one actual dispatch/collection, a partial sale or Keep, and no automatic purchase. Reload and a second device preserve the identical paid job; receipts remain until dismissed. Thirty optional examples alter only training notes. |
| Final menu matrix | All **93 checks passed**, zero assertion/runtime errors; `/tmp/deep-claim-dOOYOz/report.json`. Seven layouts cover the real title, Journal, dialogue and settings; founding, save protection, Continue, Return to DH and atlas-failure recovery remain functional. Together with the first-shift/examples run, this is **223 passing native browser checks**. |
| Responsive review | Seven quote layouts cover 320px portrait, 844px landscape, 1440px desktop, light/dark and reduced motion. Native checks protect instruction readability and target/action geometry. Final phone Keep, Warehouse review and landscape quote screenshots were inspected. |
| Source and contract checks | Application-project TypeScript and scoped ESLint passed. The 27-source Phase 8 preservation gate passed. Copy-only AST checks preserve dialogue identities/conditions, advice actions and practice mechanics. No migration, rule, catalog, dependency or atlas changes. |
| Production build | Passed in **16.34 seconds**; `DeepClaimPage-Dy2X-krQ.js` 761.63 KB / 180.46 KB gzip and `DeepClaimPage-DRvcj9I5.css` 190.45 KB / 31.35 KB gzip. The existing large-chunk advisory remains. |
| Built production PWA | All **12 checks passed**, zero runtime/assertion errors; `/tmp/deep-claim-pwa-XhUXbl/report.json`. This is a local production-build auth-boundary check, without authenticated production gameplay or physical-device installation claims. |

The native browser scenarios use the production React components and authoritative local PostgreSQL operations through the existing isolated QA transport. They do not fabricate production companies, spend a member's stock or award live achievements. Existing saved curriculum IDs and economic authority remain intact.

The 26-file feature was pushed normally to main as **`7143cda6cb43715c4c4e124113367ff69ef3c3bd`**, tree `1bcb16cf51b4c9f8d88b2272c59b4946dd6a76fa`, from the expected `004dc699` parent. Every uploaded blob and the resulting tree matched the tested workspace; the main readback and exact local commit import matched. There was no force update or branch-protection bypass. Lovable reported that exact source commit ready with no project error before publication.

Deployment **`057340e7-a60e-433d-b197-21b92e76f272`** was verified through actual public HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-02T21:25:16Z**, public build `1793654239455`. The site serves `DeepClaimPage-DZQoGmx6.js` and `DeepClaimPage-DRvcj9I5.css` with the new concise/inline guide, six-stage identities, Keep choice, completion screen and rewritten opening dialogue. Public CSS SHA256 **`ce22eb84242eb3b05e271e4e865498ed31a91ba3b381404be821d378e6676e74`** exactly matches the tested build. Both original atlas SHA values remain unchanged. Lovable rebuilds JavaScript, so local/hosted JavaScript equality is not claimed. The timestamp is a build ID, not a Git SHA; source synchronization and public content were checked separately. The proof is `/tmp/dc-tutorial-public-proof/proof.json`.

This release receipt is recorded in a documentation-only follow-up. No SQL deployment is required or claimed. Production asset verification does not claim authenticated live player testing, physical-device installation or subjective hardware/audio QA.

## Previous release — illustrated inventory and operational menus

This presentation release builds on clean main `02d0820e1c65cf849f00bce51efd49c0fca87ec1`. It preserves the publisher opening, all economic rules, server operations, saved progress and both original atlases. No migration, dependency or new economic authority is introduced.

- The warehouse now presents six illustrated item slots at a time, with category browsing, quantity badges, current prices and a large-art inspector. Item uses come from the actual recipe catalog. Selling still opens the existing confirmed transaction; no selection, inspection or page navigation spends stock. Staged cargo remains accessible.
- Research uses persisted start/end times and the existing server-synced clock for its percentage gauge. A full elapsed bar explicitly awaits the completion report; only a fresh authoritative snapshot establishes completion and bonuses. Prerequisites, collected inputs, contracts, milestones and company development have distinct progress displays.
- Workshop recipes and work orders lead with their real resource/equipment artwork. Production distinguishes queued, working, elapsed-awaiting-confirmation and server-ready output. Input-to-output reviews preserve bounded batches, costs, station requirements and collection safeguards.
- Employees, applicants, equipped slots and equipment conditions gain larger framed artwork and actual energy/skill/durability displays. Settings retain their existing controls, now grouped visually with real volume-track fills. Camp-building menus reuse static renders of the same owned building and level shown in the settlement, including actual unbuilt plots.
- Shared recessed gauges, tactile selectors, material sale shortcuts and illustrated building reviews finish the existing menu system. Review headers, actions and transaction totals remain visible while the keyboard-focusable detail panel scrolls. Atlas redraw subscriptions are bounded and cleaned up; building portraits have no animation loop. Reduced motion, focus, safe-area controls and the existing mobile shell remain in place.

Implementation lives in the existing Business, Industry, Workforce, Settings, Primitives and Page modules, plus the extracted `DeepClaimInventory.tsx`, five scoped menu stylesheets and `renderer/DeepClaimBuildingPortrait.tsx`. Focused inventory, research and production tests cover inspection/sale handoff, protected state, schema-safe pagination and the distinction between elapsed time and confirmed completion. The old schema-compatibility UI test now browses the actual inventory pages instead of requiring every item to be mounted simultaneously.

| Verification | Evidence |
|---|---|
| Final unit suite | All 210 files / 2,118 tests passed in 134.35 seconds with two workers; `/tmp/dc-menus-unit-final-quotes.log`. Inventory includes keyboard-focus and guarded sale handoff; research/production cover elapsed versus confirmed completion. |
| Browser/menu matrix | All 438 checks passed with zero assertion/runtime errors; `/tmp/deep-claim-PYWSBp/report.json`. Real earned inventory, research, production, worn gear, settings and existing founding/crafting/business flows cover 320px phone, 844px landscape and 1440px desktop in both themes, plus reduced motion. |
| Final fixed-cost review | All 50 additional checks passed; `/tmp/deep-claim-XDiCg8/report.json`. Seven layouts retain actual upgrade, sale and batch totals/actions while keyboard PageDown scrolls the details. Inspection and review preserve the earned economic snapshot. Final phone and landscape screenshots were visually reviewed. |
| Application/source gates | Explicit application-project TypeScript, scoped ESLint, browser script syntax and the 27-source Phase 8 preservation gate passed. No rule, catalog, migration, atlas or dependency rewrite occurred. |
| Final production build | Passed in 21.36 seconds: `DeepClaimPage-DCbOS1Hi.js` 765.39 KB / 182.91 KB gzip; `DeepClaimPage-BaeKGdps.css` 184.80 KB / 30.51 KB gzip. The existing large-chunk advisory remains. |
| Final built PWA | All 12 checks passed with zero assertion/runtime errors; `/tmp/deep-claim-pwa-jOrnFp/report.json`. Chromium was not in standalone display mode. |

The final full suite includes an existing Afterimage navigation assertion corrected to await the final URL rather than the earlier toast; the expected destination and game behavior remain unchanged. A new production-collection test mock was corrected to honor its asynchronous callback contract before the passing final runs. The workspace connection interruption did not require rebuilding the implementation or changing production data.

The 23-file feature was pushed normally to main as `2fae25968f18726427543d88964763e8fe2a3375`, tree `3c2404289c007e9fd15d6b2cbdc1603f62d47300`, from the expected `02d0820e` parent without force updates or protection bypass. Every uploaded blob and the final tree matched the tested workspace; main readback matched and the local import was clean. Lovable reported that exact commit ready with no project error before publication.

Deployment `b18363f1-084e-4c4f-9d2f-a4367c42105d` was verified through actual public HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-02T20:00:53Z**, public build `1793649586476`. It serves `DeepClaimPage-C91Jc_A3.js` and `DeepClaimPage-BaeKGdps.css`, including the new inventory, research, work-order, gear, building and fixed-detail/footer markers. Public CSS SHA256 `85beacdb115c5b9a55f3b3b68f062039af87e55c2bd435933d93e67f2a10d4dd` exactly matches the final tested build. Both original atlas SHA values remain unchanged. Hosted JavaScript was rebuilt by Lovable, so equality with the local JavaScript hash is not claimed. The build timestamp is not a Git SHA; source synchronization and actual public assets were verified separately. The proof is `/tmp/dc-menus-public-proof/proof.json`.

This receipt is recorded in a follow-up documentation-only commit. No database application is required or claimed. Physical-device installation and subjective audio/performance review remain unverified by these cloud checks.

## Previous release — DH Games publisher opening

This presentation-only release builds on clean main `85e9635f9fb21f693c3a1683bd489f0b35c60038`. It introduces an original, reusable DH Games SVG identity and publisher card, integrated into Deep Claim's authorized title entry. No SQL, economic rules, company data, installation gates, dependencies or atlas bytes change.

- The original ivory DH monogram, brass detail and custom geometric wordmark reveal for 600ms, hold for 2,400ms and fade over 1,800ms into the actual animated menu. Skip, Enter, Space and Escape enter the menu immediately. Reduced motion uses a static 1,200ms card and immediate transition.
- The opening runs once per route entry, including across temporary authentication/loading gates. Returning to the title within the game does not replay it. Recognized Office notifications and club-mismatch notices bypass the card. It never creates a company or starts/unlocks audio.
- The menu remains inert and hidden from assistive technology until the card exits, then receives keyboard focus. Timers use a monotonic deadline, reconcile background/resume events and clean up on exit. The existing title Canvas starts during the crossfade; no additional render loop, external artwork or network request is introduced.

The implementation comprises `src/components/games/{DHGamesLogo,DHGamesIntro}.tsx`, `publisherIntroTiming.ts`, `dhGamesIntro.css` and the existing `DeepClaimPage.tsx` shell. Regression coverage is in `dhGamesIntro.test.tsx`, `deepClaimUI.test.tsx`, the shared tutorial fixture and the `publisher` browser section, included in the standard browser command. Original artwork dimensions and ownership are recorded in the asset specification.

| Verification | Current evidence |
|---|---|
| Publisher and shell tests | All 18 intro and 19 Deep Claim Page tests passed, including exact timing, skipping, reduced motion, StrictMode, background/resume, inert/focus, no startup audio and no replay across transient loading. |
| Browser proof | All 86 publisher/menu checks passed with zero assertion/runtime errors; `/tmp/deep-claim-IoIk2K/report.json`. Actual logo and crossfade screenshots were reviewed at 320px phone and 1440px desktop; landscape/light and reduced-motion cases also passed. |
| Source checks | Application TypeScript and scoped ESLint passed with zero errors/warnings. The Phase 8 gate preserved all 27 protected source fingerprints and both atlases; browser harness syntax passed. |
| Production build | Passed in 22.64 seconds: `DeepClaimPage-DCor-ekn.js` 751.28 KB / 179.31 KB gzip; `DeepClaimPage-D0eMhcWc.css` 141.23 KB / 24.36 KB gzip. The existing large-chunk advisory remains. |
| Production PWA | All 12 checks passed with zero assertion/runtime errors; `/tmp/deep-claim-pwa-yxq9Bk/report.json`. Chromium did not report standalone display mode. |
| Final full suite | All 207 files / 2,105 tests passed with two workers in 140.64 seconds; `/tmp/dh-games-full-unit-final.log`. Final application typechecking and scoped ESLint also passed after the test synchronization changes. |

Two initial full-suite runs each passed 2,104/2,105 tests, with different existing asynchronous assertion races. Test-only corrections now settle the Drop's mocked initial channel selection before sending and await Showdown's completed navigation. The original retry-identity and destination assertions remain intact; production Drop/Showdown code is unchanged. The isolated 12-test regression run and final full suite both passed.

The 13-file feature was pushed normally to main as `f5a84b28076fbb306da8ac07179c21711c352cd0`, tree `982ebeec241de51b076aca9ed5c7154e49864cf7`, from the expected `85e9635f` parent without force updates or protection bypass. All uploaded blobs and the tree matched the tested workspace; main readback matched and the local import was clean. Lovable reported that exact feature commit ready with no project error before publication.

Deployment `846c3b1c-d1d8-416e-a041-9789a02531a2` was verified through actual public HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-02T16:42:56Z**, public build `1793634401966`. It serves `DeepClaimPage-CHravQn-.js` and `DeepClaimPage-D0eMhcWc.css`, with the DH Games logo, intro and Skip markers. Public CSS SHA256 `4b39490663a0e9936311eeeaef0512e984151d4f57bb845fb3da12a3dafd90bc` exactly matches the tested build; both atlas SHA values remain unchanged. Hosted JavaScript was rebuilt by Lovable, so equality with the local JavaScript hash is not claimed. The public build timestamp is not a Git SHA; exact source synchronization and public assets were checked separately. The proof is `/tmp/dh-publisher-public-proof/proof.json`.

This receipt is recorded in a follow-up documentation-only commit. No migration is required or claimed. Physical-device installation and subjective audio review remain outside these cloud checks.

## Previous release — tactile visual refinement

This presentation pass builds on clean published main `c2e4cf57`. **Implementation, final verification and production publication are complete.** No gameplay, persistence, hooks, SQL, authentication, economy or dependencies change, and neither atlas is rebaked. No new migration or additional SQL/native run is required for this presentation-only release; saved progress is preserved.

- Compact menu badges and one Skip action reduce competing text. Tactile buttons, six original 24px navigation emblems, a stock HUD bar and artwork for actual rewards strengthen the existing game shell.
- Seven selectable worker-skill tiles show one explanation at a time. Shorter crew/Office/Club copy and compact dispatch facts retain visible costs, energy, storage, risk, privacy and irreversible-decision information before confirmation.
- The Training Journal gains visual reference layouts, native field-note disclosures and shorter copy. The retained Field Guide gains progress and clearer footers; tutorial identities, observations and economic authority remain unchanged.

| Verification | Current evidence |
|---|---|
| Focused checks | Menu 16, tutorial UI 21 and gameplay-panel 102 tests passed; the 27-file Phase 8 preservation gate and an implementation application typecheck passed. |
| Browser proof | All 373 checks passed with zero assertion/runtime errors; `/tmp/deep-claim-Ii1Fc6/report.json`. Presentation and menu cover 320px phone, 844px landscape and 1440px desktop in both themes, plus 390px dark/reduced motion. |
| Final source checks | All 206 files / 2,084 tests passed with two workers; application typechecking passed with zero errors; scoped ESLint passed with zero errors/warnings. The final 27-file Phase 8 preservation check passed. |
| Final production build | Passed in 18.43 seconds: `DeepClaimPage-BX74XRLq.js` 744.99 KB / 177.13 KB gzip; `DeepClaimPage-MPp4Aqfu.css` 138.38 KB / 23.74 KB gzip. |
| PWA smoke | All 12 checks passed with zero assertion/runtime errors; `/tmp/deep-claim-pwa-olB05J/report.json`. Chromium was not in standalone display mode. |

The passing browser run includes the actual twelve-chapter campaign with its authoritative thirty-second induction, reload, second device, saved-action recovery and save protection, plus thirty read-only academy reviews without economic changes. Guide, Journal, Dialogue and Practice footers retain visible forty-four-pixel targets and pass native hit tests. Physical-device installation and subjective audio quality are not established by these cloud checks.

The 28-file feature was pushed normally to main as `1c2c8e8f7df300ec8d5079599d0959d1b31ef9d5`, tree `ae95eac4a60e6edddcb7f8b48d07a77a0761f2c8`, using the expected `c2e4cf57` parent without force updates. Exact local blobs/tree and push readback matched; workspace import was clean. Lovable reported that exact commit ready with no project error.

Deployment `1689b38a-8287-45cb-806c-1dadfcd72b51` was verified through actual HTTPS at **https://dhbracketclub.lovable.app/** on **2026-11-02T14:57:30Z**, public build `1793631302037`. It serves `DeepClaimPage-w_Vc9frJ.js` and `DeepClaimPage-MPp4Aqfu.css` with the new navigation, HUD, skill tiles, guide and field-note markers. Public CSS SHA256 `6594a155d35d7c98c5b4917ea3eb4584036c0491eb5c3f7dcbe1867cd90a6ded` exactly matches the tested local CSS; both atlas SHA values remain unchanged. Hosted JavaScript differs from local `BX74XRLq` because Lovable rebuilt it; matching JavaScript hashes are not claimed. This receipt is captured in a follow-up documentation-only commit, not the feature commit, without predicting its own SHA.

## Menu/tutorial release record — cinematic menu, Gus and the Training Journal

This implementation builds on main `94a4334b39626fb31365fb5d47753c1946dcfc94`. Implementation, final local verification, production application of `0800` and public publication are complete. The feature is main commit `52a5308ef57058093e42aace838caf861eaedba6`; this production receipt is recorded in a follow-up documentation-only commit, whose own future SHA is not predicted here. Earlier release records remain historical.

### Implemented slice and preservation boundary

- Normal authorized entry opens a save-aware title with Continue, New Game, Tutorial & Field Guide, Settings and Return to DH Club. Continue never bootstraps. Existing-company New Game preserves the save and offers safe continuation/replay. A new owner reviews the name/deed before the existing real bootstrap action; valid current-club notification destinations remain actionable.
- The title is original illustrative pixel artwork, independent of the player's map or hidden seed. It uses existing painters, bounded cached Canvas layers and an SVG fallback. Four narrative identities include Gus and the established Mara/Ivo/Tessa voices, with six portrait-expression states. Gus is an optional adviser, never an economic employee record.
- Twelve beginner and thirty advanced lessons use **42 lesson IDs, 84 step IDs and 67 dialogue-line IDs**. The original once-per-company thirty-second induction remains intact. Actual owned workers, subviews, server quotes, paid-action results and positive transfers feed scoped learning observations. Read-only review cannot establish a paid action or award resources; stale nested views and deliberate same-action review transitions have separate regressions.
- The Prospector's Training Journal has independent company-scoped educational state, resume/replay/skip, commentary preference, contextual help, manual Ask Gus and safe alternatives. The original paged Field Guide remains available. Advice uses disclosed company data; no tutorial chooses a discovery outcome, changes sharing consent, contributes materials or alters DH Score.
- Help and Ask Gus share existing dialog headings/navigation rows instead of adding fixed-height rows. All controls retain forty-four-pixel targets; narrow screens use Gus's existing portrait and an accessible label. Office/Club bodies shrink and scroll above their fixed footer. Confirming a recovered economic action through Sync returns to the game and its real receipt, including actions recovered from the title.
- Snapshot schema five, field rules seven, generation four, production configuration four, all eight previously applied migration sources, economic catalogs and both authored atlases remain unchanged. The additive journal creates two private tables and two member RPCs, preserving all **153 old critical function bodies/OIDs/security metadata** and the **33 old table-row multisets**, including company revisions. The intended postcondition is **161 critical functions, 27 member DC RPCs and 35 private RLS tables**, with no private Realtime publication.

### Changed modules

The Page and `DeepClaimTutorialDirector` orchestrate entry, real navigation, dialogue and confirmed observations. New menu/tutorial modules live under `src/components/deepClaim/{menu,tutorial}/`; data-driven rules/content live under `src/lib/deepClaim/tutorial/`, with `useDeepClaimTutorial.ts` handling the separate timeout-protected query, bounded educational queue and revision conflicts. Existing gameplay components expose explicit targets and default-noop UI event hooks. Auth cleanup covers the educational pending-note/deed-draft namespaces; sound and visual preferences keep their original storage.

The new SQL is `supabase/migrations/20261102080000_deep_claim_training_journal.sql`, SHA256 `787670491647a61f49ad967a980acf6805255c7ecbbc29c5d0b253699c81a670`, MD5 `8cdd87f5834c5bfaf91a7089f059b637`. `scripts/lib/deep-claim-training-release.mjs` constructs the exact-source guarded transaction without connecting to production. Dedicated SQL/native fixtures extend the established harnesses rather than replacing old gameplay proofs. See [menu/tutorial architecture](DEEP_CLAIM_MENU_TUTORIAL.md), [protocol](DEEP_CLAIM_PROTOCOL.md) and [native QA](DEEP_CLAIM_NATIVE_QA.md).

### Verification checkpoint — all local release gates passed

| Gate | Evidence currently recorded | Final release status |
|---|---|---|
| Unit/component regression | The final full run passed all 206 files and 2,079 tests with `--maxWorkers=2`; log `/tmp/deep-claim-menu-unit-final.log`. All 25 tutorial-integration tests passed, and the 16-test recovery/UI suite passed again after the type-correct test-regex refinement. | Passed. |
| Retained gameplay/Feats SQL | All 158 core groups, 19 actual Feats integration groups and 14 native core groups passed. | Passed. |
| Educational SQL | Twenty extension groups passed in the current runtime, preserving all 153 old critical function bodies and all old rows while verifying the new whitelist, ACL, revision, rollback and receipt rules. | Passed. |
| Native journal concurrency/release | Fourteen groups passed on fresh PostgreSQL 17.11 with eight pooled connections, including rollback, concurrency and the exact guarded release. | Passed; the exact native-tested transaction was subsequently applied successfully to production. |
| Headless balance | The retained 210 scenarios and 648 Ancient Deep cases passed. | Passed; economic rules remain unchanged. |
| Browser regression | All twelve sections are covered by explicit passing section runs: 477 distinct passing labels across 619 observations, with zero runtime errors. Campaign covers all twelve chapters without skips and the real thirty-second induction, reload/fresh device, help, advice and menu continuation; academy covers thirty lessons without economic or practical-progress changes. | Passed across the recorded section runs; this is not a claim that one uninterrupted run passed. |
| Production-build PWA browser smoke | All 12 checks passed with zero assertion/runtime errors against the final local production build; `/tmp/deep-claim-pwa-2Rz19k/report.json`. Chromium was not in standalone display mode. | Passed within the stated cloud-browser boundary. |
| TypeScript and scoped lint | Final application typechecking passed without errors. Scoped ESLint reported zero errors and one pre-existing AuthContext line-20 Fast Refresh warning. | Passed with the existing warning recorded. |
| Source/art preservation | Phase 8 preservation passed for 27 files; both atlas compilers passed `--check`. | Passed. |
| Production build | Final build passed in 17.99 seconds: `DeepClaimPage-BMcgtOuh.js` 737.16 KB / 175.31 KB gzip; `DeepClaimPage-BXiDjE5L.css` 105.32 KB / 18.07 KB gzip. | Passed; these bundle metrics are not a hardware-performance claim. |

The current-runtime educational SQL proof is recorded in `/tmp/deep-claim-menu-db-tutorial.log`. The native-tested release SQL is **101,153 bytes**, SHA256 `143ab335dabda0431015a1b9ad8a08561693d0c4171f3dfb40061f0d5fa5df46`, MD5 `b74129b41103204aa2ba0d05755726cc`. The exact transaction preserved the old function OIDs/security metadata and thirty-three old private table-row multisets, and established the fixture's intended `161/27/35` postcondition. The same tested transaction was subsequently applied successfully to production, with its independent postflight recorded below.

The consolidated browser record is `/tmp/deep-claim-menu-browser-evidence.json`. The first seven retained sections passed 209 checks in `/tmp/deep-claim-S9IBSW/report.json` before its later social-layout failure. After that correction, the final four social/runtime/deep/menu sections passed all 213 checks in `/tmp/deep-claim-tHDr82/report.json`; the latest presentation section passed 135 checks in `/tmp/deep-claim-1zt3Jk/report.json`. The campaign's 27-check section is in `/tmp/deep-claim-0LgREP/report.json`, and the corrected academy's 35-check section is in `/tmp/deep-claim-Yl3Pqu/report.json`. The consolidated distinct-label/observation counts account for overlaps across these explicit runs; the failed partial run is not presented as wholly passing.

The runtime restoration retained source but not the earlier temporary logs. Restoring files does not constitute a rerun; the passing gates above reflect fresh recorded runs. Remaining results must be recorded from actual completed commands, with native/PGlite/browser/physical-device evidence distinguished. No production QA account, fabricated company or invented reward is needed for these gates.

### Migration and publication record — production verified

| Release evidence | Current state |
|---|---|
| Reviewed original `0800` source | Applied successfully with SHA256 `787670491647a61f49ad967a980acf6805255c7ecbbc29c5d0b253699c81a670` and MD5 `8cdd87f5834c5bfaf91a7089f059b637`; history records the one exact original source. |
| Final source checks and production build | Final unit/typecheck/lint/build/PWA gates, all browser sections, SQL/native proofs, headless balance and source/atlas preservation passed as recorded above. |
| Guarded native release transaction | The exact native-tested 101,153-byte transaction returned `ok` with 161 critical functions, 27 member RPCs and 35 private RLS tables. |
| Production preflight and locked live-row capture | All 153 prior function bodies and all eight prior sources were verified. Locked old table-row multisets, including company revisions, were preserved exactly; all 219 awards and the fingerprint of all 51 installations remain unchanged. |
| Applied migration/history and independent postflight | Independent read-only verification matches 161/161 expected critical bodies, 146 DC functions, 27 exact member signatures, 35 private RLS tables and all nine original migration-history sources. |
| Main commit and verified push SHA | `52a5308ef57058093e42aace838caf861eaedba6`, tree `f05bd39fc33a36c220aff95ba88429a30503c3d9`; normal main update from `94a4334b39626fb31365fb5d47753c1946dcfc94`, with no force update or protection bypass. All 80 feature files matched the local blobs/tree; workspace import was clean. |
| Exact Lovable synchronization and public-site verification | Lovable reported exact feature commit `52a5308ef57058093e42aace838caf861eaedba6`, ready with no project error. Actual public HTTPS assets were verified after publishing, as detailed below. |

The independent production postflight additionally confirms zero direct anonymous/member CRUD on private DC tables, zero anonymous DC execution, full expected service access, no private Realtime publication, both educational guard triggers and the exact **42 lesson / 84 step / 67 dialogue-line** registry. All nine source-history records and the `0800` SHA match their original files. The old thirty-three table-row multisets and 153 prior functions remain exact; 219 earned awards, 89 Feat definitions and all 51 installation choices retain their verified preservation boundary. The migration seeded **zero tutorial progress/request records**. No live QA player, fabricated company, paid game action or invented reward was created.

Publishing used the existing Lovable deployment service, deployment `38606056-748e-4a5c-a4a6-02a73f8d6f6b`. Its initial pending response was followed by direct HTTPS verification of **https://dhbracketclub.lovable.app/** at **2026-11-02T14:11:08Z**. Public build record `1793628128268` served `DeepClaimPage-B8LRV895.js` and `DeepClaimPage-BXiDjE5L.css`, including the title/Gus, journal RPC and read-only practice markers; both atlas SHA values matched the tested files. The hosted JavaScript bundle name differs from the local build because Lovable rebuilt it; no equality of those JavaScript hashes is claimed. The build record is a timestamp identifier, not a Git commit SHA. Exact Lovable commit synchronization and actual public assets were verified separately rather than treating a ready preview as publication evidence.

This ledger receipt belongs to a follow-up documentation-only main commit. Physical Android/iOS PWA installation, real OS interruption/push and subjective audio review remain unverified in this cloud environment.

## Phase 7 release record — Ancient Deep operations

This expansion builds on published main `e2498e9a313a7d26c1b3eb4da6dbbf6548af42e9`, whose exact Lovable preview synchronization was verified. The playable slice, local verification, production migration and public-site publication are complete. The evidence below distinguishes local authenticated gameplay tests from read-only production verification.

### Implemented slice and boundaries

- Shaft six extends supported work to 999 metres and the actual constructed corridor to 956. It costs 24,000 company credits and requires the existing Deep Cutting Systems research. The powered lift discounts only known, excavated central-shaft route edges; branches retain their ordinary cost. Existing twenty/sixty/180-minute shifts, wages and energy remain.
- Ancient Deep mining has a deterministic, quoted heat productivity penalty. Actual effective Engineering, the strongest installed covering ventilation and working heat shields mitigate it. Useful extraction time or the exploration quota scales exactly once; elapsed work stages stay unchanged. Surveys and infrastructure remain available for preparation. No incident destroys cargo or kills staff.
- Finite nickel and sulfur deposits, nickel-alloy smelting and a specialized head-slot heat shield add three goods, two recipes and one equipment definition. These use the existing paid production/repair pipeline. Heat protection remains useful at the ordinary statistic cap. Existing research, contracts, company milestones, club pools and Feat definitions retain their original values.
- Snapshot five adds a separate public deep catalog and operations summary; older schemas remain readable. Field rules seven, generation four and production configuration four have distinct roles. The seven prior migration files and five prior canonical catalogs remain unchanged. Existing generation metadata wins, including unseen cells in the 576–607-metre chunk; new geology starts only in previously absent chunks from 608 metres.
- Known-ground depth navigation, preserved legal worksites, memoized target scans, explicit review focus and high-contrast states extend the existing menus. An independently loaded authored sprite add-on and sixth original music arrangement distinguish the revealed deep region. The original atlas, metadata and five earlier arrangements remain preserved.

### Changed modules

`src/lib/deepClaim/deepOperations.ts` holds the pure lift/heat calculation beside the extended catalog, types, world, simulation, production and social-value modules. Existing Page, dispatch, field, industry, building, workforce and settings components expose those authoritative capabilities. Renderer changes live in `ancientArt.ts`, `ancientAtlas.ts` and the existing Canvas/painter/icon modules; `audioScore.ts` adds the sixth arrangement. `art/deep-claim/v1-source` archives the exact original compiler inputs, while `pack-v2.json`, its compiler and `public/deep-claim/atlas-v2.png` form the independent add-on.

The SQL source and canonical content are `supabase/migrations/20261102070000_deep_claim_ancient_deep.sql` and `supabase/seed/deep-claim-phase7-catalog.json`. Scoped unit, SQL, Feats, balance, browser and production-PWA harnesses verify the slice. `scripts/lib/deep-claim-release.mjs`, the guarded native adapter and native runner provide independently tested cutover construction and concurrency/rollback evidence. Existing authentication, club installation, global score and notification systems retain their ownership boundaries.

### Verification and migration status

- All **158 core database groups** and **19 actual DH Feats/inbox integration groups** passed. The composed backend matches **153 exact function bodies**, including all fifteen unchanged critical non-DC functions. The seven previous migration sources and five older canonical catalogs remain unchanged.
- A disposable, marker-verified local PostgreSQL **17.11** instance passed **14 real multi-connection groups** using eight connections: overlapping sessions, exact bootstrap/dispatch/collection/upgrade retry, migration waiting for a company lock with legacy state preserved, mixed old/new completion, finite competing sales and role boundaries. A deliberately wrong release postcondition rolled back schema, data and migration history. The valid release transaction passed under contention and a repeat application was rejected. This adds native concurrency evidence to the PGlite suites; it does not establish exhaustive deadlock freedom or physical-device behavior. See [native QA](DEEP_CLAIM_NATIVE_QA.md).
- Full unit/component suite: **200 files, 1,957 tests passed**, run alone in 79.71 seconds. Scoped ESLint passed for **65 changed TypeScript/TSX/MJS files**. The final production build passed in **14.50 seconds**, including the opaque system-color correction. The original atlas, independent add-on and Phase 7 source-preservation checks passed.
- The headless balance runner passed the existing **210 scenarios** and **648 Ancient Deep depth/loadout/protection cases**. It verifies finite deposits and the 23-credit alloy processing margin. At 999 metres, an already paid one-worker standard-shift setup with the existing steel tool/cargo harness extracts ten nickel with the iron helmet, twelve with the heat shield and fourteen with shield plus installed ventilation; each remains one elapsed hour and six credits in wages. Those conditional cases show useful specialization, not a claimed universal progression time.
- The final focused Ancient Deep browser journey passed **37 checks** against the actual Page/hooks and local authoritative SQL functions. It pays for research and shaft six, mines finite nickel and sulfur, smelts three alloys, crafts/equips/wears/repairs the shield, survives a lost production acknowledgement and reload, and checks phone/landscape quotes, forced colors and add-on failure recovery. Its final high-contrast assertions verify opaque system-colored surfaces, readable headings/instructions and a 21:1 primary-button contrast. Finite CSS transitions settle before measurement; the browser's translucent Highlight color is not used as the primary background. Late-game preconditions are explicitly labeled local fixtures, with zero initial new goods. No production player data is created for QA.

`20261102070000_deep_claim_ancient_deep.sql` is additive and was applied to production on 2026-11-02 through the exact native-tested release transaction. It introduces no new public RPC or private table: the verified boundaries remain twenty-five member RPCs and thirty-three private RLS tables. Thirteen existing function bodies change and twenty private helpers/aliases are added. The cutover verified preservation of old jobs, private plans, receipts, installations and dynamic earned awards.

The initial read-only production preflight matched all 133 baseline function bodies and the original ACL/catalog/privacy boundaries. One real company and 218 earned awards existed at that observation; these are legitimate player data, not QA records. Cutover must capture current data under its transaction locks rather than assume the older zero-company/216-award counts. No live test account or invented reward is authorized or needed.

### Remaining work and scope

The complete ten-section browser regression passed **361 checks (355 unique labels)** with no assertion or runtime errors. The actual application typecheck (`npx tsc --noEmit -p tsconfig.app.json`) passed. A production-build PWA smoke passed **12 checks** against real local Chromium: protected deep-link startup, declared viewport/manifest/icon dimensions, native push-worker registration, zero notification-permission requests and no response cache or horizontal overflow. Headless Chromium began with notification permission denied; a native forwarding probe counts requests without inventing permission state. It did not run in standalone display mode. The focused 37-check rerun adds two explicit high-contrast assertions to the complete regression, for 357 unique passing labels across the runs. Publication and production migration evidence are recorded below. The shipped region is bounded at 999 metres; 1,000-metre-plus content, automated industry, trading and an expanded lifetime museum remain future extensions. Physical Android/iOS installation, OS background interruption and subjective audio review are unavailable in this cloud environment. Production PWA smoke tests describe the actual local build and the existing push-only worker; cold offline launch or real push delivery is not implied.

### Production cutover and publication

- The tested 87-file source was pushed normally to main as `4a5b2f6215f63e98a2f69107675c971c7c7f16f1`, with tree `c42989f7799966b0e808f824ac14d8a1772e8dae`. GitHub and Lovable both reported that exact commit, with Lovable ready and no project error. No force update or protection bypass was used.
- Public publishing was requested through the existing Lovable deployment service. Before any schema change, direct HTTPS verification of **https://dhbracketclub.lovable.app/** confirmed the actual Phase 7 lazy gameplay bundle (`DeepClaimPage-B7VmtHLQ.js`), final high-contrast stylesheet (`DeepClaimPage-BlcJn-KS.css`), original atlas and new add-on. Both PNG SHA-256 values match the tested files. The public version record was build `1793584013751`; it is a build timestamp, not a Git commit identifier. A ready preview alone was not used as production evidence.
- The exact original migration source was applied in one transaction with baseline/authorization/history preflight, locked live-row fingerprints, original generation pinning, postconditions and a single source-history receipt. Source SHA-256 is `ed112cdd427b1760290c79ebf991d91e0a9ba914c4d221548a0e0553ac7fee24`; recorded source MD5 is `3dc6956119c2292d17a79b2f6550e1ef`. All seven previous migration sources were verified inside the transaction.
- The release returned `ok`, authorization and existing-row preservation. It preserved **one real company, all 219 earned achievement records and all 51 installation choices**. The earlier 218-award count describes the non-Deep-Claim awards; those retain their exact fingerprint. The complete live data was captured dynamically rather than using historic empty-company assumptions. No production QA account, company, invented reward or simulated expedition was created.
- Independent read-only postflight matches **153/153 expected critical function bodies**, **138 DC functions**, exactly **25 member RPCs**, **33 private RLS tables**, anonymous/member direct-data denial, service access, old catalogs and Feat definitions, zero private Realtime tables, the new canonical catalog and one exact-source 0700 history record. Only the intended thirteen existing functions changed; twenty private functions were added and the fifteen selected non-DC critical bodies remain unchanged.
- This ledger is updated in a subsequent documentation-only main commit. Its final SHA is reported to the owner rather than predicting the document's own future commit hash. Physical-device installation, authentic OS background/push behavior and subjective audio quality remain unverified; the actual game flow was tested against isolated authoritative migrations, not by impersonating a live member. The next implementation slice should extend the 1,000-metre frontier and deeper logistics while preserving these frozen version boundaries; physical Android/iOS review remains recommended alongside it.

## Phase 6 release record — original presentation and runtime polish

Phase 6 was published to main as `e2498e9a313a7d26c1b3eb4da6dbbf6548af42e9`, building on `e2df6d9f67a02b87280eb48897e7d165143b5577`. It is a presentation release: private snapshot schema four, field rules three, business catalog four, social catalog five and all seven applied migrations remain unchanged. Original authored sprite frames and composed Web Audio arrangements are versioned independently of the authoritative game. Exact GitHub/Lovable preview synchronization was verified.

### Working presentation slice

- Original Frontier Pixel Pack v1 is editable and reproducible from its JSON/source painters through a dependency-free offline compiler. Its committed 1,024×800 PNG contains 454 unique pixel rectangles addressed by 2,255 frame references, including building levels, worker role/appearance/poses, mineral veins, known formations, infrastructure and recovered specimens. It is 30,335 bytes compressed and 3,276,800 bytes decoded. Actual assigned equipment and production overlays retain their public-state inputs. Loading is observable and bounded; failed/late decoding retains the working painter fallback and operational controls.
- Five original sixteen-bar arrangements cover the surface and four underground contexts. Regional ambience, five material timbre families and restrained receipt/dispatch cues use existing global sound categories and independent master/music/ambient/effect controls. Old account preferences remain compatible. Audio remains opt-in, with fourteen simultaneous voices, bounded lookahead, hidden/menu pausing and tested resume/disposal races. A per-controller ownership lease survives React effect replay and still disposes after a real unmount or identity switch.
- Compact Sound, Visuals and Updates tabs and a paged field guide replace the long Settings stack. Portaled dialogs respect safe-area bounds, focus their heading and restore a connected opener. Explicit view transitions and tactile controls honor reduced motion. A centered, source-confirmed rare-find reveal keeps every keep/sell/salvage decision manual; scoped presentation receipts suppress old or repeated reveals and never award resources.
- Rendering reuses unchanged public map branches, indexes and path geometry rather than rebuilding them on each clock-only refresh or frame. A sleeping timer and display-aligned RAF target thirty paints per second, or twelve in reduced graphics. The `scheduled_wakeups` diagnostic counts RAF callbacks; one sleeping timer also precedes each steady paint. Hidden, inactive and dialog-covered scenes cancel their scheduler. Reduced motion suppresses continuous animation while explicit crew focus still uses elapsed server-derived position. Optional aggregate diagnostics contain no hidden world or reward-plan data.

### Changed files and boundaries

Production changes are confined to `src/lib/deepClaim/{audio,audioScore,service,world,visualProjection}.ts`, the existing Deep Claim Page/Settings/Primitives/styles and renderer, plus the scoped discovery-reveal helper. Editable artwork lives in `art/deep-claim`, its shipped PNG in `public/deep-claim` and frame metadata in the renderer's generated directory. No dependency, unrelated game, authentication, club installation, economy catalog, DH ledger or notification service is replaced.

Verification extends the existing browser runner with a ninth runtime section and a separately labeled synthetic public-renderer fixture, adds atlas/presentation/runtime tests and strengthens the existing audio/renderer tests. `scripts/build-deep-claim-atlas.mjs --check` proves reproducibility. `scripts/check-deep-claim-presentation.mjs` verifies eighteen immutable gameplay sources plus PNG, frame and memory/download budgets. All five working documents and the CLAUDE index reflect the delivered boundaries.

### Verification evidence

- Full unit/component suite: **197 files, 1,910 tests passed**, run alone in 74.91 seconds. Coverage includes atlas lifecycle/coverage, real source-driven equipment layers, controller ownership and audio races, immutable sharing, fractional/stale-clock scheduling, reveal privacy/history, focus and project reading order. Earlier failed evidence is retained: an old notification test was updated to open the actual Updates tab; product cadence and short-phone title issues were corrected and received regressions.
- All **131 existing database groups** and **15 real DH Feats/inbox integration groups** passed. The composed integration still matches 133 expected backend bodies. The headless suite preserves **210 mining scenarios and eighteen one/two/three-member project partitions**, finite inputs, cargo conservation, reserve protection and once-only claims.
- Reproducible atlas and the eighteen-source preservation gate passed. The gate also checks PNG bounds/inflate size and the 256-KiB download, 8-MiB base decoded image and 4,096-reference limits. The actual pack remains 30,335 bytes and 3,276,800 base RGBA bytes; it introduces no dependency or runtime asset-generation request.
- The new native/runtime browser section passed **47 checks** with no errors. It verifies real image decoding and failed-network fallback, gesture-only native Web Audio, reload/route disposal, independent mix controls, touch/pinch/cancel/wheel, keyboard, focus and DPR-two portrait/landscape layouts. Hidden-page handling used an explicitly recorded simulated visibility-change fallback because headless Chromium exposed both tabs as visible; this exercises the actual native context and renderer handlers without claiming a real device app switch.
- A separate, clearly labeled synthetic public geometry fixture renders 57,504 test cells without changing a company's world or economy. The focused viewport draws 1,908 cells in six of fifty-seven chunks and retains one public index. Reduced mode records fifteen paints/fifteen RAF callbacks in about 1.25 seconds. The 64-sample dense headless draw measured p50 2.6 ms, p95 4.1 ms and maximum 7.7 ms. These values describe the measured desktop browser and synthetic scene, not a physical phone or total JavaScript/battery budget.
- Browser regression: **325 unique passing checks across nine functional sections in split runs**, with no selected failed assertion or runtime error. The seven original pre-social journeys passed 208 checks; the corrected social layouts and genuine three-company earned-contribution/privacy/claim journey passed 77; native runtime passed 47. Seven duplicate labels are counted once. The social rerun explicitly selects Later for two real earned rare-find presentations; it never resolves their pending specimens automatically. All five phone/landscape/desktop, light/dark/reduced-motion layout cases retain reachable controls and the project identity fully visible at the review's top. Original resolved-failure artifacts remain available.
- Final actual application typecheck, `npx tsc --noEmit -p tsconfig.app.json`, passed. Scoped ESLint passed for **29 actual changed TypeScript/TSX/MJS files**. A test-only unsupported query option found by typechecking was removed; its unchanged exact-name behavior passed all twenty-five social UI tests again. The final **production build passed in 15.77 seconds**, including the shipped atlas. No new production company, player account or invented reward was created for QA.

### Database boundary

No new migration is required or applied for this presentation release. The seven migrations listed in the earlier release records remain authoritative. Initial and final read-only production checks match all 133 expected DC/Feats/privacy function bodies, 118 DC functions, exactly 25 member RPC grants, 33 RLS-protected private tables and anonymous/member direct-write denial. The four original catalogs and both Phase 5 recorded sources match. All 216 previous DH awards and all 51 installation choices retain their recorded fingerprints; the database has zero companies. No private table is in Realtime publication.

### Publication and next work

The tested source was published normally to main as `e2498e9a313a7d26c1b3eb4da6dbbf6548af42e9`, and exact Lovable preview synchronization was verified. That ready preview did not itself establish public-site publishing. Physical Android/iOS PWA and audio-quality review remained outstanding; Phase 7 continues deeper geological/content expansion using the existing version boundaries.

### Scope and genuine limits

Artwork and music are original source-authored assets and synthesized compositions. This release does not claim a commissioned painted asset pack, recorded instruments, measured physical-phone performance, native multi-connection database stress or a proven fifty-hour playtime. Deeper geology beyond the current 599-metre access, automated industrial networks, unrestricted trading, a paged lifetime museum, unattended notification scheduling and device push remain future extensions.

## Phase 5 release record — club participation and DH integration

Phase 5 was published to main as `e2df6d9f67a02b87280eb48897e7d165143b5577` from baseline `807ab345f49d6e7a1ecc0c463b73c6a3253e4645`; its exact Lovable preview synchronization was verified. Private company snapshots remain schema four, field rules three and business catalog four. Shared club records use a separate, bounded projection and catalog five. The evidence below records that release.

### Working vertical slice

- Three optional standings compare recorded weekly mining value, deepest completed mining shift and best recovered-find value. Original cargo and fixed historical mineral prices prevent collection, sales or later market changes from rewriting weekly records. Club-local Monday boundaries handle IANA timezone and daylight-saving changes. Tied ranks and a unique caller row remain correct outside the first fifty places.
- Six finite cooperative projects consume actual collected materials. Per-resource contribution limits prevent one company from filling an active club's goals alone; membership shrink can raise limits without deleting earlier work. Goals, prices and pools freeze when a project opens. Every donation is atomic, permanent and preserves the two-credit liquid operating reserve. A qualified contributor claims a proportional, server-computed share once, including after a lost acknowledgement.
- Standings and company showcases have independent consent flags, both off by default. A showcase publishes only up to three explicitly selected kept specimens. Older selected finds remain editable after leaving the recent private cabinet list. Current membership, enabled installation and registry-backed public eligibility are checked on every shared path. Private economy, workers, coordinates, jobs, mine and company IDs are excluded.
- Seven source-backed DH Feat families add thirty-two unlock tiers worth at most 590 DH points through the existing account ledger. Recorded qualifying history imports only the new families as historical; old definitions, awards and timestamps are preserved. Lifetime sources retain legitimate former-company history after club changes or app removal, while private workspaces remain excluded. Real post-cutover completions can contribute general engagement without historical monthly/reveal inflation.
- Existing in-app notifications batch meaningful returns, production, research, major finds and completed projects with durable dedupe receipts, a fifteen-minute cooldown and four-summary daily limit. The existing global Deep Claim preference has timeout, retry, identity and rollback safeguards. Disabling/re-enabling suppresses pending/off-period history. Project notices queue only during each contributor's own later reconciliation, avoiding foreign-company FK lock cycles.
- Club Projects, Standings and Showcase live inside a five-view Company Office; the six main tabs remain intact. Reviewed consent and contributions, public company details, DH Feat links and authorized notification deep links are functional. Static original project/crest/cabinet artwork accepts sanitized public data only. Portrait, landscape and reduced-motion layouts retain reachable controls and correct review scroll origins.

### Changed files and boundaries

New production modules are `src/lib/deepClaim/social.ts`, `src/hooks/useDeepClaimClub.ts`, `src/components/deepClaim/DeepClaimClub.tsx`, `clubLinks.ts`, public club art/sprite modules and `src/lib/feats/deepClaimCatalog.json`. Existing service/outbox, types/catalog, Page/Office/Settings, notification preferences/profile UI, notification metadata, Feat progression/art and isolated styles are extended. The canonical social catalog is `supabase/seed/deep-claim-phase5-catalog.json`.

Verification extends the existing SQL/browser/headless harnesses, adds real Feats composition and social/preservation/browser fixtures, and adds engine, query/retry, UI, public-art, catalog and preference regressions. All five working Deep Claim documents, DH Feats documentation and the CLAUDE index reflect the implementation. No dependency, unrelated game, authentication, club installation, global score ledger or inbox system was replaced.

### SQL deployment — applied and verified

Both additive migrations were applied together in the exact tested transaction, with each complete original source recorded separately in Supabase migration history:

| Migration | Purpose | SHA256 |
|---|---|---|
| `20261102060000_deep_claim_club_operations.sql` | Four private club tables, consent, bounded public projections, finite frozen projects, atomic contributions/claims and read indexes. | `a33881f242be6795c21f81e17d2840f8726f412c1cac68f214588808966032bf` |
| `20261102061000_deep_claim_dh_integration.sql` | Existing Feats collector/catalog/dirty queue integration, historical new-family import, two private inbox receipt/state tables, shared preference and lazy summaries. | `ddd9dc22f3fb305cf94795784086ad4d02c1b77241c21e57018be240c2dac925` |

The first five migration files are unchanged. Cutover preserves private company data, rules, active jobs and receipts. The release transaction checks ninety-three prior DC and five critical Feats/privacy function bodies plus all five recorded old sources; temporary snapshots also reject any change to an existing catalog definition or permanent award.

Production postflight matched **133/133 tested DC/Feats/privacy function bodies**, exactly **25 member DC RPC grants**, service access, anonymous denial and **33/33 private DC tables under RLS with no member/anonymous direct CRUD**. All four canonical DC catalogs, the seven-family Feats extension and both recorded migration sources match. The total Feats catalog now has 89 families. The previous 216 awards retain identical fingerprint `650d220bf50558538dac293bcb7611dd`.

Installation choices remain unchanged: 51 total, one Deep Claim, fingerprint `5bd2b10a7efc18b44b674516f5337998`. No private DC table is published through Realtime. No live company, test account, shared project, notification or invented player award was created by QA or deployment.

### Verification evidence

- Actual application typecheck and scoped lint passed, including final visual/test-harness changes. Final full unit/component suite: **194 files, 1,853 tests passed** after scroll restoration.
- Main actual-migration PostgreSQL suite: **131 groups passed**, retaining all 110 prior groups and adding preservation, sharing, source ranking, DST, privacy, caps, last-unit contention, reserve rollback, immutable deliveries, claims and older showcase selection coverage.
- Separate actual DH Feats/inbox integration: **15 groups passed**. It composes every released Rune/Showdown/Afterimage/Cipher extension, verifies all five production baseline hashes and eighty-two old families, then tests historical/new awards, dirty ownership, lifetime moves/removal, private restoration markers, preference suppression, dismissal-safe dedupe, batching and the project FK lock-order boundary.
- Exact combined deployment transaction passed against a live-equivalent isolated legacy Feats ledger, a genuine saved post/earned old award, private company and running configuration-three job. Original plan/world/balance/receipt preservation, default-private sharing, no historical notifications, both original migration-history records and repeat-apply rejection passed.
- Headless balance retained 210 mining scenarios and all industry proofs. Eighteen one/two/three-member project partitions complete within actual resource caps; individual integer shares never exceed their pool. Total goal value is 12,572, with finite credit pools totaling 3,771. No project grants resources or recurring rewards.
- Browser QA: **279 unique passing checks across split runs**, covering all eight functional sections with zero runtime errors. The established mining/recovery/industry/field/cavern/business paths passed 209 checks. The final social journey covered five viewports, actual three-company earned materials, independent consent, sanitized kept-geode publication, unique standings, interrupted-response recovery, whole goal completion, once-only 36/36/18 credit shares, opt-out, offline state and matching/foreign-club links. Initial touch-target and scroll-origin findings were corrected; the final focused landscape check also requires the project heading to be fully visible. Original reports and resolved failure evidence remain in the QA artifacts.
- Shared notification preferences completed actual own-RLS off/reload/on roundtrips in all five initial viewport cases. Standalone schema checks reject foreign reads/writes and preserve unrelated preference values.
- Final production build passed in **14.13 seconds** after responsive refinements. Public art adds no animation loop, network asset service or game-engine dependency.

### Remaining work and decisions

Phase 6 is next: finished authored pixel assets, full soundscape/music, physical-device profiling, accessibility and long-term presentation/balance polish. Original procedural art, static public SVGs and synthesized audio are working presentation, not a claimed finished commercial asset pack or soundtrack.

Device push, unattended scheduled reconciliation, trading, dynamic markets and an expanded lifetime museum remain extensions. In-app delivery occurs on authorized server synchronization and the existing inbox refresh. Historical import uses recorded completed sources; an older overdue but unrecorded job follows normal collector timing when first recorded, while its pre-cutover timestamp cannot produce a new general activity date or notification. Public snapshots remain bounded. Native multi-connection PostgreSQL deadlock stress and physical-device performance remain unverified; PGlite serializes transactions. Production security/source checks do not impersonate live members. Lovable preview synchronization and public-site publishing remain separate deployment facts.

## Phase 4 historical release record

The following records describe the earlier Phase 4 release and verification at that time. Current Phase 5 behavior and verification above supersede forward-looking references below.

Phase 4 is implemented on baseline main `11ff248f24933bc1f13829ec11093358a08f0d41`. It extends the existing company, workforce, field operations and production architecture. The final release SHA and GitHub/Lovable synchronization are reported after publishing this commit; this document does not invent its own future SHA.

### Working vertical slice

- Fourteen paid research projects span seven branches with explicit dependencies and two permanent advances each. A real Research Office gates tiers. One project runs at a time using frozen inputs, costs and server timestamps; it completes automatically on reconciliation. Completed research improves future effective worker statistics or production timing. Base stats, existing plans and queued jobs remain unchanged.
- Twelve authored delivery contracts persist without expiration, rerolls or a separate acceptance click. Trading Post levels unlock their three tiers. Each delivery consumes the complete collected warehouse order and pays its frozen company-credit reward once. Staged cargo and uncollected production cannot fund a delivery.
- Eight source-backed company milestones expose actual recorded progress and explicit, once-only credit claims. Historical qualifying work counts. Eleven operational totals aggregate durable source records, including frozen collected recipe quantities rather than mutable staged remainders. These are company objectives; DH Score integration remains Phase 5.
- Bronze, steel and gold bars add five useful recipes and two tier-three owned equipment definitions. Research gates are enforced by the backend. Existing material inputs, station lanes, gear limits, durability, repairs and staged collection remain functional; the original sixteen recipes and ten gear definitions are unchanged.
- Research Office and Trading Post have real level-dependent functions and original pixel artwork. All nine surface buildings retain accessible named targets. The Company Office adds compact Company, Research, Contracts and Records views inside the six-tab shell, with reviewed decisions, server-clock state, bounded lists and central confirmation receipts.
- All three new actions reuse account/club-scoped durable request identities, optimistic revisions, authoritative RPCs and offline inspection. Research with a lost committed acknowledgement resumes the same paid project and deadline after reload.

### Changed files and boundaries

New frontend modules are `src/lib/deepClaim/business.ts`, `src/components/deepClaim/DeepClaimBusiness.tsx` and the Phase 4 fixture/unit/component tests. Existing types/catalog/production/validation/simulation, service/hook, Page/Industry/Settings, isolated renderer/icons and styles are extended. The canonical, answer-free catalog is `supabase/seed/deep-claim-phase4-catalog.json`.

SQL/browser/headless scripts and the isolated database transport are extended, with three new `deep-claim-phase4-{preservation,research,extra}.mjs` modules. All five working documents and the CLAUDE index match the implementation. No dependency, unrelated game, authentication, club, installation, global notification or DH currency system was replaced.

### SQL deployment — applied and verified

`20261102050000_deep_claim_business_development.sql` was applied transactionally with its exact original source recorded in Supabase migration history. SHA256: `0c5b2ad128cd41aecca0c4ede5a3faa6d58f872825070abd30e1d16c6962ad24`.

The additive migration introduces `dc_research_orders`, `dc_company_contracts` and `dc_milestone_receipts`; three secured business RPCs; effective-stat/timing adapters; two building levels; and new finite industry definitions. Earlier eighteen RPC signatures and receipt fingerprints remain valid. Old production rows retain configuration two and zero research speed; new paid orders explicitly use configuration four. An insert guard rejects cached older production handlers before they can bypass research gates. Expedition rules stay three and geology is untouched.

Cutover acquires the asset metadata row before company and production barriers, matching authorization lock order. It advances company revision to invalidate stale quotes without changing cash, inventory, energy, workers, plans, terrain or old outcomes. The first four migration files remain unchanged.

Production postflight matched **93/93 tested function bodies**, exactly **21 member RPC grants**, service access, anonymous denial, and **27/27 private tables under RLS with no member/anonymous direct CRUD**. All three canonical catalogs and recorded migration source match the tested originals. Private tables are absent from Realtime publication. The release preflight and postflight both show 51 installations, one Deep Claim installation and identical installation fingerprint `5bd2b10a7efc18b44b674516f5337998`; existing club choices were preserved. No live company or test account was created.

### Verification evidence

- Actual application typecheck, `npx tsc --noEmit -p tsconfig.app.json`, and scoped ESLint passed. Final QA script lint was repeated after fixture compatibility updates.
- Full unit/component suite: **188 files, 1,777 tests passed**, run without competing heavy jobs.
- Actual-migration PostgreSQL suite: **110 groups passed**, retaining all 85 prior groups. New coverage includes real pre-0500 whole/partly elapsed mining, survey and infrastructure jobs, staged production and gear/find/receipt preservation, research clocks/dependencies/future-only effects, cached-handler denial, all contract and milestone payouts, partial collection, rollback, retries and multi-club access.
- The exact release transaction separately verified all 73 prior function hashes and four recorded original migration sources against a real isolated pre-migration company and active job. Plan/world/balance preservation, exact legacy request recovery, new-source recording and repeat-apply rejection passed.
- Headless balance passed 210 existing mining scenarios plus research/industry dependency and finite economy proofs. Research costs total 2,700 credits plus materials worth 2,673. Twelve contracts consume goods worth 3,976 and pay 4,569; finite delivery premiums total 593. All eight milestone awards total 400. Combined additional finite rewards are 993 credits. New bar margins are 20/36/30 per batch with an acyclic input graph.
- A controlled earned route mines the eight original finite assay deposits in legal route order, pays wages/buildings/recipes/research and respects two operating days of energy to make bronze with 304 cash remaining. Further deliveries require real exploration rather than invented stock or recurring rewards.
- Final browser run: **204 checks passed, zero errors and zero runtime errors** across five phone/landscape/desktop, light/dark and reduced-motion cases and all seven functional sections. The earned business journey uses six real mining returns, three collected batches, paid five-percent processing research, a 342-second bronze order, a whole twenty-stone delivery and seventy credits of explicit milestone claims. Research lost-acknowledgement recovery/reload, single-payment deadlines and permanent result inspection passed. Visual review corrected a narrow-screen counter wrap before the final complete run.
- Final production build passed in **14.06 seconds** after the visual correction. No large engine, new dependency or runtime asset-generation service was added.

### Remaining work and decisions

Phase 5 is next: optional club standings/projects/showcases, secure source-backed DH Feats and relevant shared notifications. Phase 6 includes the finished authored atlas, full music/soundscape, physical-device profiling and final presentation/balance polish. The existing procedural art and synthesized audio remain original working presentation, not a claimed finished commercial asset pack or soundtrack.

Advanced automated industry, dynamic markets, member trading, additional geological regions and a paged lifetime museum remain extensions. Current contracts are finite and do not expire. Offline progression reconciles on authorized reads/mutations; unattended cron/notification delivery is not claimed. Company credits remain isolated from DH Score. PGlite serializes transactions, so native multi-connection deadlock stress remains unverified. Production security/source checks do not impersonate a live member; Lovable preview synchronization and public-site publishing are separate deployment facts.

## Phase 3 historical release record

The following records describe the earlier Phase 3 release and verification at that time. Current Phase 4 behavior and verification above supersede forward-looking references below.

Phase 3 is implemented on baseline main `ed02c36da1ddb8624eecc78fed7737998164d790`. Existing ownership, terrain, earned inventory and configuration-one/two jobs remain intact. The final release SHA and verified GitHub/Lovable synchronization are reported after publishing this commit; this document does not invent its own future SHA.

### Working vertical slice

- Survey operations reveal a bounded area at actual elapsed work checkpoints without mining its ore. Surveys require a known, connected, depleted worksite, respect crew energy/wages/slots, and finish with a persistent report rather than an empty cargo claim.
- Supports, ventilation, pumps and rail are paid, timed construction projects with three grades. Inputs, wages and fees are spent atomically; benefits begin only after return. Engineering changes their real coverage/strength. The strongest covering mitigation applies; rail is weighted across the actual route, so an entrance track cannot accelerate an entire deep trip.
- New configuration-three expeditions can encounter bounded rockfall, gas and water delays. Quotes show risk and possible extra time. Incidents publish only when due and never kill workers, destroy cargo, consume additional energy or rewrite old jobs. The tutorial remains thirty seconds and has no incident chance.
- Newly generated chunks below 32m can contain coherent natural, wet and crystal chambers and ruins. Existing chunks retain their original generation, including unseen cells. Natural air is usable only after actual revelation and connection. The new level-five shaft opens genuine access through 556m with a supported operating depth of 599m.
- Six finite specimen definitions have frozen quality, details, sale value and salvage. Recovery requires actual depletion by mining, not a remote survey. Players permanently keep, sell or salvage a find; whole-bundle capacity checks prevent loss. A company/cell never awards the same discovery twice. Pending finds have no timer and are bounded; a full pending queue pauses new dispatches without losing existing returns.
- The existing mobile shell adds accessible field reports, installation planning and a collection decision panel. Canvas shows committed formations, projects and recovered finds, with focus controls and reduced graphics/motion support. Worksite browsing is bounded to 64 options plus a selected target, with search/paging for larger mines.
- Existing workforce, equipment, processing, sale, offline and durable retry flows remain functional. Preview errors are distinguished from uncertain writes; exact pre-migration request receipts remain recoverable after the rollout.

### Changed files and boundaries

Production extends `src/lib/deepClaim/{types,catalog,world,simulation,production,service,field}.ts`, `src/hooks/useDeepClaim.ts`, `src/pages/DeepClaimPage.tsx`, the existing dispatch/settings/styles and isolated Canvas renderer. New UI modules are `DeepClaimField.tsx`, `fieldLabels.ts` and renderer `fieldAtlas.ts`, `fieldSprites.ts`, `fieldVisuals.ts`. The public, answer-free canonical catalog is `supabase/seed/deep-claim-phase3-catalog.json`.

Tests extend `src/test/deepClaim*`, add the Phase 3 fixture/component/logic suites, and extend SQL, headless and browser scripts with `deep-claim-phase3-{extra,preservation,world}.mjs`. All five Deep Claim documents and the CLAUDE feature index agree with the release. No dependency, unrelated game, authentication, club, installation or global currency system was replaced.

### SQL deployment — applied and verified

`20261102040000_deep_claim_underground_operations.sql` was applied transactionally, with its exact original source recorded in Supabase migration history. SHA256: `f5cd959948231619d1396bed64592f1623a6e5939bbde8842c83a56733b85063`.

The additive migration introduces `dc_infrastructure`, `dc_discoveries`, `dc_field_events`, secured operation preview/dispatch and discovery resolution, generation/configuration-three helpers and immutable guards. It preserves the fifteen earlier RPC signatures. Cutover takes company/expedition barriers in application lock order, pins all missing old-plan extraction and reveal chunks using the old generation selector, and invalidates stale quotes without changing earned balances or old job outcomes. New jobs pin their planned chunks too. The first three migration files remain unchanged.

Production postflight verified **73/73 function bodies**, exactly **18 member RPC grants**, service access, anonymous denial and **24/24 private tables under RLS with no member/anonymous direct CRUD**. Both installed catalogs and the recorded migration source match the tested originals. Private tables are absent from Realtime publication. Existing installation count remains 52 and its full fingerprint remains `a57ebe1314691ab1449c666997ad8faf`. Deep Claim has zero installations at verification: club admins install it through the existing Asset Library. No live company or test account was created.

### Verification evidence

- Actual application typecheck, `npx tsc --noEmit -p tsconfig.app.json`, passed. Scoped ESLint passed for modified Deep Claim modules, tests and scripts.
- Full unit/component suite: **186 files, 1,725 tests passed**, run without competing heavy jobs.
- Actual-migration PostgreSQL suite: **85 groups passed**, preserving all 55 baseline groups. Coverage includes configuration-one/two whole and partly elapsed jobs, absent extraction/reveal chunk borders, independent cavern geometry, finite resources, delayed incidents, weighted rail, operating reserves, every discovery decision, immutable receipts, tenant/asset access and private-data denial.
- The exact release transaction was separately exercised against an existing isolated pre-migration company and active job. Original-source migration history, lost-acknowledgement legacy dispatch recovery, old-state preservation and repeat-apply rejection passed. Production preflight matched all 47 prior function bodies before applying 0400.
- Headless balance passed **210 mining scenarios**, field arithmetic, all **24 specimen/quality combinations**, finite conservation and no salvage arbitrage. A route-coverage case reduces an entrance rail's nominal 28 strength to a real 3% transport benefit. Existing first-smelter/pickaxe progression remains attainable with 56 cash left in its tested route.
- Final browser run: **152 checks passed, zero errors and zero runtime errors** across 320px/390px phones, landscape, desktop, light/dark themes and reduced motion. It covers the actual SQL-backed mining/reload/offline/two-device journey, workforce/production, paid surveying and infrastructure, finite discovery keep/sell/salvage with interrupted-response recovery, reports and map focus. The cavern case earned tutorial cargo, sold it, bought shaft two and completed a deep survey to reveal an actual natural room; no fake production records or frontend currency overrides were used.
- Final production build passed with `npm run build` in **13.95 seconds**. The game remains lazy loaded, with no new game-engine dependency.

### Remaining work and decisions

Phase 4 is next: dependency-based research, persistent contracts, advanced industry/logistics and company milestones. Phase 5 club projects/standings/source-backed DH Feats/notifications and Phase 6 finished authored atlas/music/presentation remain separate work. Initial procedural art and synthesized audio are original working presentation, not a claimed finished commercial asset pack or soundtrack.

The full six-region content roadmap, surveying-specific future discoveries, pumps that drain actual blocked water routes, advanced rail networks and a paged lifetime museum are not claimed. Current hazards cause delay only, while pumps mitigate the corresponding risk. Field history is bounded in public snapshots while all records persist. Offline progression reconciles on authorized reads/mutations; no unattended cron/notification delivery is claimed. Company credits remain isolated from DH Score. PGlite serializes transactions, so native multi-connection deadlock stress remains unverified. Production schema/security/source checks do not impersonate a live member. Preview synchronization and public publishing are separate deployment facts.

## Phase 2 historical release record

The following records describe the earlier Phase 2 release and verification at that time. Current Phase 3 behavior and verification above supersede forward-looking references below.

Phase 2 is implemented on baseline main `4baca192378d68d11ddd25a553dc2874ec75ac3a`. Phase 0/1 integration, ownership, terrain and economic records remain intact. The final release SHA and verified GitHub/Lovable synchronization are reported after publishing this commit; this document does not invent its own future SHA.

### Working vertical slice

- Three persisted daily candidates rotate across seven specialties. Hiring pays the displayed fee/wage, preserves candidate identity/appearance, and respects quarters capacity of 3/6/9/12 employees.
- Idle employees can buy one permanent skill course per operating day. Base statistics, XP and effective equipment bonuses remain distinct.
- Ten equipment definitions in two tiers provide real mining, safety, engineering, logistics and geology bonuses through three exclusive slots. Dispatch freezes effects; configuration-two completion applies wear once. Broken equipment removes its bonus while basic work remains possible. Repairs consume credits/materials; permanent unassigned-item retirement grants no refund.
- Sixteen frozen, server-timed recipes smelt four metals, polish quartz, cut amethyst and craft equipment. Inputs/fuel/cash are spent atomically; one serial lane per station and three uncollected jobs bound production. Actual ready materials respect warehouse staging, and owned equipment is created once on collection. Owned plus pending equipment is capped at 48.
- Workers’ Quarters, Smeltery and Gem Workshop are actual buildable/upgradable surface buildings. The existing Tool Station crafts gear. Office crew slots support simultaneous expeditions; individual crews remain limited to three workers.
- Shaft level four reaches 299m. New deep chunks contain finite amethyst/gold-bearing deposits. Existing seeds, chunks, unseen version-one cells and in-flight version-one expedition plans remain unchanged; old jobs receive no retroactive equipment wear.
- Crew Staff/Hire and Stores Stock/Workshop extend the existing six-tab shell. Surface actions lead to real operations, ready production leads directly to collection, and centered receipts identify actual materials/owned item IDs. Reload, offline inspection, interrupted writes and cross-device revision conflicts use the existing safe recovery protocol.

### Changed files and boundaries

Production changes live in `src/lib/deepClaim/{types,catalog,world,simulation,production,service}.ts`, `src/hooks/useDeepClaim.ts`, `src/pages/DeepClaimPage.tsx`, the new `DeepClaimWorkforce.tsx`/`DeepClaimIndustry.tsx`, existing Deep Claim panels/settings/dispatch/styles and the isolated Canvas/art modules. The canonical public catalog is `supabase/seed/deep-claim-phase2-catalog.json`; it contains no seed, hidden world or future expedition answers.

Verification extends `src/test/deepClaim*`, `src/test/fixtures/deepClaimPhase2.ts`, the existing SQL/browser/headless scripts and their local-only fixtures, including `scripts/fixtures/deep-claim-phase2-extra.mjs`. All five working Deep Claim documents and the CLAUDE feature index are updated. No dependency, unrelated game, authentication, club, installation or global currency system was replaced.

### SQL deployment — applied and verified

`20261102030000_deep_claim_workforce_production.sql` was applied in one transaction with its exact original source recorded in Supabase migration history. SHA256: `c27b82ed2f5f5daf41b6ac2a514cfa44832b0ddec37d8a3b7e0abaa1f2927d12`.

The migration adds seven private tables for catalogs, candidates, owned equipment, training, production and frozen wear; preserves the original eight RPC entry points; and adds seven secured economic RPCs. It extends permitted inventory/depth and updates only the existing asset description. The prior two migration files are unchanged.

Production postflight verified **47/47 function bodies**, exactly **15 member RPC grants**, service access, anonymous denial, and **21/21 tables under RLS with no member/anonymous direct CRUD**. The installed catalog equals the tested canonical JSON; recorded migration source matches exactly. Private tables are absent from Realtime publication. Existing installation count remains 52 and the entire installation fingerprint remains `a57ebe1314691ab1449c666997ad8faf`. Deep Claim has zero installations at verification: admins install it through the existing Asset Library; this release does not override club choices. No live company or test account was created.

### Verification evidence

- Actual application typecheck: `npx tsc --noEmit -p tsconfig.app.json` passed. Scoped lint passed across all modified Deep Claim production modules, tests and scripts.
- Full unit/component suite run without competing heavy jobs: **184 files, 1,664 tests passed**.
- Actual-migration PostgreSQL suite: **55 groups passed**, including all 32 original mining groups, a real pre-0300 company/chunks/running expedition, tenant/asset authorization, daily candidate/training rules, input rollback, frozen equipment/wear, staged production, capacities, retries and idempotent collection.
- Exact release transaction separately exercised against an existing isolated company: original-source migration history, preservation, and repeat-apply guard passed. Production baseline's 26 previous function bodies matched before applying 0300.
- Headless balance: **210 mining scenarios**, 16 recipes, 10 gear definitions, finite conservation and an acyclic material graph. Processing margins are 6–34 credits per batch after input value and fees. A first smelter/copper pickaxe is attainable from mined inputs with 56 cash left in the tested route; no NPC input buying or equipment resale exists.
- Browser QA: **109 unique passing checks across split runs**, five 320px/390px/landscape/desktop, theme and reduced-motion cases, the original mining journey and reliability checks, and **20 complete industry checks**. Real SQL-backed screens performed mining/sales/builds/hire/train/smelt/craft/polish/equip/work/wear/repair/retire, including reload and a lost committed acknowledgement. The first combined run stopped on a test locator that expected an exact Stores label despite its ready-count badge; only that fixture was corrected, then the full industry section passed. No production code changed between those runs and neither run had browser runtime errors.
- Final production build passed in **14.01 seconds**. The game remains lazy loaded; no large engine or asset dependency was added.

### Remaining work and limits

Phase 3 is next: richer geological caverns, environmental hazards, surveying, infrastructure/routes and special discoveries. Phase 4 research/contracts/industrial depth, Phase 5 club projects/standings/source-backed DH Feats/notifications, and Phase 6 finished authored atlas/music/presentation remain separate work. Existing procedural art and synthesized sound are original initial presentation, not a claimed finished commercial art pack or soundtrack.

Recent history remains bounded in the public snapshot while full records persist. Offline progress is reconciled on authorized reads/mutations; no cron or unattended notification delivery is claimed. Company credits remain isolated from DH Score. PGlite serializes transactions, so native multi-connection deadlock stress remains unverified. Production schema/security/source were checked without impersonating a live member; authenticated public-domain play and public publishing require separate deployment evidence.

## Phase 1 historical release record

The following records describe the earlier Phase 1 release and its verification at that time. Current Phase 2 behavior and verification above supersede its forward-looking phase references.

## Delivered phase

Phase 0 architecture and Phase 1 first playable mining operation were published as `4baca192378d68d11ddd25a553dc2874ec75ac3a`, from baseline main `c0c786e409a6eb1384458802da631e4e68352483`.

## Demonstrably functional

An installed club member can found a private company, see the animated frontier camp and persistent underground mine, choose one to three named employees, review a server quote, dispatch a real shift, leave/reload, reconcile elapsed excavation, collect finite cargo, sell stock, upgrade and repeat. The introduction lasts thirty server seconds and leads into first sale/upgrade guidance. Normal shifts last twenty, sixty and 180 minutes. Each employee has six daily energy, seven functional stats, XP/levels and functional traits.

Exploration and extraction both modify the real mine. Terrain uses version-one private generation, global mineral clusters, coal bands, sparse reveals and permanent depletion. Eight usable resources and four buildings have real economic functions. Warehouse overflow stays staged; partial collection is safe and unresolved cargo blocks new dispatches. The camera supports touch pan/pinch, wheel, keyboard and crew focus; an operational worksite/building list provides an accessible alternative. All four starter buildings fit the initial phone overview.

The game reuses DH authentication, clubs, asset installation, Compete discovery, lazy routing, immersive navigation and onboarding. No duplicate global systems or DH currency are introduced. Original procedural pixel art and synthesized opt-in audio are explicitly Phase 1 presentation; a finished commercial atlas and full soundtrack are not claimed.

## Changed areas

- `src/lib/deepClaim/`: public types/catalogs, validation, explanatory simulation, trusted-RPC service and audio manager.
- `src/hooks/useDeepClaim.ts`: scoped queries, server-time display anchor, monotonic responses, durable interrupted-action identities and offline/retry handling.
- `src/pages/DeepClaimPage.tsx`, `src/components/deepClaim/`: management shell, functional menus, Canvas rendering, original art and device settings.
- Existing App/navigation/asset/onboarding/Compete/home shortcut integration; AuthContext clears private pending-action keys on sign-out.
- `src/test/deepClaim*`, `scripts/test-deep-claim-db.mjs`, `scripts/check-deep-claim.mjs`, `scripts/simulate-deep-claim.mjs` and isolated fixtures.
- The five required design/protocol/balance/assets/implementation documents and the concise CLAUDE feature/storage index.

## SQL deployment — applied and verified

Both additive migrations were applied together in one transaction and recorded in Supabase migration history. No player company or test account was created in production, and the game was not automatically installed in any club. Existing installation count remained 52; Deep Claim installation count was zero at verification.

| Migration | Purpose | SHA256 |
|---|---|---|
| `20261102010000_deep_claim_foundation.sql` | Fourteen private tables, deterministic finite world, eight secured RPCs, transactional workforce/economy, immutable plans and receipts, lazy elapsed-time reconciliation. | `1d370b6b66261c53440a60e43a7801a52f8c100d1e9cd57c4966026dae0c3197` |
| `20261102020000_deep_claim_discovery.sql` | Global asset registration only; existing installer/onboarding/navigation provide discovery. No automatic installs or currency awards. | `94720663733be2af208c403daa85e5ac0bee86a320d0d5d702bf7d8c2bc45593` |

Read-only production postflight confirmed 26/26 tested function bodies match, exactly eight authenticated member RPCs, no anonymous execution, all fourteen tables under RLS with no anonymous/authenticated CRUD, no private Realtime tables, and both recorded migration versions. Future installs use the existing Club Asset Library; owners do not need to invent or paste SQL.

## Verification

- Application project checked with `npx tsc --noEmit -p tsconfig.app.json`.
- Scoped lint covers the new module, hook, tests and touched integration surfaces. New code has zero lint errors. The existing AuthContext fast-refresh warning remains; CompetePage's pre-existing explicit-any issues were not changed by its import/render insertion.
- Full unit/component suite: 182 files, 1,607 tests passed. A final targeted recovery regression adds first-open-offline coverage: 35 service/hook/UI tests passed. The extra case was not counted as if it had been present in the preceding full-suite total.
- `node scripts/test-deep-claim-db.mjs --proof`: 32 actual PostgreSQL groups, including access/installation/visibility, finite resource conservation, ordered scouting, every stat, wages/energy, midnight/DST/zone updates, immutable plans, partial storage, retries, rollback, concurrent delivery and route correctness.
- `node scripts/simulate-deep-claim.mjs`: 168 crew/duration/material scenarios plus conservation, operating-capital and finite-starter-stock proofs. Starter stock plus initial cash is at most 924 before wages, below the 6,080 cost of all upgrades; an initial upgrade is immediately reachable.
- `node scripts/check-deep-claim.mjs`: 80 checks across five phone/landscape/desktop, theme and reduced-motion combinations, actual-SQL complete progression, reload, lost acknowledgement, offline protection and two-device conflict handling. The 66 presentation checks were repeated successfully after final Surface camera framing. These fixtures run the production pages/hooks and actual isolated SQL, not a fabricated browser economy.
- Final production build passed with `npm run build` in 17.16 seconds; the application project typecheck and final scoped lint also passed. No deployment claim relies only on a local build.
- A fully excavated 96×149 route returned the correct 197-point shortest path in approximately 762ms in the isolated benchmark, with temporary queue cleanup. The original JSON queue exceeded fifteen seconds and was replaced before release.

Parallel browser/build work caused older CPU-bound Nexus/Rune tests to exceed their existing five-second timeouts in one run. The full unit suite passed when run without those competing jobs; no unrelated game logic or timeout was changed.

## Decisions that matter to later phases

The logical world can expand vertically; launch shaft technology currently caps access at 149m. Existing world versions, frozen job plans and earned records remain stable during future content changes. The client never receives the private seed or future cargo. Indexed temporary routing queues are company-scoped and ephemeral. Daily energy uses a validated server-owned club timezone with New York fallback, persists the next UTC reset, and adopts zone changes at that boundary.

Offline progression uses deterministic elapsed milestones reconciled on authorized reads/mutations. Phase 1 does not require a permanently open browser or dependable cron, and does not yet send unattended completion notifications. A disconnected client cannot commit dispatches or purchases. An uncertain response retains its exact request ID; definitive rejected transactions clear the intent and permit reviewed recovery.

## Genuine remaining work and verification limits

Phase 2 is next: hiring, equipment/durability, workforce development, smelting/gem processing/crafting and more industrial demand. These do not have placeholder navigation in this release. Phase 3 expands regions, routes, hazards, surveying and special discoveries; Phase 4 adds research/contracts/industrial depth; Phase 5 adds source-backed DH Feats, club projects/standings and notifications; Phase 6 finishes authored presentation, soundtrack and broader performance/balance tuning.

Recent collected jobs are currently shown for twelve expeditions and twenty log entries, with the full history retained in the database. Cursor-based history can extend that UI. This slice is not the complete commercial-length economy or all six geological regions.

PGlite serializes SQL transactions: retry/stale-device/concurrent-delivery behavior and actual SQL were tested, while native multi-connection PostgreSQL deadlock stress was not. Row-lock ordering and temporary-table isolation received an independent source review. Production schema/permissions/bodies were verified without impersonating a live player. Authenticated production play and a public-domain deployment are not claimed from the isolated playthrough or Lovable preview synchronization alone.

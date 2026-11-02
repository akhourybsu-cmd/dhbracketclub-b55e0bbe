# Deep Claim — cinematic entry and Training Journal

The original journal release built on main `94a4334b39626fb31365fb5d47753c1946dcfc94`. The current first-shift refinement builds on `004dc699704cdc07b9add464badef1672f4167ff`, simplifying the learning route and dialogue without another migration. Snapshot schema five, field configuration seven, generation four, production configuration four and every paid gameplay rule remain unchanged. Deployment and final verification belong in [the implementation ledger](DEEP_CLAIM_IMPLEMENTATION.md); the presence of this document or migration is not evidence of publication.

## Default first-shift guide

The default guide now follows six existing steps: review the dispatch estimate, dispatch, wait for return, collect, sell or keep, and inspect an upgrade. Camp tours, three employee-file inspections and map exercises remain available as optional notes; they no longer delay the first shift. The welcome starts after the actual deed is signed, rather than pointing back to the absent name field.

`firstShiftGuide.ts` maps this short route onto existing lesson/step identities. The quote advances its caption only when allowed; dispatch, return, collection and sale advance from actual company proof after busy operations and receipts settle. No guidance callback buys, dispatches, collects or sells. The upgrade step opens the building list and asks for inspection, not a purchase. Choosing Keep materials records review without a sale, practical sale mark or credit gain. The Surface action advances after a genuine partial sale or that deliberate review, while retained stock stays intact.

Completion of this short guide is distinct from studying all twelve beginner references. All **42 lessons, 84 steps and 67 dialogue identities**, saved sets and legacy cursors remain valid. Intentionally skipped steps can finish the walkthrough without claiming real practical experience. Optional topics open as notes with one guided-start action; examples are clearly separate. Compact guidance keeps its action text visible, including a labelled Keep choice.

The opening is approximately 180 words / 50 seconds of optional reading. Gus is practical and welcoming; Mara, Ivo and Tessa keep their individual roles. Forced jokes, backend terminology and the unsupported profit claim have been removed. There is no mandatory dialogue timer or a new mining-speed rule.

## Entry and save protection

`DeepClaimPage` retains the existing authentication, active-club and installed-asset gates. A normal authorized launch resolves the existing company through `useDeepClaim`, then presents the title screen. Its summary uses the authorized company name, supported depth, employee count, active expeditions, ready collections and last server timestamp. Cached data is labelled as a saved report and remains subject to the existing read-only mutation restrictions. A valid current-club notification can still enter the relevant Company Office view directly; a foreign-club link does not change the active club.

The title offers Continue, New Game, Tutorial & Field Guide, Settings and Return to DH Club. Continue changes the presentation mode and never calls bootstrap. When a company already exists, New Game explains the one-company-per-member-per-club model and offers Continue or safe tutorial replay. It provides neither a reset nor another save slot.

New Game opens the deed prologue. Gus introduces the claim; the player names it, reviews the deed and explicitly confirms. The existing `operation.bootstrap` pathway creates the real company. Only its resolved authorized snapshot enters gameplay and the crew introduction. Skipping conversation advances presentation, not company creation. A failed or uncertain action keeps the existing recovery pathway rather than attempting another bootstrap with an unrelated identity.

Returning to the main menu preserves jobs, stock and the company. An in-flight confirmation must settle before that transition; an uncertain saved action retains its recoverable identity and an explicit sync control. Confirming that saved economic action through Sync returns to the game and its actual receipt, including recovery initiated from the title. Leaving for `/compete` does not cancel paid server work. Menu transitions do not change expedition clocks.

## Component and data boundaries

| Source | Responsibility |
|---|---|
| `src/pages/DeepClaimPage.tsx` | Presentation modes, authorized game actions, current-company context, actual view navigation and confirmed action observations. |
| `components/deepClaim/menu/DeepClaimTitleScreen.tsx` | Save-aware menu, keyboard commands, visible loading/retry states and existing-save protection. |
| `menu/DeepClaimPrologue.tsx` | Identity-scoped name/story draft and the reviewed callback to real founding. |
| `menu/DeepClaimMenuBackdrop.tsx`, `illustratedScene.ts` | Bounded illustrative Canvas scene, independent of a player snapshot or world seed. |
| `tutorial/DeepClaimTutorialDirector.tsx` | Lesson cursor, narrative, live guidance, journal, practice, advice and graduation. |
| `tutorial/events.tsx` | Default-noop bridge between real gameplay views and the director; contextual help and scoped UI observations. |
| `lib/deepClaim/tutorial/{types,chapters,dialogue}.ts` | Versioned identities, forty-two lessons, eighty-four steps and sixty-seven dialogue lines. |
| `tutorial/{completion,progress,practice,advice}.ts` | Pure completion predicates, metadata validation, read-only scenarios and advice from disclosed company data. |
| `useDeepClaimTutorial.ts`, `tutorial/service.ts` | Independently scoped query, timeout-protected transport, queued notes, revision conflicts and safe retries. |
| `20261102080000_deep_claim_training_journal.sql` | Two private educational tables, two authorized RPCs and immutable bounded request identities. |

Paths under `components` and `lib` in this table are relative to `src/`. These modules introduce no simulation, inventory, employee, reward, authentication or DH Score engine.

## Gus and the narrative

Gus “Gravel” Calloway is the retiring owner and optional mentor. He has original pixel SVG portraits for neutral, amused, skeptical, excited, concerned and proud expressions. He is not an employee record, available hire, wage, expedition participant or source of resources. Mara Flint, Ivo Vale and Tessa Pike retain their established identities and distinct practical voices.

The structured dialogue registry gives lines stable IDs, speaker/expression IDs and text keys. The opening deed, crew introduction, lesson conversations and graduation are separate from completion predicates. Conversation can advance immediately, go back, expose history or be skipped. Reading time is a pacing intention, not a forced timer or measured minimum playtime. The sale handover acknowledges revenue only when the current company's actual sale history supports it; the alternative does not claim that a sale occurred. Neither claims net profit.

Ask Gus in the Office opens advice and the Training Journal. Personalized advice reads the current public company snapshot: available stock, crew, capacity, recorded work and unlocked systems. It cannot reveal a private seed, hidden ore, future find or unreconciled cargo. The company journal's Gus commentary setting controls optional chapter conversations; manual advice and instructional controls remain available. It is educational metadata, separate from global notification, sound and sharing preferences.

## Curriculum

The First Descent contains twelve beginner chapters. It reuses the existing once-per-company thirty-second induction when the authoritative seam and flag allow it. Normal Quick, Standard and Deep expeditions keep their twenty/sixty/180-minute presets and real costs. Returning players can inspect their existing company or choose read-only practice instead of repeating an unavailable induction.

| Beginner ID | Chapter and live learning evidence |
|---|---|
| `beginner.claim` | The Claim — reviewed deed and an actual owned company snapshot. |
| `beginner.camp` | Welcome to Camp — Surface, a real building inspection and Mine. |
| `beginner.crew` | Meet Your Workforce — actual Mara/Mining, Ivo/Geology and Tessa/Logistics files, traits and energy. |
| `beginner.mine` | Beneath the Surface — real accessible map interaction and known-site inspection. |
| `beginner.worksite` | Choose Your First Worksite — Explore/Extract distinction and the real planner. |
| `beginner.plan` | Assemble the Crew — a nonempty selected crew and a resolved server quote, including honest blocking reasons. |
| `beginner.descent` | The First Descent — a genuine mining expedition in synchronized state. |
| `beginner.waiting` | While the Crew Works — real stages and an actual returned record. |
| `beginner.haul` | Bring Home the Haul — a genuine positive full/partial transfer or its valid historical evidence. |
| `beginner.sale` | Turn Stone into Money — actual stock and a confirmed sale; optional non-spending review remains distinct. |
| `beginner.upgrade` | Invest in Your Company — an informed building review; a real purchase is a separate practical mark. |
| `beginner.graduate` | Your Company, Your Decisions — review, graduation and a choice of ordinary play, academy or reference. |

The thirty advanced lessons are permanently available in the Prospector's Training Journal. Unavailable buildings or expensive operations offer clearly labelled read-only learning rather than a forced purchase.

| Group | Stable lesson IDs and subjects |
|---|---|
| Workforce, five | `workforce.hiring`, `workforce.stats`, `workforce.training`, `workforce.equipment`, `workforce.repairs`: candidates/housing; seven effective skills; daily idle-worker courses; exclusive slots; condition, repair and retirement. |
| Industry, six | `industry.ore`, `industry.warehouse`, `industry.smeltery`, `industry.gems`, `industry.crafting`, `industry.queues`: current material uses; stock/staging; real metal recipes; quartz/amethyst finishing; equipment production; serial lanes and bounded batches. |
| Field, six | `field.exploration`, `field.survey`, `field.infrastructure`, `field.hazards`, `field.reports`, `field.discoveries`: finite geology; bounded reveals; installed protection/rail; delay risks and Ancient Deep heat/lift; actual reports; permanent keep/sell/salvage choices. |
| Business, five | `business.office`, `business.research`, `business.contracts`, `business.milestones`, `business.strategy`: real Office sections; fourteen research nodes; twelve finite deliveries; eight source-backed milestones; opportunity costs without a guaranteed profit promise. |
| Club, five | `club.projects`, `club.standings`, `club.showcase`, `club.privacy`, `club.updates`: six finite projects; three separate boards; curated kept finds; independent opt-in consents; existing DH Feats and in-app updates. |
| Settings, three | `settings.sound`, `settings.main_menu`, `settings.exit`: sound/visual comfort; actual title return; safe departure while paid work continues. |

The compact paged Field Guide remains available in Settings with its existing reference chapters. The new journal supplements it. Neither a reference page nor practice initiates a gameplay mutation.

## Completion, replay and genuine practice

Each step identifies a real target, an optional introspection/navigation action and a pure completion predicate. Predicates use current-company snapshots, scoped UI observations, confirmed action observations or an explicit educational acknowledgement. Finishing dialogue does not satisfy a dispatch, collection or purchase predicate.

The journal distinguishes reviewed lessons, practiced lessons, completed step IDs, skipped lessons and seen dialogue. Read-only examples record review; they cannot prove that a paid action occurred. A practical mark requires the lesson's actual live observation or confirmed source. For economic lessons, relevant server-confirmed action/history is required. An owned historical result can establish legitimate practice without asking a veteran to spend again. Replay preserves earlier monotonic progress and never resets the company's induction flag.

The director can pause, resume a stored cursor, skip an explanation, open reference information or use a read-only alternative. It reevaluates current state after reload: a crew already returned is not dispatched again. The main-menu lesson records its actual navigation observation even though returning to the title removes the in-game overlay. A missing or offscreen target has a safe fallback instead of blocking game controls or inventing a successful action.

## Explicit gameplay events

Real components expose stable `data-dc-tutorial` targets, including portaled views. Examples include `worker-stat-mining`, `dispatch-quote`, `production-review`, `research-review`, `club-privacy` and `settings-updates`. The integration does not infer success from DOM text.

`DeepClaimTutorialEventsProvider` injects stable callbacks and an identity/step scope key. Without a provider, the bridge does nothing and optional help controls stay hidden. `useTutorialView` observes an actual mounted view, while explicit clicks/keyboard actions record inspections. Controlled request IDs open only owned worker files or the requested real Crew/Settings view; handling the same ID twice does not reopen a dismissed file. External Office/station changes clear stale detail views, while an internal action that deliberately opens a new review in the same transition preserves it. Help/Ask Gus share existing dialog headings or navigation/profile rows, retaining forty-four-pixel targets without adding rows that displace a bounded panel's footer. On screens up to four hundred pixels wide, Ask Gus uses his existing portrait with the same accessible name; larger screens retain its text.

UI observations include tabs, worker/stat/energy/trait inspections, selected crew, map interaction, worksite, actual quote, stock, recipe, production, research, contracts, milestones, club views, privacy, settings and guide reading. They cannot emit economic-confirmation event types through the UI bridge. A zero-person crew is not valid chosen-crew evidence; an unresolved preview is not a reviewed quote. Station- and subview-specific lessons match the actual Gem Workshop, Tool Station, Training, Gear or Updates view.

The Page's existing action callbacks emit confirmed observations only after a resolved authorized snapshot. These include founding, dispatch, positive haul/production transfer, sale, upgrades, hiring, training, assignment, repair, production, discovery decisions, research, delivery, milestone and club actions. Owner/club scope and snapshot revisions are checked. Genuine request retries can recover a prior action; clicking confirm before its response does not establish success. Tutorial observations themselves never contribute to DH Score or general engagement metrics.

## Educational persistence and authorization

The additive `0800` source creates `dc_tutorial_progress` and `dc_tutorial_requests`. Both enable RLS and revoke direct anonymous/member table access. Only `dc_tutorial_get()` and `dc_tutorial_save(p_patch,p_expected_revision,p_request_id)` are member-callable; private helpers remain denied. The existing `dc_access_v1()` enforces identity, current club membership and the enabled/visible installation. The caller cannot choose another company's ID or save progress before owning a company.

The progress row contains version one, an independent revision, active lesson/step, completed/reviewed/practiced/skipped sets, seen dialogue, campaign state, commentary preference and timestamps. Educational set changes are bounded and monotonic. Cursor/status/commentary changes require the exact journal revision; stale set-only unions are safe. Reused UUIDs with a changed fingerprint are rejected. Exact authorized replay returns current journal state, and failed transactions roll back both notes and their receipt.

The server retains the newest 256 educational receipts per company and rate-limits 120 new writes per minute. This bounded journal dedupe is distinct from the existing economic request ledger and permanent DH award receipts. New helpers/tables do not modify those systems, company revisions, jobs, cash, stock, energy, terrain, catalogs, sharing consents or notifications.

`useDeepClaimTutorial` uses an account/club/company query key, bounded transport timeouts and an independent queue of at most 128 notes. Transient failures retain the exact request identity. On a revision conflict, completed educational sets can merge after a fresh authorized read while stale queued navigation is discarded; another device's newer cursor is not blindly overwritten. Scope changes invalidate old asynchronous results and load the correct queue.

| Device namespace | Contents |
|---|---|
| `dh:deep-claim:training:pending:v1:<user>:<club>:<company>` | Unacknowledged educational note UUID, patch and expected journal revision. |
| `dh:deep-claim:deed-draft:v1:<user>:<club>` | Optional pre-founding name, narrative line and presentation stage. |

These namespaces are cleared on sign-out. Successful founding clears its deed draft. Sound and visual preferences retain their existing namespaces; no gameplay save is stored in the journal queue.

The tested extension preserves all 153 prior critical function bodies/OIDs and all thirty-three old private tables, and adds eight functions, two member RPCs and two private tables: 161 critical DC/Feats/privacy functions, twenty-seven member DC RPCs and thirty-five private DC tables in the composed fixture. The two new tables are not in Realtime. The eight earlier migration sources remain unchanged.

The reviewed `0800` source has SHA256 `787670491647a61f49ad967a980acf6805255c7ecbbc29c5d0b253699c81a670` and MD5 `8cdd87f5834c5bfaf91a7089f059b637`. These identify the tested file; applied history is verified separately during release.

## Illustration, audio and accessible lifecycle

The title scene is explicitly labelled illustrative. Its fixed settlement, tunnels, seams, cart, lift and workers receive no company snapshot, seed or future plan. It reuses original painters and the existing atlas where available, with original SVG fallback artwork. The active mine renderer is mounted for gameplay rather than to render the title. Narrative portraits are separate local source-authored SVG assets; they do not rebake either existing atlas.

The title uses a 960×760 logical composition, one capped display Canvas and two cached layers. Each backing image is limited to one million pixels; normal DPR is capped at two and reduced graphics at one. The existing scheduler targets thirty paints per second or twelve in reduced graphics; reduced motion uses static invalidation. Hidden/inactive scenes stop scheduling, and disposal releases bitmap/lifecycle resources. These are source budgets, not measured physical-phone performance claims.

Title/menu/tutorial cues reuse the existing Web Audio controller, surface score, category gates, independent buses and voice limits. Sound still requires an opt-in gesture. There is no second soundtrack engine, typewriter delay, network speech service or required downloaded recording. In-game occlusion pauses background music/ambience; hidden, muted or disposed controllers cannot resume themselves through a delayed promise.

Menu controls support mouse, touch and keyboard navigation. Guidance follows viewport bounds and active portaled dialogs, avoids obscuring its target, and does not trap focus or intercept map gestures. Named buttons provide alternatives to pan/zoom. Reduced motion, safe areas, fallback artwork and explicit retry/exit controls remain part of the experience. Physical Android/iOS installation, OS background interruption and subjective audio review remain separate from cloud browser emulation.

## Verification checkpoint and reproduction

The final full unit/component regression passed all 206 files and 2,079 tests with `--maxWorkers=2`; its log is `/tmp/deep-claim-menu-unit-final.log`. All twenty-five gameplay-integration tests passed, and the sixteen-test existing recovery/UI suite passed again after a type-correct test-regex refinement. Eighteen focused tutorial-UI tests also cover pausing guidance for an unrelated reward dialog and resuming after normal close. Final application typechecking passed without errors. Scoped ESLint reported zero errors and one pre-existing AuthContext line-20 Fast Refresh warning. Final Phase 8 preservation passed for 27 files and both atlases passed their reproducibility checks.

The final production build passed in 17.99 seconds. Its gameplay bundle is `DeepClaimPage-BMcgtOuh.js`, 737.16 KB / 175.31 KB gzip, and its stylesheet is `DeepClaimPage-BXiDjE5L.css`, 105.32 KB / 18.07 KB gzip. All twelve PWA smoke checks passed against that local production build with zero assertion/runtime errors; `/tmp/deep-claim-pwa-2Rz19k/report.json`. Chromium was not in standalone display mode. These checks do not establish physical-device installation, OS background/push behavior or subjective audio quality.

The retained 158 core SQL groups, nineteen actual Feats groups and fourteen native core groups passed. The independent twenty-group journal SQL extension proof passed in the current runtime and preserved all 153 old critical function bodies and all old rows. The native journal harness passed fourteen groups on fresh PostgreSQL 17.11 with eight pooled connections, preserving old rows and function metadata and exercising the exact guarded release. Its tested SQL is 101,153 bytes, SHA256 `143ab335dabda0431015a1b9ad8a08561693d0c4171f3dfb40061f0d5fa5df46`. The unchanged economy also passed the retained 210 headless scenarios and 648 Ancient Deep cases.

All twelve browser sections are now covered by explicit passing section runs: 477 distinct passing labels across 619 observations and zero runtime errors, consolidated in `/tmp/deep-claim-menu-browser-evidence.json`. The corrected campaign section passed 27 checks: all twelve chapters without skips, the actual thirty-second induction, reload and a fresh device, contextual help, advice and menu continuation. Its section evidence is `/tmp/deep-claim-0LgREP/report.json`. The separate corrected academy section passed 35 checks in `/tmp/deep-claim-Yl3Pqu/report.json`, covering thirty advanced lessons without economic or practical-progress changes. The final social/runtime/deep/menu run passed 213 checks; the latest presentation run passed 135. These are recorded section runs, not one uninterrupted passing invocation. Restoring source after a runtime interruption does not restore temporary logs or constitute a fresh verification run.

The feature was pushed normally to main as `52a5308ef57058093e42aace838caf861eaedba6`, and Lovable reported that exact commit ready with no project error. The exact native-tested transaction applied `0800` successfully. Independent production postflight matched 161/161 critical bodies, 146 DC functions, 27 member RPCs, 35 private RLS tables and all nine original migration sources, preserving all 153 prior functions, all thirty-three old table-row multisets including company revisions, 219 earned awards, 89 Feat definitions and the fingerprint of 51 installations. No tutorial records or QA players were seeded.

Actual public HTTPS verification at `2026-11-02T14:11:08Z` confirmed the title/Gus/journal/read-only content on `https://dhbracketclub.lovable.app/`, with hosted `DeepClaimPage-B8LRV895.js`, `DeepClaimPage-BXiDjE5L.css` and both unchanged atlas hashes. Lovable's hosted JavaScript bundle differs from the local build; the two JavaScript hashes are not claimed equal. Public build record `1793628128268` is a build identifier, not the commit SHA. The complete original-source cutover, deployment identifier and authorization postflight are recorded in the implementation ledger. This receipt is added in a follow-up documentation-only commit without predicting its own SHA. Physical-device installation, OS push/interruption and subjective audio review remain unverified.

Relevant reproducible commands, run serially with the project's isolated QA prerequisites, include:

```sh
npx vitest run src/test/deepClaimTutorialEngine.test.ts src/test/deepClaimTutorialIntegration.test.tsx src/test/deepClaimTutorialService.test.ts src/test/deepClaimTutorialHooks.test.tsx src/test/deepClaimTutorialUI.test.tsx src/test/deepClaimMenu.test.tsx
node scripts/test-deep-claim-tutorial-db.mjs --proof
node scripts/test-deep-claim-tutorial-native.mjs --reset --proof
DEEP_CLAIM_QA_SECTION=menu node scripts/check-deep-claim.mjs
node scripts/check-deep-claim-presentation.mjs --phase=8
```

The native command requires the disposable, loopback-only marker-verified PostgreSQL environment described in [native QA](DEEP_CLAIM_NATIVE_QA.md). None of these commands authorize production fixture writes. The final full regression, application typecheck, lint, production build and PWA results are recorded above; actual applied history, commit/push SHA and verified Lovable/public-site evidence are recorded in the delivery ledger.

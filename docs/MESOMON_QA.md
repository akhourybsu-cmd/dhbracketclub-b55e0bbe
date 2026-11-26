# Mesomon verification

The first chapter uses the existing Vitest, Playwright and isolated PostgreSQL conventions. Tests run against committed rules and the real game page; the browser fixture substitutes authentication, club installation and cloud transport so it cannot write to a production account.

## Commands

```sh
npm run typecheck
npm run lint:member
npx vitest run mesomon --maxWorkers=1
node scripts/test-mesomon-db.mjs
npm run build
node scripts/check-mesomon.mjs --build-check
MESOMON_BROWSER=chromium node scripts/check-mesomon.mjs
MESOMON_BROWSER=webkit node scripts/check-mesomon.mjs
```

The full repository unit command remains `npm run test:unit -- --maxWorkers=1`. Scoped ESLint covers new and changed TypeScript/JavaScript sources; the root TypeScript reference alone does not check the application, so use the `typecheck` script.

## Browser scope

`scripts/fixtures/mesomon.html` loads the production lazy page, reducer, maps, Phaser renderer, controls and save hook in React Strict Mode. It exposes read-only map and local-save inspection to the runner. A pathfinder uses the real collision predicate to determine walking inputs; it never teleports the player, edits quest flags, grants a companion or skips a battle. Every progression event is triggered by a production interaction or control.

The cloud fixture implements revision checks, request payload receipts and persisted responses in browser-local storage. It is a controlled transport model; the SQL suite separately checks the real migration, RLS and transaction behavior. Neither fixture is a production permission proof.

The same-context two-tab scenario uses real shared IndexedDB/localStorage and the production file-writer coordination. It opens the same file in two pages, advances the primary page offline, checks that the secondary page cannot replace that newer head, then closes the primary and explicitly reloads the secondary before resuming. Modern browsers exercise the Web Locks path; a browser without that API exercises the stale-parent fallback. This is same-device storage coordination, not a simulation of two independently authenticated physical devices.

The browser matrix covers 320×568, 390×844, 844×390 and 1440×900 in light and dark themes, with reduced motion enabled. It checks horizontal fit and touch sizes, real directional movement, keyboard input, A/B and menu controls, reload recovery, Strict Mode canvas cleanup, route remount and normal scrolling outside the game. The full chapter walkthrough runs once per engine, including the first trust bond, a wild Resonance opportunity, the non-bondable demon, battle recovery, assisted sealing and the return scene. Screenshots and structured receipts are retained by `.github/workflows/mesomon.yml`.

Active-game receipts record the rendered canvas dimensions, the size of each 16×16 source tile on the 10×9 display, and the four gaps inside the screen. Handheld checks allow two CSS pixels for rounding and require the screen to fill the available slot at its native aspect ratio. Exploration tiles must reach 24 CSS pixels on each tested phone. Battle and dialogue can shrink the screen to accommodate controls. Desktop may use integer scaling and letterboxing.

The browser runner reads the native 160×144 Phaser canvas during ship exploration and both chapter battles. It checks deck and sea colors, Tavian’s colors at the spawn position, and separate ally and enemy sprite regions for Rillik, Tressel and the Rift Wretch. Each sample requires multiple opaque artwork pixels. Any bright green pixel from Phaser’s missing-texture graphic fails the frame check. The runner waits for a painted frame and retains measured counts, the native PNG and a viewport screenshot on failure.

The build check traverses the actual static JavaScript import graph from `dist/index.html`. Dynamic dependency filenames alone are not treated as eager imports. It asserts that the main app does not eagerly import the Mesomon route or Phaser chunk. It also validates the emitted `dist/games/mesomon/release.json`: Port Marche chapter, rules version 1 and asset version 3, an actual Git SHA, and an explicit dirty-source flag. In GitHub Actions the SHA must equal `GITHUB_SHA`; CI must report a clean source checkout.

The browser walkthrough checks painted exploration sprites after a file reload, the three opening reading styles, and a real touch launch. It measures the console at the four viewport corners, checks the pause menu against the safe area, and exits through the same controls available to players.

## Evidence boundaries

Browser viewport models are not a physical iPhone test. The automated walkthrough is a fast functional run, not a measured 15–25 minute first-player session. Stable 60 fps, battery cost, audio quality and chapter pacing require human review on representative hardware. Production cloud-save readiness requires an authenticated read/write and conflict check after the migration is applied; a pushed SQL file, a mocked transport or a successful public GET is not evidence that RLS-protected cloud saves are live.

Verification results and deployment evidence are recorded after execution; this document defines the commands and their scope rather than claiming that unrun checks passed.

## Verified working-tree checks — 25 November 2026

- The eight focused `mesomonUI.test.tsx` tests passed with Vitest exit 0. They cover the three files and audio gesture gate, real engine movement and conversation controls, menu settings/dismissal, Strict Mode canvas/audio cleanup, guest local mounting, late cloud hydration before Continue, and title audio preferences surviving remount without creating a blank save.
- A ninth focused UI test also passed with exit 0 after file-writer protection was introduced. It verifies that a blocked transition during play closes the menu, pauses the journey, disables Continue, exposes Reload file, and prevents subsequent movement from issuing save writes. The real two-tab browser scenario is a separate gate and requires its own successful receipt.
- The production import-graph check passed. The main static closure had three modules; `MesomonPage-HblscdFY.js` and `phaser-Cwjr4Isa.js` were separate emitted lazy chunks. Filenames are evidence for that local build, not a permanent API or a claim about production hosting.
- The first native Chromium run passed 20 checks at 390×844 dark: movement, keyboard/menu/settings, reload and offline local persistence, canvas cleanup and normal outside scrolling, first trust bond, both optional harbor stories, a wild bond, demon rejection, mid-battle reload, three-pulse assisted seal and the closing scene. Its receipt had no failed checks or runtime errors. Native first-bond, settings and chapter-complete frames were visually inspected.
- The full native Chromium matrix subsequently passed **112 checks** across all eight viewport/theme combinations, plus its full chapter and unauthenticated-route checks, with no failed checks or runtime errors. The receipt is `/workspace/scratch/mesomon-chromium-final/report.json` in the verification workspace.
- A further **26-check Chromium run** passed after the hover/text-color refinement. It traversed the chapter again and resized the real boss checkpoint to 320×568, 844×390 and 1440×900, then inspected the actual closing tone choices at 320×568. Brine Snap title/subtitle contrast measured 9.73:1 / 6.44:1 normally and 10.47:1 / 6.76:1 on hover; both exceed 4.5:1. The receipt is `/workspace/scratch/mesomon-release-layout/report.json`. These are additional coverage passes, not 26 unique checks added to the 112-check matrix.
- Both migrations, `20261125193000_mesomon.sql` and `20261125193500_mesomon_asset.sql`, were applied to the connected production database. An authenticated-role SQL transaction check passed with RLS enabled and was rolled back. That verifies the tested database authorization path; it does not claim a logged-in production browser or HTTP cloud-save session was exercised.
- These results are from the pre-release working tree, not an already published commit. The final workflow includes all eight combinations and the added responsive boss/closing/contrast checks in both Chromium and WebKit. Its results and production deployment must be reported from their own receipts when completed.

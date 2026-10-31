# Rune Delve: The Living Hollow

Rune Delve is a mobile spatial puzzle adventure. Each area uses a deterministic 6×6 board: move the delver, push colored runestones onto matching sigils, and reach the restored portal. Later adventures connect two or three areas while keeping only the current area on screen. Existing heroes, rune glyphs, realm artwork, monster portraits and premium menu/reward presentation are reused.

## Puzzle journey

- **36 authored adventures, six chapters:** the original 18 introduce runestone routing, pressure gates and ice. Sunken Galleries adds connected areas and remote dependencies; Verdant Keep adds reusable keys and locked return routes; Astral Observatory combines spatial rifts with the earlier mechanics. The original 18 definitions remain unchanged. This is a curated campaign rather than unlimited generated content or a promised playtime.
- **Playable tutorial:** the first three chambers move through Learn, Practice and Trial. Learn follows four real gameplay beats; Practice gives the objective without pointing out the solution; Trial retires its prompt after the first meaningful action. A confirmed third clear graduates the player into the wider journey. Contextual introductions return when a new mechanic appears and fade after it is demonstrated. Solo and Help control guidance; Guide can replay the opening with separate device checkpoints while preserving the main journey. Advice never takes control of the delver or blocks experimentation.
- **Exploration:** player-only archways and rifts link areas; runestones remain in their own area. Inventory, restored runes and held plates persist across travel. A read-only discovery map shows visited areas without teleporting the player. Colored keys open every matching lock and can make an earlier route newly useful.
- **One common toolkit:** orthogonal movement, one-stone pushes, tap/swipe/arrow/WASD controls, free undo/restart, and bounded hints. Efficiency prioritizes pushes before walking. There are no lives, timers, equipment requirements or health checks. Delver appearances share the same rules.
- **World rules:** occupied plates open gates; occupied gates remain open until vacated. Pushed stones slide across ice; the delver walks normally. Guardians calm when their matching sigils are restored and can be bypassed; no enemy kill is required to escape.
- **Mastery:** one star for escape, one for reaching the adventure’s push par, and one for collecting every treasure across its areas, for 108 available stars. Any clear unlocks the next adventure. Best records improve monotonically; replaying an acknowledgement never grants stars twice.
- **Progression continuity:** the journey retains its versioned track. Players who cleared the original 18 can continue into adventure 19 with their records intact. The persistently labeled Combat Archive retains previous campaign, Expedition, Arena, class, relic and currency records. Shared DH Score history is retained; two additional adventure Feat families reward unique expansion clears and best stars without changing any existing tiers.
- **Persistence:** the server replays the canonical action trail before confirming completion. Account-scoped local checkpoints replay the same rules and keep pending result IDs until acknowledged. See [puzzle data contracts](RUNE_DELVE_PUZZLE_DATA.md).

## Combat Archive

The previous combat modes remain available under the Combat Archive. Its header is labeled throughout the original routes, and its home links back to the puzzle journey. Combat rules and saved progression are retained independently of the new journey.


- **Expeditions:** six seeded chambers, persistent health/mana, twelve stackable blessings drafted from three choices (four after a Vault), two revealed routes between encounters, and eight sequentially unlocked Ascensions. The crypt offers balanced foes, Blood Hunt stronger foes and double-rank blessings, Sunken Vault an extra foe, score, three extra moves and a wider next draft, and Lost Shrine healing with armored opponents. Earn shards and class XP by banking a result; active and abandoned runs earn nothing. Campaign equipment and masteries do not apply.
- **Campaign:** generated chamber objectives, layout zones, relic builds, class masteries, run bargains, branching milestones and boss mechanics. Existing canonical level identities remain unchanged; generator balance hydrates on read. Class experience reaches level 150.
- **Daily arena:** two minutes of active play against escalating waves, base class powers, and the same Convergence system. Backgrounding, pausing and enemy inspection stop the clock. Daily best improvements pay only the missing tier difference, up to 900 shards and 500 XP per UTC day; zero-kill runs earn nothing. Result retries use a stable request ID even across midnight.
- **Convergence:** chain all four colors to release a bounded area strike, one mana and one guarded turn. Repeated colors retain existing charges. New legal chains are supplied automatically when a board runs out of moves.

## Visual and input design

Locally hosted sanctum, hero, monster and three-biome realm artwork lives in `public/images/rune-delve/`. Four optimized monster atlases contain 64 individual portraits: every canonical species, distinct Expedition identities, legacy creatures and nine signature bosses. `monsterPortraits.ts` resolves exact identities across battle, inspection, discoveries and the Bestiary; other promotions retain their species with visible regalia. Unknown future creatures get a neutral emblem instead of an unrelated monster. The ordered [art manifest](RUNE_DELVE_MONSTER_ART.json) records each tile and its visual brief; vector fallbacks remain available. The game has its own Sanctum/Campaign/Hero/Armory navigation. Battle uses a compact enemy stage, health/ability HUD, four-sigil meter and stable Cast/Clear command deck. Detailed encounter rules, equipment math and the chronicle are available on demand. Drag, tap and keyboard inputs share chain validation. Cancellation never commits a move, and StrictMode does not replay gameplay callbacks.

- **Materials:** obsidian surfaces, ivory lettering, engraved brass and colored enamel. Teal marks active choices; gold marks rewards and milestones. Rune colors also have distinct sigils. Relic tiers change their metalwork and frames; portraits, chapter tablets and reward medallions share that treatment. Keep touch controls at least 44px and decoration outside the input layer.
- **Menus:** collections reveal in short staggered sequences; tabs, classes, routes and page controls show clear selection and finite press feedback. Loadout slot selection retains the intended destination through failed saves. Keyboard tab controls support arrows, Home and End, and the pager shows position without adding scrolling.
- **Acquisitions:** confirmed purchases, upgrades, quest claims and blessing choices use a branded center-screen reward stage. Multiple items use explicit pages and Continue. Campaign drops, discoveries and progression join the existing result dialog; Arena and Expedition currency stays in their central result screens. Receipt-keyed presentation ignores restores, failed grants and duplicate acknowledgements.
- **Motion:** resting rune cells stay still. Selection, chain casts, damage, healing, guard, mana, class abilities and Convergence receive finite feedback from committed state changes. Menus reveal in short stages; results use a stamped seal, stars and reward count. Animation never resolves combat or gates the next interaction.
- **Puzzle motion:** tile hit areas remain stationary while a bounded decorative layer moves the delver and pushed stones. Sigil, pickup, gate, lock, portal and rift feedback follows committed forward actions. Same-room rifts use travel feedback rather than sliding actors through walls. The moving artwork matches its final tile geometry and restored glow. Undo, restart, restored checkpoints, dialogs, hidden documents and motion-preference changes clear transient feedback; reduced motion renders the final state immediately. Learn and Hint markers retain their static gold emphasis after the finite pulse.
- **Lifecycle:** the world has at most eight ambient motes; combat feedback has a twelve-event cap. Hidden documents pause ambience and clear transient combat effects. Reduced motion removes ambience, particles and movement, and displays final scores immediately. Returning, restoring or changing encounters establishes an idle baseline without replaying old feedback. Decorative layers ignore pointers and are hidden from accessibility APIs.
- **Viewport:** the game shell follows the visible viewport and reserves space for the HUD, navigation and device safe areas. Menus use bounded screens with explicit pages and tabs; collections, build notes, effect ledgers, records and help remain reachable without nested scrollers. Landscape combat places status beside the board. The board sizes from its available container while keeping all 25 rune targets at least 44px and Cast/Clear in the command deck. Passive notifications let pointer input pass through.

Styles are scoped to Rune Delve; `runeViewport.css` owns the shell/pager and the menu, Codex, daily, map/results and dialog styles own their screen layouts. `useRuneViewport` responds to orientation and visible keyboard height. Presentation remains separate from combat and reward calculation.

Campaign v3 session checkpoints retain board mechanics, build, bargains and spent powers. Expedition checkpoints are scoped by account and club, restore paused, and are valid for seven days. Daily checkpoints are account-scoped, validated, restore paused and expire after twelve hours. Device storage is optional; its absence is surfaced where it prevents resuming a run. Server run receipts and campaign/Expedition progression survive device changes, while live boards stay on their originating device.

## Persistence and app integration

See [transaction and data contracts](RUNE_DELVE_DATA.md). Campaign settlement, daily awards, relic buying/upgrading, equipment validation and quest claims use server transactions. Expedition start tickets fix seed/class/difficulty; bank receipts pay exactly once. Three source-backed Expedition Feat families feed the shared DH Score board. Existing private testing-account exclusions remain active.

Combat is still simulated on the client. Server receipts validate gates and bound telemetry/rewards; they do not replay every combat action. The new protocol fixes transactional consistency and retry behavior, without claiming competitive anti-cheat validation.

## Verification

```bash
npm run test:unit
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
npm run build
node scripts/test-rune-expedition-db.mjs
node scripts/test-rune-settlement-db.mjs
node scripts/test-rune-feats-db.mjs
node scripts/test-rune-balance-db.mjs
node scripts/test-rune-puzzle-db.mjs
node scripts/test-rune-puzzle-feats-db.mjs
node scripts/check-rune-puzzles.mjs
node scripts/check-rune-polish.mjs
RUNE_QA_URL=http://127.0.0.1:8092 node scripts/check-rune-mobile.mjs
RUNE_QA_URL=http://127.0.0.1:8092 node scripts/check-rune-menus.mjs
RUNE_QA_URL=http://127.0.0.1:8092 node scripts/check-rune-journeys.mjs
RUNE_QA_URL=http://127.0.0.1:8092 RUNE_QA_OUTPUT=/tmp/rune-motion node scripts/check-rune-motion.mjs
RUNE_QA_URL=http://127.0.0.1:8092 RUNE_QA_OUTPUT=/tmp/rune-viewport node scripts/check-rune-viewport.mjs
```

Browser fixtures mount production screens, hooks and input controls against an isolated backend; they do not post to live accounts. The matrix covers five viewport sizes in both app themes. Rune Delve retains its own dark dungeon palette inside either theme.

`check-rune-motion.mjs` checks normal and reduced motion at 320×568, 390×844, 768×1024, 844×390 and 1440×900. It captures Sanctum, map, shop, archived victory and combat screens, and checks overflow, 44px rune targets, upgrade-sheet focus, final scores and passive decoration. Board, arena and Expedition sequences check actual animation progress, rapid double-cast input, bounded feedback, route cleanup and hidden/resume behavior. The output directory contains screenshots and `report.json` with observed frame timings and Chromium metrics; `RUNE_QA_VIDEO=1` also records the normal-motion board sequence.

`check-rune-viewport.mjs` traverses menu tabs, collection pages and overlays at those five sizes, including first-time hero creation, campaign/boss combat, Arena and Expedition phases. It checks content against viewport and clipping-ancestor bounds, internal scroll sizes, covered controls and 44px rune targets without scrolling controls into view. Reports and failure screenshots collect across routes. `VIEWPORT=320x568,844x390` and `RUNE_QA_ROUTES=shop,campaign` narrow a rerun; expanded records and terminal checkpoints exist only in the isolated browser fixture.

The [October balance report](RUNE_DELVE_BALANCE.md) records the current measured curves and reproducible commands. Its checked-in [data](balance/rune-delve-2026-10.json) includes 14,400 campaign simulations, 400 upper-Ascension Expedition runs and 1,200 timed Arena runs. The campaign solver now includes earned build profiles, board mechanics, authored waves, boss phases and enemy abilities. These deterministic policy results measure pressure and class differences; they do not substitute for human play feedback.

## Complete-game quality pass

Campaign checkpoints now retain applied boss phases and frozen terminal settlement data until acknowledgment, including a zero-HP defeat. Negative-turn bargains adjust endure objectives to the available opening budget; reinforcement turns extend the total budget while retaining turns already used. All waves receive the equipped opening effects, Bloodbond heals only a living hero, and Cleansing Touch waives only the rank-appropriate source costs.

Campaign quest events are part of settlement. Cached older clients receive bounded default source events, while direct client reporting is denied to avoid duplicate or forged progress. The database contract fixture mirrors production columns, defaults, constraints, club foreign keys, and restrictive privacy policies. Account-wide progress survives club transfers; standings follow current membership.

The additional browser journeys use production UI input to clear chambers 1, 25, and 150, finish all six Expedition rooms with each class, and settle natural defeats and move exhaustion. Menu checks exercise failed writes, equipment slots, class switches, keyboard focus, first-run help, archived records, and secondary-source retries. No live player writes are made by these fixtures.

## Tutorial and puzzle-motion verification

The three-stage opening and motion refinement pass 1,010 unit tests, app TypeScript, scoped ESLint and the production build. All 36 authored gold routes remain playable through production controls. A separate browser pass completes 119 checks with no runtime errors at 320×568, 390×844 and 844×390, including reduced motion. It plays Learn → Practice → Trial → graduation, confirms the first independent chamber has no coaching, replays training as an existing player without increasing mastery, and checks Solo/Help preferences, undo, checkpoints, account changes and lost acknowledgements.

Animation checks measure actual CSS progress and transforms across rendered frames, compare all 36 tile rectangles for unchanged 44px targets, and require the moving stone to finish within half a pixel of its canonical artwork. They also verify bounded effect cleanup, quiet restore/undo/restart, background/resume behavior, zero running animations under reduced motion, and persistent gold guidance markers. The authored definitions, progression rules, live database and Combat Archive receive no changes in this pass.

## Connected-adventure verification

The expansion passes 984 unit tests, app TypeScript, scoped ESLint and the production build. Isolated PostgreSQL passes 24 replay/persistence groups and 13 DH Feat integration groups. Every one of the 36 authored gold routes was completed through production tap, swipe, arrow/WASD and directional controls, reaching 108 stars. A separate mobile/recovery pass completes 97 checks at 320×568, 390×844 with reduced motion, and 844×390. It verifies all six chapter tabs, guided first actions, mechanic introductions, area travel, concealed read-only maps, key pickup/door state, undo, restart, reload, account changes and exact request-ID recovery after a lost completion response. Browser fixtures make no live account writes.

The live database matches all 36 client gameplay definitions. Before/after fingerprints match across 20 existing datasets, including the original 18 definitions, puzzle profiles/results/receipts, archived combat data, wallets, equipment, and permanent DH Score receipts. Players who cleared the original 18 retain their records and can start adventure 19. The original combat routes retain their rules and receive a persistent Archive label. Asset auditing reports zero missing references or unused owned artwork.

The [pacing certificate](balance/rune-adventure-content.json) records each new adventure's exact push-first gold-route measurements, search effort, area transitions and rift use. The additions average 9.56 pushes and 38.33 actions versus 3.39 and 14.17 in the original campaign. Chapter capstones require 12, 14 and 15 pushes; the three-room finale takes 67 actions on its certified route. These are solver measurements, not human playtime estimates. All gold routes fit the live 75,000-state hint budget. Removing required locks or rifts prevents completion, so the mechanics contribute real dependencies.

## Initial spatial puzzle release verification

The puzzle release passes 888 unit tests, app TypeScript, the production build and scoped lint. Isolated PostgreSQL suites pass 18 replay/persistence groups and 12 DH Feat integration groups. All 18 authored gold routes were also completed through production tap, swipe, keyboard and directional controls, reaching 54 stars.

The mobile suite passes 60 additional checks at 320×568, 390×844 with reduced motion, and 844×390. It covers screen fit and 44px controls, all chapter tabs and guide pages, touch handoffs, undo/restart, genuine off-route worker hints, ignored stale hints, account-scoped reload recovery and an acknowledged retry after a lost completion response. Fixtures make no live player writes. Mobile taps activate on pointer release; compatibility clicks cannot duplicate a move, and canceled gestures do nothing.

The live backend contains the same 18 immutable gameplay definitions as the tested client. Before/after fingerprints match for twelve existing data sets, including combat records, wallets, class progress, equipment and permanent DH Score unlocks. The app introduction and game catalog now describe the puzzle journey; no old player data was reset.

## Earlier menu and acquisition polish verification

The polish pass passed 807 unit tests, app TypeScript, the production build and scoped lint. Browser checks exercised eleven menu routes at 320×568, 390×844 and 844×390, plus reduced motion. Actual fixture purchases, rank upgrades and quest claims reached centered confirmations; queued rewards deduplicated and acknowledged correctly. All 64 atlas cells decoded, battle and Bestiary identities matched, and inspection artwork/statistics/page controls stayed separate at all three sizes. The generated atlas originals remain in the cloud image workspace; the app serves four optimized local WebP sheets totaling about 2.3 MB. No player-data migration or reset is part of this presentation pass.

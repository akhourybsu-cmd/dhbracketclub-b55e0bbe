# Rune Delve: the Hollow

Rune Delve is a mobile fantasy puzzle RPG. Campaign preserves existing heroes, class tracks, relic collections and scores. Expeditions add a separate fresh-build roguelite loop; no player reset is required.

## Play loop

- **Expeditions:** six seeded chambers, persistent health/mana, twelve stackable blessings drafted one of three, two revealed routes between encounters, and eight sequentially unlocked Ascensions. The crypt offers balanced foes, Blood Hunt stronger foes and double-rank blessings, Sunken Vault an extra foe and score, and Lost Shrine healing with armored opponents. Earn shards by banking a result; active and abandoned runs earn nothing. Campaign equipment and masteries do not apply.
- **Campaign:** generated chamber objectives, layout zones, relic builds, class masteries, run bargains, branching milestones and boss mechanics. Existing canonical level identities remain unchanged; generator balance hydrates on read. Class experience reaches level 150.
- **Daily arena:** two minutes of active play against escalating waves, base class powers, and the same Convergence system. Backgrounding, pausing and enemy inspection stop the clock. One result per UTC day earns shards and XP. Result retries use a stable request ID even across midnight.
- **Convergence:** chain all four colors to release a bounded area strike, one mana and one guarded turn. Repeated colors retain existing charges. New legal chains are supplied automatically when a board runs out of moves.

## Visual and input design

Original locally hosted portal/hero artwork, vector creature portraits and a consistent teal/gold dungeon palette anchor the game. The game has its own Sanctum/Campaign/Hero/Armory navigation. Battle uses a compact enemy stage, health/ability HUD, four-sigil meter and stable Cast/Clear command deck. Detailed encounter rules, equipment math and the chronicle are available on demand. Drag, tap and keyboard inputs share chain validation. Cancellation never commits a move, and StrictMode does not replay gameplay callbacks.

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
RUNE_QA_URL=http://127.0.0.1:8092 node scripts/check-rune-mobile.mjs
RUNE_QA_URL=http://127.0.0.1:8092 node scripts/check-rune-menus.mjs
RUNE_QA_URL=http://127.0.0.1:8092 node scripts/check-rune-journeys.mjs
```

Browser fixtures mount production screens, hooks and input controls against an isolated backend; they do not post to live accounts. The matrix covers five viewport sizes in both app themes. Rune Delve retains its own dark dungeon palette inside either theme.

`balance-rune-campaign.ts` swept 14,400 class/chamber/seed combinations without an invalid combat state or an uncleared chamber across all samples. That campaign solver models class powers, chain tiers, Convergence and telegraphs, but excludes equipment, board zones/seals and boss phase damage increases. `balance-rune-expedition.ts` swept 600 runs at Ascensions 1, 4 and 8; its tactical solver cleared the highest tier in 68–80% of sampled runs depending on class, with 47–49 distinct builds in fifty seeds. Solver results establish reachability and reveal class differences; they do not substitute for human pacing feedback.

## Complete-game quality pass

Campaign checkpoints now retain applied boss phases and frozen terminal settlement data until acknowledgment, including a zero-HP defeat. Negative-turn bargains adjust endure objectives to the available opening budget; reinforcement turns extend the total budget while retaining turns already used. All waves receive the equipped opening effects, Bloodbond heals only a living hero, and Cleansing Touch waives only the rank-appropriate source costs.

Campaign quest events are part of settlement for clients supplying `quest_context`. Cached older clients retain their original producer, avoiding duplicate progress during rollout. The database contract fixture mirrors production columns, defaults, constraints, club foreign keys, and restrictive privacy policies. Account-wide progress survives club transfers; standings follow current membership.

The additional browser journeys use production UI input to clear chambers 1, 25, and 150, finish all six Expedition rooms with each class, and settle natural defeats and move exhaustion. Menu checks exercise failed writes, equipment slots, class switches, keyboard focus, first-run help, archived records, and secondary-source retries. No live player writes are made by these fixtures.

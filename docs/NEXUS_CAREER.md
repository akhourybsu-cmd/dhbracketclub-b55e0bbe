# Nexus defender career

Career adds long-term identity and clear goals to the existing Endless loop. All progress derives from the cloud-saved profile: `total_waves`, `endless_best`, `unlocks` and `research`. A completed defense contributes its cleared waves after settlement. Zero-wave runs contribute none. Career adds no extra currency, prices, combat modifiers or timed requirements.

## Ranks

| Rank | Title | Lifetime waves |
| --- | --- | --- |
| 1 | Recruit | 0 |
| 2 | Sentinel | 25 |
| 3 | Warden | 75 |
| 4 | Vanguard | 150 |
| 5 | Guardian | 300 |
| 6 | Commander | 600 |
| 7 | Paragon | 1,000 |
| 8 | Nexus Prime | 2,000 |

The crest in every menu header opens Defender career. The progress bar measures waves within the current rank; the panel also shows the total and remaining waves to the next rank. Nexus Prime retains a full bar and a max-rank label. Endless record goals continue beyond it.

## Medals

| Medal | Permanent requirement |
| --- | --- |
| First Light | Bank one cleared wave |
| Siegebreaker | Clear wave 5 |
| Armed & Ready | Own an auxiliary weapon |
| Full Arsenal | Own all four auxiliaries |
| Tactician | Own all three support modules |
| Core Engineer | Complete 15 permanent research levels |
| Veteran | Bank 100 lifetime waves |
| Apex Defender | Clear wave 25 |

Ownership medals remain earned when credits are spent or weapons are unequipped. Progress never depends on the current wallet or equipped build. The career panel pages four medals at a time and shows the selected medal's requirement and progress. It remains an optional panel; primary menus keep their fixed viewport layout.

## Goals and feedback

The title's target strip recommends equipping an owned auxiliary when the build is empty, then purchasing eligible equipment when its lifetime-wave gate and credit cost are met. Otherwise it selects the next unpaid personal wave milestone. After wave 25 it targets the next multiple of five for a personal record, without promising another milestone bonus.

Combat shows a compact next-wave target. Progress during combat is provisional; credits and lifetime waves are banked through the existing settlement RPC.

Successful equipment purchases show a system-acquired reveal and a direct Equip now link to the purchased item. The player still chooses whether to install and save/deploy it. Failed purchases show an error and never open an acquisition reveal. Research uses the compact upgrade feedback, with a mastery message for its final level.

Results compare the account snapshot on entry with the saved profile after a successful reward claim. A promotion changes the result headline to Rank up; newly earned medals receive their own headline. The reward panel shows rank progress and the number of career waves banked by that claim. Retry failures cannot advance the profile or celebrate an unconfirmed promotion. Refreshing an already claimed result starts from the updated profile, so it does not repeat the promotion/medal headline or add progression again. These are presentation effects over the existing idempotent server receipt.

Existing ruleset-4/5 Endless progress counts toward career. Archived campaign/challenge settlement retains its original behavior. The core balance version remains 5.

## Implementation and checks

- `src/lib/nexus/core/career.ts`: pure rank thresholds, medal conditions, account snapshots, outcome comparison and goal selection.
- `CoreCareer.tsx`, `CoreUnlockReveal.tsx` and `career.css` in `src/components/nexus/core/`: optional career panels, rank crests, result summaries, acquisition reveals and reduced-motion behavior.
- `coreCareer.test.ts`: rank boundaries, bounded progress, zero-wave behavior, durable ownership, research caps, outcome idempotency and valid objective selection.
- `node scripts/check-nexus-career.mjs`: real UI/hooks with the isolated backend across eight phone, landscape, tablet and desktop sizes; acquisition/equip flow, maximum career, offline retry, first medals and duplicate receipts.
- Existing menu, game-feel and economy browser checks remain applicable. No live player data is modified by the checks.

# Afterimage

Afterimage is the visual-memory adapter for DH Showdown (`afterimage`, rules version 1). Open **Compete → DH Showdown → Afterimage**. It uses the existing Showdown installation, authentication, club permissions, invitations, notifications, records, rivalries and rematches.

## Playing

A match freezes one easy, medium and hard scene for both members. Players complete them independently within the shared 72-hour window. **Ready** starts a seven-second server observation. Before Ready, players can leave without losing that opportunity; afterward, the clock continues across reloads, backgrounding and devices.

Restore missing objects by dragging, tapping an object and target, or using Tab and Enter/Space. Placements can be changed, swapped, removed or reset before submission. Reconstruction gives no correctness feedback. Incomplete or empty arrangements can be submitted. Each final ranked scene is sealed.

After both players finish, results show points, perfect memories, round accuracy and rivalry. Completed scenes compare the correct original with either player's reconstruction, including correct/incorrect placements and unused distractors. Declined, cancelled, expired and membership-invalidated challenges create no win or loss.

## Artwork and content

Thirty original inline SVG objects share warm, outlined artwork. Six miniature environments—workshop, greenhouse, harbor, clockmaker, kitchen and observatory—use layered backgrounds and a logical 1,000 × 700 coordinate system. Artwork ships with the game; there is no image-generation service, remote image API or heavy game engine. Ready waits for the local artwork components to mount.

The launch catalog has **18 authored variants, six per difficulty**. Easy has nine original objects and three missing objects. Medium has 12 originals, four missing objects and one distractor. Hard has 15 originals, five missing objects and two distractors. Every object has distinct identity, artwork and accessible label. Targets are 180 × 160 logical units, with validated bounds and separation. Scene positions, missing selections and tray order are frozen at challenge creation.

Canonical definitions live in `supabase/seed/afterimage-library.json` and its SQL seed. The authoring script and SQL publication validator check identities, complete asset references, private mappings, neutral targets, distractors, geometry and accessibility. The production import graph excludes the canonical catalog and authoring scripts.

## Timing, privacy and recovery

Three new RPCs extend the shared workflow:

- `showdown_start_study` creates one participant/round's original start and expiration timestamps. Repeated calls return its current phase without renewing the window.
- `showdown_save_reconstruction` accepts legal placements after observation expires, guarded by revision and request identity.
- `showdown_submit_reconstruction` validates and seals the final arrangement, calculates its score and uses shared match finalization.

Ready returns no objects. Study returns originals only during the server window. Reconstruction returns fixed objects, neutral slots and tray pieces without removed objects' original coordinates. Correct answers appear only in a completed match's review. Closed challenges expose no scene art. Opponent results remain sealed until both finish. Direct base-table access and private helper execution remain denied to members and anonymous callers.

The client subtracts the full request round trip from server remaining time and uses `performance.now()` for elapsed time, so device wall-clock changes cannot extend observation. Backgrounding or expiration immediately conceals the original. Safe reads reconcile the server phase; a conservatively early cutoff stays concealed until reconstruction becomes available. An interrupted Ready request checks existing status instead of automatically starting again.

A user/club/match-scoped outbox stores only the member's placements and retry identities, never scene art or answers. Serialized saves preserve edits made during an older request, use semantic JSONB comparisons, and restore authoritative placements on device conflicts. Delayed polls cannot reopen study or a retired round. Sign-out clears private device caches.

## Scoring and achievements

Each scene earns `round(100 × correct placements ÷ required objects)`, plus 25 for a perfect reconstruction. Distractors score nothing. Maximums are **125 per scene and 375 per match**. Ties compare perfect reconstructions, then draw. Repositioning, elapsed time and network speed do not affect scores.

Standings and rivalries are game-specific. Existing general Showdown match/win/rival Feats qualify completed attempts with a positive personal score, including partial Afterimage accuracy. Zero-score attempts earn no such engagement awards. Prism-only Feats and existing permanent awards retain their behavior.

## Migrations and checks

Apply after the original three Showdown migrations:

1. `20261101040000_afterimage_foundation.sql`: game registration, round-state extensions, immutable study timing, phase-safe projections, reconstruction controls, scoring, qualification and feature descriptions. Existing Prism implementations remain behind secured versioned helpers.
2. `20261101050000_afterimage_library.sql`: 18 validated immutable scene definitions.

```sh
node scripts/author-afterimage.mjs --check
node scripts/test-afterimage-db.mjs
node scripts/test-afterimage-feats-db.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run test:unit -- --maxWorkers=1 --no-file-parallelism
npm run build
node scripts/check-afterimage.mjs
```

Database suites use isolated PostgreSQL-compatible instances. Browser checks use production pages/hooks/game components with local identities and transport, creating no live member matches. See the runner for section selectors. Existing Prism tests verify shared-system compatibility. Running these commands does not itself establish deployment or publishing status.

Screenshots, external notes and inspection of already-delivered observation data cannot be perfectly prevented on an untrusted browser. The server enforces consistent study windows and scoring for casual competition. The launch library reuses its 18 variants; additional content can ship as validated immutable versions.

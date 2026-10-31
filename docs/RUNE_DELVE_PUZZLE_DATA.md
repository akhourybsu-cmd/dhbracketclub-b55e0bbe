# Rune Delve spatial puzzle data

The spatial journey starts a separate account progression track. It never resets or credits the legacy combat wallet, class XP, old scores, relic ranks, or old campaign clears. Stars are mastery records, not a spendable currency.

## Canonical definitions and replay

`src/lib/runedelve/puzzles/rooms.json` is the authored client catalog. Its first 18 released objects remain unchanged. `node scripts/sync-rune-puzzle-seed.mjs` validates only that launch catalog and rejects changes to its semantic hash; it never inserts expansion content into the deployed launch migration. After adventure content is frozen, run `node scripts/sync-rune-adventure-seed.mjs`. That script validates every new definition, replays its supplied gold solution through the production engine, and updates only the append-only seed in `20261031090000_rune_delve_adventures.sql`. Stored definitions omit the authored hint solution while retaining the complete gameplay definition.

Definitions are immutable for `(room_id, definition_version)`. Reapplying the migration with changed gameplay under the same identity raises an error instead of silently changing deployed puzzles. A future rules or geometry change needs a new version and an explicit progression-continuity policy. Optimizing the supplied hint solution alone does not change the stored definition.

Completion accepts only the room identity, version, action trail, and request UUID. PostgreSQL replays the canonical definition itself, including:

- Orthogonal movement and one-stone pushes, without row wrapping.
- Hero entry and initial stone landing checked against the pre-action board.
- All gates opening when a hero or stone holds any plate; occupied gates remain open until vacated.
- Ice moving pushed stones only, with current plate/guardian state reevaluated for every slide step.
- Guardians remaining alive, blocking their cell until their matching sigils are restored.
- Hero-only treasure pickup, matching-color sigils, and exit completion.
- Connected adventures with two or three 6×6 areas. Global cells are `areaIndex*36+localCell`; ordinary neighbors can never cross an area edge.
- Player-only passages and rifts. Entering an endpoint travels once to its paired destination. Runestones cannot enter an endpoint, including while sliding over ice.
- Reusable colored keys, collected by the delver, opening every matching lock. Initial entry and stone landing use the pre-action inventory. A key revealed under a pushed stone is then collected before its ice slide continues, so it can open a later door in that slide.
- Optional inventory and explored-area state, deterministically reconstructed from the action trail. Single-room launch states retain their original shape. Exploration history is cosmetic and does not change victory or star scoring.

Invalid directions, blocked moves, incomplete solves, actions after a solve, unavailable versions, locked rooms, and trails longer than 1,200 actions reject the completion. Undo is represented by the remaining canonical trail, so retries and experimentation have no score penalty.

## Tables and RPCs

| Object                                                                           | Purpose                                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `rune_puzzle_definitions`                                                        | Immutable room rules and active campaign order.           |
| `rune_puzzle_profiles`                                                           | Account-owned cosmetic avatar.                            |
| `rune_puzzle_results`                                                            | Best stars and push-first best result per room/version.   |
| `rune_puzzle_receipts`                                                           | Immutable acknowledgements per account/request UUID.      |
| `rune_puzzle_profile()`                                                          | Initialize a safe profile and return derived progression. |
| `rune_puzzle_select_avatar(p_avatar)`                                            | Validate and save one of the four appearances.            |
| `rune_puzzle_complete(p_room_id, p_definition_version, p_actions, p_request_id)` | Replay, settle, unlock, and acknowledge atomically.       |

Authenticated players can read only their own profiles and results. Direct mutation of all four tables is denied. Definitions and receipts have no direct client read permission. Internal replay/progression helpers cannot be called by public, anonymous, or authenticated clients. Public RPCs use `auth.uid()` rather than accepting a caller-selected account.

## Mastery and retries

A solved attempt earns one star, an additional star for staying within the push par, and another for collecting every optional treasure. The best single-attempt star total is retained; repeated clears cannot mint additional stars after that best is reached. Treasure discovery is also retained independently. The efficiency record minimizes pushes first and walking moves only when push counts tie.

The first valid clear unlocks the next adventure. Progress counts, stars and the frontier are derived from active canonical definitions and saved results. Adding adventures 19–36 therefore opens adventure 19 for a player who already completed the original 18, retaining all 54 earned stars and every record. The expanded frontier caps at 36. A connected adventure still settles a single result across all its areas; its treasures and sigils are evaluated together.

A completion request UUID and action trail must remain unchanged while retrying a terminal save. An identical retry returns the original receipt exactly, even after later progress or retirement of its definition. Reusing the UUID with a different room, version, or trail rejects the request. New completion attempts use new UUIDs. Because a frozen receipt contains its original progression snapshot, the client merges progress monotonically and refetches the current profile rather than demoting a newer cache or restoring an old avatar selection.

## Verification

`node scripts/test-rune-puzzle-db.mjs` runs isolated PostgreSQL checks under authenticated and anonymous roles. It verifies all 36 authored gold solutions, sequential settlement to 108 stars, first-clear and star-delta behavior, UUID reuse, stale receipt retries, account privacy, forged-write denial, immutable definitions, migration reruns and unchanged legacy data. It completes the original 18 under the old SQL rules before applying the expansion, fingerprints their definitions and saved rows, then proves that their pending acknowledgements stay byte-for-byte equivalent while the current frontier advances to 19.

The suite compares 280 seeded action traces plus explicit mechanic prefixes with the production engine. It also checks every neighbor on all 108 cells, passage and rift travel, reusable locks, initial-key collection, key-before-ice ordering, player-only endpoint restrictions, remote pressure gates and cross-area guardians.

The runtime suite never connects to production. The optional `--allow-unseeded` flag is only for preliminary engine/SQL development and does not claim that the launch catalog has been verified.

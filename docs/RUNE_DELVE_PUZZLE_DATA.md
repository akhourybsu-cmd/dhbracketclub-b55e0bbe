# Rune Delve spatial puzzle data

The spatial journey starts a separate account progression track. It never resets or credits the legacy combat wallet, class XP, old scores, relic ranks, or old campaign clears. Stars are mastery records, not a spendable currency.

## Canonical definitions and replay

`src/lib/runedelve/puzzles/rooms.json` is the authored client catalog. Run `node scripts/sync-rune-puzzle-seed.mjs` after content is frozen. The script validates every definition, replays every supplied gold solution through the production TypeScript engine, and updates the marked seed block in `20261031050000_rune_delve_spatial_puzzles.sql`. Stored definitions omit the authored hint solution, while retaining the complete gameplay definition.

Definitions are immutable for `(room_id, definition_version)`. Reapplying the migration with changed gameplay under the same identity raises an error instead of silently changing deployed puzzles. A future rules or geometry change needs a new version and an explicit progression-continuity policy. Optimizing the supplied hint solution alone does not change the stored definition.

Completion accepts only the room identity, version, action trail, and request UUID. PostgreSQL replays the canonical definition itself, including:

- Orthogonal movement and one-stone pushes, without row wrapping.
- Hero entry and initial stone landing checked against the pre-action board.
- All gates opening when a hero or stone holds any plate; occupied gates remain open until vacated.
- Ice moving pushed stones only, with current plate/guardian state reevaluated for every slide step.
- Guardians remaining alive, blocking their cell until their matching sigils are restored.
- Hero-only treasure pickup, matching-color sigils, and exit completion.

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

The first valid clear unlocks the next room. The final launch room retains an unlock cap of 18. Progress counts and stars are derived from canonical active definitions and saved results, so clients cannot forge an unlock counter.

A completion request UUID and action trail must remain unchanged while retrying a terminal save. An identical retry returns the original receipt exactly, even after later progress or retirement of its definition. Reusing the UUID with a different room, version, or trail rejects the request. New completion attempts use new UUIDs. Because a frozen receipt contains its original progression snapshot, the client merges progress monotonically and refetches the current profile rather than demoting a newer cache or restoring an old avatar selection.

## Verification

`node scripts/test-rune-puzzle-db.mjs` runs isolated PostgreSQL checks under authenticated and anonymous roles. It verifies replay parity with the TypeScript engine, all 18 authored gold solutions, sequential settlement, first-clear and star-delta behavior, UUID reuse, stale receipt retries, account privacy, forged-write denial, immutable definitions, migration reruns, and unchanged legacy data. Seeded action traces exercise invalid boundaries and state transitions in addition to authored successful routes.

The runtime suite never connects to production. The optional `--allow-unseeded` flag is only for preliminary engine/SQL development and does not claim that the launch catalog has been verified.

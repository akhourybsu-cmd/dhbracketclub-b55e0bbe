# CIPHER DUEL

Cipher Duel is the `cipher_duel` / `cipher_v1` adapter within DH Showdown. It reuses the existing account, active club, asset installation, invitation, notification, history, rivalry, standings and permanent DH Feats infrastructure. Prism Break and Afterimage retain their own rules and stored content. No The Tell integration was present in this repository.

## Member flow

Open **Compete → DH Showdown → CIPHER DUEL** and choose a club rival. The full-screen code maker at `/showdown/cipher/new` opens before a challenge exists. Select four pegs, including repeated colors if desired, then confirm **Lock this code**. Only that confirmation creates the challenge, stores the immutable code and sends the invitation.

The recipient can inspect the invitation, decline, or create their own code. Opening a Cipher invitation never accepts it automatically. Locking the recipient's code accepts directly, without another acceptance step. Both codes are then immutable and each player independently tries to break the other. Their own locked code remains visible as a reference.

The invitation lasts 72 hours from creation. The second code lock starts a new, full 72-hour gameplay window. Both deadlines are stored on the shared challenge, and the current deadline remains in `expires_at` for shared maintenance. Expiration or membership invalidation before both attempts finish produces no contest, never an automatic victory.

## Rules and results

Four positions use stable IDs `red`, `blue`, `green`, `yellow`, `purple`, `orange`. Repeats are legal, including four identical colors. Each player has ten guesses. The backend calculates aggregate clues: black means correct color and position; white means correct color in another position. Exact matches consume their pegs first, and remaining colors are counted once. The separate clue cluster never maps clues to individual guess positions.

A player finishes by solving with four exact matches, exhausting ten guesses, or surrendering. Once both attempts are terminal, a successful solver beats an unsuccessful player; two solvers compare guess counts; equal successful guess counts and two unsuccessful attempts draw. There are no timing tiebreakers, numeric game scores or hidden bonuses. Shared standings still use their documented three points per win / one per draw, independently of gameplay.

Completed results reveal both codes and immutable guess histories. The initial comparison stays compact; either player's full board is available on demand. Rematch returns to a blank code-maker flow, creates a new challenge only after another confirmation, and requires both members to lock codes again.

## Server authority and privacy

The existing `showdown_challenges` and `showdown_attempts` remain the match ledger. Cipher has zero puzzle-round rows. Three restricted game tables store immutable codes, participant attempt state and append-only guesses. RLS is enabled and authenticated/anonymous roles have no direct CRUD privileges. Private helpers, including feedback, state projection and statistics, are not member-callable.

Four authenticated gameplay RPCs extend the shared system:

- `showdown_create_cipher`: atomically creates the shared challenge, creator's code, attempts and invitation.
- `showdown_lock_cipher_code`: stores the recipient's immutable code and atomically begins the gameplay window.
- `showdown_submit_cipher_guess`: checks membership, phase, expiry, expected guess count and request identity; calculates and stores feedback transactionally.
- `showdown_surrender_cipher`: seals an open attempt without fabricating guesses.

Existing `showdown_get`, lobby and invitation actions dispatch to the versioned Cipher adapter. Active responses contain only the caller's code, guesses and feedback, plus the opponent's general code-lock/completion flags. Both codes and both histories appear only after authorized completion. Request receipts and notifications never copy code values. No service credentials, answer hashes used as access protection, or private-code subscriptions are introduced.

Challenge locks serialize code acceptance, guesses, expiry, membership changes and finalization. Optimistic guess counts prevent another device's submission from silently consuming a second row. Stable request UUIDs make retries safe, including lost responses. Database constraints and triggers protect code shape, sequence limits, feedback correctness, locked clocks, sealed attempts and completed results.

## Device recovery and controls

The creator's setup draft and pending lock identity are scoped to user, club, rival and rematch. Match drafts and pending actions are separately scoped to user, club and challenge. Only the member's own draft/code and retry identity are stored locally; official histories are restored from the server. Sign-out clears these private caches. Confirmed unknown-outcome actions stay immutable until the same receipt is recovered; editable drafts never submit themselves.

Monotonic cache/session guards reject stale code locks, guess histories and terminal states. JSONB key order does not affect comparisons. A delayed response cannot clear the next draft or falsely acknowledge a surrender after another device guesses.

The physical-board UI has recessed sockets, dimensional pegs, six persistent shape symbols, a separate clue cluster and anchored touch controls. Earlier rows use one history region. Keyboard operation, focus outlines, readable clue counts, reduced motion and safe-area layouts are supported. A six-step visual guide includes a repeated-color example and persists completion using the existing per-user local guide convention; Help remains available.

## Statistics and achievements

Only completed ranked matches affect Cipher records, solved/failed counts, total successful guesses, average/best successful solve, first-guess reads and current/longest win streaks. Draws and losses break winning streaks; no contests are excluded. Rivalries remain game- and club-scoped.

Six permanent achievements use the existing catalog/evaluator/ledger: FIRST BREAK, CODE CRACKER, MASTER DECODER, UNBREAKABLE, RIVALRY and PERFECT READ. Their combined finite value is 75 DH points. General Showdown engagement awards include Cipher attempts with at least one submitted guess; zero-guess surrender records receive no engagement credit. Prism and Afterimage keep their prior positive-score rules. Existing earned receipts remain intact.

## Migrations and verification

1. `20261101060000_cipher_duel_foundation.sql`: registers Cipher, extends shared stage deadlines/events, adds private game tables and secured versioned RPCs, projections and statistics.
2. `20261101070000_cipher_duel_feats.sql`: adds six catalog awards, extends the existing evaluator, supports roundless attempts in general metrics and updates discovery copy.

Relevant checks:

```sh
node scripts/test-cipher-db.mjs --proof
node scripts/test-cipher-feats-db.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run test:unit -- --maxWorkers=1 --no-file-parallelism
npm run build
node scripts/check-cipher.mjs
```

The engine tests exhaust all 1,679,616 secret/guess pairs against an independent oracle. Isolated database tests cover authorization, code privacy, clocks, sequencing, retry/concurrency, feedback, statistics and existing-game compatibility. Browser fixtures use the production pages, hooks and controls with isolated local transport and JSONB serialization; no live member matches are created. `CIPHER_QA_SECTION` selects individual browser scenarios when needed. Running local checks does not itself prove database deployment, a Git push or public-site publication.

Codes have 1,296 possible combinations under these fixed rules. Outside assistance, sharing codes or coordinated play cannot be perfectly prevented on untrusted devices. Server authorization protects stored secrets and official outcomes; it does not claim to prevent all casual-game collusion. Tutorial completion and unsubmitted drafts are device preferences; confirmed code locks and guesses resume across devices through the server.

# DH Showdown

## Member experience

Showdown includes **Prism Break** and **Afterimage**. The shared workflow is described here; [Afterimage](AFTERIMAGE.md) documents its observation timer, illustrations, reconstruction rules and additional migrations.

Open **Compete → DH Showdown**. Choose an enabled game and another member of your current club. The creator can play immediately: **Play my boards now** is selected by default, and can be unchecked to stay in the lobby after sending. The recipient opens the notification or incoming card and begins playing directly; there is no acceptance lobby or simultaneous-online requirement.

The discovery migration installs Showdown automatically for existing clubs with Draft Arena enabled and visible to members. Other clubs, including new clubs with an empty feature library, need a club administrator to install and enable **DH Showdown** in the existing **Asset Library** at `/club/assets`. Existing Showdown installation settings are preserved.

Each Prism Break match contains one easy, one medium, and one hard board. Tap numbered mirrors or use the large selected-mirror controls. Match the receiver colors and symbols. Filters and explicitly encoded prisms appear as difficulty increases. Every rotation counts, including a rotation back to an earlier orientation. Reset restores the board but keeps the rotation count. Skip is always available for zero points.

A solved board submits after a short success presentation and opens the next board without waiting for the opponent. Move checkpoints and round receipts are saved. Leaving and returning resumes the next unsubmitted board; a sealed ranked round cannot be replayed for a better score. Unsynced device moves have a user/club/match-scoped durable outbox. Explicit sign-out removes that private device cache.

An unfinished opponent's score and actions remain sealed. After both attempts finish, the match shows both scores, all three round results, solved counts, rotations, a rivalry record, and a rematch action. Open a completed round to inspect either player's final board. History retains completed and closed invitations. A declined, cancelled, expired, or membership-invalidated challenge does not create a win or loss.

## Architecture and extension points

- React/TypeScript, React Router, React Query, existing AuthContext/ClubContext, and Supabase remain the application stack. No parallel account, membership, or notification system is introduced.
- `/showdown` and `/showdown/:challengeId` use the existing protected route and installed-asset guard. The existing shared shell recognizes Showdown as immersive. Discovery belongs in Compete and the games navigation, without a new homepage promotion.
- `src/lib/showdown/registry.ts` registers `prism_break` rules version 1, its identity, gameplay, result/board presentation, initialization, replay validation, scoring, and comparison helpers. Old rules are selected from the challenge's frozen version rather than the current release version.
- `src/lib/showdown/service.ts` supplies the common RPC transport. `useShowdownLobby` and `useShowdownMatch` supply account/club-scoped fetching, history pagination, mutations, refreshes, and recovery. `ShowdownRoundSession` serializes writes and retains retry request IDs. A delayed response cannot reopen a retired round or discard a newer round's local moves.
- `showdown_games`/`showdown_rules` register backend games and versioned scoring adapters: `prism_v1` (three rounds, maximum 1,500) and `afterimage_v1` (three scenes, maximum 375). New games add a versioned initialization/validation/scoring adapter and registry entry while retaining the shared invitation, membership, notification, persistence, completion, rivalry, and history workflow. Rules changes use a new version; existing puzzles and challenges are never rewritten.

## Database and authority

Migrations, in order:

1. `20261101010000_showdown_foundation.sql`: game/rules registry, private validated puzzle catalog, challenge snapshots, attempts, round states, idempotency receipts, notification receipts, RPCs, immutable-state guards, and maintenance.
2. `20261101020000_prism_break_library.sql`: 18 independently validated published boards, stored outside the client bundle.
3. `20261101030000_showdown_discovery_feats.sql`: installed-asset discovery and the existing permanent DH Feats ledger extension.

All ranked writes go through authenticated, scoped, transactional PostgreSQL functions. Authenticated/anonymous users have no direct base-table reads or writes. Private helpers are not callable by members. An actor must belong to the active club and participate in the challenge. New opponents must be visible current members of that same club. Existing privacy helpers keep private testing identities out of shared activity and standings.

The server selects and freezes the exact puzzle IDs, versions, definitions, and verified minima at creation, using least-recent selection across both rivals before a server-controlled tie order. Each player receives the same initial board. Boards unlock sequentially; a round's verified minimum is returned only after that player's round is sealed, or when the entire match is completed. The server never returns the opponent's action log before both attempts finish.

The server reconstructs mirrors from the frozen initial state and action log, traces all rays, validates the final receiver state, and calculates the score. Clients submit no authoritative score or winner. Checkpoints must extend the saved action prefix and match its revision. Reset does not erase earlier actions. Requests have stable UUID receipts checked before replaying a mutation. Row locks serialize simultaneous final submissions. Sealed rounds, finished attempts, completed matches, and frozen boards reject mutation, including through service-role writes.

Creation is limited to 12 invitations per challenger per hour and 30 active challenges per player. Checkpoint writes are also rate limited. Unavailable, expired, conflicting, or removed-member states are handled on the server. Completed history is retained when a former opponent leaves; an unfinished ineligible match is closed without a result.

## Puzzles and scoring

The shipped library has **18 distinct boards: six easy, six medium, six hard**. Board sizes are 5–7 cells per side. Medium introduces filters; hard includes split beams, multiple receivers/emitters, and cascading prisms. Exact minima are 2–3, 4–5, and 6–7 rotations respectively. The largest shipped BFS search visits 1,615 states within the 4,096-state publication budget.

`scripts/author-prism-break.mjs --check` verifies the authored library and seed without rewriting them. `prismLibrary.test.ts` independently exhausts orientation configurations to verify every minimum. The SQL publication validator also checks solvability, initial unsolved state, legal tiles and explicit optical rules, mobile bounds, and the exact minimum. An unvalidated board cannot be published. Private catalog, authoring fixtures, and offline solver code are excluded from production imports.

For a solved round:

`300 + min(200, round(200 × verified minimum rotations / actual rotations))`

Skip earns zero. A solved optimal board earns 500; three optimal boards earn 1,500. Match order is higher total score, more solved rounds, then fewer total rotations. A complete tie is a real draw. Neither time, network speed, nor device performance affects the result.

Standings are game-specific. Match points are **3 per win, 1 per draw, 0 per loss**; unrelated raw mini-game scores are not compared. DH Feats use the existing permanent award ledger and six finite achievement families. Invitations and all-skip attempts award no Feats. Activity days use the member's own actual finish date, gated by the eventual completed match.

## Notifications and maintenance

Incoming invitations, rematches, finished opponent attempts, and results are real entries in the existing notification inbox, with links to the protected match. Private notification receipts prevent duplicate sends on retries.

Expiration defaults to 72 hours and is authoritative whenever a challenge is read or written. Where the existing `pg_cron` extension is installed, one 30-minute job reconciles public active matches and sends one reminder per unfinished participant during the final 12 hours. The scheduler does not grade or simulate play. Private testing clubs use their authenticated lazy reconciliation path. Without `pg_cron`, lazy expiration remains correct and no automatic-reminder claim is made.

## Verification and limits

Unit/component tests cover optics, cycles, solver bounds/minima, all authored boards, scores/ties, transport, recovery, stale responses, account/club isolation, and actual controls. Isolated PostgreSQL checks cover authorization, catalog/privacy denial, SQL/TypeScript parity, simultaneous completion, replay/prefix/revisions, immutable results, expiration, member removal, rate limits, notification delivery/rollback, history, and achievements. Browser fixtures replace transport only and exercise production pages/hooks/engine with two asynchronous actors on mobile and desktop. They never write live member data.

After installing the repository dependencies and its existing Playwright browser setup, reproduce the checks with:

```sh
node scripts/author-prism-break.mjs --check
node scripts/test-showdown-db.mjs
node scripts/test-showdown-feats-db.mjs
npm run test:unit -- --maxWorkers=1 --no-file-parallelism
npx eslint src/lib/showdown src/components/showdown src/pages/ShowdownPage.tsx src/pages/ShowdownMatchPage.tsx src/hooks/useShowdown.ts
npx tsc --noEmit -p tsconfig.app.json
npm run build
node scripts/check-showdown.mjs
```

The database suites use isolated PGlite instances. The browser runner starts its own local fixture server and reports its artifact directory. These commands verify local behavior; they do not deploy migrations, push Git commits, publish the website, or establish that a production rollout is complete.

Device action logs improve replay verification and recovery but cannot prove that an untrusted browser user solved a board without external assistance. Further content can add new immutable versions and boards; no runtime AI generation is involved. The match duration target is approximately 60–120 seconds, with no clock-based scoring or enforced delay.

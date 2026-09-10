# NFL per-game deadlines and live results

## Activate this update

Crazy Chain now closes **30 minutes before kickoff**. Weekly Pick’em and its
featured-game tiebreaker remain at **48 hours**. If the previous per-game SQL is
already installed, run only [Crazy Chain 30-minute SQL](sql/CRAZY_CHAIN_30_MINUTES.sql).
Otherwise use the combined file below, which includes this change.

1. Copy/paste the **entire** [combined SQL file](sql/NFL_PER_GAME_AND_LIVE.sql) into the project's SQL editor.
   It is transactional, rerunnable, and upgrades either the original Crazy Chain
   schema or the later catch-up schema. It preserves picks, leg IDs, and targets.
   This supersedes the previous remaining-games SQL instructions.
2. Deploy these six Edge Functions from an authenticated Supabase CLI, or through
   the project's Lovable/Supabase deployment workflow:

   ~~~sh
   supabase functions deploy sync-nfl-week
   supabase functions deploy score-nfl-week
   supabase functions deploy score-nfl-crazy-chain
   supabase functions deploy sync-nfl-live
   supabase functions deploy refresh-nfl-chain-boards
   supabase functions deploy pickem-week-reminder
   ~~~

3. Preview/publish Weeks 1 and 2 once in **Crazy Chain Control Room** to stamp fresh
   player availability. Existing markets are not deleted; games inside 30 minutes
   remain visible but cannot receive new picks.
4. Verify the protected **nfl-live-results** job is active, running every five minutes,
   and its latest run/function logs show success. SQL creates this job by reusing
   the existing protected reminder request when available. If that job does not
   exist, configure a POST to **sync-nfl-live** every five minutes using the existing
   server-side CRON_SHARED_SECRET. Never put credentials in browser code or Git.

Git push, SQL execution, and server deployment are separate. The UI disables
per-game writes until the new database mode is confirmed.

## Live verification / current deployment blocker

On September 10, 2026, the deployed **sync-nfl-week** returned HTTP 502 with
**ESPN fetch failed: 403**. The same official scoreboard was accessible locally.
Automatic results are **not verified operational** until the deployment environment
can read that feed and a protected scheduler run succeeds. Running the SQL alone
does not fix provider access.

Using the existing commissioner permission, the identity-verified Week 1 opener
(Seattle 13, New England 10) was imported and the existing scorer processed five
Pick'em entries. No selections or future games were edited. Until automatic access
is restored, commissioners can verify official finals, save them in Pick'em Admin,
then use **Score**. Deploy the new scorer before relying on completed-week wins:
the old deployed scorer can count provisional leaders as weekly winners.

## Deadlines — both games

- **Crazy Chain:** every matchup closes exactly **30 minutes before kickoff**.
  A Thursday 8:15 PM game closes Thursday 7:45 PM.
- **Weekly Pick’em:** still closes **48 hours before kickoff**. The same Thursday
  game closes Tuesday 8:15 PM. Both use elapsed time, displayed in the viewer’s
  local timezone.
- One game closing does not freeze other games. Pick'em saves each team
  selection immediately; Crazy Chain has a **Save game picks** button per matchup.
- The Pick'em tiebreaker closes 48 hours before its featured game's kickoff.
- Saved picks and target snapshots are retained. Upcoming Crazy Chain games
  previously inside the 48-hour window reopen if still before their 30-minute
  deadline. Games already live/final, or inside 30 minutes, stay locked.
- The database keeps separate frozen cutoffs: legacy `chain_lock_at` is Pick’em’s
  unchanged 48-hour cutoff; `crazy_chain_lock_at` is Crazy Chain’s 30-minute cutoff.
- Postponement never reopens a deadline. Earlier rescheduling closes it sooner.
- Pick'em reveals each matchup's club percentages at its own deadline. Other
  games remain private. Crazy Chain's weekly storage envelope stays private
  until all its game deadlines pass, avoiding leaks of future selection counts.

## Crazy Chain scoring

Each game is an all-or-nothing set of predictions. All non-void picks must hit to
add one link per hit. A missed game breaks the chain; skipped/fully voided games
leave it unchanged. Later games can build a new chain even after an earlier miss.

The chain is reconstructed in **kickoff order**, not whichever provider request
finishes first. Picks on games starting at exactly the same time form one step:
all must resolve, and any miss resets that step. This avoids arbitrary game-ID
ordering affecting rankings. An unresolved earlier step holds later chain credit;
individual results and hit totals still update, with a pending indicator.

- Repeated result checks never double-credit. Corrected final statistics rebuild
  the chain and personal best from source results.
- Saved leg thresholds are immutable snapshots used for grading.
- Commissioner decisions take precedence over automatic updates.
- Weekly containers remain for compatibility; the UI and chain standings use
  game results. Perfect-game counts are separate from legacy perfect-week counts.

## Live data and grading

The lightweight results job checks recent game weeks every **five minutes**,
including the prior week for late stats/corrections. It does not wait for a whole
week to end, and does not run the heavier roster importer on every tick.
Member screens refresh every **30 seconds**, including when a game first goes
live; unsaved Crazy Chain drafts survive background refreshes.

This is near-live polling, not a play-by-play stream. Latency depends on ESPN
publishing a final result, scheduler/function availability, and the next refresh.

Automatic grading supports:

- Team winner, team points, combined game points.
- Passing yards, passing touchdowns, rushing yards, receiving yards, receptions.

Player results require a matching ESPN event ID, season, home/away team IDs, final
status, final scores, athlete ID, and **named statistic key** in the final box score.
Explicit numeric zero is valid; absent rows, empty strings, missing categories,
and malformed values remain pending. Only explicit DNP evidence can auto-void.
A missing box-score row is not proof of zero or non-participation. Commissioners
review unresolved statistics and custom unsupported categories (such as anytime TD).

Pick'em awards live points/provisional ranks as each final arrives, but weekly wins
and average weekly-rank tiebreakers use completed weeks only. Final score fields
must exist; missing values are not coerced to zero. Season reads are paginated so
later members/weeks are not dropped by the API's row limit.

## Publishing future Crazy Chain boards

In the Control Room, choose a week and **Preview weekly board**, then publish.
Schedule matches and current-season roster/depth-chart identities are verified.
New predictions are published only for games more than 30 minutes away; injury
checks continue for already-published players until kickoff.

These are custom DH Club challenge thresholds, **not ESPN projections or odds**:

| Subject | Targets |
| --- | --- |
| Starting QB | 1+ passing TD; 200+ passing yards |
| Starting RB | 50+ rushing yards |
| Starting WR | 50+ receiving yards; 4+ catches |
| Starting TE | 25+ receiving yards; 3+ catches |
| Each team | Win; 20+ points |
| Game | 40+ combined points |

The protected reminder job invokes the publisher: eight-day lookahead, six-hour
normal cadence, and 30-minute checks within 24 hours before a pick deadline or
kickoff. Questionable/out/doubtful/reserve/suspended players are not newly
published. Existing affected players pause for new selections; saved picks are
not erased or turned into misses. Evidence older than 24 hours pauses new player
selections in SQL. Stable source IDs prevent duplicate imports or target changes.

## Optional CLI and tests

Node 22.18+ or 24. Supply an authorized account through process-only
DH_NFL_EMAIL / DH_NFL_PASSWORD; .env holds the public app URL/key.

~~~sh
node --env-file=.env scripts/load-crazy-chain.mjs --year 2026 --week 1
node --env-file=.env scripts/load-crazy-chain.mjs --year 2026 --week 1 --publish
npx vitest run src/test/crazyChainDeadlineRollout.test.tsx src/test/crazyChainPerGameUi.test.tsx src/test/nflFinalStats.test.ts src/test/crazyChainBoard.test.ts src/test/crazyChain.test.ts src/test/pickem.test.ts
# Optional isolated PostgreSQL; no live data:
npm install --no-save --package-lock=false @electric-sql/pglite
node scripts/test-nfl-per-game-db.mjs --30m
node scripts/test-nfl-per-game-db.mjs --with-catch-up --30m
node scripts/test-nfl-per-game-db.mjs --bundle
~~~

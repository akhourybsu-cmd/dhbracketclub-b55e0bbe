# Crazy Chain weekly data

## Load a board

In NFL Game Center, open **Crazy Chain Control Room**, choose a week with unstarted games,
then **Preview weekly board**. Review the counts and availability notes before
publishing. Members can choose published weeks on the Crazy Chain page and search
by player/team or filter by matchup.

The importer verifies the stored schedule against ESPN's regular-season scoreboard,
then joins starting depth-chart athletes to the same team's current-season roster
by player ID. It publishes at most one available QB, RB, WR, and TE per team.
Questionable, doubtful, out, reserve, and suspended players are skipped. Missing
rosters produce a warning and team predictions only, never invented players.

The fixed targets below are DH Club challenges, **not ESPN projections or odds**:

| Prediction | Target |
| --- | --- |
| Quarterback | 1+ passing touchdown; 200+ passing yards |
| Running back | 50+ rushing yards |
| Wide receiver | 50+ receiving yards; 4+ receptions |
| Tight end | 25+ receiving yards; 3+ receptions |
| Each team | Win; score 20+ points |
| Game | 40+ combined points |

## Safety and results

- Only games still scheduled and before their individual cutoff are imported;
  already-started games are excluded. Mismapped, incomplete, or rescheduled slates
  are rejected; sync the NFL schedule first when prompted.
- A new catch-up board locks the entire card before its first **included** kickoff.
  Its game set and original deadline are frozen at first publication. Refreshing,
  removing a player, or postponing a game cannot move that deadline later. An
  earlier schedule change can close it sooner. Existing Pick'em rules are unchanged.
- Preview expires after 10 minutes. Publishing rechecks the active club and lock.
- Reimporting adds missing predictions only. Stable source IDs prevent duplicates;
  existing targets, results, and member cards are not overwritten or removed.
- Republishing rechecks existing imported players too. Injury concerns, missing
  roster data, trades, and unverified starting roles pause **new** selections.
  Checks older than 24 hours also pause new player selections, enforced in SQL.
  Existing selections and targets remain intact; members can remove uncertain
  selections before lock. Uncertainty never becomes an automatic miss or zero.
- Existing NFL result scoring handles team winners, team points, and game totals.
  **Player-stat predictions still require commissioner verification and settlement
  from final game statistics.** Void predictions for non-participants; missing
  provider data is not a zero. Automatic player-stat grading is not implemented.
- Apply `20260910180000_crazy_chain_remaining_games.sql` **in addition to** the
  original `20260910150000_nfl_game_center_crazy_chain.sql` migration.
  The new migration is transactional and rerunnable. It preserves existing data.
  After applying, preview/publish Weeks 1 and 2 once to record fresh availability.

## Automatic future-week publishing

Deploy both `refresh-nfl-chain-boards` and the updated `pickem-week-reminder`
Edge Functions. The existing 30-minute NFL reminder schedule calls the new
publisher using the existing `CRON_SHARED_SECRET`. No new paid feed is required.
Do not put that secret in Git, the browser, or SQL text. If the reminder schedule
is not already running, configure it in the project before claiming automation is live.

The publisher:

- Limits itself to clubs with NFL Game Center installed and enabled.
- Looks eight days ahead in active/upcoming seasons, based on dates rather than a
  potentially stale `current_week` setting. It does not fill distant weeks with
  today's roster assumptions.
- Refreshes normally every six hours, or every 30-minute scheduler tick within
  24 hours of any remaining kickoff. It can continue checking later games after
  the weekly card locks, without adding new predictions or editing saved legs.
- Records the last successful check and availability warnings on each board.
  Failures are returned in the reminder's `crazy_chain` result and function logs.
  Missing source data does not erase the board; stale player selections fail closed.
- Caps one invocation at four due club/week boards; additional work is deferred.

Deployment commands, from an authenticated Supabase CLI linked to this project:

```sh
supabase functions deploy refresh-nfl-chain-boards
supabase functions deploy pickem-week-reminder
```

SQL application and function deployment are separate from pushing Git commits.
The importer explicitly reports a missing migration rather than silently bypassing it.

## Optional command-line import

Requires Node 22.18+ or 24 and installed project dependencies. Supply an existing
club commissioner/admin account through the process environment variables
`DH_NFL_EMAIL` and `DH_NFL_PASSWORD`. Do not commit credentials or session tokens.
The existing `.env` provides the app's public Supabase URL and publishable key.

```sh
# Read-only preview
node --env-file=.env scripts/load-crazy-chain.mjs --year 2026 --week 2

# Publish missing predictions and read back the stored count
node --env-file=.env scripts/load-crazy-chain.mjs --year 2026 --week 2 --publish
```

The command uses the same importer and database permissions as the admin screen.
It does not use a service-role key or create member picks.

## Local verification

```sh
npx vitest run src/test/crazyChainBoard.test.ts src/test/crazyChain.test.ts src/test/pickem.test.ts
# Optional isolated PostgreSQL integration checks, no live data:
npm install --no-save --package-lock=false @electric-sql/pglite
node scripts/test-crazy-chain-db.mjs
```

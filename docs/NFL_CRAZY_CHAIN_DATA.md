# Crazy Chain weekly data

## Load a board

In NFL Game Center, open **Crazy Chain Control Room**, choose an upcoming week,
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

- Import before the weekly card locks (the season's lock offset before its first
  kickoff). Started, mismapped, incomplete, or rescheduled slates are rejected;
  sync the NFL schedule first when prompted.
- Preview expires after 10 minutes. Publishing rechecks the active club and lock.
- Reimporting adds missing predictions only. Stable source IDs prevent duplicates;
  existing targets, results, and member cards are not overwritten or removed.
- Availability is a snapshot. Refresh before publishing and review later injury
  changes manually; reimporting does not withdraw previously published players.
- Existing NFL result scoring handles team winners, team points, and game totals.
  **Player-stat predictions still require commissioner verification and settlement
  from final game statistics.** Void predictions for non-participants; missing
  provider data is not a zero. Automatic player-stat grading is not implemented.
- No new migration is required if
  `20260910150000_nfl_game_center_crazy_chain.sql` is already applied.

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

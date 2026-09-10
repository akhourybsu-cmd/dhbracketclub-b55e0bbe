import {
  buildBoardMarkets, fetchNflData, validateBoardSlate, verifiedStarters, verifyPlayerAvailability,
  type BoardGame, type BoardTeam, type BoardPlayer, type EspnDepthChart, type EspnRoster, type EspnScoreboard,
} from './chainBoardData.ts';
import { chainGameIsOpen } from './chainGameRules.ts';

export interface ExistingChainMarket {
  id: string; game_id: string; subject_team_id: string | null; subject_external_id: string | null;
  source_provider: string; status: string;
}

export async function collectChainBoard(input: {
  clubId: string; weekId: string; weekNumber: number; year: number; lockMinutes: number;
  games: BoardGame[]; teams: BoardTeam[]; existing: ExistingChainMarket[];
}, progress?: (message: string) => void) {
  const startedAt = Date.now();
  progress?.('Verifying remaining matchups and kickoff times…');
  const scoreboard = await fetchNflData<EspnScoreboard>(`scoreboard?dates=${input.year}&seasontype=2&week=${input.weekNumber}`);
  // Recheck injuries until kickoff, even after the 48-hour selection deadline.
  const games = validateBoardSlate(scoreboard, input.games, input.teams, input.year, input.weekNumber, startedAt, true, 0);
  const publishable = games.filter(game => chainGameIsOpen(game, startedAt));
  const teamIds = [...new Set(games.flatMap(game => [game.home_team_id, game.away_team_id]))];
  const sources = new Map<string, { roster: EspnRoster; depth: EspnDepthChart }>();
  const players = new Map<string, BoardPlayer[]>();
  const warnings: string[] = [];
  for (let start = 0; start < teamIds.length; start += 4) {
    await Promise.all(teamIds.slice(start, start + 4).map(async teamId => {
      const team = input.teams.find(item => item.id === teamId)!;
      try {
        const [roster, depth] = await Promise.all([
          fetchNflData<EspnRoster>(`teams/${encodeURIComponent(team.external_id!)}/roster`),
          fetchNflData<EspnDepthChart>(`teams/${encodeURIComponent(team.external_id!)}/depthcharts`),
        ]);
        const verified = verifiedStarters(roster, depth, team.external_id!, input.year);
        sources.set(teamId, { roster, depth });
        players.set(teamId, verified.players);
        warnings.push(...verified.warnings);
        if (!verified.players.length) warnings.push(`${team.city} ${team.name}: no verified starters; team predictions only.`);
      } catch {
        warnings.push(`${team.city} ${team.name}: roster/depth chart unavailable; player selections need review.`);
      }
    }));
    progress?.(`Checked ${Math.min(start + 4, teamIds.length)} of ${teamIds.length} teams…`);
  }
  // Check previously published athletes too, including newly injured or traded players.
  const eligibleIds = new Set(games.map(game => game.id));
  const availability = input.existing.filter(market => market.source_provider === 'espn-roster'
    && market.status === 'open' && market.subject_external_id && eligibleIds.has(market.game_id)).map(market => {
    const source = sources.get(market.subject_team_id || '');
    const team = input.teams.find(item => item.id === market.subject_team_id);
    const note = source && team?.external_id
      ? verifyPlayerAvailability(source.roster, source.depth, market.subject_external_id!, team.external_id, input.year)
      : 'Player data unavailable; new selections paused until rechecked.';
    return { id: market.id, verified: note === null, note };
  });
  return {
    clubId: input.clubId, weekId: input.weekId, weekNumber: input.weekNumber, year: input.year,
    gameCount: publishable.length, checkedGameCount: games.length, skippedGames: input.games.length - publishable.length,
    playerCount: [...players.values()].reduce((sum, items) => sum + items.length, 0),
    createdAt: startedAt, warnings: warnings.sort(), availability,
    gameIds: publishable.map(game => game.id), lockMinutes: 48 * 60,
    markets: buildBoardMarkets(input.clubId, publishable, input.teams, players),
  };
}

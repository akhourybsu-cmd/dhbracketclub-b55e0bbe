// ESPN supplies the schedule and player identities. These thresholds are DH Club
// challenge targets, not provider projections. Never manufacture a missing starter.
export const NFL_DATA_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

type Injury = { status?: string; type?: { name?: string } };
type Athlete = {
  id?: string;
  displayName?: string;
  injuries?: Injury[];
  status?: { type?: string };
  position?: { abbreviation?: string };
};

export interface EspnRoster {
  season?: { year?: number };
  team?: { id?: string };
  athletes?: Array<{ items?: Athlete[] }>;
}

export interface EspnDepthChart {
  season?: { year?: number };
  team?: { id?: string };
  depthchart?: Array<{
    positions?: Record<string, { position?: { abbreviation?: string }; athletes?: Athlete[] }>;
  }>;
}

export interface BoardPlayer {
  externalId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
}

export interface BoardTeam {
  id: string;
  external_id: string | null;
  external_provider: string | null;
  city: string;
  name: string;
}

export interface BoardGame {
  id: string;
  season_id: string;
  week_id: string;
  external_id: string | null;
  external_provider: string | null;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  status: string;
}

export interface EspnScoreboard {
  season?: { year?: number; type?: number };
  week?: { number?: number };
  events?: Array<{
    id: string;
    date: string;
    competitions?: Array<{
      competitors?: Array<{ homeAway?: string; team?: { id?: string } }>;
      status?: { type?: { state?: string; completed?: boolean } };
    }>;
  }>;
}

export interface BoardMarket {
  club_id: string;
  season_id: string;
  week_id: string;
  game_id: string;
  market_type: string;
  subject_label: string;
  subject_team_id: string | null;
  subject_external_id: string | null;
  operator: 'gte' | 'eq';
  threshold: number;
  display_text: string;
  source_provider: string;
  external_id: string;
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

export function verifiedStarters(roster: EspnRoster, depth: EspnDepthChart, teamId: string, year: number) {
  if (roster.season?.year !== year || depth.season?.year !== year
      || String(roster.team?.id) !== teamId || String(depth.team?.id) !== teamId) {
    throw new Error('Roster/depth chart does not match the requested team and season.');
  }
  const rosterPlayers = new Map((roster.athletes || []).flatMap(group => group.items || [])
    .filter(athlete => athlete.id).map(athlete => [String(athlete.id), athlete]));
  const players: BoardPlayer[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const chart of depth.depthchart || []) {
    // Object order is not a depth ranking: prefer wr1 over wr2 when publishing
    // one receiver per team, and never promote a backup when a starter is hurt.
    const slots = Object.entries(chart.positions || {}).sort(([a], [b]) => a.localeCompare(b));
    for (const [, slot] of slots) {
      const position = slot.position?.abbreviation;
      if (!POSITIONS.includes(position as BoardPlayer['position'])) continue;
      if (players.some(player => player.position === position)) continue;
      const starter = slot.athletes?.[0];
      const player = starter?.id ? rosterPlayers.get(String(starter.id)) : undefined;
      if (!player || !player.displayName || seen.has(String(player.id))) continue;
      if (player.position?.abbreviation !== position || player.status?.type !== 'active') continue;
      const injuries = [...(starter?.injuries || []), ...(player.injuries || [])];
      if (injuries.some(injury => /out|doubtful|questionable|reserve|suspend|pup/i.test(`${injury.status || ''} ${injury.type?.name || ''}`))) {
        warnings.push(`${player.displayName}: availability uncertain; omitted from new predictions.`);
        continue;
      }
      seen.add(String(player.id));
      players.push({ externalId: String(player.id), name: player.displayName, position: position as BoardPlayer['position'] });
    }
  }
  return { players, warnings };
}

export function validateBoardSlate(
  scoreboard: EspnScoreboard, games: BoardGame[], teams: BoardTeam[], year: number, weekNumber: number, now = Date.now(),
) {
  if (scoreboard.season?.year !== year || scoreboard.season?.type !== 2 || scoreboard.week?.number !== weekNumber) {
    throw new Error('The schedule provider returned a different season or week.');
  }
  const events = scoreboard.events || [];
  if (!games.length || events.length !== games.length) {
    throw new Error('The stored weekly schedule is incomplete. Sync the NFL week before importing predictions.');
  }
  const teamById = new Map(teams.map(team => [team.id, team]));
  const ids = new Set<string>();
  for (const game of games) {
    if (game.external_provider !== 'espn' || !game.external_id || ids.has(game.external_id)) {
      throw new Error('A game is missing its unique ESPN schedule mapping.');
    }
    ids.add(game.external_id);
    const event = events.find(item => item.id === game.external_id);
    const competition = event?.competitions?.[0];
    const home = competition?.competitors?.find(team => team.homeAway === 'home');
    const away = competition?.competitors?.find(team => team.homeAway === 'away');
    const homeTeam = teamById.get(game.home_team_id);
    const awayTeam = teamById.get(game.away_team_id);
    if (!home || !away || homeTeam?.external_provider !== 'espn' || awayTeam?.external_provider !== 'espn'
        || String(home.team?.id) !== homeTeam.external_id || String(away.team?.id) !== awayTeam.external_id
        || Date.parse(event?.date || '') !== Date.parse(game.kickoff_at)) {
      throw new Error('A matchup or kickoff changed. Sync the NFL week before importing predictions.');
    }
    if (game.status !== 'scheduled' || competition?.status?.type?.state !== 'pre'
        || competition.status.type.completed || !(Date.parse(game.kickoff_at) > now)) {
      throw new Error('This week has already started. Load the next unlocked week.');
    }
  }
}

export function buildBoardMarkets(clubId: string, games: BoardGame[], teams: BoardTeam[], playersByTeam: Map<string, BoardPlayer[]>) {
  const markets: BoardMarket[] = [];
  const teamById = new Map(teams.map(team => [team.id, team]));
  for (const game of games) {
    if (!game.external_id) throw new Error('Missing game identity.');
    const add = (type: string, label: string, teamId: string | null, athleteId: string | null, threshold: number, text: string) => {
      markets.push({
        club_id: clubId, season_id: game.season_id, week_id: game.week_id, game_id: game.id,
        market_type: type, subject_label: label, subject_team_id: teamId,
        subject_external_id: athleteId, operator: type === 'team_win' ? 'eq' : 'gte', threshold,
        display_text: text, source_provider: 'espn-roster',
        external_id: `dh-chain-v1:${game.external_id}:${athleteId || teamId || 'game'}:${type}:${threshold}`,
      });
    };
    add('game_total', 'Combined score', null, null, 40, 'Both teams to combine for 40+ points');
    for (const teamId of [game.away_team_id, game.home_team_id]) {
      const team = teamById.get(teamId);
      if (!team) throw new Error('Missing team identity.');
      const label = `${team.city} ${team.name}`.trim();
      add('team_win', label, teamId, null, 1, `${label} to win`);
      add('team_points', label, teamId, null, 20, `${label} to score 20+ points`);
      for (const player of playersByTeam.get(teamId) || []) {
        const prop = (type: string, threshold: number, description: string) => add(type, player.name, teamId, player.externalId, threshold, `${player.name} · ${description}`);
        if (player.position === 'QB') {
          prop('passing_touchdowns', 1, '1+ passing touchdown');
          prop('passing_yards', 200, '200+ passing yards');
        } else if (player.position === 'RB') {
          prop('rushing_yards', 50, '50+ rushing yards');
        } else if (player.position === 'WR') {
          prop('receiving_yards', 50, '50+ receiving yards');
          prop('receptions', 4, '4+ receptions');
        } else if (player.position === 'TE') {
          prop('receiving_yards', 25, '25+ receiving yards');
          prop('receptions', 3, '3+ receptions');
        }
      }
    }
  }
  return markets;
}

export async function fetchNflData<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${NFL_DATA_BASE}/${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`NFL data request failed (${response.status}). Try again shortly.`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

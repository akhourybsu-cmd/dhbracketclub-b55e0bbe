import { describe, expect, it } from 'vitest';
import {
  buildBoardMarkets, validateBoardSlate, verifiedStarters,
  type BoardGame, type BoardTeam, type EspnRoster, type EspnDepthChart, type EspnScoreboard,
} from '@/lib/nfl/chainBoardData';

const teams: BoardTeam[] = [
  { id: 'home', external_id: '1', external_provider: 'espn', city: 'Home', name: 'Team' },
  { id: 'away', external_id: '2', external_provider: 'espn', city: 'Away', name: 'Team' },
];
const game: BoardGame = {
  id: 'game', week_id: 'week', season_id: 'season', external_id: '100', external_provider: 'espn',
  home_team_id: 'home', away_team_id: 'away', status: 'scheduled', kickoff_at: '2026-09-18T00:15:00Z',
};
const scoreboard: EspnScoreboard = {
  season: { year: 2026, type: 2 }, week: { number: 2 }, events: [{
    id: '100', date: game.kickoff_at, competitions: [{
      status: { type: { state: 'pre', completed: false } },
      competitors: [{ homeAway: 'home', team: { id: '1' } }, { homeAway: 'away', team: { id: '2' } }],
    }],
  }],
};
const now = Date.parse('2026-09-10T12:00:00Z');
const qb = { id: '10', displayName: 'Starting Quarterback', position: { abbreviation: 'QB' }, status: { type: 'active' }, injuries: [] };
const backup = { ...qb, id: '11', displayName: 'Backup Quarterback' };
const roster: EspnRoster = { team: { id: '1' }, season: { year: 2026 }, athletes: [{ items: [qb, backup] }] };
const depth: EspnDepthChart = { team: { id: '1' }, season: { year: 2026 }, depthchart: [{ positions: { qb: { position: { abbreviation: 'QB' }, athletes: [qb, backup] } } }] };

describe('Crazy Chain weekly import', () => {
  it('uses the starting player matched by ID against the current active roster', () => {
    const result = verifiedStarters(roster, depth, '1', 2026);
    expect(result.players).toEqual([{ externalId: '10', name: 'Starting Quarterback', position: 'QB' }]);
    expect(result.warnings).toEqual([]);
  });

  it('omits an injured starter instead of assuming their backup will play', () => {
    const injured = { ...qb, injuries: [{ status: 'Questionable' }] };
    const result = verifiedStarters({ ...roster, athletes: [{ items: [injured, backup] }] }, depth, '1', 2026);
    expect(result.players).toEqual([]);
    expect(result.warnings[0]).toContain('availability uncertain');
  });

  it('does not create player predictions from a stale team or season roster', () => {
    expect(() => verifiedStarters(roster, depth, '2', 2026)).toThrow('team and season');
    expect(() => verifiedStarters(roster, depth, '1', 2025)).toThrow('team and season');
    expect(verifiedStarters({ ...roster, athletes: [{ items: [backup] }] }, depth, '1', 2026).players).toEqual([]);
  });

  it('rejects incomplete, rescheduled, started, and mismapped slates before import', () => {
    expect(() => validateBoardSlate(scoreboard, [game], teams, 2026, 2, now)).not.toThrow();
    expect(() => validateBoardSlate(scoreboard, [], teams, 2026, 2, now)).toThrow('incomplete');
    expect(() => validateBoardSlate(scoreboard, [{ ...game, kickoff_at: '2026-09-20T00:15:00Z' }], teams, 2026, 2, now)).toThrow('kickoff changed');
    expect(() => validateBoardSlate(scoreboard, [{ ...game, status: 'final' }], teams, 2026, 2, now)).toThrow('already started');
    expect(() => validateBoardSlate(scoreboard, [game], teams, 2026, 3, now)).toThrow('different season or week');
    expect(() => validateBoardSlate(scoreboard, [{ ...game, home_team_id: 'away' }], teams, 2026, 2, now)).toThrow('matchup or kickoff');
  });

  it('creates stable unique predictions and preserves player/game/club identities', () => {
    const players = new Map([['home', verifiedStarters(roster, depth, '1', 2026).players]]);
    const markets = buildBoardMarkets('club', [game], teams, players);
    expect(markets).toHaveLength(7);
    expect(new Set(markets.map(market => market.external_id)).size).toBe(markets.length);
    expect(buildBoardMarkets('club', [game], teams, players)).toEqual(markets);
    const passing = markets.find(market => market.market_type === 'passing_touchdowns')!;
    expect(passing).toMatchObject({ club_id: 'club', game_id: 'game', subject_external_id: '10', subject_team_id: 'home', threshold: 1, operator: 'gte' });
    expect(markets.filter(market => market.market_type === 'team_win').every(market => market.operator === 'eq' && market.threshold === 1)).toBe(true);
  });

  it('can publish team predictions even when a team has no verified players', () => {
    const markets = buildBoardMarkets('club', [game], teams, new Map());
    expect(markets).toHaveLength(5);
    expect(markets.every(market => market.subject_external_id === null)).toBe(true);
  });
});

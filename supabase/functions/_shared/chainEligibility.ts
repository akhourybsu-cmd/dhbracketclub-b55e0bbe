import type { BoardGame, BoardTeam } from './chainBoardData.ts';

type Injury = {
  status?: string; date?: string;
  type?: { name?: string; description?: string; abbreviation?: string };
  athlete?: { id?: string };
  details?: { returnDate?: string };
};
export interface EligibilitySummary {
  header?: {
    id?: string; season?: { year?: number; type?: number };
    competitions?: Array<{
      id?: string; date?: string;
      competitors?: Array<{ homeAway?: string; team?: { id?: string } }>;
      status?: { type?: { state?: string; completed?: boolean } };
    }>;
  };
  injuries?: Array<{ team?: { id?: string }; injuries?: Injury[] }>;
}

const normalize = (value: string) => value.toLowerCase().replace(/^injury_status_/, '').replace(/[_-]/g, ' ').trim();
const absences: Record<string, string> = {
  out: 'out', inactive: 'inactive', 'injured reserve': 'injured_reserve', ir: 'injured_reserve',
  suspended: 'suspended', suspension: 'suspended', pup: 'reserve', nfi: 'reserve',
  'physically unable to perform': 'reserve', 'non football injury': 'reserve',
};

// Exact status values only. Questionable, doubtful, missing roster rows, and
// starting-role changes are NOT proof of ineligibility.
export function confirmedAbsenceStatus(injury: Injury): string | null {
  const values = [injury.status, injury.type?.description, injury.type?.name].filter(Boolean).map(value => normalize(value!));
  if (values.some(value => ['questionable', 'doubtful', 'active', 'probable', 'day to day'].includes(value))) return null;
  return absences[normalize(injury.status || injury.type?.description || injury.type?.name || '')] || null;
}

export function collectConfirmedAbsences(summary: EligibilitySummary, game: BoardGame, teams: BoardTeam[], year: number, now = Date.now()) {
  const header = summary.header;
  const competition = header?.competitions?.[0];
  const kickoff = Date.parse(game.kickoff_at);
  if (game.external_provider !== 'espn' || !game.external_id || header?.id !== game.external_id
      || header.season?.year !== year || header.season?.type !== 2
      || competition?.id !== game.external_id || Date.parse(competition?.date || '') !== kickoff) {
    throw new Error('Availability report does not match this event, season, or kickoff.');
  }
  const matched = ['home', 'away'].map(side => {
    const team = teams.find(item => item.id === (side === 'home' ? game.home_team_id : game.away_team_id));
    const source = competition.competitors?.find(item => item.homeAway === side);
    if (!team?.external_id || team.external_provider !== 'espn' || source?.team?.id !== team.external_id) {
      throw new Error('Availability report team mapping changed.');
    }
    return team;
  });
  if (game.status !== 'scheduled' || competition.status?.type?.state !== 'pre' || competition.status.type.completed
      || !Number.isFinite(kickoff) || kickoff <= now || kickoff - now > 86400_000) {
    throw new Error('Availability cancellations require a scheduled game within 24 hours, before kickoff.');
  }
  const checks = [];
  for (const team of matched) {
    const records = (summary.injuries || []).filter(group => group.team?.id === team.external_id).flatMap(group => group.injuries || []);
    for (const injury of records) {
      const status = confirmedAbsenceStatus(injury);
      const reported = Date.parse(injury.date || '');
      const returnDate = injury.details?.returnDate;
      // An expected return before game day is ambiguous; never cancel from it.
      // Conflicting duplicate reports for an athlete are also left for review.
      if (!status || !injury.athlete?.id || records.filter(item => item.athlete?.id === injury.athlete?.id).length !== 1
          || !Number.isFinite(reported) || reported > now || reported < Date.UTC(year, 0, 1)
          || (returnDate && (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate) || !Number.isFinite(Date.parse(returnDate)) || returnDate < game.kickoff_at.slice(0, 10)))) continue;
      checks.push({ player_id: injury.athlete.id, team_id: team.id, team_external_id: team.external_id,
        status, reported_at: new Date(reported).toISOString(), return_date: returnDate || null });
    }
  }
  return checks;
}

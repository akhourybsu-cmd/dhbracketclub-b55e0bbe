export interface FinalGame {
  id: string; external_id: string | null; external_provider: string | null; status: string;
  home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null;
}
export interface StatMarket { id: string; market_type: string; subject_team_id: string | null; subject_external_id: string | null }
export interface FinalSummary {
  header?: { id?: string; season?: { year?: number; type?: number }; competitions?: Array<{
    status?: { type?: { completed?: boolean; state?: string } };
    competitors?: Array<{ homeAway?: string; team?: { id?: string }; score?: string }>;
  }> };
  boxscore?: { players?: Array<{ team?: { id?: string }; statistics?: Array<{
    name?: string; keys?: string[]; athletes?: Array<{ athlete?: { id?: string }; stats?: unknown[]; didNotPlay?: boolean }>;
  }> }> };
}
export type FinalValue = { actual: number; voided: false } | { actual: null; voided: true } | { pending: string };
const numeric = (value: unknown): number | null => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
/** Scores must be explicit non-negative integers, never missing-value zeroes. */
export function parseNflScore(value: unknown): number | null {
  const score = numeric(value);
  return score !== null && score >= 0 && Number.isInteger(score) ? score : null;
}
export function verifyFinalSummary(summary: FinalSummary, game: FinalGame, teams: Map<string,string>, year: number): boolean {
  const competition = summary.header?.competitions?.[0];
  if (game.external_provider !== 'espn' || game.status !== 'final' || summary.header?.id !== game.external_id
    || summary.header?.season?.year !== year || summary.header?.season?.type !== 2
    || competition?.status?.type?.completed !== true || competition.status.type.state !== 'post') return false;
  const home=competition.competitors?.find(team=>team.homeAway==='home');
  const away=competition.competitors?.find(team=>team.homeAway==='away');
  return !!teams.get(game.home_team_id) && !!teams.get(game.away_team_id)
    && home?.team?.id===teams.get(game.home_team_id) && away?.team?.id===teams.get(game.away_team_id)
    && game.home_score != null && game.away_score != null
    && numeric(home?.score)===game.home_score && numeric(away?.score)===game.away_score;
}
export function finalMarketValue(market: StatMarket, game: FinalGame, summary: FinalSummary | null, teams: Map<string,string>): FinalValue {
  const pending = (message: string): FinalValue => ({pending:message});
  if (game.status !== 'final') return pending('Game is not final.');
  const home=numeric(game.home_score),away=numeric(game.away_score);
  if (home===null || away===null || home<0 || away<0) return pending('Final score is incomplete.');
  if (market.market_type==='game_total') return {actual:home+away,voided:false};
  const isHome=market.subject_team_id===game.home_team_id;
  if (!market.subject_team_id || (!isHome && market.subject_team_id!==game.away_team_id)) return pending('Subject team does not match the game.');
  if (market.market_type==='team_points') return {actual:isHome?home:away,voided:false};
  if (market.market_type==='team_win') return {actual:(isHome?home>away:away>home)?1:0,voided:false};
  const fields: Record<string,[string,string]> = {
    passing_touchdowns:['passing','passingTouchdowns'],passing_yards:['passing','passingYards'],
    rushing_yards:['rushing','rushingYards'],receiving_yards:['receiving','receivingYards'],receptions:['receiving','receptions'],
  };
  const field=fields[market.market_type];
  if (!field || !summary || !market.subject_external_id) return pending('Requires verified player statistics or commissioner review.');
  const team=summary.boxscore?.players?.find(item=>item.team?.id===teams.get(market.subject_team_id!));
  const category=team?.statistics?.find(item=>item.name===field[0]);
  const athlete=category?.athletes?.find(item=>item.athlete?.id===market.subject_external_id);
  // Absence from a box score is NOT proof of DNP or zero. Only explicit evidence
  // can void automatically; otherwise the commissioner sees a pending result.
  if (!athlete) return pending('Player is missing from the final stat category; verify participation.');
  if (athlete.didNotPlay===true) return {actual:null,voided:true};
  const column=category?.keys?.indexOf(field[1]) ?? -1;
  const actual=column<0?null:numeric(athlete.stats?.[column]);
  if (actual===null || (!field[1].endsWith('Yards') && (actual<0 || !Number.isInteger(actual)))) return pending('Final player statistic is incomplete.');
  return {actual,voided:false};
}

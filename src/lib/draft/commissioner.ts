import { supabase } from '@/integrations/supabase/client';
import { HYDRATE_TIMEOUT_MS, QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import type { DraftSeason, SeasonEntry, SeasonStanding, PlayoffMatch } from '@/hooks/useDraftSeasons';
import type { LiveDraftSettings } from './liveDraft';
import { isCompleteDraftReport } from './resultIntegrity';
import { getDerivedDraftTurn } from '@/lib/draftTurn';

export interface CommissionerPresetConfig {
  topic?: string;
  description?: string;
  category?: string;
  num_rounds: number;
  ai_context: string;
  is_live: boolean;
  live_settings: Partial<LiveDraftSettings>;
}
export interface CommissionerPlan {
  id: string; season_id: string; club_id: string; topic: string; notes: string; ai_context: string;
  num_rounds: number; is_live: boolean; live_settings: Partial<LiveDraftSettings>;
  scheduled_at: string | null; due_at: string | null; draft_id: string | null; preset_id: string | null;
  status: 'planned' | 'ready' | 'launched' | 'cancelled'; version: number;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
}
export interface CommissionerPreset {
  id: string; season_id: string; club_id: string; name: string; config: CommissionerPresetConfig;
  version: number; created_by: string; updated_by: string; created_at: string; updated_at: string;
}
export interface CommissionerAdjustment {
  id: string; season_id: string; club_id: string; user_id: string; delta: number; reason: string;
  created_by: string; created_at: string; revoked_at: string | null; revoked_by: string | null; revocation_reason: string | null;
}
export interface CommissionerAudit {
  id: string; season_id: string; club_id: string; actor_user_id: string; action: string; reason: string;
  before_data: unknown; after_data: unknown; request_id: string; created_at: string;
}
export interface CommissionerReminder {
  id: string; season_id: string; club_id: string; target_user_id: string; draft_id: string | null;
  match_id: string | null; plan_id: string | null; kind: 'pick' | 'topic' | 'plan';
  notification_id: string | null; created_by: string; created_at: string;
}
export interface CommissionerOperations {
  plans: CommissionerPlan[]; presets: CommissionerPreset[]; adjustments: CommissionerAdjustment[];
  audit: CommissionerAudit[]; reminders: CommissionerReminder[];
}
export interface CommissionerDraft {
  id: string; topic: string; status: string; num_rounds: number; is_live: boolean; created_at: string; updated_at: string;
  current_pick_user_id: string | null; current_pick_number: number; pick_deadline_at: string | null;
  clock_started_at: string | null; clock_paused_at: string | null;
}
export interface CommissionerParticipant { id: string; draft_id: string; user_id: string; pick_order: number }
export interface CommissionerSkip { id: string; draft_id: string; user_id: string; pick_number: number; round: number; created_at: string }
export interface CommissionerMember { user_id: string; joined_at: string }
export interface CommissionerPick { id: string; draft_id: string; user_id: string; pick_text: string; pick_number: number; round: number; picked_at: string }
export interface CommissionerResult {
  id: string; draft_id: string; user_id: string; rank: number; total_score: number; points_awarded: number;
  pick_ratings: unknown; created_at: string;
}
export interface CommissionerDispute {
  id: string; draft_id: string; pick_id: string; user_id: string; reason: string; status: string;
  created_at: string; resolved_at: string | null; commissioner_rationale: string | null; resolution: string | null;
}
export interface CommissionerProfile { id: string; display_name: string; avatar_url: string | null }
export interface CommissionerWorkspaceData extends CommissionerOperations {
  season: DraftSeason; standings: SeasonStanding[]; entries: SeasonEntry[]; drafts: CommissionerDraft[];
  participants: CommissionerParticipant[]; picks: CommissionerPick[]; results: CommissionerResult[];
  disputes: CommissionerDispute[]; matches: PlayoffMatch[]; profiles: CommissionerProfile[];
  skips: CommissionerSkip[]; members: CommissionerMember[];
}
export type CommissionerAction = 'upsert_plan' | 'delete_plan' | 'upsert_preset' | 'delete_preset'
  | 'add_adjustment' | 'revoke_adjustment' | 'send_reminder' | 'add_draft' | 'remove_draft'
  | 'update_season' | 'transfer_commissioner' | 'dismiss_dispute' | 'reject_dispute' | 'recalculate';
export interface CommissionerMutationResult { ok: true; record: Record<string, unknown> | null; audit_id: string }
export type CommissionerMutate = (action: CommissionerAction, payload: Record<string, unknown>, reason: string, requestId?: string) => Promise<CommissionerMutationResult>;

export interface CommissionerPointDraft {
  draftId: string; topic: string; draftNumber: number; rank: number; score: number;
  placementPoints: number; dhPoints: number; counted: boolean;
}
export interface CommissionerPointRow {
  userId: string; displayName: string; avatarUrl: string | null; rank: number | null; playoffSeed: number | null;
  bestOf: number; basePoints: number; adjustmentPoints: number; projectedPoints: number;
  persistedPoints: number | null; pointsDelta: number | null; countsTowardBestOf: number; draftsPlayed: number;
  wins: number; podiums: number; averageFinish: number; averageScore: number;
  counted: CommissionerPointDraft[]; dropped: CommissionerPointDraft[];
}
export interface CommissionerImpact {
  userId: string; displayName: string; before: number; after: number | null; delta: number; rowRemoved: boolean;
  beforeSeed: number | null; afterSeed: number | null; beforeRank: number | null; afterRank: number | null; seedsLocked: boolean;
}
export interface CommissionerInboxItem {
  id: string; kind: 'dispute' | 'report' | 'stalled_turn' | 'playoff_topic'; priority: 'high' | 'normal';
  title: string; detail: string; href: string; draftId: string | null; userId: string | null; matchId: string | null; createdAt: string;
}
export interface CommissionerParticipation {
  userId: string; displayName: string; avatarUrl: string | null; joined: number; completed: number;
  reports: number; pendingTurns: number; remainingToBestOf: number; participationRate: number;
  skipped: number; missed: number;
}
export interface CommissionerReadiness {
  regularDrafts: number; targetDrafts: number; completedDrafts: number; verifiedReports: number;
  pendingDisputes: number; remainingDrafts: number; readyForPlayoffs: boolean;
  blockers: string[]; rosterSize: number;
}
export const COMMISSIONER_TIEBREAKERS = ['Season points', 'Wins', 'Podiums', 'Average finish (lower)', 'Average score'] as const;
export const COMMISSIONER_LOAD_ERROR = 'The commissioner workspace could not be loaded. Try again.';
export const COMMISSIONER_MUTATION_ERROR = 'The change could not be saved. Refresh the workspace and try again.';
const SAFE_BUSINESS_ERRORS = new Set([
  'Season report data needs review', 'Invalid preset configuration', 'Invalid draft mode', 'Invalid live settings',
  'Invalid pick clock', 'Invalid clock behavior', 'Invalid presentation setting', 'Unsupported live setting',
  'A reason and request identity are required', 'Request identity already used', 'Archived season is read-only',
  'Preset name required', 'Preset changed. Reload before saving', 'Preset changed. Reload before deleting',
  'Draft unavailable', 'Preset unavailable', 'Plan changed. Reload before saving', 'Plan changed. Reload before deleting',
  'Season participant required', 'Active adjustment unavailable', 'Regular season is locked', 'Unassigned regular draft required',
  'Season draft slots are full', 'Season draft unavailable', 'Season rules are locked', 'Unsupported season setting',
  'Invalid season settings', 'Club member required', 'Pending season dispute unavailable', 'Recipient unavailable',
  'Topic is no longer waiting for this player', 'Draft is not waiting for a pick', 'That player is no longer on the clock',
  'Scheduled season recipient unavailable', 'Unsupported reminder', 'A reminder was already sent recently. Try again later',
  'Unsupported commissioner action', 'Unsupported commissioner payload',
]);

interface DataResponse { data: unknown; error: unknown }
// New RPCs are deployed alongside this module, before generated database types refresh.
const commissionerRpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<DataResponse>;

async function responseData(request: PromiseLike<DataResponse>, label: string): Promise<unknown> {
  const { data, error } = await withTimeout(Promise.resolve(request), QUERY_TIMEOUT_MS, label);
  if (error) throw error;
  return data;
}
async function readRows<T>(request: PromiseLike<DataResponse>, label: string): Promise<T[]> {
  const data = await responseData(request, label);
  if (!Array.isArray(data)) throw new Error(COMMISSIONER_LOAD_ERROR);
  return data as T[];
}
async function readPages<T>(build: (from: number, to: number) => PromiseLike<DataResponse>, label: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 50; page++) {
    const batch = await readRows<T>(build(page * 1000, page * 1000 + 999), label);
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
  // An incomplete ledger must never look like a complete points explanation.
  throw new Error(COMMISSIONER_LOAD_ERROR);
}

export async function fetchCommissionerPresets(clubId: string, seasonId?: string | null): Promise<CommissionerPreset[]> {
  if (!clubId.trim()) return [];
  try {
    return await readPages<CommissionerPreset>((from, to) => {
      let query = supabase.from('draft_commissioner_presets' as never).select('*').eq('club_id', clubId);
      if (seasonId) query = query.eq('season_id', seasonId);
      return query.order('name').order('id').range(from, to);
    }, 'commissioner presets');
  } catch { throw new Error('Draft presets could not be loaded. Try again.'); }
}

/** Read-only explicit plan application. Membership alone never grants planner access. */
export async function fetchCommissionerPlan(clubId: string, seasonId: string, planId: string): Promise<CommissionerPlan | null> {
  if (!clubId.trim() || !seasonId.trim() || !planId.trim()) return null;
  try {
    const data = await responseData(supabase.from('draft_commissioner_plans' as never).select('*').eq('club_id', clubId).eq('season_id', seasonId).eq('id', planId).maybeSingle(), 'commissioner plan');
    return data ? data as CommissionerPlan : null;
  } catch { throw new Error('The planned draft could not be loaded. Try again.'); }
}

export async function mutateCommissioner(
  seasonId: string, action: CommissionerAction, payload: Record<string, unknown>, reason: string,
  requestId: string = crypto.randomUUID(),
): Promise<CommissionerMutationResult> {
  if (!seasonId.trim()) throw new Error('Choose a season first.');
  if (reason.trim().length < 3 || reason.trim().length > 1000) throw new Error('Add a reason between 3 and 1,000 characters.');
  try {
    const data = await responseData(commissionerRpc('draft_commissioner_mutate', {
      p_season_id: seasonId, p_action: action, p_payload: payload, p_reason: reason.trim(), p_request_id: requestId,
    }), 'commissioner change');
    if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true || !('audit_id' in data)) throw new Error(COMMISSIONER_MUTATION_ERROR);
    return data as CommissionerMutationResult;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? error.code : '';
    if (code === '40001') throw new Error('This record changed on another device. Refresh and try again.');
    if (code === '42501') throw new Error('Commissioner access is required for this season.');
    if (code === 'P0001' && error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && SAFE_BUSINESS_ERRORS.has(error.message)) throw new Error(`${error.message}.`);
    throw new Error(COMMISSIONER_MUTATION_ERROR);
  }
}

export async function fetchCommissionerWorkspace(clubId: string, seasonId: string): Promise<CommissionerWorkspaceData> {
  if (!clubId.trim() || !seasonId.trim()) throw new Error(COMMISSIONER_LOAD_ERROR);
  const hydrate = async (): Promise<CommissionerWorkspaceData> => {
    const [seasonData, standings, entries, matches, members, operationsData] = await Promise.all([
      responseData(supabase.from('draft_seasons').select('*').eq('club_id', clubId).eq('id', seasonId).maybeSingle(), 'commissioner season'),
      readPages<SeasonStanding>((from, to) => supabase.from('draft_season_standings').select('*').eq('club_id', clubId).eq('season_id', seasonId).order('id').range(from, to), 'commissioner standings'),
      readPages<SeasonEntry>((from, to) => supabase.from('draft_season_entries').select('*').eq('club_id', clubId).eq('season_id', seasonId).order('id').range(from, to), 'commissioner entries'),
      readPages<PlayoffMatch>((from, to) => supabase.from('draft_playoff_matches').select('*').eq('club_id', clubId).eq('season_id', seasonId).order('id').range(from, to), 'commissioner playoffs'),
      readPages<CommissionerMember>((from, to) => supabase.from('club_members').select('user_id,joined_at').eq('club_id', clubId).order('id').range(from, to), 'commissioner roster'),
      responseData(commissionerRpc('draft_commissioner_workspace', { p_season_id: seasonId }), 'commissioner operations'),
    ]);
    if (!seasonData || typeof seasonData !== 'object' || !operationsData || typeof operationsData !== 'object') throw new Error(COMMISSIONER_LOAD_ERROR);
    const operations = operationsData as CommissionerOperations;
    if (!['plans', 'presets', 'adjustments', 'audit', 'reminders'].every(key => Array.isArray(operations[key as keyof CommissionerOperations]))) throw new Error(COMMISSIONER_LOAD_ERROR);
    const draftIds = Array.from(new Set([...entries.map(entry => entry.draft_id), ...matches.flatMap(match => match.draft_id ? [match.draft_id] : [])]));
    const drafts: CommissionerDraft[] = [], participants: CommissionerParticipant[] = [], picks: CommissionerPick[] = [], results: CommissionerResult[] = [], disputes: CommissionerDispute[] = [], skips: CommissionerSkip[] = [];
    for (let index = 0; index < draftIds.length; index += 100) {
      const ids = draftIds.slice(index, index + 100);
      const [draftRows, participantRows, pickRows, resultRows, disputeRows, skipRows] = await Promise.all([
        readPages<CommissionerDraft>((from, to) => supabase.from('drafts').select('id,topic,status,num_rounds,is_live,created_at,updated_at,current_pick_user_id,current_pick_number,pick_deadline_at,clock_started_at,clock_paused_at').eq('club_id', clubId).in('id', ids).order('id').range(from, to), 'commissioner drafts'),
        readPages<CommissionerParticipant>((from, to) => supabase.from('draft_participants').select('id,draft_id,user_id,pick_order').eq('club_id', clubId).in('draft_id', ids).order('id').range(from, to), 'commissioner participants'),
        readPages<CommissionerPick>((from, to) => supabase.from('draft_picks').select('id,draft_id,user_id,pick_text,pick_number,round,picked_at').eq('club_id', clubId).in('draft_id', ids).order('id').range(from, to), 'commissioner picks'),
        readPages<CommissionerResult>((from, to) => supabase.from('draft_results').select('id,draft_id,user_id,rank,total_score,points_awarded,pick_ratings,created_at').eq('club_id', clubId).in('draft_id', ids).order('id').range(from, to), 'commissioner reports'),
        readPages<CommissionerDispute>((from, to) => supabase.from('draft_pick_disputes').select('id,draft_id,pick_id,user_id,reason,status,created_at,resolved_at,commissioner_rationale,resolution').eq('club_id', clubId).in('draft_id', ids).order('id').range(from, to), 'commissioner disputes'),
        readPages<CommissionerSkip>((from, to) => supabase.from('draft_skips').select('id,draft_id,user_id,pick_number,round,created_at').eq('club_id', clubId).in('draft_id', ids).order('id').range(from, to), 'commissioner skips'),
      ]);
      drafts.push(...draftRows); participants.push(...participantRows); picks.push(...pickRows); results.push(...resultRows); disputes.push(...disputeRows); skips.push(...skipRows);
    }
    const userIds = new Set([
      ...standings.map(row => row.user_id), ...participants.map(row => row.user_id), ...results.map(row => row.user_id),
      ...members.map(row => row.user_id),
      ...disputes.map(row => row.user_id), ...drafts.flatMap(row => row.current_pick_user_id ? [row.current_pick_user_id] : []),
      ...matches.flatMap(row => [row.user_a, row.user_b, row.topic_picker_user_id].filter((id): id is string => Boolean(id))),
      ...operations.adjustments.flatMap(row => [row.user_id, row.created_by]), ...operations.audit.map(row => row.actor_user_id),
      ...operations.reminders.flatMap(row => [row.target_user_id, row.created_by]),
    ]);
    const profiles: CommissionerProfile[] = [];
    const ids = Array.from(userIds);
    for (let index = 0; index < ids.length; index += 200) {
      profiles.push(...await readRows<CommissionerProfile>(supabase.from('profiles').select('id,display_name,avatar_url').in('id', ids.slice(index, index + 200)), 'commissioner profiles'));
    }
    // Profile visibility is authoritative. Never invent an identity for an omitted account.
    const visible = new Set(profiles.map(profile => profile.id));
    return {
      season: seasonData as DraftSeason, entries, drafts, matches, profiles,
      skips: skips.filter(row => visible.has(row.user_id)), members: members.filter(row => visible.has(row.user_id)),
      standings: standings.filter(row => visible.has(row.user_id)), participants: participants.filter(row => visible.has(row.user_id)),
      picks: picks.filter(row => visible.has(row.user_id)), results: results.filter(row => visible.has(row.user_id)),
      disputes: disputes.filter(row => visible.has(row.user_id)), ...operations,
    };
  };
  try { return await withTimeout(hydrate(), HYDRATE_TIMEOUT_MS, 'commissioner workspace'); }
  catch { throw new Error(COMMISSIONER_LOAD_ERROR); }
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const placementPoints = (rank: number) => ({ 1: 10, 2: 7, 3: 5, 4: 3, 5: 2 }[rank] ?? 1);

/** An explanation of the saved reports, never a replacement for persisted standings. */
export function deriveCommissionerPoints(data: CommissionerWorkspaceData): CommissionerPointRow[] {
  const profiles = new Map(data.profiles.map(profile => [profile.id, profile]));
  const drafts = new Map(data.drafts.map(draft => [draft.id, draft]));
  const entries = new Map(data.entries.filter(entry => !entry.is_playoff).map(entry => [entry.draft_id, entry]));
  const standings = new Map(data.standings.map(standing => [standing.user_id, standing]));
  const bestOf = Number.isInteger(data.season.best_of) && data.season.best_of > 0 ? data.season.best_of : 10;
  const userIds = new Set([
    ...data.participants.filter(row => entries.has(row.draft_id)).map(row => row.user_id),
    ...data.results.filter(row => entries.has(row.draft_id)).map(row => row.user_id),
    ...data.standings.map(row => row.user_id), ...data.adjustments.map(row => row.user_id),
  ]);
  const rows: CommissionerPointRow[] = [];
  for (const userId of userIds) {
    const profile = profiles.get(userId);
    if (!profile) continue;
    const byDraft = new Map<string, CommissionerPointDraft>();
    for (const result of data.results) {
      const entry = entries.get(result.draft_id), draft = drafts.get(result.draft_id);
      if (result.user_id !== userId || !entry || !draft || byDraft.has(result.draft_id)) continue;
      const rank = Number(result.rank), score = Number(result.total_score);
      if (!Number.isInteger(rank) || rank < 1 || !Number.isFinite(score)) continue;
      byDraft.set(result.draft_id, {
        draftId: result.draft_id, topic: draft.topic, draftNumber: entry.week_number, rank, score,
        placementPoints: placementPoints(rank), dhPoints: Number(result.points_awarded) || 0, counted: false,
      });
    }
    const all = [...byDraft.values()].sort((a, b) => b.placementPoints - a.placementPoints || a.draftNumber - b.draftNumber || a.draftId.localeCompare(b.draftId));
    const counted = all.slice(0, bestOf).map(row => ({ ...row, counted: true }));
    const dropped = all.slice(bestOf);
    const basePoints = counted.reduce((sum, row) => sum + row.placementPoints, 0);
    // The ledger persists without a report, but the server only projects it onto a real result row.
    const adjustmentPoints = all.length ? data.adjustments.filter(row => row.user_id === userId && !row.revoked_at).reduce((sum, row) => sum + Number(row.delta), 0) : 0;
    const projectedPoints = basePoints + adjustmentPoints;
    const standing = standings.get(userId);
    const persistedPoints = standing ? Number(standing.season_points) : null;
    rows.push({
      userId, displayName: profile.display_name, avatarUrl: profile.avatar_url, rank: standing?.rank ?? null,
      playoffSeed: standing?.playoff_seed ?? null, bestOf, basePoints, adjustmentPoints, projectedPoints,
      persistedPoints, pointsDelta: persistedPoints === null ? null : projectedPoints - persistedPoints,
      countsTowardBestOf: counted.length, draftsPlayed: all.length, wins: all.filter(row => row.rank === 1).length,
      podiums: all.filter(row => row.rank <= 3).length,
      averageFinish: all.length ? round2(all.reduce((sum, row) => sum + row.rank, 0) / all.length) : 0,
      averageScore: all.length ? round2(all.reduce((sum, row) => sum + row.score, 0) / all.length) : 0,
      counted, dropped,
    });
  }
  return rows.sort((a, b) => b.projectedPoints - a.projectedPoints || b.wins - a.wins || b.podiums - a.podiums || a.averageFinish - b.averageFinish || b.averageScore - a.averageScore || a.userId.localeCompare(b.userId));
}

export function previewSeasonRemoval(data: CommissionerWorkspaceData, draftId: string): CommissionerImpact[] {
  if (!data.entries.some(entry => entry.draft_id === draftId && !entry.is_playoff)) return [];
  const before = deriveCommissionerPoints(data);
  const after = deriveCommissionerPoints({ ...data, entries: data.entries.filter(entry => entry.draft_id !== draftId) });
  return before.filter(row => row.draftsPlayed > 0 || row.persistedPoints !== null).map(row => pointImpact(data, row, after));
}
export function previewPointAdjustment(data: CommissionerWorkspaceData, userId: string, delta: number): CommissionerImpact | null {
  if (!Number.isInteger(delta) || delta < -100 || delta > 100 || delta === 0) return null;
  const row = deriveCommissionerPoints(data).find(player => player.userId === userId);
  if (!row) return null;
  const adjustment: CommissionerAdjustment = {
    id: 'preview', season_id: data.season.id, club_id: '', user_id: userId, delta, reason: 'Preview',
    created_by: '', created_at: '', revoked_at: null, revoked_by: null, revocation_reason: null,
  };
  return pointImpact(data, row, deriveCommissionerPoints({ ...data, adjustments: [...data.adjustments, adjustment] }));
}
function pointImpact(data: CommissionerWorkspaceData, before: CommissionerPointRow, after: CommissionerPointRow[]): CommissionerImpact {
  const eligible = after.filter(row => row.draftsPlayed > 0);
  const afterRow = eligible.find(row => row.userId === before.userId);
  const seedsLocked = data.season.status === 'playoffs' || data.season.status === 'complete';
  const rowRemoved = !afterRow && !seedsLocked && (before.draftsPlayed > 0 || before.persistedPoints !== null);
  const points = afterRow?.projectedPoints ?? (seedsLocked ? before.persistedPoints ?? before.projectedPoints : null);
  return {
    userId: before.userId, displayName: before.displayName, before: before.projectedPoints, after: points,
    delta: (points ?? 0) - before.projectedPoints, rowRemoved, seedsLocked,
    beforeSeed: before.playoffSeed, beforeRank: before.rank,
    afterSeed: seedsLocked ? before.playoffSeed : afterRow ? eligible.indexOf(afterRow) + 1 : null,
    afterRank: seedsLocked ? before.rank : afterRow ? 1 + eligible.filter(row => row.projectedPoints > afterRow.projectedPoints).length : null,
  };
}

function reportVerified(data: CommissionerWorkspaceData, draftId: string): boolean {
  return isCompleteDraftReport(
    data.results.filter(row => row.draft_id === draftId),
    [...new Set(data.participants.filter(row => row.draft_id === draftId).map(row => row.user_id))],
    data.picks.filter(row => row.draft_id === draftId),
  );
}
function actualPicker(data: CommissionerWorkspaceData, draft: CommissionerDraft): string | null {
  const participants = data.participants.filter(row => row.draft_id === draft.id);
  const consumed = data.picks.filter(row => row.draft_id === draft.id).length + data.skips.filter(row => row.draft_id === draft.id).length;
  return getDerivedDraftTurn(draft, participants, consumed).current_pick_user_id;
}

/** The untimed room threshold is an attention cue, not a turn timeout or skip rule. */
export const COMMISSIONER_STALLED_TURN_MS = 24 * 60 * 60 * 1000;
export function deriveCommissionerInbox(data: CommissionerWorkspaceData, now = Date.now()): CommissionerInboxItem[] {
  const profiles = new Map(data.profiles.map(profile => [profile.id, profile]));
  const drafts = new Map(data.drafts.map(draft => [draft.id, draft]));
  const href = (draft: CommissionerDraft) => `/drafts/${draft.is_live ? 'live/' : ''}${encodeURIComponent(draft.id)}`;
  const items: CommissionerInboxItem[] = [];
  for (const dispute of data.disputes) {
    const draft = drafts.get(dispute.draft_id), profile = profiles.get(dispute.user_id);
    if (dispute.status !== 'pending' || !draft || !profile) continue;
    items.push({ id: `dispute:${dispute.id}`, kind: 'dispute', priority: 'high', title: 'Pick dispute', detail: `${profile.display_name} · ${draft.topic}`, href: href(draft), draftId: draft.id, userId: dispute.user_id, matchId: null, createdAt: dispute.created_at });
  }
  for (const draft of data.drafts) {
    if (draft.status === 'complete' && !reportVerified(data, draft.id)) {
      items.push({ id: `report:${draft.id}`, kind: 'report', priority: 'high', title: 'Saved report needs attention', detail: draft.topic, href: href(draft), draftId: draft.id, userId: null, matchId: null, createdAt: draft.updated_at });
    }
    const picker = actualPicker(data, draft);
    if (draft.status !== 'in_progress' || !picker || !profiles.has(picker) || draft.clock_paused_at) continue;
    const deadline = draft.pick_deadline_at ? Date.parse(draft.pick_deadline_at) : NaN;
    const activity = Math.max(Date.parse(draft.updated_at) || 0, ...data.picks.filter(pick => pick.draft_id === draft.id).map(pick => Date.parse(pick.picked_at) || 0));
    const overdue = Number.isFinite(deadline) ? deadline < now : activity > 0 && now - activity >= COMMISSIONER_STALLED_TURN_MS;
    if (overdue) items.push({ id: `turn:${draft.id}`, kind: 'stalled_turn', priority: 'normal', title: 'Pick awaiting attention', detail: `${profiles.get(picker)!.display_name} · ${draft.topic}`, href: href(draft), draftId: draft.id, userId: picker, matchId: null, createdAt: Number.isFinite(deadline) ? draft.pick_deadline_at! : new Date(activity).toISOString() });
  }
  for (const match of data.matches) {
    if (match.status !== 'awaiting_topic' || !match.topic_picker_user_id || !profiles.has(match.topic_picker_user_id)) continue;
    items.push({ id: `topic:${match.id}`, kind: 'playoff_topic', priority: 'normal', title: 'Playoff topic needed', detail: `${profiles.get(match.topic_picker_user_id)!.display_name} · ${match.round} ${match.match_number}`, href: '/drafts?tab=season', draftId: match.draft_id, userId: match.topic_picker_user_id, matchId: match.id, createdAt: data.season.starts_at });
  }
  return items.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function deriveCommissionerParticipation(data: CommissionerWorkspaceData): CommissionerParticipation[] {
  const entries = new Set(data.entries.filter(entry => !entry.is_playoff).map(entry => entry.draft_id));
  const drafts = new Map(data.drafts.map(draft => [draft.id, draft]));
  const points = deriveCommissionerPoints(data);
  return points.map(player => {
    const joined = new Set(data.participants.filter(row => row.user_id === player.userId && entries.has(row.draft_id)).map(row => row.draft_id));
    return {
      userId: player.userId, displayName: player.displayName, avatarUrl: player.avatarUrl, joined: joined.size,
      completed: [...joined].filter(id => drafts.get(id)?.status === 'complete').length,
      reports: player.draftsPlayed, pendingTurns: data.drafts.filter(draft => draft.status === 'in_progress' && actualPicker(data, draft) === player.userId).length,
      remainingToBestOf: Math.max(0, player.bestOf - player.draftsPlayed), participationRate: entries.size ? round2(100 * joined.size / entries.size) : 0,
      skipped: new Set(data.skips.filter(skip => skip.user_id === player.userId && entries.has(skip.draft_id)).map(skip => `${skip.draft_id}:${skip.pick_number}`)).size,
      // Absence applies only to an actual visible club member already in this season's roster.
      missed: data.members.some(member => member.user_id === player.userId) ? data.drafts.filter(draft => {
        if (!entries.has(draft.id) || draft.status !== 'complete' || joined.has(draft.id)) return false;
        const member = data.members.find(row => row.user_id === player.userId)!;
        return Date.parse(draft.created_at) >= Date.parse(member.joined_at);
      }).length : 0,
    };
  }).sort((a, b) => b.completed - a.completed || b.joined - a.joined || a.displayName.localeCompare(b.displayName));
}

/** Mirrors the current playoff transition conditions; report/dispute totals remain visible audit cues. */
export function deriveCommissionerReadiness(data: CommissionerWorkspaceData): CommissionerReadiness {
  const regular = new Set(data.entries.filter(entry => !entry.is_playoff).map(entry => entry.draft_id));
  const completed = data.drafts.filter(draft => regular.has(draft.id) && draft.status === 'complete');
  const targetDrafts = data.season.regular_season_drafts || data.season.regular_season_weeks || 12;
  const remainingDrafts = Math.max(0, targetDrafts - completed.length);
  const blockers: string[] = [];
  if (data.season.status !== 'regular_season') blockers.push(data.season.status === 'playoffs' ? 'Playoffs already started.' : 'The season is not in regular play.');
  if (remainingDrafts > 0) blockers.push(`Finish ${remainingDrafts} more regular-season ${remainingDrafts === 1 ? 'draft' : 'drafts'}.`);
  if (data.standings.length < 2) blockers.push('At least two ranked players are needed.');
  return {
    regularDrafts: regular.size, targetDrafts, completedDrafts: completed.length,
    verifiedReports: completed.filter(draft => reportVerified(data, draft.id)).length,
    pendingDisputes: data.disputes.filter(dispute => dispute.status === 'pending').length,
    remainingDrafts, readyForPlayoffs: blockers.length === 0, blockers,
    rosterSize: new Set(data.participants.filter(row => regular.has(row.draft_id)).map(row => row.user_id)).size,
  };
}

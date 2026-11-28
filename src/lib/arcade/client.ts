import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import type { ArcadeBoard, ArcadePeriod, ArcadeRunSession, ArcadeScope, ArcadeSummary, ArcadeVerifiedResult } from '../../../supabase/functions/_shared/arcade/contracts';

export type { ArcadeBoard, ArcadeBoardEntry, ArcadePeriod, ArcadeRunSession, ArcadeScope, ArcadeStatus, ArcadeSummary, ArcadeVerifiedResult } from '../../../supabase/functions/_shared/arcade/contracts';

const clientBuild = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
const submissionTimeout = 30000;

export class ArcadeError extends Error {
  constructor(readonly code: string, message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'ArcadeError';
  }
}

function unavailable() {
  return new ArcadeError('unavailable', 'Couldn’t reach the arcade. Check your connection and try again.', true);
}

async function invoke<T>(body: Record<string, unknown>, timeout = QUERY_TIMEOUT_MS): Promise<T> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke<T>('arcade-run', { body, timeout }), timeout + 1000, 'Arcade request',
    );
    if (!error && data != null) return data;
    const response: Response | undefined = error?.context;
    const detail = await response?.json?.().catch(() => null);
    if (typeof detail?.error?.code === 'string' && typeof detail.error.message === 'string') {
      throw new ArcadeError(detail.error.code, detail.error.message, detail.error.retryable === true);
    }
    if (response?.status === 401 || response?.status === 403) {
      throw new ArcadeError('unauthorized', 'Sign in to this club to play ranked.', false);
    }
    throw unavailable();
  } catch (error) {
    if (error instanceof ArcadeError) throw error;
    throw unavailable();
  }
}

/** Passing the same requestId after a lost response reopens the original ticket. */
export function startArcadeRun(scope: ArcadeScope, requestId = crypto.randomUUID()): Promise<ArcadeRunSession> {
  return invoke({ action: 'start', ...scope, requestId, clientBuild });
}

export function getArcadeRunStatus(scope: ArcadeScope, runId: string): Promise<ArcadeRunSession> {
  return invoke({ action: 'status', ...scope, runId });
}

/** Only changes in held controls travel to the verifier. A retry must use the original recording. */
export function submitArcadeRun(
  scope: ArcadeScope, runId: string, inputEvents: ReadonlyArray<readonly [number, number]>,
  clientSummary: ArcadeSummary, replayEncodingVersion = 1,
): Promise<ArcadeVerifiedResult> {
  return invoke({ action: 'submit', ...scope, runId, replayEncodingVersion, inputEvents, clientSummary, clientBuild }, submissionTimeout);
}

export async function getArcadeLeaderboard(scope: ArcadeScope, period: ArcadePeriod): Promise<ArcadeBoard> {
  // The generated database types predate this migration.
  type ArcadeRpc = (name: 'arcade_leaderboard', args: Record<string, string>) => PromiseLike<{
    data: ArcadeBoard | null; error: { code: string } | null;
  }>;
  try {
    const { data, error } = await withTimeout(
      (supabase.rpc as unknown as ArcadeRpc)('arcade_leaderboard', {
        p_club_id: scope.clubId, p_game_key: scope.gameKey, p_ruleset_version: scope.rulesetVersion, p_period: period,
      }), QUERY_TIMEOUT_MS, 'Arcade leaderboard',
    );
    if (error?.code === '42501') throw new ArcadeError('not_eligible', 'This club leaderboard is unavailable.', false);
    if (error || !data) throw unavailable();
    return data;
  } catch (error) {
    if (error instanceof ArcadeError) throw error;
    throw unavailable();
  }
}

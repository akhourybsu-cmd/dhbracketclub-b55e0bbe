import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import { DeepClaimError } from '../service';
import { validateTutorialProgress } from './progress';
import type { TutorialProgress, TutorialProgressPatch } from './types';

const RPCS = ['dc_tutorial_get', 'dc_tutorial_save'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Optional education sync must never prevent opening the actual company. */
export class DeepClaimTutorialUnavailableError extends DeepClaimError {
  constructor() {
    super('Training Journal sync is not available yet. You can continue your company normally.', 'data');
    this.name = 'DeepClaimTutorialUnavailableError';
  }
}

export function parseDeepClaimTutorial(value: unknown): TutorialProgress {
  try {
    validateTutorialProgress(value);
    if (!uuid.test(value.user_id) || !uuid.test(value.club_id) || value.company_id !== null && !uuid.test(value.company_id)) throw new Error('Invalid journal identity.');
    return value;
  } catch {
    throw new DeepClaimError('Training progress could not be verified. Refresh the journal; your company is unchanged.', 'data');
  }
}

function tutorialFailure(error: unknown): DeepClaimError {
  if (error instanceof DeepClaimError) return error;
  const code = object(error) ? error.code : null;
  if (code === 'PGRST202' || code === '42883') return new DeepClaimTutorialUnavailableError();
  if (code === '42501') return new DeepClaimError('Training Journal is unavailable in your active club. Check membership and installation.', 'access');
  if (code === '40001' || code === '40P01' || code === '23505') return new DeepClaimError('Training progress changed on another device. Refresh before moving the lesson.', 'conflict');
  if (typeof code === 'string' && /^(22|23)/.test(code)) return new DeepClaimError('Those training choices could not be saved. Refresh the journal and try again.', 'rule');
  if (code === 'P0001') {
    // A rejected throttle is safe to retry with the same UUID. Keep its local
    // intent just like a lost connection; it is not invalid authored content.
    if (object(error) && error.message === 'Training progress is syncing too quickly. Try again in a moment.') return new DeepClaimError(error.message, 'network');
    const message = object(error) && typeof error.message === 'string' && error.message.length <= 240 && !Array.from(error.message).some(character => character.charCodeAt(0) < 32)
      ? error.message : 'Training progress could not be saved. Refresh the journal and try again.';
    return new DeepClaimError(message, 'rule');
  }
  return new DeepClaimError('Training progress could not sync. Your lesson is kept for a safe retry. Your company can continue normally.', 'network');
}

async function tutorialRpc(name: typeof RPCS[number], args: Record<string, unknown> = {}): Promise<TutorialProgress> {
  if (!RPCS.includes(name)) throw new DeepClaimError('Unknown Training Journal operation.', 'rule');
  try {
    const { data, error } = await withTimeout(supabase.rpc(name as never, args as never), QUERY_TIMEOUT_MS, 'Training Journal');
    if (error) throw error;
    return parseDeepClaimTutorial(data);
  } catch (error) {
    throw tutorialFailure(error);
  }
}

export async function fetchDeepClaimTutorial(): Promise<TutorialProgress> {
  return tutorialRpc('dc_tutorial_get');
}

export async function saveDeepClaimTutorial(patch: TutorialProgressPatch, expectedRevision: number, requestId: string): Promise<TutorialProgress> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision > 2_147_483_647 || !uuid.test(requestId)) throw new DeepClaimError('Invalid training save request.', 'rule');
  return tutorialRpc('dc_tutorial_save', { p_patch: patch, p_expected_revision: expectedRevision, p_request_id: requestId });
}

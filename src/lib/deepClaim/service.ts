import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import { validateDeepClaimPreview, validateDeepClaimSnapshot } from './world';
import type { DeepClaimDispatchInput, DeepClaimPreview, DeepClaimSnapshot } from './types';

export class DeepClaimError extends Error {
  constructor(message: string, public readonly code: 'network' | 'access' | 'conflict' | 'rule' | 'data' = 'network') {
    super(message); this.name = 'DeepClaimError';
  }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const DEEP_CLAIM_MUTATIONS = ['dc_bootstrap','dc_dispatch','dc_collect','dc_sell','dc_upgrade','dc_hire','dc_train','dc_assign_equipment','dc_repair_equipment','dc_retire_equipment','dc_start_production','dc_collect_production','dc_dispatch_operation','dc_resolve_discovery'] as const;
export type DeepClaimMutation = typeof DEEP_CLAIM_MUTATIONS[number];
export function parseDeepClaimSnapshot(value: unknown): DeepClaimSnapshot {
  try { validateDeepClaimSnapshot(value); return value; }
  catch { throw new DeepClaimError('The saved operation could not be verified. Refresh to recover your company.', 'data'); }
}
export function parseDeepClaimPreview(value: unknown): DeepClaimPreview {
  try { validateDeepClaimPreview(value); return value; }
  catch { throw new DeepClaimError('The expedition quote could not be verified. Refresh and review your crew.', 'data'); }
}
export function deepClaimFailure(error: unknown): DeepClaimError {
  if (error instanceof DeepClaimError) return error;
  const code = object(error) ? error.code : null;
  if (code === '42501') return new DeepClaimError('Deep Claim is unavailable in your active club. Check membership and installation.', 'access');
  if (code === '40001' || code === '23505' || code === '40P01') return new DeepClaimError('Your company changed on another device. Refresh, review the new state, and try again.', 'conflict');
  if (typeof code === 'string' && /^(22|23)/.test(code)) return new DeepClaimError('Those choices could not be applied. Refresh and review your company before trying again.', 'rule');
  if (code === 'P0001') {
    const message = object(error) && typeof error.message === 'string' && error.message.length <= 240 && !Array.from(error.message).some(character => character.charCodeAt(0) < 32)
      ? error.message : 'That operation was rejected. Refresh and review your company before trying again.';
    return new DeepClaimError(message, 'rule');
  }
  return new DeepClaimError('Deep Claim could not sync. Your action is kept for a safe retry. Check your connection.');
}
export async function deepClaimRpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (!['dc_get','dc_reconcile','dc_preview','dc_preview_operation',...DEEP_CLAIM_MUTATIONS].includes(name)) throw new DeepClaimError('Unknown company operation.', 'rule');
  try {
    const { data, error } = await withTimeout(supabase.rpc(name as never, args as never), QUERY_TIMEOUT_MS, 'Deep Claim');
    if (error) throw error;
    return data;
  } catch (error) {
    const failure = deepClaimFailure(error);
    if (failure.code === 'network' && !DEEP_CLAIM_MUTATIONS.some(operation => operation === name)) {
      throw new DeepClaimError(name.startsWith('dc_preview')
        ? 'The expedition quote could not sync. Check your connection and review the operation again.'
        : 'Your company could not sync. Check your connection and refresh. Dispatched crews continue working.');
    }
    throw failure;
  }
}
export async function fetchDeepClaim(): Promise<DeepClaimSnapshot> { return parseDeepClaimSnapshot(await deepClaimRpc('dc_get')); }
export function deepClaimDispatchArgs(input: DeepClaimDispatchInput): Record<string, unknown> {
  return { p_worker_ids: [...input.worker_ids], p_mode: input.mode, p_target_x: input.target_x, p_target_y: input.target_y,
    p_duration_minutes: input.duration_minutes, p_tutorial: input.tutorial ?? false };
}
export function deepClaimOperationArgs(input: DeepClaimDispatchInput): Record<string, unknown> {
  return { ...deepClaimDispatchArgs(input), p_infrastructure_key: input.infrastructure_key ?? null };
}
export async function previewDeepClaim(input: DeepClaimDispatchInput, schemaVersion = 2): Promise<DeepClaimPreview> {
  return parseDeepClaimPreview(await deepClaimRpc(schemaVersion >= 3 ? 'dc_preview_operation' : 'dc_preview', schemaVersion >= 3 ? deepClaimOperationArgs(input) : deepClaimDispatchArgs(input)));
}
export async function mutateDeepClaim(operation: string, args: Record<string, unknown>): Promise<DeepClaimSnapshot> {
  return parseDeepClaimSnapshot(await deepClaimRpc(operation, args));
}
/** Background reads may finish after a mutation: never roll a company back. */
export function shareDeepClaimSnapshot(previous: unknown, incoming: unknown): DeepClaimSnapshot {
  const next = incoming as DeepClaimSnapshot, before = previous as DeepClaimSnapshot | undefined;
  if (before?.company && !next.company || before && before.revision > next.revision) return before!;
  if (before && before.revision === next.revision && Date.parse(before.server_now) > Date.parse(next.server_now)) return before;
  return next;
}

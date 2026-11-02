import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import { DeepClaimError, DEEP_CLAIM_MUTATIONS } from '@/lib/deepClaim/service';
import { createTutorialProgress } from '@/lib/deepClaim/tutorial/progress';
import { DeepClaimTutorialUnavailableError, fetchDeepClaimTutorial, parseDeepClaimTutorial, saveDeepClaimTutorial } from '@/lib/deepClaim/tutorial/service';

const wire = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: wire.rpc } }));
const scope = { user_id: '00000000-0000-4000-8000-000000000001', club_id: '00000000-0000-4000-8000-000000000010', company_id: '00000000-0000-4000-8000-000000000101' };
const request = '00000000-0000-4000-8000-000000009001';
const progress = () => createTutorialProgress(scope, '2026-11-02T10:00:00.000Z');

describe('separate educational journal transport', () => {
  beforeEach(() => wire.rpc.mockReset());
  afterEach(() => vi.useRealTimers());

  it('reads only the secured educational endpoint and validates company identity', async () => {
    wire.rpc.mockResolvedValueOnce({ data: progress(), error: null });
    expect(await fetchDeepClaimTutorial()).toEqual(progress());
    expect(wire.rpc).toHaveBeenCalledExactlyOnceWith('dc_tutorial_get', {});
    expect(DEEP_CLAIM_MUTATIONS).not.toContain('dc_tutorial_save');
  });

  it('sends raw metadata, independent revision and unchanged retry UUID without a gameplay mutation', async () => {
    const patch = { active_lesson_id: 'beginner.claim', active_step_id: 'beginner.claim.deed', campaign_status: 'active' } as const;
    const response = { ...progress(), ...patch, revision: 1, updated_at: '2026-11-02T10:00:00.000Z' };
    wire.rpc.mockResolvedValue({ data: response, error: null });
    await saveDeepClaimTutorial(patch, 0, request); await saveDeepClaimTutorial(patch, 0, request);
    expect(wire.rpc).toHaveBeenNthCalledWith(1, 'dc_tutorial_save', { p_patch: patch, p_expected_revision: 0, p_request_id: request });
    expect(wire.rpc).toHaveBeenNthCalledWith(2, 'dc_tutorial_save', { p_patch: patch, p_expected_revision: 0, p_request_id: request });
    expect(wire.rpc.mock.calls.every(([name]) => name === 'dc_tutorial_save')).toBe(true);
  });

  it.each(['PGRST202','42883'])('makes an unavailable optional migration %s distinguishable from game access', async code => {
    wire.rpc.mockResolvedValueOnce({ data: null, error: { code } });
    await expect(fetchDeepClaimTutorial()).rejects.toBeInstanceOf(DeepClaimTutorialUnavailableError);
  });

  it.each([['42501','access'],['40001','conflict'],['40P01','conflict'],['22023','rule']])('classifies %s as %s for safe journal recovery', async (code, expected) => {
    wire.rpc.mockResolvedValueOnce({ data: null, error: { code } });
    await expect(saveDeepClaimTutorial({ completed_steps: [] }, 0, request)).rejects.toMatchObject({ code: expected });
  });

  it('rejects corrupt, foreign-shaped, unknown-content or economic fields in a journal response', () => {
    for (const value of [{ ...progress(), cash: 999 }, { ...progress(), user_id: 'not-a-uuid' }, { ...progress(), company_id: 'fake-company' }, { ...progress(), completed_steps: ['beginner.claim.forged'] }, { ...progress(), revision: -1 }]) {
      expect(() => parseDeepClaimTutorial(value)).toThrow(DeepClaimError);
    }
    expect(parseDeepClaimTutorial({ ...progress(), company_id: null }).company_id).toBeNull();
  });

  it('refuses invalid revision/request identity before issuing any server call', async () => {
    for (const revision of [-1, 0.5, Number.NaN, 2_147_483_648]) await expect(saveDeepClaimTutorial({}, revision, request)).rejects.toMatchObject({ code: 'rule' });
    await expect(saveDeepClaimTutorial({}, 0, 'unknown-request')).rejects.toMatchObject({ code: 'rule' });
    expect(wire.rpc).not.toHaveBeenCalled();
  });

  it('keeps a throttled educational intent retryable instead of classifying it as invalid content', async () => {
    const message = 'Training progress is syncing too quickly. Try again in a moment.';
    wire.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message } });
    await expect(saveDeepClaimTutorial({ completed_steps: ['beginner.claim.deed'] }, 0, request)).rejects.toMatchObject({ code: 'network', message });
    wire.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Invalid training request.' } });
    await expect(saveDeepClaimTutorial({}, 0, request)).rejects.toMatchObject({ code: 'rule' });
  });

  it('a stalled journal times out independently and keeps company access recoverable', async () => {
    vi.useFakeTimers(); wire.rpc.mockReturnValueOnce(new Promise(() => {}));
    const pending = fetchDeepClaimTutorial();
    const rejected = expect(pending).rejects.toMatchObject({ code: 'network', message: expect.stringContaining('company can continue normally') });
    await vi.advanceTimersByTimeAsync(QUERY_TIMEOUT_MS + 1); await rejected;
  });
});

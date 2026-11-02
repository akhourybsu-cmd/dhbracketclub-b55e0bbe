import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeepClaimTutorial } from '@/hooks/useDeepClaimTutorial';
import { DeepClaimError } from '@/lib/deepClaim/service';
import type { TutorialProgress, TutorialProgressPatch, TutorialScope } from '@/lib/deepClaim/tutorial/types';

const wire = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/deepClaim/tutorial/service', () => ({ fetchDeepClaimTutorial: wire.get, saveDeepClaimTutorial: wire.save }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

const owner: TutorialScope = { user_id: 'user-a', club_id: 'club-a', company_id: 'company-a' };
const storageKey = (scope: TutorialScope) => `dh:deep-claim:training:pending:v1:${scope.user_id}:${scope.club_id}:${scope.company_id ?? 'unfounded'}`;
function progress(scope = owner, revision = 0, patch: Partial<TutorialProgress> = {}): TutorialProgress {
  return { ...scope, version: 1, server_now: '2026-11-02T12:00:00Z', revision,
    active_lesson_id: null, active_step_id: null, completed_steps: [], reviewed_lessons: [], practiced_lessons: [], skipped_lessons: [], seen_dialogue: [],
    campaign_status: 'not_started', commentary_enabled: true, updated_at: null, ...patch };
}
function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, Wrapper };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  onlineManager.setOnline(value); window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); setOnline(true);
  wire.get.mockResolvedValue(progress()); wire.save.mockResolvedValue(progress(owner, 1));
});
afterEach(() => { cleanup(); localStorage.clear(); onlineManager.setOnline(true); });

describe('Deep Claim educational progress queue and identity', () => {
  it('does not fetch or persist while disabled, and never saves an unfounded company', async () => {
    const { Wrapper } = harness();
    const hook = renderHook(({ scope, enabled }) => useDeepClaimTutorial({ scope, enabled }), { wrapper: Wrapper, initialProps: { scope: owner, enabled: false } });
    act(() => hook.result.current.update({ reviewed_lessons: ['industry.ore'] }));
    expect(wire.get).not.toHaveBeenCalled(); expect(wire.save).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
    const unfounded = { ...owner, company_id: null }; wire.get.mockResolvedValue(progress(unfounded));
    hook.rerender({ scope: unfounded, enabled: true });
    await waitFor(() => expect(hook.result.current.synced).toBe(true));
    act(() => hook.result.current.update({ campaign_status: 'active' }));
    expect(wire.save).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
  });

  it('retries a committed lost acknowledgement after remount with the same UUID, patch and revision', async () => {
    const saved = progress(owner, 1, { reviewed_lessons: ['industry.ore'] });
    wire.save.mockRejectedValueOnce(new DeepClaimError('Journal connection lost', 'network')).mockResolvedValue(saved);
    const first = harness(), hook = renderHook(() => useDeepClaimTutorial({ scope: owner, enabled: true }), { wrapper: first.Wrapper });
    await waitFor(() => expect(hook.result.current.synced).toBe(true));
    act(() => hook.result.current.update({ reviewed_lessons: ['industry.ore'] }));
    await waitFor(() => expect(hook.result.current.error).toContain('connection lost'));
    const original = wire.save.mock.calls[0];
    expect(original).toEqual([{ reviewed_lessons: ['industry.ore'] }, 0, expect.any(String)]);
    expect(hook.result.current.pending).toBe(1); hook.unmount(); first.client.clear();
    wire.get.mockResolvedValue(saved);
    const second = harness(), resumed = renderHook(() => useDeepClaimTutorial({ scope: owner, enabled: true }), { wrapper: second.Wrapper });
    await waitFor(() => expect(resumed.result.current.synced).toBe(true));
    expect(wire.save.mock.calls).toEqual([original, original]);
    expect(resumed.result.current.progress.reviewed_lessons).toEqual(['industry.ore']);
    expect(localStorage.getItem(storageKey(owner))).toBeNull();
  });

  it('keeps offline educational notes local and automatically syncs them after reconnecting', async () => {
    setOnline(false); wire.save.mockResolvedValue(progress(owner, 1, { practiced_lessons: ['field.survey'] }));
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaimTutorial({ scope: owner, enabled: true }), { wrapper: Wrapper });
    act(() => hook.result.current.update({ practiced_lessons: ['field.survey'] }));
    expect(hook.result.current.progress.practiced_lessons).toEqual(['field.survey']);
    expect(hook.result.current.pending).toBe(1); expect(hook.result.current.synced).toBe(false); expect(wire.save).not.toHaveBeenCalled();
    act(() => setOnline(true));
    await waitFor(() => expect(hook.result.current.synced).toBe(true));
    expect(wire.save).toHaveBeenCalledTimes(1); expect(hook.result.current.progress.practiced_lessons).toEqual(['field.survey']);
  });

  it('keeps another device’s newer cursor after a conflict while merging completed learning', async () => {
    const pending = deferred<TutorialProgress>(); wire.save.mockImplementationOnce(() => pending.promise);
    const fresh = progress(owner, 7, { active_lesson_id: 'field.survey', active_step_id: 'field.survey.survey', campaign_status: 'paused', reviewed_lessons: ['workforce.stats'] });
    wire.get.mockResolvedValueOnce(progress()).mockResolvedValue(fresh);
    wire.save.mockImplementation(async (patch: TutorialProgressPatch) => progress(owner, 8, { ...fresh, ...patch, revision: 8,
      reviewed_lessons: [...new Set([...fresh.reviewed_lessons, ...(patch.reviewed_lessons ?? [])])] }));
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaimTutorial({ scope: owner, enabled: true }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.synced).toBe(true));
    act(() => hook.result.current.update({ active_lesson_id: 'industry.ore', campaign_status: 'active', reviewed_lessons: ['industry.ore'] }));
    await waitFor(() => expect(wire.save).toHaveBeenCalledTimes(1));
    await act(async () => pending.reject(new DeepClaimError('Another device advanced the journal', 'conflict')));
    await waitFor(() => expect(hook.result.current.synced).toBe(true));
    expect(wire.save.mock.calls[1][0]).toEqual({ reviewed_lessons: ['industry.ore'] });
    expect(wire.save.mock.calls[1][1]).toBe(7); expect(wire.save.mock.calls[1][2]).not.toBe(wire.save.mock.calls[0][2]);
    expect(hook.result.current.progress).toMatchObject({ active_lesson_id: 'field.survey', campaign_status: 'paused', revision: 8 });
    expect(hook.result.current.progress.reviewed_lessons).toEqual(expect.arrayContaining(['workforce.stats', 'industry.ore']));
  });

  it('does not install an old in-flight save into a newly selected company or drain its queue', async () => {
    const pending = deferred<TutorialProgress>(); wire.save.mockReturnValue(pending.promise);
    const other = { ...owner, club_id: 'club-b', company_id: 'company-b' };
    wire.get.mockResolvedValueOnce(progress()).mockResolvedValue(progress(other, 4));
    const { client, Wrapper } = harness(), hook = renderHook(({ scope }) => useDeepClaimTutorial({ scope, enabled: true }), { wrapper: Wrapper, initialProps: { scope: owner } });
    await waitFor(() => expect(hook.result.current.synced).toBe(true));
    act(() => hook.result.current.update({ reviewed_lessons: ['settings.exit'] }));
    await waitFor(() => expect(wire.save).toHaveBeenCalledTimes(1)); hook.rerender({ scope: other });
    await waitFor(() => expect(hook.result.current.progress.company_id).toBe('company-b'));
    await act(async () => pending.resolve(progress(owner, 1, { reviewed_lessons: ['settings.exit'] })));
    expect(hook.result.current.progress.company_id).toBe('company-b'); expect(hook.result.current.progress.reviewed_lessons).toEqual([]);
    expect(hook.result.current.pending).toBe(0); expect(localStorage.getItem(storageKey(owner))).not.toBeNull();
    expect(client.getQueryData(['deep-claim-tutorial', other.user_id, other.club_id, other.company_id])).toMatchObject({ revision: 4, company_id: 'company-b' });
  });

  it('does not rewind a newer acknowledged revision when a background read returns older progress', async () => {
    wire.get.mockResolvedValue(progress(owner, 5, { reviewed_lessons: ['industry.ore'] }));
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaimTutorial({ scope: owner, enabled: true }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.progress.revision).toBe(5));
    wire.get.mockResolvedValue(progress(owner, 2)); await act(async () => hook.result.current.refresh());
    expect(hook.result.current.progress.revision).toBe(5); expect(hook.result.current.progress.reviewed_lessons).toEqual(['industry.ore']);
  });

  it('discards an explicitly rejected educational note instead of retrying it forever', async () => {
    wire.save.mockRejectedValue(new DeepClaimError('Unknown lesson', 'rule'));
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaimTutorial({ scope: owner, enabled: true }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.synced).toBe(true));
    act(() => hook.result.current.update({ reviewed_lessons: ['industry.ore'] }));
    await waitFor(() => expect(hook.result.current.error).toBe('Unknown lesson'));
    expect(hook.result.current.pending).toBe(0); expect(localStorage.getItem(storageKey(owner))).toBeNull();
    await act(async () => hook.result.current.refresh()); expect(wire.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    { reviewed_lessons: 'industry.ore' },
    { completed_steps: ['missing.step'] },
    { campaign_status: 'invented-status' },
    { commentary_enabled: { enabled: true } },
  ])('ignores malformed persisted educational values without crashing the company view: %j', async patch => {
    localStorage.setItem(storageKey(owner), JSON.stringify([{ id: '00000000-0000-4000-8000-000000000099', expected: 0, patch }]));
    const { Wrapper } = harness();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const hook = renderHook(() => useDeepClaimTutorial({ scope: owner, enabled: true }), { wrapper: Wrapper });
      await waitFor(() => expect(hook.result.current.synced).toBe(true));
      expect(wire.save).not.toHaveBeenCalled(); expect(hook.result.current.pending).toBe(0);
      expect(hook.result.current.progress).toMatchObject({ campaign_status: 'not_started', commentary_enabled: true, reviewed_lessons: [], completed_steps: [] });
    } finally { errors.mockRestore(); }
  });
});

import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_DEFAULTS, useNotificationPreferences } from '@/hooks/useNotificationPreferences';

const mock = vi.hoisted(() => ({ uid: 'alex', read: vi.fn(), write: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.uid ? { id: mock.uid } : null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({
  select: () => ({ eq: (_field: string, owner: string) => ({ maybeSingle: () => mock.read(owner) }) }),
  upsert: (payload: Record<string, unknown>) => mock.write(payload),
}) } }));
let cache: QueryClient;
let rows: Map<string, Record<string, unknown>>;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
beforeEach(() => {
  mock.uid = 'alex'; rows = new Map([['alex', { deep_claim: true, posts: false }], ['blair', { deep_claim: false, polls: false }]]);
  mock.read.mockReset().mockImplementation(async owner => ({ data: rows.get(owner) ?? null, error: null }));
  mock.write.mockReset().mockImplementation(async payload => { rows.set(payload.user_id, { ...rows.get(payload.user_id), ...payload }); return { error: null }; });
  cache = new QueryClient({ defaultOptions: { queries: { retryDelay: 1, gcTime: Infinity }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); cache.clear(); vi.useRealTimers(); });

describe('Shared account-scoped notification preferences', () => {
  it('loads saved settings and writes only the selected field, preserving another device’s changes', async () => {
    const { result } = renderHook(useNotificationPreferences, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false)); expect(result.current.prefs.posts).toBe(false);
    rows.set('alex', { ...rows.get('alex'), polls: false });
    await act(() => result.current.update('deep_claim', false));
    expect(mock.write).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'alex', deep_claim: false }));
    expect(Object.keys(mock.write.mock.calls[0][0]).sort()).toEqual(['deep_claim', 'updated_at', 'user_id']);
    expect(rows.get('alex')).toMatchObject({ posts: false, polls: false, deep_claim: false });
  });
  it('shares optimistic state and blocks overlapping account writes across both consumers', async () => {
    const { result } = renderHook(() => ({ first: useNotificationPreferences(), second: useNotificationPreferences() }), { wrapper });
    await waitFor(() => expect(result.current.first.loading).toBe(false));
    let release!: (value: { error: null }) => void;
    mock.write.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    let pending!: Promise<void>; act(() => { pending = result.current.first.update('deep_claim', false); });
    await waitFor(() => expect(result.current.second.saving).toBe(true));
    expect(result.current.second.prefs.deep_claim).toBe(false);
    await expect(result.current.second.update('posts', true)).rejects.toThrow(/current preference/);
    await act(async () => { release({ error: null }); await pending; }); expect(mock.write).toHaveBeenCalledOnce();
  });
  it('rolls back failed writes, surfaces the error and recovers with an explicit refresh', async () => {
    const { result } = renderHook(useNotificationPreferences, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mock.write.mockResolvedValueOnce({ error: { message: 'Save unavailable' } });
    await act(async () => { await expect(result.current.update('deep_claim', false)).rejects.toThrow('Save unavailable'); });
    await waitFor(() => expect(result.current.prefs.deep_claim).toBe(true)); expect(result.current.error).toContain('Save unavailable');
    await act(() => result.current.refresh()); await waitFor(() => expect(result.current.error).toBeNull());
  });
  it('exposes bounded read failures and a retry instead of silently treating them as defaults', async () => {
    mock.read.mockResolvedValue({ data: null, error: { message: 'Load unavailable' } });
    const { result } = renderHook(useNotificationPreferences, { wrapper });
    await waitFor(() => expect(result.current.error).toContain('Load unavailable'));
    expect(result.current.loading).toBe(false);
    await expect(result.current.update('deep_claim', false)).rejects.toThrow(/Load notification preferences/);
    mock.read.mockResolvedValue({ data: { deep_claim: false }, error: null });
    await act(() => result.current.refresh()); await waitFor(() => expect(result.current.prefs.deep_claim).toBe(false));
    expect(result.current.error).toBeNull();
  });
  it('times out a hung read and can recover when the connection returns', async () => {
    vi.useFakeTimers(); mock.read.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(useNotificationPreferences, { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(12_002)); await act(() => vi.advanceTimersByTimeAsync(12_002));
    expect(result.current.loading).toBe(false); expect(result.current.error).toMatch(/timed out/);
    mock.read.mockResolvedValue({ data: { deep_claim: false }, error: null });
    await act(() => result.current.refresh()); await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.prefs.deep_claim).toBe(false);
  });
  it('ignores a prior account’s delayed read and rejects its captured mutation callback', async () => {
    let release!: (value: unknown) => void;
    mock.read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const { result, rerender } = renderHook(useNotificationPreferences, { wrapper }); const previousUpdate = result.current.update;
    act(() => { mock.uid = 'blair'; rerender(); });
    await waitFor(() => expect(result.current.loading).toBe(false)); expect(result.current.prefs.deep_claim).toBe(false);
    await act(async () => { release({ data: { deep_claim: true }, error: null }); });
    expect(result.current.prefs.deep_claim).toBe(false);
    await expect(previousUpdate('deep_claim', false)).rejects.toThrow(/Sign in/); expect(mock.write).not.toHaveBeenCalled();
    act(() => { mock.uid = ''; rerender(); }); expect(result.current.loading).toBe(false); expect(result.current.prefs).toEqual(NOTIFICATION_DEFAULTS);
  });
  it('does not report an old account’s in-flight write as the new account’s success or preference', async () => {
    const { result, rerender } = renderHook(useNotificationPreferences, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false)); let release!: (value: { error: null }) => void;
    mock.write.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    let pending!: Promise<void>; act(() => { pending = result.current.update('deep_claim', false); });
    await waitFor(() => expect(result.current.saving).toBe(true)); act(() => { mock.uid = 'blair'; rerender(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { release({ error: null }); await expect(pending).rejects.toThrow(/account changed/); });
    expect(result.current.prefs).toMatchObject({ deep_claim: false, polls: false }); expect(result.current.error).toBeNull(); expect(result.current.saving).toBe(false);
  });
});

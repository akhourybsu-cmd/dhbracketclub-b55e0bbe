import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountUp, useFirstSeen } from '@/lib/draft/animations';

let media: MediaQueryList;
let hidden: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  media = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  let time = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) =>
    window.setTimeout(() => { time += 16; callback(time); }, 16));
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => window.clearTimeout(id));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Draft Arena presentation lifecycle', () => {
  it('baselines loaded picks, highlights only a new arrival and expires the highlight', () => {
    const view = renderHook(({ ids, ready }) => useFirstSeen(ids, { ready, scope: 'room-a' }), {
      initialProps: { ids: [] as string[], ready: false },
    });
    view.rerender({ ids: ['old-1', 'old-2'], ready: true });
    expect([...view.result.current]).toEqual([]);
    view.rerender({ ids: ['old-1', 'old-2', 'new-3'], ready: true });
    expect([...view.result.current]).toEqual(['new-3']);
    act(() => vi.advanceTimersByTime(900));
    expect(view.result.current.size).toBe(0);
    view.rerender({ ids: ['old-1', 'old-2', 'new-3'], ready: true });
    expect(view.result.current.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not celebrate room changes or arrivals while backgrounded', () => {
    const view = renderHook(({ ids, scope }) => useFirstSeen(ids, { scope }), {
      initialProps: { ids: ['a'], scope: 'room-a' },
    });
    view.rerender({ ids: ['b', 'c'], scope: 'room-b' });
    expect(view.result.current.size).toBe(0);
    view.rerender({ ids: ['b', 'c', 'd'], scope: 'room-b' });
    expect([...view.result.current]).toEqual(['d']);
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    view.rerender({ ids: ['b', 'c', 'd', 'e'], scope: 'room-b' });
    expect(view.result.current.size).toBe(0);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(view.result.current.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows exact numbers without animation when reduced motion is selected', () => {
    Object.assign(media, { matches: true });
    const view = renderHook(({ value }) => useCountUp(value), { initialProps: { value: 42 } });
    expect(view.result.current).toBe(42);
    view.rerender({ value: 57 });
    expect(view.result.current).toBe(57);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('cancels a counting animation on backgrounding and resumes from the real value', () => {
    const view = renderHook(() => useCountUp(100, 400));
    act(() => vi.advanceTimersByTime(80));
    expect(view.result.current).toBeGreaterThan(0);
    expect(view.result.current).toBeLessThan(100);
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(view.result.current).toBe(100);
    expect(vi.getTimerCount()).toBe(0);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(view.result.current).toBe(100);
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

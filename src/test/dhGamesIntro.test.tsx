import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DHGamesIntro } from '@/components/games/DHGamesIntro';
import { DH_GAMES_INTRO_TIMING } from '@/components/games/publisherIntroTiming';

type MediaHandler = (event: MediaQueryListEvent) => void;
let systemReducedMotion = false;
const mediaHandlers = new Set<MediaHandler>();
let visibility: DocumentVisibilityState = 'visible';
const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');

function intro() { return screen.getByTestId('dh-games-intro'); }
function advance(milliseconds: number) { act(() => { vi.advanceTimersByTime(milliseconds); }); }
function changeSystemMotion(value: boolean) {
  systemReducedMotion = value;
  act(() => { for (const handler of [...mediaHandlers]) handler({ matches: value, media: '(prefers-reduced-motion: reduce)' } as MediaQueryListEvent); });
}
function background(value: boolean) {
  visibility = value ? 'hidden' : 'visible';
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  systemReducedMotion = false; visibility = 'visible'; mediaHandlers.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility === 'hidden' });
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, get matches() { return query === '(prefers-reduced-motion: reduce)' && systemReducedMotion; }, onchange: null,
    addEventListener: (_type: string, handler: MediaHandler) => { mediaHandlers.add(handler); },
    removeEventListener: (_type: string, handler: MediaHandler) => { mediaHandlers.delete(handler); },
    addListener: (handler: MediaHandler) => { mediaHandlers.add(handler); },
    removeListener: (handler: MediaHandler) => { mediaHandlers.delete(handler); },
    dispatchEvent: () => true,
  })));
});
afterEach(() => {
  cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); mediaHandlers.clear();
  if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor); else Reflect.deleteProperty(document, 'visibilityState');
  if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor); else Reflect.deleteProperty(document, 'hidden');
});

describe('DH Games publisher intro', () => {
  it('reveals, holds and slowly fades on the documented clock before completing exactly once', () => {
    expect(DH_GAMES_INTRO_TIMING).toEqual({ reveal: 600, hold: 2400, fade: 1800, total: 4800, reducedHold: 1200 });
    const complete = vi.fn(), reveal = vi.fn(); render(<DHGamesIntro onComplete={complete} onReveal={reveal} />);
    expect(screen.getByRole('region', { name: 'DH Games' })).toBe(intro());
    expect(screen.getByRole('button', { name: 'Skip intro' })).toBeEnabled();
    expect(intro()).toHaveAttribute('data-phase', 'reveal');
    advance(599); expect(intro()).toHaveAttribute('data-phase', 'reveal'); expect(reveal).not.toHaveBeenCalled();
    advance(1); expect(intro()).toHaveAttribute('data-phase', 'hold');
    advance(2399); expect(intro()).toHaveAttribute('data-phase', 'hold'); expect(complete).not.toHaveBeenCalled();
    advance(1); expect(intro()).toHaveAttribute('data-phase', 'fade'); expect(reveal).toHaveBeenCalledTimes(1);
    advance(1799); expect(complete).not.toHaveBeenCalled();
    advance(1); expect(complete).toHaveBeenCalledTimes(1);
    advance(20000); expect(complete).toHaveBeenCalledTimes(1); expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('keeps one elapsed timeline and one completion under StrictMode effect replay', () => {
    const complete = vi.fn(), reveal = vi.fn();
    render(<StrictMode><DHGamesIntro onComplete={complete} onReveal={reveal} /></StrictMode>);
    advance(600); expect(intro()).toHaveAttribute('data-phase', 'hold');
    advance(2400); expect(intro()).toHaveAttribute('data-phase', 'fade'); expect(reveal).toHaveBeenCalledTimes(1);
    advance(1800); expect(complete).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });

  it('does not restart the clock on rerender and invokes the latest completion callbacks', () => {
    const firstComplete = vi.fn(), nextComplete = vi.fn(), firstReveal = vi.fn(), nextReveal = vi.fn();
    const view = render(<DHGamesIntro onComplete={firstComplete} onReveal={firstReveal} />);
    advance(900); view.rerender(<DHGamesIntro onComplete={nextComplete} onReveal={nextReveal} />);
    advance(2100); expect(intro()).toHaveAttribute('data-phase', 'fade'); expect(nextReveal).toHaveBeenCalledTimes(1); expect(firstReveal).not.toHaveBeenCalled();
    advance(1800); expect(nextComplete).toHaveBeenCalledTimes(1); expect(firstComplete).not.toHaveBeenCalled();
    advance(10000); expect(nextComplete).toHaveBeenCalledTimes(1);
  });

  it('skips immediately through the accessible button and cancels the remaining presentation', () => {
    const complete = vi.fn(), reveal = vi.fn(); render(<DHGamesIntro onComplete={complete} onReveal={reveal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip intro' }));
    expect(complete).toHaveBeenCalledTimes(1); expect(reveal).not.toHaveBeenCalled();
    advance(20000); expect(complete).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['Enter', ' ', 'Escape'])('allows %j to skip from anywhere without a second completion', key => {
    const complete = vi.fn(); render(<><button type="button">Underlying menu</button><DHGamesIntro onComplete={complete} /></>);
    const outside = screen.getByRole('button', { name: 'Underlying menu' }); outside.focus();
    fireEvent.keyDown(outside, { key, code: key === ' ' ? 'Space' : key });
    expect(complete).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key }); advance(20000); expect(complete).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab and Shift+Tab on the skip control instead of leaking focus into the hidden menu', () => {
    const complete = vi.fn(); render(<><button type="button">Underlying menu</button><DHGamesIntro onComplete={complete} /></>);
    const skip = screen.getByRole('button', { name: 'Skip intro' }); skip.focus();
    expect(fireEvent.keyDown(skip, { key: 'Tab' })).toBe(false); expect(skip).toHaveFocus();
    expect(fireEvent.keyDown(skip, { key: 'Tab', shiftKey: true })).toBe(false); expect(skip).toHaveFocus();
    screen.getByRole('button', { name: 'Underlying menu' }).focus();
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false); expect(skip).toHaveFocus();
    fireEvent.keyDown(skip, { key: 'ArrowRight' }); expect(complete).not.toHaveBeenCalled();
  });

  it.each([
    { userReduced: true, systemReduced: false },
    { userReduced: false, systemReduced: true },
    { userReduced: undefined, systemReduced: true },
  ])('uses a short static hold when reduced motion is requested: %j', ({ userReduced, systemReduced }) => {
    systemReducedMotion = systemReduced; const complete = vi.fn(), reveal = vi.fn();
    render(<DHGamesIntro onComplete={complete} onReveal={reveal} reducedMotion={userReduced} />);
    expect(intro()).toHaveAttribute('data-phase', 'hold'); advance(1199); expect(complete).not.toHaveBeenCalled();
    advance(1); expect(complete).toHaveBeenCalledTimes(1); expect(reveal).not.toHaveBeenCalled();
    advance(10000); expect(complete).toHaveBeenCalledTimes(1);
  });

  it('responds to a new OS reduced-motion preference without starting a fresh hold', () => {
    const complete = vi.fn(), reveal = vi.fn(); render(<DHGamesIntro onComplete={complete} onReveal={reveal} />);
    advance(900); changeSystemMotion(true); expect(intro()).toHaveAttribute('data-phase', 'hold');
    advance(300); expect(complete).toHaveBeenCalledTimes(1); expect(reveal).not.toHaveBeenCalled();
  });

  it.each(['visibilitychange', 'pageshow'])('reconciles background elapsed time on %s instead of replaying the hold', event => {
    let clock = 500; vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const complete = vi.fn(), reveal = vi.fn(); render(<DHGamesIntro onComplete={complete} onReveal={reveal} />);
    clock += 1000; background(true);
    // Model a browser which suspended timer delivery. Only its monotonic clock
    // advances; callbacks have not been artificially run while hidden.
    clock = 500 + DH_GAMES_INTRO_TIMING.total + 8000; visibility = 'visible';
    act(() => { (event === 'pageshow' ? window : document).dispatchEvent(new Event(event)); });
    expect(complete).toHaveBeenCalledTimes(1); expect(reveal.mock.calls.length).toBeLessThanOrEqual(1);
    advance(20000); expect(complete).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });

  it('resumes within the original fade window after background throttling', () => {
    let clock = 100; vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const complete = vi.fn(), reveal = vi.fn(); render(<DHGamesIntro onComplete={complete} onReveal={reveal} />);
    clock += 700; background(true); clock = 100 + DH_GAMES_INTRO_TIMING.reveal + DH_GAMES_INTRO_TIMING.hold + 400; background(false);
    expect(intro()).toHaveAttribute('data-phase', 'fade'); expect(reveal).toHaveBeenCalledTimes(1); expect(complete).not.toHaveBeenCalled();
    clock = 100 + DH_GAMES_INTRO_TIMING.total; act(() => { window.dispatchEvent(new Event('pageshow')); });
    expect(complete).toHaveBeenCalledTimes(1); expect(reveal).toHaveBeenCalledTimes(1);
  });

  it.each([300, 3500])('cleans up timers and lifecycle handlers when unmounted at %ims', elapsed => {
    const documentAdd = vi.spyOn(document, 'addEventListener'), documentRemove = vi.spyOn(document, 'removeEventListener');
    const windowAdd = vi.spyOn(window, 'addEventListener'), windowRemove = vi.spyOn(window, 'removeEventListener');
    const complete = vi.fn(), reveal = vi.fn(), view = render(<DHGamesIntro onComplete={complete} onReveal={reveal} />);
    advance(elapsed); const revealsBeforeUnmount = reveal.mock.calls.length; view.unmount();
    expect(vi.getTimerCount()).toBe(0); expect(mediaHandlers.size).toBe(0);
    for (const [type, handler] of documentAdd.mock.calls.filter(([name]) => ['visibilitychange', 'keydown'].includes(name)))
      expect(documentRemove.mock.calls.some(([removedType, removed]) => removedType === type && removed === handler)).toBe(true);
    for (const [type, handler] of windowAdd.mock.calls.filter(([name]) => ['pageshow', 'keydown'].includes(name)))
      expect(windowRemove.mock.calls.some(([removedType, removed]) => removedType === type && removed === handler)).toBe(true);
    advance(20000); expect(complete).not.toHaveBeenCalled(); expect(reveal).toHaveBeenCalledTimes(revealsBeforeUnmount);
  });

  it('never creates an audio context or plays media, including when skipped', () => {
    const audio = vi.fn(), play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.stubGlobal('AudioContext', audio); vi.stubGlobal('webkitAudioContext', audio);
    const complete = vi.fn(); render(<DHGamesIntro onComplete={complete} />);
    advance(3100); fireEvent.click(screen.getByRole('button', { name: 'Skip intro' })); advance(10000);
    expect(complete).toHaveBeenCalledTimes(1); expect(audio).not.toHaveBeenCalled(); expect(play).not.toHaveBeenCalled();
  });
});

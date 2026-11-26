import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KrisBirthdayGate } from '@/components/celebrations/KrisBirthdayGate';

const { loadOpening } = vi.hoisted(() => ({ loadOpening: vi.fn() }));
vi.mock('@/components/celebrations/KrisBirthdayOpening', () => {
  loadOpening();
  return { default: ({ onDismiss }: { onDismiss: () => void }) =>
    <button onClick={onDismiss}>Continue to club</button> };
});

const club = '11111111-1111-1111-1111-111111111111';
const continueButton = () => screen.queryByRole('button', { name: 'Continue to club' });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-26T18:00:00Z'));
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Kris’s DH Club birthday opening', () => {
  it('loads no opening for another club, a signed-out account, or an expired visit', async () => {
    const readReceipt = vi.spyOn(Storage.prototype, 'getItem');
    const view = render(<KrisBirthdayGate clubId="another-club" userId="member-a" />);
    view.rerender(<KrisBirthdayGate clubId={club} userId="" />);
    vi.setSystemTime(new Date('2026-11-27T05:00:00Z'));
    view.rerender(<KrisBirthdayGate clubId={club} userId="member-a" />);
    await act(async () => {});
    expect(continueButton()).toBeNull();
    expect(loadOpening).not.toHaveBeenCalled();
    expect(readReceipt).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('opens at midnight in New York and retires the visible opening at the next midnight', async () => {
    vi.setSystemTime(new Date('2026-11-26T04:59:59.999Z'));
    render(<KrisBirthdayGate clubId={club} userId="midnight-user" />);
    expect(continueButton()).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(continueButton()).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(86_400_000 - 1); });
    expect(continueButton()).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(continueButton()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['pageshow', 'visibilitychange', 'focus'])('retires a resumed page on %s when background timers did not run', async event => {
    await act(async () => { render(<KrisBirthdayGate clubId={club} userId={event} />); });
    expect(continueButton()).toBeVisible();
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
    act(() => {
      (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event));
    });
    expect(continueButton()).toBeNull();
  });

  it('remembers a dismissal across route remounts and isolates signed-in members', async () => {
    const gate = (id: string) => <KrisBirthdayGate clubId={club} userId={id} />;
    const view = render(gate('dismissed-member'));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Continue to club' }));
    expect(continueButton()).toBeNull();
    expect(sessionStorage.getItem('dh:celebrations:kris-birthday-2026:dismissed-member')).toBe('1');
    view.unmount();
    const next = render(gate('dismissed-member'));
    expect(continueButton()).toBeNull();
    next.rerender(gate('new-member'));
    await act(async () => {});
    expect(continueButton()).toBeVisible();
    next.rerender(<KrisBirthdayGate clubId="other-club" userId="new-member" />);
    expect(continueButton()).toBeNull();
  });

  it('honors a session receipt restored after reload', async () => {
    sessionStorage.setItem('dh:celebrations:kris-birthday-2026:reloaded-member', '1');
    render(<KrisBirthdayGate clubId={club} userId="reloaded-member" />);
    await act(async () => {});
    expect(continueButton()).toBeNull();
  });

  it('dismisses and stays dismissed even when the browser denies session storage', async () => {
    const deny = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(deny);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(deny);
    const gate = <KrisBirthdayGate clubId={club} userId="restricted-storage" />;
    const first = render(gate);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Continue to club' }));
    first.unmount();
    render(gate);
    expect(continueButton()).toBeNull();
  });
  it('leaves the club usable if the optional opening chunk fails to load', async () => {
    vi.resetModules();
    vi.doMock('@/components/celebrations/KrisBirthdayOpening', () => { throw new Error('Chunk unavailable'); });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { KrisBirthdayGate: Gate } = await import('@/components/celebrations/KrisBirthdayGate');
      await act(async () => {
        render(<><button>Open club chat</button><Gate clubId={club} userId="failed-chunk" /></>);
      });
      expect(continueButton()).toBeNull();
      expect(screen.getByRole('button', {name: 'Open club chat'})).toBeEnabled();
      expect(warning).toHaveBeenCalledWith('Could not load the birthday opening.', expect.any(Error));
    } finally {
      vi.doUnmock('@/components/celebrations/KrisBirthdayOpening');
    }
  });
});

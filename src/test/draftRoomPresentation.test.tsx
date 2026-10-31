import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PickAnnouncement } from '@/components/draft/PickAnnouncement';

vi.mock('framer-motion', () => ({
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      const dom = { ...props };
      for (const key of ['initial', 'animate', 'exit', 'transition']) delete dom[key];
      return <div {...dom}>{children}</div>;
    },
  },
}));

const pick = { id: 'pick-7', displayName: 'Alex', pickText: 'The Iron Giant', round: 3, pickNumber: 7 };
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Draft room presentation receipts', () => {
  it('expires normally when live clock rerenders supply new callback identities, including StrictMode', () => {
    const first = vi.fn(), latest = vi.fn();
    const view = render(<React.StrictMode><PickAnnouncement pick={pick} onHide={first} /></React.StrictMode>);
    expect(screen.getByRole('status')).toHaveTextContent('The Iron Giant');
    act(() => vi.advanceTimersByTime(1500));
    view.rerender(<React.StrictMode><PickAnnouncement pick={{ ...pick }} onHide={latest} /></React.StrictMode>);
    act(() => vi.advanceTimersByTime(1700));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears when a room resets its announcement, and dismisses only the current receipt', () => {
    const hidden = vi.fn();
    const view = render(<PickAnnouncement pick={pick} onHide={hidden} />);
    view.rerender(<PickAnnouncement pick={null} onHide={hidden} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(<PickAnnouncement pick={{ ...pick, id: 'pick-8', pickNumber: 8 }} onHide={hidden} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss pick announcement' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(hidden).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(4000));
    expect(hidden).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears on backgrounding and does not replay an old selection on return', () => {
    const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const hidden = vi.fn();
    render(<PickAnnouncement pick={pick} onHide={hidden} />);
    visibility.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(hidden).toHaveBeenCalledOnce();
    visibility.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});

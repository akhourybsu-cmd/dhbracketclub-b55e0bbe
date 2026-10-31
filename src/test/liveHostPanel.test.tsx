import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveHostPanel } from '@/components/draft/live/LiveHostPanel';
import { DEFAULT_LIVE_SETTINGS, type LiveClockState } from '@/lib/draft/liveDraft';

afterEach(cleanup);

const clock: LiveClockState = { running: true, paused: false, remainingMs: 45000, totalMs: 90000, expired: false };
function props(extra: Partial<React.ComponentProps<typeof LiveHostPanel>> = {}) {
  return {
    draftId: 'draft-a', clock, settings: DEFAULT_LIVE_SETTINGS, busy: false,
    pickerName: 'Alice', slotsLeft: 8, turnKey: 'turn-1',
    onStartClock: vi.fn().mockResolvedValue(undefined),
    onStopClock: vi.fn().mockResolvedValue(undefined),
    onPause: vi.fn().mockResolvedValue(undefined),
    onResume: vi.fn().mockResolvedValue(undefined),
    onAddTime: vi.fn().mockResolvedValue(undefined),
    onSkip: vi.fn().mockResolvedValue(undefined),
    onSaveSettings: vi.fn().mockResolvedValue(undefined),
    onEnsureKioskCode: vi.fn().mockResolvedValue('ROOM7'),
    ...extra,
  };
}
const view = (value: React.ComponentProps<typeof LiveHostPanel>) => <MemoryRouter><LiveHostPanel {...value} /></MemoryRouter>;
const panel = () => document.querySelector('.da-live-host-panel')!;
const idle = () => waitFor(() => expect(panel()).toHaveAttribute('aria-busy', 'false'));

describe('Live host commands', () => {
  it.each([
    ['draft', { draftId: 'draft-b' }],
    ['picker', { pickerName: 'Bob' }],
    ['remaining slot', { slotsLeft: 7 }],
    ['explicit turn', { turnKey: 'turn-2' }],
  ] as const)('retires an armed pass when the %s identity changes', (_, change) => {
    const value = props();
    const rendered = render(view(value));
    fireEvent.click(screen.getByRole('button', { name: 'Pass this pick' }));
    expect(screen.getByRole('button', { name: 'Confirm — pass Alice' })).toBeVisible();
    rendered.rerender(view({ ...value, ...change }));
    expect(screen.queryByRole('button', { name: /^Confirm — pass/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pass this pick' })).toBeEnabled();
    expect(value.onSkip).not.toHaveBeenCalled();
  });

  it('cancels without passing and requires another deliberate confirmation after a failed pass', async () => {
    const skip = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(view(props({ onSkip: skip })));
    fireEvent.click(screen.getByRole('button', { name: 'Pass this pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel pass' }));
    expect(skip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pass this pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm — pass Alice' }));
    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('Review the current picker and confirm again');
    expect(skip).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(within(failure).getByRole('button', { name: 'Review pass' }));
    expect(skip).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm — pass Alice' }));
    await idle();
    expect(skip).toHaveBeenNthCalledWith(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('locks rapid cross-command clicks synchronously, catches rejection and retries the same payload', async () => {
    let rejectPause!: (error: Error) => void;
    const pause = vi.fn().mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPause = reject; })).mockResolvedValue(undefined);
    const value = props({ onPause: pause });
    render(view(value));
    const pauseButton = screen.getByRole('button', { name: 'Pause' });
    const resetButton = screen.getByRole('button', { name: 'Reset clock' });
    act(() => {
      fireEvent.click(pauseButton);
      fireEvent.click(resetButton);
      fireEvent.click(pauseButton);
    });
    expect(pause).toHaveBeenCalledExactlyOnceWith();
    expect(value.onStartClock).not.toHaveBeenCalled();
    expect(panel()).toHaveAttribute('data-host-action', 'pause');
    expect(screen.getByRole('button', { name: '30 seconds' })).toBeDisabled();
    await act(async () => rejectPause(new Error('connection lost')));
    const failure = await screen.findByRole('alert');
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry pause' }));
    await idle();
    expect(pause).toHaveBeenNthCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: '30 seconds' }));
    await idle();
    expect(value.onAddTime).toHaveBeenCalledExactlyOnceWith(30);
    fireEvent.click(resetButton);
    await idle();
    expect(value.onStartClock).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(screen.getByRole('button', { name: 'Clock off' }));
    await idle();
    expect(value.onStopClock).toHaveBeenCalledExactlyOnceWith();
  });

  it('does not expose a retry for an old picker when a pending pass rejects after the turn advances', async () => {
    let rejectSkip!: (error: Error) => void;
    const oldSkip = vi.fn(() => new Promise<void>((_, reject) => { rejectSkip = reject; }));
    const nextSkip = vi.fn().mockResolvedValue(undefined);
    const value = props({ onSkip: oldSkip });
    const rendered = render(view(value));
    fireEvent.click(screen.getByRole('button', { name: 'Pass this pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm — pass Alice' }));
    rendered.rerender(view({ ...value, pickerName: 'Bob', slotsLeft: 7, turnKey: 'turn-2', onSkip: nextSkip }));
    await act(async () => rejectSkip(new Error('turn already moved')));
    await idle();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm — pass/ })).not.toBeInTheDocument();
    expect(nextSkip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pass this pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm — pass Bob' }));
    await idle();
    expect(nextSkip).toHaveBeenCalledExactlyOnceWith();
    expect(oldSkip).toHaveBeenCalledExactlyOnceWith();
  });

  it('forwards settings unchanged and leaves a rejected save open for retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(view(props({ onSaveSettings: save })));
    fireEvent.click(screen.getByRole('button', { name: 'Live draft settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Room Settings' });
    fireEvent.click(within(dialog).getByRole('button', { name: '3m' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Settings' }));
    await within(dialog).findByRole('alert');
    expect(save).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_LIVE_SETTINGS, pickSeconds: 180 });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await idle();
    expect(save).toHaveBeenNthCalledWith(2, { ...DEFAULT_LIVE_SETTINGS, pickSeconds: 180 });
  });

  it.each([
    ['Start clock', { ...clock, running: false, paused: false }, 'onStartClock'],
    ['Resume', { ...clock, paused: true }, 'onResume'],
  ] as const)('keeps the %s callback and its zero-argument payload', async (label, currentClock, action) => {
    const value = props({ clock: currentClock });
    render(view(value));
    fireEvent.click(screen.getByRole('button', { name: label }));
    await idle();
    expect(value[action]).toHaveBeenCalledExactlyOnceWith();
  });
});

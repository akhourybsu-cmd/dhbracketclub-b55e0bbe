import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveGreenRoom, type LiveGreenRoomProps } from '@/components/draft/live/LiveGreenRoom';
import { LiveHostPanel } from '@/components/draft/live/LiveHostPanel';
import { DEFAULT_LIVE_SETTINGS } from '@/lib/draft/liveDraft';

const writeText = vi.fn();
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
});
afterEach(() => {
  cleanup();
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
  if (shareDescriptor) Object.defineProperty(navigator, 'share', shareDescriptor);
  else Reflect.deleteProperty(navigator, 'share');
  localStorage.clear();
});

const players = [
  { user_id: 'alice', profiles: { display_name: '👩🏽‍🚀 Pilot' } },
  { user_id: 'bob', profiles: { display_name: 'Bob' } },
];
const props = (extra: Partial<LiveGreenRoomProps> = {}): LiveGreenRoomProps => ({
  draftId: 'draft-a', topic: 'Great movie night', participants: players,
  settings: { ...DEFAULT_LIVE_SETTINGS }, canManage: true, busy: false,
  canStart: true, onStart: vi.fn(), onSaveSettings: vi.fn(),
  kioskCode: 'MOVIE7', connectionStatus: 'connected', ...extra,
});
const greenRoom = (value: LiveGreenRoomProps) => <MemoryRouter><LiveGreenRoom {...value} /></MemoryRouter>;

describe('Live draft green room and sharing', () => {
  it('keeps player invitations separate from optional projector links and host-only controls', async () => {
    const value = props();
    const view = render(greenRoom(value));
    fireEvent.click(screen.getByRole('button', { name: 'Copy player invite' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('https://dryhorse.app/drafts/live/draft-a'));
    expect(screen.getByRole('link', { name: 'https://dryhorse.app/drafts/live/draft-a' })).toHaveAttribute('href', '/drafts/live/draft-a');
    expect(screen.getByText('👩🏽‍🚀P', { selector: '.da-greenroom-avatar' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Copy projector link' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('https://dryhorse.app/drafts/draft-a/kiosk'));
    expect(screen.getByRole('link', { name: 'Open projector' })).toHaveAttribute('href', '/drafts/draft-a/kiosk');
    expect(screen.getByRole('link', { name: 'Join with this code' })).toHaveAttribute('href', '/drafts/live?code=MOVIE7');
    expect(screen.queryByText(/projector (ready|connected)/i)).not.toBeInTheDocument();
    const join = vi.fn();
    view.rerender(greenRoom(props({ canManage: false, connectionStatus: 'disconnected', children: <button onClick={join}>Join Draft</button> })));
    expect(screen.queryByRole('button', { name: 'Configure live draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start order reveal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open projector' })).not.toBeInTheDocument();
    expect(screen.getByText('Live updates disconnected')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Join Draft' }));
    expect(join).toHaveBeenCalledTimes(1);
    expect(value.onStart).not.toHaveBeenCalled();
    expect(value.onSaveSettings).not.toHaveBeenCalled();
  });

  it('uses actual distinct players and parent readiness, with the effective ceremony label', () => {
    const start = vi.fn();
    const onePlayer = props({ participants: [players[0], players[0]], onStart: start });
    const view = render(greenRoom(onePlayer));
    expect(within(screen.getByRole('region', { name: 'Players in the room' })).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Start order reveal' })).toBeDisabled();
    expect(screen.getByText('1 more player needed')).toBeVisible();
    view.rerender(greenRoom(props({ canStart: false, onStart: start })));
    fireEvent.click(screen.getByRole('button', { name: 'Start order reveal' }));
    expect(start).not.toHaveBeenCalled();
    view.rerender(greenRoom(props({ ceremonyEnabled: false, onStart: start })));
    fireEvent.click(screen.getByRole('button', { name: 'Begin live draft' }));
    expect(start).toHaveBeenCalledExactlyOnceWith();
    view.rerender(greenRoom(props({ busy: true, onStart: start })));
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();
  });

  it('lets the host save the same live settings model before starting without changing draft actions', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const value = props({ onSaveSettings: save });
    render(greenRoom(value));
    fireEvent.click(screen.getByRole('button', { name: 'Configure live draft' }));
    const settings = await screen.findByRole('dialog', { name: 'Room Settings' });
    fireEvent.click(within(settings).getByRole('button', { name: '3m' }));
    fireEvent.click(within(settings).getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_LIVE_SETTINGS, pickSeconds: 180 }));
    expect(value.onStart).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps host clock, time extension and confirmed skip callbacks intact while separating sharing', async () => {
    const handlers = {
      onStartClock: vi.fn().mockResolvedValue(undefined),
      onStopClock: vi.fn().mockResolvedValue(undefined),
      onPause: vi.fn().mockResolvedValue(undefined),
      onResume: vi.fn().mockResolvedValue(undefined),
      onAddTime: vi.fn().mockResolvedValue(undefined),
      onSkip: vi.fn().mockResolvedValue(undefined),
      onSaveSettings: vi.fn().mockResolvedValue(undefined),
      onEnsureKioskCode: vi.fn().mockResolvedValue('MOVIE7'),
    };
    render(<MemoryRouter><LiveHostPanel draftId="draft-a"
      clock={{ running: true, paused: false, remainingMs: 45000, totalMs: 90000, expired: false }}
      settings={DEFAULT_LIVE_SETTINGS} busy={false} pickerName="Alice" slotsLeft={8} {...handlers} /></MemoryRouter>);
    const idle = () => waitFor(() => expect(document.querySelector('.da-live-host-panel')).toHaveAttribute('aria-busy', 'false'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy player invite' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('https://dryhorse.app/drafts/live/draft-a'));
    await idle();
    expect(handlers.onEnsureKioskCode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy projector link' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('https://dryhorse.app/drafts/draft-a/kiosk'));
    await idle();
    expect(handlers.onEnsureKioskCode).toHaveBeenCalledExactlyOnceWith();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(handlers.onPause).toHaveBeenCalledExactlyOnceWith();
    await idle();
    fireEvent.click(screen.getByRole('button', { name: '30 seconds' }));
    expect(handlers.onAddTime).toHaveBeenCalledExactlyOnceWith(30);
    await idle();
    fireEvent.click(screen.getByRole('button', { name: 'Reset clock' }));
    expect(handlers.onStartClock).toHaveBeenCalledExactlyOnceWith();
    await idle();
    fireEvent.click(screen.getByRole('button', { name: 'Clock off' }));
    expect(handlers.onStopClock).toHaveBeenCalledExactlyOnceWith();
    await idle();
    fireEvent.click(screen.getByRole('button', { name: 'Pass this pick' }));
    expect(handlers.onSkip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm — pass Alice' }));
    await waitFor(() => expect(handlers.onSkip).toHaveBeenCalledExactlyOnceWith());
  });
});

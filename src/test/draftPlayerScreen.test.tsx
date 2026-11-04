import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalLiveKiosk } from '@/components/draft/live/PersonalLiveKiosk';
import { MakePickSheet } from '@/components/draft/MakePickSheet';
import { kioskSound } from '@/lib/draft/kioskSound';

vi.mock('@/components/drafts/DraftArenaAppearance', () => ({ DraftArenaAppearance: () => <button type="button">Appearance</button> }));
vi.mock('@/components/draft/PersonalDraftDesk', () => ({ PersonalDraftDesk: () => <button type="button">Shortlist item</button> }));
vi.mock('@/lib/draft/kioskSound', () => ({ kioskSound: { unlock: vi.fn(), pick: vi.fn(), locked: vi.fn(), reveal: vi.fn(), land: vi.fn() } }));
vi.mock('@/components/draft/live/PickRevealOverlay', () => ({
  PickRevealOverlay: ({ reveal }: { reveal: { pick: { pick_text: string } } | null }) => reveal ? <div data-testid="player-reveal">{reveal.pick.pick_text}</div> : null,
}));

const oldPick = { id: 'pick-1', user_id: 'u1', pick_text: 'Arrival', pick_number: 1, round: 1, name: 'Alex' };
const freshPick = { id: 'pick-2', user_id: 'u2', pick_text: 'The Iron Giant', pick_number: 2, round: 1, name: 'Blair' };
const props = {
  draftId: 'room-one', draftTitle: 'Movie night',
  clock: { running: true, paused: true, remainingMs: 60000, totalMs: 60000, expired: false },
  pickerName: 'Alex', isMyTurn: true, picksUntilYou: 0, currentRound: 1,
  numRounds: 5, currentPickNumber: 2, totalPicks: 10,
  myPicks: [oldPick], recentPicks: [oldPick], allPicks: [oldPick],
  onMakePick: vi.fn(), board: <button type="button">Board action</button>,
  desk: <button type="button">Desk action</button>,
};
const player = () => screen.getByRole('dialog', { name: 'Draft Arena player screen' });
const enter = () => fireEvent.click(screen.getByRole('button', { name: 'Enter live draft' }));
let fullscreen: Element | null;
let requestFullscreen: ReturnType<typeof vi.fn>;
let exitFullscreen: ReturnType<typeof vi.fn>;
const fsDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
const requestDescriptor = Object.getOwnPropertyDescriptor(document.documentElement, 'requestFullscreen');
const exitDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');

beforeEach(() => {
  vi.clearAllMocks();
  fullscreen = null;
  requestFullscreen = vi.fn(async () => { fullscreen = document.documentElement; document.dispatchEvent(new Event('fullscreenchange')); });
  exitFullscreen = vi.fn(async () => { fullscreen = null; document.dispatchEvent(new Event('fullscreenchange')); });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: requestFullscreen });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (fsDescriptor) Object.defineProperty(document, 'fullscreenElement', fsDescriptor); else Reflect.deleteProperty(document, 'fullscreenElement');
  if (requestDescriptor) Object.defineProperty(document.documentElement, 'requestFullscreen', requestDescriptor); else Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  if (exitDescriptor) Object.defineProperty(document, 'exitFullscreen', exitDescriptor); else Reflect.deleteProperty(document, 'exitFullscreen');
  vi.useRealTimers();
});

describe('Draft Arena deliberate player screen', () => {
  it('offers a named keyboard focus target for the complete live content', () => {
    render(<PersonalLiveKiosk {...props} />);
    enter();
    const content = within(player()).getByRole('region', { name: 'Live draft content' });
    expect(content).toHaveAttribute('tabindex', '0');
    expect(content.querySelector('.da-pk-clock')).toBeInTheDocument();
    expect(within(content).getByRole('tablist', { name: 'Player screen workspace' })).toBeInTheDocument();
    expect(content.querySelector('.da-pk-view-panels')).toBeInTheDocument();
    expect(content.contains(within(player()).getByRole('button', { name: 'Back to event' }))).toBe(false);
    act(() => content.focus());
    expect(content).toHaveFocus();
  });

  it('starts a changed mobile view at the clock without resetting horizontal board navigation', () => {
    render(<PersonalLiveKiosk {...props} />);
    enter();
    const dialog = within(player());
    const content = dialog.getByRole('region', { name: 'Live draft content' });
    const panels = content.querySelector<HTMLElement>('.da-pk-view-panels')!;
    const board = content.querySelector<HTMLElement>('.da-pk-board')!;
    content.style.overflowY = 'auto';
    content.scrollTop = 700;
    content.scrollLeft = 40;
    panels.scrollTop = 280;
    panels.scrollLeft = 90;
    board.scrollLeft = 340;
    fireEvent.click(dialog.getByRole('tab', { name: 'My team' }));
    expect(content.scrollTop).toBe(0);
    expect(panels.scrollTop).toBe(0);
    expect(content.scrollLeft).toBe(40);
    expect(panels.scrollLeft).toBe(90);
    expect(board.scrollLeft).toBe(340);
    expect(dialog.getByRole('tab', { name: 'My team' })).toHaveAttribute('aria-selected', 'true');
  });

  it('leaves the bounded desktop pane and workspace positions unchanged', () => {
    render(<PersonalLiveKiosk {...props} />);
    enter();
    const dialog = within(player());
    const content = dialog.getByRole('region', { name: 'Live draft content' });
    const panels = content.querySelector<HTMLElement>('.da-pk-view-panels')!;
    content.style.overflowY = 'hidden';
    content.scrollTop = 170;
    panels.scrollTop = 280;
    panels.scrollLeft = 90;
    fireEvent.click(dialog.getByRole('tab', { name: 'Draft desk' }));
    expect(content.scrollTop).toBe(170);
    expect(panels.scrollTop).toBe(280);
    expect(panels.scrollLeft).toBe(90);
  });

  it('waits for entry, leaves ordinary pointers alone and returns focus on Escape', async () => {
    render(<PersonalLiveKiosk {...props} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(requestFullscreen).not.toHaveBeenCalled();
    const entry = screen.getByRole('button', { name: 'Enter live draft' });
    enter();
    expect(player()).toBeVisible();
    expect(within(player()).getByRole('tab', { name: 'Board' })).toHaveAttribute('aria-selected', 'true');
    expect(within(player()).getByRole('tab', { name: 'Board' })).toHaveFocus();
    fireEvent.pointerDown(within(player()).getByText('Movie night'));
    expect(requestFullscreen).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(entry).toHaveFocus();
  });

  it('gives a host their controls first without changing the pick callback', () => {
    render(<PersonalLiveKiosk {...props} hostControls={<button type="button">Pause clock</button>} />);
    enter();
    const dialog = within(player());
    expect(dialog.getByRole('tab', { name: 'Host' })).toHaveAttribute('aria-selected', 'true');
    expect(dialog.getByRole('button', { name: 'Pause clock' })).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: 'Make my pick' }));
    expect(props.onMakePick).toHaveBeenCalledOnce();
  });

  it('starts muted, keeps turn controls usable during a reveal and baselines closed events', () => {
    const view = render(<PersonalLiveKiosk {...props} />);
    enter();
    const sound = within(player()).getByRole('button', { name: 'Player sound' });
    expect(sound).toHaveAttribute('aria-pressed', 'false');
    view.rerender(<PersonalLiveKiosk {...props} allPicks={[oldPick, freshPick]} />);
    expect(screen.getByTestId('player-reveal')).toHaveTextContent('The Iron Giant');
    expect(screen.getByTestId('player-reveal').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('player-reveal').parentElement).toHaveStyle({ pointerEvents: 'none' });
    expect(kioskSound.locked).not.toHaveBeenCalled();
    fireEvent.click(within(player()).getByRole('button', { name: 'Make my pick' }));
    expect(props.onMakePick).toHaveBeenCalledOnce();
    fireEvent.click(sound);
    expect(kioskSound.unlock).toHaveBeenCalledOnce();
    expect(sound).toHaveAttribute('aria-pressed', 'true');
    expect(kioskSound.locked).toHaveBeenCalledOnce();
    fireEvent.click(within(player()).getByRole('button', { name: 'Back to event' }));
    view.rerender(<PersonalLiveKiosk {...props} allPicks={[oldPick, freshPick, { ...freshPick, id: 'pick-3', pick_number: 3 }]} />);
    enter();
    expect(screen.queryByTestId('player-reveal')).not.toBeInTheDocument();
    expect(kioskSound.locked).toHaveBeenCalledOnce();
  });

  it('resets entry and local sound when the room scope changes, and honors the room sound gate', () => {
    const view = render(<PersonalLiveKiosk {...props} />);
    enter();
    fireEvent.click(within(player()).getByRole('button', { name: 'Player sound' }));
    view.rerender(<PersonalLiveKiosk {...props} draftId="room-two" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    enter();
    expect(within(player()).getByRole('button', { name: 'Player sound' })).toHaveAttribute('aria-pressed', 'false');
    view.rerender(<PersonalLiveKiosk {...props} draftId="room-two" sound={false} allPicks={[oldPick, freshPick]} />);
    expect(within(player()).getByRole('button', { name: 'Player sound' })).toBeDisabled();
    expect(kioskSound.locked).not.toHaveBeenCalled();
  });

  it('requests native full screen only explicitly and releases its own session on return', async () => {
    render(<PersonalLiveKiosk {...props} />);
    enter();
    expect(requestFullscreen).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(within(player()).getByRole('button', { name: 'Enter full screen' })));
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(within(player()).getByRole('button', { name: 'Exit full screen' })).toBeVisible();
    await act(async () => fireEvent.click(within(player()).getByRole('button', { name: 'Back to event' })));
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('releases a wake lock that resolves after the player has left', async () => {
    let resolveWake!: (value: { release: () => Promise<void> }) => void;
    const release = vi.fn(async () => {});
    const request = vi.fn(() => new Promise<{ release: () => Promise<void> }>((resolve) => { resolveWake = resolve; }));
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    try {
      render(<PersonalLiveKiosk {...props} />);
      expect(request).not.toHaveBeenCalled();
      enter();
      expect(request).toHaveBeenCalledOnce();
      fireEvent(document, new Event('visibilitychange'));
      fireEvent(document, new Event('visibilitychange'));
      expect(request).toHaveBeenCalledOnce();
      fireEvent.click(within(player()).getByRole('button', { name: 'Back to event' }));
      await act(async () => resolveWake({ release }));
      expect(release).toHaveBeenCalledOnce();
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'wakeLock', descriptor); else Reflect.deleteProperty(navigator, 'wakeLock');
    }
  });

  it('lets a nested pick composer own focus and Escape before returning to the event', async () => {
    function EventWithComposer() {
      const [composing, setComposing] = useState(false);
      return <><PersonalLiveKiosk {...props} onMakePick={() => setComposing(true)} /><MakePickSheet
        open={composing} onClose={() => setComposing(false)} currentRound={1} currentPickNumber={2}
        pickText="" onTextChange={() => {}} onSubmit={() => {}} submitting={false}
        localDuplicate={false} suggestion={null} onApplyCorrection={() => {}} onDismissSuggestion={() => {}} topic="Movie night"
      /></>;
    }
    render(<EventWithComposer />);
    enter();
    const playerScreen = player();
    fireEvent.click(within(playerScreen).getByRole('button', { name: 'Make my pick' }));
    const composer = document.querySelector('.da-pick-dialog');
    expect(composer).toBeVisible();
    expect(composer?.contains(document.activeElement)).toBe(true);
    const input = screen.getByRole('textbox', { name: 'Your draft pick' });
    act(() => input.focus());
    expect(input).toHaveFocus();
    act(() => within(playerScreen).getByRole('button', { name: 'Back to event', hidden: true }).focus());
    expect(input).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('.da-pick-dialog')).not.toBeInTheDocument());
    expect(player()).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Enter live draft' })).toHaveFocus();
  });
});

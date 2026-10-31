import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveDraftsPage from '@/pages/LiveDraftsPage';
import { DraftArenaHUD } from '@/components/drafts/DraftArenaHUD';
import type { LiveRoomSummary } from '@/lib/draft/liveRooms';

const wire = vi.hoisted(() => ({
  userId: 'member-1', clubId: 'club-1', liveEnabled: true,
  fetchRooms: vi.fn(), resolveRoom: vi.fn(),
  listUpdate: null as null | (() => void),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.userId }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: wire.clubId, name: 'The Dry Horse Club' }, loading: false }) }));
vi.mock('@/hooks/useFeatureFlags', () => ({ useFeatureFlag: () => ({ enabled: wire.liveEnabled, loading: false }) }));
vi.mock('@/hooks/useRealtimeSubscription', () => ({ useDraftListUpdates: (callback: () => void) => { wire.listUpdate = callback; } }));
vi.mock('@/hooks/useDraftSeasons', () => ({ useCurrentSeason: () => ({ season: null }), formatSeasonChip: () => '' }));
vi.mock('@/lib/draft/liveRooms', () => ({
  fetchLiveRooms: wire.fetchRooms, resolveLiveRoom: wire.resolveRoom,
  normalizeLiveCode: (value: string) => value.trim().toUpperCase(),
  LIVE_ROOM_UNAVAILABLE_MESSAGE: 'That live room is unavailable. Check the code and your active club.',
}));

function room(id: string, status = 'setup', overrides: Partial<LiveRoomSummary> = {}): LiveRoomSummary {
  return { id, status, topic: `Topic ${id}`, created_by: 'host-1', num_rounds: 5, created_at: '2026-10-31', kiosk_code: 'DH5ZX', ...overrides };
}
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
let navigate: ReturnType<typeof useNavigate>;
function Hub() {
  navigate = useNavigate();
  const location = useLocation();
  return <><LiveDraftsPage /><output data-testid="live-route">{location.pathname}{location.search}</output></>;
}
function Harness({ route = '/drafts/live' }: { route?: string }) {
  return <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Hub /></MemoryRouter>;
}
function Navigation() {
  const location = useLocation();
  return <><DraftArenaHUD /><output data-testid="navigation-route">{location.pathname}</output></>;
}
function NavigationHarness({ route }: { route: string }) {
  return <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
    <Route path="/drafts/live/:draftId" element={<Navigation />} />
    <Route path="/drafts/:draftId/magazine" element={<Navigation />} />
    <Route path="*" element={<Navigation />} />
  </Routes></MemoryRouter>;
}
beforeEach(() => {
  vi.resetAllMocks();
  wire.userId = 'member-1'; wire.clubId = 'club-1'; wire.liveEnabled = true;
  wire.listUpdate = null;
  wire.fetchRooms.mockResolvedValue([]);
  wire.resolveRoom.mockResolvedValue({ id: 'resolved-room', topic: 'A real room', status: 'setup' });
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Draft Arena LIVE entry', () => {
  it('keeps existing rooms and code entry available with hosting disabled, and filters by persisted status', async () => {
    wire.liveEnabled = false;
    wire.fetchRooms.mockResolvedValue([room('lobby'), room('playing', 'in_progress'), room('final', 'complete', { kiosk_code: null })]);
    render(<Harness />);
    expect(await screen.findByRole('link', { name: 'Enter lobby: Topic lobby' })).toHaveAttribute('href', '/drafts/live/lobby');
    expect(screen.queryByRole('link', { name: 'Host live event' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Room code')).toBeEnabled();
    expect(screen.getByRole('link', { name: 'View final: Topic final' })).not.toHaveTextContent('DH5ZX');
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Finished/ }), { button: 0, ctrlKey: false });
    expect(screen.getByRole('link', { name: 'View final: Topic final' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Enter lobby: Topic lobby' })).not.toBeInTheDocument();
    expect(wire.fetchRooms).toHaveBeenCalledWith('club-1');
  });

  it('prefills shared codes and requires explicit, normalized lookup before navigation', async () => {
    render(<Harness route="/drafts/live?code=dh5zx" />);
    expect(screen.getByLabelText('Room code')).toHaveValue('DH5ZX');
    expect(wire.resolveRoom).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: ' dh5zx ' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Find a live room' }));
    await waitFor(() => expect(screen.getByTestId('live-route')).toHaveTextContent('/drafts/live/resolved-room'));
    expect(wire.resolveRoom).toHaveBeenCalledExactlyOnceWith('DH5ZX', 'club-1');
  });

  it('refreshes room status when the draft subscription reports changes', async () => {
    wire.fetchRooms.mockResolvedValueOnce([room('changing')]).mockResolvedValueOnce([room('changing', 'complete')]);
    render(<Harness />);
    expect(await screen.findByRole('link', { name: 'Enter lobby: Topic changing' })).toBeVisible();
    await act(async () => { await wire.listUpdate?.(); });
    expect(await screen.findByRole('link', { name: 'View final: Topic changing' })).toBeVisible();
    expect(wire.fetchRooms).toHaveBeenCalledTimes(2);
  });

  it('allows retry after loading or lookup errors without exposing private lookup details', async () => {
    wire.fetchRooms.mockRejectedValueOnce(new Error('backend details')).mockResolvedValueOnce([room('recovered')]);
    wire.resolveRoom.mockRejectedValueOnce(new Error('private room metadata'));
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry live rooms' }));
    expect(await screen.findByRole('link', { name: 'Enter lobby: Topic recovered' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ABCDE' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Find a live room' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That live room is unavailable. Check the code and your active club.');
    expect(screen.queryByText(/private room metadata|backend details/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Room code')).toBeEnabled();
  });

  it('ignores list and code lookup results from a previous club and account', async () => {
    const oldList = pending<LiveRoomSummary[]>();
    const oldLookup = pending<{ id: string; topic: string; status: string }>();
    wire.fetchRooms.mockReturnValueOnce(oldList.promise).mockResolvedValueOnce([room('new-club')]);
    wire.resolveRoom.mockReturnValueOnce(oldLookup.promise);
    const view = render(<Harness route="/drafts/live?code=DH5ZX" />);
    fireEvent.submit(screen.getByRole('form', { name: 'Find a live room' }));
    wire.clubId = 'club-2'; wire.userId = 'member-2';
    view.rerender(<Harness route="/drafts/live?code=DH5ZX" />);
    expect(await screen.findByRole('link', { name: 'Enter lobby: Topic new-club' })).toBeVisible();
    await act(async () => {
      oldList.resolve([room('private-old')]);
      oldLookup.resolve({ id: 'private-old', topic: 'Private', status: 'setup' });
    });
    expect(screen.queryByRole('link', { name: /private-old/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('live-route')).toHaveTextContent('/drafts/live?code=DH5ZX');
    expect(wire.fetchRooms).toHaveBeenLastCalledWith('club-2');
  });

  it('guards duplicate lookups and invalidates a pending lookup when the shared code changes', async () => {
    const oldLookup = pending<{ id: string; topic: string; status: string }>();
    wire.resolveRoom.mockReturnValueOnce(oldLookup.promise);
    render(<Harness route="/drafts/live?code=DH5ZX" />);
    const form = screen.getByRole('form', { name: 'Find a live room' });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(wire.resolveRoom).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Room code')).toBeDisabled();
    act(() => navigate('/drafts/live?code=ABCDE'));
    expect(screen.getByLabelText('Room code')).toHaveValue('ABCDE');
    expect(screen.getByLabelText('Room code')).toBeEnabled();
    await act(async () => { oldLookup.resolve({ id: 'stale', topic: 'Stale', status: 'setup' }); });
    expect(screen.getByTestId('live-route')).toHaveTextContent('/drafts/live?code=ABCDE');
  });

  it('validates incomplete codes before contacting the resolver', async () => {
    render(<Harness />);
    await screen.findByRole('heading', { name: 'The stage is clear.' });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ABC' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Find a live room' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the five-character code from your host.');
    expect(wire.resolveRoom).not.toHaveBeenCalled();
  });
});

describe('LIVE contextual navigation', () => {
  it('keeps a permanent LIVE destination and separates the player room from the projector', async () => {
    render(<NavigationHarness route="/drafts/live/event-1" />);
    expect(screen.getByRole('link', { name: 'Draft Arena LIVE lobby' })).toHaveAttribute('href', '/drafts/live');
    fireEvent.click(screen.getByRole('button', { name: 'Draft Arena menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Draft Arena menu' });
    expect(within(drawer).getByRole('link', { name: /LIVE arena/ })).toHaveAttribute('aria-current', 'page');
    expect(within(drawer).getByRole('link', { name: 'Player room' })).toHaveAttribute('href', '/drafts/live/event-1');
    expect(within(drawer).getByRole('link', { name: 'Magazine' })).toHaveAttribute('href', '/drafts/event-1/magazine?live=1');
    expect(within(drawer).getByRole('link', { name: 'Projector' })).toHaveAttribute('href', '/drafts/event-1/kiosk');
    expect(within(drawer).getByRole('link', { name: 'Projector' })).toHaveAttribute('target', '_blank');
  });

  it.each([
    ['/drafts/live', 'Back to Draft Arena', '/drafts'],
    ['/drafts/live/create', 'Back to LIVE arena', '/drafts/live'],
    ['/drafts/live/event-1', 'Back to LIVE arena', '/drafts/live'],
    ['/drafts/event-1/magazine?live=1', 'Back to live room', '/drafts/live/event-1'],
  ])('uses the contextual return destination from %s', (route, label, destination) => {
    render(<NavigationHarness route={route} />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByTestId('navigation-route').textContent).toBe(destination);
  });
});

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLineupDraft } from '@/hooks/useLineupDraft';
import LineupDraftsPage from '@/pages/LineupDraftsPage';
import LineupDraftDetailPage from '@/pages/LineupDraftDetailPage';
import { createLineupConfig } from '@/lib/draft/lineup';

type Row = Record<string, unknown>;
const wire = vi.hoisted(() => ({ userId: 'player', tables: {} as Record<string, Row[]>, rpc: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.userId }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club', name: 'Our club' }, isClubAdmin: false, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: (...args: unknown[]) => wire.rpc(...args),
  from: (table: string) => {
    const filters = new Map<string, unknown>();
    const rows = () => (wire.tables[table] ?? []).filter(row => [...filters].every(([key, value]) => row[key] === value));
    const query = {
      select: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows(), error: null }).then(resolve),
    };
    return query;
  },
  channel: () => {
    const channel = { on: () => channel, subscribe: () => channel };
    return channel;
  },
  removeChannel: async () => {},
  auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
} }));

const clients: QueryClient[] = [];
function provider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><MemoryRouter initialEntries={['/drafts/lineup/match']}>{children}</MemoryRouter></QueryClientProvider>;
}
beforeEach(() => {
  wire.userId = 'player'; localStorage.clear(); wire.rpc.mockReset();
  wire.rpc.mockImplementation(async (name: string) => ({ data: name === 'draft_commissioner_can_manage' ? true : { draft_id: 'match', replayed: true }, error: null }));
  wire.tables = {
    drafts: [{ id: 'match', club_id: 'club', competition_id: 'competition', created_by: 'host', topic: 'Our breakfast',
      draft_format: 'lineup', lineup_config: createLineupConfig('breakfast'), num_rounds: 4, status: 'in_progress',
      created_at: '2026-11-12T12:00:00Z', current_pick_number: 1, current_round: 1, current_pick_user_id: 'player',
      draft_participants: [{ user_id: 'player' }, { user_id: 'host' }] }],
    draft_participants: [
      { id: 'seat-player', club_id: 'club', draft_id: 'match', user_id: 'player', pick_order: 1, profiles: { display_name: 'Player' } },
      { id: 'seat-host', club_id: 'club', draft_id: 'match', user_id: 'host', pick_order: 2, profiles: { display_name: 'Host' } },
    ], draft_picks: [], draft_results: [], draft_season_entries: [{ draft_id: 'match', club_id: 'club', season_id: 'assigned-season' }],
  };
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); localStorage.clear(); });

describe('Lineup recovery and entry points', () => {
  it('offers another tab’s saved action for exact retry before sending a different pick', async () => {
    const { result } = renderHook(() => useLineupDraft('match'), { wrapper: provider() });
    await waitFor(() => expect(result.current.draft?.id).toBe('match'));
    expect(result.current.pending).toBeNull();
    const pending = { requestId: '00000000-0000-4000-8000-000000000001', action: 'pick', payload: { text: 'Waffles', slot_id: 'entree' } };
    localStorage.setItem('dh:lineup:pending:v1:player:club:match', JSON.stringify(pending));
    await act(async () => { await result.current.mutate('pick', { text: 'Coffee', slot_id: 'drink' }); });
    expect(result.current.pending).toEqual(pending);
    expect(result.current.actionError).toMatch(/Retry the saved action/);
    expect(wire.rpc).not.toHaveBeenCalled();
    await act(async () => { await result.current.retryPending(); });
    expect(wire.rpc).toHaveBeenCalledExactlyOnceWith('draft_lineup_action', {
      p_club_id: 'club', p_draft_id: 'match', p_request_id: pending.requestId, p_action: 'pick', p_payload: pending.payload,
    });
    expect(result.current.pending).toBeNull();
    expect(localStorage.getItem('dh:lineup:pending:v1:player:club:match')).toBeNull();
  });

  it('opens a finished room directly at its promised results view', async () => {
    wire.tables.drafts[0].status = 'complete';
    render(<LineupDraftsPage />, { wrapper: provider() });
    const link = await screen.findByRole('link', { name: 'View results: Our breakfast' });
    expect(link).toHaveAttribute('href', '/drafts/lineup/match?view=results');
    expect(wire.rpc).not.toHaveBeenCalled();
  });

  it('exposes and refreshes host controls for the assigned commissioner without requiring a playing seat', async () => {
    wire.userId = 'commissioner'; wire.tables.drafts[0].status = 'setup';
    render(<Routes><Route path="/drafts/lineup/:draftId" element={<LineupDraftDetailPage />} /></Routes>, { wrapper: provider() });
    const start = await screen.findByRole('button', { name: 'Start lineup' });
    expect(start).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel lineup' })).toBeEnabled();
    expect(wire.rpc).toHaveBeenCalledWith('draft_commissioner_can_manage', { p_season_id: 'assigned-season' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh lineup' }));
    await waitFor(() => expect(wire.rpc.mock.calls.filter(([name]) => name === 'draft_commissioner_can_manage')).toHaveLength(2));
    fireEvent.click(await screen.findByRole('button', { name: 'Start lineup' }));
    await waitFor(() => expect(wire.rpc).toHaveBeenCalledWith('draft_lineup_action', expect.objectContaining({ p_action: 'start', p_draft_id: 'match', p_payload: {} })));
  });
});

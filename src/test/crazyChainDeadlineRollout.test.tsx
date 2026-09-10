import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCrazyChainBoard } from '@/hooks/useCrazyChainBoard';
import type { NflGame } from '@/hooks/usePickem';

const state = vi.hoisted(() => ({ mode: 'per_game_30m', missing: false }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club' } }) }));
vi.mock('@/lib/nfl/chainBoardImport', () => ({
  chainRpc: () => ({ abortSignal: () => Promise.resolve({
    data: state.missing ? null : { mode: state.mode, unlocked: true, games: [], lock_at: null },
    error: state.missing ? { message: 'function does not exist' } : null,
  }) }),
}));
afterEach(() => { cleanup(); state.mode = 'per_game_30m'; state.missing = false; });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const game = {
    id: 'game', kickoff_at: new Date(Date.now() + 2 * 3600_000).toISOString(), status: 'scheduled',
    chain_lock_at: new Date(Date.now() - 46 * 3600_000).toISOString(),
    crazy_chain_lock_at: new Date(Date.now() + 90 * 60_000).toISOString(),
  } as NflGame;
  return renderHook(() => useCrazyChainBoard('week', [game]), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}
describe('Independent deadline rollout', () => {
  it('keeps Crazy Chain open when the same game already passed its Pickem deadline', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.migrationReady).toBe(true));
    expect(result.current.pickemMigrationReady).toBe(true);
    expect(result.current.locked).toBe(false);
    expect(result.current.lockAt!.getTime()).toBeGreaterThan(Date.now());
  });
  it('keeps Pickem enabled on the prior migration without offering premature 30-minute saves', async () => {
    state.mode = 'per_game_48h';
    const { result } = setup();
    await waitFor(() => expect(result.current.pickemMigrationReady).toBe(true));
    expect(result.current.migrationReady).toBe(false);
    expect(result.current.locked).toBe(true);
  });
  it('fails closed when the per-game database functions are absent', async () => {
    state.missing = true;
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pickemMigrationReady).toBe(false);
    expect(result.current.migrationReady).toBe(false);
    expect(result.current.locked).toBe(true);
  });
});

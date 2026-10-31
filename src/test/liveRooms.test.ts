import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLiveRooms, LIVE_ROOM_UNAVAILABLE_MESSAGE, normalizeLiveCode, resolveLiveRoom, saveLiveLobbySettings } from '@/lib/draft/liveRooms';
import { QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import { DEFAULT_LIVE_SETTINGS } from '@/lib/draft/liveDraft';

interface Query {
  table: string;
  columns: string;
  filters: [string, unknown][];
  order: { column: string; ascending: boolean } | null;
  limit: number | null;
  mutation?: Record<string, unknown>;
}
const backend = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  mode: 'normal' as 'normal' | 'denied' | 'rejected' | 'pending',
  requests: [] as Query[],
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const query: Query = { table, columns: '', filters: [], order: null, limit: null };
      const execute = async (single = false) => {
        backend.requests.push({ ...query, filters: [...query.filters] });
        if (backend.mode === 'denied') return { data: null, error: { message: 'private database details' } };
        if (backend.mode === 'rejected') throw new Error('private transport details');
        if (backend.mode === 'pending') return new Promise<never>(() => {});
        let rows = backend.rows.filter(row => query.filters.every(([column, value]) => row[column] === value));
        if (query.order) {
          const { column, ascending } = query.order;
          rows = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
        }
        if (query.limit !== null) rows = rows.slice(0, query.limit);
        if (query.mutation) rows.forEach(row => Object.assign(row, query.mutation));
        const columns = query.columns.split(',');
        const selected = rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
        return { data: single ? selected[0] ?? null : selected, error: null };
      };
      const builder = {
        update: (patch: Record<string, unknown>) => { query.mutation = patch; return builder; },
        select: (columns: string) => { query.columns = columns; return builder; },
        eq: (column: string, value: unknown) => { query.filters.push([column, value]); return builder; },
        order: (column: string, options: { ascending: boolean }) => { query.order = { column, ascending: options.ascending }; return builder; },
        limit: (count: number) => { query.limit = count; return builder; },
        maybeSingle: () => execute(true),
        single: () => execute(true),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject),
      };
      return builder;
    },
  },
}));

function room(id: string, code: string, clubId = 'club-a', live = true) {
  return {
    id, topic: `Topic ${id}`, status: 'setup', club_id: clubId, is_live: live,
    num_rounds: 5, created_by: 'host', created_at: '2026-10-31T00:00:00Z', kiosk_code: code,
    live_settings: { sound: true },
  };
}
beforeEach(() => {
  backend.mode = 'normal';
  backend.requests = [];
  backend.rows = [room('own-room', 'AB234'), room('other-club-room', 'CD567', 'club-b'), room('regular-room', 'EF678', 'club-a', false)];
});
afterEach(() => { vi.useRealTimers(); });

describe('Live room code resolution', () => {
  it('normalizes casing and outer whitespace without guessing ambiguous characters', () => {
    expect(normalizeLiveCode('  ab234\n')).toBe('AB234');
    expect(normalizeLiveCode('o0i1l')).toBe('O0I1L');
  });

  it('resolves only live rooms in the requested club and returns a safe destination', async () => {
    await expect(resolveLiveRoom('  ab234 ', 'club-a')).resolves.toEqual({ id: 'own-room', topic: 'Topic own-room', status: 'setup' });
    expect(backend.requests).toEqual([expect.objectContaining({
      table: 'drafts', columns: 'id,topic,status',
      filters: [['club_id', 'club-a'], ['is_live', true], ['kiosk_code', 'AB234']],
    })]);
  });

  it.each(['', 'AB23', 'AB2345', 'ABO34', 'ABI34', 'ABL34', 'AB034', 'AB134', 'AB 34', 'AB-34', '🔥AB23'])(
    'rejects an invalid code without looking up a room (%s)', async code => {
      await expect(resolveLiveRoom(code, 'club-a')).rejects.toThrow(LIVE_ROOM_UNAVAILABLE_MESSAGE);
      expect(backend.requests).toHaveLength(0);
    },
  );

  it.each(['CD567', 'EF678', 'ZZ999'])(
    'does not disclose another club, a regular draft or an absent room (%s)', async code => {
      await expect(resolveLiveRoom(code, 'club-a')).rejects.toThrow(LIVE_ROOM_UNAVAILABLE_MESSAGE);
    },
  );

  it('does not query without an active club', async () => {
    await expect(resolveLiveRoom('AB234', ' ')).rejects.toThrow(LIVE_ROOM_UNAVAILABLE_MESSAGE);
    expect(backend.requests).toHaveLength(0);
  });

  it.each(['denied', 'rejected'] as const)('keeps %s failures indistinguishable from unavailable rooms', async mode => {
    backend.mode = mode;
    await expect(resolveLiveRoom('AB234', 'club-a')).rejects.toThrow(LIVE_ROOM_UNAVAILABLE_MESSAGE);
  });

  it('bounds a stalled lookup and ignores its transport detail', async () => {
    vi.useFakeTimers();
    backend.mode = 'pending';
    const rejected = expect(resolveLiveRoom('AB234', 'club-a')).rejects.toThrow(LIVE_ROOM_UNAVAILABLE_MESSAGE);
    await vi.advanceTimersByTimeAsync(QUERY_TIMEOUT_MS);
    await rejected;
  });
});

describe('Recent club live rooms', () => {
  it('lists at most fifty newest live rooms without including another club or regular drafts', async () => {
    const own = Array.from({ length: 65 }, (_, index) => ({
      ...room(`room-${index}`, 'AB234'), created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    }));
    backend.rows = [...backend.rows.slice(1), ...own];
    const rooms = await fetchLiveRooms('club-a');
    expect(rooms).toHaveLength(50);
    expect(rooms.map(row => row.id)).toEqual(Array.from({ length: 50 }, (_, index) => `room-${64 - index}`));
    expect(rooms[0]).toEqual({
      id: 'room-64', topic: 'Topic room-64', status: 'setup', num_rounds: 5,
      created_by: 'host', created_at: own[64].created_at, kiosk_code: 'AB234',
    });
    expect(backend.requests[0]).toMatchObject({
      table: 'drafts', filters: [['club_id', 'club-a'], ['is_live', true]],
      order: { column: 'created_at', ascending: false }, limit: 50,
    });
    expect(backend.requests[0].columns.split(',').sort()).toEqual(['id', 'topic', 'status', 'num_rounds', 'created_by', 'created_at', 'kiosk_code'].sort());
  });

  it('allows an empty club list and nullable codes without inventing a join destination', async () => {
    await expect(fetchLiveRooms('club-empty')).resolves.toEqual([]);
    backend.rows = [{ ...room('completed', 'AB234'), status: 'complete', kiosk_code: null }];
    const [result] = await fetchLiveRooms('club-a');
    expect(result.status).toBe('complete');
    expect(result.kiosk_code).toBeNull();
  });

  it('does not start a list read without a club', async () => {
    await expect(fetchLiveRooms('')).rejects.toThrow('Live drafts could not be loaded. Try again.');
    expect(backend.requests).toHaveLength(0);
  });

  it.each(['denied', 'rejected'] as const)('replaces %s list errors with a retryable public message', async mode => {
    backend.mode = mode;
    await expect(fetchLiveRooms('club-a')).rejects.toThrow('Live drafts could not be loaded. Try again.');
  });

  it('bounds a stalled list read', async () => {
    vi.useFakeTimers();
    backend.mode = 'pending';
    const rejected = expect(fetchLiveRooms('club-a')).rejects.toThrow('Live drafts could not be loaded. Try again.');
    await vi.advanceTimersByTimeAsync(QUERY_TIMEOUT_MS);
    await rejected;
  });
});

describe('Live lobby settings save', () => {
  const saveError = 'Live lobby settings could not be saved. Try again.';

  it.each([true, false])('atomically saves ceremony=%s with only the shared settings and ceremony flag', async ceremony => {
    backend.rows[0] = {
      ...backend.rows[0], ceremony_enabled: !ceremony,
      pick_deadline_at: null, clock_started_at: null, current_pick_number: 1,
    };
    const before = structuredClone(backend.rows);
    const settings = { ...DEFAULT_LIVE_SETTINGS, ceremony, pickSeconds: 120, sound: false };

    await expect(saveLiveLobbySettings('own-room', 'club-a', settings)).resolves.toBeUndefined();

    expect(backend.requests).toEqual([{
      table: 'drafts', columns: 'id', order: null, limit: null,
      filters: [['id', 'own-room'], ['club_id', 'club-a'], ['status', 'setup']],
      mutation: { live_settings: settings, ceremony_enabled: ceremony },
    }]);
    expect(backend.rows).toEqual([
      { ...before[0], live_settings: settings, ceremony_enabled: ceremony },
      ...before.slice(1),
    ]);
  });

  it.each(['missing-room', 'other-club-room', 'started-room'])(
    'rejects a save without a matching setup row (%s)', async id => {
      backend.rows.push({ ...room('started-room', 'GH789'), status: 'in_progress', ceremony_enabled: false });
      const before = structuredClone(backend.rows);
      await expect(saveLiveLobbySettings(id, 'club-a', DEFAULT_LIVE_SETTINGS)).rejects.toThrow(saveError);
      expect(backend.rows).toEqual(before);
      expect(backend.requests).toHaveLength(1);
    },
  );

  it.each(['denied', 'rejected'] as const)('does not expose %s save details or perform another write', async mode => {
    backend.mode = mode;
    const before = structuredClone(backend.rows);
    await expect(saveLiveLobbySettings('own-room', 'club-a', DEFAULT_LIVE_SETTINGS)).rejects.toThrow(saveError);
    expect(backend.rows).toEqual(before);
    expect(backend.requests).toHaveLength(1);
  });

  it.each([['', 'club-a'], ['own-room', ' ']])('does not write without both room and club (%s, %s)', async (id, club) => {
    await expect(saveLiveLobbySettings(id, club, DEFAULT_LIVE_SETTINGS)).rejects.toThrow(saveError);
    expect(backend.requests).toHaveLength(0);
  });

  it('bounds a stalled save with the same public retry message', async () => {
    vi.useFakeTimers();
    backend.mode = 'pending';
    const rejected = expect(saveLiveLobbySettings('own-room', 'club-a', DEFAULT_LIVE_SETTINGS)).rejects.toThrow(saveError);
    await vi.advanceTimersByTimeAsync(QUERY_TIMEOUT_MS);
    await rejected;
    expect(backend.requests).toHaveLength(1);
  });
});

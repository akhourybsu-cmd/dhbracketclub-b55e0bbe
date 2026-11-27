import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compareCloudSave, migrateSave, parseCloudSave, saveFingerprint, validateSave } from '@/lib/mesomon/save';
import { envelopeFromCloud, eraseLocalSave, freshEnvelope, newestLocalSave, readLocalSave, saveStorageKey, waitForLocalWrites, writeLocalSave } from '@/lib/mesomon/storage';
import { useMesomonSave } from '@/hooks/useMesomonSave';
import { acquireFileWriter } from '@/lib/mesomon/writer';
import { createBattle, makeCompanion } from '@/lib/mesomon/battle';
import type { MesomonSaveV1 } from '@/lib/mesomon/types';

const transport = vi.hoisted(() => {
  const state = { row: null as unknown, error: null as unknown };
  const read = vi.fn(async () => ({ data: state.row, error: state.error }));
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> => {
    if (name === 'mesomon_delete_save') {
      const revision = Number(args.p_expected_revision) + 1;
      state.row = { state:null, revision, slot:args.p_slot, updated_at:'2026-11-25T20:00:00.000Z' };
      return { data:{ deleted:true, revision }, error:null };
    }
    const row = { state: args.p_state, revision: Number(args.p_expected_revision) + 1, slot: args.p_slot, updated_at: '2026-11-25T20:00:00.000Z' };
    state.row = row; return { data: { conflict: false, replayed: false, save: row }, error: null as unknown };
  });
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: read }) }) }) }));
  return { state, read, rpc, from };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: transport.from, rpc: transport.rpc } }));
function sample(slot: 1 | 2 | 3 = 1): MesomonSaveV1 {
  return { schemaVersion: 1, slot, player: { name: 'Tavian', mapId: 'ship', x: 3, y: 4, facing: 'down' }, party: [], collection: {}, inventory: { tincture: 2 }, questFlags: {}, activeQuestId: 'harbor-two-voices', rifts: { harbor: 'unseen' }, settings: { textSpeed: 'normal', battleSpeed: 'normal', reducedMotion: false, haptics: false, mute: true, sealAssist: false, musicVolume: 0.35, ambientVolume: 0.3 }, playtimeSeconds: 0, savedAt: '2026-11-25T19:00:00.000Z', battle: null, seal: { active: false, pulses: 0, attempts: 0 }, dialogue: null, dialogueHistory: [] };
}
function reordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reordered(entry)]));
  return value;
}
function withRecords(): MesomonSaveV1 {
  const rillik = makeCompanion('rillik'), muddren = makeCompanion('muddren');
  return { ...sample(), party: [rillik, muddren], collection: { [rillik.id]: rillik, [muddren.id]: muddren }, inventory: { tincture: 2, 'crystal-bud': 1 }, questFlags: { arrived: true, visits: 3, clue_chart: true } };
}
function fakeDatabase(rows: Map<string, unknown>): IDBFactory {
  const database = {
    objectStoreNames: { contains: () => true }, close: () => {},
    transaction: () => {
      const tx: { oncomplete?: () => void; objectStore?: () => unknown } = {};
      const request = (value: unknown, key: string, write: boolean) => {
        const result: { result?: unknown; onsuccess?: () => void } = {};
        queueMicrotask(() => { if (write) rows.set(key, JSON.parse(JSON.stringify(value))); result.result = write ? key : rows.get(key); result.onsuccess?.(); queueMicrotask(() => tx.oncomplete?.()); });
        return result;
      };
      tx.objectStore = () => ({ delete: (key: string) => { rows.delete(key); }, get: (key: string) => request(null, key, false), put: (value: unknown, key: string) => request(value, key, true) });
      return tx;
    },
  };
  return { open: () => { const request: { result: unknown; onsuccess?: () => void } = { result: database }; queueMicrotask(() => request.onsuccess?.()); return request; } } as unknown as IDBFactory;
}
function fakeLocks() {
  const held = new Set<string>();
  const request = vi.fn(async (key: string, _options: unknown, callback: (lock: unknown) => Promise<void>) => {
    if (held.has(key)) { await callback(null); return; }
    held.add(key); try { await callback({ name: key }); } finally { held.delete(key); }
  });
  return { held, manager: { request } as unknown as LockManager };
}
let scope = 0;
const user = () => `save-user-${++scope}`;
beforeEach(() => {
  localStorage.clear(); vi.unstubAllGlobals(); vi.clearAllMocks(); transport.state.row = null; transport.state.error = null;
  vi.restoreAllMocks();
});

describe('Mesomon save validation and migrations', () => {
  it('fingerprints reordered JSONB records identically while preserving meaningful array order', () => {
    const original = withRecords(), restored = migrateSave(reordered(original)); expect(restored).not.toBeNull();
    expect(JSON.stringify(restored)).not.toBe(JSON.stringify(original));
    expect(saveFingerprint(restored!)).toBe(saveFingerprint(original));
    expect(saveFingerprint({ ...original, savedAt: '2026-11-26T00:00:00.000Z' })).toBe(saveFingerprint(original));
    expect(saveFingerprint({ ...original, party: [...original.party].reverse() })).not.toBe(saveFingerprint(original));
  });
  it('rejects corrupt battle categories, zero boss stability and mismatched battle companions', () => {
    const member = makeCompanion('rillik'), boss = createBattle([member], 'rift-wretch', 'chamber-boss');
    const valid = { ...sample(), party: [member], collection: { [member.id]: member }, battle: boss }; expect(migrateSave(valid)).not.toBeNull();
    for (const battle of [{ ...boss, maxStability: 0, stability: 0 }, { ...boss, id: 'passage-encounter' }, { ...boss, allies: [{ ...boss.allies[0], vitality: 0 }] }, { ...boss, allies: [{ ...boss.allies[0], id: 'different-bond' }] }, { ...boss, allies: [boss.allies[0], boss.allies[0]] }]) expect(migrateSave({ ...valid, battle })).toBeNull();
  });
  it('validates all three slots and migrates explicit pre-release V0', () => {
    for (const slot of [1, 2, 3] as const) expect(validateSave(sample(slot))).toBe(true);
    expect(migrateSave({ ...sample(), schemaVersion: 0 })?.schemaVersion).toBe(1);
    expect(migrateSave({ ...sample(), schemaVersion: 2 })).toBeNull();
  });
  it('defaults only additive V1 state so older chapter saves resume safely', () => {
    const old = { ...sample(), battle: undefined, dialogue: undefined, dialogueHistory: undefined, seal: undefined, settings: { ...sample().settings, musicVolume: undefined, ambientVolume: undefined } };
    const restored = migrateSave(old); expect(restored?.seal.pulses).toBe(0); expect(restored?.battle).toBeNull(); expect(restored?.settings.musicVolume).toBe(0.35);
    expect(migrateSave({ schemaVersion: 1 })).toBeNull();
  });
  it('rejects bad slots, impossible positions, malformed dialogue and nonfinite values', () => {
    for (const invalid of [{ ...sample(), slot: 4 }, { ...sample(), player: { ...sample().player, x: 16 } }, { ...sample(), playtimeSeconds: NaN }, { ...sample(), inventory: { tincture: -2 } }, { ...sample(), dialogue: { id: 'bad', index: 2, lines: [{ speaker: 'Nia', text: 'Wait.' }] } }]) expect(migrateSave(invalid)).toBeNull();
  });
  it('never loads a demon into the bonded party or mismatched collection identities', () => {
    const member = { id: 'wild', speciesId: 'rift-wretch', level: 1, vitality: 10, maxVitality: 10, experience: 0, moves: ['rift-lash'] };
    expect(migrateSave({ ...sample(), party: [member], collection: { wild: member } })).toBeNull();
    expect(migrateSave({ ...sample(), party: [{ ...member, speciesId: 'rillik' }], collection: {} })).toBeNull();
  });
  it('validates cloud revision, slot and timestamp before comparing versions', () => {
    const row = { state: sample(), revision: 2, slot: 1, updated_at: '2026-11-25T19:00:00Z' };
    expect(parseCloudSave(row)?.revision).toBe(2); expect(compareCloudSave(1, row)).toBe('cloud-newer'); expect(compareCloudSave(2, row)).toBe('same');
    expect(parseCloudSave({ ...row, revision: Number.MAX_SAFE_INTEGER + 1 })).toBeNull(); expect(parseCloudSave({ ...row, slot: 2 })).toBeNull(); expect(parseCloudSave({ ...row, updated_at: 'bad' })).toBeNull();
  });
});

describe('Mesomon local persistence', () => {
  it('selects the newer IndexedDB chapter after a quota failure leaves a valid older cache', async () => {
    const uid = user(), key = saveStorageKey(uid, 1), old = freshEnvelope(sample()), newest = freshEnvelope({ ...sample(), player: { ...sample().player, x: 9 } });
    old.writtenAt = 100; newest.writtenAt = 101;
    localStorage.setItem(key, JSON.stringify(old)); const rows = new Map<string, unknown>([[key, newest]]); vi.stubGlobal('indexedDB', fakeDatabase(rows));
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    expect((await readLocalSave(uid, 1))?.save.player.x).toBe(9); write.mockRestore();
  });
  it('same-millisecond and backwards-clock writes receive monotonic receipts before both stores', async () => {
    const uid = user(), key = saveStorageKey(uid, 1), rows = new Map<string, unknown>(); vi.stubGlobal('indexedDB', fakeDatabase(rows));
    const first = freshEnvelope(sample()), next = freshEnvelope({ ...sample(), playtimeSeconds: 1 }); first.writtenAt = Date.now() + 10000; next.writtenAt = first.writtenAt;
    await writeLocalSave(uid, 1, first); await writeLocalSave(uid, 1, next); await waitForLocalWrites(uid, 1);
    expect(next.writtenAt).toBeGreaterThan(first.writtenAt); expect(JSON.parse(localStorage.getItem(key)!).writtenAt).toBe(next.writtenAt); expect((rows.get(key) as { writtenAt: number }).writtenAt).toBe(next.writtenAt);
    const backwards = freshEnvelope({ ...sample(), playtimeSeconds: 2 }); backwards.writtenAt = 1; await writeLocalSave(uid, 1, backwards); expect(backwards.writtenAt).toBeGreaterThan(next.writtenAt);
    expect(newestLocalSave([first, next, backwards])?.save.playtimeSeconds).toBe(2);
  });
  it('reports a queued write failure even when the preceding checkpoint fitted in localStorage', async () => {
    const uid = user();
    const first = writeLocalSave(uid, 1, freshEnvelope(sample()));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const second = writeLocalSave(uid, 1, freshEnvelope({ ...sample(), playtimeSeconds: 8 }));
    expect(await first).toBe(true);
    expect(await second).toBe(false);
  });
  it('persists a real local snapshot and isolates guest and signed-in accounts', async () => {
    const uid = user(), save = { ...sample(), playtimeSeconds: 47 }; await writeLocalSave(uid, 1, freshEnvelope(save));
    expect((await readLocalSave(uid, 1))?.save.playtimeSeconds).toBe(47);
    expect(await readLocalSave(null, 1)).toBeNull(); expect(await readLocalSave(user(), 1)).toBeNull(); expect(await readLocalSave(uid, 2)).toBeNull();
  });
  it('recovers the newest valid device snapshot even if the primary cache is damaged', async () => {
    const uid = user(); await writeLocalSave(uid, 1, freshEnvelope(sample())); await writeLocalSave(uid, 1, freshEnvelope({ ...sample(), playtimeSeconds: 4 }));
    localStorage.setItem(saveStorageKey(uid, 1), '{broken');
    expect((await readLocalSave(uid, 1))?.save.playtimeSeconds).toBe(4);
    expect(localStorage.getItem(saveStorageKey(uid, 1) + ':diagnostic')).toContain('{broken');
  });
  it('preserves corrupt local content for diagnostics without throwing', async () => {
    const uid = user(); localStorage.setItem(saveStorageKey(uid, 1), '{broken');
    expect(await readLocalSave(uid, 1)).toBeNull(); expect(localStorage.getItem(saveStorageKey(uid, 1) + ':diagnostic')).toContain('{broken');
  });
});

describe('Mesomon same-device writer safety', () => {
  it('an offline stale tab cannot overwrite another tab’s newer local head, even before a storage event', async () => {
    const uid = user(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); await writeLocalSave(uid, 1, freshEnvelope(sample()));
    const a = renderHook(() => useMesomonSave({ userId: uid, slot: 1 })), b = renderHook(() => useMesomonSave({ userId: uid, slot: 1 }));
    await waitFor(() => expect(a.result.current.loading || b.result.current.loading).toBe(false));
    act(() => a.result.current.saveLocal({ ...sample(), playtimeSeconds: 12 }));
    act(() => b.result.current.saveLocal({ ...sample(), playtimeSeconds: 1 }));
    expect(b.result.current.blocked).toBe(true); expect((await readLocalSave(uid, 1))?.save.playtimeSeconds).toBe(12);
    act(() => b.result.current.saveLocal({ ...sample(), playtimeSeconds: 2 })); expect((await readLocalSave(uid, 1))?.save.playtimeSeconds).toBe(12);
    a.unmount(); await act(async () => b.result.current.retry()); expect(b.result.current.blocked).toBe(false); expect(b.result.current.save?.playtimeSeconds).toBe(12); b.unmount();
  });
  it('a storage event blocks offline writes and preserves an exact uncertain branch separately', async () => {
    const uid = user(), local = freshEnvelope(sample()), pending = { requestId: crypto.randomUUID(), expectedRevision: 0, state: sample() }; local.pending = pending;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); await writeLocalSave(uid, 1, local);
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, slot: 1 })); await waitFor(() => expect(result.current.loading).toBe(false));
    const newer = freshEnvelope({ ...sample(), playtimeSeconds: 18 }); await writeLocalSave(uid, 1, newer);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: saveStorageKey(uid, 1), newValue: JSON.stringify(newer) })));
    expect(result.current.blocked).toBe(true); expect(JSON.parse(localStorage.getItem(saveStorageKey(uid, 1) + ':blocked-branch')!).pending).toEqual(pending); expect((await readLocalSave(uid, 1))?.save.playtimeSeconds).toBe(18); unmount();
  });
  it('Web Locks reserve one writer per file and Strict Mode does not compete with itself', async () => {
    const uid = user(), locks = fakeLocks(); Object.defineProperty(navigator, 'locks', { configurable: true, value: locks.manager });
    const a = renderHook(() => useMesomonSave({ userId: uid, slot: 1 }), { wrapper: StrictMode });
    await waitFor(() => expect(a.result.current.loading).toBe(false)); expect(a.result.current.blocked).toBe(false);
    const b = renderHook(() => useMesomonSave({ userId: uid, slot: 1 })); await waitFor(() => expect(b.result.current.blocked).toBe(true));
    const other = renderHook(() => useMesomonSave({ userId: uid, slot: 2 })); await waitFor(() => expect(other.result.current.loading).toBe(false)); expect(other.result.current.blocked).toBe(false);
    act(() => b.result.current.saveLocal(sample())); expect(b.result.current.save).toBeNull();
    a.unmount(); await act(async () => { await Promise.resolve(); }); await act(async () => b.result.current.retry()); expect(b.result.current.blocked).toBe(false);
    b.unmount(); other.unmount(); await act(async () => { await Promise.resolve(); }); Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); expect(locks.held.size).toBe(0);
  });
  it('a stalled browser lock API is bounded and releases a reservation arriving after timeout', async () => {
    let callback: ((lock: unknown) => Promise<void>) | null = null;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_key: string, _options: unknown, work: (lock: unknown) => Promise<void>) => { callback = work; return new Promise(() => {}); } } });
    vi.useFakeTimers(); try { const pending = acquireFileWriter('stalled'); await vi.advanceTimersByTimeAsync(1600); expect(await pending).toBeNull(); if (callback) await (callback as (lock: unknown) => Promise<void>)({}); } finally { vi.useRealTimers(); Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); }
  });
});

describe('Mesomon local-first cloud recovery', () => {
  it('a same-revision JSONB key reorder is not a cloud conflict or a new write', async () => {
    const uid = user(), state = withRecords(); await writeLocalSave(uid, 1, envelopeFromCloud({ state, revision: 3, slot: 1, updated_at: state.savedAt }));
    transport.state.row = { state: reordered(state), revision: 3, slot: 1, updated_at: state.savedAt };
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false)); await waitFor(() => expect(transport.read).toHaveBeenCalled());
    expect(result.current.conflict).toBeNull(); expect(result.current.status).toBe('saved'); expect(transport.rpc).not.toHaveBeenCalled(); unmount();
  });
  it('timestamp-only updates stay clean and real checkpoints receive a current receipt time', async () => {
    const uid = user(), state = sample(); await writeLocalSave(uid, 1, envelopeFromCloud({ state, revision: 1, slot: 1, updated_at: state.savedAt }));
    transport.state.row = { state, revision: 1, slot: 1, updated_at: state.savedAt }; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-25T21:00:00.000Z'));
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    try {
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.saveLocal({ ...state, savedAt: '2026-11-25T20:59:00.000Z' }));
      expect(result.current.save?.savedAt).toBe(state.savedAt); expect((await readLocalSave(uid, 1))?.dirty).toBe(false); expect(transport.rpc).not.toHaveBeenCalled();
      act(() => result.current.saveLocal({ ...state, playtimeSeconds: 12 }));
      expect(result.current.save?.savedAt).toBe('2026-11-25T21:00:00.000Z'); expect((await readLocalSave(uid, 1))?.dirty).toBe(true);
    } finally { unmount(); vi.useRealTimers(); }
  });
  it('saves locally immediately and retries the exact uncertain payload before newer progress', async () => {
    const uid = user(), { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.saveLocal(sample()));
    expect((await readLocalSave(uid, 1))?.save.player.name).toBe('Tavian');
    transport.rpc.mockRejectedValueOnce(new Error('Connection interrupted'));
    await act(async () => result.current.flush()); expect(result.current.status).toBe('attention');
    act(() => result.current.saveLocal({ ...sample(), playtimeSeconds: 9 }));
    await act(async () => result.current.flush());
    expect(transport.rpc).toHaveBeenCalledTimes(3);
    expect(transport.rpc.mock.calls[0][1].p_expected_user_id).toBe(uid);
    expect(transport.rpc.mock.calls[0]).toEqual(transport.rpc.mock.calls[1]);
    expect(transport.rpc.mock.calls[2][1].p_expected_revision).toBe(1);
    expect(result.current.save?.playtimeSeconds).toBe(9); expect(result.current.status).toBe('saved'); unmount();
  });
  it('a late cloud response restores an empty device without inventing a new chapter', async () => {
    const uid = user(), cloud = { ...sample(), playtimeSeconds: 98 };
    let finish: (result: { data: unknown; error: unknown }) => void = () => {};
    transport.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false)); expect(result.current.save).toBeNull();
    await act(async () => finish({ data: { state: cloud, revision: 4, slot: 1, updated_at: cloud.savedAt }, error: null }));
    expect(result.current.save?.playtimeSeconds).toBe(98); expect(result.current.conflict).toBeNull(); expect(transport.rpc).not.toHaveBeenCalled(); unmount();
  });
  it('starting before the late cloud response cannot overwrite a newer cloud chapter', async () => {
    const uid = user(), cloud = { ...sample(), playtimeSeconds: 98 };
    let finish: (result: { data: unknown; error: unknown }) => void = () => {};
    transport.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false)); act(() => result.current.saveLocal(sample()));
    await act(async () => finish({ data: { state: cloud, revision: 4, slot: 1, updated_at: cloud.savedAt }, error: null }));
    expect(result.current.save?.playtimeSeconds).toBe(0); expect(result.current.conflict?.cloud?.playtimeSeconds).toBe(98); expect(transport.rpc).not.toHaveBeenCalled(); unmount();
  });
  it('reload retries an uncertain write UUID before declaring a false newer-cloud conflict', async () => {
    const uid = user(), local = freshEnvelope(sample()), request = crypto.randomUUID();
    local.pending = { requestId: request, expectedRevision: 0, state: sample() };
    await writeLocalSave(uid, 1, local); transport.state.row = { state: sample(), revision: 1, slot: 1, updated_at: sample().savedAt };
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(result.current.conflict).toBeNull(); expect(transport.rpc.mock.calls[0][1].p_request_id).toBe(request); expect((await readLocalSave(uid, 1))?.pending).toBeNull(); unmount();
  });
  it('reloads the last local state and never replaces it silently with a newer cloud state', async () => {
    const uid = user(), local = { ...sample(), playtimeSeconds: 40 }, cloud = { ...sample(), playtimeSeconds: 90 };
    await writeLocalSave(uid, 1, envelopeFromCloud({ state: local, revision: 1, updated_at: local.savedAt, slot: 1 }));
    transport.state.row = { state: cloud, revision: 2, updated_at: cloud.savedAt, slot: 1 };
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.conflict).not.toBeNull());
    expect(result.current.save?.playtimeSeconds).toBe(40); expect(transport.rpc).not.toHaveBeenCalled();
    await act(async () => result.current.useCloud()); expect(result.current.save?.playtimeSeconds).toBe(90); expect(result.current.conflict).toBeNull(); unmount();
  });
  it('an explicit keep-device choice rebases through CAS and preserves newest active local changes', async () => {
    const uid = user(); await writeLocalSave(uid, 1, envelopeFromCloud({ state: sample(), revision: 1, updated_at: sample().savedAt, slot: 1 }));
    transport.state.row = { state: { ...sample(), playtimeSeconds: 90 }, revision: 2, updated_at: sample().savedAt, slot: 1 };
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.conflict).not.toBeNull());
    act(() => result.current.saveLocal({ ...sample(), playtimeSeconds: 45 }));
    await act(async () => result.current.keepLocal());
    expect(transport.rpc.mock.calls[0][1].p_expected_revision).toBe(2); expect(result.current.save?.playtimeSeconds).toBe(45); expect(result.current.status).toBe('saved'); unmount();
  });
  it('retry reads a clean checkpoint again after cloud hydration failed', async () => {
    const uid = user(), state = sample();
    const row = { state, revision: 1, updated_at: state.savedAt, slot: 1 as const };
    await writeLocalSave(uid, 1, envelopeFromCloud(row));
    transport.read.mockRejectedValueOnce(new Error('Disconnected')); transport.state.row = row;
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.status).toBe('attention'));
    await act(async () => result.current.retry());
    expect(result.current.status).toBe('saved'); expect(result.current.error).toBeNull(); expect(transport.read).toHaveBeenCalledTimes(2);
    unmount();
  });
  it('retries the same device checkpoint after storage becomes writable', async () => {
    const uid = user();
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, slot: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    act(() => result.current.saveLocal(sample()));
    await waitFor(() => expect(result.current.status).toBe('attention'));
    denied.mockRestore();
    await act(async () => result.current.flush());
    expect(JSON.parse(localStorage.getItem(saveStorageKey(uid, 1))!).save.player.name).toBe('Tavian');
    expect(result.current.error).toBeNull(); unmount();
  });
  it('unavailable migrations or corrupt cloud rows retain playable local data', async () => {
    const uid = user(); await writeLocalSave(uid, 1, freshEnvelope(sample())); transport.state.error = { message: 'relation mesomon_save_slots does not exist' };
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.status).toBe('attention')); expect(result.current.save?.player.name).toBe('Tavian'); expect(result.current.loading).toBe(false); unmount();
  });
  it('quarantines a corrupt cloud chapter while retaining the valid local save', async () => {
    const uid = user(); await writeLocalSave(uid, 1, freshEnvelope(sample())); transport.state.row = { state: { schemaVersion: 99 }, revision: 5, slot: 1, updated_at: sample().savedAt };
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    await waitFor(() => expect(result.current.status).toBe('attention'));
    expect(result.current.save?.player.name).toBe('Tavian'); expect(result.current.conflict).toBeNull(); expect(localStorage.getItem(saveStorageKey(uid, 1) + ':diagnostic')).toContain('cloud'); unmount();
  });
  it('a hung cloud request cannot hold local play behind a loading screen', async () => {
    const uid = user(); await writeLocalSave(uid, 1, envelopeFromCloud({ state: sample(), revision: 1, updated_at: sample().savedAt, slot: 1 }));
    transport.read.mockImplementationOnce(() => new Promise(() => {})); vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: uid, clubId: 'club', slot: 1 }));
    try {
      await act(async () => { await Promise.resolve(); }); expect(result.current.loading).toBe(false); expect(result.current.save?.player.name).toBe('Tavian');
      await act(async () => { await vi.advanceTimersByTimeAsync(13000); }); expect(result.current.status).toBe('attention'); expect(result.current.error).toContain('timed out');
    } finally { unmount(); vi.useRealTimers(); }
  });
  it('offline guest play never waits for or invokes a cloud operation', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result, unmount } = renderHook(() => useMesomonSave({ userId: null, clubId: null, slot: 2 }));
    await waitFor(() => expect(result.current.loading).toBe(false)); act(() => result.current.saveLocal(sample(2)));
    await act(async () => result.current.flush()); expect(result.current.status).toBe('offline'); expect(transport.rpc).not.toHaveBeenCalled(); expect(transport.read).not.toHaveBeenCalled(); unmount();
  });
  it('switching accounts clears the active save without deleting the former owner’s chapter', async () => {
    const uid = user(); await writeLocalSave(uid, 1, freshEnvelope(sample()));
    const { result, rerender, unmount } = renderHook(({ currentUser }) => useMesomonSave({ userId: currentUser, clubId: null, slot: 1 }), { initialProps: { currentUser: uid } });
    await waitFor(() => expect(result.current.save).not.toBeNull()); rerender({ currentUser: user() }); await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.save).toBeNull(); expect((await readLocalSave(uid, 1))?.save).not.toBeNull(); unmount();
  });
});

describe('Mesomon file deletion', () => {
  it('clears the active file, backup, diagnostic and blocked copy across stores, and preserves adjacent files', async () => {
    const uid = user(), key = saveStorageKey(uid,1), rows = new Map<string, unknown>();
    vi.stubGlobal('indexedDB', fakeDatabase(rows));
    await writeLocalSave(uid,1,freshEnvelope(sample())); await writeLocalSave(uid,1,freshEnvelope({ ...sample(),playtimeSeconds:5 }));
    await writeLocalSave(uid,2,freshEnvelope(sample(2))); await writeLocalSave('other-owner',1,freshEnvelope(sample()));
    for (const suffix of [':blocked-branch',':diagnostic']) localStorage.setItem(key+suffix, 'discard');
    rows.set(key+':blocked-branch',{save:sample()});
    await eraseLocalSave(uid,1,3);
    expect(await readLocalSave(uid,1)).toBeNull(); expect(rows.get(key)).toMatchObject({ kind:'erased',cloudRevision:3 });
    for (const suffix of [':backup',':blocked-branch',':diagnostic']) expect(localStorage.getItem(key+suffix)).toBeNull();
    expect(rows.has(key+':blocked-branch')).toBe(false); expect((await readLocalSave(uid,2))?.save.slot).toBe(2);
    expect((await readLocalSave('other-owner',1))?.save.player.name).toBe('Tavian');
  });
  it('an authenticated delete uses the current cloud revision, survives reload, and permits a new journey', async () => {
    const uid = user(), state = sample(), row = { state,revision:7,slot:1 as const,updated_at:state.savedAt };
    transport.state.row = row; await writeLocalSave(uid,1,envelopeFromCloud(row));
    const { result, unmount } = renderHook(() => useMesomonSave({ userId:uid,clubId:'club',slot:1 }));
    await waitFor(() => expect(result.current.save).toBeTruthy());
    await act(async () => result.current.deleteSave());
    expect(transport.rpc).toHaveBeenCalledWith('mesomon_delete_save',{ p_expected_user_id:uid,p_club_id:'club',p_expected_revision:7,p_slot:1 });
    expect(result.current.save).toBeNull(); await act(async () => result.current.reload());
    expect(result.current.save).toBeNull(); expect(result.current.blocked).toBe(false);
    act(() => result.current.saveLocal(sample())); await act(async () => result.current.flush());
    expect(transport.rpc.mock.lastCall?.[1].p_expected_revision).toBe(8);
    expect((await readLocalSave(uid,1))?.cloudRevision).toBe(9); unmount();
  });
  it('does not delete the local chapter on transport failure or when the cloud revision is newer', async () => {
    const uid = user(), state = sample();
    transport.state.row = { state,revision:2,slot:1,updated_at:state.savedAt };
    const { result, unmount } = renderHook(() => useMesomonSave({ userId:uid,clubId:'club',slot:1 }));
    await waitFor(() => expect(result.current.save).toBeTruthy());
    transport.rpc.mockResolvedValueOnce({data:null,error:{code:'NETWORK'}});
    await act(async () => { await expect(result.current.deleteSave()).rejects.toThrow('confirm deletion'); });
    expect((await readLocalSave(uid,1))?.cloudRevision).toBe(2); expect(result.current.deleting).toBe(false);
    transport.rpc.mockResolvedValueOnce({data:{deleted:false,revision:3},error:null});
    await act(async () => { await expect(result.current.deleteSave()).rejects.toThrow('another device'); });
    expect(result.current.blocked).toBe(true); expect((await readLocalSave(uid,1))?.cloudRevision).toBe(2); unmount();
  });
  it('restores an empty file on another device without recovering or uploading an old cached chapter', async () => {
    const uid = user(), state = sample();
    transport.state.row = { state:null,revision:6,slot:1,updated_at:state.savedAt };
    await writeLocalSave(uid,1,envelopeFromCloud({ state,revision:5,slot:1,updated_at:state.savedAt }));
    const { result, unmount } = renderHook(() => useMesomonSave({ userId:uid,clubId:'club',slot:1 }));
    await waitFor(() => expect(result.current.blocked).toBe(true));
    await act(async () => result.current.reload());
    expect(result.current.blocked).toBe(false); expect(result.current.save).toBeNull(); expect(transport.rpc).not.toHaveBeenCalled(); unmount();
  });
  it('blocks a stale offline tab from reviving a deleted guest file', async () => {
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    const a = renderHook(() => useMesomonSave({slot:3})), b = renderHook(() => useMesomonSave({slot:3}));
    await waitFor(() => expect(a.result.current.loading || b.result.current.loading).toBe(false));
    act(() => a.result.current.saveLocal(sample(3)));
    await act(async () => b.result.current.reload());
    await act(async () => a.result.current.deleteSave());
    act(() => b.result.current.saveLocal({...sample(3),playtimeSeconds:24}));
    expect(b.result.current.blocked).toBe(true); expect(await readLocalSave(null,3)).toBeNull();
    expect(transport.rpc).not.toHaveBeenCalled(); a.unmount(); b.unmount();
  });
  it('ignores extra delete requests and preserves a different local head written while the server replies', async () => {
    const uid = user(), state = sample(), row = { state,revision:4,slot:1 as const,updated_at:state.savedAt };
    await writeLocalSave(uid,1,envelopeFromCloud(row)); transport.state.row = row;
    const { result,unmount } = renderHook(() => useMesomonSave({ userId:uid,clubId:'club',slot:1 }));
    await waitFor(() => expect(result.current.save).toBeTruthy());
    let reply!: (value: {data:unknown;error:unknown}) => void;
    transport.rpc.mockImplementationOnce(() => new Promise(resolve => { reply=resolve; }));
    let first!: Promise<void>;
    await act(async () => { first=result.current.deleteSave(); });
    expect(result.current.deleting).toBe(true);
    await expect(result.current.deleteSave()).rejects.toThrow();
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    await writeLocalSave(uid,1,freshEnvelope({...sample(),playtimeSeconds:78}));
    await act(async () => {
      reply({data:{deleted:true,revision:5},error:null});
      await expect(first).rejects.toThrow('another tab');
    });
    expect((await readLocalSave(uid,1))?.save.playtimeSeconds).toBe(78); unmount();
  });
  it('honors a remote deletion returned by an in-flight stale cloud write', async () => {
    const uid = user(), state = sample(), row = { state,revision:4,slot:1 as const,updated_at:state.savedAt };
    await writeLocalSave(uid,1,envelopeFromCloud(row)); transport.state.row=row;
    const { result,unmount } = renderHook(() => useMesomonSave({ userId:uid,clubId:'club',slot:1 }));
    await waitFor(() => expect(result.current.save).toBeTruthy());
    act(() => result.current.saveLocal({...state,playtimeSeconds:1}));
    transport.rpc.mockResolvedValueOnce({data:{conflict:true,save:{...row,state:null,revision:5}},error:null});
    await act(async () => result.current.flush());
    expect(result.current.blocked).toBe(true);
    expect(await readLocalSave(uid,1)).toBeNull();
    expect(localStorage.getItem(saveStorageKey(uid,1)+':blocked-branch')).toBeNull(); unmount();
  });
  it('requires connectivity before erasing an account-owned file', async () => {
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    const uid = user(); await writeLocalSave(uid,1,freshEnvelope(sample()));
    const { result,unmount } = renderHook(() => useMesomonSave({ userId:uid,clubId:'club',slot:1 }));
    await waitFor(() => expect(result.current.save).toBeTruthy());
    await expect(result.current.deleteSave()).rejects.toThrow('Connect');
    expect(await readLocalSave(uid,1)).toBeTruthy(); expect(transport.rpc).not.toHaveBeenCalled(); unmount();
  });
});

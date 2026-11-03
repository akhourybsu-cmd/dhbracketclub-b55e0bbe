import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPendingAction, pendingStorageKeyMatches, readPendingActions, rememberPendingAction, type DeepClaimPendingAction } from '@/lib/deepClaim/pendingActions';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

const key = 'dh:deep-claim:pending:v1:user-a:club-a';
const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';
const leaf = (id: string) => `${key}:request:${id}`;
const previewLeaf = (id: string) => `${key}:${id}`;
function action(id = firstId, quantity = 3): DeepClaimPendingAction {
  const args = { p_resource_key: 'coal', p_quantity: quantity, p_expected_revision: 7 };
  return { operation: 'dc_sell', args: { ...args, p_request_id: id }, fingerprint: JSON.stringify(['dc_sell', args]), label: 'Sell materials' };
}
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('Deep Claim durable pending action journal', () => {
  it('preserves both independently started tab actions and their exact retry arguments', () => {
    const first = action(), second = action(secondId, 5);
    rememberPendingAction(key, first); rememberPendingAction(key, second);
    expect(readPendingActions(key)).toEqual([second, first]);
    expect(JSON.parse(localStorage.getItem(leaf(firstId))!)).toEqual(first);
    expect(JSON.parse(localStorage.getItem(leaf(secondId))!)).toEqual(second);
  });

  it.each(['successful', 'rejected'])('settling one %s action cannot erase the other tab’s receipt', () => {
    const first = action(), second = action(secondId, 5);
    rememberPendingAction(key, first); rememberPendingAction(key, second);
    forgetPendingAction(key, firstId);
    expect(readPendingActions(key)).toEqual([second]);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(second);
    expect(localStorage.getItem(leaf(firstId))).toBeNull();
    forgetPendingAction(key, secondId);
    expect(readPendingActions(key)).toEqual([]);
  });

  it('retains an older leaf when the current pointer finishes first', () => {
    const first = action(); rememberPendingAction(key, first); rememberPendingAction(key, action(secondId));
    forgetPendingAction(key, secondId);
    expect(localStorage.getItem(key)).toBeNull();
    expect(readPendingActions(key)).toEqual([first]);
  });

  it('reads legacy v1 receipts and mirrors them before another tab replaces the pointer', () => {
    const first = action(), second = action(secondId, 5);
    localStorage.setItem(key, JSON.stringify(first));
    expect(readPendingActions(key)).toEqual([first]);
    rememberPendingAction(key, second);
    forgetPendingAction(key, secondId);
    expect(readPendingActions(key)).toEqual([first]);
  });

  it('writes the new leaf before its compatibility pointer and preserves it if pointer storage fails', () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      original.call(this, name, value);
    });
    const pending = action(); expect(() => rememberPendingAction(key, pending)).not.toThrow();
    expect(readPendingActions(key)).toEqual([pending]);
  });

  it('does not replace a UUID’s original immutable retry payload', () => {
    const original = action(); rememberPendingAction(key, original); rememberPendingAction(key, action(firstId, 99));
    expect(readPendingActions(key)).toEqual([original]);
  });

  it('ignores corrupted entries, foreign scopes, invalid leaves and mismatched request IDs', () => {
    localStorage.setItem(key, '{broken');
    localStorage.setItem(`${key}:request:not-a-uuid`, JSON.stringify(action()));
    localStorage.setItem(leaf(firstId), JSON.stringify(action(secondId)));
    localStorage.setItem(`${key}-other:request:${firstId}`, JSON.stringify(action()));
    localStorage.setItem(`dh:deep-claim:pending:v1:user-b:club-a:request:${firstId}`, JSON.stringify(action()));
    localStorage.setItem(`${leaf(secondId)}:extra`, JSON.stringify(action(secondId)));
    expect(readPendingActions(key)).toEqual([]);
  });

  it.each([
    { operation: 'dc_private_helper' }, { args: [] }, { args: { p_request_id: 'f'.repeat(36) } },
    { label: '' }, { label: 'x'.repeat(161) }, { fingerprint: '' }, { fingerprint: 'x'.repeat(32 * 1024 + 1) },
  ])('rejects malformed persisted intent metadata %#', patch => {
    localStorage.setItem(key, JSON.stringify({ ...action(), ...patch }));
    expect(readPendingActions(key)).toEqual([]);
  });

  it('bounds raw receipt bytes and the number of queued actions read', () => {
    localStorage.setItem(key, JSON.stringify({ ...action(), args: { ...action().args, excessive: 'é'.repeat(33 * 1024) } }));
    expect(readPendingActions(key)).toEqual([]);
    localStorage.removeItem(key);
    for (let index = 0; index < 70; index++) {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
      localStorage.setItem(leaf(id), JSON.stringify(action(id)));
    }
    expect(readPendingActions(key)).toHaveLength(64);
  });

  it('quietly tolerates unavailable local storage', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    expect(readPendingActions(key)).toEqual([]);
    expect(() => rememberPendingAction(key, action())).not.toThrow();
    expect(() => forgetPendingAction(key, firstId)).not.toThrow();
  });

  it('matches scoped storage events, including clear, without matching neighboring companies', () => {
    expect(pendingStorageKeyMatches(key, key)).toBe(true);
    expect(pendingStorageKeyMatches(key, leaf(firstId))).toBe(true);
    expect(pendingStorageKeyMatches(key, null)).toBe(true);
    expect(pendingStorageKeyMatches(key, `${leaf(firstId)}:extra`)).toBe(false);
    expect(pendingStorageKeyMatches(key, `${key}-other`)).toBe(false);
    expect(pendingStorageKeyMatches(key, `${key}:request:invalid`)).toBe(false);
  });
});

describe('Deep Claim preview journal migration', () => {
  const preview = (pending: DeepClaimPendingAction, createdAt = 1793678400123) => JSON.stringify({ ...pending, createdAt });

  it('reads the preview pointer and orphan leaves without changing original retry arguments or retaining ordering metadata', () => {
    const first = action(), second = action(secondId, 5);
    localStorage.setItem(key, preview(first));
    localStorage.setItem(previewLeaf(firstId), preview(first));
    localStorage.setItem(previewLeaf(secondId), preview(second, 1));
    expect(readPendingActions(key)).toEqual([first, second]);
    expect(readPendingActions(key)[0].args).toEqual(first.args);
    expect(readPendingActions(key).every(entry => !('createdAt' in entry))).toBe(true);
    // Reading cannot produce an event loop in other mounted tabs.
    expect(localStorage.length).toBe(3);
    expect(JSON.parse(localStorage.getItem(key)!)).toHaveProperty('createdAt');
  });

  it('mirrors an orphan preview leaf before replacing the pointer with a new request', () => {
    const first = action(), second = action(secondId, 5);
    localStorage.setItem(previewLeaf(firstId), preview(first));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    rememberPendingAction(key, second);
    expect(JSON.parse(localStorage.getItem(leaf(firstId))!)).toEqual(first);
    expect(writes.mock.calls.findIndex(([name]) => name === leaf(firstId))).toBeLessThan(writes.mock.calls.findIndex(([name]) => name === key));
    forgetPendingAction(key, secondId);
    expect(readPendingActions(key)).toEqual([first]);
    expect(localStorage.getItem(previewLeaf(firstId))).toBe(preview(first));
  });

  it.each(['pointer', 'orphan leaf'] as const)('preserves the original UUID payload when a preview %s is retried with changed arguments', source => {
    const original = action();
    localStorage.setItem(source === 'pointer' ? key : previewLeaf(firstId), preview(original));
    rememberPendingAction(key, action(firstId, 99));
    expect(readPendingActions(key)).toEqual([original]);
    expect(JSON.parse(localStorage.getItem(leaf(firstId))!)).toEqual(original);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(original);
  });

  it('settles one UUID across both formats without deleting another request or a neighboring club', () => {
    const first = action(), second = action(secondId, 5);
    localStorage.setItem(key, preview(second));
    localStorage.setItem(previewLeaf(firstId), preview(first));
    localStorage.setItem(leaf(firstId), JSON.stringify(first));
    localStorage.setItem(previewLeaf(secondId), preview(second));
    localStorage.setItem(leaf(secondId), JSON.stringify(second));
    const foreign = `${key}-another-club:${firstId}`;
    localStorage.setItem(foreign, preview(first));
    forgetPendingAction(key, firstId);
    expect(localStorage.getItem(leaf(firstId))).toBeNull();
    expect(localStorage.getItem(previewLeaf(firstId))).toBeNull();
    expect(readPendingActions(key)).toEqual([second]);
    expect(localStorage.getItem(key)).toBe(preview(second));
    forgetPendingAction(key, secondId);
    expect(readPendingActions(key)).toEqual([]);
    expect(localStorage.getItem(previewLeaf(secondId))).toBeNull();
    expect(localStorage.getItem(foreign)).toBe(preview(first));
  });

  it('recognizes mixed-case preview UUIDs while preserving their exact RPC value', () => {
    const id = 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', saved = action(id);
    localStorage.setItem(previewLeaf(id), preview(saved));
    expect(readPendingActions(key)).toEqual([saved]);
    rememberPendingAction(key, saved);
    expect(readPendingActions(key)[0].args.p_request_id).toBe(id);
    expect(JSON.parse(localStorage.getItem(leaf(id.toLowerCase()))!)).toEqual(saved);
    forgetPendingAction(key, id);
    expect(readPendingActions(key)).toEqual([]);
    expect(localStorage.getItem(previewLeaf(id))).toBeNull();
    expect(localStorage.getItem(leaf(id.toLowerCase()))).toBeNull();
  });

  it.each([null, '1793678400123', {}, true])('rejects invalid optional preview metadata %#', createdAt => {
    localStorage.setItem(key, JSON.stringify({ ...action(), createdAt }));
    expect(readPendingActions(key)).toEqual([]);
  });

  it('keeps strict scope, UUID, byte and metadata validation for alternate leaves', () => {
    localStorage.setItem(`${previewLeaf(firstId)}:extra`, preview(action()));
    localStorage.setItem(previewLeaf(secondId), preview(action()));
    localStorage.setItem(`${key}-other:${firstId}`, preview(action()));
    localStorage.setItem(key, JSON.stringify({ ...action(), createdAt: 1, inventedAuthority: true }));
    expect(readPendingActions(key)).toEqual([]);
    localStorage.removeItem(key);
    localStorage.setItem(previewLeaf(firstId), preview({ ...action(), args: { ...action().args, oversized: 'é'.repeat(33 * 1024) } }));
    expect(readPendingActions(key)).toEqual([]);
  });

  it('bounds a mixed-format queue to the existing request limit', () => {
    for (let index = 0; index < 70; index++) {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
      localStorage.setItem(index % 2 ? leaf(id) : previewLeaf(id), preview(action(id)));
    }
    expect(readPendingActions(key)).toHaveLength(64);
  });

  it('retains the preview receipt when storage cannot persist its migrated leaf', () => {
    const first = action(); localStorage.setItem(key, preview(first));
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
      if (name === leaf(firstId)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      original.call(this, name, value);
    });
    expect(() => rememberPendingAction(key, action(secondId))).not.toThrow();
    expect(readPendingActions(key)).toEqual([first]);
    expect(localStorage.getItem(key)).toBe(preview(first));
    expect(localStorage.getItem(leaf(secondId))).toBeNull();
  });

  it('matches alternate-leaf storage events without matching foreign scopes or malformed suffixes', () => {
    expect(pendingStorageKeyMatches(key, previewLeaf(firstId))).toBe(true);
    expect(pendingStorageKeyMatches(key, `${previewLeaf(firstId)}:extra`)).toBe(false);
    expect(pendingStorageKeyMatches(key, `${key}-other:${firstId}`)).toBe(false);
    expect(pendingStorageKeyMatches(key, `${key}:not-a-uuid`)).toBe(false);
  });
});

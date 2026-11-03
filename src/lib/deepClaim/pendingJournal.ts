import { DEEP_CLAIM_MUTATIONS, type DeepClaimMutation } from './service';

/**
 * Uncertain Deep Claim action journal.
 *
 * Compatible with the original single pointer `dh:deep-claim:pending:v1:<user>:<club>`:
 * that key still holds one canonical pending intent (oldest unresolved), while every
 * intent is also stored as its own leaf `<pointer>:<request-uuid>`. Leaves are written
 * before the pointer is replaced, and clearing an action only removes its own leaf and
 * the pointer when it matches, so tabs never erase each other's uncertain receipts.
 * Server request receipts stay the authority; this only remembers what to retry.
 */
export type DeepClaimPending = { operation: DeepClaimMutation; args: Record<string, unknown>; fingerprint: string; label: string; createdAt?: number };

export const DEEP_CLAIM_PENDING_EVENT = 'dh:deep-claim:pending-changed';
const MAX_ENTRY_BYTES = 16_384, MAX_LABEL = 80, MAX_ENTRIES = 12;
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const memory = new Map<string, Map<string, DeepClaimPending>>();

export const pendingPointerKey = (userId: string, clubId: string) => `dh:deep-claim:pending:v1:${userId}:${clubId}`;
export const pendingRequestId = (pending: DeepClaimPending) => pending.args.p_request_id as string;
const leafKey = (pointer: string, id: string) => `${pointer}:${id}`;

function storage(): Storage | null { try { return window.localStorage; } catch { return null; } }

export function parsePending(raw: string | null): DeepClaimPending | null {
  if (!raw || raw.length > MAX_ENTRY_BYTES) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!DEEP_CLAIM_MUTATIONS.includes(value.operation)) return null;
    if (!value.args || typeof value.args !== 'object' || Array.isArray(value.args)) return null;
    if (typeof value.args.p_request_id !== 'string' || !UUID.test(value.args.p_request_id)) return null;
    if (typeof value.fingerprint !== 'string' || value.fingerprint.length > MAX_ENTRY_BYTES) return null;
    if (typeof value.label !== 'string' || !value.label || value.label.length > MAX_LABEL) return null;
    const createdAt = Number.isFinite(value.createdAt) ? Number(value.createdAt) : 0;
    return { operation: value.operation, args: value.args, fingerprint: value.fingerprint, label: value.label, createdAt };
  } catch { return null; }
}

function notify(pointer: string) {
  try { window.dispatchEvent(new CustomEvent(DEEP_CLAIM_PENDING_EVENT, { detail: pointer })); } catch { /* no window */ }
}
function remember(pointer: string) { let entries = memory.get(pointer); if (!entries) memory.set(pointer, entries = new Map()); return entries; }

/** Every unresolved intent for this member/club, oldest first, deduped by request UUID. Migrates a legacy pointer-only entry into a leaf. */
export function readPendingJournal(pointer: string): DeepClaimPending[] {
  const found = new Map<string, DeepClaimPending>(remember(pointer));
  const store = storage();
  if (store) {
    try {
      const prefix = `${pointer}:`;
      for (let index = 0; index < store.length; index++) {
        const key = store.key(index);
        if (!key?.startsWith(prefix)) continue;
        const id = key.slice(prefix.length), entry = parsePending(store.getItem(key));
        if (entry && pendingRequestId(entry) === id) found.set(id, entry);
      }
      const canonical = parsePending(store.getItem(pointer));
      if (canonical) {
        const id = pendingRequestId(canonical);
        if (!found.has(id)) {
          found.set(id, canonical);
          try { store.setItem(leafKey(pointer, id), JSON.stringify(canonical)); } catch { remember(pointer).set(id, canonical); }
        }
      }
    } catch { /* blocked storage: memory fallback below */ }
  }
  return [...found.values()].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)).slice(0, MAX_ENTRIES);
}

/** Persist a new intent: leaf first, then the compatibility pointer (only if it is empty or invalid). */
export function writePendingJournal(pointer: string, pending: DeepClaimPending) {
  const id = pendingRequestId(pending), raw = JSON.stringify(pending);
  const store = storage();
  try {
    if (!store) throw new Error('storage unavailable');
    store.setItem(leafKey(pointer, id), raw);
    if (!parsePending(store.getItem(pointer))) store.setItem(pointer, raw);
  } catch { remember(pointer).set(id, pending); /* in-memory receipt still protects this session */ }
  notify(pointer);
}

/** Remove only this request's leaf, and the pointer only when it names this request. */
export function clearPendingJournal(pointer: string, requestId: string) {
  remember(pointer).delete(requestId);
  const store = storage();
  try {
    store?.removeItem(leafKey(pointer, requestId));
    const canonical = parsePending(store?.getItem(pointer) ?? null);
    if (canonical && pendingRequestId(canonical) === requestId) {
      const next = readPendingJournal(pointer).find(entry => pendingRequestId(entry) !== requestId);
      if (next) store?.setItem(pointer, JSON.stringify(next)); else store?.removeItem(pointer);
    }
  } catch { /* ignore */ }
  notify(pointer);
}

/** Subscribe to this pointer's changes from other tabs (storage) and other hooks in this window. */
export function subscribePendingJournal(pointer: string, listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === pointer || event.key.startsWith(`${pointer}:`)) listener(); };
  const onLocal = (event: Event) => { if ((event as CustomEvent).detail === pointer) listener(); };
  window.addEventListener('storage', onStorage); window.addEventListener(DEEP_CLAIM_PENDING_EVENT, onLocal);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(DEEP_CLAIM_PENDING_EVENT, onLocal); };
}

/** Test seam. */
export function resetPendingJournalMemory() { memory.clear(); }

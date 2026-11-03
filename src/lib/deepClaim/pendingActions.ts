import { DEEP_CLAIM_MUTATIONS, type DeepClaimMutation } from './service';

export interface DeepClaimPendingAction {
  operation: DeepClaimMutation;
  args: Record<string, unknown>;
  fingerprint: string;
  label: string;
}

const MAX_ENTRY_BYTES = 64 * 1024;
const MAX_PENDING_ACTIONS = 64;
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const requestId = (pending: DeepClaimPendingAction): string => (pending.args.p_request_id as string).toLowerCase();
const leafPrefix = (key: string): string => `${key}:request:`;
const leafKey = (key: string, id: string): string => `${leafPrefix(key)}${id.toLowerCase()}`;
const previewLeafKey = (key: string, id: string): string => `${key}:${id.toLowerCase()}`;

/** The short-lived preview journal used `<pointer>:<uuid>` leaves. */
function persistedLeafId(key: string, candidate: string): string | null {
  const prefix = `${key}:`;
  if (!candidate.startsWith(prefix)) return null;
  const suffix = candidate.slice(prefix.length), id = suffix.startsWith('request:') ? suffix.slice('request:'.length) : suffix;
  return UUID.test(id) ? id.toLowerCase() : null;
}

function storage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

function parse(raw: string | null): DeepClaimPendingAction | null {
  if (!raw || raw.length > MAX_ENTRY_BYTES) return null;
  try {
    if (new TextEncoder().encode(raw).byteLength > MAX_ENTRY_BYTES) return null;
    const value: unknown = JSON.parse(raw);
    if (!object(value) || Object.keys(value).some(key => !['operation', 'args', 'fingerprint', 'label', 'createdAt'].includes(key))
      || !DEEP_CLAIM_MUTATIONS.includes(value.operation as DeepClaimMutation) || !object(value.args)
      || typeof value.args.p_request_id !== 'string' || !UUID.test(value.args.p_request_id)
      || typeof value.fingerprint !== 'string' || !value.fingerprint.length || value.fingerprint.length > 32 * 1024
      || typeof value.label !== 'string' || !value.label.trim() || value.label.length > 160
      || 'createdAt' in value && (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt))) return null;
    // Preview timestamps were local ordering metadata, never part of RPC args.
    return { operation: value.operation as DeepClaimMutation, args: value.args, fingerprint: value.fingerprint, label: value.label };
  } catch { return null; }
}

/** The v1 pointer remains readable; UUID leaves keep other tabs' receipts durable. */
function readFromStore(store: Storage, key: string): DeepClaimPendingAction[] {
  const pending: DeepClaimPendingAction[] = [], ids = new Set<string>();
  const add = (value: DeepClaimPendingAction | null) => {
    if (!value || ids.has(requestId(value))) return;
    ids.add(requestId(value)); pending.push(value);
  };
  try { add(parse(store.getItem(key))); } catch { /* Leaves may remain readable if this entry is unavailable. */ }
  try {
    const length = store.length;
    let inspected = 0;
    for (let index = 0; index < length && inspected < MAX_PENDING_ACTIONS && pending.length < MAX_PENDING_ACTIONS; index++) {
      const candidate = store.key(index);
      const id = candidate ? persistedLeafId(key, candidate) : null;
      if (!candidate || !id) continue;
      inspected++;
      try {
        const value = parse(store.getItem(candidate));
        if (value && requestId(value) === id) add(value);
      } catch { /* One damaged receipt must not hide another tab's action. */ }
    }
  } catch { /* The caller retains its in-memory receipt when storage is blocked. */ }
  return pending;
}

export function readPendingActions(key: string): DeepClaimPendingAction[] {
  const store = storage();
  return store ? readFromStore(store, key) : [];
}

export function rememberPendingAction(key: string, pending: DeepClaimPendingAction): void {
  const store = storage();
  if (!store) return;
  try {
    const raw = JSON.stringify(pending), validated = parse(raw);
    if (!validated) return;
    // Snapshot and mirror both persisted formats before replacing the pointer.
    // Old leaves remain until their own UUID settles, keeping preview retries safe.
    for (const previous of readFromStore(store, key)) {
      const previousId = requestId(previous), previousKey = leafKey(key, previousId);
      const existing = parse(store.getItem(previousKey));
      if (!existing || requestId(existing) !== previousId) store.setItem(previousKey, JSON.stringify(previous));
    }
    const target = leafKey(key, requestId(validated));
    const existing = parse(store.getItem(target));
    const receipt = existing && requestId(existing) === requestId(validated) ? existing : validated;
    const serialized = JSON.stringify(receipt);
    store.setItem(target, serialized);
    store.setItem(key, serialized);
  } catch { /* Saving must remain usable through the caller's in-memory receipt. */ }
}

export function forgetPendingAction(key: string, id: string): void {
  if (!UUID.test(id)) return;
  const store = storage();
  if (!store) return;
  try {
    const normalized = id.toLowerCase(), targets = new Set([leafKey(key, id), previewLeafKey(key, id), `${leafPrefix(key)}${id}`, `${key}:${id}`]);
    const length = store.length;
    let inspected = 0;
    for (let index = 0; index < length && inspected < MAX_PENDING_ACTIONS; index++) {
      const candidate = store.key(index), candidateId = candidate ? persistedLeafId(key, candidate) : null;
      if (!candidate || !candidateId) continue;
      inspected++;
      if (candidateId === normalized) targets.add(candidate);
    }
    for (const target of targets) store.removeItem(target);
    const current = parse(store.getItem(key));
    if (current && requestId(current) === normalized) store.removeItem(key);
  } catch { /* A blocked device store cannot alter the authoritative result. */ }
}

export function pendingStorageKeyMatches(receiptKey: string, eventKey: string | null): boolean {
  if (eventKey === null || eventKey === receiptKey) return true;
  return persistedLeafId(receiptKey, eventKey) !== null;
}

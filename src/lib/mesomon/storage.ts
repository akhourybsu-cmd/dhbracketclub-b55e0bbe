import { migrateSave, type CloudSave } from './save';
import type { MesomonSaveV1 } from './types';

export interface PendingSave { requestId: string; expectedRevision: number; state: object; }
export interface LocalSaveEnvelope {
  version: 1; save: MesomonSaveV1; cloudRevision: number; cloudUpdatedAt: string | null;
  dirty: boolean; pending: PendingSave | null; writtenAt: number;
}
export const saveStorageKey = (userId: string | null | undefined, slot: 1 | 2 | 3) => `dh:mesomon:save:v1:${encodeURIComponent(userId || 'guest')}:${slot}`;
const DB_NAME = 'dh-mesomon-v1', STORE = 'slots', DEADLINE = 1200;
const memory = new Map<string, LocalSaveEnvelope>();
function browserStorage(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
export function archiveCorruptSave(userId: string | null | undefined, slot: 1 | 2 | 3, raw: unknown, source: string): void {
  const store = browserStorage(); if (!store) return;
  try {
    const key = saveStorageKey(userId, slot) + ':diagnostic';
    // One bounded snapshot per slot; no sensitive cross-account logging.
    store.setItem(key, JSON.stringify({ source, capturedAt: new Date().toISOString(), raw: typeof raw === 'string' ? raw.slice(0, 131072) : JSON.stringify(raw).slice(0, 131072) }));
  } catch { /* A full/disabled store must not prevent local play. */ }
}
export function parseLocalEnvelope(value: unknown, slot: 1 | 2 | 3): LocalSaveEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>, save = migrateSave(raw.save);
  if (raw.version !== 1 || !save || save.slot !== slot || !Number.isSafeInteger(raw.cloudRevision) || Number(raw.cloudRevision) < 0 || typeof raw.dirty !== 'boolean' || typeof raw.writtenAt !== 'number' || !Number.isSafeInteger(raw.writtenAt) || raw.writtenAt < 0) return null;
  let pending: PendingSave | null = null;
  if (raw.pending) {
    const p = raw.pending as Record<string, unknown>, state = migrateSave(p.state);
    if (!state || state.slot !== slot || !p.state || typeof p.state !== 'object' || typeof p.requestId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(p.requestId) || !Number.isSafeInteger(p.expectedRevision) || Number(p.expectedRevision) < 0) return null;
    // An accepted request can only be retried with its original payload, even across a client update.
    pending = { requestId: p.requestId, expectedRevision: Number(p.expectedRevision), state: p.state };
  }
  if (raw.cloudUpdatedAt !== null && (typeof raw.cloudUpdatedAt !== 'string' || !Number.isFinite(Date.parse(raw.cloudUpdatedAt)))) return null;
  return { version: 1, save, cloudRevision: Number(raw.cloudRevision), cloudUpdatedAt: raw.cloudUpdatedAt as string | null, dirty: raw.dirty, pending, writtenAt: raw.writtenAt };
}
export function newestLocalSave(values: (LocalSaveEnvelope | null)[]): LocalSaveEnvelope | null {
  return values.reduce<LocalSaveEnvelope | null>((latest, value) => {
    if (!value) return latest;
    if (!latest || value.writtenAt > latest.writtenAt || (value.writtenAt === latest.writtenAt && value.cloudRevision > latest.cloudRevision)) return value;
    return latest;
  }, null);
}
export function readCachedLocalSave(userId: string | null | undefined, slot: 1 | 2 | 3): LocalSaveEnvelope | null {
  const key = saveStorageKey(userId, slot), store = browserStorage(), candidates: (LocalSaveEnvelope | null)[] = [memory.get(key) ?? null];
  for (const suffix of ['', ':backup']) {
    let raw: string | null = null;
    try {
      raw = store?.getItem(key + suffix) ?? null;
      if (raw) {
        const parsed = parseLocalEnvelope(JSON.parse(raw), slot);
        if (parsed) candidates.push(parsed); else archiveCorruptSave(userId, slot, raw, suffix ? 'backup' : 'local');
      }
    } catch { if (raw) archiveCorruptSave(userId, slot, raw, suffix ? 'backup' : 'local'); }
  }
  return newestLocalSave(candidates);
}
function openDatabase(): Promise<IDBDatabase | null> {
  try { if (typeof indexedDB === 'undefined') return Promise.resolve(null); } catch { return Promise.resolve(null); }
  return new Promise(resolve => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => { if (settled) { db?.close(); return; } settled = true; clearTimeout(timer); resolve(db); };
    const timer = setTimeout(() => finish(null), DEADLINE);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
      request.onsuccess = () => finish(request.result);
      request.onerror = () => finish(null); request.onblocked = () => finish(null);
    } catch { finish(null); }
  });
}
async function idbOperation<T>(mode: IDBTransactionMode, key: string, value?: LocalSaveEnvelope): Promise<T | null> {
  const db = await openDatabase(); if (!db) return null;
  return new Promise(resolve => {
    let settled = false;
    const finish = (result: T | null) => { if (settled) return; settled = true; clearTimeout(timer); db.close(); resolve(result); };
    const timer = setTimeout(() => finish(null), DEADLINE);
    try {
      const tx = db.transaction(STORE, mode), store = tx.objectStore(STORE);
      const request = mode === 'readwrite' ? store.put(value, key) : store.get(key);
      let result: unknown = null;
      request.onsuccess = () => { result = mode === 'readwrite' ? true : request.result; };
      tx.oncomplete = () => finish(result as T); tx.onerror = () => finish(null); tx.onabort = () => finish(null);
    } catch { finish(null); }
  });
}
export async function readLocalSave(userId: string | null | undefined, slot: 1 | 2 | 3): Promise<LocalSaveEnvelope | null> {
  // A successful IndexedDB write may be newer than a perfectly valid cache
  // when localStorage hit quota. Always reconcile the bounded primary read.
  const key = saveStorageKey(userId, slot), raw = await idbOperation<unknown>('readonly', key);
  const persisted = raw ? parseLocalEnvelope(raw, slot) : null;
  if (raw && !persisted) archiveCorruptSave(userId, slot, raw, 'indexeddb');
  // Read caches after awaiting: a movement/ack may have arrived meanwhile.
  const latest = newestLocalSave([readCachedLocalSave(userId, slot), persisted]);
  if (latest) memory.set(key, latest);
  return latest;
}
export function waitForLocalWrites(userId: string | null | undefined, slot: 1 | 2 | 3): Promise<void> {
  return (writes.get(saveStorageKey(userId, slot))?.promise ?? Promise.resolve(false)).then(() => {});
}
export function preserveBlockedBranch(userId: string | null | undefined, slot: 1 | 2 | 3, value: LocalSaveEnvelope): void {
  const key = saveStorageKey(userId, slot) + ':blocked-branch';
  try { browserStorage()?.setItem(key, JSON.stringify(value)); } catch { /* IndexedDB retains this bounded branch if cache quota is full. */ }
  void idbOperation<boolean>('readwrite', key, value);
}
export function writeLocalSave(userId: string | null | undefined, slot: 1 | 2 | 3, envelope: LocalSaveEnvelope): Promise<boolean> {
  const key = saveStorageKey(userId, slot), store = browserStorage();
  const priorStamp = readCachedLocalSave(userId, slot)?.writtenAt ?? 0;
  envelope.writtenAt = Math.max(envelope.writtenAt, Date.now(), priorStamp + 1);
  memory.set(key, envelope);
  let cached = false;
  try {
    const previous = store?.getItem(key);
    if (previous && previous !== JSON.stringify(envelope)) {
      try { if (parseLocalEnvelope(JSON.parse(previous), slot)) store?.setItem(key + ':backup', previous); } catch { /* retain prior valid backup */ }
    }
    store?.setItem(key, JSON.stringify(envelope)); cached = !!store;
  } catch { /* IndexedDB remains the primary fallback when localStorage is full. */ }
  // Keep one active transaction and one latest snapshot, rather than queuing
  // every movement while a browser's IndexedDB permission prompt is blocked.
  const existing = writes.get(key);
  if (existing) { existing.latest = envelope; return cached ? Promise.resolve(true) : existing.promise; }
  const job: WriteJob = { latest: envelope, promise: Promise.resolve(false) };
  writes.set(key, job);
  job.promise = (async () => {
    let durable = false;
    while (job.latest) {
      const latest = job.latest; job.latest = null;
      durable = (await idbOperation<boolean>('readwrite', key, latest)) === true;
      // A newer snapshot queued during a failed transaction still needs its own attempt.
    }
    return durable;
  })().finally(() => { if (writes.get(key) === job) writes.delete(key); });
  return cached ? Promise.resolve(true) : job.promise;
}
interface WriteJob { latest: LocalSaveEnvelope | null; promise: Promise<boolean>; }
const writes = new Map<string, WriteJob>();
export function freshEnvelope(save: MesomonSaveV1): LocalSaveEnvelope { return { version: 1, save, cloudRevision: 0, cloudUpdatedAt: null, dirty: true, pending: null, writtenAt: Date.now() }; }
export function envelopeFromCloud(cloud: CloudSave): LocalSaveEnvelope { return { version: 1, save: cloud.state, cloudRevision: cloud.revision, cloudUpdatedAt: cloud.updated_at, dirty: false, pending: null, writtenAt: Date.now() }; }

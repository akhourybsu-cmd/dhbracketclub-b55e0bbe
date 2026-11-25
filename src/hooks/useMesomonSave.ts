import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import { migrateSave, parseCloudSave, saveFingerprint, type CloudSave } from '@/lib/mesomon/save';
import { archiveCorruptSave, envelopeFromCloud, freshEnvelope, readCachedLocalSave, readLocalSave, saveStorageKey, writeLocalSave, waitForLocalWrites, preserveBlockedBranch, type LocalSaveEnvelope } from '@/lib/mesomon/storage';
import { acquireFileWriter, type FileWriterLease } from '@/lib/mesomon/writer';
import type { MesomonSaveV1 } from '@/lib/mesomon/types';

export type MesomonSaveStatus = 'saving' | 'saved' | 'offline' | 'attention' | 'local';
interface SaveScope { userId?: string | null; clubId?: string | null; slot: 1 | 2 | 3; }
interface SaveConflict { local: MesomonSaveV1; cloud: MesomonSaveV1 | null; }
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const message = (failure: unknown) => {
  const error = failure && typeof failure === 'object' ? failure as { code?: string; message?: unknown } : null;
  if (error?.code && ['PGRST205', 'PGRST202', '42P01', '42883'].includes(error.code)) return 'Cloud saves are not available yet. Your chapter is saved on this device.';
  if (error?.code === '42501' && typeof error.message === 'string' && error.message.includes('account changed')) return 'Your sign-in changed. Reload the game before syncing. Your device save is safe.';
  if (error?.code === '42501') return 'Cloud saves need Mesomon enabled in your active club. Your device save is safe.';
  return failure instanceof Error ? failure.message : typeof error?.message === 'string' ? error.message : 'Cloud save unavailable. Your game is saved on this device.';
};
const requestId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const value = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};
interface CloudResponse { data: unknown; error: unknown; }
interface SaveClient {
  rpc(name: 'mesomon_save', args: { p_club_id: string; p_slot: number; p_expected_revision: number; p_request_id: string; p_state: MesomonSaveV1; p_expected_user_id: string }): PromiseLike<CloudResponse>;
  from(name: 'mesomon_save_slots'): { select(fields: string): { eq(field: string, value: string): { eq(field: string, value: number): { maybeSingle(): PromiseLike<CloudResponse> } } } };
}
const cloudClient = supabase as unknown as SaveClient;

export function useMesomonSave({ userId, clubId, slot }: SaveScope) {
  const [save, setSave] = useState<MesomonSaveV1 | null>(null), [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MesomonSaveStatus>('local'), [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false), [blockReason, setBlockReason] = useState<string | null>(null);
  const blockedRef = useRef(false);
  const deviceWriteFailed = useRef(false);
  const acquiring = useRef<{ key: string; generation: number; promise: Promise<FileWriterLease | null> } | null>(null);
  const writer = useRef<(FileWriterLease & { key: string; userId?: string | null; slot: 1 | 2 | 3 }) | null>(null);
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const envelope = useRef<LocalSaveEnvelope | null>(null), cloudConflict = useRef<CloudSave | null>(null);
  const conflicted = useRef(false), generation = useRef(0), inFlight = useRef<Promise<void> | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const hasCloud = !!userId && !!clubId;

  const block = useCallback((reason: string, branch?: LocalSaveEnvelope | null) => {
    if (branch && (branch.dirty || branch.pending)) preserveBlockedBranch(userId, slot, branch);
    blockedRef.current = true; setBlocked(true); setBlockReason(reason); setStatus('attention'); setError(reason);
    if (debounce.current) clearTimeout(debounce.current);
  }, [userId, slot]);
  const currentParent = useCallback((branch?: LocalSaveEnvelope) => {
    if (blockedRef.current) return false;
    const current = envelope.current, head = readCachedLocalSave(userId, slot);
    if (head && (!current || head.writtenAt !== current.writtenAt)) {
      block('This file changed in another tab. Reload the latest file or choose another file.', branch ?? current);
      return false;
    }
    return true;
  }, [userId, slot, block]);
  const persist = useCallback((value: LocalSaveEnvelope): boolean => {
    if (!currentParent(value)) return false;
    const ticket = generation.current;
    const durable = writeLocalSave(userId, slot, value); // stamps before either store
    envelope.current = value;
    void durable.then(saved => {
      if (ticket !== generation.current || envelope.current !== value) return;
      deviceWriteFailed.current = !saved;
      if (!saved) { setError('Device storage is unavailable. Keep this page open and try Save again.'); setStatus('attention'); }
    });
    return true;
  }, [userId, slot, currentParent]);

  const showConflict = useCallback((cloud: CloudSave | null) => {
    const current = envelope.current;
    cloudConflict.current = cloud; conflicted.current = true;
    if (current) setConflict({ local: current.save, cloud: cloud?.state ?? null });
    setStatus('attention'); setError('Another save is available. Choose which chapter to keep.');
  }, []);

  const flush = useCallback((): Promise<void> => {
    if (blockedRef.current) return Promise.resolve();
    if (inFlight.current) return inFlight.current;
    const ticket = generation.current;
    const work = async () => {
      if (deviceWriteFailed.current && envelope.current) {
        const current = envelope.current;
        if (!currentParent()) return;
        const durable = await writeLocalSave(userId, slot, current);
        if (ticket !== generation.current || current !== envelope.current) return;
        deviceWriteFailed.current = !durable;
        if (!durable && !hasCloud) return;
        if (durable) setError(null);
      }
      if (!envelope.current || !hasCloud) { setStatus(online() ? 'local' : 'offline'); return; }
      if (conflicted.current) return;
      if (!online()) { setStatus('offline'); return; }
      // At most two writes: first acknowledge an uncertain old request, then
      // save newer movement. Continued play is handled by the next debounce.
      for (let pass = 0; pass < 2; pass++) {
        const current = envelope.current;
        if (!current || (!current.dirty && !current.pending) || ticket !== generation.current) break;
        const pending = current.pending ?? { requestId: requestId(), expectedRevision: current.cloudRevision, state: current.save };
        if (!persist({ ...current, pending, writtenAt: Date.now() })) return;
        setStatus('saving'); setError(null);
        try {
          const result = await withTimeout(cloudClient.rpc('mesomon_save', { p_club_id: clubId!, p_slot: slot, p_expected_revision: pending.expectedRevision, p_request_id: pending.requestId, p_state: pending.state, p_expected_user_id: userId! }), QUERY_TIMEOUT_MS, 'Mesomon cloud save');
          if (ticket !== generation.current) return;
          if (result.error) throw result.error;
          const raw = result.data as Record<string, unknown> | null;
          if (!raw || typeof raw !== 'object' || typeof raw.conflict !== 'boolean') throw new Error('Cloud save returned an unreadable response. Try Save again.');
          const cloud = raw.save === null ? null : parseCloudSave(raw.save);
          if (raw.save !== null && (!cloud || cloud.slot !== slot)) {
            archiveCorruptSave(userId, slot, raw.save, 'cloud');
            throw new Error('Cloud save needs attention. The valid save on this device is preserved.');
          }
          if (raw.conflict) { showConflict(cloud); return; }
          if (!cloud) throw new Error('Cloud save did not acknowledge this chapter. Try Save again.');
          const latest = envelope.current;
          if (!latest) return;
          const dirty = saveFingerprint(latest.save) !== saveFingerprint(pending.state);
          if (!persist({ ...latest, cloudRevision: cloud.revision, cloudUpdatedAt: cloud.updated_at, pending: null, dirty, writtenAt: Date.now() })) return;
          setStatus(dirty ? 'saving' : 'saved');
        } catch (failure) {
          if (ticket !== generation.current) return;
          setError(message(failure)); setStatus(online() ? 'attention' : 'offline'); return;
        }
      }
      if (envelope.current?.dirty && ticket === generation.current && !conflicted.current) {
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(() => void flushRef.current(), 1400);
      }
    };
    const promise = work().catch(failure => { if (ticket === generation.current) { setError(message(failure)); setStatus(online() ? 'attention' : 'offline'); } }).finally(() => { if (inFlight.current === promise) inFlight.current = null; });
    inFlight.current = promise; return promise;
  }, [hasCloud, clubId, slot, userId, persist, showConflict, currentParent]);
  flushRef.current = flush;

  const saveLocal = useCallback((input: MesomonSaveV1) => {
    if (blockedRef.current || !currentParent()) return;
    const valid = migrateSave(input);
    if (!valid || valid.slot !== slot) { setError('This chapter could not be saved. The last valid save is preserved.'); setStatus('attention'); return; }
    const old = envelope.current;
    const changed = !old || saveFingerprint(old.save) !== saveFingerprint(valid);
    if (!changed) return;
    valid.savedAt = new Date().toISOString();
    const next = old ? { ...old, save: valid, dirty: true, writtenAt: Date.now() } : freshEnvelope(valid);
    if (!persist(next)) return;
    setSave(valid);
    if (conflicted.current) { setConflict(current => current ? { ...current, local: valid } : current); return; }
    setStatus(!online() ? 'offline' : hasCloud ? 'saving' : 'local');
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void flushRef.current(), 1400);
  }, [slot, persist, hasCloud, currentParent]);

  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    blockedRef.current = true; deviceWriteFailed.current = false;
    if (debounce.current) clearTimeout(debounce.current);
    envelope.current = null; inFlight.current = null; conflicted.current = false; cloudConflict.current = null;
    setSave(null); setConflict(null); setError(null); setLoading(true);
    const key = saveStorageKey(userId, slot);
    if (writer.current && writer.current.key !== key) {
      const old = writer.current; writer.current = null;
      await waitForLocalWrites(old.userId, old.slot); old.release();
      if (ticket !== generation.current) return;
    }
    let lease = writer.current?.key === key ? writer.current : null;
    if (!lease) {
      let pending = acquiring.current;
      if (!pending || pending.key !== key) { pending = { key, generation: ticket, promise: acquireFileWriter(key) }; acquiring.current = pending; }
      else pending.generation = ticket;
      const acquired = await pending.promise;
      if (ticket !== generation.current) { if (pending.generation === ticket) acquired?.release(); return; }
      if (acquiring.current === pending) acquiring.current = null;
      if (!acquired) {
        block('This file is open in another tab. Close that tab, then reload this file, or choose another file.');
        const preview = await readLocalSave(userId, slot);
        if (ticket === generation.current) { envelope.current = preview; setSave(preview?.save ?? null); setLoading(false); }
        return;
      }
      lease = { ...acquired, key, userId, slot }; writer.current = lease;
    }
    const local = await readLocalSave(userId, slot);
    if (ticket !== generation.current) return;
    envelope.current = local; if (local) setSave(local.save);
    blockedRef.current = false; setBlocked(false); setBlockReason(null);
    setLoading(false); setStatus(!online() ? 'offline' : hasCloud ? local?.dirty ? 'saving' : 'saved' : 'local');
    if (!userId || !clubId || !online()) return;
    try {
      const result = await withTimeout(cloudClient.from('mesomon_save_slots').select('state,revision,updated_at,slot').eq('user_id', userId).eq('slot', slot).maybeSingle(), QUERY_TIMEOUT_MS, 'Mesomon cloud load');
      if (ticket !== generation.current) return;
      if (result.error) throw result.error;
      if (!result.data) { if (envelope.current?.cloudRevision) showConflict(null); else if (envelope.current?.dirty) void flushRef.current(); return; }
      const cloud = parseCloudSave(result.data);
      if (!cloud || cloud.slot !== slot) { archiveCorruptSave(userId, slot, result.data, 'cloud'); throw new Error('Cloud save is unreadable. Your last valid device save is preserved.'); }
      const current = envelope.current;
      if (!current) { const restored = envelopeFromCloud(cloud); if (!persist(restored)) return; setSave(restored.save); setStatus('saved'); return; }
      if (current.pending) { void flushRef.current(); return; }
      if (cloud.revision !== current.cloudRevision || (!current.dirty && saveFingerprint(cloud.state) !== saveFingerprint(current.save))) { showConflict(cloud); return; }
      if (current.dirty || current.pending) void flushRef.current(); else setStatus('saved');
    } catch (failure) {
      if (ticket !== generation.current) return;
      setError(message(failure)); setStatus(online() ? 'attention' : 'offline');
    }
  }, [userId, clubId, slot, hasCloud, persist, showConflict, block]);

  const retry = useCallback(async () => {
    const current = envelope.current;
    if (blockedRef.current || !current || (hasCloud && !current.dirty && !current.pending && !deviceWriteFailed.current)) await reload();
    else await flushRef.current();
  }, [reload, hasCloud]);
  const useCloud = useCallback(async () => {
    const cloud = cloudConflict.current;
    if (!cloud) { setError('There is no cloud chapter to restore. Keep the device save to continue.'); return; }
    const value = envelopeFromCloud(cloud); conflicted.current = false; cloudConflict.current = null;
    if (!persist(value)) return;
    setSave(value.save); setConflict(null); setError(null); setStatus('saved');
  }, [persist]);
  const keepLocal = useCallback(async () => {
    const local = envelope.current; if (!local) return;
    const cloud = cloudConflict.current;
    // This is the only intentional overwrite path and requires an explicit
    // player choice after displaying both saves. The server still uses CAS.
    if (!persist({ ...local, cloudRevision: cloud?.revision ?? 0, cloudUpdatedAt: cloud?.updated_at ?? null, pending: null, dirty: true, writtenAt: Date.now() })) return;
    conflicted.current = false; cloudConflict.current = null; setConflict(null); setError(null);
    if (inFlight.current) await inFlight.current;
    await flushRef.current();
  }, [persist]);

  const invalidate = useCallback(() => {
    const ended = ++generation.current; blockedRef.current = true; if (debounce.current) clearTimeout(debounce.current);
    // React Strict Mode immediately remounts effects; let that reload reuse the
    // reservation rather than competing with its own not-yet-released lock.
    queueMicrotask(() => {
      if (generation.current !== ended) return;
      const lease = writer.current; writer.current = null;
      if (lease) void waitForLocalWrites(lease.userId, lease.slot).finally(lease.release);
    });
  }, []);
  useEffect(() => { void reload(); return invalidate; }, [reload, invalidate]);
  useEffect(() => {
    const background = () => { if (!currentParent()) return; if (document.visibilityState === 'hidden') void flushRef.current(); };
    const recovered = () => { if (currentParent() && envelope.current && !conflicted.current) void flushRef.current(); };
    const disconnected = () => setStatus('offline');
    const external = (event: StorageEvent) => {
      if (event.key !== saveStorageKey(userId, slot) || !event.newValue || !envelope.current) return;
      // The shared local head changes even while both tabs are offline. Stop
      // before the next tick can publish an older chapter over that head.
      currentParent();
    };
    document.addEventListener('visibilitychange', background); window.addEventListener('online', recovered); window.addEventListener('offline', disconnected); window.addEventListener('storage', external); window.addEventListener('focus', recovered);
    return () => { document.removeEventListener('visibilitychange', background); window.removeEventListener('online', recovered); window.removeEventListener('offline', disconnected); window.removeEventListener('storage', external); window.removeEventListener('focus', recovered); };
  }, [userId, slot, currentParent]);
  return { blocked, blockReason, save, loading, status, error, conflict, saveLocal, flush, retry, useCloud, keepLocal, reload };
}

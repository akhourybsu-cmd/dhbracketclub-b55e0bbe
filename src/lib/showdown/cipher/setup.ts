import { validateCode } from './engine';
import { CIPHER_COLOR_IDS, type CipherCode, type CipherDraft } from './types';

export type CipherDeviceStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const blankCipherDraft = (): CipherDraft => [null, null, null, null];
export function validateCipherDraft(value: unknown): asserts value is CipherDraft {
  if (!Array.isArray(value) || value.length !== 4 || Array.from(value).some(color => color !== null && !(CIPHER_COLOR_IDS as readonly unknown[]).includes(color))) throw new Error('Choose four colors using the peg palette.');
}
export const validRequestId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const sameCipherCode = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((color, index) => color === b[index]);
interface SetupSnapshot { draft: CipherDraft; pendingCode: CipherCode | null }
interface SetupCache { version: 1; draft: CipherDraft; pending: { requestId: string; code: CipherCode } | null }

/** Only the creator's draft and retry identity are saved; no challenge exists yet. */
export class CipherSetupSession {
  private active = true;
  private pending: SetupCache['pending'] = null;
  private state: SetupSnapshot = { draft: blankCipherDraft(), pendingCode: null };
  private listeners = new Set<() => void>();
  constructor(private readonly key: string, private readonly storage: CipherDeviceStore | null) {
    try {
      const cached = JSON.parse(storage?.getItem(key) ?? 'null') as SetupCache | null;
      if (cached?.version === 1) {
        validateCipherDraft(cached.draft);
        if (cached.pending) { validateCode(cached.pending.code); if (!validRequestId(cached.pending.requestId)) throw new Error('Invalid request identity'); this.pending = cached.pending; }
        this.state = { draft: this.pending ? [...this.pending.code] : [...cached.draft], pendingCode: this.pending?.code ?? null };
      }
    } catch { /* Invalid or unavailable device storage never starts a challenge. */ }
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  activate = () => { this.active = true; };
  dispose = () => { this.active = false; };
  private publish() { if (this.active) this.listeners.forEach(listener => listener()); }
  private persist() { try { this.storage?.setItem(this.key, JSON.stringify({ version: 1, draft: this.state.draft, pending: this.pending } satisfies SetupCache)); } catch { /* Same-session request identities remain stable. */ } }
  changeDraft = (draft: CipherDraft) => {
    if (!this.active || this.pending) return;
    validateCipherDraft(draft); this.state = { draft: [...draft], pendingCode: null }; this.persist(); this.publish();
  };
  prepare = (code: CipherCode) => {
    if (!this.active) throw new Error('This club session changed. Reopen the code maker.');
    validateCode(code);
    if (this.pending && !sameCipherCode(this.pending.code, code)) throw new Error('Your previous lock request still needs confirmation. Retry that same code first.');
    this.pending ??= { requestId: crypto.randomUUID(), code: [...code] };
    this.state = { draft: [...this.pending.code], pendingCode: [...this.pending.code] }; this.persist(); this.publish();
    return { requestId: this.pending.requestId, code: [...this.pending.code] as CipherCode };
  };
  complete = () => {
    if (!this.active) return;
    this.pending = null; this.state = { draft: blankCipherDraft(), pendingCode: null };
    try { this.storage?.removeItem(this.key); } catch { /* The successful server receipt remains authoritative. */ }
    this.publish();
  };
}

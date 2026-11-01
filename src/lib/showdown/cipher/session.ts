import { validateCode } from './engine';
import { blankCipherDraft, sameCipherCode, validRequestId, validateCipherDraft, type CipherDeviceStore } from './setup';
import type { CipherCode, CipherDraft, CipherView } from './types';
import type { CipherCodeInput, CipherGuessInput, CipherSurrenderInput, ShowdownMatchDetail, ShowdownSaveState } from '../types';
import { sameJSONState } from '../stateEquality';
import { ShowdownError } from '../service';

type Pending = ({ kind: 'lock' } & CipherCodeInput) | ({ kind: 'guess' } & CipherGuessInput) | ({ kind: 'surrender' } & CipherSurrenderInput);
interface Cached { version: 1; count: number; draft: CipherDraft; pending: Pending | null }
export interface CipherSessionState {
  draft: CipherDraft; pendingCode: CipherCode | null; busy: boolean; submitting: boolean;
  saveState: ShowdownSaveState; error: string | null; blocked: boolean;
}
export interface CipherSessionClient {
  fetch: () => Promise<ShowdownMatchDetail>;
  lock: (input: CipherCodeInput) => Promise<ShowdownMatchDetail>;
  guess: (input: CipherGuessInput) => Promise<ShowdownMatchDetail>;
  surrender: (input: CipherSurrenderInput) => Promise<ShowdownMatchDetail>;
}
const closed = new Set(['completed', 'declined', 'cancelled', 'expired']);
const finished = (view: CipherView) => ['solved', 'exhausted', 'surrendered'].includes(view.own_attempt.status);
const isPrefix = (before: CipherView, after: CipherView) => before.own_guesses.length <= after.own_guesses.length
  && before.own_guesses.every((guess, index) => sameJSONState(guess, after.own_guesses[index]));

/** Explicit, durable game actions; editable drafts never consume a ranked guess. */
export class CipherSession {
  private detail: ShowdownMatchDetail | null = null;
  private pending: Pending | null = null;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = true;
  private listeners = new Set<() => void>();
  private state: CipherSessionState = { draft: blankCipherDraft(), pendingCode: null, busy: false, submitting: false, saveState: 'saved', error: null, blocked: false };
  constructor(private readonly challengeId: string, private readonly storageKey: string, private readonly storage: CipherDeviceStore | null,
    private readonly client: CipherSessionClient, private readonly onDetail: (detail: ShowdownMatchDetail) => void) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  activate = () => { this.active = true; };
  dispose = () => { this.active = false; clearTimeout(this.timer); };
  private publish(patch: Partial<CipherSessionState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  private read(): Cached | null {
    try {
      const cache = JSON.parse(this.storage?.getItem(this.storageKey) ?? 'null') as Cached | null;
      if (cache?.version !== 1 || !Number.isInteger(cache.count) || cache.count < 0 || cache.count > 10) return null;
      validateCipherDraft(cache.draft);
      if (cache.pending) {
        const p = cache.pending;
        if (p.challengeId !== this.challengeId || !validRequestId(p.requestId)) return null;
        if (p.kind === 'lock') validateCode(p.code);
        else if (p.kind === 'guess' || p.kind === 'surrender') {
          if (!Number.isInteger(p.expectedGuessCount) || p.expectedGuessCount < 0 || p.expectedGuessCount > 9) return null;
          if (p.kind === 'guess') validateCode(p.guess);
        } else return null;
      }
      return cache;
    } catch { return null; }
  }
  private persist() {
    const view = this.detail?.cipher;
    if (!view || closed.has(this.detail!.challenge.status) || finished(view)) return;
    try { this.storage?.setItem(this.storageKey, JSON.stringify({ version: 1, count: view.own_guesses.length, draft: this.state.draft, pending: this.pending } satisfies Cached)); } catch { /* Explicit actions still retain in-memory receipt identities. */ }
  }
  private clear() { try { this.storage?.removeItem(this.storageKey); } catch { /* Device storage may be disabled. */ } }
  accept(detail: ShowdownMatchDetail): boolean {
    if (!this.active || detail.challenge.id !== this.challengeId || detail.challenge.game_key !== 'cipher_duel' || !detail.cipher) return false;
    const incoming = detail.cipher, prior = this.detail?.cipher;
    if (this.detail && closed.has(this.detail.challenge.status) && detail.challenge.status !== this.detail.challenge.status) return false;
    if (prior && (!isPrefix(prior, incoming) || prior.own_code && (!incoming.own_code || !sameCipherCode(prior.own_code, incoming.own_code))
      || prior.opponent_code_locked && !incoming.opponent_code_locked || prior.opponent_finished && !incoming.opponent_finished
      || finished(prior) && !finished(incoming))) return false;
    let draft = this.state.draft;
    let conflict = false;
    if (!prior) {
      const cache = this.read();
      if (cache) {
        if (cache.count === incoming.own_guesses.length) draft = cache.draft;
        this.pending = cache.pending;
      }
    }
    if (this.pending?.kind === 'lock' && incoming.own_code) {
      conflict = !sameCipherCode(this.pending.code, incoming.own_code);
      this.pending = null; draft = blankCipherDraft();
    } else if (this.pending?.kind === 'guess' && incoming.own_guesses.length > this.pending.expectedGuessCount) {
      conflict = !sameCipherCode(this.pending.guess, incoming.own_guesses[this.pending.expectedGuessCount].colors);
      this.pending = null; draft = blankCipherDraft();
    }
    if (prior && incoming.own_guesses.length > prior.own_guesses.length) draft = blankCipherDraft();
    if (prior && !prior.own_code && incoming.own_code) draft = blankCipherDraft();
    this.detail = detail;
    if (closed.has(detail.challenge.status) || finished(incoming)) {
      this.pending = null; this.clear(); clearTimeout(this.timer);
      this.publish({ draft: blankCipherDraft(), pendingCode: null, busy: false, submitting: false, saveState: 'saved', error: null, blocked: true }); return true;
    }
    const pendingCode = this.pending?.kind === 'lock' ? this.pending.code : null;
    this.publish({ draft: pendingCode ? [...pendingCode] : draft, pendingCode, blocked: false,
      busy: !!this.pending && !!this.running, submitting: !!this.pending && !!this.running,
      saveState: this.pending ? 'saving' : 'saved',
      error: conflict ? 'Another device saved this move first. The confirmed code and guess history have been restored.' : null });
    this.persist();
    if (this.pending && !this.running) { clearTimeout(this.timer); this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 80); }
    return true;
  }
  changeDraft = (draft: CipherDraft) => {
    if (!this.active || !this.detail?.cipher || this.pending || this.state.blocked) return;
    if (!['create_code', 'codebreaking'].includes(this.detail.cipher.phase)) return;
    validateCipherDraft(draft); this.publish({ draft: [...draft], error: null, saveState: 'saved' }); this.persist();
  };
  lockCode = async (code: CipherCode) => {
    validateCode(code);
    if (!this.active || !this.detail?.cipher || this.state.blocked) throw new ShowdownError('This invitation is no longer active.', 'closed');
    if (this.detail.cipher.own_code) return;
    if (this.pending && (this.pending.kind !== 'lock' || !sameCipherCode(this.pending.code, code))) throw new ShowdownError('Retry your original locked code before choosing another.', 'rule');
    this.pending ??= { kind: 'lock', challengeId: this.challengeId, code: [...code], requestId: crypto.randomUUID() };
    this.publish({ pendingCode: [...code], draft: [...code], saveState: 'saving', error: null }); this.persist(); await this.flush();
  };
  submitGuess = async () => {
    if (!this.active || this.detail?.cipher?.phase !== 'codebreaking' || this.state.blocked) throw new ShowdownError('This duel is not ready for a guess.', 'rule');
    if (!this.pending) {
      validateCode(this.state.draft);
      this.pending = { kind: 'guess', challengeId: this.challengeId, guess: [...this.state.draft], expectedGuessCount: this.detail.cipher.own_guesses.length, requestId: crypto.randomUUID() };
    } else if (this.pending.kind !== 'guess') throw new ShowdownError('Finish syncing your previous action first.', 'rule');
    this.publish({ saveState: 'saving', error: null }); this.persist(); await this.flush();
  };
  surrender = async () => {
    if (!this.active || this.detail?.cipher?.phase !== 'codebreaking' || this.state.blocked) throw new ShowdownError('This attempt is no longer open.', 'closed');
    if (!this.pending) this.pending = { kind: 'surrender', challengeId: this.challengeId, expectedGuessCount: this.detail.cipher.own_guesses.length, requestId: crypto.randomUUID() };
    else if (this.pending.kind !== 'surrender') throw new ShowdownError('Finish syncing your previous guess before surrendering.', 'rule');
    this.publish({ saveState: 'saving', error: null }); this.persist(); await this.flush();
  };
  refresh = async () => { const detail = await this.client.fetch(); if (this.accept(detail)) this.onDetail(detail); };
  retry = () => this.pending ? this.flush() : this.refresh();
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.running) return this.running.then(() => { if (this.active && this.pending) return this.flush(); });
    const work = this.drain().finally(() => { if (this.running === work) this.running = null; }); this.running = work; return work;
  };
  private async drain() {
    while (this.active && this.pending && !this.state.blocked) {
      const operation = this.pending;
      this.publish({ busy: true, submitting: true, saveState: 'saving', error: null });
      try {
        const detail = operation.kind === 'lock' ? await this.client.lock(operation) : operation.kind === 'guess' ? await this.client.guess(operation) : await this.client.surrender(operation);
        if (!this.active) return;
        if (this.accept(detail)) this.onDetail(detail);
        const view = detail.cipher;
        const accepted = view && (operation.kind === 'lock' ? !!view.own_code
          : operation.kind === 'guess' ? view.own_guesses.length > operation.expectedGuessCount && sameCipherCode(view.own_guesses[operation.expectedGuessCount].colors, operation.guess)
          : finished(view));
        if (!accepted) throw new ShowdownError(detail.readonly_reason || 'This challenge closed before your action could be accepted.', 'closed');
        if (this.pending === operation) this.pending = null;
        this.persist();
      } catch (error) {
        if (!this.active) throw error;
        // A reply from a request already confirmed by polling cannot consume or
        // clear a later guess's draft or request identity.
        if (this.pending !== operation && !(error instanceof ShowdownError && error.code === 'closed')) continue;
        if (error instanceof ShowdownError && ['conflict', 'rule', 'access'].includes(error.code)) {
          try { const detail = await this.client.fetch(); if (this.accept(detail)) this.onDetail(detail); } catch { /* Retain the original retryable error. */ }
        }
        if (error instanceof ShowdownError && error.code === 'conflict' && this.pending === operation) this.pending = null;
        this.publish({ busy: false, submitting: false, pendingCode: this.pending?.kind === 'lock' ? this.pending.code : null,
          saveState: this.pending ? 'offline' : 'saved', blocked: error instanceof ShowdownError && ['closed', 'access'].includes(error.code) || this.state.blocked,
          error: error instanceof Error ? error.message : 'Your action is kept on this device. Retry to confirm it.' });
        this.persist(); throw error;
      }
    }
    this.publish({ busy: false, submitting: false, saveState: 'saved' });
  }
}

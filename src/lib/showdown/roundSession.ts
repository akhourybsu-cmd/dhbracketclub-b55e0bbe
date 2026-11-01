import { replayActions } from './prism/engine';
import type { PrismAction } from './prism/types';
import { ShowdownError } from './service';
import { sameJSONState } from './stateEquality';
import type { ShowdownMatchDetail, ShowdownRound, ShowdownRoundInput, ShowdownSaveState } from './types';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface Pending extends ShowdownRoundInput { kind: 'save' | 'submit'; skip: boolean }
interface Finish { actions: PrismAction[]; skip: boolean }
interface CachedRound { version: 1; round: number; puzzleId: string; puzzleVersion: number; actions: PrismAction[]; pending: Pending | null; finish: Finish | null }
export interface RoundSessionSnapshot { actions: PrismAction[]; saveState: ShowdownSaveState; error: string | null; submitting: boolean; blocked: boolean }
export interface RoundSessionClient {
  fetch: () => Promise<ShowdownMatchDetail>;
  save: (input: ShowdownRoundInput) => Promise<ShowdownMatchDetail>;
  submit: (input: ShowdownRoundInput, skip: boolean) => Promise<ShowdownMatchDetail>;
}
const equal = sameJSONState;
const prefix = (a: PrismAction[], b: PrismAction[]) => a.length <= b.length && a.every((action, i) => equal(action, b[i]));

/** A durable, serialized outbox. Every retry retains its original server request identity. */
export class ShowdownRoundSession {
  private detail: ShowdownMatchDetail | null = null;
  private round: ShowdownRound | null = null;
  private confirmed: PrismAction[] = [];
  private revision = 0;
  private pending: Pending | null = null;
  private finish: Finish | null = null;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = true;
  private listeners = new Set<() => void>();
  private snapshot: RoundSessionSnapshot = { actions: [], saveState: 'saved', error: null, submitting: false, blocked: false };

  constructor(private readonly challengeId: string, private readonly storageKey: string, private readonly storage: Store | null,
    private readonly client: RoundSessionClient, private readonly onDetail: (detail: ShowdownMatchDetail) => void) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  activate = () => { this.active = true; };
  dispose = () => { this.active = false; clearTimeout(this.timer); };
  private publish(patch: Partial<RoundSessionSnapshot>) {
    if (!this.active) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private read(): CachedRound | null {
    try {
      const value = JSON.parse(this.storage?.getItem(this.storageKey) ?? 'null') as CachedRound | null;
      return value?.version === 1 && Array.isArray(value.actions) ? value : null;
    } catch { return null; }
  }
  private persist() {
    if (!this.round || !this.detail?.can_play) return;
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify({ version: 1, round: this.round.round_number,
        puzzleId: this.round.puzzle_id, puzzleVersion: this.round.puzzle_version,
        actions: this.snapshot.actions, pending: this.pending, finish: this.finish } satisfies CachedRound));
    } catch { /* Server autosave remains available when device storage is full or disabled. */ }
  }
  private clear() { try { this.storage?.removeItem(this.storageKey); } catch { /* Storage may be disabled. */ } }

  accept(detail: ShowdownMatchDetail, forceServer = false) {
    if (!this.active || detail.challenge.id !== this.challengeId) return false;
    const terminal = new Set(['completed', 'declined', 'cancelled', 'expired']);
    const submitted = detail.rounds.filter(round => round.me.submitted).length;
    const priorSubmitted = this.detail?.rounds.filter(round => round.me.submitted).length ?? 0;
    if (submitted < priorSubmitted || this.detail && terminal.has(this.detail.challenge.status)
      && detail.challenge.status !== this.detail.challenge.status) return false;
    const incoming = detail.rounds.find(round => round.round_number === detail.current_round) ?? null;
    const same = incoming && this.round && incoming.round_number === this.round.round_number
      && incoming.puzzle_id === this.round.puzzle_id && incoming.puzzle_version === this.round.puzzle_version;
    if (same && incoming.me.revision < this.revision) return false;
    const previous = this.round;
    this.detail = detail;
    this.round = incoming;
    if (!detail.can_play || !incoming?.puzzle || incoming.me.submitted) {
      this.pending = null; this.finish = null; clearTimeout(this.timer); this.clear();
      this.publish({ actions: incoming?.me.actions ?? [], saveState: 'saved', submitting: false, blocked: !detail.can_play, error: null });
      return true;
    }
    this.confirmed = incoming.me.actions;
    this.revision = incoming.me.revision;
    let desired = same ? this.snapshot.actions : incoming.me.actions;
    if (!same) {
      this.pending = null; this.finish = null;
      const cached = this.read();
      if (cached?.round === incoming.round_number && cached.puzzleId === incoming.puzzle_id && cached.puzzleVersion === incoming.puzzle_version) {
        try {
          replayActions(incoming.puzzle, cached.actions);
          desired = cached.actions;
          if (cached.pending && cached.pending.challengeId === this.challengeId && cached.pending.roundNumber === incoming.round_number
            && Number.isInteger(cached.pending.expectedRevision) && cached.pending.expectedRevision >= 0
            && typeof cached.pending.skip === 'boolean' && typeof cached.pending.requestId === 'string'
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cached.pending.requestId)
            && ['save','submit'].includes(cached.pending.kind) && Array.isArray(cached.pending.actions) && prefix(cached.pending.actions, desired)) this.pending = cached.pending;
          if (cached.finish && Array.isArray(cached.finish.actions) && equal(cached.finish.actions, desired) && typeof cached.finish.skip === 'boolean') this.finish = cached.finish;
        } catch { desired = incoming.me.actions; }
      } else if (previous) this.clear();
    }
    let conflict = false;
    if (forceServer || !prefix(this.confirmed, desired)) {
      conflict = !equal(desired, this.confirmed);
      desired = this.confirmed; this.pending = null; this.finish = null;
    }
    this.publish({ actions: desired, blocked: false, submitting: !!this.finish,
      saveState: equal(desired, this.confirmed) && !this.pending && !this.finish ? 'saved' : 'saving',
      error: conflict ? 'A newer save from another device was restored. Continue from these saved moves.' : null });
    this.persist();
    if (!equal(desired, this.confirmed) || this.pending || this.finish) this.schedule();
    return true;
  }

  changeActions = (actions: PrismAction[]) => {
    if (!this.active || !this.detail?.can_play || !this.round?.puzzle || this.finish || this.snapshot.blocked) return;
    try {
      if (!prefix(this.snapshot.actions, actions)) throw new ShowdownError('Saved moves cannot be removed. Use Reset to restore the board while keeping rotations.', 'rule');
      replayActions(this.round.puzzle, actions);
      this.publish({ actions: [...actions], saveState: 'saving', error: null });
      this.persist(); this.schedule();
    } catch (error) { this.publish({ error: error instanceof Error ? error.message : 'This move is not available.' }); }
  };
  private schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 240); }

  submit = async (actions: PrismAction[], outcome: 'solved' | 'skipped') => {
    if (!this.active || !this.round?.puzzle || !this.detail?.can_play || this.snapshot.blocked) throw new ShowdownError(this.detail?.readonly_reason || 'This challenge is no longer active.', 'rule');
    const replay = replayActions(this.round.puzzle, actions);
    if (outcome === 'solved' && !replay.solved) throw new ShowdownError('Light every receiver before submitting, or skip this puzzle.', 'rule');
    if (!equal(actions, this.snapshot.actions)) throw new ShowdownError('The moves changed before submission. Retry from the current board.', 'conflict');
    const finish = { actions: [...actions], skip: outcome === 'skipped' };
    if (this.finish && !equal(this.finish, finish)) throw new ShowdownError('A round submission is already syncing. Retry that submission first.', 'rule');
    this.finish = finish;
    this.publish({ submitting: true, saveState: 'saving', error: null });
    this.persist();
    await this.flush();
  };
  retry = () => this.flush();

  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.running) return this.running.then(() => {
      if (this.active && (this.pending || this.finish || !equal(this.snapshot.actions, this.confirmed))) return this.flush();
    });
    const promise = this.drain().finally(() => { if (this.running === promise) this.running = null; });
    this.running = promise;
    return promise;
  };
  private async drain() {
    while (this.active && this.detail?.can_play && this.round?.puzzle && !this.snapshot.blocked) {
      const roundNumber = this.round.round_number;
      if (!this.pending) {
        const mustSave = !equal(this.snapshot.actions, this.confirmed);
        if (!mustSave && !this.finish) { this.publish({ saveState: 'saved', error: null, submitting: false }); return; }
        // Submission itself verifies the complete replay, so it can atomically save its last unsynced moves.
        const kind = this.finish ? 'submit' : 'save';
        this.pending = { challengeId: this.challengeId, roundNumber, expectedRevision: this.revision,
          actions: [...(this.finish?.actions ?? this.snapshot.actions)], requestId: crypto.randomUUID(), kind, skip: this.finish?.skip ?? false };
        this.persist();
      }
      const operation = this.pending;
      this.publish({ saveState: 'saving', error: null });
      try {
        const detail = operation.kind === 'submit' ? await this.client.submit(operation, operation.skip) : await this.client.save(operation);
        if (!this.active) return;
        const acknowledged = detail.rounds.find(round => round.round_number === roundNumber);
        if (operation.kind === 'submit' && !acknowledged?.me.submitted) {
          this.pending = null; this.finish = null; if (this.accept(detail, true)) this.onDetail(detail);
          throw new ShowdownError(detail.readonly_reason || 'This challenge closed before the round could be submitted.', 'closed');
        }
        if (this.pending === operation) this.pending = null;
        if (operation.kind === 'submit' && this.round?.round_number === roundNumber) this.finish = null;
        if (this.accept(detail)) this.onDetail(detail);
      } catch (error) {
        if (!this.active) throw error;
        // A response from a retired round cannot discard the next round's outbox.
        if (this.round?.round_number !== operation.roundNumber && !(error instanceof ShowdownError && error.code === 'closed')) {
          if (this.pending === operation) this.pending = null;
          continue;
        }
        if (error instanceof ShowdownError && error.code === 'conflict') {
          this.pending = null; this.finish = null;
          try { const detail = await this.client.fetch(); if (this.accept(detail, true)) this.onDetail(detail); } catch { /* Keep the retryable error if refresh also fails. */ }
        }
        this.publish({ saveState: 'offline', submitting: false,
          blocked: error instanceof ShowdownError && ['access','closed'].includes(error.code),
          error: error instanceof Error ? error.message : 'The save could not be confirmed. Retry to sync your moves.' });
        this.persist();
        throw error;
      }
    }
  }
}

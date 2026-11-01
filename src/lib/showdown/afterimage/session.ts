import { validatePlacements } from './engine';
import type { AfterimagePlacement } from './types';
import type { ShowdownMatchDetail, ShowdownReconstructionInput, ShowdownRound, ShowdownSaveState } from '../types';
import { ShowdownError } from '../service';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface Pending extends ShowdownReconstructionInput { kind: 'save' | 'submit' }
interface Cached {
  version: 1; round: number; puzzleId: string; puzzleVersion: number; revision: number;
  confirmed: AfterimagePlacement[]; placements: AfterimagePlacement[]; pending: Pending | null;
  finish: boolean; studyRequestId: string | null;
}
export interface AfterimageSessionState {
  placements: AfterimagePlacement[]; saveState: ShowdownSaveState; error: string | null;
  submitting: boolean; starting: boolean; blocked: boolean;
}
export interface AfterimageSessionClient {
  fetch: () => Promise<ShowdownMatchDetail>;
  start: (round: number, requestId: string) => Promise<ShowdownMatchDetail>;
  save: (input: ShowdownReconstructionInput) => Promise<ShowdownMatchDetail>;
  submit: (input: ShowdownReconstructionInput) => Promise<ShowdownMatchDetail>;
}
const equal = (a: readonly AfterimagePlacement[], b: readonly AfterimagePlacement[]) => a.length === b.length
  && a.every(first => b.some(second => second.object_id === first.object_id && second.slot_id === first.slot_id));
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const terminal = new Set(['completed', 'declined', 'cancelled', 'expired']);

/** Per-game editable reconstruction outbox; invitations, authority and results stay shared. */
export class AfterimageSession {
  private detail: ShowdownMatchDetail | null = null;
  private round: ShowdownRound | null = null;
  private confirmed: AfterimagePlacement[] = [];
  private revision = 0;
  private pending: Pending | null = null;
  private finish = false;
  private studyRequestId: string | null = null;
  private running: Promise<void> | null = null;
  private studying: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = true;
  private listeners = new Set<() => void>();
  private state: AfterimageSessionState = { placements: [], saveState: 'saved', error: null, submitting: false, starting: false, blocked: false };
  constructor(private readonly challengeId: string, private readonly storageKey: string, private readonly storage: Store | null,
    private readonly client: AfterimageSessionClient, private readonly onDetail: (detail: ShowdownMatchDetail) => void) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  activate = () => { this.active = true; };
  dispose = () => { this.active = false; clearTimeout(this.timer); };
  private publish(patch: Partial<AfterimageSessionState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  private read(): Cached | null {
    try { const data = JSON.parse(this.storage?.getItem(this.storageKey) ?? 'null'); return data?.version === 1 && Array.isArray(data.placements) && Array.isArray(data.confirmed) ? data : null; } catch { return null; }
  }
  private clear() { try { this.storage?.removeItem(this.storageKey); } catch { /* Device storage may be unavailable. */ } }
  private persist() {
    if (!this.round || !this.detail?.can_play) return;
    try { this.storage?.setItem(this.storageKey, JSON.stringify({ version: 1, round: this.round.round_number, puzzleId: this.round.puzzle_id,
      puzzleVersion: this.round.puzzle_version, revision: this.revision, confirmed: this.confirmed, placements: this.state.placements,
      pending: this.pending, finish: this.finish, studyRequestId: this.studyRequestId } satisfies Cached)); } catch { /* Server autosave remains available. */ }
  }
  accept(detail: ShowdownMatchDetail, forceServer = false): boolean {
    if (!this.active || detail.challenge.id !== this.challengeId || detail.challenge.game_key !== 'afterimage') return false;
    const oldSubmitted = this.detail?.rounds.filter(round => round.me.submitted).length ?? 0;
    if (detail.rounds.filter(round => round.me.submitted).length < oldSubmitted
      || this.detail && terminal.has(this.detail.challenge.status) && detail.challenge.status !== this.detail.challenge.status) return false;
    const incoming = detail.rounds.find(round => round.round_number === detail.current_round) ?? null;
    const same = !!incoming && !!this.round && incoming.round_number === this.round.round_number && incoming.puzzle_id === this.round.puzzle_id && incoming.puzzle_version === this.round.puzzle_version;
    if (same && incoming!.me.revision < this.revision) return false;
    if (same && !terminal.has(detail.challenge.status) && incoming!.scene && this.round?.scene) {
      const phases = ['ready', 'study', 'reconstruct', 'submitted', 'review'];
      if (phases.indexOf(incoming!.scene.phase) < phases.indexOf(this.round.scene.phase)) return false;
    }
    const oldRound = this.round;
    const previousRevision = this.revision;
    this.detail = detail; this.round = incoming;
    if (!detail.can_play || !incoming?.scene || incoming.me.submitted) {
      this.pending = null; this.finish = false; this.studyRequestId = null; this.clear(); clearTimeout(this.timer);
      this.publish({ placements: [], saveState: 'saved', submitting: false, starting: false, blocked: !detail.can_play, error: null }); return true;
    }
    const server = incoming.me.placements ?? [];
    let desired = same ? this.state.placements : server;
    let conflict = false;
    const acknowledges = this.pending && this.pending.roundNumber === incoming.round_number && incoming.me.revision >= this.pending.expectedRevision
      && equal(server, this.pending.placements);
    if (!same) {
      this.pending = null; this.finish = false; this.studyRequestId = null;
      const cached = this.read();
      if (cached && cached.round === incoming.round_number && cached.puzzleId === incoming.puzzle_id && cached.puzzleVersion === incoming.puzzle_version) {
        if (uuid(cached.studyRequestId)) this.studyRequestId = cached.studyRequestId;
        if (incoming.scene.phase === 'reconstruct') {
          try {
            validatePlacements(cached.placements, incoming.scene); validatePlacements(cached.confirmed, incoming.scene);
            const pending = cached.pending;
            const validPending = pending && ['save','submit'].includes(pending.kind) && uuid(pending.requestId) && pending.challengeId === this.challengeId
              && pending.roundNumber === incoming.round_number && Number.isInteger(pending.expectedRevision) && pending.expectedRevision >= 0;
            if (validPending) validatePlacements(pending.placements, incoming.scene);
            const recoveredAck = validPending && incoming.me.revision === pending.expectedRevision + 1 && equal(server, pending.placements);
            if (cached.revision === incoming.me.revision && equal(cached.confirmed, server) || recoveredAck) {
              desired = cached.placements;
              this.pending = validPending && !recoveredAck ? pending : null;
              this.finish = cached.finish === true;
            } else conflict = !equal(cached.placements, server);
          } catch { desired = server; }
        }
      } else if (oldRound) this.clear();
    } else if (incoming.me.revision > previousRevision && !acknowledges) {
      conflict = !equal(desired, server); desired = server; this.pending = null; this.finish = false;
    }
    this.confirmed = server; this.revision = incoming.me.revision;
    if (acknowledges) this.pending = null;
    if (forceServer) { conflict = !equal(desired, server); desired = server; this.pending = null; this.finish = false; }
    if (incoming.scene.phase !== 'reconstruct') { desired = []; this.pending = null; this.finish = false; }
    this.publish({ placements: desired, blocked: false, submitting: this.finish,
      saveState: !this.pending && !this.finish && equal(desired, server) ? 'saved' : 'saving',
      error: conflict ? 'A newer reconstruction from another device was restored. Continue from these placements.' : null });
    this.persist();
    if (this.pending || this.finish || !equal(desired, server)) this.schedule();
    return true;
  }
  startStudy = (): Promise<void> => {
    if (this.studying) return this.studying;
    if (!this.active || !this.detail?.can_play || !this.round?.scene || this.state.blocked) return Promise.reject(new ShowdownError('This challenge is no longer active.', 'closed'));
    if (this.round.scene.phase !== 'ready') return this.refresh();
    const roundNumber = this.round.round_number;
    this.studyRequestId ??= crypto.randomUUID();
    const requestId = this.studyRequestId;
    this.publish({ starting: true, error: null }); this.persist();
    const work = (async () => {
      try {
        const detail = await this.client.start(roundNumber, requestId);
        if (!this.active) return;
        if (this.accept(detail)) this.onDetail(detail);
        if (this.round?.round_number === roundNumber) { this.studyRequestId = null; this.persist(); }
      } catch (error) { this.publish({ error: error instanceof Error ? error.message : 'Observation could not start. Retry to recover its saved window.' }); throw error; }
      finally { this.publish({ starting: false }); }
    })().finally(() => { if (this.studying === work) this.studying = null; });
    this.studying = work; return work;
  };
  refresh = async () => { const detail = await this.client.fetch(); if (this.accept(detail)) this.onDetail(detail); };
  changePlacements = (placements: AfterimagePlacement[]) => {
    if (!this.active || !this.detail?.can_play || this.round?.scene?.phase !== 'reconstruct' || this.finish || this.state.blocked) return;
    try { validatePlacements(placements, this.round.scene); this.publish({ placements: placements.map(value => ({ ...value })), saveState: 'saving', error: null }); this.persist(); this.schedule(); }
    catch (error) { this.publish({ error: error instanceof Error ? error.message : 'This placement is not available.' }); }
  };
  submit = async () => {
    if (!this.active || !this.detail?.can_play || this.round?.scene?.phase !== 'reconstruct' || this.state.blocked) throw new ShowdownError('This scene is not available for submission.', 'closed');
    validatePlacements(this.state.placements, this.round.scene);
    this.finish = true; this.publish({ submitting: true, error: null, saveState: 'saving' }); this.persist(); await this.flush();
  };
  private schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 280); }
  retry = () => this.flush();
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.running) return this.running.then(() => {
      if (this.active && (this.pending || this.finish || !equal(this.state.placements, this.confirmed))) return this.flush();
    });
    const work = this.drain().finally(() => { if (this.running === work) this.running = null; }); this.running = work; return work;
  };
  private async drain() {
    while (this.active && this.detail?.can_play && this.round?.scene?.phase === 'reconstruct' && !this.state.blocked) {
      if (!this.pending) {
        if (!this.finish && equal(this.state.placements, this.confirmed)) { this.publish({ saveState: 'saved', error: null, submitting: false }); return; }
        this.pending = { challengeId: this.challengeId, roundNumber: this.round.round_number, placements: this.state.placements.map(value => ({ ...value })),
          expectedRevision: this.revision, requestId: crypto.randomUUID(), kind: this.finish ? 'submit' : 'save' }; this.persist();
      }
      const operation = this.pending;
      this.publish({ saveState: 'saving', error: null });
      try {
        const detail = operation.kind === 'submit' ? await this.client.submit(operation) : await this.client.save(operation);
        if (!this.active) return;
        const acknowledged = detail.rounds.find(round => round.round_number === operation.roundNumber);
        if (operation.kind === 'submit' && !acknowledged?.me.submitted) {
          if (this.accept(detail, true)) this.onDetail(detail);
          throw new ShowdownError(detail.readonly_reason || 'This challenge closed before the scene could be submitted.', 'closed');
        }
        if (operation.kind === 'submit' && this.round?.round_number === operation.roundNumber) this.finish = false;
        if (this.accept(detail)) this.onDetail(detail);
        if (this.pending === operation) this.pending = null;
      } catch (error) {
        if (!this.active) throw error;
        if (this.round?.round_number !== operation.roundNumber && !(error instanceof ShowdownError && error.code === 'closed')) { if (this.pending === operation) this.pending = null; continue; }
        if (error instanceof ShowdownError && error.code === 'conflict') {
          this.pending = null; this.finish = false;
          try { const detail = await this.client.fetch(); if (this.accept(detail, true)) this.onDetail(detail); } catch { /* Retain a retryable failure. */ }
        }
        this.publish({ saveState: 'offline', submitting: false, blocked: error instanceof ShowdownError && ['access','closed'].includes(error.code),
          error: error instanceof Error ? error.message : 'Your reconstruction is kept on this device. Retry to sync it.' }); this.persist(); throw error;
      }
    }
  }
}

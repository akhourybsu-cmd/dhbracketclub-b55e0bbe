/**
 * Live draft hosting — shared model.
 *
 * A "live draft" is a normal draft with `is_live = true`: everyone picks on
 * their own device while the host projects the kiosk board. It is deliberately
 * independent of seasons (live drafts never get added to a season ledger).
 *
 * The clock is stored on the draft row so every device — phones and the
 * projector — reads the exact same deadline:
 *   pick_deadline_at  absolute instant the current pick expires
 *   clock_paused_at   when set, the clock is frozen and remaining time is
 *                     (deadline - paused_at)
 *   clock_started_at  when the current pick's clock began (progress ring)
 */

export type PickTimeoutBehavior = 'alert' | 'auto_skip' | 'none';

export interface LiveDraftSettings {
  /** Seconds on the clock per pick. */
  pickSeconds: number;
  /** What happens when the clock hits zero. */
  timeoutBehavior: PickTimeoutBehavior;
  /** Kiosk sound effects (ticker, pick chime, horn). */
  sound: boolean;
  /** Scrolling ticker tape of recent picks on the kiosk. */
  ticker: boolean;
  /** Start the next pick clock automatically after each selection. */
  autoStartClock: boolean;
  /** Announce each pick with a full-screen kiosk card. */
  announce: boolean;
  /** Run the synchronized order reveal before the first pick. */
  ceremony: boolean;
  /** Show factual broadcast moments in the room and kiosk. */
  broadcast: boolean;
  /** Broadcast the complete scored report on the projector after grading. */
  reportBroadcast: boolean;
}

export const DEFAULT_LIVE_SETTINGS: LiveDraftSettings = {
  pickSeconds: 90,
  timeoutBehavior: 'alert',
  sound: true,
  ticker: true,
  autoStartClock: true,
  announce: true,
  ceremony: true,
  broadcast: true,
  reportBroadcast: true,
};

export const PICK_SECONDS_OPTIONS = [30, 45, 60, 90, 120, 180, 300];

export const TIMEOUT_BEHAVIOR_LABELS: Record<PickTimeoutBehavior, string> = {
  alert: 'Alert only',
  auto_skip: 'Auto-skip the pick',
  none: 'No clock limit',
};

export const TIMEOUT_BEHAVIOR_HINTS: Record<PickTimeoutBehavior, string> = {
  alert: 'Clock hits zero, the room sees it, the host decides what happens.',
  auto_skip: 'The turn passes automatically and the slot is marked skipped.',
  none: 'The clock counts up for show only — nothing expires.',
};

export function parseLiveSettings(raw: unknown): LiveDraftSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<LiveDraftSettings>;
  const seconds = Number(obj.pickSeconds);
  const behavior = obj.timeoutBehavior;
  return {
    pickSeconds: Number.isFinite(seconds) && seconds >= 10 ? Math.round(seconds) : DEFAULT_LIVE_SETTINGS.pickSeconds,
    timeoutBehavior:
      behavior === 'alert' || behavior === 'auto_skip' || behavior === 'none'
        ? behavior
        : DEFAULT_LIVE_SETTINGS.timeoutBehavior,
    sound: obj.sound !== false,
    ticker: obj.ticker !== false,
    autoStartClock: obj.autoStartClock !== false,
    announce: obj.announce !== false,
    ceremony: obj.ceremony !== false,
    broadcast: obj.broadcast !== false,
    reportBroadcast: obj.reportBroadcast !== false,
  };
}

const KIOSK_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Short, unambiguous code shown on the projector so people can join. */
export function newKioskCode(length = 5) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += KIOSK_ALPHABET[Math.floor(Math.random() * KIOSK_ALPHABET.length)];
  }
  return out;
}

export interface LiveClockRow {
  pick_deadline_at?: string | null;
  clock_paused_at?: string | null;
  clock_started_at?: string | null;
}

export interface LiveClockState {
  /** Clock is configured for the current pick. */
  running: boolean;
  paused: boolean;
  remainingMs: number;
  totalMs: number;
  expired: boolean;
}

export function readClock(row: LiveClockRow | null | undefined, pickSeconds: number, now = Date.now()): LiveClockState {
  const totalMs = Math.max(1000, pickSeconds * 1000);
  const deadline = row?.pick_deadline_at ? new Date(row.pick_deadline_at).getTime() : null;
  if (!deadline || Number.isNaN(deadline)) {
    return { running: false, paused: false, remainingMs: totalMs, totalMs, expired: false };
  }
  const pausedAt = row?.clock_paused_at ? new Date(row.clock_paused_at).getTime() : null;
  const reference = pausedAt && !Number.isNaN(pausedAt) ? pausedAt : now;
  const remainingMs = deadline - reference;
  return {
    running: true,
    paused: Boolean(pausedAt),
    remainingMs: Math.max(0, remainingMs),
    totalMs,
    expired: remainingMs <= 0,
  };
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Snake-order participant index for a consumed-slot index (0-based). */
export function slotToParticipantIndex(slot: number, participantCount: number) {
  if (participantCount <= 0) return 0;
  const round = Math.floor(slot / participantCount);
  const pos = slot % participantCount;
  return round % 2 === 0 ? pos : participantCount - 1 - pos;
}

export function kioskPath(draftId: string) {
  return `/drafts/${draftId}/kiosk`;
}

export function kioskUrl(draftId: string) {
  return `https://dryhorse.app${kioskPath(draftId)}`;
}

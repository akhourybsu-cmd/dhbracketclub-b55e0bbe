import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { serverNow, syncServerClock } from '@/lib/serverClock';
import {
  DEFAULT_LIVE_SETTINGS,
  type LiveDraftSettings,
  newKioskCode,
  parseLiveSettings,
  readClock,
  slotToParticipantIndex,
  type LiveClockRow,
  type LiveClockState,
} from '@/lib/draft/liveDraft';

export interface DraftSkip {
  id: string;
  draft_id: string;
  user_id: string;
  pick_number: number;
  round: number;
  created_at: string;
}

/** Slots the host skipped when a pick clock expired. */
export function useDraftSkips(draftId: string | undefined, enabled = true) {
  const [skips, setSkips] = useState<DraftSkip[]>([]);

  const refetch = useCallback(async () => {
    if (!draftId) return;
    const { data } = await (supabase as any)
      .from('draft_skips')
      .select('*')
      .eq('draft_id', draftId)
      .order('pick_number');
    setSkips((data ?? []) as DraftSkip[]);
  }, [draftId]);

  useEffect(() => {
    if (!enabled) return;
    void refetch();
  }, [enabled, refetch]);

  return { skips, refetch };
}

/** Ticking view of the shared draft clock. */
export function useLiveClock(row: LiveClockRow | null | undefined, pickSeconds: number): LiveClockState {
  const [, setTick] = useState(0);
  const paused = Boolean(row?.clock_paused_at);
  const deadline = row?.pick_deadline_at ?? null;

  // Align this device with the server clock (and re-align when it wakes up).
  useEffect(() => {
    void syncServerClock(true).then(() => setTick(t => t + 1));
    const onVis = () => { if (document.visibilityState === 'visible') void syncServerClock(true); };
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(() => void syncServerClock(true), 5 * 60_000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(id); };
  }, []);


  useEffect(() => {
    if (!deadline || paused) return;
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, [deadline, paused]);

  return useMemo(
    () => readClock(row, pickSeconds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row?.pick_deadline_at, row?.clock_paused_at, pickSeconds, Math.floor(Date.now() / 250)],
  );
}

interface HostParticipant {
  user_id: string;
  pick_order: number;
  profiles?: { display_name?: string } | null;
}

interface UseLiveDraftHostArgs {
  draftId?: string;
  draft: any;
  participants: HostParticipant[];
  /** Picks + skips already consumed. */
  consumedSlots: number;
  onChange?: () => void;
}

/**
 * Host command center actions for a live draft. Every action writes to the
 * `drafts` row so all devices (and the kiosk) stay in lockstep via realtime.
 */
export function useLiveDraftHost({ draftId, draft, participants, consumedSlots, onChange }: UseLiveDraftHostArgs) {
  const [busy, setBusy] = useState(false);
  const settings = useMemo(() => parseLiveSettings(draft?.live_settings), [draft?.live_settings]);

  const update = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!draftId) return;
      setBusy(true);
      try {
        const { error } = await supabase.from('drafts').update(patch as any).eq('id', draftId);
        if (error) throw error;
        onChange?.();
      } finally {
        setBusy(false);
      }
    },
    [draftId, onChange],
  );

  const startClock = useCallback(
    async (seconds?: number) => {
      const sec = seconds ?? settings.pickSeconds;
      const now = serverNow();
      await update({
        clock_started_at: new Date(now).toISOString(),
        pick_deadline_at: new Date(now + sec * 1000).toISOString(),
        clock_paused_at: null,
      });
    },
    [settings.pickSeconds, update],
  );

  const stopClock = useCallback(
    () => update({ pick_deadline_at: null, clock_paused_at: null, clock_started_at: null }),
    [update],
  );

  const pause = useCallback(() => {
    if (!draft?.pick_deadline_at || draft?.clock_paused_at) return Promise.resolve();
    return update({ clock_paused_at: new Date(serverNow()).toISOString() });
  }, [draft?.clock_paused_at, draft?.pick_deadline_at, update]);

  const resume = useCallback(() => {
    if (!draft?.pick_deadline_at || !draft?.clock_paused_at) return Promise.resolve();
    const remaining = new Date(draft.pick_deadline_at).getTime() - new Date(draft.clock_paused_at).getTime();
    return update({
      pick_deadline_at: new Date(serverNow() + Math.max(0, remaining)).toISOString(),
      clock_paused_at: null,
    });
  }, [draft?.clock_paused_at, draft?.pick_deadline_at, update]);

  const addTime = useCallback(
    (seconds: number) => {
      const base = draft?.pick_deadline_at ? new Date(draft.pick_deadline_at).getTime() : serverNow();
      return update({ pick_deadline_at: new Date(base + seconds * 1000).toISOString() });
    },
    [draft?.pick_deadline_at, update],
  );

  const saveSettings = useCallback(
    (patch: Partial<LiveDraftSettings>) =>
      update({ live_settings: { ...DEFAULT_LIVE_SETTINGS, ...settings, ...patch } }),
    [settings, update],
  );

  const ensureKioskCode = useCallback(async () => {
    if (draft?.kiosk_code) return draft.kiosk_code as string;
    const code = newKioskCode();
    await update({ kiosk_code: code });
    return code;
  }, [draft?.kiosk_code, update]);

  /** Pass the current pick: records a skip and moves the clock to the next slot. */
  const skipCurrentPick = useCallback(async () => {
    if (!draftId || participants.length === 0) return;
    const sorted = [...participants].sort((a, b) => a.pick_order - b.pick_order);
    const totalSlots = sorted.length * (draft?.num_rounds ?? 1);
    if (consumedSlots >= totalSlots) return;

    const slot = consumedSlots;
    const round = Math.floor(slot / sorted.length) + 1;
    const picker = sorted[slotToParticipantIndex(slot, sorted.length)];
    if (!picker) return;

    setBusy(true);
    try {
      const { error } = await (supabase as any).from('draft_skips').insert({
        draft_id: draftId,
        user_id: picker.user_id,
        pick_number: slot + 1,
        round,
      });
      if (error) throw error;

      const nextSlot = slot + 1;
      if (nextSlot >= totalSlots) {
        await supabase.from('drafts').update({ status: 'complete', pick_deadline_at: null, clock_paused_at: null }).eq('id', draftId);
      } else {
        const next = sorted[slotToParticipantIndex(nextSlot, sorted.length)];
        const now = serverNow();
        await supabase
          .from('drafts')
          .update({
            current_pick_number: nextSlot + 1,
            current_round: Math.floor(nextSlot / sorted.length) + 1,
            current_pick_user_id: next?.user_id ?? null,
            ...(settings.autoStartClock
              ? {
                  clock_started_at: new Date(now).toISOString(),
                  pick_deadline_at: new Date(now + settings.pickSeconds * 1000).toISOString(),
                  clock_paused_at: null,
                }
              : { pick_deadline_at: null, clock_paused_at: null }),
          } as any)
          .eq('id', draftId);
      }
      onChange?.();
    } finally {
      setBusy(false);
    }
  }, [consumedSlots, draft?.num_rounds, draftId, onChange, participants, settings.autoStartClock, settings.pickSeconds]);

  return {
    settings,
    busy,
    startClock,
    stopClock,
    pause,
    resume,
    addTime,
    saveSettings,
    ensureKioskCode,
    skipCurrentPick,
  };
}

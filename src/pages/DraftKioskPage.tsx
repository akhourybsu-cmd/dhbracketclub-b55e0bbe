import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2, Minimize2, Volume2, VolumeX, Radio, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDraftUpdates } from '@/hooks/useRealtimeSubscription';
import { useDraftSkips, useLiveClock } from '@/hooks/useLiveDraft';
import { LiveClockDial } from '@/components/draft/live/LiveClockDial';
import { kioskSound } from '@/lib/draft/kioskSound';
import { parseLiveSettings, slotToParticipantIndex } from '@/lib/draft/liveDraft';
import { cn } from '@/lib/utils';

interface KioskParticipant {
  user_id: string;
  pick_order: number;
  profiles?: { display_name?: string } | null;
}

interface KioskPick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round: number;
  picked_at: string;
}

function initials(name?: string | null) {
  return (
    (name || '?')
      .split(' ')
      .map(s => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/**
 * Projector kiosk — the big screen in the room. Read-only, full-bleed, and
 * driven entirely by realtime updates from the live draft.
 */
export default function DraftKioskPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const [draft, setDraft] = useState<any>(null);
  const [participants, setParticipants] = useState<KioskParticipant[]>([]);
  const [picks, setPicks] = useState<KioskPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [announce, setAnnounce] = useState<{ pick: KioskPick; name: string } | null>(null);
  const seenPickIds = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);
  const lastTickSecond = useRef<number>(-1);
  const hornPlayed = useRef(false);

  const { skips, refetch: refetchSkips } = useDraftSkips(draftId);
  const settings = useMemo(() => parseLiveSettings(draft?.live_settings), [draft?.live_settings]);
  const clock = useLiveClock(draft, settings.pickSeconds);

  const fetchData = useCallback(async () => {
    if (!draftId) return;
    const [{ data: d }, { data: p }, { data: pk }] = await Promise.all([
      supabase.from('drafts').select('*').eq('id', draftId).maybeSingle(),
      supabase
        .from('draft_participants')
        .select('user_id, pick_order, profiles(display_name)')
        .eq('draft_id', draftId)
        .order('pick_order'),
      supabase
        .from('draft_picks')
        .select('id, user_id, pick_text, pick_number, round, picked_at')
        .eq('draft_id', draftId)
        .order('pick_number'),
    ]);
    setDraft(d);
    setParticipants((p ?? []) as any);
    setPicks((pk ?? []) as any);
    void refetchSkips();
    setLoading(false);
  }, [draftId, refetchSkips]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useDraftUpdates(draftId, fetchData);

  const sorted = useMemo(() => [...participants].sort((a, b) => a.pick_order - b.pick_order), [participants]);
  const n = sorted.length;
  const numRounds = draft?.num_rounds ?? 0;
  const totalSlots = n * numRounds;
  const consumed = picks.length + skips.length;
  const complete = draft?.status === 'complete' || (totalSlots > 0 && consumed >= totalSlots);

  const currentPicker = complete ? null : sorted[slotToParticipantIndex(consumed, n)] ?? null;
  const onDeck = useMemo(
    () =>
      Array.from({ length: Math.min(4, Math.max(0, totalSlots - consumed - 1)) }, (_, i) => {
        const slot = consumed + i + 1;
        return { slot, participant: sorted[slotToParticipantIndex(slot, n)] };
      }),
    [consumed, n, sorted, totalSlots],
  );
  const currentRound = n > 0 ? Math.min(numRounds, Math.floor(consumed / n) + 1) : 1;

  const nameFor = useCallback(
    (userId?: string | null) => sorted.find(p => p.user_id === userId)?.profiles?.display_name || 'Unknown',
    [sorted],
  );

  const pickByCell = useMemo(() => {
    const map = new Map<string, KioskPick>();
    picks.forEach(p => map.set(`${p.round}:${p.user_id}`, p));
    return map;
  }, [picks]);
  const skipByCell = useMemo(() => {
    const set = new Set<string>();
    skips.forEach(s => set.add(`${s.round}:${s.user_id}`));
    return set;
  }, [skips]);

  /* ── Sound + announcements ── */
  useEffect(() => {
    // Seed on first load so a refresh doesn't replay the whole board.
    if (loading) return;
    const fresh = picks.filter(p => !seenPickIds.current.has(p.id));
    picks.forEach(p => seenPickIds.current.add(p.id));
    if (!hydrated.current) {
      hydrated.current = true; // first paint: don't replay the whole board
      return;
    }
    const latest = fresh[fresh.length - 1];
    if (!latest) return;
    if (!muted && settings.sound) kioskSound.pick();
    if (settings.announce) {
      setAnnounce({ pick: latest, name: nameFor(latest.user_id) });
      const id = setTimeout(() => setAnnounce(null), 4200);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, loading]);

  useEffect(() => {
    if (muted || !settings.sound || !clock.running || clock.paused) return;
    const seconds = Math.ceil(clock.remainingMs / 1000);
    if (seconds <= 0) {
      if (!hornPlayed.current) {
        hornPlayed.current = true;
        kioskSound.horn();
      }
      return;
    }
    hornPlayed.current = false;
    if (seconds <= 10 && seconds !== lastTickSecond.current) {
      lastTickSecond.current = seconds;
      if (seconds <= 5) kioskSound.tickUrgent();
      else kioskSound.tick();
    }
  }, [clock.paused, clock.remainingMs, clock.running, muted, settings.sound]);

  const toggleMute = () => {
    kioskSound.unlock();
    setMuted(m => {
      if (m) kioskSound.onClock();
      return !m;
    });
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      }
    } catch {
      /* browser refused — ignore */
    }
  };

  if (loading) {
    return (
      <div className="da-mode da-kiosk flex items-center justify-center min-h-[100dvh]">
        <p className="dl-display text-lg text-muted-foreground animate-pulse">Loading draft room…</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="da-mode da-kiosk flex items-center justify-center min-h-[100dvh]">
        <p className="dl-display text-lg">Draft not found.</p>
      </div>
    );
  }

  const recent = [...picks].slice(-12).reverse();

  return (
    <div className="da-mode da-lounge da-kiosk min-h-[100dvh] flex flex-col">
      {/* Top bar */}
      <header className="da-kiosk-bar">
        <div className="min-w-0">
          <p className="dl-eyebrow flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-primary animate-pulse" aria-hidden /> Live Draft
          </p>
          <h1 className="da-kiosk-title dl-display truncate">{draft.topic}</h1>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="dl-eyebrow">Round</p>
            <p className="da-kiosk-round dl-display tabular-nums">
              {currentRound}
              <span className="text-muted-foreground">/{numRounds}</span>
            </p>
          </div>
          {draft.kiosk_code && (
            <div className="text-right">
              <p className="dl-eyebrow">Room</p>
              <p className="da-kiosk-round dl-display tracking-[0.18em]">{draft.kiosk_code}</p>
            </div>
          )}
          <button type="button" onClick={toggleMute} className="da-kiosk-btn" aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button type="button" onClick={toggleFullscreen} className="da-kiosk-btn" aria-label="Toggle full screen">
            {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 grid gap-4 p-4 lg:grid-cols-[minmax(280px,26%)_1fr] min-h-0">
        {/* On the clock */}
        <section className="da-kiosk-card flex flex-col items-center justify-center gap-4 p-5 text-center">
          {complete ? (
            <>
              <Trophy className="w-12 h-12 text-primary" />
              <p className="dl-eyebrow">Board complete</p>
              <p className="dl-display text-3xl font-black">All picks are in</p>
            </>
          ) : (
            <>
              <p className="dl-eyebrow">On the clock</p>
              <div className="da-kiosk-avatar dl-display">{initials(currentPicker?.profiles?.display_name)}</div>
              <p className="dl-display text-2xl xl:text-4xl font-black leading-tight">
                {currentPicker?.profiles?.display_name || 'Waiting…'}
              </p>
              <LiveClockDial clock={clock} size={176} stroke={12} />
              <p className="dl-display text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Pick {Math.min(totalSlots, consumed + 1)} of {totalSlots}
              </p>
              {onDeck.length > 0 && (
                <div className="w-full pt-3 border-t border-border/50 space-y-1.5">
                  <p className="dl-eyebrow">On deck</p>
                  {onDeck.map(({ slot, participant }) => (
                    <div key={slot} className="flex items-center gap-2 justify-center">
                      <span className="da-kiosk-mini dl-display">{initials(participant?.profiles?.display_name)}</span>
                      <span className="text-sm font-semibold truncate">
                        {participant?.profiles?.display_name || 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Big board */}
        <section className="da-kiosk-card overflow-auto p-3">
          <div
            className="grid gap-1.5 min-w-[640px]"
            style={{ gridTemplateColumns: `3.5rem repeat(${Math.max(1, n)}, minmax(7rem, 1fr))` }}
          >
            <div aria-hidden />
            {sorted.map(p => (
              <div key={p.user_id} className="da-kiosk-head">
                <span className="da-kiosk-mini dl-display">{initials(p.profiles?.display_name)}</span>
                <span className="dl-display text-[12px] font-bold truncate">
                  {p.profiles?.display_name || 'Unknown'}
                </span>
              </div>
            ))}

            {Array.from({ length: numRounds }, (_, i) => i + 1).map(round => {
              const order = round % 2 === 1 ? sorted : [...sorted].reverse();
              return [
                <div key={`r${round}`} className="da-kiosk-roundlabel dl-display">
                  R{round}
                </div>,
                ...order.map((p, idx) => {
                  const key = `${round}:${p.user_id}`;
                  const pick = pickByCell.get(key);
                  const skipped = skipByCell.has(key);
                  const slot = (round - 1) * n + idx;
                  const isCurrent = !pick && !skipped && slot === consumed && !complete;
                  return (
                    <div
                      key={key}
                      className={cn(
                        'da-kiosk-cell',
                        pick && 'da-kiosk-cell-filled',
                        skipped && 'da-kiosk-cell-skipped',
                        isCurrent && 'da-kiosk-cell-current',
                      )}
                    >
                      <span className="da-kiosk-cell-num dl-display">{slot + 1}</span>
                      <span className="da-kiosk-cell-text">
                        {pick ? pick.pick_text : skipped ? 'Passed' : isCurrent ? 'On the clock' : '—'}
                      </span>
                    </div>
                  );
                }),
              ];
            })}
          </div>
        </section>
      </div>

      {/* Ticker tape */}
      {settings.ticker && recent.length > 0 && (
        <footer className="da-kiosk-ticker">
          <span className="da-kiosk-ticker-label dl-display">Latest picks</span>
          <div className="da-kiosk-ticker-track">
            <div className="da-kiosk-ticker-run">
              {[...recent, ...recent].map((p, i) => (
                <span key={`${p.id}-${i}`} className="da-kiosk-ticker-item">
                  <b className="dl-display">#{p.pick_number}</b> {p.pick_text}
                  <em className="da-kiosk-ticker-by">{nameFor(p.user_id)}</em>
                </span>
              ))}
            </div>
          </div>
        </footer>
      )}

      {/* Pick announcement */}
      <AnimatePresence>
        {announce && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
            style={{ background: 'hsl(var(--background) / 0.72)', backdropFilter: 'blur(6px)' }}
          >
            <div className="da-kiosk-card text-center px-10 py-8 max-w-[80vw]">
              <p className="dl-eyebrow">
                Pick #{announce.pick.pick_number} · Round {announce.pick.round}
              </p>
              <p className="dl-display text-4xl xl:text-6xl font-black mt-2 leading-tight">{announce.pick.pick_text}</p>
              <p className="dl-display text-lg font-bold mt-3 text-primary">{announce.name}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

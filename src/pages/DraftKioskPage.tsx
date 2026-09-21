import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
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

type RevealPhase = 'locked' | 'confirmed' | 'reveal' | 'landing';
interface PickReveal {
  pick: KioskPick;
  name: string;
  phase: RevealPhase;
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
  const [reveal, setReveal] = useState<PickReveal | null>(null);
  const [revealQueue, setRevealQueue] = useState<Array<{ pick: KioskPick; name: string }>>([]);
  const reduceMotion = useReducedMotion();
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

  /* ── Sound + cinematic pick reveals ── */
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
    if (!settings.announce) {
      if (!muted && settings.sound) kioskSound.pick();
      return;
    }
    setRevealQueue(queue => [
      ...queue,
      ...fresh.map(pick => ({ pick, name: nameFor(pick.user_id) })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, loading]);

  useEffect(() => {
    if (reveal || revealQueue.length === 0) return;
    const [next, ...rest] = revealQueue;
    setRevealQueue(rest);
    setReveal({ ...next, phase: reduceMotion ? 'reveal' : 'locked' });
  }, [reduceMotion, reveal, revealQueue]);

  useEffect(() => {
    if (!reveal) return;
    const soundOn = !muted && settings.sound;
    const durations: Record<RevealPhase, number> = reduceMotion
      ? { locked: 0, confirmed: 0, reveal: 900, landing: 450 }
      : { locked: 1150, confirmed: 900, reveal: 2350, landing: 900 };

    if (soundOn) {
      if (reveal.phase === 'locked') kioskSound.locked();
      if (reveal.phase === 'confirmed') kioskSound.reveal();
      if (reveal.phase === 'landing') kioskSound.land();
    }

    const nextPhase: Record<RevealPhase, RevealPhase | null> = {
      locked: 'confirmed',
      confirmed: 'reveal',
      reveal: 'landing',
      landing: null,
    };
    const timer = window.setTimeout(() => {
      const next = nextPhase[reveal.phase];
      setReveal(next ? { ...reveal, phase: next } : null);
    }, durations[reveal.phase]);
    return () => window.clearTimeout(timer);
  }, [muted, reduceMotion, reveal, settings.sound]);

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

  const recent = picks.filter(pick => pick.id !== concealedPickId).slice(-12).reverse();

  const concealedPickId = reveal && reveal.phase !== 'landing' ? reveal.pick.id : null;

  return (
    <LayoutGroup id="kiosk-pick-reveal">
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
                  const boardPick = pickByCell.get(key);
                  const pick = boardPick?.id === concealedPickId ? undefined : boardPick;
                  const awaitingReveal = boardPick?.id === concealedPickId;
                  const skipped = skipByCell.has(key);
                  const slot = (round - 1) * n + idx;
                  const isCurrent = !pick && !skipped && slot === consumed && !complete;
                  return (
                    <motion.div
                      key={key}
                      layoutId={pick ? `kiosk-pick-${pick.id}` : undefined}
                      transition={{ type: 'spring', stiffness: 190, damping: 23, mass: 0.9 }}
                      className={cn(
                        'da-kiosk-cell',
                        pick && 'da-kiosk-cell-filled',
                        reveal?.phase === 'landing' && pick?.id === reveal.pick.id && 'da-kiosk-cell-landed',
                        awaitingReveal && 'da-kiosk-cell-awaiting',
                        skipped && 'da-kiosk-cell-skipped',
                        isCurrent && 'da-kiosk-cell-current',
                      )}
                    >
                      <span className="da-kiosk-cell-num dl-display">{slot + 1}</span>
                      <span className="da-kiosk-cell-text">
                        {pick ? pick.pick_text : awaitingReveal ? 'Pick locked' : skipped ? 'Passed' : isCurrent ? 'On the clock' : '—'}
                      </span>
                    </motion.div>
                  );
                }),
              ];
            })}
          </div>
        </section>
      </div>

      {/* Ticker tape */}
      {settings.ticker && recent.length > 0 && !reveal && (
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

      {/* Cinematic pick announcement */}
      <AnimatePresence mode="wait">
        {reveal && reveal.phase !== 'landing' && (
          <motion.div
            key={reveal.pick.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.35 }}
            className="da-kiosk-reveal fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-8 pointer-events-none"
          >
            <div className="da-kiosk-reveal-beam" aria-hidden />
            <div className="da-kiosk-reveal-lines" aria-hidden />
            <AnimatePresence mode="wait">
              {reveal.phase === 'locked' && (
                <motion.div
                  key="locked"
                  initial={{ opacity: 0, scale: 1.16, letterSpacing: '0.32em' }}
                  animate={{ opacity: 1, scale: 1, letterSpacing: '0.18em' }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.55 }}
                  className="da-kiosk-reveal-status dl-display"
                >
                  <span className="da-kiosk-lock-mark" aria-hidden />
                  Pick locked
                </motion.div>
              )}
              {reveal.phase === 'confirmed' && (
                <motion.div
                  key="confirmed"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, filter: 'blur(8px)' }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.45 }}
                  className="text-center"
                >
                  <p className="da-kiosk-reveal-kicker dl-display">Selection confirmed</p>
                  <p className="da-kiosk-reveal-in dl-display">The pick is in</p>
                </motion.div>
              )}
              {reveal.phase === 'reveal' && (
                <motion.div
                  key="reveal"
                  layoutId={`kiosk-pick-${reveal.pick.id}`}
                  initial={{ opacity: 0, y: 24, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 1 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="da-kiosk-reveal-card"
                >
                  <p className="da-kiosk-reveal-kicker dl-display">
                    Pick #{reveal.pick.pick_number} · Round {reveal.pick.round}
                  </p>
                  <motion.p
                    initial={{ clipPath: 'inset(0 100% 0 0)' }}
                    animate={{ clipPath: 'inset(0 0% 0 0)' }}
                    transition={{ delay: reduceMotion ? 0 : 0.25, duration: reduceMotion ? 0.15 : 1.1, ease: [0.22, 1, 0.36, 1] }}
                    className="da-kiosk-reveal-pick dl-display"
                  >
                    {reveal.pick.pick_text}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduceMotion ? 0 : 1.15, duration: 0.4 }}
                    className="da-kiosk-reveal-name dl-display"
                  >
                    {reveal.name}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </LayoutGroup>
  );
}

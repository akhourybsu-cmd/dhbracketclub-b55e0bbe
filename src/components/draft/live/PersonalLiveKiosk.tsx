import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, MonitorSmartphone, Sparkles, X } from 'lucide-react';
import { LiveClockDial } from './LiveClockDial';
import { formatClock, type LiveClockState } from '@/lib/draft/liveDraft';
import { DraftArenaAppearance } from '@/components/drafts/DraftArenaAppearance';

interface KioskPick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round?: number | null;
}

interface PersonalLiveKioskProps {
  draftTitle: string;
  clock: LiveClockState;
  pickerName: string;
  isMyTurn: boolean;
  picksUntilYou: number | null;
  currentRound: number;
  numRounds: number;
  currentPickNumber: number;
  totalPicks: number;
  myPicks: KioskPick[];
  recentPicks: (KioskPick & { name: string })[];
  onMakePick: () => void;
  board: ReactNode;
  desk: ReactNode;
  broadcast?: ReactNode;
  hostControls?: ReactNode;
  palette?: string;
}

type WakeLockHandle = { release: () => Promise<void> };

/**
 * A player's own live-draft kiosk. Opens full screen when they join a live
 * room, keeps the screen awake, and holds everything they need privately:
 * clock, their team, their desk, the board and the live feed.
 */
export function PersonalLiveKiosk(props: PersonalLiveKioskProps) {
  const [open, setOpen] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const wakeRef = useRef<WakeLockHandle | null>(null);

  const requestWake = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockHandle> } };
      if (nav.wakeLock && !wakeRef.current) wakeRef.current = await nav.wakeLock.request('screen');
    } catch { /* unsupported or denied */ }
  }, []);

  const releaseWake = useCallback(() => {
    void wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);

  // Keep the screen awake while the kiosk is open; re-acquire on tab return.
  useEffect(() => {
    if (!open) { releaseWake(); return; }
    void requestWake();
    const onVis = () => { if (document.visibilityState === 'visible') { wakeRef.current = null; void requestWake(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); releaseWake(); };
  }, [open, releaseWake, requestWake]);

  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const enterFullscreen = async () => {
    try { await document.documentElement.requestFullscreen?.(); } catch { /* stays in-app full screen */ }
    void requestWake();
  };
  const exitFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* noop */ }
  };

  // Browsers only allow real full screen after a tap — take the first one.
  useEffect(() => {
    if (!open || isFs) return;
    const once = () => { void enterFullscreen(); };
    window.addEventListener('pointerdown', once, { once: true });
    return () => window.removeEventListener('pointerdown', once);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = async () => { await exitFullscreen(); setOpen(false); };

  if (!open) {
    return createPortal(
      <button type="button" onClick={() => setOpen(true)} className="da-pk-reopen btn-press" aria-label="Open my live kiosk">
        <MonitorSmartphone className="w-4 h-4" /> My kiosk
      </button>,
      document.body,
    );
  }

  const { clock, isMyTurn } = props;
  const status = isMyTurn
    ? "You're on the clock"
    : props.picksUntilYou != null && props.picksUntilYou > 0
      ? `You pick in ${props.picksUntilYou}`
      : `${props.pickerName} is picking`;

  return createPortal(
    <div
      ref={rootRef}
      className="da-mode da-lounge da-pk"
      data-da-palette={props.palette}
      data-my-turn={isMyTurn ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="My live draft kiosk"
    >
      <header className="da-pk-top">
        <div className="min-w-0">
          <p className="dl-eyebrow flex items-center gap-1.5"><span className="da-pk-dot" aria-hidden /> My live kiosk · Private</p>
          <h2 className="dl-display text-base font-black truncate">{props.draftTitle}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <DraftArenaAppearance />
          <button
            type="button"
            className="da-pk-icon btn-press"
            onClick={() => (isFs ? void exitFullscreen() : void enterFullscreen())}
            aria-label={isFs ? 'Exit full screen' : 'Go full screen'}
          >
            {isFs ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button type="button" className="da-pk-icon btn-press" onClick={() => void close()} aria-label="Close my kiosk">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="da-pk-body">
        <aside className="da-pk-rail">
          <section className="dl-card da-pk-clock">
            <LiveClockDial clock={clock} size={120} />
            <div className="min-w-0 flex-1">
              <p className="dl-eyebrow">Round {props.currentRound} of {props.numRounds} · Pick {Math.min(props.currentPickNumber, props.totalPicks)}/{props.totalPicks}</p>
              <p className="dl-display text-xl font-black leading-tight">{status}</p>
              {clock.running && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {clock.paused ? 'Clock paused' : clock.expired ? 'Clock expired' : `${formatClock(clock.remainingMs)} left`}
                </p>
              )}
              {isMyTurn && (
                <button type="button" onClick={props.onMakePick} className="da-pk-pick btn-press">
                  <Sparkles className="w-4 h-4" /> Make my pick
                </button>
              )}
            </div>
          </section>

          {props.hostControls}

          <section className="dl-card p-4">
            <p className="dl-eyebrow">My team · {props.myPicks.length} of {props.numRounds}</p>
            {props.myPicks.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">Your picks will land here.</p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {props.myPicks.map((p, i) => (
                  <li key={p.id} className="da-pk-team-row">
                    <span className="da-pk-num">{i + 1}</span>
                    <span className="flex-1 font-semibold text-sm break-words">{p.pick_text}</span>
                    <span className="text-[11px] text-muted-foreground">#{p.pick_number}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {props.desk}
        </aside>

        <main className="da-pk-main">
          <div className="da-pk-board">{props.board}</div>
          <div className="da-pk-feed-grid">
            {props.broadcast}
            <section className="dl-card p-4">
              <p className="dl-eyebrow">Latest picks</p>
              {props.recentPicks.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No picks yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {props.recentPicks.map(p => (
                    <li key={p.id} className="flex items-baseline gap-2 text-sm">
                      <span className="da-pk-num">{p.pick_number}</span>
                      <span className="font-semibold break-words flex-1">{p.pick_text}</span>
                      <span className="text-[11px] text-muted-foreground">{p.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>,
    document.body,
  );
}

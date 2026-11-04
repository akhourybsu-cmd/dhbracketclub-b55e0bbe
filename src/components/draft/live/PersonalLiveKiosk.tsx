import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, Maximize2, Minimize2, MonitorPlay, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { LiveClockDial } from './LiveClockDial';
import { formatClock, type LiveClockState } from '@/lib/draft/liveDraft';
import { DraftArenaAppearance } from '@/components/drafts/DraftArenaAppearance';
import { usePickReveals } from './usePickReveals';
import { PickRevealOverlay } from './PickRevealOverlay';
import { kioskSound } from '@/lib/draft/kioskSound';

interface KioskPick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round?: number | null;
}

interface PersonalLiveKioskProps {
  /** Presentation scope only; never a source for turn or timer calculations. */
  draftId?: string;
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
  /** Every pick so far, with display names — drives the cinematic reveal. */
  allPicks?: (KioskPick & { name: string })[];
  /** Live settings: cinematic announcements + sound switches. */
  announce?: boolean;
  sound?: boolean;
  onMakePick: () => void;
  board: ReactNode;
  desk: ReactNode;
  broadcast?: ReactNode;
  hostControls?: ReactNode;
  palette?: string;
  projectorPath?: string;
}

type WakeLockHandle = { release: () => Promise<void> };

/**
 * An explicit entrance to the private player screen. Native full screen and
 * device sound both require deliberate actions; the room's rules stay shared.
 */
export function PersonalLiveKiosk(props: PersonalLiveKioskProps) {
  return <PlayerScreenSession key={props.draftId ?? props.draftTitle} {...props} />;
}

function PlayerScreenSession(props: PersonalLiveKioskProps) {
  const [open, setOpen] = useState(false);
  const [isFs, setIsFs] = useState(() => Boolean(document.fullscreenElement));
  const [view, setView] = useState(props.hostControls ? 'host' : 'board');
  const [audioOn, setAudioOn] = useState(false);
  const panelId = useId();
  const activeView = view === 'host' && !props.hostControls ? 'board' : view;
  const views = [
    { id: 'board', label: 'Board' },
    { id: 'team', label: 'My team' },
    { id: 'desk', label: 'Draft desk' },
    { id: 'feed', label: 'Live feed' },
    ...(props.hostControls ? [{ id: 'host', label: 'Host' }] : []),
  ];
  const rootRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const entryRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const wakeRef = useRef<WakeLockHandle | null>(null);
  const wakePending = useRef(false);
  const ownsFullscreen = useRef(false);

  useEffect(() => {
    if (!open) return;
    // Mobile scrolls the clock, view tabs and content together. Only its
    // vertical reading position changes; desktop keeps its existing pane.
    const workspace = workspaceRef.current;
    if (workspace && /^(auto|scroll)$/.test(getComputedStyle(workspace).overflowY)) {
      workspace.scrollTop = 0;
      if (panelsRef.current) panelsRef.current.scrollTop = 0;
    }
  }, [open, activeView]);

  const requestWake = useCallback(async () => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockHandle> } };
    const wakeLock = nav.wakeLock;
    if (!wakeLock || wakeRef.current || wakePending.current || !openRef.current || document.hidden) return;
    wakePending.current = true;
    try {
      const handle = await wakeLock.request('screen');
      if (!openRef.current || document.hidden) await handle.release();
      else wakeRef.current = handle;
    } catch { /* unsupported or denied */ }
    finally { wakePending.current = false; }
  }, []);

  const releaseWake = useCallback(() => {
    void wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);

  // The explicit player screen owns wake lock only while it is visible.
  useEffect(() => {
    if (!open) { releaseWake(); return; }
    void requestWake();
    const onVis = () => {
      if (document.hidden) releaseWake();
      else void requestWake();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); releaseWake(); };
  }, [open, releaseWake, requestWake]);

  useEffect(() => {
    const onFs = () => {
      setIsFs(Boolean(document.fullscreenElement));
      if (document.fullscreenElement !== document.documentElement) ownsFullscreen.current = false;
    };
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
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        if (document.fullscreenElement === document.documentElement) {
          if (openRef.current) ownsFullscreen.current = true;
          else await document.exitFullscreen();
        }
      }
    } catch { /* The in-app player screen remains fully usable. */ }
  };
  const exitFullscreen = useCallback(async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* noop */ }
    ownsFullscreen.current = false;
  }, []);
  useEffect(() => {
    return () => {
      openRef.current = false;
      if (ownsFullscreen.current) void exitFullscreen();
    };
  }, [exitFullscreen]);

  const enter = () => {
    setView(props.hostControls ? 'host' : 'board');
    setOpen(true);
  };
  const close = () => {
    openRef.current = false;
    setOpen(false);
    if (ownsFullscreen.current) void exitFullscreen();
  };
  const soundEnabled = audioOn && (props.sound ?? true);

  const { clock, isMyTurn } = props;
  const status = isMyTurn
    ? "You're on the clock"
    : props.picksUntilYou != null && props.picksUntilYou > 0
      ? `You pick in ${props.picksUntilYou}`
      : `${props.pickerName} is picking`;

  return <>
    <section className="da-live-event-entry" aria-label="Live event entrance" data-draft-id={props.draftId}>
      <span className="da-live-event-entry-mark" aria-hidden="true"><MonitorPlay /></span>
      <div className="da-live-event-entry-copy">
        <p className="dl-eyebrow">Live event · Your player screen</p>
        <h2 className="dl-display">{props.draftTitle}</h2>
        <p className="da-live-event-entry-meta">Round {props.currentRound}/{props.numRounds} · Pick {Math.min(props.currentPickNumber, props.totalPicks)}/{props.totalPicks}</p>
        <p role="status">{status}</p>
      </div>
      <div className="da-live-event-entry-actions">
        <button ref={entryRef} type="button" onClick={enter} className="da-cta btn-press"><MonitorPlay aria-hidden="true" /> Enter live draft</button>
        <span>Private screen · {soundEnabled ? 'Sound on' : 'Sound off'}</span>
      </div>
    </section>
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (next) enter(); else close(); }}>
    <DialogPrimitive.Portal>
    <DialogPrimitive.Content
      ref={rootRef}
      className="da-mode da-lounge da-pk"
      data-da-palette={props.palette}
      data-my-turn={isMyTurn ? 'true' : undefined}
      aria-label="Draft Arena player screen"
      aria-labelledby={undefined}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        rootRef.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        entryRef.current?.focus({ preventScroll: true });
      }}
    >
      <DialogPrimitive.Description className="sr-only">A private player screen for {props.draftTitle}. {status}.</DialogPrimitive.Description>
      <header className="da-pk-top">
        <div className="min-w-0">
          <p className="dl-eyebrow flex items-center gap-1.5"><span className="da-pk-dot" aria-hidden /> Live event · Player screen</p>
          <DialogPrimitive.Title className="dl-display text-base font-black truncate">{props.draftTitle}</DialogPrimitive.Title>
        </div>
        <div className="flex items-center gap-1.5">
          {props.projectorPath && (
            <a
              href={props.projectorPath}
              target="_blank"
              rel="noreferrer"
              className="da-pk-icon btn-press"
              aria-label="Open projector"
              title="Open projector"
            >
              <MonitorPlay className="w-5 h-5" />
            </a>
          )}
          <DraftArenaAppearance />
          <button
            type="button"
            className="da-pk-icon btn-press"
            aria-label="Player sound"
            aria-pressed={soundEnabled}
            disabled={props.sound === false}
            title={props.sound === false ? 'Room sound is disabled' : soundEnabled ? 'Mute sound on this device' : 'Enable sound on this device'}
            onClick={() => {
              if (!audioOn) kioskSound.unlock();
              setAudioOn((current) => !current);
            }}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            type="button"
            className="da-pk-icon btn-press"
            onClick={() => (isFs ? void exitFullscreen() : void enterFullscreen())}
            aria-label={isFs ? 'Exit full screen' : 'Enter full screen'}
          >
            {isFs ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button type="button" className="da-pk-icon btn-press" onClick={close} aria-label="Back to event">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div ref={workspaceRef} className="da-pk-body da-pk-workspace" role="region" aria-label="Live draft content" tabIndex={0}>
        <aside className="da-pk-rail">
          <section className="dl-card da-pk-clock">
            <LiveClockDial clock={clock} size={96} />
            <div className="min-w-0 flex-1">
              <p className="dl-eyebrow">Round {props.currentRound} of {props.numRounds} · Pick {Math.min(props.currentPickNumber, props.totalPicks)}/{props.totalPicks}</p>
              <p className="dl-display text-xl font-black leading-tight" role="status">{status}</p>
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

        </aside>

        <main className="da-pk-main">
          <nav className="da-pk-view-tabs" role="tablist" aria-label="Player screen workspace">
            {views.map((item, index) => (
              <button
                type="button"
                role="tab"
                id={`${panelId}-${item.id}-tab`}
                aria-controls={`${panelId}-${item.id}-panel`}
                aria-selected={activeView === item.id}
                tabIndex={activeView === item.id ? 0 : -1}
                key={item.id}
                onClick={() => setView(item.id)}
                onKeyDown={(event) => {
                  const next = event.key === 'ArrowRight' ? (index + 1) % views.length
                    : event.key === 'ArrowLeft' ? (index - 1 + views.length) % views.length
                      : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : null;
                  if (next === null) return;
                  event.preventDefault();
                  setView(views[next].id);
                  document.getElementById(`${panelId}-${views[next].id}-tab`)?.focus();
                }}
              >{item.label}</button>
            ))}
          </nav>
          <div ref={panelsRef} className="da-pk-view-panels">
          <section className="da-pk-board" role="tabpanel" id={`${panelId}-board-panel`} aria-labelledby={`${panelId}-board-tab`} hidden={activeView !== 'board'}>{props.board}</section>
          <section className="dl-card p-4" role="tabpanel" id={`${panelId}-team-panel`} aria-labelledby={`${panelId}-team-tab`} hidden={activeView !== 'team'}>
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

          <section role="tabpanel" id={`${panelId}-desk-panel`} aria-labelledby={`${panelId}-desk-tab`} hidden={activeView !== 'desk'}>{props.desk}</section>
          {props.hostControls && <section role="tabpanel" id={`${panelId}-host-panel`} aria-labelledby={`${panelId}-host-tab`} hidden={activeView !== 'host'}>{props.hostControls}</section>}
          <section className="da-pk-feed-grid" role="tabpanel" id={`${panelId}-feed-panel`} aria-labelledby={`${panelId}-feed-tab`} hidden={activeView !== 'feed'}>
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
          </section>
          </div>
        </main>
      </div>

      <PlayerPickReveals picks={props.allPicks ?? []} announce={props.announce ?? true} sound={props.sound ?? true} muted={!audioOn} />
    </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </>;
}

/** Mounted only after entry, so returning never replays events from a closed screen. */
function PlayerPickReveals({ picks, announce, sound, muted }: {
  picks: (KioskPick & { name: string })[];
  announce: boolean;
  sound: boolean;
  muted: boolean;
}) {
  const nameByPick = new Map(picks.map((pick) => [pick.user_id, pick.name]));
  const { reveal, reduceMotion } = usePickReveals({
    picks,
    loading: false,
    announce,
    sound,
    muted,
    nameFor: (userId) => (userId ? nameByPick.get(userId) : undefined) ?? 'Player',
  });
  return <div className="da-player-reveal" aria-hidden="true" style={{ pointerEvents: 'none' }}><PickRevealOverlay reveal={reveal} reduceMotion={reduceMotion} /></div>;
}

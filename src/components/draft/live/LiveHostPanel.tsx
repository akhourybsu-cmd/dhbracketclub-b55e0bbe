import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SkipForward,
  MonitorPlay,
  Link2,
  TimerOff,
} from 'lucide-react';
import { LiveClockDial } from './LiveClockDial';
import { LiveDraftSettingsSheet } from './LiveDraftSettingsSheet';
import { formatClock, kioskPath, kioskUrl, type LiveClockState, type LiveDraftSettings } from '@/lib/draft/liveDraft';

interface LiveHostPanelProps {
  draftId: string;
  clock: LiveClockState;
  settings: LiveDraftSettings;
  busy: boolean;
  pickerName: string;
  onDeckName?: string;
  kioskCode?: string | null;
  slotsLeft: number;
  /** Monotonic slot identity from the parent; labels are never a turn key. */
  turnKey?: string | number;
  onStartClock: () => Promise<void> | void;
  onStopClock: () => Promise<void> | void;
  onPause: () => Promise<void> | void;
  onResume: () => Promise<void> | void;
  onAddTime: (seconds: number) => Promise<void> | void;
  onSkip: () => Promise<void> | void;
  onSaveSettings: (patch: Partial<LiveDraftSettings>) => Promise<void> | void;
  onEnsureKioskCode: () => Promise<string>;
}

type HostAction = 'start' | 'reset' | 'pause' | 'resume' | 'extend' | 'stop' | 'skip' | 'copyPlayer' | 'copyProjector' | 'settings';
const ACTION_COPY: Record<HostAction, { pending: string; failed: string; retry: string }> = {
  start: { pending: 'Starting the clock…', failed: 'The clock could not be started.', retry: 'Retry start clock' },
  reset: { pending: 'Resetting the clock…', failed: 'The clock could not be reset.', retry: 'Retry reset clock' },
  pause: { pending: 'Pausing the clock…', failed: 'The clock could not be paused.', retry: 'Retry pause' },
  resume: { pending: 'Resuming the clock…', failed: 'The clock could not be resumed.', retry: 'Retry resume' },
  extend: { pending: 'Adding 30 seconds…', failed: 'Time could not be added.', retry: 'Retry adding 30 seconds' },
  stop: { pending: 'Stopping the clock…', failed: 'The clock could not be stopped.', retry: 'Retry clock off' },
  skip: { pending: 'Passing the pick…', failed: 'The pick could not be passed. Review the current picker and confirm again.', retry: 'Review pass' },
  copyPlayer: { pending: 'Copying player invite…', failed: 'The player invite could not be copied.', retry: 'Retry player invite' },
  copyProjector: { pending: 'Copying projector link…', failed: 'The projector link could not be copied.', retry: 'Retry projector link' },
  settings: { pending: 'Saving room settings…', failed: 'Room settings could not be saved.', retry: 'Review settings' },
};

/**
 * The host's command center: one place to run the room — shared clock,
 * pause/extend/skip, projector link, and the live settings.
 */
export function LiveHostPanel({
  draftId,
  clock,
  settings,
  busy,
  pickerName,
  onDeckName,
  kioskCode,
  slotsLeft,
  turnKey,
  onStartClock,
  onStopClock,
  onPause,
  onResume,
  onAddTime,
  onSkip,
  onSaveSettings,
  onEnsureKioskCode,
}: LiveHostPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const identity = JSON.stringify([draftId, turnKey ?? null, slotsLeft, pickerName]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const mounted = useRef(true);
  const pending = useRef(false);
  const [pendingAction, setPendingAction] = useState<HostAction | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ action: HostAction; identity: string } | null>(null);
  const confirmSkip = confirmation === identity && slotsLeft > 0;
  const visibleFailure = failure?.identity === identity ? failure : null;
  const disabled = busy || pendingAction !== null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    setConfirmation(null);
    setFailure(null);
  }, [identity]);

  const copyPlayerInvite = async () => {
    const playerUrl = new URL(`/drafts/live/${encodeURIComponent(draftId)}`, kioskUrl(draftId)).href;
    await navigator.clipboard.writeText(playerUrl);
    if (mounted.current) toast.success('Player invite copied');
  };

  const copyProjectorLink = async () => {
    const code = await onEnsureKioskCode();
    await navigator.clipboard.writeText(kioskUrl(draftId));
    if (mounted.current) toast.success(`Projector link copied — room code ${code}`);
  };

  const run = async (action: HostAction, work: () => Promise<void> | void, expectedIdentity = identity, propagate = false) => {
    if (pending.current || busy || expectedIdentity !== currentIdentity.current) {
      if (propagate) throw new Error('Another host action is still finishing. Try again.');
      return;
    }
    // The ref closes the gap before React or the parent renders its busy state.
    pending.current = true;
    setPendingAction(action);
    setFailure(null);
    if (action === 'skip') setConfirmation(null);
    try {
      await work();
      if (action === 'skip' && mounted.current) toast.success('Pick passed');
    } catch (error) {
      if (mounted.current && expectedIdentity === currentIdentity.current) setFailure({ action, identity: expectedIdentity });
      if (propagate) throw error;
    } finally {
      pending.current = false;
      if (mounted.current) setPendingAction(null);
    }
  };

  const retry = () => {
    if (!visibleFailure || visibleFailure.identity !== currentIdentity.current || pending.current || busy) return;
    const action = visibleFailure.action;
    if (action === 'skip') {
      setFailure(null);
      if (slotsLeft > 0) setConfirmation(identity);
    } else if (action === 'settings') {
      setFailure(null);
      setSettingsOpen(true);
    } else {
      const commands = { start: onStartClock, reset: onStartClock, pause: onPause, resume: onResume, extend: () => onAddTime(30), stop: onStopClock, copyPlayer: copyPlayerInvite, copyProjector: copyProjectorLink };
      void run(action, commands[action], visibleFailure.identity);
    }
  };

  return (
    <div className="dl-card da-live-host-panel p-4 space-y-4" aria-busy={pendingAction !== null} data-host-action={pendingAction ?? undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="dl-eyebrow">Host Controls</p>
          <h3 className="dl-display text-base font-bold">Draft Center</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {slotsLeft} {slotsLeft === 1 ? 'slot' : 'slots'} left · {formatClock(settings.pickSeconds * 1000)} per pick
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          disabled={disabled}
          className="w-11 h-11 rounded-lg flex items-center justify-center text-muted-foreground border border-border/70 btn-press"
          aria-label="Live draft settings"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <LiveClockDial clock={clock} size={104} />
        <div className="min-w-0 flex-1">
          <p className="dl-eyebrow">On the clock</p>
          <p className="dl-display text-[17px] font-bold truncate">{pickerName}</p>
          {onDeckName && <p className="text-[11px] text-muted-foreground truncate">On deck: {onDeckName}</p>}
          {clock.expired && (
            <p className="text-[11px] font-bold mt-1" style={{ color: 'hsl(0 84% 62%)' }}>
              Clock expired — extend or pass the pick.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {clock.running && !clock.paused ? (
          <button type="button" disabled={disabled} onClick={() => void run('pause', onPause)} className="dl-host-btn">
            <Pause className="w-4 h-4" /> Pause
          </button>
        ) : clock.paused ? (
          <button type="button" disabled={disabled} onClick={() => void run('resume', onResume)} className="dl-host-btn">
            <Play className="w-4 h-4" /> Resume
          </button>
        ) : (
          <button type="button" disabled={disabled} onClick={() => void run('start', onStartClock)} className="dl-host-btn">
            <Play className="w-4 h-4" /> Start clock
          </button>
        )}
        <button type="button" disabled={disabled} onClick={() => void run('extend', () => onAddTime(30))} className="dl-host-btn">
          <Plus className="w-4 h-4" /> 30 seconds
        </button>
        <button type="button" disabled={disabled} onClick={() => void run('reset', onStartClock)} className="dl-host-btn">
          <RotateCcw className="w-4 h-4" /> Reset clock
        </button>
        {clock.running ? (
          <button type="button" disabled={disabled} onClick={() => void run('stop', onStopClock)} className="dl-host-btn">
            <TimerOff className="w-4 h-4" /> Clock off
          </button>
        ) : (
          <span className="dl-host-btn opacity-50 pointer-events-none">
            <TimerOff className="w-4 h-4" /> Clock off
          </span>
        )}
        {confirmSkip ? (
          <div className="da-host-pass-confirmation col-span-2" role="group" aria-label={`Confirm passing ${pickerName}`}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (confirmation !== currentIdentity.current || slotsLeft <= 0) return;
              void run('skip', onSkip, confirmation);
            }}
            className="dl-host-btn dl-host-btn-danger w-full"
          >
            <SkipForward className="w-4 h-4" /> Confirm — pass {pickerName}
          </button>
          <button type="button" onClick={() => { setConfirmation(null); setFailure(null); }} className="dl-host-btn w-full mt-2">Cancel pass</button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || slotsLeft <= 0}
            onClick={() => { setFailure(null); setConfirmation(identity); }}
            className="dl-host-btn col-span-2"
          >
            <SkipForward className="w-4 h-4" /> Pass this pick
          </button>
        )}
      </div>

      {pendingAction && <p className="da-host-action-status text-xs text-muted-foreground" role="status">{ACTION_COPY[pendingAction].pending}</p>}
      {visibleFailure && <div className="da-host-action-error rounded-xl border border-destructive/40 p-3" role="alert">
        <p className="text-xs text-foreground">{ACTION_COPY[visibleFailure.action].failed}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={disabled} onClick={retry} className="dl-host-btn">{ACTION_COPY[visibleFailure.action].retry}</button>
          <button type="button" onClick={() => setFailure(null)} className="dl-host-btn" aria-label="Dismiss host action error">Dismiss</button>
        </div>
      </div>}

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
        <button type="button" disabled={disabled} onClick={() => void run('copyPlayer', copyPlayerInvite)} className="dl-host-btn mt-2 col-span-2">
          <Link2 className="w-4 h-4" /> Copy player invite
        </button>
        <Link to={kioskPath(draftId)} target="_blank" rel="noreferrer" className="dl-host-btn mt-2">
          <MonitorPlay className="w-4 h-4" /> Open projector
        </Link>
        <button type="button" disabled={disabled} onClick={() => void run('copyProjector', copyProjectorLink)} className="dl-host-btn mt-2">
          <Link2 className="w-4 h-4" /> Copy projector link
        </button>
        {kioskCode && (
          <p className="col-span-2 text-center text-[11px] text-muted-foreground">
            Room code <span className="dl-display font-bold tracking-[0.2em]">{kioskCode}</span>
          </p>
        )}
      </div>

      <LiveDraftSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={async (patch) => { await run('settings', () => onSaveSettings(patch), identity, true); }}
      />
    </div>
  );
}

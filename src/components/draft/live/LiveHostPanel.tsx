import { useState } from 'react';
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
  onStartClock: () => Promise<void> | void;
  onStopClock: () => Promise<void> | void;
  onPause: () => Promise<void> | void;
  onResume: () => Promise<void> | void;
  onAddTime: (seconds: number) => Promise<void> | void;
  onSkip: () => Promise<void> | void;
  onSaveSettings: (patch: Partial<LiveDraftSettings>) => Promise<void> | void;
  onEnsureKioskCode: () => Promise<string>;
}

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
  const [confirmSkip, setConfirmSkip] = useState(false);

  const copyLink = async () => {
    try {
      const code = await onEnsureKioskCode();
      await navigator.clipboard.writeText(kioskUrl(draftId));
      toast.success(`Projector link copied — room code ${code}`);
    } catch {
      toast.error('Could not copy the projector link');
    }
  };

  return (
    <div className="dl-card da-live-host-panel p-4 space-y-4">
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
          <button type="button" disabled={busy} onClick={() => void onPause()} className="dl-host-btn">
            <Pause className="w-4 h-4" /> Pause
          </button>
        ) : clock.paused ? (
          <button type="button" disabled={busy} onClick={() => void onResume()} className="dl-host-btn">
            <Play className="w-4 h-4" /> Resume
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void onStartClock()} className="dl-host-btn">
            <Play className="w-4 h-4" /> Start clock
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => void onAddTime(30)} className="dl-host-btn">
          <Plus className="w-4 h-4" /> 30 seconds
        </button>
        <button type="button" disabled={busy} onClick={() => void onStartClock()} className="dl-host-btn">
          <RotateCcw className="w-4 h-4" /> Reset clock
        </button>
        {clock.running ? (
          <button type="button" disabled={busy} onClick={() => void onStopClock()} className="dl-host-btn">
            <TimerOff className="w-4 h-4" /> Clock off
          </button>
        ) : (
          <span className="dl-host-btn opacity-50 pointer-events-none">
            <TimerOff className="w-4 h-4" /> Clock off
          </span>
        )}
        {confirmSkip ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setConfirmSkip(false);
              await onSkip();
              toast.success('Pick passed');
            }}
            className="dl-host-btn dl-host-btn-danger col-span-2"
          >
            <SkipForward className="w-4 h-4" /> Confirm — pass {pickerName}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || slotsLeft === 0}
            onClick={() => setConfirmSkip(true)}
            className="dl-host-btn col-span-2"
          >
            <SkipForward className="w-4 h-4" /> Pass this pick
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
        <Link to={kioskPath(draftId)} target="_blank" rel="noreferrer" className="dl-host-btn mt-2">
          <MonitorPlay className="w-4 h-4" /> Open projector
        </Link>
        <button type="button" onClick={copyLink} className="dl-host-btn mt-2">
          <Link2 className="w-4 h-4" /> Copy link
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
        onSave={onSaveSettings}
      />
    </div>
  );
}

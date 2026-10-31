import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';
import {
  PICK_SECONDS_OPTIONS,
  TIMEOUT_BEHAVIOR_HINTS,
  TIMEOUT_BEHAVIOR_LABELS,
  type LiveDraftSettings,
  type PickTimeoutBehavior,
} from '@/lib/draft/liveDraft';

interface LiveDraftSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  settings: LiveDraftSettings;
  onSave: (patch: Partial<LiveDraftSettings>) => Promise<void> | void;
}

const BEHAVIORS: PickTimeoutBehavior[] = ['alert', 'auto_skip', 'none'];

/** Host settings retain the existing model and are saved only on confirmation. */
export function LiveDraftSettingsSheet({ open, onClose, settings, onSave }: LiveDraftSettingsSheetProps) {
  const { palette } = useDraftArenaPalette();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const pending = useRef(false);
  const session = useRef(0);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setSaveError('');
    }
  }, [open, settings]);

  useEffect(() => {
    session.current += 1;
    return () => { session.current += 1; };
  }, [open]);

  const save = async () => {
    if (pending.current) return;
    pending.current = true;
    const currentSession = session.current;
    setSaving(true);
    setSaveError('');
    try {
      await onSave(draft);
      if (session.current === currentSession) onClose();
    } catch {
      if (session.current === currentSession) setSaveError('Settings could not be saved. Try again.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="z-[90] bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="da-appearance-panel da-lounge da-arena-dialog da-live-settings-dialog fixed left-1/2 z-[91] grid w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-2xl border p-4 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-left-1/2 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-top-[48%] data-[state=closed]:slide-out-to-top-[48%]"
          data-da-palette={palette}
          style={{
            top: 'calc(var(--da-viewport-height, 100dvh) / 2)',
            maxHeight: 'calc(var(--da-viewport-height, 100dvh) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px)',
            background: 'hsl(var(--popover))',
            color: 'hsl(var(--foreground))',
          }}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
        >
          <header className="da-live-settings-heading flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="dl-eyebrow">Live Draft</p>
              <DialogTitle className="dl-display text-xl font-bold">Room Settings</DialogTitle>
              <DialogDescription className="mt-1 text-xs">Clock, expiry and projector presentation.</DialogDescription>
            </div>
            <button type="button" onClick={onClose} aria-label="Close settings"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="da-live-settings-body min-h-0 min-w-0 space-y-5 overflow-y-auto overscroll-contain pr-1">
            <section>
              <p className="form-label">Time per pick</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Time per pick">
                {PICK_SECONDS_OPTIONS.map(sec => (
                  <button key={sec} type="button" disabled={saving} aria-pressed={draft.pickSeconds === sec}
                    onClick={() => setDraft(d => ({ ...d, pickSeconds: sec }))}
                    className={cn('min-h-11 min-w-11 rounded-lg border px-3 text-[12px] font-bold tabular-nums disabled:opacity-50',
                      draft.pickSeconds === sec ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border/70')}>
                    {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="form-label">When the clock hits zero</p>
              <div className="space-y-2" role="group" aria-label="Clock expiry">
                {BEHAVIORS.map(b => (
                  <button key={b} type="button" disabled={saving} aria-pressed={draft.timeoutBehavior === b}
                    onClick={() => setDraft(d => ({ ...d, timeoutBehavior: b }))}
                    className={cn('min-h-11 w-full rounded-xl border p-3 text-left disabled:opacity-50',
                      draft.timeoutBehavior === b ? 'border-primary bg-primary/10' : 'border-border/70')}>
                    <span className="flex items-center gap-2">
                      <span className="dl-display min-w-0 flex-1 text-[13px] font-bold">{TIMEOUT_BEHAVIOR_LABELS[b]}</span>
                      {draft.timeoutBehavior === b && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{TIMEOUT_BEHAVIOR_HINTS[b]}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="form-label">Room theatrics</p>
              {([
                ['autoStartClock', 'Start the next clock automatically'],
                ['announce', 'Announce each pick on the big screen'],
                ['ticker', 'Ticker tape of recent picks'],
                ['sound', 'Kiosk sound effects'],
                ['ceremony', 'Dramatic pick-order reveal on projector'],
                ['broadcast', 'Broadcast moments and milestones'],
                ['reportBroadcast', 'Broadcast the full draft report'],
              ] as [keyof LiveDraftSettings, string][]).map(([key, label]) => (
                <button key={String(key)} type="button" role="switch" aria-checked={Boolean(draft[key])} disabled={saving}
                  onClick={() => setDraft(d => ({ ...d, [key]: !d[key] }))}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/70 p-3 text-left disabled:opacity-50">
                  <span className="min-w-0 text-[13px] font-semibold">{label}</span>
                  <span aria-hidden="true" className={cn('relative h-6 w-11 shrink-0 rounded-full', draft[key] ? 'bg-primary' : 'bg-muted')}>
                    <span className="absolute top-0.5 h-5 w-5 rounded-full bg-background" style={{ left: draft[key] ? 22 : 2 }} />
                  </span>
                </button>
              ))}
            </section>
          </div>

          <footer className="da-live-settings-footer border-t border-border/60 pt-3">
            {saveError && <p className="mb-2 text-xs text-destructive" role="alert">{saveError}</p>}
            <button type="button" onClick={() => void save()} disabled={saving} className="dl-cta min-h-11 w-full disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

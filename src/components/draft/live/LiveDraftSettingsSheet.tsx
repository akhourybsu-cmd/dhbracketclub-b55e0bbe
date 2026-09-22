import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
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

/** Host settings for a live draft — clock length, expiry rule, room theatrics. */
export function LiveDraftSettingsSheet({ open, onClose, settings, onSave }: LiveDraftSettingsSheetProps) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="da-mode da-lounge fixed inset-x-0 bottom-0 z-[91] max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t"
            style={{
              background: 'hsl(var(--card))',
              borderColor: 'hsl(var(--border))',
              paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div>
                <p className="dl-eyebrow">Live Draft</p>
                <h2 className="dl-display text-lg font-bold">Room Settings</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="w-11 h-11 rounded-lg flex items-center justify-center text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 space-y-5">
              <section>
                <p className="form-label">Time per pick</p>
                <div className="flex flex-wrap gap-2">
                  {PICK_SECONDS_OPTIONS.map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDraft(d => ({ ...d, pickSeconds: sec }))}
                      className={cn(
                        'px-3 h-10 rounded-lg text-[12px] font-bold tabular-nums btn-press border',
                        draft.pickSeconds === sec
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'text-muted-foreground border-border/70',
                      )}
                    >
                      {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="form-label">When the clock hits zero</p>
                <div className="space-y-2">
                  {BEHAVIORS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setDraft(d => ({ ...d, timeoutBehavior: b }))}
                      className={cn(
                        'w-full text-left rounded-xl p-3 border btn-press',
                        draft.timeoutBehavior === b ? 'border-primary bg-primary/10' : 'border-border/70',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="dl-display text-[13px] font-bold flex-1">{TIMEOUT_BEHAVIOR_LABELS[b]}</span>
                        {draft.timeoutBehavior === b && <Check className="w-4 h-4 text-primary" />}
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {TIMEOUT_BEHAVIOR_HINTS[b]}
                      </span>
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
                  ['ceremony', 'Pre-draft order ceremony'],
                  ['broadcast', 'Broadcast moments and milestones'],
                ] as [keyof LiveDraftSettings, string][]).map(([key, label]) => (
                  <button
                    key={String(key)}
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, [key]: !d[key] }))}
                    className="w-full flex items-center justify-between rounded-xl p-3 border border-border/70 btn-press"
                  >
                    <span className="text-[13px] font-semibold">{label}</span>
                    <span
                      className={cn(
                        'w-11 h-6 rounded-full relative transition-colors',
                        draft[key] ? 'bg-primary' : 'bg-muted',
                      )}
                    >
                      <span
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-background transition-all"
                        style={{ left: draft[key] ? 22 : 2 }}
                      />
                    </span>
                  </button>
                ))}
              </section>

              <button type="button" onClick={save} disabled={saving} className="dl-cta w-full">
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

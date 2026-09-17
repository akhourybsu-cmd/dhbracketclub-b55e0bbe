import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Play, Pause, RotateCcw, Flame } from 'lucide-react';
import { useStopwatch } from '@/lib/workout/useStopwatch';
import { scoreEntry, fmtDur, type LogKind, type LogSet } from '@/lib/workout/logScoring';
import { loadDraft, saveDraft, clearDraft, draftMatchesPick } from '@/lib/workout/logDraft';
import type { ExercisePick } from './ExerciseSearchSheet';
import type { AddEntryInput } from '@/hooks/useWorkoutLog';

/** Prefill for editing an existing entry. */
export interface EntryDraft {
  sets?: LogSet[];
  reps?: number | null;
  seconds?: number | null;
  distanceMi?: number | null;
}

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function Stepper({ value, onChange, step = 1, min = 0, label, suffix }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; label: string; suffix?: string;
}) {
  return (
    <div className="flex-1">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1 text-center" style={{ color: 'hsl(28 30% 58%)' }}>{label}</p>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
          className="fg-key w-9 h-10 rounded-lg text-[18px] font-black flex-shrink-0">−</button>
        <input type="number" inputMode="decimal" value={value === 0 ? '' : value} placeholder="0"
          onChange={(e) => onChange(Math.max(min, num(e.target.value)))}
          className="w-full h-10 rounded-lg text-center text-[16px] font-black tabular-nums outline-none"
          style={{ background: 'hsl(220 14% 14%)', border: '1px solid hsl(24 40% 55% / 0.2)', color: 'hsl(30 35% 94%)' }} />
        <button type="button" onClick={() => onChange(Math.round((value + step) * 100) / 100)}
          className="fg-key w-9 h-10 rounded-lg text-[18px] font-black flex-shrink-0">+</button>
      </div>
      {suffix && <p className="text-[8px] text-center mt-0.5" style={{ color: 'hsl(28 25% 52%)' }}>{suffix}</p>}
    </div>
  );
}

/**
 * The per-movement entry editor. Renders the right inputs for the pick's
 * log_kind (weight×reps sets, bodyweight sets, a live/manual timer, a cardio
 * distance+time, a distance, or a plain completion) and previews the fuel the
 * entry will earn. Emits one AddEntryInput on save. Portaled to <body>.
 */
export function LogEntrySheet({ pick, sessionId, onClose, onSave }: {
  pick: ExercisePick | null;
  /** Session the draft is keyed to — lets a half-composed entry survive an app kill. */
  sessionId: string | null;
  onClose: () => void;
  onSave: (input: AddEntryInput) => Promise<unknown> | void;
  onAddAnother?: () => void;
}) {
  const kind = pick?.logKind ?? 'reps';
  const [sets, setSets] = useState<LogSet[]>([{ weight: null, reps: null }]);
  const [seconds, setSeconds] = useState(0);
  const [distanceMi, setDistanceMi] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Live timer for timed / cardio-time entries. Persists on its own
  // (timestamp-based localStorage) so a running clock survives an app kill.
  const timerKey = pick ? `dh_workout_log_timer_v1:${pick.catalogId ?? pick.name}` : 'dh_workout_log_timer_v1:none';
  const sw = useStopwatch(timerKey);

  // (Re)initialise whenever a new pick opens the sheet — restoring any draft
  // the member had in progress for this movement, so closing the app
  // mid-exercise and returning picks up exactly where they left off.
  useEffect(() => {
    if (!pick) { setHydrated(false); return; }
    const draft = loadDraft(sessionId);
    if (draftMatchesPick(draft, pick)) {
      setSets(draft!.sets?.length ? draft!.sets : [{ weight: null, reps: null }]);
      setSeconds(draft!.seconds ?? 0);
      setDistanceMi(draft!.distanceMi ?? 0);
      // The timer restores itself from its own timestamp store — don't reset.
    } else {
      setSets([{ weight: null, reps: null }]);
      setSeconds(0);
      setDistanceMi(0);
      sw.reset(); // fresh movement — clear any stale timer under this key
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick?.catalogId, pick?.name, sessionId]);

  // Autosave the in-progress draft as the member composes it.
  useEffect(() => {
    if (!pick || !sessionId || !hydrated) return;
    saveDraft(sessionId, { pick, sets, seconds, distanceMi });
  }, [pick, sessionId, sets, seconds, distanceMi, hydrated]);

  // Fold the running timer into the seconds value for timed/cardio kinds.
  const liveSeconds = (kind === 'duration' || kind === 'cardio') && sw.started
    ? Math.round(sw.elapsedMs / 1000)
    : seconds;

  const draft = useMemo(() => ({
    log_kind: kind, sets,
    reps: null as number | null,
    seconds: liveSeconds || null,
    distance_mi: distanceMi || null,
  }), [kind, sets, liveSeconds, distanceMi]);
  const preview = useMemo(() => scoreEntry(draft), [draft]);

  const canSave = useMemo(() => {
    switch (kind) {
      case 'weight_reps':
      case 'reps': return sets.some((s) => (Number(s.reps) || 0) > 0);
      case 'duration': return liveSeconds > 0;
      case 'distance': return distanceMi > 0;
      case 'cardio': return distanceMi > 0 || liveSeconds > 0;
      case 'completion': return true;
      default: return false;
    }
  }, [kind, sets, liveSeconds, distanceMi]);

  const setSet = (i: number, patch: Partial<LogSet>) =>
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSet = () =>
    setSets((prev) => [...prev, { weight: prev[prev.length - 1]?.weight ?? null, reps: prev[prev.length - 1]?.reps ?? null }]);
  const removeSet = (i: number) =>
    setSets((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const handleSave = async (addAnother = false) => {
    if (!pick || !canSave || saving) return;
    setSaving(true);
    try {
      const cleanSets = (kind === 'weight_reps' || kind === 'reps')
        ? sets.filter((s) => (Number(s.reps) || 0) > 0).map((s) => ({ weight: s.weight || null, reps: Number(s.reps) || 0 }))
        : [];
      await onSave({
        catalogId: pick.catalogId, exerciseName: pick.name, category: pick.category, logKind: kind,
        sets: cleanSets,
        reps: null,
        seconds: (kind === 'duration' || kind === 'cardio' || kind === 'completion') ? (liveSeconds || null) : null,
        distanceMi: (kind === 'distance' || kind === 'cardio') ? (distanceMi || null) : null,
        unit: null,
      });
      clearDraft(sessionId);
      sw.reset();
      onClose();
      if (addAnother) window.requestAnimationFrame(() => onAddAnother?.());
    } finally {
      setSaving(false);
    }
  };

  // Explicitly cancel this entry — discard the draft + any running timer.
  const abandon = () => {
    clearDraft(sessionId);
    sw.reset();
    onClose();
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {pick && (
        <motion.div className="fg-mode fixed inset-0 z-[70] flex flex-col justify-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={abandon} aria-hidden />
          <motion.div role="dialog" aria-modal="true" aria-label={`Log ${pick.name}`}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="relative rounded-t-3xl border-t px-5 pt-3"
            style={{ background: 'hsl(222 20% 9%)', borderColor: 'hsl(24 40% 60% / 0.18)', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div className="w-10 h-1.5 rounded-full mx-auto mb-3" style={{ background: 'hsl(28 20% 40% / 0.5)' }} aria-hidden />
            <div className="flex items-center justify-between mb-3">
              <div className="min-w-0">
                <h2 className="text-[17px] font-black tracking-tight truncate" style={{ color: 'hsl(30 40% 96%)' }}>{pick.name}</h2>
                {pick.category && <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(28 30% 56%)' }}>{pick.category}</p>}
              </div>
              <button onClick={abandon} aria-label="Close" className="fg-back flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            {/* ── Sets: weights or bodyweight reps ── */}
            {(kind === 'weight_reps' || kind === 'reps') && (
              <div className="space-y-2 mb-3">
                {sets.map((s, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <span className="w-6 text-center text-[13px] font-black tabular-nums pb-2.5 flex-shrink-0" style={{ color: 'hsl(28 30% 55%)' }}>{i + 1}</span>
                    {kind === 'weight_reps' && (
                      <Stepper label="Weight" suffix="lb" step={5} value={Number(s.weight) || 0} onChange={(v) => setSet(i, { weight: v })} />
                    )}
                    <Stepper label="Reps" step={1} value={Number(s.reps) || 0} onChange={(v) => setSet(i, { reps: v })} />
                    <button type="button" onClick={() => removeSet(i)} aria-label="Remove set"
                      className="fg-key w-9 h-10 rounded-lg flex-shrink-0 mb-0" disabled={sets.length <= 1}
                      style={{ opacity: sets.length <= 1 ? 0.35 : 1 }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addSet} className="fg-key w-full h-10 rounded-xl text-[13px]">
                  <Plus className="w-4 h-4" /> Add set
                </button>
              </div>
            )}

            {/* ── Timed hold / duration ── */}
            {kind === 'duration' && (
              <div className="mb-3">
                <div className="text-center mb-3">
                  <p className="text-[42px] font-black tabular-nums leading-none" style={{ color: 'hsl(30 40% 96%)' }}>{fmtDur(liveSeconds)}</p>
                </div>
                <div className="flex gap-2 mb-3">
                  {!sw.running ? (
                    <button onClick={sw.started ? sw.resume : sw.start} className="fg-cta flex-1 h-12 rounded-xl text-[15px]">
                      <Play className="w-5 h-5 fill-current" /> {sw.started ? 'Resume' : 'Start'}
                    </button>
                  ) : (
                    <button onClick={sw.pause} className="fg-cta flex-1 h-12 rounded-xl text-[15px]"><Pause className="w-5 h-5 fill-current" /> Pause</button>
                  )}
                  {sw.started && <button onClick={sw.reset} aria-label="Reset timer" className="fg-key w-12 h-12 rounded-xl"><RotateCcw className="w-5 h-5" /></button>}
                </div>
                <ManualMinutes seconds={seconds} onChange={(v) => { sw.reset(); setSeconds(v); }} disabled={sw.started} />
              </div>
            )}

            {/* ── Distance ── */}
            {kind === 'distance' && (
              <div className="mb-3">
                <Stepper label="Distance" suffix="miles" step={0.25} value={distanceMi} onChange={setDistanceMi} />
              </div>
            )}

            {/* ── Cardio: distance + time ── */}
            {kind === 'cardio' && (
              <div className="mb-3 space-y-3">
                <Stepper label="Distance" suffix="miles" step={0.25} value={distanceMi} onChange={setDistanceMi} />
                <div>
                  <div className="text-center mb-2">
                    <p className="text-[30px] font-black tabular-nums leading-none" style={{ color: 'hsl(30 40% 96%)' }}>{fmtDur(liveSeconds)}</p>
                  </div>
                  <div className="flex gap-2">
                    {!sw.running ? (
                      <button onClick={sw.started ? sw.resume : sw.start} className="fg-key flex-1 h-10 rounded-xl text-[13px]"><Play className="w-4 h-4 fill-current" /> {sw.started ? 'Resume' : 'Time it'}</button>
                    ) : (
                      <button onClick={sw.pause} className="fg-key flex-1 h-10 rounded-xl text-[13px]"><Pause className="w-4 h-4 fill-current" /> Pause</button>
                    )}
                    {sw.started && <button onClick={sw.reset} aria-label="Reset timer" className="fg-key w-10 h-10 rounded-xl"><RotateCcw className="w-4 h-4" /></button>}
                  </div>
                  {!sw.started && <div className="mt-2"><ManualMinutes seconds={seconds} onChange={setSeconds} /></div>}
                </div>
              </div>
            )}

            {/* ── Completion ── */}
            {kind === 'completion' && (
              <div className="mb-3">
                <p className="text-[13px] text-center mb-3" style={{ color: 'hsl(30 25% 74%)' }}>Log this as done. Add a duration for extra fuel (optional).</p>
                <ManualMinutes seconds={seconds} onChange={setSeconds} />
              </div>
            )}

            {/* Fuel preview + save */}
            <div className="flex items-center justify-between rounded-xl px-3.5 py-2.5 mb-3" style={{ background: 'hsl(24 60% 30% / 0.14)', border: '1px solid hsl(24 95% 55% / 0.2)' }}>
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'hsl(28 40% 64%)' }}>Fuel</span>
              <span className="inline-flex items-center gap-1.5 text-[18px] font-black tabular-nums" style={{ color: 'hsl(30 45% 95%)' }}>
                <Flame className="w-4 h-4" style={{ color: 'hsl(28 100% 66%)' }} /> +{preview.points.toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-1">
              {onAddAnother && (
                <button onClick={() => handleSave(true)} disabled={!canSave || saving}
                  className="fg-key h-12 rounded-xl text-[13px]"
                  style={{ opacity: !canSave || saving ? 0.5 : 1 }}>
                  Save + next
                </button>
              )}
              <button onClick={() => handleSave(false)} disabled={!canSave || saving}
                className="fg-cta h-12 rounded-xl text-[15px]"
                style={{ opacity: !canSave || saving ? 0.5 : 1, gridColumn: onAddAnother ? undefined : '1 / -1' }}>
                {saving ? 'Saving…' : 'Add to workout'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Manual minutes:seconds entry, shared by the timed kinds. */
function ManualMinutes({ seconds, onChange, disabled }: { seconds: number; onChange: (v: number) => void; disabled?: boolean }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <div className="flex items-end gap-2" style={{ opacity: disabled ? 0.4 : 1 }}>
      <Stepper label="Minutes" step={1} value={mins} onChange={(v) => onChange(v * 60 + secs)} />
      <span className="text-[20px] font-black pb-2" style={{ color: 'hsl(28 30% 55%)' }}>:</span>
      <Stepper label="Seconds" step={5} min={0} value={secs} onChange={(v) => onChange(mins * 60 + Math.min(59, v))} />
    </div>
  );
}

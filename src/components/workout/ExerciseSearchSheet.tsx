import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Plus, Dumbbell } from 'lucide-react';
import {
  searchCatalog, CATALOG_MUSCLES, type CatalogExercise, type LogKind,
} from '@/lib/workout/exerciseCatalog';
import type { ExercisePick } from '@/lib/workout/logScoring';

export type { ExercisePick } from '@/lib/workout/logScoring';

const KIND_CHIPS: { key: LogKind; label: string }[] = [
  { key: 'weight_reps', label: 'Weights' },
  { key: 'reps', label: 'Bodyweight' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'duration', label: 'Timed' },
];

const KIND_LABEL: Record<LogKind, string> = {
  weight_reps: 'Weights', reps: 'Reps', duration: 'Timed', distance: 'Distance', cardio: 'Cardio', completion: 'Done',
};

const QUICK_PICKS: ExercisePick[] = [
  { catalogId: null, name: 'Push-ups', category: 'quick start', logKind: 'reps' },
  { catalogId: null, name: 'Squats', category: 'quick start', logKind: 'reps' },
  { catalogId: null, name: 'Walk / run', category: 'quick start', logKind: 'cardio' },
  { catalogId: null, name: 'Plank', category: 'quick start', logKind: 'duration' },
];

/**
 * Full-catalog search + custom-entry sheet. Portaled to <body> per the DH
 * bottom-sheet convention. Searches the ~870-movement library instantly
 * (client-side), with log-kind + muscle facet chips, and lets a member log
 * anything not in the library as a custom movement.
 */
export function ExerciseSearchSheet({ open, onClose, onPick }: {
  open: boolean;
  onClose: () => void;
  onPick: (pick: ExercisePick) => void;
}) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<LogKind | null>(null);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [customKind, setCustomKind] = useState<LogKind>('weight_reps');

  const results = useMemo(
    () => searchCatalog(q, { kind, muscle, limit: 80 }),
    [q, kind, muscle],
  );
  const trimmed = q.trim();

  const pickCatalog = (e: CatalogExercise) =>
    onPick({ catalogId: e.id, name: e.name, category: e.group, logKind: e.logKind });
  const pickCustom = () =>
    onPick({ catalogId: null, name: trimmed || 'Custom exercise', category: 'custom', logKind: customKind });

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fg-mode fixed inset-0 z-[60] flex flex-col justify-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div role="dialog" aria-modal="true" aria-label="Find an exercise"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="relative rounded-t-3xl border-t px-4 pt-3"
            style={{ background: 'hsl(222 20% 9%)', borderColor: 'hsl(24 40% 60% / 0.18)', height: '88dvh', display: 'flex', flexDirection: 'column' }}>
            <div className="w-10 h-1.5 rounded-full mx-auto mb-3" style={{ background: 'hsl(28 20% 40% / 0.5)' }} aria-hidden />
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-[17px] font-black tracking-tight" style={{ color: 'hsl(30 40% 96%)' }}>Add an exercise</h2>
              <button onClick={onClose} aria-label="Close" className="fg-back"><X className="w-5 h-5" /></button>
            </div>

            {/* Search box */}
            <div className="relative mb-2.5">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(28 30% 55%)' }} />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search 870+ exercises…"
                className="w-full h-11 rounded-xl pl-9 pr-3 text-[14px] font-medium outline-none"
                style={{ background: 'hsl(220 14% 14%)', border: '1px solid hsl(24 40% 55% / 0.2)', color: 'hsl(30 30% 94%)' }} />
            </div>

            {/* Facet chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
              {KIND_CHIPS.map((c) => {
                const on = kind === c.key;
                return (
                  <button key={c.key} onClick={() => setKind(on ? null : c.key)}
                    className="flex-shrink-0 h-8 px-3 rounded-full text-[12px] font-bold whitespace-nowrap"
                    style={{
                      background: on ? 'hsl(24 95% 55% / 0.22)' : 'hsl(220 14% 15%)',
                      border: `1px solid ${on ? 'hsl(24 95% 55% / 0.55)' : 'hsl(24 30% 55% / 0.18)'}`,
                      color: on ? 'hsl(28 100% 70%)' : 'hsl(30 20% 72%)',
                    }}>{c.label}</button>
                );
              })}
              <select value={muscle ?? ''} onChange={(e) => setMuscle(e.target.value || null)}
                aria-label="Filter by muscle"
                className="flex-shrink-0 h-8 px-2.5 rounded-full text-[12px] font-bold outline-none"
                style={{ background: muscle ? 'hsl(24 95% 55% / 0.22)' : 'hsl(220 14% 15%)', border: `1px solid ${muscle ? 'hsl(24 95% 55% / 0.55)' : 'hsl(24 30% 55% / 0.18)'}`, color: muscle ? 'hsl(28 100% 70%)' : 'hsl(30 20% 72%)' }}>
                <option value="">Any muscle</option>
                {CATALOG_MUSCLES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto -mx-1 px-1 pb-2" style={{ overscrollBehavior: 'contain' }}>
              {!trimmed && (
                <div className="mb-2 rounded-2xl p-2.5" style={{ background: 'hsl(220 14% 13% / 0.72)', border: '1px solid hsl(24 35% 58% / 0.14)' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-2" style={{ color: 'hsl(28 36% 58%)' }}>Quick start</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_PICKS.map((p) => (
                      <button key={p.name} onClick={() => onPick(p)} className="fg-key min-h-[48px] rounded-xl px-3 py-2 flex-col items-start text-left">
                        <span className="text-[12px] font-black leading-tight">{p.name}</span>
                        <span className="text-[9px] font-bold opacity-65">{KIND_LABEL[p.logKind]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Custom-entry row — always offered so nothing is un-loggable */}
              <div className="flex items-center gap-2 py-2.5 px-1 mb-1 rounded-xl" style={{ background: 'hsl(24 60% 30% / 0.12)' }}>
                <button onClick={pickCustom} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(24 95% 55% / 0.18)', border: '1px solid hsl(24 95% 55% / 0.3)' }}>
                    <Plus className="w-4 h-4" style={{ color: 'hsl(28 100% 68%)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: 'hsl(30 35% 92%)' }}>
                      {trimmed ? `Log “${trimmed}”` : 'Log a custom exercise'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'hsl(28 25% 58%)' }}>Not in the library? Add it as {KIND_LABEL[customKind].toLowerCase()}.</p>
                  </div>
                </button>
                <select value={customKind} onChange={(e) => setCustomKind(e.target.value as LogKind)}
                  aria-label="Custom exercise type"
                  className="h-8 px-2 rounded-lg text-[11px] font-bold outline-none flex-shrink-0"
                  style={{ background: 'hsl(220 14% 16%)', border: '1px solid hsl(24 30% 55% / 0.2)', color: 'hsl(30 25% 78%)' }}>
                  <option value="weight_reps">Weights</option>
                  <option value="reps">Reps</option>
                  <option value="cardio">Cardio</option>
                  <option value="duration">Timed</option>
                  <option value="completion">Done</option>
                </select>
              </div>

              {results.map((e) => (
                <button key={e.id} onClick={() => pickCatalog(e)}
                  className="w-full flex items-center gap-2.5 py-2.5 px-1 text-left rounded-xl active:bg-white/[0.03]">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(220 14% 15%)', border: '1px solid hsl(24 30% 55% / 0.16)' }}>
                    <Dumbbell className="w-4 h-4" style={{ color: 'hsl(28 80% 62%)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: 'hsl(30 32% 92%)' }}>{e.name}</p>
                    <p className="text-[10px] truncate" style={{ color: 'hsl(28 22% 56%)' }}>
                      {[e.muscle, e.equipment].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-md flex-shrink-0"
                    style={{ background: 'hsl(24 95% 55% / 0.12)', color: 'hsl(28 70% 66%)' }}>{KIND_LABEL[e.logKind]}</span>
                </button>
              ))}
              {results.length === 0 && (
                <p className="text-center text-[12px] py-6" style={{ color: 'hsl(28 20% 58%)' }}>
                  No library match — use “Log {trimmed ? `“${trimmed}”` : 'a custom exercise'}” above.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

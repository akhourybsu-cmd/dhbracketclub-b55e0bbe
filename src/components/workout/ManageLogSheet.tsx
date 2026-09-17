import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, RotateCcw, ShieldAlert, ChevronDown } from 'lucide-react';
import { formatValue, MEASUREMENT_META } from '@/lib/workout/measurement';
import type { WorkoutActivity, WeekExerciseWithDef } from '@/lib/workout/types';

export interface ManageLogMember { id: string; display_name: string }

/**
 * "Manage my log" bottom sheet — lets a member delete individual entries
 * they logged this week (mis-taps, double-counted reps), clear a single
 * exercise, or reset their whole week. Club admins additionally get a
 * member picker so they can clean up someone else's week.
 *
 * All destructive calls go through the arena hook; RLS is the real
 * boundary (members can only delete their own rows).
 */
export function ManageLogSheet({
  open, onClose, weekId, weekTitle, viewerId, isAdmin, members,
  weekExercises, weekActivities,
  onDeleteActivity, onResetWeek,
}: {
  open: boolean;
  onClose: () => void;
  weekId: string | null;
  weekTitle: string;
  viewerId: string | undefined;
  isAdmin: boolean;
  members: ManageLogMember[];
  weekExercises: WeekExerciseWithDef[];
  weekActivities: WorkoutActivity[];
  onDeleteActivity: (id: string) => Promise<void>;
  onResetWeek: (weekId: string, userId: string, exerciseId?: string) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const subjectId = targetId ?? viewerId ?? '';
  const isSelf = subjectId === viewerId;
  const subjectName = isSelf ? 'You' : (members.find(m => m.id === subjectId)?.display_name ?? 'Member');

  const groups = useMemo(() => {
    const rows = weekActivities.filter(a => a.user_id === subjectId && !a.id.startsWith('opt-'));
    return weekExercises
      .map(we => ({
        we,
        entries: rows
          .filter(a => a.exercise_id === we.exercise_id)
          .sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1)),
      }))
      .filter(g => g.entries.length > 0);
  }, [weekActivities, weekExercises, subjectId]);

  const totalEntries = groups.reduce((t, g) => t + g.entries.length, 0);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fg-mode fixed inset-0 z-[60] flex flex-col justify-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Manage workout log"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="relative bg-background rounded-t-3xl border-t border-border/20 shadow-2xl px-5 pt-3"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))', maxHeight: '88dvh', overflowY: 'auto' }}
          >
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 mx-auto mb-3" aria-hidden />
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="text-[17px] font-black tracking-tight">Manage log</h2>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 truncate">{weekTitle}</p>
              </div>
              <button onClick={onClose} aria-label="Close"
                className="w-10 h-10 -mr-1 rounded-full flex items-center justify-center hover:bg-muted/50 btn-press flex-shrink-0">
                <X className="w-5 h-5 text-muted-foreground/70" />
              </button>
            </div>

            {isAdmin && members.length > 0 && (
              <div className="mb-4">
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1.5 mb-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Commissioner — whose log?
                </label>
                <div className="relative">
                  <select
                    value={subjectId}
                    onChange={(e) => { setTargetId(e.target.value); setConfirmReset(false); }}
                    className="w-full h-11 rounded-xl bg-muted/30 border border-border/30 px-3 pr-9 text-[14px] font-bold appearance-none"
                  >
                    {viewerId && <option value={viewerId}>You</option>}
                    {members.filter(m => m.id !== viewerId).map(m => (
                      <option key={m.id} value={m.id}>{m.display_name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/60" />
                </div>
              </div>
            )}

            {totalEntries === 0 ? (
              <p className="text-[13px] text-muted-foreground/70 text-center py-8">
                {isSelf ? 'Nothing logged this week yet.' : `${subjectName} hasn’t logged anything this week.`}
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map(({ we, entries }) => {
                  const mt = we.exercise.measurement_type;
                  const total = entries.reduce((t, a) => t + Number(a.raw_value), 0);
                  return (
                    <div key={we.id}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <p className="text-[13px] font-extrabold truncate">{we.exercise.name}</p>
                          <p className="text-[11px] text-muted-foreground/60 tabular-nums">
                            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {formatValue(mt, total)}
                          </p>
                        </div>
                        <button
                          disabled={!weekId || busy !== null}
                          onClick={() => weekId && run(`ex-${we.id}`, async () => onResetWeek(weekId, subjectId, we.exercise_id))}
                          className="text-[11px] font-bold px-2.5 h-8 rounded-lg bg-destructive/10 text-destructive border border-destructive/25 btn-press flex-shrink-0 disabled:opacity-50"
                        >
                          {busy === `ex-${we.id}` ? 'Clearing…' : 'Clear all'}
                        </button>
                      </div>
                      <div className="rounded-xl border border-border/20 overflow-hidden">
                        {entries.map((a, i) => (
                          <div key={a.id}
                            className="flex items-center gap-3 px-3 py-2"
                            style={{ borderTop: i ? '1px solid hsl(var(--border) / 0.2)' : 'none' }}>
                            <span className="text-[14px] font-black tabular-nums flex-1">
                              {formatValue(mt, Number(a.raw_value))}
                            </span>
                            <span className="text-[11px] text-muted-foreground/55">
                              {new Date(a.logged_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <button
                              aria-label={`Delete ${MEASUREMENT_META[mt].label} entry`}
                              disabled={busy !== null}
                              onClick={() => run(`a-${a.id}`, async () => onDeleteActivity(a.id))}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 btn-press flex-shrink-0 disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-3 border-t border-border/15">
                  {!confirmReset ? (
                    <button
                      disabled={!weekId}
                      onClick={() => setConfirmReset(true)}
                      className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-[14px] font-black bg-destructive/10 text-destructive border border-destructive/25 btn-press disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> Reset {isSelf ? 'my' : `${subjectName}’s`} week
                    </button>
                  ) : (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-[12px] font-bold mb-2.5">
                        Delete all {totalEntries} entries for {isSelf ? 'you' : subjectName} this week? This can’t be undone.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmReset(false)}
                          className="flex-1 h-11 rounded-xl text-[13px] font-bold bg-muted/40 btn-press">Cancel</button>
                        <button
                          disabled={busy !== null || !weekId}
                          onClick={() => weekId && run('reset', async () => {
                            await onResetWeek(weekId, subjectId);
                            setConfirmReset(false);
                          })}
                          className="flex-1 h-11 rounded-xl text-[13px] font-black bg-destructive text-destructive-foreground btn-press disabled:opacity-60"
                        >
                          {busy === 'reset' ? 'Resetting…' : 'Yes, reset'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

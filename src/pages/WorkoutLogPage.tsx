import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Flame, Check, Trash2, Dumbbell, Timer, ChevronDown, Sparkles, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { useWorkoutLog, type AddEntryInput } from '@/hooks/useWorkoutLog';
import { ExerciseSearchSheet, type ExercisePick } from '@/components/workout/ExerciseSearchSheet';
import { LogEntrySheet } from '@/components/workout/LogEntrySheet';
import { entrySummary, sessionPoints, fmtDur, type LogSessionWithEntries } from '@/lib/workout/logScoring';
import { loadDraft, clearDraft, type LogDraft } from '@/lib/workout/logDraft';

/** Live mm:ss elapsed since an ISO timestamp. */
function useElapsed(sinceIso: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!sinceIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sinceIso]);
  if (!sinceIso) return 0;
  return Math.max(0, Math.round((now - new Date(sinceIso).getTime()) / 1000));
}

/** One-shot "workout complete" overlay. Portaled; self-dismisses via onDone. */
function CompleteCelebration({ points, onDone }: { points: number | null; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (points == null) return;
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, [points, onDone]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {points != null && (
        <motion.div className="fixed inset-0 z-[95] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 60% at 50% 55%, hsl(24 100% 52% / 0.45), transparent 70%)' }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.75] }} transition={{ duration: 1 }} />
          <motion.div initial={{ scale: 0.5, opacity: 0, y: 16 }} animate={{ scale: [0.5, 1.12, 1], opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }} className="relative text-center px-6">
            {!reduceMotion && Array.from({ length: 10 }).map((_, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute left-1/2 top-1/2 text-[18px]"
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{ x: (i - 4.5) * 18, y: -42 - (i % 3) * 20, opacity: [0, 1, 0], scale: [0.4, 1, 0.75] }}
                transition={{ duration: 1.15, delay: i * 0.035, ease: 'easeOut' }}
              >
                ✦
              </motion.span>
            ))}
            <div className="text-[56px] leading-none mb-1">🔥</div>
            <h1 className="text-[26px] font-black tracking-[0.06em]" style={{ color: 'hsl(40 100% 92%)', textShadow: '0 0 26px hsl(24 100% 55% / 0.9)' }}>WORKOUT LOGGED</h1>
            <p className="text-[15px] font-black mt-1 tabular-nums" style={{ color: 'hsl(28 100% 70%)' }}>+{points.toLocaleString()} fuel to the flame</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function HistoryRow({ session, onDelete }: { session: LogSessionWithEntries; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const total = sessionPoints(session.entries);
  const when = session.completed_at ? new Date(session.completed_at) : new Date(session.started_at);
  return (
    <motion.div whileHover={reduceMotion ? undefined : { x: 2 }} style={{ borderTop: '1px solid hsl(220 14% 60% / 0.1)' }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(220 14% 16% / 0.9)', border: '1px solid hsl(24 60% 60% / 0.16)' }}>
          <Dumbbell className="w-4 h-4" style={{ color: 'hsl(28 80% 60%)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold truncate" style={{ color: 'hsl(30 30% 90%)' }}>{session.title || 'Freeform workout'}</p>
          <p className="text-[10px]" style={{ color: 'hsl(28 25% 55%)' }}>{when.toLocaleDateString()} · {session.entries.length} exercise{session.entries.length === 1 ? '' : 's'}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[13px] font-black tabular-nums flex-shrink-0" style={{ color: 'hsl(30 40% 94%)' }}>
          <Flame className="w-3.5 h-3.5" style={{ color: 'hsl(28 100% 66%)' }} />{total.toLocaleString()}
        </span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: 'hsl(28 30% 50%)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3.5 pb-3 space-y-1.5">
              {session.entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-[12px]">
                  <span className="truncate mr-2" style={{ color: 'hsl(30 25% 78%)' }}>{e.exercise_name}</span>
                  <span className="tabular-nums flex-shrink-0" style={{ color: 'hsl(28 25% 58%)' }}>{entrySummary(e)}</span>
                </div>
              ))}
              <button onClick={onDelete} className="fg-key w-full h-9 rounded-lg text-[12px] mt-1"><Trash2 className="w-3.5 h-3.5" /> Delete workout</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const QUICK_STARTS: ExercisePick[] = [
  { catalogId: null, name: 'Strength training', category: 'quick start', logKind: 'weight_reps' },
  { catalogId: null, name: 'Bodyweight circuit', category: 'quick start', logKind: 'reps' },
  { catalogId: null, name: 'Cardio session', category: 'quick start', logKind: 'cardio' },
  { catalogId: null, name: 'Timed hold', category: 'quick start', logKind: 'duration' },
];

export default function WorkoutLogPage() {
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { club } = useClub();
  const { isInstalled, loading: assetsLoading } = useClubAssets();
  const installed = isInstalled('workout-competition');
  const navigate = useNavigate();

  const {
    activeSession, history, myWeekPoints, clubWeekPoints, loading,
    startSession, addEntry, removeEntry, completeSession, discardSession, deleteSession,
  } = useWorkoutLog(club?.id, user?.id);

  const [pick, setPick] = useState<ExercisePick | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [finished, setFinished] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<LogDraft | null>(null);

  const elapsed = useElapsed(activeSession?.started_at ?? null);
  const runningTotal = useMemo(() => activeSession ? sessionPoints(activeSession.entries) : 0, [activeSession]);

  // Surface a half-composed entry left over from a previous visit (app kill)
  // so the member can resume it. Recomputed whenever the sheet closes.
  useEffect(() => {
    if (pick) return; // the sheet owns the draft while open
    setResumeDraft(loadDraft(activeSession?.id));
  }, [pick, activeSession?.id]);

  if (!assetsLoading && !installed) return <Navigate to="/dashboard" replace />;

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    try { await startSession(); } catch { toast.error('Could not start — try again'); } finally { setBusy(false); }
  };

  const handlePick = (p: ExercisePick) => { setSearchOpen(false); setPick(p); };

  const handleSaveEntry = async (input: AddEntryInput) => {
    let sessionId = activeSession?.id;
    if (!sessionId) {
      const s = await startSession();
      sessionId = s?.id;
    }
    if (!sessionId) { toast.error('No active session'); throw new Error('No active session'); }
    try {
      await addEntry(sessionId, input);
      try { navigator.vibrate?.(8); } catch { /* ignore */ }
    } catch (e) { toast.error('Could not save that exercise'); throw e; }
  };

  const handleFinish = async () => {
    if (!activeSession || busy) return;
    if (activeSession.entries.length === 0) { toast.message('Add at least one exercise first'); return; }
    setBusy(true);
    try {
      const sid = activeSession.id;
      const total = await completeSession(sid);
      clearDraft(sid);
      setResumeDraft(null);
      setFinished(total);
    } catch { toast.error('Could not finish — try again'); } finally { setBusy(false); }
  };

  const handleDiscard = async () => {
    if (!activeSession || busy) return;
    setBusy(true);
    try {
      const sid = activeSession.id;
      await discardSession(sid);
      clearDraft(sid);
      setResumeDraft(null);
      toast.success('Session discarded');
    } catch { toast.error('Could not discard'); } finally { setBusy(false); }
  };

  return (
    <div className="pb-10 pt-1">
      {/* ── Session header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="fg-glass fg-log-hero px-5 py-4 mb-4 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4" style={{ color: 'hsl(28 100% 66%)' }} />
          <p className="fg-pill">Freeform log</p>
        </div>
        <h1 className="text-[20px] font-black tracking-tight mb-2" style={{ color: 'hsl(30 40% 97%)' }}>
          {activeSession ? 'Workout in progress' : 'Log any workout'}
        </h1>
        {activeSession ? (
          <div className="flex items-center gap-4">
            <motion.div animate={reduceMotion ? undefined : { scale: [1, 1.02, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(28 40% 60%)' }}>Elapsed</p>
              <p className="text-[22px] font-black tabular-nums leading-none mt-0.5" style={{ color: 'hsl(30 40% 95%)' }}>{fmtDur(elapsed)}</p>
            </motion.div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(28 40% 60%)' }}>Exercises</p>
              <p className="text-[22px] font-black tabular-nums leading-none mt-0.5" style={{ color: 'hsl(30 40% 95%)' }}>{activeSession.entries.length}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(28 40% 60%)' }}>Fuel</p>
              <p className="inline-flex items-center gap-1 text-[22px] font-black tabular-nums leading-none mt-0.5" style={{ color: 'hsl(28 100% 70%)' }}>
                <Flame className="w-5 h-5" />{runningTotal.toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: 'hsl(30 22% 70%)' }}>
            Reps, weights, cardio, holds — build a workout piece by piece from a library of 870+ moves. It saves as you go and earns fuel for the club flame.
          </p>
        )}
      </motion.div>

      {/* ── Active session entries ── */}
      {activeSession && (
        <>
          <div className="space-y-2 mb-3">
            <AnimatePresence initial={false}>
              {activeSession.entries.map((e) => (
                <motion.div key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }}
                  className="fg-glass px-3.5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'radial-gradient(circle at 40% 30%, hsl(24 100% 55% / 0.16), transparent 70%), hsl(220 14% 16% / 0.9)', border: '1px solid hsl(24 95% 55% / 0.28)' }}>
                    {(e.log_kind === 'duration' || e.log_kind === 'cardio') ? <Timer className="w-4 h-4" style={{ color: 'hsl(28 100% 68%)' }} /> : <Dumbbell className="w-4 h-4" style={{ color: 'hsl(28 100% 68%)' }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate" style={{ color: 'hsl(30 33% 92%)' }}>{e.exercise_name}</p>
                    <p className="text-[11px] truncate" style={{ color: 'hsl(28 25% 58%)' }}>{entrySummary(e)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[13px] font-black tabular-nums flex-shrink-0" style={{ color: 'hsl(30 40% 94%)' }}>
                    <Flame className="w-3.5 h-3.5" style={{ color: 'hsl(28 100% 66%)' }} />{e.points.toLocaleString()}
                  </span>
                  <button onClick={async () => { try { await removeEntry(e.id); } catch { toast.error('Could not remove'); } }} aria-label="Remove exercise" className="fg-key w-9 h-9 rounded-lg flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {activeSession.entries.length === 0 && (
              <div className="fg-glass p-5 text-center text-[13px]" style={{ color: 'hsl(30 18% 64%)' }}>No exercises yet — add your first below.</div>
            )}
          </div>

          {/* Resume a half-composed entry from a previous visit */}
          {resumeDraft && !pick && (
            <button onClick={() => setPick(resumeDraft.pick)}
              className="w-full h-11 rounded-xl text-[13px] font-bold mb-2.5 inline-flex items-center justify-center gap-2"
              style={{ background: 'hsl(24 60% 30% / 0.16)', border: '1px dashed hsl(24 95% 55% / 0.5)', color: 'hsl(28 100% 70%)' }}>
              <RotateCcw className="w-4 h-4" /> Resume “{resumeDraft.pick.name}”
            </button>
          )}

          <button onClick={() => setSearchOpen(true)} className="fg-cta w-full h-12 rounded-xl text-[15px] mb-2.5">
            <Plus className="w-5 h-5" /> Add exercise
          </button>
          <div className="flex gap-2 mb-6">
            <button onClick={handleFinish} disabled={busy || activeSession.entries.length === 0}
              className="fg-cta flex-1 h-12 rounded-xl text-[15px]" style={{ opacity: busy || activeSession.entries.length === 0 ? 0.5 : 1 }}>
              <Check className="w-5 h-5" /> Finish workout
            </button>
            <button onClick={handleDiscard} disabled={busy} className="fg-key h-12 px-4 rounded-xl text-[13px]">Discard</button>
          </div>
        </>
      )}

      {/* ── Start CTA (no active session) ── */}
      {!activeSession && !loading && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {QUICK_STARTS.map((q, i) => (
              <motion.button
                key={q.name}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, type: 'spring', stiffness: 420, damping: 30 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => setPick(q)}
                className="fg-key min-h-[58px] rounded-2xl px-3 py-2.5 flex-col items-start text-left"
              >
                <span className="text-[13px] font-black leading-tight">{q.name}</span>
                <span className="text-[10px] font-bold opacity-65">Quick start</span>
              </motion.button>
            ))}
          </div>
          <button onClick={() => setSearchOpen(true)} disabled={busy} className="fg-cta w-full h-14 rounded-2xl text-[16px] mb-2.5">
            <Plus className="w-6 h-6" /> Add first exercise
          </button>
          <button onClick={handleStart} disabled={busy} className="fg-key w-full h-11 rounded-xl text-[13px]">
            Start blank session
          </button>
        </div>
      )}

      {/* ── Fuel this week ── */}
      {!loading && (myWeekPoints > 0 || clubWeekPoints > 0) && (
        <div className="flex gap-2.5 mb-6">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} className="fg-glass flex-1 px-4 py-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(28 40% 60%)' }}>Your fuel this week</p>
            <p className="inline-flex items-center gap-1 text-[20px] font-black tabular-nums mt-1" style={{ color: 'hsl(30 42% 95%)' }}>
              <Flame className="w-4 h-4" style={{ color: 'hsl(28 100% 66%)' }} />{myWeekPoints.toLocaleString()}
            </p>
          </motion.div>
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="fg-glass flex-1 px-4 py-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(28 40% 60%)' }}>Club fuel this week</p>
            <p className="inline-flex items-center gap-1 text-[20px] font-black tabular-nums mt-1" style={{ color: 'hsl(28 100% 70%)' }}>
              <Flame className="w-4 h-4" />{clubWeekPoints.toLocaleString()}
            </p>
          </motion.div>
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <div className="mb-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em] mb-2.5 px-1" style={{ color: 'hsl(28 45% 62%)' }}>Recent workouts</h3>
          <div className="fg-glass overflow-hidden">
            {history.map((s) => (
              <HistoryRow key={s.id} session={s} onDelete={async () => { try { await deleteSession(s.id); toast.success('Workout deleted'); } catch { toast.error('Could not delete'); } }} />
            ))}
          </div>
        </div>
      )}

      <ExerciseSearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} onPick={handlePick} />
      <LogEntrySheet
        pick={pick}
        sessionId={activeSession?.id ?? null}
        onClose={() => setPick(null)}
        onSave={handleSaveEntry}
        onAddAnother={() => setSearchOpen(true)}
      />
      <CompleteCelebration points={finished} onDone={() => { setFinished(null); navigate('/workouts'); }} />
    </div>
  );
}

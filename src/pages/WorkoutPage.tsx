import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Trophy, ChevronRight, ChevronDown, Flame, Timer, Play, Medal, Users, Settings, HelpCircle, Undo2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { useWorkoutArena } from '@/hooks/useWorkoutArena';
import { useWorkoutLog } from '@/hooks/useWorkoutLog';
import { WorkoutLoggerSheet } from '@/components/workout/WorkoutLoggerSheet';
import { TutorialSheet } from '@/components/workout/TutorialSheet';
import { ManageLogSheet } from '@/components/workout/ManageLogSheet';
import { ClubFlame } from '@/components/workout/ClubFlame';
import { ContributionBar, type Contribution } from '@/components/workout/ContributionBar';
import { memberColor } from '@/lib/workout/memberColors';
import { FullBlazeCelebration } from '@/components/workout/FullBlazeCelebration';
import {
  buildLeaderboard, computeExerciseProgress, userWeekScore,
  lifetimeXp, levelFromXp, computeStreak, computeRecords, computeMilestones, personalGoal,
} from '@/lib/workout/scoring';
import { useCountdown, mondayWeekBounds } from '@/lib/workout/week';
import { LIBRARY_BY_KEY } from '@/lib/workout/library';
import { formatValue, formatValueShort, goalUnitLabel, MEASUREMENT_META } from '@/lib/workout/measurement';
import {
  evaluateAchievements, ACHIEVEMENTS_BY_KEY, ACHIEVEMENTS,
  type AchievementContext,
} from '@/lib/workout/achievements';
import type { WeekExerciseWithDef, WorkoutExercise } from '@/lib/workout/types';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Number that eases to its new value — used on the hero score. */
function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current, to = value;
    prev.current = value;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now(), dur = 550;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{display.toLocaleString()}</span>;
}

/** Live segmented countdown — the app's competitive pulse. */
function CountdownSegments({ endsAt }: { endsAt: string }) {
  const cd = useCountdown(endsAt);
  if (cd.done) return <span className="text-[13px] font-black" style={{ color: 'hsl(28 60% 62%)' }}>Ended</span>;
  const segs = cd.d >= 2
    ? [{ v: cd.d, l: 'DAYS' }, { v: cd.h, l: 'HRS' }, { v: cd.m, l: 'MIN' }]
    : [{ v: cd.h, l: 'HRS' }, { v: cd.m, l: 'MIN' }, { v: cd.s, l: 'SEC' }];
  const urgent = cd.d === 0 && cd.h < 12;
  return (
    <div className="flex items-center gap-1.5">
      {segs.map((s, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className="min-w-[34px] px-1.5 py-1 rounded-lg text-center tabular-nums font-black text-[16px] leading-none"
            style={{
              background: urgent ? 'hsl(6 90% 22% / 0.6)' : 'hsl(18 60% 12% / 0.7)',
              border: `1px solid ${urgent ? 'hsl(6 95% 60% / 0.5)' : 'hsl(24 95% 55% / 0.3)'}`,
              color: urgent ? 'hsl(8 100% 72%)' : 'hsl(30 60% 92%)',
            }}>
            {String(s.v).padStart(2, '0')}
          </div>
          <span className="text-[7px] font-bold tracking-[0.14em] mt-1" style={{ color: 'hsl(28 40% 58%)' }}>{s.l}</span>
        </div>
      ))}
    </div>
  );
}

function EmberBar({ pct, delay = 0, height = 'h-2' }: { pct: number; delay?: number; height?: string }) {
  const full = pct >= 1;
  return (
    <div className={cn('relative rounded-full overflow-hidden', height)} style={{ background: 'hsl(220 14% 20% / 0.75)' }}>
      <motion.div
        className={cn('h-full rounded-full relative', full && 'fg-shimmer')}
        style={{ background: full
          ? 'linear-gradient(90deg, hsl(38 100% 58%), hsl(20 100% 60%))'
          : 'linear-gradient(90deg, hsl(20 100% 55%), hsl(32 100% 55%))' }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(Math.min(1, pct) * 100)}%` }}
        transition={{ type: 'spring', stiffness: 210, damping: 28, delay }}
      />
    </div>
  );
}

const tileVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 420, damping: 32, delay: 0.04 * i } }),
};


export default function WorkoutPage() {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { isInstalled, loading: assetsLoading } = useClubAssets();
  const installed = isInstalled('workout-competition');

  const {
    week, weekExercises, weekActivities, myActivities, members, unlocks, pastWeeks, groupGoals, loading, error,
    logActivity, undoLast, insertUnlock, deleteActivity, resetWeek,
  } = useWorkoutArena(club?.id, user?.id);

  // Freeform log fuel — feeds the flame + XP (not the gauntlet leaderboard).
  const { clubWeekPoints, clubWeekByMember, myLifetimePoints, activeSession: activeLogSession } = useWorkoutLog(club?.id, user?.id);

  const [selected, setSelected] = useState<WeekExerciseWithDef | null>(null);
  const [tutorialKey, setTutorialKey] = useState<string | null>(null);
  const [poppedGoal, setPoppedGoal] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [flameSurge, setFlameSurge] = useState(0);
  const [showBlaze, setShowBlaze] = useState(false);
  const bumpFlame = () => setFlameSurge(s => s + 1);

  const currentMondayKey = useMemo(() => {
    const d = mondayWeekBounds().start;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) m.set(mem.id, mem.display_name);
    return m;
  }, [members]);

  const myWeekActivities = useMemo(() => weekActivities.filter(a => a.user_id === user?.id), [weekActivities, user?.id]);
  // Seed EVERY club member as a row so the roster shows all players.
  const rosterSeed = useMemo(() => {
    const ids = members.map(m => m.id);
    if (user?.id && !ids.includes(user.id)) ids.push(user.id);
    return ids;
  }, [members, user?.id]);
  const leaderboard = useMemo(() => buildLeaderboard(weekExercises, weekActivities, rosterSeed), [weekExercises, weekActivities, rosterSeed]);
  const myScore = useMemo(() => userWeekScore(weekExercises, myWeekActivities), [weekExercises, myWeekActivities]);
  // Stable per-member color — the signed-in member always keeps the base ember.
  const colorOf = useMemo(() => {
    const roster = rosterSeed;
    return (uid: string) => memberColor(uid, user?.id, roster);
  }, [rosterSeed, user?.id]);
  /** Who contributed what to a single tracked exercise this week. */
  const contributionsFor = (exerciseId: string): Contribution[] => {
    const totals = new Map<string, number>();
    for (const a of weekActivities) {
      if (a.exercise_id !== exerciseId) continue;
      totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + Number(a.raw_value));
    }
    return Array.from(totals.entries()).map(([uid, value]) => ({
      userId: uid,
      name: uid === user?.id ? 'You' : (nameById.get(uid) || 'Member'),
      value,
      color: colorOf(uid),
      isMe: uid === user?.id,
    }));
  };
  const myRank = leaderboard.find(r => r.userId === user?.id)?.rank ?? null;

  // Club collective "stoke" — how hard the whole club has fed the flame this
  // week. Full blaze ≈ every member maxing every workout.
  const clubPoints = useMemo(() => leaderboard.reduce((t, r) => t + r.score, 0), [leaderboard]);
  const clubTarget = Math.max(1, members.length || 1) * Math.max(1, weekExercises.length) * 1000;
  // The flame is stoked by BOTH the gauntlet and everyone's freeform logs this
  // week (with a matching slice of target so freeform can't trivially max it).
  const freeformTarget = Math.max(1, members.length || 1) * 300;
  const combinedFuel = clubPoints + clubWeekPoints;
  const clubStoke = (clubTarget + freeformTarget) > 0 ? combinedFuel / (clubTarget + freeformTarget) : 0;
  const participants = useMemo(
    () => leaderboard.filter(r => r.score > 0 || (clubWeekByMember[r.userId]?.points ?? 0) > 0).length,
    [leaderboard, clubWeekByMember],
  );
  const rosterSize = Math.max(members.length, leaderboard.length);

  const exercisesById = useMemo(() => {
    const m = new Map<string, WorkoutExercise>();
    for (const we of weekExercises) m.set(we.exercise.id, we.exercise);
    return m;
  }, [weekExercises]);
  const myXp = useMemo(() => lifetimeXp(exercisesById, myActivities) + myLifetimePoints, [exercisesById, myActivities, myLifetimePoints]);
  const level = useMemo(() => levelFromXp(myXp), [myXp]);
  const todayLocal = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const streak = useMemo(() => computeStreak(myActivities.map(a => a.activity_local_date), todayLocal), [myActivities, todayLocal]);

  // Achievement detection + restrained celebration.
  const celebratedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading) return;
    const ctx: AchievementContext = { lifetime: myActivities, weekActivities: myWeekActivities, weekExercises, week, todayLocal };
    const fresh = evaluateAchievements(ctx).filter(k => !unlocks.includes(k) && !celebratedRef.current.has(k));
    fresh.forEach(async (k) => {
      celebratedRef.current.add(k);
      const isNew = await insertUnlock(k);
      if (!isNew) return;
      const def = ACHIEVEMENTS_BY_KEY[k];
      if (!def) return;
      const emoji = def.tier === 'gold' ? '🏆' : def.tier === 'silver' ? '🥈' : '🎖️';
      toast.success(`${emoji} ${def.title}`, { description: def.description, duration: def.tier === 'gold' ? 6000 : 4000 });
    });
  }, [loading, myActivities, myWeekActivities, weekExercises, week, unlocks, todayLocal, insertUnlock]);

  // FULL BLAZE — fire once per club per week when the flame is maxed.
  useEffect(() => {
    if (loading || !week || !club?.id || clubStoke < 1) return;
    const key = `fg_blaze_v1:${club.id}:${week.id}`;
    let done = false;
    try { done = localStorage.getItem(key) === '1'; } catch { /* ignore */ }
    if (done) return;
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
    setShowBlaze(true);
  }, [loading, week, club?.id, clubStoke]);

  if (!assetsLoading && !installed) return <Navigate to="/dashboard" replace />;

  const weekTotalFor = (exerciseId: string) =>
    myWeekActivities.filter(a => a.exercise_id === exerciseId).reduce((t, a) => t + Number(a.raw_value), 0);
  const personalBestFor = (exerciseId: string) => {
    const vals = myActivities.filter(a => a.exercise_id === exerciseId).map(a => Number(a.raw_value));
    return vals.length ? Math.max(...vals) : null;
  };
  const recordsFor = (ex: WorkoutExercise) =>
    computeRecords(ex, myActivities).map(s => ({ label: s.label, value: formatValue(ex.measurement_type, s.value) }));
  const nextMilestoneFor = (ex: WorkoutExercise): string | null => {
    const acts = myActivities.filter(a => a.exercise_id === ex.id);
    const lifetime = acts.reduce((t, a) => t + Number(a.raw_value), 0);
    const best = acts.length ? Math.max(...acts.map(a => Number(a.raw_value))) : 0;
    const m = computeMilestones(ex.milestone_config, lifetime, best);
    const isTime = MEASUREMENT_META[ex.measurement_type].isTime;
    const next = isTime ? (m.nextSession ?? m.nextLifetime) : (m.nextLifetime ?? m.nextSession);
    return next != null ? formatValue(ex.measurement_type, next) : null;
  };

  const libKeyOf = (we: WeekExerciseWithDef): string | null =>
    (we.exercise.logging_config as any)?.lib_key ?? null;
  const personalGoalFor = (we: WeekExerciseWithDef): number => {
    const lib = LIBRARY_BY_KEY[libKeyOf(we) ?? ''];
    const baseline = lib?.baseline ?? we.goal ?? we.exercise.default_weekly_goal ?? 0;
    const isTime = MEASUREMENT_META[we.exercise.measurement_type].isTime;
    const acts = myActivities.filter(a => a.exercise_id === we.exercise_id);
    return personalGoal(baseline, isTime, acts, currentMondayKey);
  };

  const quickLog = async (we: WeekExerciseWithDef, amount: number) => {
    const pg = personalGoalFor(we);
    const before = computeExerciseProgress(we, myWeekActivities, pg).goalPct;
    try {
      await logActivity({ exercise: we.exercise, weekId: week?.id ?? null, rawValue: amount });
      bumpFlame();
      try { navigator.vibrate?.(8); } catch { /* ignore */ }
      // Celebrate the moment a personal goal is crossed.
      const after = computeExerciseProgress(we, [...myWeekActivities, { raw_value: amount } as any], pg).goalPct;
      if (before < 1 && after >= 1) {
        setPoppedGoal(we.id);
        setTimeout(() => setPoppedGoal(cur => (cur === we.id ? null : cur)), 1400);
        toast.success(`🔥 Goal cleared — ${we.exercise.name}!`);
      }
    } catch { toast.error('Could not log that — try again'); }
  };

  if (loading) {
    return (
      <div className="pb-6 pt-1">
        <div className="fg-glass h-32 mb-4" style={{ borderRadius: 16 }}>
          <div className="w-full h-full skeleton-shimmer opacity-40" style={{ borderRadius: 16 }} />
        </div>
        <div className="space-y-2.5">{[1, 2, 3].map(i => <div key={i} className="fg-glass h-20 skeleton-shimmer opacity-40" style={{ borderRadius: 16 }} />)}</div>
      </div>
    );
  }

  if (!week) {
    return (
      <div className="pb-6 pt-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="fg-glass p-8 text-center">
          <motion.div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'radial-gradient(circle at 40% 30%, hsl(24 100% 55% / 0.4), transparent 70%), linear-gradient(135deg, hsl(220 14% 18%), hsl(222 18% 10%))', border: '1px solid hsl(24 95% 55% / 0.4)' }}
            animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Flame className="w-8 h-8" style={{ color: 'hsl(28 100% 66%)' }} />
          </motion.div>
          <p className="text-[16px] font-black mb-1" style={{ color: 'hsl(30 40% 96%)' }}>The forge is cold</p>
          <p className="text-[12px] mb-5" style={{ color: 'hsl(30 15% 65%)' }}>
            {isClubAdmin ? 'Light it up — build this Monday’s gauntlet and publish it.' : 'A fresh gauntlet drops Monday. Check back to compete.'}
          </p>
          {isClubAdmin && (
            <Link to="/workouts/admin" className="fg-cta h-11 px-5 rounded-xl inline-flex text-[13px]">
              <Settings className="w-4 h-4" /> Build a week
            </Link>
          )}
        </motion.div>
        {error && <p className="text-[11px] text-center mt-3" style={{ color: 'hsl(6 90% 66%)' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="pb-8 pt-1">
      {/* ── The Club Flame — collective, front & center ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="fg-glass px-5 pt-4 pb-5 relative overflow-hidden mb-4"
      >
        <div className="flex items-start justify-between gap-3 relative z-[2]">
          <div className="min-w-0">
            <p className="fg-pill mb-1.5">🔥 {week.theme || 'Weekly Gauntlet'}</p>
            <h2 className="text-[19px] font-black tracking-tight truncate" style={{ color: 'hsl(30 40% 97%)' }}>{week.title}</h2>
          </div>
          <div className="flex-shrink-0"><CountdownSegments endsAt={week.ends_at} /></div>
        </div>

        <div className="flex flex-col items-center -mt-1">
          <ClubFlame intensity={clubStoke} surge={flameSurge} />
          <div className="text-center -mt-4 relative z-[2]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'hsl(28 60% 64%)' }}>The club has forged</p>
            <CountUp value={combinedFuel} className="text-[44px] leading-none font-black tabular-nums" />
            <p className="text-[11px] font-bold mt-1" style={{ color: 'hsl(30 20% 66%)' }}>
              {clubStoke >= 1 ? 'FULL BLAZE 🔥' : `${Math.round(clubStoke * 100)}% to full blaze`}
              {' · '}{participants}/{rosterSize} fired up
            </p>
            {clubWeekPoints > 0 && (
              <p className="text-[10px] font-bold mt-1" style={{ color: 'hsl(28 42% 58%)' }}>
                Includes {clubWeekPoints.toLocaleString()} fuel from personal workouts
              </p>
            )}
          </div>
        </div>

        {/* Your personal strip */}
        <div className="flex items-center justify-center gap-2 mt-3 relative z-[2]">
          {[
            { l: 'You', v: myScore.toLocaleString() },
            { l: 'Rank', v: myRank ? ordinal(myRank) : '—' },
            { l: 'Level', v: level.level },
            ...(streak > 0 ? [{ l: 'Streak', v: `🔥${streak}` }] : []),
          ].map((chip) => (
            <div key={chip.l} className="text-center px-3 py-1.5 rounded-xl" style={{ background: 'hsl(18 50% 10% / 0.7)', border: '1px solid hsl(24 90% 55% / 0.18)' }}>
              <p className="text-[15px] font-black tabular-nums leading-none" style={{ color: 'hsl(30 45% 95%)' }}>{chip.v}</p>
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] mt-1" style={{ color: 'hsl(28 35% 58%)' }}>{chip.l}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick action dock — weekly gauntlet first, freeform workouts one tap away */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <a href="#forge-daily-workouts" className="fg-key min-h-[64px] rounded-2xl px-3 py-3 flex-col items-start text-left">
          <Dumbbell className="w-5 h-5" />
          <span className="text-[14px] font-black leading-tight">Daily workouts</span>
          <span className="text-[10px] font-bold opacity-70">{weekExercises.length} moves ready</span>
        </a>
        <Link to="/workouts/log" className="fg-cta min-h-[64px] rounded-2xl px-3 py-3 flex-col items-start text-left">
          <Sparkles className="w-5 h-5" />
          <span className="text-[14px] font-black leading-tight">{activeLogSession ? 'Resume workout' : 'Any workout'}</span>
          <span className="text-[10px] font-bold opacity-70">Adds fuel to the flame</span>
        </Link>
      </div>

      {/* Club group goals */}
      {groupGoals.map((g) => {
        const combined = weekActivities.filter(a => a.exercise_id === g.exercise_id).reduce((t, a) => t + Number(a.raw_value), 0);
        const pct = g.target > 0 ? Math.min(1, combined / g.target) : 0;
        return (
          <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="fg-glass p-4 mb-4" style={{ borderColor: 'hsl(24 95% 55% / 0.32)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" style={{ color: 'hsl(28 100% 66%)' }} />
              <h3 className="text-[12px] font-black uppercase tracking-[0.14em]" style={{ color: 'hsl(28 90% 66%)' }}>Club Goal</h3>
              {pct >= 1 && <span className="ml-auto text-[11px] font-black" style={{ color: 'hsl(38 100% 62%)' }}>Cleared 🎉</span>}
            </div>
            <p className="text-[14px] font-bold mb-2" style={{ color: 'hsl(30 30% 92%)' }}>{g.title}</p>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[19px] font-black tabular-nums" style={{ color: 'hsl(30 45% 96%)' }}>{formatValueShort(g.exercise.measurement_type, combined)}</span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: 'hsl(28 30% 60%)' }}>/ {formatValueShort(g.exercise.measurement_type, g.target)}</span>
            </div>
            <ContributionBar
              contributions={contributionsFor(g.exercise_id)}
              target={g.target}
              formatValue={(v) => formatValueShort(g.exercise.measurement_type, v)}
            />
          </motion.div>
        );
      })}

      {/* Auto club goal (scaled to club size) — shown when no admin goal exists */}
      {groupGoals.length === 0 && members.length > 0 && (() => {
        const headline = weekExercises.find(w => MEASUREMENT_META[w.exercise.measurement_type].logger === 'rep') ?? weekExercises[0];
        if (!headline) return null;
        const lib = LIBRARY_BY_KEY[libKeyOf(headline) ?? ''];
        const base = lib?.baseline ?? headline.goal ?? headline.exercise.default_weekly_goal ?? 100;
        const target = Math.round(members.length * base);
        const combined = weekActivities.filter(a => a.exercise_id === headline.exercise_id).reduce((t, a) => t + Number(a.raw_value), 0);
        const pct = target > 0 ? Math.min(1, combined / target) : 0;
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="fg-glass p-4 mb-4" style={{ borderColor: 'hsl(24 95% 55% / 0.32)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" style={{ color: 'hsl(28 100% 66%)' }} />
              <h3 className="text-[12px] font-black uppercase tracking-[0.14em]" style={{ color: 'hsl(28 90% 66%)' }}>Club Goal</h3>
              {pct >= 1 && <span className="ml-auto text-[11px] font-black" style={{ color: 'hsl(38 100% 62%)' }}>Cleared 🎉</span>}
            </div>
            <p className="text-[14px] font-bold mb-2" style={{ color: 'hsl(30 30% 92%)' }}>{target.toLocaleString()} {headline.exercise.name.toLowerCase()} together this week</p>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[19px] font-black tabular-nums" style={{ color: 'hsl(30 45% 96%)' }}>{formatValueShort(headline.exercise.measurement_type, combined)}</span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: 'hsl(28 30% 60%)' }}>/ {formatValueShort(headline.exercise.measurement_type, target)}</span>
            </div>
            <ContributionBar
              contributions={contributionsFor(headline.exercise_id)}
              target={target}
              formatValue={(v) => formatValueShort(headline.exercise.measurement_type, v)}
            />
          </motion.div>
        );
      })()}

      {/* Workouts */}
      <h3 id="forge-daily-workouts" className="scroll-mt-4 text-[11px] font-black uppercase tracking-[0.16em] mb-2.5 px-1" style={{ color: 'hsl(28 45% 62%)' }}>This week’s workouts</h3>
      <div className="space-y-2.5 mb-6">
        {weekExercises.map((we, i) => {
          const prog = computeExerciseProgress(we, myWeekActivities, personalGoalFor(we));
          const meta = MEASUREMENT_META[we.exercise.measurement_type];
          const isRepLike = meta.logger === 'rep' || meta.logger === 'round';
          const quick = we.exercise.logging_config.quick_add?.slice(0, 3) ?? [1, 5, 10];
          const cleared = prog.goalPct >= 1;
          const hasTutorial = !!libKeyOf(we);
          return (
            <motion.div key={we.id} custom={i} variants={tileVariants} initial="hidden" animate="show" className="fg-glass p-3.5 relative overflow-hidden">
              <AnimatePresence>
                {poppedGoal === we.id && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 pointer-events-none z-[2] flex items-center justify-center"
                    style={{ background: 'radial-gradient(circle, hsl(24 100% 55% / 0.28), transparent 70%)' }}
                  >
                    <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1.1, opacity: 1 }} exit={{ scale: 1.4, opacity: 0 }}
                      className="text-[28px] font-black" style={{ color: 'hsl(38 100% 65%)' }}>🔥</motion.span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => setSelected(we)} className="w-full flex items-center gap-3 text-left">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cleared ? 'linear-gradient(135deg, hsl(38 90% 30%), hsl(20 90% 22%))' : 'radial-gradient(circle at 40% 30%, hsl(24 100% 55% / 0.18), transparent 70%), hsl(220 14% 16% / 0.9)', border: '1px solid hsl(24 95% 55% / 0.3)' }}>
                  <Dumbbell className="w-5 h-5" style={{ color: 'hsl(28 100% 68%)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-[14px] truncate" style={{ color: 'hsl(30 35% 94%)' }}>{we.exercise.name}</h4>
                    <span className="text-[12px] font-black tabular-nums flex-shrink-0" style={{ color: 'hsl(30 40% 92%)' }}>
                      {formatValueShort(we.exercise.measurement_type, prog.totalRaw)}
                      {prog.goal ? <span style={{ color: 'hsl(28 25% 55%)' }}> / {formatValueShort(we.exercise.measurement_type, prog.goal)}</span> : null}
                    </span>
                  </div>
                  <div className="mt-1.5"><EmberBar pct={prog.goalPct} delay={0.04 * i} height="h-1.5" /></div>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(28 30% 50%)' }} />
              </button>

              <div className="flex gap-2 mt-3">
                {hasTutorial && (
                  <button onClick={() => setTutorialKey(libKeyOf(we))} aria-label={`How to do ${we.exercise.name}`}
                    className="fg-key h-11 w-11 rounded-xl flex-shrink-0">
                    <HelpCircle className="w-5 h-5" />
                  </button>
                )}
                {isRepLike ? (
                  meta.logger === 'round' ? (
                    <button onClick={() => quickLog(we, 1)} className="fg-cta flex-1 h-11 rounded-xl text-[14px]">Complete round</button>
                  ) : (
                    quick.map(n => (
                      <motion.button key={n} whileTap={{ scale: 0.9 }} onClick={() => quickLog(we, n)}
                        className="fg-key flex-1 h-11 rounded-xl font-black text-[16px] tabular-nums">
                        +{n}
                      </motion.button>
                    ))
                  )
                ) : (
                  <button onClick={() => setSelected(we)} className="fg-cta flex-1 h-11 rounded-xl text-[14px]">
                    {meta.isTime ? <><Play className="w-4 h-4 fill-current" /> Start timer</> : <><Timer className="w-4 h-4" /> Log {goalUnitLabel(we.exercise.measurement_type)}</>}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        {weekExercises.length === 0 && (
          <div className="fg-glass p-6 text-center text-[13px]" style={{ color: 'hsl(30 15% 62%)' }}>No workouts in this week yet.</div>
        )}
      </div>

      {/* Log housekeeping — fix mis-taps / double-counted reps */}
      <button
        onClick={() => setManageOpen(true)}
        className="fg-key w-full h-11 rounded-xl text-[13px] mb-6"
      >
        <Undo2 className="w-4 h-4" /> Manage my log{isClubAdmin ? ' · reset a member' : ''}
      </button>


      {/* Club Roster — every player's individual contribution to the flame */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <h3 className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'hsl(28 45% 62%)' }}>Club Roster</h3>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: 'hsl(28 30% 55%)' }}>{participants}/{rosterSize} fired up</span>
      </div>
      <div className="fg-glass overflow-hidden mb-6">
        {leaderboard.map((row, i) => {
          const isMe = row.userId === user?.id;
          const medal = row.rank === 1 ? '\ud83e\udd47' : row.rank === 2 ? '\ud83e\udd48' : row.rank === 3 ? '\ud83e\udd49' : null;
          const spark = clubPoints > 0 ? row.score / clubPoints : 0; // share of the club flame
          const color = colorOf(row.userId);
          const open = expandedMember === row.userId;
          const acts = weekActivities.filter(a => a.user_id === row.userId);
          const freeform = clubWeekByMember[row.userId];
          const memberFuel = row.score + (freeform?.points ?? 0);
          const sparkShare = combinedFuel > 0 ? memberFuel / combinedFuel : spark;
          return (
            <motion.div key={row.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.02 * Math.min(i, 12) }}
              style={{ background: isMe ? 'hsl(24 95% 55% / 0.08)' : 'transparent', borderTop: i ? '1px solid hsl(220 14% 60% / 0.1)' : 'none' }}>
              <button
                onClick={() => setExpandedMember(cur => (cur === row.userId ? null : row.userId))}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left active:opacity-80"
                aria-expanded={open}
              >
                <span className="w-6 text-center text-[14px] font-black tabular-nums flex-shrink-0">{medal || <span style={{ color: 'hsl(28 30% 52%)' }}>{row.rank}</span>}</span>
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px -1px ${color}` }} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-bold" style={{ color: isMe ? color : 'hsl(30 30% 90%)' }}>{isMe ? 'You' : (nameById.get(row.userId) || 'Member')}</p>
                    <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'hsl(220 14% 20% / 0.75)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round(Math.min(1, sparkShare * 2) * 100)}%`, background: color }} />
                  </div>
                </div>
                <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: 'hsl(28 25% 55%)' }}>{Math.round(row.completionPct * 100)}%</span>
                <span className="text-[13px] font-black tabular-nums w-14 text-right flex-shrink-0" style={{ color: 'hsl(30 40% 94%)' }}>{memberFuel.toLocaleString()}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: 'hsl(28 30% 50%)', transform: open ? 'rotate(180deg)' : 'none' }} />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3 pt-0.5 space-y-1.5" style={{ borderLeft: `2px solid ${color}`, marginLeft: 12 }}>
                      {weekExercises.map(we => {
                        const total = acts.filter(a => a.exercise_id === we.exercise_id).reduce((t, a) => t + Number(a.raw_value), 0);
                        const sessions = acts.filter(a => a.exercise_id === we.exercise_id).length;
                        return (
                          <div key={we.id} className="flex items-center gap-2">
                            <span className="text-[11px] font-bold truncate flex-1" style={{ color: total > 0 ? 'hsl(30 28% 86%)' : 'hsl(28 18% 50%)' }}>{we.exercise.name}</span>
                            <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'hsl(28 22% 52%)' }}>{sessions} log{sessions === 1 ? '' : 's'}</span>
                            <span className="text-[11px] font-black tabular-nums w-16 text-right flex-shrink-0" style={{ color: total > 0 ? color : 'hsl(28 18% 45%)' }}>
                              {formatValueShort(we.exercise.measurement_type, total)}
                            </span>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-2 pt-1.5" style={{ borderTop: '1px solid hsl(220 14% 60% / 0.12)' }}>
                        <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(28 45% 60%)' }} />
                        <span className="text-[11px] font-bold flex-1" style={{ color: 'hsl(28 30% 66%)' }}>Personal workouts</span>
                        <span className="text-[11px] font-black tabular-nums" style={{ color: 'hsl(30 30% 84%)' }}>
                          {(freeform?.sessions ?? 0)} logged · {(freeform?.points ?? 0).toLocaleString()} fuel
                        </span>
                      </div>
                      <p className="text-[9px]" style={{ color: 'hsl(28 18% 46%)' }}>Personal workout details stay private.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {leaderboard.length === 0 && <div className="px-3.5 py-6 text-center text-[12px]" style={{ color: 'hsl(30 15% 60%)' }}>Be the first to stoke the flame.</div>}
      </div>

      {/* Badges */}
      {unlocks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <h3 className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'hsl(28 45% 62%)' }}>Badges</h3>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: 'hsl(28 30% 55%)' }}>{unlocks.length}/{ACHIEVEMENTS.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ACHIEVEMENTS.filter(a => unlocks.includes(a.key)).map((a, i) => (
              <motion.div key={a.key} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.03 * i, type: 'spring', stiffness: 400, damping: 24 }}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-bold" title={a.description}
                style={{ background: 'hsl(24 95% 55% / 0.12)', border: '1px solid hsl(24 95% 55% / 0.26)', color: 'hsl(28 100% 68%)' }}>
                <Medal className="w-3.5 h-3.5" /> {a.title}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recent weeks */}
      {pastWeeks.length > 0 && (
        <div className="mb-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.16em] mb-2.5 px-1" style={{ color: 'hsl(28 45% 62%)' }}>Past gauntlets</h3>
          <div className="fg-glass overflow-hidden">
            {pastWeeks.map((w, i) => (
              <Link key={w.id} to={`/workouts/recap/${w.id}`} className="flex items-center gap-3 px-3.5 py-3" style={{ borderTop: i ? '1px solid hsl(220 14% 60% / 0.1)' : 'none' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(220 14% 16% / 0.9)', border: '1px solid hsl(24 60% 60% / 0.16)' }}><Trophy className="w-4 h-4" style={{ color: 'hsl(28 80% 60%)' }} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold truncate" style={{ color: 'hsl(30 30% 90%)' }}>{w.title}</p>
                  <p className="text-[10px]" style={{ color: 'hsl(28 25% 55%)' }}>{new Date(w.ends_at).toLocaleDateString()}</p>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(28 30% 50%)' }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <WorkoutLoggerSheet
        exercise={selected?.exercise ?? null}
        goal={selected ? (selected.goal ?? selected.exercise.default_weekly_goal ?? null) : null}
        weekTotal={selected ? weekTotalFor(selected.exercise.id) : 0}
        personalBest={selected ? personalBestFor(selected.exercise.id) : null}
        records={selected ? recordsFor(selected.exercise) : undefined}
        nextMilestone={selected ? nextMilestoneFor(selected.exercise) : null}
        canUndo={selected ? weekTotalFor(selected.exercise.id) > 0 : false}
        onClose={() => setSelected(null)}
        onLog={async (rawValue, opts) => {
          if (!selected) return;
          try { await logActivity({ exercise: selected.exercise, weekId: week?.id ?? null, rawValue, startedAt: opts?.startedAt, endedAt: opts?.endedAt, metadata: opts?.metadata }); bumpFlame(); }
          catch { toast.error('Could not log that — try again'); }
        }}
        onUndo={selected ? async () => { try { await undoLast(selected.exercise.id); } catch { toast.error('Undo failed'); } } : undefined}
      />

      <TutorialSheet libKey={tutorialKey} onClose={() => setTutorialKey(null)} />
      <FullBlazeCelebration show={showBlaze} onDone={() => setShowBlaze(false)} />

      <ManageLogSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        weekId={week?.id ?? null}
        weekTitle={week?.title ?? 'This week'}
        viewerId={user?.id}
        isAdmin={!!isClubAdmin}
        members={members}
        weekExercises={weekExercises}
        weekActivities={weekActivities}
        onDeleteActivity={async (id) => {
          try { await deleteActivity(id); toast.success('Entry removed'); }
          catch { toast.error('Could not remove that entry'); }
        }}
        onResetWeek={async (weekId, uid, exerciseId) => {
          try { await resetWeek(weekId, uid, exerciseId); toast.success(exerciseId ? 'Exercise cleared' : 'Week reset'); }
          catch { toast.error('Reset failed — you may not have permission'); }
        }}
      />
    </div>
  );
}

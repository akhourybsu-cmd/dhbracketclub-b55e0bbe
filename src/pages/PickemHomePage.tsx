import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronRight, Trophy, History as HistoryIcon, Info, Shield, ArrowRight,
  Sparkles, ListChecks, BarChart3, Flame, ShieldCheck,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useCurrentWeek, useWeekGames, useMyWeekPicks,
  useSeasonStandings, useSeasonWeeks, deriveWeekStatus, useWeekLock, usePickemAdmin,
} from '@/hooks/usePickem';
import { WeekStatusPill } from '@/components/pickem/WeekStatusPill';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { PickemShell } from '@/components/pickem/PickemShell';
import { useEffect, useState } from 'react';

/* ──────────── Compact split-cell countdown for the scoreboard ──────────── */
function CountdownCells({ target }: { target: string | Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  const targetMs = typeof target === 'string' ? new Date(target).getTime() : target.getTime();
  const diff = Math.max(0, targetMs - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const mins = Math.floor((diff / 60000) % 60);
  return (
    <div className="flex items-stretch gap-1.5">
      <div className="pk-digit">
        <span className="pk-digit-num">{days}</span>
        <span className="pk-digit-label">Days</span>
      </div>
      <div className="pk-digit">
        <span className="pk-digit-num">{String(hours).padStart(2, '0')}</span>
        <span className="pk-digit-label">Hrs</span>
      </div>
      <div className="pk-digit">
        <span className="pk-digit-num">{String(mins).padStart(2, '0')}</span>
        <span className="pk-digit-label">Min</span>
      </div>
    </div>
  );
}

export default function PickemHomePage() {
  const { user } = useAuth();
  const { season, loading: seasonLoading } = useActiveSeason();
  const { week } = useCurrentWeek(season);
  const { games } = useWeekGames(week?.id);
  const { picks } = useMyWeekPicks(week?.id);
  const { weeks } = useSeasonWeeks(season?.id);
  const { standings } = useSeasonStandings(season?.id);
  const { isAdmin } = usePickemAdmin();

  const me = standings.find((s) => s.user_id === user?.id);
  const totalGames = games.length;
  const pickedCount = picks.length;
  const remaining = Math.max(0, totalGames - pickedCount);
  const { lockAt, locked: weekLocked, now } = useWeekLock(games, season);
  const weekStatus = week ? (totalGames > 0 ? deriveWeekStatus(games, week.status, now) : week.status) : 'upcoming';
  const recentScored = weeks.filter((w) => w.status === 'scored').slice(-3).reverse();

  const isPreseasonInaugural = season && season.status === 'upcoming' && totalGames === 0;
  const daysToKickoff = season ? differenceInDays(new Date(season.starts_at), new Date()) : 0;

  // Primary CTA target & label
  const ctaHref = week ? `/pickem/week/${week.week_number}` : '/pickem/rules';
  const ctaLabel =
    !season ? 'Season Soon'
    : isPreseasonInaugural ? 'Enter Pick Center'
    : weekStatus === 'open' || weekStatus === 'partially_locked' ? 'Lock Your Picks'
    : weekStatus === 'scored' ? 'View Weekly Slate'
    : 'Enter Pick Center';

  return (
    <PickemShell>
      <div className="space-y-4 pb-6">
      {/* ─────────── Pick Center hero ─────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {seasonLoading ? (
          <div className="glass-card p-5">
            <div className="h-5 w-1/2 rounded skeleton-shimmer mb-2" />
            <div className="h-3 w-1/3 rounded skeleton-shimmer" />
          </div>
        ) : !season ? (
          <div className="glass-card p-8 text-center">
            <Trophy className="w-7 h-7 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-bold mb-1 text-white">No season yet</p>
            <p className="text-xs text-muted-foreground">An admin needs to set up the season schedule.</p>
          </div>
        ) : (
          <TurfBackdrop className="px-5 pt-4 pb-5">
            {/* Field-stripe trim */}
            <div className="pk-field-stripe mb-3" aria-hidden />

            {/* Broadcast lower-third row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="pk-shield">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div className="leading-tight">
                  <p className="pk-section-label">Pick Center</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/55 mt-0.5">
                    {season.year} NFL Season
                  </p>
                </div>
              </div>
              <WeekStatusPill status={weekStatus} />
            </div>

            <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight leading-[1.05] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
              {season.name}
            </h1>
            <p className="text-[12px] text-white/70 mt-1 max-w-[34ch] leading-snug">
              {isPreseasonInaugural
                ? 'Season HQ is live. Weekly cards open before kickoff — track standings, history, and bragging rights all year.'
                : week
                  ? `${week.label} · ${remaining > 0 ? `${remaining} pick${remaining === 1 ? '' : 's'} to lock` : 'Card complete'}`
                  : 'Weekly slate drops once the schedule syncs.'}
            </p>

            {/* ── Kickoff scoreboard (preseason) ── */}
            {isPreseasonInaugural && (
              <div className="pk-scoreboard mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="pk-scoreboard-label flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-gold" /> Kickoff Countdown
                    </p>
                    <p className="text-[11px] text-white/65 mt-1">
                      {format(new Date(season.starts_at), 'EEE, MMM d')}
                    </p>
                  </div>
                  <CountdownCells target={season.starts_at} />
                </div>
              </div>
            )}

            {/* ── Active-week progress scoreboard ── */}
            {!isPreseasonInaugural && week && totalGames > 0 && (
              <div className="pk-scoreboard mt-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="pk-scoreboard-label">Pick Status · {week.label}</p>
                  <p className="text-[11px] font-extrabold text-white/85 tabular-nums">
                    {pickedCount}<span className="text-white/45">/{totalGames}</span>
                  </p>
                </div>
                <div className="h-2 rounded-full bg-black/60 overflow-hidden border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((pickedCount / totalGames) * 100)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-gold via-gold to-[hsl(45_100%_70%)]"
                    style={{ boxShadow: '0 0 10px hsl(var(--gold) / 0.65)' }}
                  />
                </div>
                {lockAt && !weekLocked && (
                  <p className="text-[10px] text-white/55 mt-2 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-gold" />
                    Picks freeze {format(lockAt, 'EEE h:mm a')}
                  </p>
                )}
              </div>
            )}

            {/* ── Primary CTA ── */}
            {(week || isPreseasonInaugural) && (
              <Link to={ctaHref} className="block mt-4">
                <button type="button" className="pk-cta">
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" strokeWidth={3} />
                </button>
              </Link>
            )}

            {/* ── Stat chip strip ── */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {me?.rank != null && (
                <span className="pk-chip pk-chip-gold">
                  <Trophy className="w-3 h-3" /> Rank #{me.rank}
                </span>
              )}
              {me && (
                <span className="pk-chip">
                  <BarChart3 className="w-3 h-3" /> {me.total_correct}/{me.total_picked}
                </span>
              )}
              {totalGames > 0 && (
                <span className="pk-chip">
                  <ListChecks className="w-3 h-3" /> {totalGames} games
                </span>
              )}
              {isPreseasonInaugural && daysToKickoff > 0 && (
                <span className="pk-chip pk-chip-gold">
                  <Flame className="w-3 h-3" /> Week 1 · {daysToKickoff}d
                </span>
              )}
            </div>
          </TurfBackdrop>
        )}
      </motion.div>

      {/* ─────────── Action tiles ─────────── */}
      <div>
        <div className="pk-broadcast-divider" aria-hidden />
        <p className="pk-section-label mb-2 px-0.5">Pick Center Hub</p>
        <div className="grid grid-cols-2 gap-2">
          <ActionTile
            to="/pickem/standings"
            icon={<Trophy className="w-4 h-4 text-gold" />}
            label="Standings"
            sub="The race"
            stat={me?.rank ? `#${me.rank}` : null}
          />
          <ActionTile
            to="/pickem/history"
            icon={<HistoryIcon className="w-4 h-4 text-primary" />}
            label="My History"
            sub="Week record"
            stat={me ? `${me.total_correct}/${me.total_picked}` : null}
          />
          <ActionTile
            to="/pickem/rules"
            icon={<Info className="w-4 h-4 text-white/85" />}
            label="Playbook"
            sub="Rules & scoring"
          />
          {isAdmin ? (
            <ActionTile
              to="/pickem/admin"
              icon={<Shield className="w-4 h-4 text-destructive" />}
              label="Admin"
              sub="Schedule & finals"
            />
          ) : week ? (
            <ActionTile
              to={`/pickem/week/${week.week_number}`}
              icon={<Flame className="w-4 h-4 text-gold" />}
              label="Weekly Slate"
              sub="Lock this week"
              highlight
            />
          ) : (
            <ActionTile
              to="/pickem/rules"
              icon={<Sparkles className="w-4 h-4 text-gold" />}
              label="Get Ready"
              sub="Review the rules"
            />
          )}
        </div>
      </div>

      {/* ─────────── Recent results ─────────── */}
      {recentScored.length > 0 && (
        <div>
          <div className="pk-broadcast-divider" aria-hidden />
          <p className="pk-section-label mb-2 px-0.5">Recent Results</p>
          <div className="space-y-1.5">
            {recentScored.map((w, i) => (
              <motion.div key={w.id}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}>
                <Link to={`/pickem/week/${w.week_number}/results`}>
                  <div className="glass-card p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center bg-gold/10 border border-gold/30">
                      <p className="text-[7px] text-gold font-extrabold uppercase tracking-wider leading-none">Wk</p>
                      <p className="text-[12px] text-gold font-extrabold tabular-nums leading-none mt-0.5">{w.week_number}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold truncate text-white">{w.label}</p>
                      <p className="text-[10px] text-white/55">Final results in</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      </div>
    </PickemShell>
  );
}

/* ──────────── ActionTile ──────────── */
function ActionTile({
  to, icon, label, sub, stat, highlight,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  stat?: string | null;
  highlight?: boolean;
}) {
  return (
    <Link to={to} className="block">
      <div className={`pk-tile btn-press ${highlight ? 'pk-tile-hot' : ''}`}>
        <div className="flex items-start justify-between relative">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10">
            {icon}
          </div>
          {stat && (
            <span className="text-[12px] font-extrabold tabular-nums text-gold drop-shadow-[0_0_6px_hsl(45_95%_55%/0.4)]">{stat}</span>
          )}
        </div>
        <div className="relative">
          <p className="text-[14px] font-extrabold tracking-tight text-white">{label}</p>
          <p className="text-[10px] text-white/55 mt-0.5 uppercase tracking-wider font-bold">{sub}</p>
        </div>
      </div>
    </Link>
  );
}

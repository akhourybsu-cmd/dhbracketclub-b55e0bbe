import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ListChecks, ArrowRight, CalendarOff, Flame, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useSeasonWeeks, useWeekGames, useMyWeekPicks, useMyTiebreaker,
  useSeasonTeamRecords, useWeekPickInsights, useWeekLock, usePickemAdmin, useSeasonWeekGameCounts,
  savePick, saveTiebreaker, deleteMyPick, deriveWeekStatus, useCardLock, filterVisibleWeeks,
} from '@/hooks/usePickem';
import { GamePickCard } from '@/components/pickem/GamePickCard';
import { TiebreakerInput } from '@/components/pickem/TiebreakerInput';
import { WeekStatusPill } from '@/components/pickem/WeekStatusPill';
import { WeekNavigator } from '@/components/pickem/WeekNavigator';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { KickoffCountdown } from '@/components/pickem/KickoffCountdown';
import { PickSlipBar } from '@/components/pickem/PickSlipBar';
import { PickemShell } from '@/components/pickem/PickemShell';

export default function PickemWeekPage() {
  const { weekNumber } = useParams<{ weekNumber: string }>();
  const num = parseInt(weekNumber || '1', 10);
  const { user } = useAuth();

  const { season, loading: seasonLoading } = useActiveSeason();
  const { weeks, loading: weeksLoading } = useSeasonWeeks(season?.id);
  const { counts: weekGameCounts, loading: countsLoading } = useSeasonWeekGameCounts(season?.id);
  const { isAdmin, loading: adminLoading } = usePickemAdmin();
  const visibleWeeks = useMemo(
    () => filterVisibleWeeks(weeks, season, weekGameCounts, isAdmin),
    [weeks, season, weekGameCounts, isAdmin],
  );
  const week = useMemo(() => visibleWeeks.find((w) => w.week_number === num), [visibleWeeks, num]);
  const { games, loading: gamesLoading } = useWeekGames(week?.id);
  const { picks, refetch: refetchPicks } = useMyWeekPicks(week?.id);
  const { tiebreaker, refetch: refetchTb } = useMyTiebreaker(week?.id);
  const { records: teamRecords } = useSeasonTeamRecords(season?.id);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { locked: cardLocked, setLocked: setCardLocked } = useCardLock(user?.id, week?.id);

  const { lockAt: lockMoment, locked: weekLocked, now } = useWeekLock(games, season);
  const { insights: pickInsights } = useWeekPickInsights(week?.id, weekLocked);
  const featured = games.find((g) => g.id === week?.featured_game_id);
  const weekStatus = week ? (games.length > 0 ? deriveWeekStatus(games, week.status, now) : week.status) : 'upcoming';
  const pickedCount = picks.length;
  const totalGames = games.length;
  const remaining = Math.max(0, totalGames - pickedCount);
  const slipStatus: 'open' | 'partial' | 'complete' | 'locked' =
    weekLocked ? 'locked'
    : remaining === 0 ? 'complete'
    : weekStatus === 'partially_locked' ? 'partial'
    : 'open';

  const interactionsBlocked = weekLocked || cardLocked;
  const tiebreakerRequired = !!featured;
  const tiebreakerReady = !tiebreakerRequired || tiebreaker?.predicted_total != null;

  async function handlePick(gameId: string, teamId: string) {
    if (!user || !week || !season) return;
    if (interactionsBlocked) {
      if (cardLocked && !weekLocked) toast('Card locked — unlock to change picks', { duration: 1400 });
      return;
    }
    // Tap-to-unselect: if user taps the team they already picked, delete the pick.
    const existing = picks.find((p) => p.game_id === gameId);
    if (existing && existing.picked_team_id === teamId) {
      setSavingId(gameId);
      try {
        await deleteMyPick(existing.id);
        await refetchPicks();
        toast('Pick removed', { duration: 900 });
      } catch (e: any) {
        toast.error(e.message || 'Could not remove pick');
      } finally {
        setSavingId(null);
      }
      return;
    }
    setSavingId(gameId);
    try {
      await savePick({
        user_id: user.id,
        game_id: gameId,
        week_id: week.id,
        season_id: season.id,
        picked_team_id: teamId,
      });
      await refetchPicks();
      toast.success('Pick saved', { duration: 1100 });
    } catch (e: any) {
      toast.error(e.message || 'Could not save pick — game may be locked');
    } finally {
      setSavingId(null);
    }
  }

  async function handleTiebreakerSave(value: number) {
    if (!user || !week || !season || weekLocked || cardLocked) return;
    try {
      await saveTiebreaker({
        user_id: user.id,
        week_id: week.id,
        season_id: season.id,
        predicted_total: value,
      });
      await refetchTb();
    } catch (e: any) {
      toast.error(e.message || 'Could not save tiebreaker');
    }
  }

  async function shareCard() {
    const lines = games.map((game) => {
      const pick = picks.find((item) => item.game_id === game.id);
      const team = pick?.picked_team_id === game.away_team_id ? game.away_team : pick?.picked_team_id === game.home_team_id ? game.home_team : null;
      return `${game.away_team?.abbr ?? 'Away'} @ ${game.home_team?.abbr ?? 'Home'} — ${team?.abbr ?? 'No pick'}`;
    });
    const tb = featured && tiebreaker?.predicted_total != null ? `\nTiebreaker: ${tiebreaker.predicted_total} total points` : '';
    const text = `${week?.label ?? 'NFL Pick’em'} picks\n${lines.join('\n')}${tb}`;
    try {
      if (navigator.share) await navigator.share({ title: `${week?.label ?? 'NFL'} Pick’em`, text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success('Pick card copied');
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') toast.error('Could not share this card');
    }
  }

  if (seasonLoading || adminLoading || (season && (weeksLoading || countsLoading))) {
    return (
      <PickemShell>
        <div className="space-y-3">
          <div className="h-28 rounded-2xl skeleton-shimmer" />
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />)}
        </div>
      </PickemShell>
    );
  }

  if (!season || !week) {
    return (
      <PickemShell>
        <div className="space-y-3">
          <Link to="/pickem" className="text-[12px] text-white/55 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <div className="glass-card p-6 text-center">
            <p className="text-sm font-bold text-white">{season ? 'Week not found' : 'No active season'}</p>
          </div>
        </div>
      </PickemShell>
    );
  }

  return (
    <PickemShell>
    <div className="space-y-4 pb-32">{/* extra bottom space for sticky slip */}
      {/* Top bar — HUD already provides back nav; show only week status */}
      <div className="flex items-center justify-end">
        <WeekStatusPill status={weekStatus} />
      </div>

      {/* ─────────── Weekly Board hero (turf scorebug) ─────────── */}
      <TurfBackdrop className="px-4 pt-4 pb-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.20em] text-gold/95">
          Weekly Board
        </p>
        <div className="flex items-end justify-between gap-3 mt-0.5">
          <h1 className="text-[24px] font-extrabold tracking-tight leading-none text-white">
            {week.label}
          </h1>
          {totalGames > 0 && (
            <div className="text-[11px] font-extrabold text-white/85 tabular-nums shrink-0 pb-0.5">
              {pickedCount}<span className="text-white/55">/{totalGames}</span>{' '}
              <span className="text-gold uppercase tracking-wider text-[10px]">picked</span>
            </div>
          )}
        </div>

        {totalGames > 0 && (
          <div className="mt-2.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round((pickedCount / totalGames) * 100)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full bg-gold"
              style={{ boxShadow: '0 0 8px hsl(var(--gold) / 0.6)' }}
            />
          </div>
        )}

        {lockMoment && !weekLocked && (
          <p className="text-[11px] text-white/70 mt-2.5 flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-gold" />
            Picks freeze in <span className="font-bold text-white">
              <KickoffCountdown target={lockMoment} compact />
            </span>
          </p>
        )}
      </TurfBackdrop>

      <WeekNavigator weeks={visibleWeeks} currentWeek={week.week_number} basePath="/pickem/week" />

      {weekStatus === 'scored' && (
        <Link to={`/pickem/week/${week.week_number}/results`}>
          <div className="glass-card p-3 flex items-center gap-2 hover:bg-muted/30 transition-colors">
            <ListChecks className="w-4 h-4 text-gold" />
            <p className="text-[12px] font-extrabold flex-1">View Weekly Results</p>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      )}

      {weekLocked && picks.length > 0 && (
        <button
          type="button"
          onClick={shareCard}
          className="w-full glass-card p-3 flex items-center gap-2 hover:bg-muted/30 transition-colors btn-press text-left"
        >
          <Share2 className="w-4 h-4 text-primary" />
          <span className="text-[12px] font-extrabold flex-1">Share My Pick Card</span>
          <span className="text-[10px] text-muted-foreground">Picks are revealed</span>
        </button>
      )}

      {/* ─────────── Game Slate ─────────── */}
      {gamesLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl skeleton-shimmer" />)}
        </div>
      ) : games.length === 0 ? (
        <div className="space-y-2">
          <div className="glass-card p-7 text-center">
            <CalendarOff className="w-7 h-7 mx-auto mb-2 text-muted-foreground/50 pk-pulse" />
            <p className="text-sm font-bold mb-1">The slate is warming up</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
              Games for {week.label} will appear once the schedule is synced.
              Check back closer to kickoff.
            </p>
          </div>
          {/* Ghost placeholder cards */}
          <div className="space-y-2 opacity-40 pointer-events-none">
            {[0, 1, 2].map((i) => (
              <div key={i} className="pk-scorebug p-3">
                <div className="h-3 w-24 rounded skeleton-shimmer mb-2.5" />
                <div className="flex gap-2">
                  <div className="flex-1 h-[68px] rounded-xl bg-muted/20" />
                  <div className="flex items-center text-[9px] font-extrabold text-muted-foreground/30">@</div>
                  <div className="flex-1 h-[68px] rounded-xl bg-muted/20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground px-1">
            Game Slate · {totalGames} matchup{totalGames === 1 ? '' : 's'}
          </p>
          {games.map((game, i) => {
            const myPick = picks.find((p) => p.game_id === game.id);
            return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
              >
                <GamePickCard
                  game={game}
                  pick={myPick}
                  records={teamRecords}
                  insight={pickInsights.get(game.id)}
                  onPick={(teamId) => handlePick(game.id, teamId)}
                  saving={savingId === game.id}
                  weekLocked={weekLocked}
                  cardLocked={cardLocked}
                />
              </motion.div>
            );
          })}

          {featured && (
            <TiebreakerInput
              game={featured}
              predicted={tiebreaker?.predicted_total}
              actual={tiebreaker?.actual_total}
              onChange={handleTiebreakerSave}
              locked={weekLocked || cardLocked}
            />
          )}
        </motion.div>
      )}

      {/* ─────────── Sticky Pick Card (non-gambling pick slip) ─────────── */}
      {totalGames > 0 && (
        <PickSlipBar
          picked={pickedCount}
          total={totalGames}
          remaining={remaining}
          status={slipStatus}
          cardLocked={cardLocked}
          onToggleCardLock={() => setCardLocked(!cardLocked)}
          weekLockAt={lockMoment}
          tiebreakerRequired={tiebreakerRequired}
          tiebreakerReady={tiebreakerReady}
        />
      )}
    </div>
    </PickemShell>
  );
}

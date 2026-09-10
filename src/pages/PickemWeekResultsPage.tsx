import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Check, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useSeasonWeeks, useWeekGames, useMyWeekPicks, useWeeklyStandings,
} from '@/hooks/usePickem';
import { TeamLogo } from '@/components/pickem/TeamLogo';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { PickemShell } from '@/components/pickem/PickemShell';
import { Confetti } from '@/components/Confetti';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PickemWeekResultsPage() {
  const { weekNumber } = useParams<{ weekNumber: string }>();
  const num = parseInt(weekNumber || '1', 10);
  const { user } = useAuth();
  const { season } = useActiveSeason();
  const { weeks } = useSeasonWeeks(season?.id);
  const week = useMemo(() => weeks.find((w) => w.week_number === num), [weeks, num]);
  const { games } = useWeekGames(week?.id);
  const { picks } = useMyWeekPicks(week?.id);
  const { standings, error: standingsError, refetch: refreshStandings } = useWeeklyStandings(week?.id);
  const allFinal = games.length > 0 && games.every(game => game.status === 'final' && game.home_score != null && game.away_score != null);

  const correctCount = picks.filter((p) => p.is_correct === true).length;
  const totalScored = picks.filter((p) => p.is_correct !== null).length;
  const accuracy = totalScored > 0 ? Math.round((correctCount / totalScored) * 100) : 0;

  const meStanding = standings.find((s) => s.user_id === user?.id);
  const myRank = meStanding?.rank ?? null;
  const podiumed = allFinal && week?.status === 'scored' && myRank !== null && myRank >= 1 && myRank <= 3;

  // Trigger confetti once per session per week if user is in top 3
  const firedRef = useRef(false);
  useEffect(() => {
    if (podiumed && !firedRef.current) firedRef.current = true;
  }, [podiumed]);

  return (
    <PickemShell>
    <div className="space-y-4 pb-6">
      <Confetti active={podiumed} duration={2200} />

      <div className="flex items-center justify-end">
        <Link to={`/pickem/week/${num}`} className="text-[12px] text-gold font-extrabold btn-press">
          View Slate
        </Link>
      </div>

      {/* Recap hero — turf */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <TurfBackdrop className="px-5 py-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-gold/95">{allFinal ? 'Final Recap' : 'Results So Far'}</p>
          <h1 className="text-[26px] font-extrabold tracking-tight leading-tight text-white mt-0.5">
            {week?.label ?? `Week ${num}`}
          </h1>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[36px] font-extrabold tabular-nums leading-none text-gold drop-shadow-[0_2px_8px_rgba(45,95,55,0.5)]">{correctCount}</span>
            <span className="text-[14px] font-extrabold text-white/70 tabular-nums">/ {totalScored || picks.length}</span>
            <span className="text-[12px] text-white/65 ml-2">({accuracy}%)</span>
            {myRank && (
              <span className="ml-auto text-[12px] font-extrabold text-white/85">
                {allFinal ? 'Rank' : 'Live rank'} <span className="text-gold tabular-nums">#{myRank}</span>
              </span>
            )}
          </div>
          {podiumed && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/40">
              <Trophy className="w-3 h-3 text-gold" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold">
                {myRank === 1 ? 'Week Champion' : `Top ${myRank} Finish`}
              </span>
            </div>
          )}
        </TurfBackdrop>
      </motion.div>
      <p className="text-xs text-muted-foreground">{games.filter(game=>game.status==='final').length}/{games.length} games final · Updates every 30 seconds. {allFinal ? '' : 'Standings are provisional until the slate is final.'}</p>
      {standingsError && <button type="button" onClick={()=>void refreshStandings()} className="glass-card p-3 w-full text-sm text-destructive">{standingsError} · Retry</button>}

      {/* Per-game results */}
      <div className="space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground px-1">Game Results</p>
        {games.map((game, i) => {
          const myPick = picks.find((p) => p.game_id === game.id);
          const winner = game.winner_team_id;
          const isFinal = game.status === 'final';
          const wasCorrect = myPick?.is_correct === true;
          const wasWrong = myPick?.is_correct === false;
          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.25) }}
              className={cn(
                'rounded-2xl border p-3',
                wasCorrect && 'bg-success/5 border-success/35',
                wasWrong && 'bg-destructive/5 border-destructive/30',
                !myPick && isFinal && 'bg-muted/20 border-border/30',
                !isFinal && 'bg-card/40 border-border/30',
              )}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.14em]">
                  {format(new Date(game.kickoff_at), 'EEE h:mm a')}
                </p>
                {isFinal ? (
                  wasCorrect ? <span className="pk-stamp pk-stamp-correct"><Check className="w-3 h-3" /> Correct Pick</span>
                  : wasWrong ? <span className="pk-stamp pk-stamp-wrong"><X className="w-3 h-3" /> Missed Pick</span>
                  : <span className="pk-stamp pk-stamp-locked">No Pick</span>
                ) : (
                  <span className={cn('pk-stamp', game.status === 'live' ? 'pk-stamp-live' : 'pk-stamp-locked')}>
                    {game.status === 'live' ? 'Live' : 'Pending'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TeamRow team={game.away_team} score={game.away_score} isWinner={winner === game.away_team_id} myPickHere={myPick?.picked_team_id === game.away_team_id} />
                <span className="text-[9px] font-extrabold tracking-[0.14em] text-muted-foreground/40">VS</span>
                <TeamRow team={game.home_team} score={game.home_score} isWinner={winner === game.home_team_id} myPickHere={myPick?.picked_team_id === game.home_team_id} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Weekly leaderboard */}
      <div className="glass-card overflow-hidden">
        <div className="p-3.5 border-b border-border/20 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-gold" />
          <h3 className="font-extrabold text-[13px] tracking-tight">Weekly Leaderboard</h3>
        </div>
        {standings.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No scored picks yet for this week.</div>
        ) : (
          <div className="divide-y divide-border/10">
            {standings.map((s, i) => {
              const isMe = s.user_id === user?.id;
              const rank = s.rank ?? i + 1;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    isMe && 'bg-gold/5 border-l-2 border-l-gold',
                  )}>
                  <div className="w-7 text-center text-[12px] font-extrabold tabular-nums">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : <span className="text-muted-foreground">#{rank}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold truncate">{(s.profiles as any)?.display_name ?? 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {s.correct_picks}/{s.total_picks} · {Math.round((s.accuracy || 0) * 100)}%
                      {s.tiebreak_delta != null && <> · TB ±{s.tiebreak_delta}</>}
                    </p>
                  </div>
                  <div className="text-base font-extrabold tabular-nums">{s.correct_picks}</div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </PickemShell>
  );
}

function TeamRow({ team, score, isWinner, myPickHere }: { team?: any; score: number | null; isWinner: boolean; myPickHere: boolean }) {
  return (
    <div className={cn(
      'flex-1 flex items-center gap-2 p-2 rounded-lg transition-colors',
      isWinner && 'bg-success/12',
      myPickHere && !isWinner && 'ring-1 ring-border/50',
    )}>
      <TeamLogo team={team} size={28} className={cn(isWinner ? '' : 'opacity-80')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-[12px] font-extrabold leading-tight truncate', isWinner && 'text-success')}>{team?.abbr}</p>
      </div>
      {score !== null && <span className={cn('text-[15px] font-extrabold tabular-nums', isWinner && 'text-success')}>{score}</span>}
    </div>
  );
}

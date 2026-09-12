import { Lock, Check, X, Tv, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TeamLogo } from './TeamLogo';
import type { NflGame, NflPick, NflPickInsight, NflTeamRecord } from '@/hooks/usePickem';
import { isGameLocked } from '@/hooks/usePickem';
import { pickemGameLockAt } from '../../../supabase/functions/_shared/chainGameRules';
import { useSoundEffect } from '@/hooks/useSoundEffect';

type Props = {
  game: NflGame;
  pick?: NflPick;
  onPick: (teamId: string) => void;
  saving?: boolean;
  weekLocked?: boolean;
  cardLocked?: boolean;
  /** Optional season-records map (team_id → record) for displaying W-L + recent form. */
  records?: Map<string, NflTeamRecord>;
  /** Club-wide picks, revealed by RLS only after the week freezes. */
  insight?: NflPickInsight;
};

/** Compact season record + recent-form chip. */
function TeamRecordRow({ record }: { record?: NflTeamRecord }) {
  if (!record || record.games_played === 0) {
    return <p className="text-[9px] font-bold text-muted-foreground/55 tabular-nums leading-tight">0-0</p>;
  }
  const wl = record.ties > 0
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;
  const form = (record.recent_form || '').slice(0, 5);
  return (
    <div className="flex items-center gap-1 leading-tight">
      <p className="text-[10px] font-extrabold tabular-nums text-foreground/85">{wl}</p>
      {form.length > 0 && (
        <span className="flex items-center gap-[2px]" aria-label={`Last ${form.length} games: ${form}`}>
          {Array.from(form).map((c, i) => (
            <span
              key={i}
              className={cn(
                'inline-block w-1 h-1 rounded-full',
                c === 'W' && 'bg-success',
                c === 'L' && 'bg-destructive/70',
                c === 'T' && 'bg-muted-foreground/55',
              )}
              aria-hidden
            />
          ))}
        </span>
      )}
    </div>
  );
}

/**
 * Rendered at module scope on purpose. Declaring this inside GamePickCard made
 * React see a brand-new component type on every render, so each 30-second data
 * refresh remounted both buttons and replayed the selection/logo animations —
 * the "flashing pick icons" players reported.
 */
function TeamButton({
  side, game, pick, records, insight, locked, blocked, saving, isFinal, isLive, sweptSide, onTap,
}: {
  side: 'away' | 'home';
  game: NflGame;
  pick?: NflPick;
  records?: Map<string, NflTeamRecord>;
  insight?: NflPickInsight;
  locked: boolean;
  blocked?: boolean;
  saving?: boolean;
  isFinal: boolean;
  isLive: boolean;
  sweptSide: 'home' | 'away' | null;
  onTap: (side: 'home' | 'away', teamId: string) => void;
}) {
  const pickedId = pick?.picked_team_id;
  const team = side === 'away' ? game.away_team : game.home_team;
    const teamId = side === 'away' ? game.away_team_id : game.home_team_id;
    const score = side === 'away' ? game.away_score : game.home_score;
    const selected = pickedId === teamId;
    const isWinner = isFinal && game.winner_team_id === teamId;
    const wasCorrect = isFinal && selected && pick?.is_correct === true;
    const wasWrong = isFinal && selected && pick?.is_correct === false;
    const showSweep = sweptSide === side && selected && !isFinal;
    const clubPct = insight?.total_picks
      ? Math.round(((insight.team_counts[teamId] ?? 0) / insight.total_picks) * 100)
      : null;

    return (
      <motion.button
        type="button"
        disabled={blocked || saving}
        whileTap={!blocked && !saving ? { scale: 0.97 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        onClick={() => onTap(side, teamId)}
        className={cn(
          'nfl-team-pick flex-1 flex items-center gap-2.5 px-3 min-h-[76px] py-2.5 transition-all duration-150 btn-press',
          'border text-left relative overflow-hidden',
          selected && !isFinal && 'pk-selected',
          !selected && !locked && 'bg-card/70 hover:bg-muted/40 border-border/40',
          locked && !selected && 'bg-muted/20 border-border/20 opacity-55',
          locked && selected && !isFinal && 'pk-selected opacity-90',
          wasCorrect && 'bg-success/15 border-success/55 ring-2 ring-success/35 shadow-[0_0_18px_hsl(var(--success)/0.18)]',
          wasWrong && 'bg-destructive/10 border-destructive/45',
          isWinner && !selected && isFinal && 'border-success/35 bg-success/5',
        )}
        aria-pressed={selected}
        aria-label={`Pick ${team?.city ?? ''} ${team?.name ?? ''}${selected ? ' (selected)' : ''}`}
      >
        {showSweep && <span className="pk-sweep" aria-hidden />}
        <div className="relative">
          <TeamLogo
            team={team}
            size={38}
            className={cn(
              'transition-all',
              selected && !isFinal && 'scale-105 drop-shadow-[0_0_6px_hsl(var(--gold)/0.35)]',
              locked && !selected && 'grayscale opacity-70',
            )}
          />
          {selected && !isFinal && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gold flex items-center justify-center shadow-[0_0_8px_hsl(var(--gold)/0.6)]"
            >
              <Check className="w-2.5 h-2.5 text-background" strokeWidth={3.5} />
            </motion.div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[13px] font-extrabold leading-tight truncate tracking-tight',
            isWinner && 'text-success',
          )}>{team?.abbr}</p>
          <p className="text-[10px] text-muted-foreground/80 truncate">{team?.name}</p>
          {/* Season W-L + last-5 form. Helps users pick without leaving the page. */}
          {records && teamId && (
            <div className="mt-0.5">
              <TeamRecordRow record={records.get(teamId)} />
            </div>
          )}
          {clubPct !== null && (
            <p className="mt-1 text-[9px] font-extrabold text-primary flex items-center gap-1 tabular-nums">
              <Users className="w-2.5 h-2.5" /> {clubPct}% of club
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {(isFinal || isLive) && score !== null && (
            <span className={cn(
              'text-[18px] font-extrabold tabular-nums leading-none',
              isWinner && 'text-success',
              !isWinner && isFinal && 'text-muted-foreground/70',
            )}>
              {score}
            </span>
          )}
          {wasCorrect && <Check className="w-3.5 h-3.5 text-success" />}
          {wasWrong && <X className="w-3.5 h-3.5 text-destructive" />}
        </div>
      </motion.button>
  );
}

export function GamePickCard({ game, pick, onPick, saving, weekLocked, cardLocked, records, insight }: Props) {
  const { play } = useSoundEffect();
  const locked = isGameLocked(game) || weekLocked === true;
  const blocked = locked || cardLocked;
  const isFinal = game.status === 'final';
  const isLive = game.status === 'live';

  // Track which side was just tapped — drives the sweep animation
  const [sweptSide, setSweptSide] = useState<'home' | 'away' | null>(null);
  const sweepTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current); }, []);

  const handleTap = useCallback((side: 'home' | 'away', teamId: string) => {
    if (blocked || saving) return;
    play('tap');
    setSweptSide(side);
    if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
    sweepTimerRef.current = window.setTimeout(() => setSweptSide(null), 700);
    onPick(teamId);
  }, [blocked, saving, play, onPick]);

  const sideProps = {
    game, pick, records, insight, locked, blocked, saving, isFinal, isLive, sweptSide, onTap: handleTap,
  };

  return (
    <div className="pk-scorebug nfl-matchup-card p-3">
      <p className="nfl-matchup-deadline">{locked ? 'Deadline: ' : 'Pick by '}{format(new Date(pickemGameLockAt(game)), 'EEE, MMM d · h:mm a')} · 48h before kickoff</p>
      {/* Scorebug header: time + status (broadcast lower-third) */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <Tv className="w-3 h-3 text-muted-foreground/60" />
          <p className="text-[10px] font-extrabold text-muted-foreground/85 uppercase tracking-[0.14em] tabular-nums">
            {format(new Date(game.kickoff_at), 'EEE h:mm a')}
          </p>
        </div>
        {isFinal ? (
          <span className="pk-stamp pk-stamp-locked">Final</span>
        ) : isLive ? (
          <span className="pk-stamp pk-stamp-live">
            <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" /> Live
          </span>
        ) : locked ? (
          <span className="pk-stamp pk-stamp-locked"><Lock className="w-2.5 h-2.5" /> Picks locked</span>
        ) : cardLocked ? (
          <span className="pk-stamp pk-stamp-locked"><Lock className="w-2.5 h-2.5" /> Card locked</span>
        ) : (
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-success">Open</span>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <TeamButton side="away" {...sideProps} />
        <div
          className="flex items-center justify-center text-[9px] font-extrabold tracking-[0.18em] text-muted-foreground/60 px-1"
          aria-hidden
        >
          <span className="nfl-at-marker">@</span>
        </div>
        <TeamButton side="home" {...sideProps} />
      </div>
    </div>
  );
}

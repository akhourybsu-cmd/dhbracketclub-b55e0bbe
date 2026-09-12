import { useEffect, useState } from 'react';
import { ArrowRight, MoveRight, MoveLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftStatusHeaderProps {
  currentRound: number;
  numRounds: number;
  currentPickNumber: number;
  totalPicks: number;
  pickerName: string;
  pickerInitials: string;
  isMyTurn: boolean;
  /** Picks remaining until the viewing user's next turn (null when not participating / already picked last). */
  picksUntilYou: number | null;
  /** When the clock started (last pick or draft start) — shown as contextual elapsed time. */
  clockStartedAt: string | null;
  newPickCount: number;
  onMakePick?: () => void;
}

function useElapsedLabel(startedAt: string | null) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!startedAt) { setLabel(''); return; }
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const ms = Math.max(0, Date.now() - start);
      const mins = Math.floor(ms / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);
      setLabel(
        days >= 1 ? `on clock ${days}d ${hours % 24}h`
        : hours >= 1 ? `on clock ${hours}h ${mins % 60}m`
        : mins >= 1 ? `on clock ${mins}m`
        : 'just started',
      );
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [startedAt]);
  return label;
}

/**
 * Compact persistent status strip for the async draft room.
 * Answers in one glance: where we are, whose turn it is, and how far
 * the viewer is from picking — no giant countdown hero.
 */
export function DraftStatusHeader({
  currentRound,
  numRounds,
  currentPickNumber,
  totalPicks,
  pickerName,
  pickerInitials,
  isMyTurn,
  picksUntilYou,
  clockStartedAt,
  newPickCount,
  onMakePick,
}: DraftStatusHeaderProps) {
  const elapsed = useElapsedLabel(clockStartedAt);
  const SnakeIcon = currentRound % 2 === 1 ? MoveRight : MoveLeft;

  return (
    <div className="dl-status dl-card mb-3">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Round / pick position */}
        <div className="shrink-0">
          <p className="dl-eyebrow">
            Round {currentRound} <SnakeIcon className="inline w-3 h-3 -mt-0.5" aria-hidden />
          </p>
          <p className="dl-display text-xl font-bold leading-tight text-foreground">
            {currentPickNumber}<span className="text-muted-foreground/55 font-medium">/{totalPicks}</span>
          </p>
        </div>

        <div className="w-px self-stretch bg-border/60" aria-hidden />

        {/* Who's choosing */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              'dl-display w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0',
              isMyTurn ? 'dl-avatar-gold' : 'dl-avatar-muted',
            )}
          >
            {isMyTurn ? 'YOU' : pickerInitials}
          </div>
          <div className="min-w-0">
            <p className={cn('dl-display text-[15px] font-bold truncate', isMyTurn ? 'text-primary' : 'text-foreground')}>
              {isMyTurn ? 'Your Pick' : `${pickerName} is choosing`}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium truncate">
              {elapsed && <span>{elapsed}</span>}
              {!isMyTurn && picksUntilYou !== null && picksUntilYou > 0 && (
                <span className="text-muted-foreground/85">
                  {elapsed ? ' · ' : ''}{picksUntilYou} {picksUntilYou === 1 ? 'pick' : 'picks'} until you
                </span>
              )}
              {!isMyTurn && picksUntilYou === 0 && <span>{elapsed ? ' · ' : ''}you're up next</span>}
            </p>
          </div>
        </div>

        {/* New-since-visit marker */}
        {newPickCount > 0 && (
          <span className="dl-new-pill shrink-0" title="Picks made since your last visit">
            {newPickCount} new
          </span>
        )}
      </div>

      {/* Primary action — your turn only */}
      {isMyTurn && onMakePick && (
        <div className="px-4 pb-3.5">
          <button type="button" onClick={onMakePick} className="dl-cta w-full">
            Make Selection
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}

import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayoffRoundShort, getPlayoffGameLabel, type PlayoffRound } from '@/lib/playoffStyle';

interface PlayoffBadgeProps {
  round: PlayoffRound;
  matchNumber?: number | null;
  /** Show full "Finals · Game 2" label after the PLAYOFF chip. */
  showRoundLabel?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/** Compact "PLAYOFF" / round chip used everywhere a draft row/card appears. */
export function PlayoffBadge({ round, matchNumber, showRoundLabel = false, size = 'sm', className }: PlayoffBadgeProps) {
  const sizeCls =
    size === 'xs' ? 'text-[9.5px] px-1 py-[1px] gap-0.5' :
    size === 'md' ? 'text-[10px] px-1.5 py-0.5 gap-1' :
    'text-[9px] px-1 py-0.5 gap-0.5';
  const iconCls = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  return (
    <span className={cn('inline-flex items-center', className)}>
      <span className={cn('playoff-badge inline-flex items-center font-extrabold uppercase tracking-wider rounded', sizeCls)}>
        <Trophy className={iconCls} strokeWidth={2.5} />
        {getPlayoffRoundShort(round)}
      </span>
      {showRoundLabel && (
        <span className="playoff-badge-label ml-1 text-[9px] font-bold uppercase tracking-wider">
          {getPlayoffGameLabel(round, matchNumber)}
        </span>
      )}
    </span>
  );
}

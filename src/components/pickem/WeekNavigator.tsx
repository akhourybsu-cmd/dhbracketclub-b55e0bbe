import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NflWeek } from '@/hooks/usePickem';

type Props = {
  weeks: NflWeek[];
  currentWeek: number;
  basePath: string; // e.g. '/pickem/week'
};

export function WeekNavigator({ weeks, currentWeek, basePath }: Props) {
  const prev = weeks.find((w) => w.week_number === currentWeek - 1);
  const next = weeks.find((w) => w.week_number === currentWeek + 1);

  return (
    <div className="nfl-week-navigator space-y-2">
      <div className="flex items-center justify-between min-h-[20px]">
        {prev ? (
          <Link to={`${basePath}/${prev.week_number}`} className="flex items-center gap-1 text-[11px] font-extrabold text-muted-foreground hover:text-foreground btn-press">
            <ChevronLeft className="w-3.5 h-3.5" /> {prev.label}
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`${basePath}/${next.week_number}`} className="flex items-center gap-1 text-[11px] font-extrabold text-muted-foreground hover:text-foreground btn-press">
            {next.label} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : <span />}
      </div>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1.5 scrollbar-none snap-x">
        {weeks.map((w) => {
          const active = w.week_number === currentWeek;
          return (
            <Link
              key={w.id}
              to={`${basePath}/${w.week_number}`}
              className={cn(
                'nfl-week-button relative flex-shrink-0 min-w-[44px] h-10 px-3 flex items-center justify-center text-[11px] font-extrabold transition-colors snap-start',
                active
                  ? 'text-gold'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId="week-nav-active"
                  className="absolute inset-0 nfl-week-active"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative tabular-nums">{w.week_number}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

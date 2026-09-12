import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Timer, Zap, Target, TrendingUp, Clock, Award, Flame, ArrowRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DraftResult } from '@/hooks/useDraftResults';
import {
  computePickTimings,
  formatDuration,
  findMvpPick,
  findBiggestSteal,
  findMostConsistent,
  findScoringStreaks,
  getDisplayName,
} from '@/lib/draftStats';

interface Pick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round: number;
  picked_at?: string;
  profiles?: { display_name: string };
}

interface Participant {
  user_id: string;
  profiles?: { display_name: string };
}

interface DraftStatsCardProps {
  picks: Pick[];
  results: DraftResult[];
  participants: Participant[];
}

export function DraftStatsCard({ picks, results, participants }: DraftStatsCardProps) {
  const [open, setOpen] = useState(false);
  const timings = computePickTimings(picks);
  const mvpPick = findMvpPick(results);
  const biggestSteal = findBiggestSteal(results, picks);
  const mostConsistent = findMostConsistent(results);
  const streaks = findScoringStreaks(results, picks);

  const stats: { icon: React.ReactNode; label: string; value: string; accent?: boolean }[] = [];

  if (mvpPick) {
    stats.push({
      icon: <Award className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />,
      label: 'MVP Pick',
      value: `${mvpPick.pickText} (${mvpPick.score.toFixed(1)}) — ${getDisplayName(mvpPick.userId, participants)}`,
      accent: true,
    });
  }

  if (timings) {
    stats.push({
      icon: <Zap className="w-3.5 h-3.5 text-success" />,
      label: 'Fastest Pick',
      value: `${timings.fastest.pickText} (${formatDuration(timings.fastest.deltaMs)})`,
    });
    stats.push({
      icon: <Timer className="w-3.5 h-3.5 text-muted-foreground" />,
      label: 'Slowest Pick',
      value: `${timings.slowest.pickText} (${formatDuration(timings.slowest.deltaMs)})`,
    });
  }

  if (mostConsistent) {
    stats.push({
      icon: <Target className="w-3.5 h-3.5 text-primary" />,
      label: 'Most Consistent',
      value: `${getDisplayName(mostConsistent.userId, participants)} (σ ${mostConsistent.stdDev.toFixed(2)})`,
    });
  }

  if (biggestSteal) {
    stats.push({
      icon: <TrendingUp className="w-3.5 h-3.5 text-success" />,
      label: 'Biggest Steal',
      value: `${biggestSteal.pickText} (${biggestSteal.score.toFixed(1)}) — Rd ${biggestSteal.round}`,
    });
  }

  if (streaks.size > 0) {
    const best = [...streaks.entries()].sort((a, b) => b[1] - a[1])[0];
    stats.push({
      icon: <Flame className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />,
      label: 'Longest Hot Streak',
      value: `${getDisplayName(best[0], participants)} — ${best[1]} picks (7.5+)`,
    });
  }

  if (timings?.totalDurationMs) {
    stats.push({
      icon: <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />,
      label: 'Total Duration',
      value: formatDuration(timings.totalDurationMs),
    });
  }

  if (stats.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="da-glass overflow-hidden mb-4"
      >
        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center gap-2 text-left">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground/60 flex-1">Draft Stats</span>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border/15 border-t border-border/25">
            {stats.map((stat, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{stat.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{stat.label}</p>
                  <p className={cn(
                    "text-[12px] font-semibold mt-0.5",
                    stat.accent && "font-extrabold"
                  )} style={stat.accent ? { color: 'hsl(var(--gold))' } : undefined}>
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {/* Bridge to the career-level Stats Hub. The per-draft card
              (here) shows micro-stats — pick-level wins for one draft.
              The hub shows the macro view across every draft you've
              played. Without this link, those two surfaces are siloed
              and users may not realise the hub exists. */}
          <Link
            to="/drafts?tab=stats"
            className="border-t border-border/25 px-4 py-2.5 flex items-center gap-2 text-[11px] font-bold text-primary hover:bg-primary/8 active:bg-primary/12 transition-colors group"
          >
            <span className="flex-1">View your career stats</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
}

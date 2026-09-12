// Ranked results for a date-availability poll.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  type AvailabilityVote,
  type DateOption,
  type MemberRef,
  pendingMembers,
  rankDateOptions,
  summarizeTally,
} from '@/lib/polls/availability';

type Props = {
  options: DateOption[];
  votes: AvailabilityVote[];
  members: MemberRef[];
  /** Called with the winning date key when the creator turns it into an event. */
  onCreateEvent?: (dateKey: string, label: string) => void;
};

export default function AvailabilityResults({ options, votes, members, onCreateEvent }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const tallies = rankDateOptions(options, votes, members);
  const pending = pendingMembers(members, votes);
  const best = tallies[0];

  return (
    <div>
      <div className="section-divider mb-3">
        <h3 className="section-header mb-0">Best dates</h3>
      </div>

      <div className="space-y-2">
        {tallies.map((t, idx) => {
          const isOpen = expanded === t.option.id;
          const isBest = idx === 0 && (t.yes.length > 0 || t.maybe.length > 0);
          return (
            <motion.div
              key={t.option.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * idx }}
              className={cn('glass-card overflow-hidden', isBest && 'border-success/35')}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : t.option.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
                aria-expanded={isOpen}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold">{t.option.label}</span>
                    {t.allAvailable && (
                      <span className="status-pill bg-success/10 text-success">
                        <Sparkles className="mr-0.5 h-3 w-3" /> Everyone's free
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">{summarizeTally(t)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {t.yes.length > 0 && (
                    <span className="font-mono text-[13px] font-extrabold text-success tabular-nums">{t.yes.length}</span>
                  )}
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground/50 transition-transform', isOpen && 'rotate-180')} />
                </div>
              </button>

              {isOpen && (
                <div className="space-y-2 border-t border-border/20 px-4 py-3">
                  {([
                    ['Free', t.yes, 'text-success'],
                    ['Maybe', t.maybe, 'text-warning'],
                    ["Can't", t.no, 'text-destructive'],
                  ] as const).map(([label, list, color]) =>
                    list.length > 0 ? (
                      <div key={label} className="flex items-start gap-2">
                        <span className={cn('w-12 shrink-0 text-[10px] font-bold uppercase', color)}>{label}</span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {list.map((m) => m.display_name || 'Member').join(', ')}
                        </span>
                      </div>
                    ) : null,
                  )}
                  {t.yes.length === 0 && t.maybe.length === 0 && t.no.length === 0 && (
                    <p className="text-[11px] text-muted-foreground/70">Nobody has answered this date yet.</p>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {pending.length > 0 && (
        <p className="mt-3 text-[11px] font-medium text-muted-foreground/70">
          Still waiting on: {pending.map((m) => m.display_name || 'Member').join(', ')}
        </p>
      )}

      {onCreateEvent && best && (best.yes.length > 0 || best.maybe.length > 0) && (
        <Button
          onClick={() => onCreateEvent(best.option.date, best.option.label)}
          className="mt-4 h-11 w-full gap-2 rounded-xl text-[13px] font-bold btn-press"
        >
          <CalendarPlus className="h-4 w-4" /> Create event on {best.option.label}
        </Button>
      )}
    </div>
  );
}

// Month calendar used for both authoring a date poll (pick candidate
// dates) and answering one (cycle yes → maybe → no on each candidate).
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type AvailabilityResponse,
  formatMonthTitle,
  monthGrid,
  toDateKey,
  WEEKDAY_LABELS,
} from '@/lib/polls/availability';

type BaseProps = {
  /** Initial visible month. */
  month?: Date;
  disabled?: boolean;
};

type AuthorProps = BaseProps & {
  mode: 'author';
  /** Selected candidate date keys. */
  selected: string[];
  onToggle: (dateKey: string) => void;
};

type VoteProps = BaseProps & {
  mode: 'vote';
  /** Candidate date keys — only these are tappable. */
  candidates: string[];
  responses: Record<string, AvailabilityResponse | undefined>;
  onCycle: (dateKey: string) => void;
};

type Props = AuthorProps | VoteProps;

const RESPONSE_STYLES: Record<AvailabilityResponse, string> = {
  yes: 'bg-success/20 text-success border-success/50',
  maybe: 'bg-warning/20 text-warning border-warning/50',
  no: 'bg-destructive/15 text-destructive border-destructive/40',
};

export default function DateGridPicker(props: Props) {
  const [visible, setVisible] = useState(() => {
    const base = props.month ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const days = monthGrid(visible);
  const todayKey = toDateKey(new Date());

  const shiftMonth = (delta: number) =>
    setVisible((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-extrabold tracking-tight">{formatMonthTitle(visible)}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[10px] font-bold uppercase text-muted-foreground/50">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = day.getMonth() === visible.getMonth();
          const isToday = key === todayKey;

          const isCandidate = props.mode === 'author' ? true : props.candidates.includes(key);
          const authorSelected = props.mode === 'author' && props.selected.includes(key);
          const response = props.mode === 'vote' ? props.responses[key] : undefined;
          const tappable = !props.disabled && isCandidate;

          return (
            <button
              key={key}
              type="button"
              disabled={!tappable}
              aria-pressed={props.mode === 'author' ? authorSelected : !!response}
              aria-label={`${key}${response ? ` — ${response}` : ''}`}
              onClick={() => {
                if (!tappable) return;
                if (props.mode === 'author') props.onToggle(key);
                else props.onCycle(key);
              }}
              className={cn(
                'relative flex h-11 items-center justify-center rounded-xl border text-[12px] font-bold tabular-nums transition-all',
                'border-border/25 bg-muted/25 text-foreground/80',
                !inMonth && 'text-muted-foreground/35',
                !tappable && 'cursor-default opacity-45',
                tappable && 'active:scale-[0.94]',
                authorSelected && 'border-warning/60 bg-warning/20 text-warning',
                response && RESPONSE_STYLES[response],
                props.mode === 'vote' && isCandidate && !response && 'border-warning/35 bg-warning/5',
                isToday && 'ring-1 ring-primary/40',
              )}
            >
              {day.getDate()}
              {response === 'yes' && <Check className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5" />}
              {response === 'maybe' && <HelpCircle className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5" />}
              {response === 'no' && <X className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5" />}
            </button>
          );
        })}
      </div>

      {props.mode === 'vote' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-muted-foreground/70">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-success/50" /> Free</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-warning/50" /> Maybe</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/40" /> Can't</span>
          <span>Tap a highlighted date to cycle.</span>
        </div>
      )}
    </div>
  );
}

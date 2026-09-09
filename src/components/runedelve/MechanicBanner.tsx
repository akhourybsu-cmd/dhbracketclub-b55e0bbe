import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getMechanic, type MechanicId } from '@/lib/runedelve/mechanics';
import { cn } from '@/lib/utils';

interface Props {
  mechanics: MechanicId[];
}

/**
 * Compact inline strip rendered above the rune board on any level that uses
 * one or more taught mechanics. Collapses to a single row of icon chips by
 * default; tap to expand a one-liner per mechanic.
 *
 * Designed mobile-first: the collapsed state takes ~36px of vertical space,
 * which keeps the board comfortably above the fold on a 411x734 viewport.
 */
export function MechanicBanner({ mechanics }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!mechanics.length) return null;
  const items = mechanics.map(getMechanic);

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className={cn(
        'w-full text-left rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 btn-press',
        'transition-all',
      )}
      aria-expanded={expanded}
      aria-label={expanded ? 'Hide mechanic details' : 'Show mechanic details'}
    >
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-primary px-1.5 py-0.5 rounded bg-primary/15">
          {items.length === 1 ? 'Rule' : '2 Rules'}
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {items.map(m => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground/90 truncate"
            >
              <span aria-hidden>{m.icon}</span>
              <span className="truncate">{m.name}</span>
            </span>
          ))}
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-primary/15 space-y-1.5">
          {items.map(m => (
            <div key={m.id} className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5" aria-hidden>{m.icon}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold leading-tight">{m.name}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{m.oneLiner}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

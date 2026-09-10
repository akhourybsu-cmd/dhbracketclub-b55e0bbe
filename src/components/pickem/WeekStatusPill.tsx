import { cn } from '@/lib/utils';
import type { NflWeek } from '@/hooks/usePickem';

const MAP: Record<NflWeek['status'], { label: string; cls: string; live?: boolean }> = {
  upcoming:        { label: 'Upcoming',     cls: 'bg-muted/60 text-muted-foreground border border-border/40' },
  open:            { label: 'Picks Open',   cls: 'bg-success/15 text-success border border-success/30' },
  partially_locked:{ label: 'Some Picks Locked',  cls: 'bg-gold/15 text-gold border border-gold/30', live: true },
  closed:          { label: 'Picks Locked',cls: 'bg-muted/60 text-muted-foreground border border-border/40' },
  scored:          { label: 'Scored',       cls: 'bg-primary/15 text-primary border border-primary/30' },
};

export function WeekStatusPill({ status }: { status: NflWeek['status'] }) {
  const m = MAP[status] ?? MAP.upcoming;
  return (
    <span
      key={status}
      className={cn(
        'status-pill inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 font-extrabold uppercase tracking-[0.1em] rounded-full animate-fade-in whitespace-nowrap',
        m.cls
      )}
    >
      {m.live && <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
      {m.label}
    </span>
  );
}

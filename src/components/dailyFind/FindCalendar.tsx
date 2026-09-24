import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { localDayKey, type DailyFind } from '@/lib/dailyFind';
import { FindPhoto } from './FindCard';

const KIND_DOT = { learned: 'bg-[hsl(var(--drop-learned))]', article: 'bg-[hsl(var(--drop-read))]', photo: 'bg-[hsl(var(--drop-saw))]' } as const;

interface Props {
  month: Date;
  onMonthChange: (d: Date) => void;
  finds: DailyFind[];
  selectedDay: string | null;
  onSelectDay: (key: string) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function FindCalendar({ month, onMonthChange, finds, selectedDay, onSelectDay }: Props) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const today = localDayKey();
  const byDay = new Map<string, DailyFind[]>();
  for (const f of finds) byDay.set(f.find_date, [...(byDay.get(f.find_date) ?? []), f]);

  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const isCurrentMonth = y === new Date().getFullYear() && m === new Date().getMonth();

  return (
    <div className="drop-surface rounded-2xl border p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => onMonthChange(new Date(y, m - 1, 1))} aria-label="Previous month" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted/60"><ChevronLeft className="h-5 w-5" /></button>
        <p className="text-sm font-extrabold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        <button type="button" disabled={isCurrentMonth} onClick={() => onMonthChange(new Date(y, m + 1, 1))} aria-label="Next month" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted/60 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => <span key={i} className="pb-1 text-[10px] font-bold text-muted-foreground">{d}</span>)}
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const key = localDayKey(new Date(y, m, day));
          const list = byDay.get(key) ?? [];
          const photo = list.find(f => f.image_path);
          const selected = selectedDay === key;
          const future = key > today;
          return (
            <motion.button
              key={i}
              type="button"
              whileTap={{ scale: 0.92 }}
              disabled={future}
              onClick={() => onSelectDay(key)}
              aria-label={`${key}, ${list.length} finds`}
              aria-pressed={selected}
              className={cn(
                'relative aspect-square overflow-hidden rounded-lg text-xs font-bold transition-all disabled:opacity-30',
                list.length ? 'bg-[hsl(var(--drop-accent)/0.1)]' : 'bg-muted/30',
                selected && 'ring-2 ring-[hsl(var(--drop-accent))] ring-offset-1 ring-offset-card',
                key === today && !selected && 'ring-1 ring-foreground/30',
              )}
            >
              {photo && <FindPhoto path={photo.image_path} className="absolute inset-0 opacity-60" />}
              <span className={cn('relative', photo && 'drop-shadow-[0_1px_2px_hsl(var(--background))]')}>{day}</span>
              {list.length > 0 && (
                <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                   {list.slice(0, 3).map(f => <span key={f.id} className={cn('h-1.5 w-1.5 rounded-full ring-1 ring-background', KIND_DOT[f.kind])} />)}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

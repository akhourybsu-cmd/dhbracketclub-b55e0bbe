import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useDailyFind } from '@/hooks/useDailyFinds';
import { FindPhoto } from '@/components/dailyFind/FindCard';
import { formatDayKey, kindMeta } from '@/lib/dailyFind';

export function DailyFindShareCard({ findId }: { findId: string }) {
  const navigate = useNavigate();
  const { data: find, isLoading } = useDailyFind(findId);
  if (isLoading) return <div className="mt-2 h-32 max-w-[330px] animate-pulse rounded-xl border border-border/40 bg-secondary/40" />;
  if (!find) return null;
  const meta = kindMeta(find.kind);
  return (
    <button type="button" onClick={() => navigate(`/finds/${find.id}`)} className="mt-2 block w-full max-w-[330px] overflow-hidden rounded-xl border border-[hsl(var(--gold)/0.35)] bg-card text-left active:scale-[0.99]">
      {find.image_path && <FindPhoto path={find.image_path} className="aspect-[16/9] w-full" />}
      <div className="p-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[hsl(var(--gold))]">{meta.emoji} Daily Find · {formatDayKey(find.find_date)}</p>
        <p className="mt-1 text-sm font-extrabold leading-snug">{find.title}</p>
        {find.note && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{find.note}</p>}
        <p className="mt-2 flex items-center gap-1 text-xs font-bold text-foreground/80">{find.profiles?.display_name ?? 'Member'} <ArrowRight className="ml-auto h-3.5 w-3.5" /></p>
      </div>
    </button>
  );
}

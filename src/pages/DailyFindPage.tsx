import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bookmark, CalendarDays, Flame, Plus, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useDailyFinds, useSearchFinds } from '@/hooks/useDailyFinds';
import { FindCard } from '@/components/dailyFind/FindCard';
import { FindCalendar } from '@/components/dailyFind/FindCalendar';
import { ComposeFindSheet } from '@/components/dailyFind/ComposeFindSheet';
import { MemberLoadError } from '@/components/member/MemberLoadError';
import { currentStreak, formatDayKey, localDayKey, type DailyFind } from '@/lib/dailyFind';
import { cn } from '@/lib/utils';

type Tab = 'club' | 'calendar' | 'search';
const TABS: { value: Tab; label: string; icon: typeof Users }[] = [
  { value: 'club', label: 'Club', icon: Users },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'search', label: 'Search', icon: Search },
];

function FeedList({ finds, empty }: { finds: DailyFind[]; empty: string }) {
  if (finds.length === 0) return <div className="drop-surface rounded-2xl border border-dashed p-8 text-center"><Bookmark className="mx-auto h-7 w-7 text-[hsl(var(--drop-accent))]" /><p className="mt-3 text-sm font-semibold text-muted-foreground">{empty}</p></div>;
  const groups: [string, DailyFind[]][] = [];
  for (const f of finds) {
    const last = groups[groups.length - 1];
    if (last && last[0] === f.find_date) last[1].push(f); else groups.push([f.find_date, [f]]);
  }
  let i = 0;
  return (
    <div className="space-y-5">
      {groups.map(([day, list]) => (
        <section key={day}>
           <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
             <span>{day === localDayKey() ? "Today's collection" : formatDayKey(day, { weekday: 'long', month: 'short', day: 'numeric' })}</span><span className="h-px flex-1 bg-border/60" />
          </h2>
          <div className="space-y-3">{list.map(f => <FindCard key={f.id} find={f} index={i++} />)}</div>
        </section>
      ))}
    </div>
  );
}

export default function DailyFindPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'club';
  const setTab = (t: Tab) => setParams(p => { p.set('tab', t); return p; }, { replace: true });
  const [composeOpen, setComposeOpen] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(localDayKey());
  const [onlyMine, setOnlyMine] = useState(true);
  const [term, setTerm] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const today = localDayKey();
  const feedRange = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    return { from: localDayKey(d), to: today };
  }, [today]);
  const monthRange = useMemo(() => ({
    from: localDayKey(month),
    to: localDayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  }), [month]);

  const feed = useDailyFinds(feedRange);
  const monthQ = useDailyFinds(monthRange);
  const search = useSearchFinds(term, tag);

  const recent = feed.data ?? [];
  const mine = recent.filter(f => f.user_id === user?.id);
  const myToday = mine.find(f => f.find_date === today);
  const streak = currentStreak(mine.map(f => f.find_date));
  const posters = new Set(recent.filter(f => f.find_date === today).map(f => f.user_id)).size;
  const topTags = useMemo(() => {
    const c = new Map<string, number>();
    recent.forEach(f => f.tags.forEach(t => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [recent]);

  const monthFinds = (monthQ.data ?? []).filter(f => !onlyMine || f.user_id === user?.id);
  const dayFinds = selectedDay ? monthFinds.filter(f => f.find_date === selectedDay) : [];

  return (
    <div className="drop-page member-page lg:mx-auto lg:max-w-2xl">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="drop-hero relative mb-5 overflow-hidden rounded-2xl border p-5 sm:p-6">
        <div aria-hidden className="drop-hero-mark">D</div>
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[hsl(var(--drop-accent))]"><Bookmark className="h-3.5 w-3.5" /> Members' daily collection</p>
            <h1 className="mt-2 text-4xl font-black leading-none">The Drop</h1>
            <p className="mt-2 text-sm text-muted-foreground">One thing worth sharing today.</p>
          </div>
          <div className="drop-streak flex flex-col items-center rounded-xl px-3 py-2" aria-label={`${streak} day streak`}>
            <Flame className={cn('h-5 w-5', streak > 0 ? 'text-[hsl(var(--drop-accent))]' : 'text-muted-foreground')} />
            <span className="text-lg font-black tabular-nums leading-none">{streak}</span>
            <span className="text-[9px] font-bold uppercase text-muted-foreground">streak</span>
          </div>
        </div>
        <div className="relative mt-4">
          {feed.isLoading ? <Skeleton className="h-12 w-full rounded-xl" /> : myToday ? (
             <button type="button" onClick={() => navigate(`/finds/${myToday.id}`)} className="flex w-full items-center gap-3 rounded-xl border border-[hsl(var(--drop-accent)/0.25)] bg-[hsl(var(--drop-accent)/0.09)] p-3 text-left">
               <span className="drop-mini-mark">✓</span>
               <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase text-muted-foreground">Today's Drop is in</span><span className="block truncate text-sm font-bold">{myToday.title}</span></span>
            </button>
          ) : (
            <motion.div whileTap={{ scale: 0.98 }}>
               <Button onClick={() => setComposeOpen(true)} className="drop-primary h-12 w-full text-base font-bold"><Plus /> Add Today's Drop</Button>
            </motion.div>
          )}
        </div>
      </motion.header>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-border/40 bg-muted/30 p-1" role="tablist">
        {TABS.map(t => (
          <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
            className={cn('flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all', tab === t.value ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'club' && (
        feed.isError ? <MemberLoadError message={(feed.error as Error)?.message} onRetry={() => feed.refetch()} />
          : feed.isLoading ? <div className="space-y-3">{[0, 1].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
          : <><div className="mb-4 flex items-center justify-between px-1"><p className="text-sm font-bold">{posters} {posters === 1 ? 'member has' : 'members have'} dropped today</p><span className="text-xs text-muted-foreground">Worth saving</span></div><FeedList finds={recent} empty="Nothing dropped yet today. Be the first to share something worth saving." /></>
      )}

      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-full bg-muted/40 p-1 text-sm font-bold">
            {[true, false].map(v => (
              <button key={String(v)} type="button" onClick={() => setOnlyMine(v)} className={cn('h-9 flex-1 rounded-full', onlyMine === v ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                 {v ? 'My collection' : 'Club archive'}
              </button>
            ))}
          </div>
          <FindCalendar month={month} onMonthChange={setMonth} finds={monthFinds} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          {selectedDay && (
            <FeedList finds={dayFinds} empty={`Nothing saved on ${formatDayKey(selectedDay, { month: 'long', day: 'numeric' })}.`} />
          )}
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
             <Input value={term} onChange={e => setTerm(e.target.value)} placeholder="Search the collection" className="h-12 pl-9" />
          </div>
          {topTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {topTags.map(t => (
                <button key={t} type="button" onClick={() => setTag(tag === t ? null : t)}
                  className={cn('h-9 rounded-full border px-3 text-sm font-semibold', tag === t ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.14)]' : 'border-border/50 text-muted-foreground')}>
                  #{t}
                </button>
              ))}
            </div>
          )}
          {term.trim().length < 2 && !tag
            ? <p className="p-6 text-center text-sm text-muted-foreground">Type at least 2 letters or pick a tag.</p>
            : search.isLoading ? <Skeleton className="h-40 rounded-2xl" />
            : <FeedList finds={search.data ?? []} empty="No Drops match." />}
        </div>
      )}

      <ComposeFindSheet open={composeOpen} onOpenChange={setComposeOpen} onCreated={id => navigate(`/finds/${id}`)} />
    </div>
  );
}

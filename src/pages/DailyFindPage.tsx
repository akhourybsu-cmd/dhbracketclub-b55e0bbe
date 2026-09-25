import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bookmark, CalendarDays, Flame, Maximize, Minimize, Plus, Search, Users } from 'lucide-react';
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
const TAB_STORAGE_KEY = 'dh_drop_tab_v1';
const TABS: { value: Tab; label: string; icon: typeof Users }[] = [
  { value: 'club', label: 'Club', icon: Users },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'search', label: 'Search', icon: Search },
];

function FeedList({ finds, empty, immersive = false }: { finds: DailyFind[]; empty: string; immersive?: boolean }) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!immersive) return;
    const feed = feedRef.current;
    if (!feed) return;

    let gestureLocked = false;
    let unlockTimer: number | undefined;
    const unlockAfterGesture = () => {
      window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => { gestureLocked = false; }, 420);
    };
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 8 || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      event.preventDefault();
      unlockAfterGesture();
      if (gestureLocked) return;
      gestureLocked = true;
      const page = Math.round(feed.scrollTop / feed.clientHeight);
      const next = Math.max(0, Math.min(finds.length - 1, page + (event.deltaY > 0 ? 1 : -1)));
      feed.scrollTo({ top: next * feed.clientHeight, behavior: 'smooth' });
    };

    feed.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      feed.removeEventListener('wheel', handleWheel);
      window.clearTimeout(unlockTimer);
    };
  }, [finds.length, immersive]);

  if (finds.length === 0) return <div className="drop-surface rounded-2xl border border-dashed p-8 text-center"><Bookmark className="mx-auto h-7 w-7 text-[hsl(var(--drop-accent))]" /><p className="mt-3 text-sm font-semibold text-muted-foreground">{empty}</p></div>;
  if (immersive) return (
    <div ref={feedRef} className="drop-feed drop-snap-feed" aria-label="Club Drops">
      {finds.map((find, index) => <FindCard key={find.id} find={find} index={index} immersive />)}
    </div>
  );
  const groups: [string, DailyFind[]][] = [];
  for (const f of finds) {
    const last = groups[groups.length - 1];
    if (last && last[0] === f.find_date) last[1].push(f); else groups.push([f.find_date, [f]]);
  }
  let i = 0;
  return (
    <div className="drop-feed space-y-8">
      {groups.map(([day, list]) => (
        <section key={day}>
            <h2 className="drop-day-rule mb-3 flex items-center gap-3 px-4 text-[11px] font-bold uppercase text-muted-foreground sm:px-0">
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
  const requestedTab = params.get('tab');
  const storedTab = typeof window !== 'undefined' ? window.localStorage.getItem(TAB_STORAGE_KEY) : null;
  const tab: Tab = requestedTab === 'calendar' || requestedTab === 'search' || requestedTab === 'club'
    ? requestedTab
    : storedTab === 'calendar' || storedTab === 'search' || storedTab === 'club' ? storedTab : 'club';
  const setTab = (t: Tab) => {
    window.localStorage.setItem(TAB_STORAGE_KEY, t);
    setParams(p => { p.set('tab', t); return p; }, { replace: true });
  };
  const [composeOpen, setComposeOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shared, setShared] = useState<{ title: string; url: string; note: string } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('drop-focus-active', isFullscreen);
    return () => document.documentElement.classList.remove('drop-focus-active');
  }, [isFullscreen]);

  const toggleFullscreen = () => setIsFullscreen(current => !current);
  useEffect(() => {
    const st = params.get('share_title') || '', sx = params.get('share_text') || '', su = params.get('share_url') || '';
    if (!st && !sx && !su) return;
    const found = su || (sx.match(/https?:\/\/[^\s]+/)?.[0] ?? '');
    const leftover = sx.replace(found, '').trim();
    setShared({ url: found, title: (st || leftover || '').slice(0, 160), note: st && leftover ? leftover.slice(0, 2000) : '' });
    setComposeOpen(true);
    setParams(p => { ['share_title', 'share_text', 'share_url'].forEach(k => p.delete(k)); return p; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const selectedDay = params.get('day') || localDayKey();
  const [onlyMine, setOnlyMine] = useState(true);
  const term = params.get('q') || '';
  const tag = params.get('tag');
  const updateParam = (key: string, value: string | null) => setParams(p => {
    if (value) p.set(key, value); else p.delete(key);
    return p;
  }, { replace: true });

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
     <div className={cn('drop-page member-page lg:mx-auto lg:max-w-[72rem]', tab === 'club' && 'drop-reels-page', isFullscreen && 'drop-focus-mode')}>
       <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('drop-masthead px-4 sm:px-6 lg:px-8', tab === 'club' ? 'drop-reels-header' : 'mb-3 pb-5 pt-3 sm:pt-5')}>
         <div className="drop-brand-lockup">
           <span className="drop-brand-mark" aria-hidden="true">D</span>
           <div>
             <p className="drop-brand-kicker">Club culture, collected daily</p>
             <h1 className="drop-title">The Drop</h1>
           </div>
         </div>
         <div className="drop-header-actions">
           <div className="drop-day-signal" aria-label={`${posters} members posted today, ${streak} day streak`}>
             <span><i />{posters} today</span>
             <span><Flame className="h-3.5 w-3.5" />{streak} day streak</span>
           </div>
           {tab === 'club' && (
             <Button type="button" variant="outline" size="icon" onClick={toggleFullscreen} className="drop-fullscreen h-11 w-11 rounded-full" aria-label={isFullscreen ? 'Exit full screen' : 'View The Drop full screen'} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
               {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
             </Button>
           )}
           {feed.isLoading ? <Skeleton className="h-11 w-11 rounded-full" /> : (
             <motion.div whileTap={{ scale: 0.92 }}>
               <Button onClick={() => setComposeOpen(true)} size="icon" className="drop-primary h-11 w-11 rounded-full" aria-label={myToday ? 'Add another Drop' : "Add today's Drop"}><Plus className="h-5 w-5" /></Button>
             </motion.div>
           )}
         </div>
       </motion.header>

       <div className={cn('drop-tabs sticky top-0 z-20 flex items-stretch border-b px-4 sm:px-6 lg:px-8', tab === 'club' ? 'drop-reels-tabs' : 'mb-5')} role="tablist">
        {TABS.map(t => (
           <Button key={t.value} type="button" variant="ghost" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
             className={cn('drop-tab relative h-12 rounded-none px-0 text-sm', tab === t.value ? 'drop-tab-active' : 'text-muted-foreground hover:bg-transparent hover:text-foreground')}>
             <t.icon className="h-4 w-4" /> {t.value === 'club' ? 'Feed' : t.label}
           </Button>
        ))}
      </div>

       <main className="drop-content">
       {tab === 'club' && (
        feed.isError ? <MemberLoadError message={(feed.error as Error)?.message} onRetry={() => feed.refetch()} />
          : feed.isLoading ? <div className="space-y-3">{[0, 1].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
          : <FeedList finds={recent} immersive empty="Nothing dropped yet today. Be the first to share something worth saving." />
      )}

      {tab === 'calendar' && (
         <div className="space-y-4 px-4 sm:px-6 lg:px-8">
           <div className="drop-segmented flex gap-1 rounded-xl border p-1 text-sm font-bold">
            {[true, false].map(v => (
               <button key={String(v)} type="button" onClick={() => setOnlyMine(v)} className={cn('h-10 flex-1 rounded-lg', onlyMine === v ? 'drop-tab-active' : 'text-muted-foreground')}>
                 {v ? 'My collection' : 'Club archive'}
              </button>
            ))}
          </div>
          <FindCalendar month={month} onMonthChange={setMonth} finds={monthFinds} selectedDay={selectedDay} onSelectDay={day => updateParam('day', day)} />
          {selectedDay && (
            <FeedList finds={dayFinds} empty={`Nothing saved on ${formatDayKey(selectedDay, { month: 'long', day: 'numeric' })}.`} />
          )}
        </div>
      )}

      {tab === 'search' && (
         <div className="space-y-4 px-4 sm:px-6 lg:px-8">
          <div className="relative">
             <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={term} onChange={e => updateParam('q', e.target.value)} placeholder="Search the collection" className="drop-search h-13 pl-11" />
          </div>
          {topTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {topTags.map(t => (
                 <button key={t} type="button" onClick={() => updateParam('tag', tag === t ? null : t)}
                   className={cn('h-10 rounded-full border px-4 text-sm font-semibold', tag === t ? 'border-[hsl(var(--drop-accent))] bg-[hsl(var(--drop-accent)/0.14)] text-foreground' : 'border-border/60 bg-[hsl(var(--drop-paper))] text-muted-foreground')}>
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
       </main>

       <ComposeFindSheet open={composeOpen} onOpenChange={o => { setComposeOpen(o); if (!o) setShared(null); }} initial={shared} onCreated={id => navigate(`/finds/${id}`)} />
    </div>
  );
}

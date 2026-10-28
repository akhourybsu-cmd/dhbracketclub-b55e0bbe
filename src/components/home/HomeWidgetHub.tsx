import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  Flame,
  LineChart,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { APP_NAV_SECTIONS } from '@/lib/appNavigation';
import { NAV_ASSET_SLUGS, type InstalledAsset } from '@/types/assets';
import { cn } from '@/lib/utils';
import type { DraftSeason, SeasonStanding } from '@/hooks/useDraftSeasons';
import { formatSeasonTitle } from '@/hooks/useDraftSeasons';
import { pickemGameIsOpen } from '../../../supabase/functions/_shared/chainGameRules';
import { useActiveSeason, useCurrentWeek, useMyWeekPicks, useWeekGames } from '@/hooks/usePickem';
import { livePortfolioValue, usePwPortfolio, usePwQuotes, usePwSeason, usePwSettings } from '@/hooks/usePwLeague';
import { formatCountdown, marketState, money, pct, seasonLabel } from '@/lib/portfolioWars/market';
import { useWorkoutArena } from '@/hooks/useWorkoutArena';
import { useWorkoutLog } from '@/hooks/useWorkoutLog';
import { buildLeaderboard, userWeekScore } from '@/lib/workout/scoring';

interface DraftWidgetRow {
  id: string;
  topic: string;
  status: string;
  current_pick_user_id: string | null;
}

interface HomeWidgetHubProps {
  enabledAssets: InstalledAsset[];
  installedSlugs: Set<string>;
  userId?: string;
  clubId?: string;
  drafts: DraftWidgetRow[];
  draftSeason: DraftSeason | null;
  draftSeasonTarget: number;
  draftSeasonCompleted: number;
  draftStandings: SeasonStanding[];
  className?: string;
}

const SPECIAL_WIDGETS = new Set(['portfolio-wars', 'nfl-pickem', 'draft-arena', 'workout-competition']);

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.03 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 } },
};

const reducedItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.16 } },
};

export function HomeWidgetHub({
  enabledAssets,
  installedSlugs,
  userId,
  clubId,
  drafts,
  draftSeason,
  draftSeasonTarget,
  draftSeasonCompleted,
  draftStandings,
  className,
}: HomeWidgetHubProps) {
  const reduce = useReducedMotion();
  const launchers = useMemo(() => buildLauncherItems(enabledAssets), [enabledAssets]);
  const hasSpecialized = ['portfolio-wars', 'nfl-pickem', 'draft-arena', 'workout-competition']
    .some((slug) => installedSlugs.has(slug));

  if (!hasSpecialized && launchers.length === 0) return null;

  return (
    <section aria-label="App widgets" className={cn('home-widget-hub min-w-0 space-y-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">In play</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em]">Your active apps</h2>
        </div>
        <Link to="/compete" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          All apps <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr))]"
      >
        {installedSlugs.has('portfolio-wars') && (
          <PortfolioWidget variants={reduce ? reducedItem : item} />
        )}
        {installedSlugs.has('nfl-pickem') && (
          <PickemWidget variants={reduce ? reducedItem : item} />
        )}
        {installedSlugs.has('draft-arena') && (
          <DraftWidget
            variants={reduce ? reducedItem : item}
            userId={userId}
            drafts={drafts}
            season={draftSeason}
            seasonTarget={draftSeasonTarget}
            seasonCompleted={draftSeasonCompleted}
            standings={draftStandings}
          />
        )}
        {installedSlugs.has('workout-competition') && (
          <ForgeWidget variants={reduce ? reducedItem : item} clubId={clubId} userId={userId} />
        )}
      </motion.div>

      {launchers.length > 0 && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr))]"
        >
          {launchers.map(({ path, label, icon: Icon }) => (
            <motion.div key={path} variants={reduce ? reducedItem : item}>
              <Link
                to={path}
                className="home-widget-launcher flex min-h-[76px] min-w-0 items-center gap-3 rounded-2xl border border-border/45 bg-card px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[13px] font-semibold leading-tight tracking-[-0.01em]">{label}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">Open widget</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  );
}

function PortfolioWidget({ variants }: { variants: Variants }) {
  const { data: season, isLoading: seasonLoading } = usePwSeason();
  const { data: settings } = usePwSettings();
  const { data: pf, isLoading: portfolioLoading } = usePwPortfolio(season?.id);
  const holdings = pf?.holdings ?? [];
  const symbols = useMemo(() => holdings.map((holding) => holding.symbol), [holdings]);
  const { data: quotes } = usePwQuotes(symbols, symbols.length > 0);
  const market = marketState();
  const startingCash = Number(season?.starting_cash ?? settings?.starting_cash ?? 50000);
  const live = livePortfolioValue(pf?.portfolio, holdings, quotes, startingCash);
  const returnPct = ((live.total - startingCash) / startingCash) * 100;
  const topHolding = [...holdings]
    .map((holding) => ({
      symbol: holding.symbol,
      value: Number(holding.shares) * Number(quotes?.[holding.symbol]?.price ?? holding.avg_cost),
    }))
    .sort((a, b) => b.value - a.value)[0] ?? null;

  if (seasonLoading || portfolioLoading) {
    return <WidgetSkeleton variants={variants} icon={LineChart} label="Portfolio Wars" />;
  }

  const hasPortfolio = !!season && !!pf?.portfolio;
  const positive = returnPct >= 0;
  return (
    <WidgetFrame
      variants={variants}
      icon={LineChart}
      label="Portfolio Wars"
      title={hasPortfolio ? money(live.total) : 'Build your book'}
      subtitle={hasPortfolio && season ? `${seasonLabel(season.year, season.quarter)} portfolio` : 'Open the trading desk'}
      to="/portfolio-wars"
      cta={market.isOpen ? 'Trade now' : 'Queue order'}
      tone={market.isOpen ? 'live' : 'quiet'}
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Season" value={hasPortfolio ? pct(returnPct) : '$50K base'} positive={hasPortfolio ? positive : undefined} />
        <Metric label={market.label} value={market.isOpen ? formatCountdown(market.msUntilChange) : market.changeLabel} />
      </div>
      <p className="min-h-5 truncate text-[11px] font-medium text-muted-foreground">
        {topHolding ? `Largest position: ${topHolding.symbol}` : hasPortfolio ? `${money(live.cash)} cash ready` : 'Start with a clean $50,000 portfolio'}
      </p>
    </WidgetFrame>
  );
}

function PickemWidget({ variants }: { variants: Variants }) {
  const { season, loading: seasonLoading } = useActiveSeason();
  const { week, loading: weekLoading } = useCurrentWeek(season);
  const { games } = useWeekGames(week?.id);
  const { picks } = useMyWeekPicks(week?.id);
  const pickedGameIds = useMemo(() => new Set(picks.map((pick) => pick.game_id)), [picks]);
  const openGames = games.filter((game) => pickemGameIsOpen(game));
  const liveGames = games.filter((game) => game.status === 'live').length;
  const finalGames = games.filter((game) => game.status === 'final').length;
  const pickedCount = games.filter((game) => pickedGameIds.has(game.id)).length;
  const nextKick = games
    .filter((game) => game.status === 'scheduled' && Number.isFinite(Date.parse(game.kickoff_at)) && Date.parse(game.kickoff_at) > Date.now())
    .sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))[0];
  const link = week ? `/pickem/week/${week.week_number}` : '/pickem';
  const loading = seasonLoading || weekLoading;

  if (loading) return <WidgetSkeleton variants={variants} icon={Trophy} label="NFL Pick’em" />;

  const title = liveGames > 0
    ? `${liveGames} live now`
    : games.length > 0
      ? `${pickedCount}/${games.length} picks in`
      : 'Picks waiting';
  const subtitle = week ? `${season?.name ?? 'Season'} · ${week.label}` : 'Open the Game Center';
  const nextLabel = nextKick ? shortDateTime(nextKick.kickoff_at) : finalGames > 0 ? `${finalGames} final` : 'Schedule ready';

  return (
    <WidgetFrame variants={variants} icon={Trophy} label="NFL Pick’em" title={title} subtitle={subtitle} to={link} cta="Make picks" tone={openGames.length > 0 ? 'live' : 'quiet'}>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Open games" value={String(openGames.length)} />
        <Metric label="Next kickoff" value={nextLabel} />
      </div>
      <ProgressLine value={games.length ? pickedCount / games.length : 0} label="Week card" />
    </WidgetFrame>
  );
}

function DraftWidget({
  variants,
  userId,
  drafts,
  season,
  seasonTarget,
  seasonCompleted,
  standings,
}: {
  variants: Variants;
  userId?: string;
  drafts: DraftWidgetRow[];
  season: DraftSeason | null;
  seasonTarget: number;
  seasonCompleted: number;
  standings: SeasonStanding[];
}) {
  const active = drafts.filter((draft) => draft.status === 'in_progress');
  const setup = drafts.filter((draft) => draft.status === 'setup');
  const myTurn = userId ? active.filter((draft) => draft.current_pick_user_id === userId) : [];
  const targetDraft = myTurn[0] ?? active[0] ?? setup[0] ?? null;
  const myStanding = userId ? standings.find((row) => row.user_id === userId) : undefined;
  const leader = standings[0];
  const progress = seasonTarget > 0 ? seasonCompleted / seasonTarget : 0;
  const title = myTurn.length > 0
    ? 'You’re on the clock'
    : active.length > 0
      ? `${active.length} draft${active.length === 1 ? '' : 's'} in progress`
      : seasonTarget > 0
        ? `${seasonCompleted}/${seasonTarget} complete`
        : 'Draft board ready';
  const subtitle = season ? formatSeasonTitle(season) : 'Start or join a room';

  return (
    <WidgetFrame
      variants={variants}
      icon={Bookmark}
      label="Draft Arena"
      title={title}
      subtitle={subtitle}
      to={targetDraft ? `/drafts/${encodeURIComponent(targetDraft.id)}` : '/drafts'}
      cta={myTurn.length > 0 ? 'Make selection' : 'Open drafts'}
      tone={myTurn.length > 0 ? 'live' : 'quiet'}
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Your rank" value={myStanding?.rank ? `#${myStanding.rank}` : '—'} />
        <Metric label="Leader" value={leader?.profiles?.display_name ?? '—'} />
      </div>
      <ProgressLine value={progress} label="Season pace" />
    </WidgetFrame>
  );
}

function ForgeWidget({ variants, clubId, userId }: { variants: Variants; clubId?: string; userId?: string }) {
  const arena = useWorkoutArena(clubId, userId);
  const log = useWorkoutLog(clubId, userId);
  const myGauntletActivities = userId ? arena.weekActivities.filter((activity) => activity.user_id === userId) : [];
  const gauntletScore = userWeekScore(arena.weekExercises, myGauntletActivities);
  const leaderboard = buildLeaderboard(arena.weekExercises, arena.weekActivities, userId ? [userId] : []);
  const clubGauntletFuel = leaderboard.reduce((total, row) => total + row.score, 0);
  const myTotalFuel = gauntletScore + log.myWeekPoints;
  const clubTotalFuel = clubGauntletFuel + log.clubWeekPoints;
  const activeMembers = new Set<string>();
  arena.weekActivities.forEach((activity) => {
    if (activity.status === 'active') activeMembers.add(activity.user_id);
  });
  Object.entries(log.clubWeekByMember).forEach(([memberId, entry]) => {
    if (entry.points > 0) activeMembers.add(memberId);
  });
  const myRank = userId ? leaderboard.find((row) => row.userId === userId)?.rank : undefined;
  const target = Math.max(800, Math.max(1, arena.members.length) * 250);
  const progress = Math.min(1, clubTotalFuel / target);
  const isLoading = arena.loading || log.loading;

  if (isLoading) return <WidgetSkeleton variants={variants} icon={Flame} label="FORGE" />;

  return (
    <WidgetFrame
      variants={variants}
      icon={Flame}
      label="FORGE"
      title={log.activeSession ? 'Workout in progress' : `${myTotalFuel} fuel this week`}
      subtitle={arena.week?.title ?? 'Daily training is open'}
      to={log.activeSession ? '/workouts/log' : '/workouts'}
      cta={log.activeSession ? 'Resume log' : 'Log workout'}
      tone="live"
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Club fuel" value={String(clubTotalFuel)} />
        <Metric label="Your rank" value={myRank ? `#${myRank}` : activeMembers.size > 0 ? '—' : 'New'} />
      </div>
      <ProgressLine value={progress} label={`${activeMembers.size} active member${activeMembers.size === 1 ? '' : 's'}`} />
    </WidgetFrame>
  );
}

function WidgetFrame({
  variants,
  icon: Icon,
  label,
  title,
  subtitle,
  to,
  cta,
  tone = 'quiet',
  children,
}: {
  variants: Variants;
  icon: LucideIcon;
  label: string;
  title: string;
  subtitle: string;
  to: string;
  cta: string;
  tone?: 'live' | 'quiet';
  children: ReactNode;
}) {
  return (
    <motion.article variants={variants} className={cn('home-widget-card group min-w-0 rounded-2xl border border-border/45 bg-card p-4 shadow-[var(--shadow-card)]', tone === 'live' && 'home-widget-card-live')}>
      <div className="flex items-start gap-3">
        <span className="home-widget-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <h3 className="mt-1 break-words text-[20px] font-semibold leading-tight tracking-[-0.035em]">{title}</h3>
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{subtitle}</p>
        </div>
        {tone === 'live' && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary pulse" aria-hidden />}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
      <Link to={to} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-transform group-active:scale-[0.99]">
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.article>
  );
}

function WidgetSkeleton({ variants, icon: Icon, label }: { variants: Variants; icon: LucideIcon; label: string }) {
  return (
    <motion.article variants={variants} className="min-h-[226px] rounded-2xl border border-border/45 bg-card p-4 shadow-[var(--shadow-card)]" aria-label={`${label} loading`} aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 rounded skeleton-shimmer" />
          <div className="h-6 w-36 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2"><div className="h-16 rounded-xl skeleton-shimmer" /><div className="h-16 rounded-xl skeleton-shimmer" /></div>
      <div className="mt-4 h-11 rounded-xl skeleton-shimmer" />
    </motion.article>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-border/35 bg-muted/30 px-3 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate text-sm font-semibold tabular-nums', positive === true && 'text-success', positive === false && 'text-destructive')}>{value}</p>
    </div>
  );
}

function ProgressLine({ value, label }: { value: number; label: string }) {
  const pctValue = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
        <span className="truncate">{label}</span><span className="tabular-nums">{pctValue}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: '0%' }}
          animate={{ width: pctValue }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function buildLauncherItems(enabledAssets: InstalledAsset[]): Array<{ path: string; label: string; icon: LucideIcon }> {
  const navItems = APP_NAV_SECTIONS.flatMap((section) => section.items);
  const seen = new Set<string>();
  const rows: Array<{ path: string; label: string; icon: LucideIcon }> = [];
  for (const install of enabledAssets) {
    const slug = install.asset.slug;
    if (SPECIAL_WIDGETS.has(slug) || seen.has(slug)) continue;
    const nav = navItems.find((navItem) => NAV_ASSET_SLUGS[navItem.path] === slug);
    if (!nav) continue;
    seen.add(slug);
    rows.push({ path: nav.path, label: nav.shortLabel ?? nav.label, icon: nav.icon });
  }
  return rows.slice(0, 8);
}

function shortDateTime(iso: string): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return '—';
  return at.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
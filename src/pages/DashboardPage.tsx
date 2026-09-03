/* eslint-disable @typescript-eslint/no-explicit-any */
// DH Club Home — Orchestrator (v2 — premium redesign)
//
// Composes the new three-tier home surface system:
//   1. HomeHero        — ambient identity strip (no card)
//   2. HeroAction      — single cinematic next-action (or empty hero)
//   3. TodayFeed       — consolidated flowing list of what's happening
//   4. AppDock         — refined app launcher with full labels + status dots
//   5. FeaturedModule  — one richer spotlight (league or active campaign)
//   6. Ambient strips  — members online + discover (admin)
//
// Older box-stacked widgets (RightNowCard, QuickBar, AssetLauncher,
// EventsStrip, ClubPulse, Celebrations card, LeagueSnapshot, Highlights,
// NarrativeHomeWidget) are intentionally absorbed by the new primitives.
// Their data sources are still queried; the rendering moved.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, X, Bookmark, CalendarDays, ScrollText, Cake,
  Newspaper, MessageCircle, BarChart3, PartyPopper, Trophy,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  useCurrentSeason, useSeasonStandings, useSeasonEntries, getSeasonDraftTarget,
} from '@/hooks/useDraftSeasons';
import { useActivityFeedUpdates, useDraftListUpdates } from '@/hooks/useRealtimeSubscription';
import { useNarrativeCampaigns } from '@/hooks/useNarrativeCampaigns';
import { useUpcomingCelebrations, useTodayCelebrations, useCelebrationSettings } from '@/hooks/useCelebrations';
import { useUnreadChannels } from '@/hooks/useUnreadChannels';

import { HomeHero } from '@/components/home/HomeHero';
import { HeroAction } from '@/components/home/HeroAction';
import { TodayFeed, type TodayFeedItem, formatWhenSoon, formatRelative } from '@/components/home/TodayFeed';
import { QuickBar } from '@/components/home/QuickBar';
import { QuickBarSheet } from '@/components/home/QuickBarSheet';
import { useQuickBar } from '@/components/home/useQuickBar';
import { FeaturedModule } from '@/components/home/FeaturedModule';
import { MembersOnline } from '@/components/home/MembersOnline';
import { DiscoverStrip } from '@/components/home/DiscoverStrip';
import { EmptyClubState } from '@/components/home/EmptyClubState';

import { HomeDashboard } from '@/components/home/dashboard/HomeDashboard';
import { DashboardErrorBoundary } from '@/components/home/dashboard/DashboardErrorBoundary';

import { ClubOnboardingFlow } from '@/components/onboarding/ClubOnboardingFlow';
import { WhatIsNewCard } from '@/components/onboarding/WhatIsNewCard';
import { useClubOnboarding, useNewFeatures } from '@/hooks/useOnboarding';
import { rankNextActions } from '@/lib/home/nextAction';
import { getDerivedDraftTurn } from '@/lib/draftTurn';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { HYDRATE_TIMEOUT_MS, QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

const NEXUS_SAVE_PREFIX = 'nexus_run_state_v1';
const PWA_DISMISS_KEY = 'dh_pwa_install_dismissed_v1';

function readPwaDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(PWA_DISMISS_KEY) === '1'; } catch { return false; }
}

function findEndlessSavedRun(userId: string | undefined): { missionName: string; waveLabel: string } | null {
  if (!userId || typeof window === 'undefined') return null;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k?.startsWith(`${NEXUS_SAVE_PREFIX}:${userId}:`)) continue;
    try {
      const raw = window.localStorage.getItem(k);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed?.state || parsed.state.status === 'victory' || parsed.state.status === 'defeat') continue;
      const isEndless = parsed.missionId === ENDLESS_MISSION_ID;
      return {
        missionName: isEndless ? 'Endless Defense' : `Mission ${parsed.missionId}`,
        waveLabel: `Wave ${(parsed.state.waveIndex ?? 0) + 1}`,
      };
    } catch { /* ignore */ }
  }
  return null;
}

interface DraftRow { id: string; topic: string; status: string; current_pick_user_id: string | null }
interface ActivityRow {
  id: string; event_type: string; created_at: string;
  target_type?: string | null; target_id?: string | null;
  profiles?: { display_name?: string } | null;
}
interface EventRow { id: string; title: string; starts_at: string }

const ACCENT_HSL_LOOKUP: Record<string, string> = {
  gold:        'var(--gold)',
  primary:     'var(--primary)',
  destructive: 'var(--destructive)',
  success:     'var(--success)',
  lore:        'var(--lore, 270 70% 65%)',
  accent:      'var(--accent-foreground, 195 80% 65%)',
  warning:     'var(--warning, 38 95% 60%)',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { installedAssets, allAssets, loading: assetsLoading, isInstalled } = useClubAssets();
  const { canInstall, install: doInstall } = usePwaInstall();

  const { season } = useCurrentSeason();
  const { standings } = useSeasonStandings(season?.id);
  const { entries: seasonEntries } = useSeasonEntries(season?.id);
  const { campaigns: narrativeCampaigns } = useNarrativeCampaigns();
  const { today: todayCelebrations } = useTodayCelebrations();
  const { upcoming: upcomingCelebrations } = useUpcomingCelebrations(4);
  const { settings: celebrationSettings } = useCelebrationSettings();
  // Powers the "New chat to view in #X" Home surface. Hook handles
  // its own polling + filters out muted channels; we just forward
  // the list into rankNextActions below.
  const { unreadChannels } = useUnreadChannels();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [pwaDismissed, setPwaDismissed] = useState(readPwaDismissed);
  const [loading, setLoading] = useState(true);
  const [qbSheetOpen, setQbSheetOpen] = useState(false);

  const dismissPwa = useCallback(() => {
    setPwaDismissed(true);
    try { window.localStorage.setItem(PWA_DISMISS_KEY, '1'); } catch { /* private mode */ }
  }, []);

  const hasFeed = isInstalled('feed');
  const hasEvents = isInstalled('events');
  const hasDrafts = isInstalled('draft-arena');
  const hasCelebrations = isInstalled('birthdays-milestones');
  const showCelebrationsOnHome = hasCelebrations && (celebrationSettings?.show_on_home !== false);

  const enabledAssets = useMemo(
    () => installedAssets.filter(ia => ia.enabled),
    [installedAssets],
  );

  const qb = useQuickBar(enabledAssets);

  const onboarding = useClubOnboarding();
  const newFeatures = useNewFeatures();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const profilePromise = supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    const draftsPromise = hasDrafts
      ? supabase
          .from('drafts')
          .select('id, topic, status, current_pick_user_id, num_rounds, current_pick_number, current_round')
          .in('status', ['in_progress', 'setup'])
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as any[], error: null });

    const activityPromise = hasFeed
      ? supabase
          .from('activity_feed')
          .select('id, event_type, created_at, target_type, target_id, profiles:actor_user_id(display_name)')
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as ActivityRow[], error: null });

    const eventsPromise = hasEvents
      ? supabase
          .from('events')
          .select('id, title, starts_at')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(4)
      : Promise.resolve({ data: [] as EventRow[], error: null });

    try {
      const [profileRes, draftsRes, activityRes, eventsRes] = await withTimeout(
        Promise.all([
          withTimeout(profilePromise, QUERY_TIMEOUT_MS, 'home profile'),
          withTimeout(draftsPromise, QUERY_TIMEOUT_MS, 'home drafts'),
          withTimeout(activityPromise, QUERY_TIMEOUT_MS, 'home activity'),
          withTimeout(eventsPromise, QUERY_TIMEOUT_MS, 'home events'),
        ]),
        HYDRATE_TIMEOUT_MS,
        'home hydrate',
      );

      if ('data' in profileRes && profileRes.data) {
        setDisplayName(profileRes.data.display_name ?? '');
        setAvatarUrl(profileRes.data.avatar_url ?? null);
      }

    // Derive the true current picker for in-progress drafts (DB column can be
    // stale if a pick insert succeeded but the drafts row update was missed).
      const rawDrafts = ((draftsRes as any).data as any[]) ?? [];
      const inProgressIds = rawDrafts.filter(d => d.status === 'in_progress').map(d => d.id);
      let derivedDrafts: DraftRow[] = rawDrafts;
      if (inProgressIds.length > 0) {
        const [partsRes, picksRes] = await withTimeout(
          Promise.all([
            withTimeout(
              supabase.from('draft_participants').select('draft_id, user_id, pick_order').in('draft_id', inProgressIds),
              QUERY_TIMEOUT_MS,
              'home draft participants',
            ),
            withTimeout(
              supabase.from('draft_picks').select('draft_id').in('draft_id', inProgressIds),
              QUERY_TIMEOUT_MS,
              'home draft picks',
            ),
          ]),
          HYDRATE_TIMEOUT_MS,
          'home draft turn hydrate',
        );
        const partsByDraft = new Map<string, any[]>();
        (partsRes.data ?? []).forEach((p: any) => {
          const arr = partsByDraft.get(p.draft_id) ?? [];
          arr.push(p); partsByDraft.set(p.draft_id, arr);
        });
        const pickCounts = new Map<string, number>();
        (picksRes.data ?? []).forEach((p: any) => pickCounts.set(p.draft_id, (pickCounts.get(p.draft_id) ?? 0) + 1));
        derivedDrafts = rawDrafts.map(d => {
          if (d.status !== 'in_progress') return d;
          const derived = getDerivedDraftTurn(d, partsByDraft.get(d.id) ?? [], pickCounts.get(d.id) ?? 0);
          return { ...d, current_pick_user_id: derived.current_pick_user_id };
        });
      }
      setDrafts(derivedDrafts);
      setActivity(((activityRes as any).data as ActivityRow[]) ?? []);
      setEvents(((eventsRes as any).data as EventRow[]) ?? []);
    } catch (error) {
      console.error('[DashboardPage] refresh failed', error);
    } finally {
      setLoading(false);
    }
  }, [user, hasDrafts, hasFeed, hasEvents]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useActivityFeedUpdates(() => {
    if (!user || !hasFeed) return;
    supabase
      .from('activity_feed')
      .select('id, event_type, created_at, target_type, target_id, profiles:actor_user_id(display_name)')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setActivity(data as ActivityRow[]); });
  });
  useDraftListUpdates(fetchData, !!user);

  const installedSlugs = useMemo(
    () => new Set(enabledAssets.map(ia => ia.asset.slug)),
    [enabledAssets],
  );

  const draftsRemaining = useMemo(() => {
    if (!season) return 0;
    const target = getSeasonDraftTarget(season);
    const completed = seasonEntries.filter(e => !e.is_playoff).length;
    return Math.max(0, target - completed);
  }, [season, seasonEntries]);

  const endlessSavedRun = useMemo(
    () => installedSlugs.has('nexus-defense') ? findEndlessSavedRun(user?.id) : null,
    [user?.id, installedSlugs],
  );

  const actions = useMemo(() => rankNextActions({
    userId: user?.id,
    installedSlugs,
    drafts,
    season: season ?? null,
    draftsRemaining,
    isClubAdmin,
    endlessSavedRun,
    unreadChannels,
  }), [user?.id, installedSlugs, drafts, season, draftsRemaining, isClubAdmin, endlessSavedRun, unreadChannels]);

  // ─── Build TodayFeed items from multiple sources ─────────────────
  const todayItems = useMemo<TodayFeedItem[]>(() => {
    const items: TodayFeedItem[] = [];

    // 1. Secondary next-actions (skip the top one — it's the Hero)
    for (const a of actions.slice(1, 5)) {
      const tintToken = ACCENT_HSL_LOOKUP[a.accent] ?? 'var(--primary)';
      // Resolve token to a usable hsl tuple — fall back to a sensible literal.
      const tintLiteral =
        a.accent === 'gold'        ? '45 95% 55%' :
        a.accent === 'destructive' ? '0 72% 55%' :
        a.accent === 'success'     ? '152 60% 48%' :
        a.accent === 'lore'        ? '270 70% 65%' :
        a.accent === 'accent'      ? '195 80% 65%' :
        a.accent === 'warning'     ? '38 95% 60%' :
                                     '152 72% 46%';
      items.push({
        id: `action-${a.id}`,
        icon: a.icon,
        tint: tintLiteral,
        title: a.label,
        sub: a.sub,
        to: a.to,
        meta: a.tag,
      });
    }

    // 2. Today's celebrations
    if (showCelebrationsOnHome) {
      for (const c of todayCelebrations) {
        items.push({
          id: `cel-today-${c.kind}-${c.id}`,
          icon: PartyPopper,
          tint: '14 90% 60%',
          title: c.kind === 'birthday' ? `${c.title}'s birthday` : c.title,
          sub: c.kind === 'birthday' ? 'Wish them happy birthday' : (c.subline ?? undefined),
          to: '/celebrations',
          meta: 'Today',
        });
      }
      for (const c of upcomingCelebrations.filter(u => u.daysAway > 0 && u.daysAway <= 7).slice(0, 2)) {
        items.push({
          id: `cel-up-${c.kind}-${c.id}`,
          icon: Cake,
          tint: '14 90% 60%',
          title: c.title,
          sub: c.kind === 'birthday' ? 'Birthday' : 'Milestone',
          to: '/celebrations',
          meta: c.daysAway === 1 ? 'Tomorrow' : `${c.daysAway}d`,
        });
      }
    }

    // 3. Active narrative campaigns the user is in
    for (const c of narrativeCampaigns.filter(c => c.status === 'active').slice(0, 2)) {
      items.push({
        id: `camp-${c.id}`,
        icon: ScrollText,
        tint: '270 70% 65%',
        title: c.title,
        sub: c.pitch ?? 'Campaign in progress',
        to: `/narrative/${c.id}`,
        live: true,
      });
    }

    // 4. Upcoming events
    for (const ev of events.slice(0, 3)) {
      items.push({
        id: `evt-${ev.id}`,
        icon: CalendarDays,
        tint: '38 100% 60%',
        title: ev.title,
        sub: 'Event',
        to: `/events/${ev.id}`,
        meta: formatWhenSoon(ev.starts_at),
      });
    }

    // 5. High-signal recent activity (cap so the feed doesn't sprawl)
    const HIGH_SIGNAL: Record<string, { verb: string; icon: any; tint: string; route?: (id?: string|null) => string }> = {
      draft_completed:   { verb: 'completed a draft',     icon: Bookmark,     tint: '45 95% 55%',   route: id => `/drafts/${id}` },
      draft_created:     { verb: 'created a draft',       icon: Bookmark,     tint: '45 95% 55%',   route: id => `/drafts/${id}` },
      bracket_submitted: { verb: 'locked in a bracket',   icon: Trophy,       tint: '210 80% 60%',  route: id => `/pools/${id}` },
      event_created:     { verb: 'added an event',        icon: CalendarDays, tint: '38 100% 60%',  route: id => `/events/${id}` },
      post_created:      { verb: 'started a discussion',  icon: Newspaper,    tint: '195 80% 65%',  route: id => `/posts/${id}` },
      ranking_created:   { verb: 'opened a ranking',      icon: BarChart3,    tint: '195 80% 60%',  route: id => `/rankings/${id}` },
      poll_created:      { verb: 'opened a poll',         icon: MessageCircle, tint: '38 95% 60%',  route: id => `/polls/${id}` },
    };
    let activityAdded = 0;
    for (const a of activity) {
      const m = HIGH_SIGNAL[a.event_type];
      if (!m) continue;
      items.push({
        id: `act-${a.id}`,
        icon: m.icon,
        tint: m.tint,
        title: `${a.profiles?.display_name ?? 'Someone'} ${m.verb}`,
        to: m.route ? m.route(a.target_id) : '/feed',
        meta: formatRelative(a.created_at),
        at: a.created_at,
      });
      if (++activityAdded >= 2) break;
    }

    return items;
  }, [actions, todayCelebrations, upcomingCelebrations, showCelebrationsOnHome, narrativeCampaigns, events, activity]);

  const installedSlugsSet = installedSlugs;
  const gameClassSlugs = ['draft-arena', 'rune-delve', 'nexus-defense', 'nfl-pickem', 'portfolio-wars', 'lockbox', 'brackets'];
  const hasAnyGameInstalled = gameClassSlugs.some(s => installedSlugsSet.has(s));
  const isFreshClub = !loading && !assetsLoading && !hasAnyGameInstalled && !season && events.length === 0 && activity.length === 0;

  const accent = club?.accent_color ?? '152 72% 46%';
  const seasonTarget = season ? getSeasonDraftTarget(season) : 0;
  const regularEntries = seasonEntries.filter(e => !e.is_playoff).length;
  const firstName = displayName?.split(' ')[0];

  // Quick Access live-status feeders for the new desktop layout.
  // MUST live above the loading early-return so hook order stays
  // stable across renders (Rules of Hooks).
  const activeDraftStatus = useMemo(() => {
    const inProgress = drafts.filter(d => d.status === 'in_progress');
    if (inProgress.length === 0) return null;
    return inProgress.length === 1 ? '1 active draft' : `${inProgress.length} active drafts`;
  }, [drafts]);
  const narrativeActiveCount = useMemo(
    () => narrativeCampaigns.filter(c => c.status === 'active').length,
    [narrativeCampaigns],
  );

  // ─── Loading skeleton ────────────────────────────────────────────
  if (loading || assetsLoading) {
    return (
      <div className="pb-6">
        <div className="flex items-center gap-3 mb-4 pt-2">
          <div className="w-11 h-11 rounded-2xl skeleton-shimmer" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-32 rounded skeleton-shimmer" />
            <div className="h-3.5 w-40 rounded skeleton-shimmer" />
          </div>
          <div className="w-11 h-11 rounded-2xl skeleton-shimmer" />
        </div>
        <div className="h-28 rounded-[22px] skeleton-shimmer mb-5" />
        <div className="h-3 w-20 rounded skeleton-shimmer mb-3" />
        <div className="h-40 rounded-2xl skeleton-shimmer mb-6" />
        <div className="flex gap-2.5 mb-5 overflow-hidden">
          {[1,2,3,4,5].map(i => <div key={i} className="w-[96px] h-[112px] rounded-2xl skeleton-shimmer flex-shrink-0" />)}
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="overflow-x-hidden">
      {/* ─── Desktop "command center" home (lg+) ────────────────────── */}
      <div className="hidden lg:block">
        <DashboardErrorBoundary>
          <HomeDashboard
            club={club}
            displayName={displayName}
            avatarUrl={avatarUrl}
            installedSlugs={installedSlugs}
            pendingActions={actions}
            narrativeActiveCount={narrativeActiveCount}
            activeDraftStatus={activeDraftStatus}
            upcomingEventCount={events.length}
            season={hasDrafts ? (season ?? null) : null}
            seasonTarget={seasonTarget}
            seasonCompleted={regularEntries}
            standings={standings as any}
            activity={activity}
            events={events}
            loading={loading}
          />
        </DashboardErrorBoundary>

        {/* First-time club onboarding still wires under desktop too */}
        <ClubOnboardingFlow
          open={onboarding.needsFirstTime}
          club={club}
          displayName={displayName}
          installedAssets={enabledAssets}
          isAdmin={isClubAdmin}
          onComplete={onboarding.complete}
          onDismiss={onboarding.dismiss}
        />
      </div>

      {/* ─── Mobile / tablet — existing layout below lg ──────────────── */}
      <div className="lg:hidden">
      <HomeHero
        club={club}
        displayName={displayName}
        avatarUrl={avatarUrl}
        pendingCount={actions.length}
      />

      {/* "What's New" — surface unseen, newly-installed important features */}
      {newFeatures.newFeatures.length > 0 && (
        <WhatIsNewCard
          newFeatures={newFeatures.newFeatures}
          accent={accent}
          onFeatureCompleted={(key, ver) => newFeatures.setStatus(key, ver, 'completed')}
          onFeatureDismissed={(key, ver) => newFeatures.setStatus(key, ver, 'dismissed')}
          onFeatureRemindLater={(key, ver) => newFeatures.setStatus(key, ver, 'remind_later')}
          onDismissAll={newFeatures.dismissAll}
        />
      )}

      {/* PWA install hint — slim inline chip, only when applicable. */}
      <AnimatePresence>
        {canInstall && !pwaDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full mb-4 flex items-center gap-1 rounded-xl pr-1 text-[11px] font-bold"
            style={{
              background: `hsl(${accent} / 0.12)`,
              border: `1px solid hsl(${accent} / 0.28)`,
              color: `hsl(${accent})`,
            }}
          >
            <button
              type="button"
              onClick={doInstall}
              className="flex-1 flex items-center gap-2 text-left px-3 py-2 rounded-l-xl active:scale-[0.99] transition"
              aria-label="Install DH on your phone"
            >
              <Download className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
              <span className="flex-1 truncate">Install DH on your phone</span>
            </button>
            <button
              type="button"
              onClick={dismissPwa}
              aria-label="Dismiss install prompt"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-current opacity-65 hover:opacity-100 active:scale-90 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero — single cinematic primary action (or empty hero) */}
      <HeroAction
        action={actions[0] ?? null}
        clubAccent={accent}
        firstName={firstName}
      />

      {/* QuickBar — user-pinned shortcut dock. Full-width on every
          breakpoint: the dock is a horizontal strip of 56px tiles and
          doesn't tile well into a narrow sidebar. Lives ABOVE the lg
          desktop split so it stays one of the first things you see. */}
      {qb.pinned.length > 0 && (
        <QuickBar pinned={qb.pinned} accent={accent} onEditClick={() => setQbSheetOpen(true)} />
      )}
      <AnimatePresence>
        {qbSheetOpen && (
          <QuickBarSheet
            pinned={qb.pinned}
            available={qb.available}
            max={qb.max}
            accent={accent}
            onPin={qb.pin}
            onUnpin={qb.unpin}
            onMove={qb.move}
            onReset={qb.reset}
            onClose={() => setQbSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Desktop 2-column split ────────────────────────────────────
          On lg+ the rest of the home page becomes a [1fr | 320px] grid:
            LEFT  — primary stream (FeaturedModule)
            RIGHT — social/discover sidebar (MembersOnline, DiscoverStrip)
          On mobile/tablet this collapses to the original vertical stack
          (the wrapper is plain flex-column under lg, only `lg:grid`
          takes effect at the breakpoint).
          ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">
        {/* LEFT column — primary content */}
        <div className="min-w-0">
          {/* Today — consolidated flowing feed of what's happening */}
          <TodayFeed
            items={todayItems}
            title={club?.name ? `Today in ${club.name}` : 'Today'}
            sublabel={todayItems.length > 0 ? 'What\'s moving right now' : undefined}
          />

          {/* Featured — one richer block: league or active campaign */}
          <FeaturedModule
            season={hasDrafts ? season ?? null : null}
            standings={standings as any}
            regularEntries={regularEntries}
            seasonTarget={seasonTarget}
            userId={user?.id}
            campaigns={isInstalled('narrative-rpg') ? narrativeCampaigns as any : []}
          />

          {/* Fresh-club empty state lives in the primary column so its CTA
              is the main thing the user sees on a brand-new club. */}
          {isFreshClub && (
            <EmptyClubState isAdmin={isClubAdmin} accent={accent} clubName={club?.name} />
          )}
        </div>

        {/* RIGHT column — social / discover sidebar */}
        <div className="min-w-0 lg:sticky lg:top-3">
          {/* Members online — small presence strip (renders nothing if you're alone) */}
          <MembersOnline myDisplayName={displayName} myAvatarUrl={avatarUrl} accent={accent} />

          {/* Discover — admin-only un-installed assets */}
          <DiscoverStrip
            allAssets={allAssets}
            installedAssets={installedAssets}
            isAdmin={isClubAdmin}
            accent={accent}
          />
        </div>
      </div>

      {/* First-time club onboarding — full-screen, dismissible, runs once */}
      <ClubOnboardingFlow
        open={onboarding.needsFirstTime}
        club={club}
        displayName={displayName}
        installedAssets={enabledAssets}
        isAdmin={isClubAdmin}
        onComplete={onboarding.complete}
        onDismiss={onboarding.dismiss}
      />
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// One data owner; only the visible mobile or desktop home mounts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, ChevronDown } from 'lucide-react';
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

import { MobileHome } from '@/components/home/MobileHome';
import { buildHomeUpdates } from '@/lib/home/mobileHome';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { memberErrorMessage } from '@/lib/memberData';
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

export default function DashboardPage() {
  const { user } = useAuth();
  const { club } = useClub();
  return <DashboardHome key={(user?.id || '') + ':' + (club?.id || '')} />;
}

function DashboardHome() {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { installedAssets, allAssets, loading: assetsLoading, isInstalled, isVisible } = useClubAssets();
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
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const loadedOnce = useRef(false);

  const dismissPwa = useCallback(() => {
    setPwaDismissed(true);
    try { window.localStorage.setItem(PWA_DISMISS_KEY, '1'); } catch { /* private mode */ }
  }, []);

  const available = (slug: string) => isInstalled(slug) && (isClubAdmin || isVisible(slug));
  const hasFeed = available('feed');
  const hasEvents = available('events');
  const hasDrafts = available('draft-arena');
  const hasCelebrations = available('birthdays-milestones');
  const showCelebrationsOnHome = hasCelebrations && (celebrationSettings?.show_on_home !== false);

  const enabledAssets = useMemo(
    () => installedAssets.filter(ia => ia.enabled && (ia.visible_to_members || isClubAdmin)),
    [installedAssets, isClubAdmin],
  );

  const qb = useQuickBar(enabledAssets);

  const onboarding = useClubOnboarding();
  const newFeatures = useNewFeatures();

  const fetchData = useCallback(async () => {
    if (assetsLoading) return;
    if (!user || !club?.id) { setLoading(false); return; }
    const version = ++requestVersion.current;
    if (!loadedOnce.current) setLoading(true);
    setRefreshing(true);
    setLoadError(null);

    const profilePromise = supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    const draftsPromise = hasDrafts
      ? supabase
          .from('drafts')
          .select('id, topic, status, current_pick_user_id, num_rounds, current_pick_number, current_round')
          .eq('club_id', club.id)
          .in('status', ['in_progress', 'setup'])
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as any[], error: null });

    const activityPromise = hasFeed
      ? supabase
          .from('activity_feed')
          .select('id, event_type, created_at, target_type, target_id, profiles:actor_user_id(display_name)')
          .eq('club_id', club.id)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as ActivityRow[], error: null });

    const eventsPromise = hasEvents
      ? supabase
          .from('events')
          .select('id, title, starts_at')
          .eq('club_id', club.id)
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

      if (version !== requestVersion.current) return;
      for (const response of [profileRes,draftsRes,activityRes,eventsRes]) if (response.error) throw response.error;
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
        if (partsRes.error) throw partsRes.error;
        if (picksRes.error) throw picksRes.error;
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
      if (version !== requestVersion.current) return;
      setDrafts(derivedDrafts);
      setActivity(((activityRes as any).data as ActivityRow[]) ?? []);
      setEvents(((eventsRes as any).data as EventRow[]) ?? []);
    } catch (error) {
      if (version === requestVersion.current) setLoadError(memberErrorMessage(error));
    } finally {
      if (version === requestVersion.current) { setLoading(false); setRefreshing(false); loadedOnce.current = true; }
    }
  }, [user, club?.id, assetsLoading, hasDrafts, hasFeed, hasEvents]);

  useEffect(() => {
    const requests = requestVersion;
    void fetchData();
    return () => { requests.current++; };
  }, [fetchData]);
  useActivityFeedUpdates(() => { if (hasFeed) void fetchData(); });
  useDraftListUpdates(fetchData, !!user && hasDrafts);

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

  const updates = useMemo(() => buildHomeUpdates({
    installed:installedSlugs,activity,events,campaigns:narrativeCampaigns,drafts,
    today:todayCelebrations,upcoming:upcomingCelebrations,showCelebrations:showCelebrationsOnHome,
  }), [installedSlugs,activity,events,narrativeCampaigns,drafts,todayCelebrations,upcomingCelebrations,showCelebrationsOnHome]);

  const installedSlugsSet = installedSlugs;
  const gameClassSlugs = ['draft-arena', 'rune-delve', 'nexus-defense', 'nfl-pickem', 'portfolio-wars', 'lockbox', 'brackets'];
  const hasAnyGameInstalled = gameClassSlugs.some(s => installedSlugsSet.has(s));
  const isFreshClub = !loading && !assetsLoading && !hasAnyGameInstalled && !season && events.length === 0 && activity.length === 0;

  const accent = club?.accent_color ?? '152 72% 46%';
  const seasonTarget = season ? getSeasonDraftTarget(season) : 0;
  const regularEntries = seasonEntries.filter(e => !e.is_playoff).length;

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

  if (loading || assetsLoading) return <div className="member-page space-y-5" aria-label="Loading home" aria-busy="true">
    <div className="space-y-2 pt-2"><div className="h-3 w-32 rounded skeleton-shimmer" /><div className="h-8 w-52 rounded skeleton-shimmer" /></div>
    <div className="h-24 rounded-2xl skeleton-shimmer" /><div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(n=><div key={n} className="h-16 rounded-xl skeleton-shimmer" />)}</div>
    <div className="h-52 rounded-2xl skeleton-shimmer" /><button onClick={()=>void fetchData()} className="min-h-11 text-sm text-primary">Taking a while? Retry home</button>
  </div>;

  return <div className="member-page">
    {desktop ? <DashboardErrorBoundary>
      {loadError&&<p role="alert" className="mb-3 rounded-xl border border-border p-3 text-sm">{loadError}<button onClick={()=>void fetchData()} className="ml-3 min-h-11 text-primary">Retry</button></p>}
      <HomeDashboard club={club} displayName={displayName} avatarUrl={avatarUrl} installedSlugs={installedSlugs}
        pendingActions={actions} narrativeActiveCount={narrativeActiveCount} activeDraftStatus={activeDraftStatus}
        upcomingEventCount={events.length} season={hasDrafts?(season??null):null} seasonTarget={seasonTarget}
        seasonCompleted={regularEntries} standings={standings} activity={activity} events={events} loading={loading} />
    </DashboardErrorBoundary> : <MobileHome displayName={displayName} clubName={club?.name || 'your club'} installedSlugs={installedSlugs}
      actions={actions} updates={updates} shortcuts={qb} refreshing={refreshing} error={loadError} onRefresh={()=>void fetchData()}>
      {isFreshClub&&!loadError&&<EmptyClubState isAdmin={isClubAdmin} accent={accent} clubName={club?.name} />}
      {(hasDrafts&&season || installedSlugs.has('narrative-rpg')&&narrativeActiveCount>0)&&<details className="rounded-2xl border border-border/70 bg-card px-4">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-sm font-semibold">Your season & stories<ChevronDown className="h-4 w-4 text-muted-foreground" /></summary>
        <FeaturedModule season={hasDrafts?season??null:null} standings={standings} regularEntries={regularEntries}
          seasonTarget={seasonTarget} userId={user?.id} campaigns={installedSlugs.has('narrative-rpg')?narrativeCampaigns:[]} />
      </details>}
      {installedSlugs.has('chat')&&<MembersOnline myDisplayName={displayName} myAvatarUrl={avatarUrl} accent={accent} />}
      {newFeatures.newFeatures.length>0&&<details className="rounded-2xl border border-border/70 bg-card px-4">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-sm font-semibold">What’s new<ChevronDown className="h-4 w-4 text-muted-foreground" /></summary>
        <WhatIsNewCard newFeatures={newFeatures.newFeatures} accent={accent}
          onFeatureCompleted={(key,ver)=>newFeatures.setStatus(key,ver,'completed')}
          onFeatureDismissed={(key,ver)=>newFeatures.setStatus(key,ver,'dismissed')}
          onFeatureRemindLater={(key,ver)=>newFeatures.setStatus(key,ver,'remind_later')} onDismissAll={newFeatures.dismissAll} />
      </details>}
      {isClubAdmin&&<details className="rounded-2xl border border-border/70 bg-card px-4">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-sm font-semibold">Make this club yours<ChevronDown className="h-4 w-4 text-muted-foreground" /></summary>
        <DiscoverStrip allAssets={allAssets} installedAssets={installedAssets} isAdmin={isClubAdmin} accent={accent} />
      </details>}
      <AnimatePresence>{canInstall&&!pwaDismissed&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex items-center gap-1 rounded-xl border border-border px-2">
        <button type="button" onClick={doInstall} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left text-xs font-medium"><Download className="h-4 w-4 shrink-0" />Keep DH on your home screen</button>
        <button type="button" onClick={dismissPwa} aria-label="Dismiss install prompt" className="flex h-11 w-11 shrink-0 items-center justify-center"><X className="h-4 w-4" /></button>
      </motion.div>}</AnimatePresence>
    </MobileHome>}
    <ClubOnboardingFlow open={onboarding.needsFirstTime} club={club} displayName={displayName} installedAssets={enabledAssets}
      isAdmin={isClubAdmin} onComplete={onboarding.complete} onDismiss={onboarding.dismiss} />
  </div>;
}

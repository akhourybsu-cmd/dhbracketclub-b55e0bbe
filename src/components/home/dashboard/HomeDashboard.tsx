// DH Club Home — Desktop "command center" orchestrator
//
// Composes the new desktop home layout:
//
//   ┌─────────────────────────────────────┬────────────────┐
//   │ HomeHeader                                              │
//   ├─────────────────────────────────────┬────────────────┤
//   │ ClubPulseCard                       │ RightActivityRail
//   │ QuickAccessGrid                     │   - CrewActivity│
//   │ FeaturedSeasonCard (if active)      │   - ActiveNow   │
//   │ ActivityFeed                        │   - Upcoming    │
//   │                                     │   - ClubStats   │
//   └─────────────────────────────────────┴────────────────┘
//
// The rail collapses below the main column on < lg.
//
// This component is presentational: ALL data is passed in as props
// from `DashboardPage`, so we never double-query. Side-effect ownership
// stays with the page.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Bookmark, Trophy, CalendarDays, ScrollText, Newspaper, MessageCircle,
  BarChart3, Activity as ActivityIcon, FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Club } from '@/contexts/ClubContext';
import type { NextAction } from '@/lib/home/nextAction';

import { HomeHeader } from './HomeHeader';
import { ClubPulseCard } from './ClubPulseCard';
import { QuickAccessGrid } from './QuickAccessGrid';
import { FeaturedSeasonCard } from './FeaturedSeasonCard';
import { ActivityFeed, type FeedRow, FEED_EVENT_META } from './ActivityFeed';
import {
  RightActivityRail,
  type CrewActivityItem,
  type ActiveMember,
  type UpcomingItem,
  type ClubStats,
} from './RightActivityRail';

interface ActivityRow {
  id: string; event_type: string; created_at: string;
  target_type?: string | null; target_id?: string | null;
  profiles?: { display_name?: string } | null;
}
interface EventRow { id: string; title: string; starts_at: string }
interface SeasonShape { id: string; name?: string | null; season_number?: number | null }
interface StandingsEntry {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}
interface PresenceMeta {
  user_id?: unknown;
  display_name?: unknown;
  avatar_url?: unknown;
}

interface Props {
  club: Club | null;
  displayName: string;
  avatarUrl: string | null;
  installedSlugs: Set<string>;
  pendingActions: NextAction[];
  /** Drives the Pulse "Check Activity" anchor. */
  activityAnchorId?: string;

  // Quick Access status feeders
  activePollCount?: number;
  narrativeActiveCount?: number;
  lorePostsThisWeek?: number;
  activeDraftStatus?: string | null;
  upcomingEventCount?: number;

  // Featured season
  season: SeasonShape | null;
  seasonTarget: number;
  seasonCompleted: number;
  standings: StandingsEntry[];

  // Feed inputs
  activity: ActivityRow[];
  events: EventRow[];
  loading?: boolean;
}

const ACTIVITY_ANCHOR_DEFAULT = 'home-activity';

export function HomeDashboard({
  club, displayName, avatarUrl, installedSlugs, pendingActions,
  activityAnchorId = ACTIVITY_ANCHOR_DEFAULT,
  activePollCount, narrativeActiveCount, lorePostsThisWeek,
  activeDraftStatus, upcomingEventCount,
  season, seasonTarget, seasonCompleted, standings,
  activity, events, loading,
}: Props) {
  const accent = club?.accent_color ?? '152 72% 46%';
  const { user } = useAuth();

  /* ─── Online presence + club member count ───────────────────
     NOTE: MembersOnline (in the mobile/tablet branch) also opens a
     `online-presence:{club.id}` channel. Because both branches mount
     simultaneously (`lg:hidden` / `hidden lg:block` are CSS only),
     subscribing the same channel topic twice from one supabase client
     can wedge the realtime socket. We use a distinct topic suffix here
     to avoid colliding with MembersOnline. */
  const [online, setOnline] = useState<ActiveMember[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!user || !displayName || !club?.id) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`online-presence-rail:${club.id}`, {
        config: { presence: { key: user.id } },
      });
      channel
        .on('presence', { event: 'sync' }, () => {
          try {
            const state = channel!.presenceState();
            const flat = Object.values(state).flat().map((record) => {
              const p = record as PresenceMeta;
              return {
              id: typeof p.user_id === 'string' ? p.user_id : '',
              name: typeof p.display_name === 'string' ? p.display_name : 'Member',
              avatar_url: typeof p.avatar_url === 'string' ? p.avatar_url : null,
              online: true,
            }; }).filter(member => member.id);
            const seen = new Set<string>();
            setOnline(flat.filter(u => seen.has(u.id) ? false : (seen.add(u.id), true)));
          } catch { /* swallow */ }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try { await channel!.track({ user_id: user.id, display_name: displayName, avatar_url: avatarUrl }); }
            catch { /* swallow */ }
          }
        });
    } catch { /* swallow */ }
    return () => {
      if (!channel) return;
      try { supabase.removeChannel(channel); } catch { /* channel already closed */ }
    };
  }, [user, displayName, avatarUrl, club?.id]);

  useEffect(() => {
    if (!club?.id) return;
    let cancelled = false;
    const loadMemberCount = async () => {
      try {
        const { count } = await supabase
          .from('club_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('club_id', club.id);
        if (!cancelled) setMemberCount(count ?? 0);
      } catch {
        if (!cancelled) setMemberCount(0);
      }
    };
    void loadMemberCount();
    return () => { cancelled = true; };
  }, [club?.id]);

  /* ─── Build FeedRows from raw activity ──────────────────────── */
  const feedRows = useMemo<FeedRow[]>(() => {
    const rows: FeedRow[] = [];

    // Activity log
    for (const a of activity) {
      const meta = FEED_EVENT_META[a.event_type];
      if (!meta) continue;
      const actor = a.profiles?.display_name ?? 'Someone';
      const targetRoute =
        a.target_type === 'draft'    ? `/drafts/${a.target_id}` :
        a.target_type === 'poll'     ? `/polls/${a.target_id}` :
        a.target_type === 'ranking'  ? `/rankings/${a.target_id}` :
        a.target_type === 'event'    ? `/events/${a.target_id}` :
        a.target_type === 'post'     ? `/posts/${a.target_id}` :
                                       '/feed';
      rows.push({
        id: `act-${a.id}`,
        category: meta.category,
        icon: meta.icon,
        tint: meta.tint,
        text: `${actor} ${meta.verb}`,
        badgeLabel: meta.badge,
        at: a.created_at,
        actionLabel: meta.actionLabel,
        actionTo: targetRoute,
      });
    }

    // Upcoming events as social/event rows
    for (const ev of events.slice(0, 4)) {
      rows.push({
        id: `evt-${ev.id}`,
        category: 'events',
        icon: CalendarDays,
        tint: '38 100% 60%',
        text: ev.title,
        badgeLabel: 'Event',
        at: ev.starts_at,
        actionLabel: 'Open',
        actionTo: `/events/${ev.id}`,
      });
    }

    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return rows;
  }, [activity, events]);

  /* ─── Build CrewActivityItems for the rail ──────────────────── */
  const crewItems = useMemo<CrewActivityItem[]>(() => {
    return activity.slice(0, 5).map(a => {
      const meta = FEED_EVENT_META[a.event_type];
      const icon = meta?.icon ?? Newspaper;
      const tint = meta?.tint ?? '152 70% 55%';
      const actor = a.profiles?.display_name ?? 'Someone';
      const verb = meta?.verb ?? a.event_type.replace(/_/g, ' ');
      return { id: a.id, text: `${actor} ${verb}`, at: a.created_at, icon, tint };
    });
  }, [activity]);

  /* ─── Upcoming rail items ────────────────────────────────────── */
  const upcomingItems = useMemo<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = [];
    for (const ev of events.slice(0, 4)) {
      items.push({
        id: `up-evt-${ev.id}`,
        label: ev.title,
        at: ev.starts_at,
        kind: 'Event',
        tint: '38 100% 60%',
        to: `/events/${ev.id}`,
      });
    }
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return items;
  }, [events]);

  /* ─── Featured season inputs ─────────────────────────────────── */
  const seasonName = season
    ? (season.name ?? (season.season_number ? `Season ${season.season_number}` : 'Active Season'))
    : '';
  const safeStandings = Array.isArray(standings) ? standings : [];
  const participants = safeStandings
    .filter(s => !!s.avatar_url || !!s.display_name)
    .slice(0, 8)
    .map(s => ({
      user_id: s.user_id,
      display_name: s.display_name,
      avatar_url: s.avatar_url,
    }));

  const stats: ClubStats = {
    members: memberCount,
    activeNow: online.length,
    competitions:
      (installedSlugs.has('draft-arena') && season ? 1 : 0) +
      (installedSlugs.has('brackets') ? 1 : 0) +
      (installedSlugs.has('nfl-pickem') ? 1 : 0),
  };

  const showFeatured = installedSlugs.has('draft-arena') && !!season;

  /* ─── Render ────────────────────────────────────────────────── */
  return (
    <div
      className="home-dashboard text-foreground pb-8"
      style={{ '--home-accent': accent } as CSSProperties}
    >
      <HomeHeader
        club={club}
        displayName={displayName}
        avatarUrl={avatarUrl}
        installedSlugs={installedSlugs}
      />

      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_352px] lg:gap-5 xl:gap-6 lg:items-start mt-4">
        {/* LEFT — primary stream */}
        <div className="min-w-0">
          <ClubPulseCard
            club={club}
            actions={pendingActions}
            installedSlugs={installedSlugs}
            activityAnchorId={activityAnchorId}
          />


          <QuickAccessGrid
            installedSlugs={installedSlugs}
            status={{
              activePollCount,
              narrativeActiveCount,
              lorePostsThisWeek,
              activeDraftStatus,
              upcomingEventCount,
            }}
          />

          {showFeatured && (
            <FeaturedSeasonCard
              seasonName={seasonName}
              seasonId={season?.id}
              picksCompleted={seasonCompleted}
              picksTarget={seasonTarget}
              participants={participants}
              accent={accent}
            />
          )}

          <ActivityFeed rows={feedRows} loading={loading} anchorId={activityAnchorId} />
        </div>

        {/* RIGHT — activity rail */}
        <div className="min-w-0 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto lg:pr-0.5 scrollbar-none">
          <RightActivityRail
            accent={accent}
            crew={crewItems}
            members={online}
            upcoming={upcomingItems}
            stats={stats}
            loading={loading}
            currentUserId={user?.id ?? null}
          />
        </div>
      </div>
    </div>
  );
}

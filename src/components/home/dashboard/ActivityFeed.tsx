/* eslint-disable react-refresh/only-export-components */
// DH Club Home — Today in Dry Horse activity feed
//
// Central feed card with filter tabs (All / Games / Social / Events).
// Reuses the existing activity_feed rows + derives extra items from
// upcoming events + recent draft picks + lore posts so the feed
// reflects ALL active surfaces, not just the activity_feed write-log.
//
// Each row is small and consistent:
//   [avatar/icon] [text + meta] [timestamp] [contextual action]
//
// Empty state surfaces a clear "nothing today" line. Loading state
// shows shimmer skeletons of the same shape so layout doesn't jump.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Bookmark, MessageCircle, BarChart3, CalendarDays, Newspaper,
  ScrollText, Trophy, Sparkles, FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeedFilter = 'all' | 'games' | 'social' | 'events';

export interface FeedRow {
  id: string;
  /** Filter category — drives which tab shows this row. */
  category: 'games' | 'social' | 'events';
  /** Display icon. */
  icon: LucideIcon;
  /** HSL tint for the icon chip. */
  tint: string;
  /** Sentence-style content, plain text. */
  text: string;
  /** Module/category badge label (e.g. "Polls", "Draft Arena"). */
  badgeLabel: string;
  /** When this happened (ISO string). */
  at: string;
  /** Optional action button label + destination. */
  actionLabel?: string;
  actionTo?: string;
}

interface Props {
  rows: FeedRow[];
  /** Loading state from any underlying query that's still in flight. */
  loading?: boolean;
  /** Anchor id so the Club Pulse "Check Activity" chip can scroll here. */
  anchorId?: string;
}

const TABS: { key: FeedFilter; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'games',  label: 'Games' },
  { key: 'social', label: 'Social' },
  { key: 'events', label: 'Events' },
];

export function ActivityFeed({ rows, loading = false, anchorId = 'home-activity' }: Props) {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(r => r.category === filter);
  }, [rows, filter]);

  return (
    <section
      id={anchorId}
      className="home-dashboard-panel rounded-2xl mb-6 overflow-hidden"
      aria-label="Today in the club"
    >
      {/* Header */}
      <div className="px-4 lg:px-5 py-3 flex items-center justify-between gap-3 border-b border-border/25">
        <p className="text-[12px] font-extrabold tracking-tight">Today in the Club</p>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 bg-card/40 rounded-lg p-0.5 border border-border/30">
          {TABS.map(t => {
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={cn(
                  'px-2.5 h-7 rounded-md text-[10.5px] font-bold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45',
                  active
                    ? 'bg-foreground/12 text-foreground'
                    : 'text-muted-foreground/65 hover:text-foreground/80',
                )}
                aria-pressed={active}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="px-2 py-2 min-h-[140px] lg:min-h-[220px]">
        {loading && rows.length === 0 ? (
          <FeedSkeleton />
        ) : visible.length === 0 ? (
          <FeedEmpty filter={filter} />
        ) : (
          <AnimatePresence initial={false}>
            {visible.slice(0, 12).map((row, i) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
              >
                <FeedRowEl row={row} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer link to the full activity surface */}
      {!loading && visible.length > 0 && (
        <div className="px-4 lg:px-5 py-2.5 border-t border-border/25 text-center">
          <Link
            to="/feed"
            className="text-[11px] font-extrabold tracking-tight text-muted-foreground/75 hover:text-foreground transition-colors"
          >
            View all activity →
          </Link>
        </div>
      )}
    </section>
  );
}

function FeedRowEl({ row }: { row: FeedRow }) {
  const Icon = row.icon;
  const inner = (
    <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-muted/35 transition-colors group">
      {/* Icon chip */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(${row.tint} / 0.15), hsl(${row.tint} / 0.05))`,
          color: `hsl(${row.tint})`,
          border: `1px solid hsl(${row.tint} / 0.3)`,
        }}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Text + meta */}
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] leading-tight truncate">
          <span className="font-bold text-foreground">{row.text}</span>
        </p>
        <p className="text-[10px] text-muted-foreground/65 mt-0.5 leading-tight">
          {row.badgeLabel}
        </p>
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground/60 font-medium flex-shrink-0 tabular-nums">
        {formatDistanceToNow(new Date(row.at), { addSuffix: false })}
      </span>

      {/* Action button */}
      {row.actionLabel && row.actionTo && (
        <span
          className="hidden sm:inline-flex h-7 px-2.5 rounded-md text-[10.5px] font-extrabold border border-border/40 bg-card/60 group-hover:border-border/70 transition-colors flex-shrink-0"
          style={{ color: `hsl(${row.tint})` }}
        >
          {row.actionLabel}
        </span>
      )}
    </div>
  );

  if (row.actionTo) {
    return <Link to={row.actionTo} className="block">{inner}</Link>;
  }
  return inner;
}

function FeedSkeleton() {
  return (
    <div className="space-y-1.5 px-1 py-1">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-2.5 px-2.5 py-2.5">
          <div className="w-9 h-9 rounded-lg skeleton-shimmer flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded skeleton-shimmer" />
            <div className="h-2 w-1/3 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedEmpty({ filter }: { filter: FeedFilter }) {
  const label =
    filter === 'games'  ? 'No game activity yet today.' :
    filter === 'social' ? 'Nothing social happening yet.' :
    filter === 'events' ? 'No events on the schedule.' :
                          'Quiet day — nothing fresh yet.';
  return (
    <div className="py-10 text-center">
      <Sparkles className="w-5 h-5 mx-auto mb-2 text-muted-foreground/40" />
      <p className="text-[12px] font-bold text-foreground/70">{label}</p>
      <p className="text-[10.5px] text-muted-foreground/55 mt-1">
        Start something via the button above — it'll show up here.
      </p>
    </div>
  );
}

/* ─── Helpers for callers to build FeedRows from raw data ──────────── */

/** Icon + tint catalog for activity_feed event_type strings. Callers
 *  map their raw rows to FeedRows using this. Kept here so changes
 *  to the icon/tint vocabulary are one-file edits. */
export const FEED_EVENT_META: Record<string, { icon: LucideIcon; tint: string; category: FeedRow['category']; badge: string; verb: string; actionLabel: string }> = {
  draft_pick:        { icon: Bookmark,      tint: '45 95% 55%',  category: 'games',  badge: 'Draft Arena',  verb: 'made a pick in',      actionLabel: 'View' },
  draft_completed:   { icon: Bookmark,      tint: '45 95% 55%',  category: 'games',  badge: 'Draft Arena',  verb: 'completed a draft',   actionLabel: 'View' },
  draft_created:     { icon: Bookmark,      tint: '45 95% 55%',  category: 'games',  badge: 'Draft Arena',  verb: 'created a draft',     actionLabel: 'Open' },
  poll_created:      { icon: MessageCircle, tint: '38 95% 60%',  category: 'social', badge: 'Polls',        verb: 'opened a poll',       actionLabel: 'Vote' },
  poll_voted:        { icon: MessageCircle, tint: '38 95% 60%',  category: 'social', badge: 'Polls',        verb: 'voted on a poll',     actionLabel: 'View' },
  ranking_created:   { icon: BarChart3,     tint: '195 80% 65%', category: 'social', badge: 'Rankings',     verb: 'opened a ranking',    actionLabel: 'Vote' },
  ranking_submitted: { icon: BarChart3,     tint: '195 80% 65%', category: 'social', badge: 'Rankings',     verb: 'submitted a ranking', actionLabel: 'View' },
  post_created:      { icon: FileText,      tint: '195 80% 65%', category: 'social', badge: 'Posts',        verb: 'started a discussion', actionLabel: 'Read' },
  event_created:     { icon: CalendarDays,  tint: '38 100% 60%', category: 'events', badge: 'Events',       verb: 'added an event',      actionLabel: 'Open' },
  event_rsvp:        { icon: CalendarDays,  tint: '38 100% 60%', category: 'events', badge: 'Events',       verb: 'RSVPed to an event',  actionLabel: 'View' },
  lore_added:        { icon: ScrollText,    tint: '270 70% 65%', category: 'social', badge: 'Lore',         verb: 'added lore',          actionLabel: 'Read' },
  bracket_submitted: { icon: Trophy,        tint: '210 80% 60%', category: 'games',  badge: 'Brackets',     verb: 'locked in a bracket', actionLabel: 'View' },
  member_joined:     { icon: Newspaper,     tint: '152 70% 55%', category: 'social', badge: 'Crew',         verb: 'joined the crew',     actionLabel: 'View' },
};

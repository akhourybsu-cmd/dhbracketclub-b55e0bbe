// DH Club Home — Quick Access app launcher grid
//
// Six premium tiles in a row (1x6 on lg, 2x3 on sm, 1x6-scrolling
// on xs). Each tile is GATED on isInstalled — a tile only renders
// if its asset is installed for the club. If fewer than 6 apps are
// installed, the grid wraps naturally without empty cells.
//
// Each tile carries a live status line — driven from real data when
// available, falling back to safe placeholder copy when the
// underlying query is empty or in flight.

import { Link } from 'react-router-dom';
import {
  MessageCircle, Bookmark, BookOpen, ScrollText, CalendarDays, Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Surface } from '../primitives/Surface';

interface TileSpec {
  slug: string;
  label: string;
  icon: LucideIcon;
  /** HSL triple for the tile's accent tint. */
  tint: string;
  to: string;
  status: string;
}

interface Props {
  /** Asset slugs installed for the current club (gates rendering). */
  installedSlugs: Set<string>;
  /** Live status feeders. Pass real counts/data; component handles
   *  the formatting and graceful fallback when undefined. */
  status: {
    activePollCount?: number;
    runeDelveContinue?: string | null;
    narrativeActiveCount?: number;
    lorePostsThisWeek?: number;
    activeDraftStatus?: string | null;
    upcomingEventCount?: number;
  };
}

function build(status: Props['status']): TileSpec[] {
  return [
    {
      slug: 'polls',
      label: 'Polls',
      icon: MessageCircle,
      tint: '38 95% 60%',
      to: '/polls',
      status: status.activePollCount != null
        ? (status.activePollCount === 1 ? '1 active poll' : `${status.activePollCount} active polls`)
        : 'Open polls',
    },
    {
      slug: 'rune-delve',
      label: 'Rune Delve',
      icon: Sparkles,
      tint: '152 70% 55%',
      to: '/rune-delve',
      status: status.runeDelveContinue || 'Begin your descent',
    },
    {
      slug: 'narrative-rpg',
      label: 'Narrative RPG',
      icon: BookOpen,
      tint: '270 70% 65%',
      to: '/narrative',
      status: status.narrativeActiveCount != null
        ? (status.narrativeActiveCount === 0
            ? 'No active sessions'
            : status.narrativeActiveCount === 1
              ? '1 active session'
              : `${status.narrativeActiveCount} active sessions`)
        : 'Sessions',
    },
    {
      slug: 'lore',
      label: 'Lore',
      icon: ScrollText,
      tint: '270 70% 65%',
      to: '/lore',
      status: status.lorePostsThisWeek != null && status.lorePostsThisWeek > 0
        ? (status.lorePostsThisWeek === 1 ? '1 new entry' : `${status.lorePostsThisWeek} new entries`)
        : 'Browse archives',
    },
    {
      slug: 'draft-arena',
      label: 'Draft Arena',
      icon: Bookmark,
      tint: '45 95% 55%',
      to: '/drafts',
      status: status.activeDraftStatus || 'Make picks',
    },
    {
      slug: 'events',
      label: 'Events',
      icon: CalendarDays,
      tint: '38 100% 60%',
      to: '/events',
      status: status.upcomingEventCount != null && status.upcomingEventCount > 0
        ? (status.upcomingEventCount === 1 ? '1 upcoming' : `${status.upcomingEventCount} upcoming`)
        : 'Schedule',
    },
  ];
}

export function QuickAccessGrid({ installedSlugs, status }: Props) {
  const tiles = build(status).filter(t => installedSlugs.has(t.slug));
  if (tiles.length === 0) return null;

  return (
    <section className="mb-5" aria-label="Quick access">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/60 mb-2 px-1">
        Quick Access
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-6 gap-2.5">
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.div
              key={t.slug}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.04 * i }}
            >
              <Link
                to={t.to}
                aria-label={`${t.label} — ${t.status}`}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Surface variant="tile" accent={t.tint} className="transition duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-[var(--shadow-card)]">
                  <div className="p-3.5 flex flex-col gap-2 min-h-[104px] lg:min-h-[92px]">
                    <div className="flex items-center justify-between">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{
                          background: `hsl(${t.tint} / 0.16)`,
                          border: `1px solid hsl(${t.tint} / 0.32)`,
                          color: `hsl(${t.tint})`,
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="mt-auto">
                      <p className="text-[13px] font-extrabold tracking-tight leading-tight">{t.label}</p>
                      <p className="text-[10.5px] text-muted-foreground/80 leading-tight mt-0.5 line-clamp-1">
                        {t.status}
                      </p>
                    </div>
                  </div>
                </Surface>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

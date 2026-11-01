// DH Club Home — Discover strip (admin-only)
//
// Surfaces platform assets the club hasn't installed yet. Lets admins peek
// at what could be added without leaving Home. Renders nothing for members
// (they can't act on it) and nothing when every available asset is already
// installed.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bookmark, Sparkles, TrendingUp, Lock, Trophy, MessageSquareText,
  CalendarDays, ScrollText, Newspaper, MessageCircle, BarChart3,
  FileText, Link2, Plus, Gem,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlatformAsset, InstalledAsset } from '@/types/assets';
import { SectionHeader } from './SectionHeader';

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  'deep-claim':     Gem,
  'draft-arena':    Bookmark,
  'rune-delve':     Sparkles,
  'nexus-defense':  Sparkles,
  'nfl-pickem':     Trophy,
  'portfolio-wars': TrendingUp,
  'brackets':       Trophy,
  'lockbox':        Lock,
  'chat':           MessageSquareText,
  'events':         CalendarDays,
  'lore':           ScrollText,
  'feed':           Newspaper,
  'polls':          MessageCircle,
  'rankings':       BarChart3,
  'posts':          FileText,
  'shared-media':   Link2,
};

const TINT_BY_SLUG: Record<string, string> = {
  'deep-claim':     '37 55% 58%',
  'draft-arena':    '45 95% 55%',
  'rune-delve':     '152 70% 55%',
  'nexus-defense':  '195 90% 60%',
  'nfl-pickem':     '0 80% 60%',
  'portfolio-wars': '152 80% 55%',
  'brackets':       '210 80% 60%',
  'lockbox':        '0 80% 60%',
  'chat':           '195 80% 65%',
  'events':         '38 100% 60%',
  'lore':           '270 70% 65%',
  'feed':           '195 80% 65%',
  'polls':          '38 95% 60%',
  'rankings':       '195 80% 60%',
  'posts':          '195 80% 65%',
  'shared-media':   '195 80% 65%',
};

interface Props {
  allAssets: PlatformAsset[];
  installedAssets: InstalledAsset[];
  isAdmin: boolean;
  accent: string;
}

export function DiscoverStrip({ allAssets, installedAssets, isAdmin, accent }: Props) {
  if (!isAdmin) return null;
  const installedSlugs = new Set(installedAssets.map(ia => ia.asset.slug));
  const candidates = allAssets
    .filter(a => a.is_active && !installedSlugs.has(a.slug))
    .sort((a, b) => a.sort_order - b.sort_order);
  if (candidates.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="-mx-4 sm:mx-0 mb-5"
    >
      <SectionHeader
        label="Discover"
        icon={Plus}
        to="/club/assets"
        className="mb-2 px-4 sm:px-0"
      />
      <div
        className="flex gap-2 overflow-x-auto px-4 sm:px-0 pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {candidates.slice(0, 8).map(asset => {
          const Icon = ICON_BY_SLUG[asset.slug] ?? Bookmark;
          const tint = TINT_BY_SLUG[asset.slug] ?? accent;
          return (
            <Link
              key={asset.id}
              to="/club/assets"
              className="flex-shrink-0 w-[160px] active:scale-[0.99] transition-transform"
            >
              <div
                className="relative h-[88px] rounded-2xl p-2.5 flex items-start gap-2 overflow-hidden"
                style={{
                  background: `radial-gradient(ellipse 80% 100% at 100% 0%, hsl(${tint} / 0.14), transparent 70%), linear-gradient(180deg, hsl(var(--card) / 0.7), hsl(var(--card) / 0.5))`,
                  border: `1.5px dashed hsl(${tint} / 0.4)`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${tint} / 0.14), hsl(${tint} / 0.04))`,
                    border: `1px solid hsl(${tint} / 0.28)`,
                    color: `hsl(${tint})`,
                  }}
                >
                  <Icon className="w-4 h-4" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  {/* Label + description bumped from text-[8.5/9.5px]
                      to 10/10.5px so they stay readable on mobile.
                      Desktop also benefits — those sizes were below
                      the comfortable floor on every screen. */}
                  <p
                    className="text-[10px] font-extrabold uppercase tracking-[0.22em] truncate"
                    style={{ color: `hsl(${tint})` }}
                  >
                    + Install
                  </p>
                  <p className="text-[12px] font-extrabold tracking-tight leading-tight mt-0.5 truncate">
                    {asset.name}
                  </p>
                  {asset.short_description && (
                    <p className="text-[10.5px] text-muted-foreground/65 leading-tight line-clamp-2 mt-0.5">
                      {asset.short_description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </motion.section>
  );
}

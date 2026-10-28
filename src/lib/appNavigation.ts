import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Bookmark,
  Brackets as BracketsIcon,
  Cake,
  CalendarDays,
  Compass,
  FileText,
  Flame,
  LayoutDashboard,
  House,
  Link2,
  Lock,
  MessageCircle,
  MessageSquareText,
  Newspaper,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  User,
  Users,
} from 'lucide-react';

export type AppNavItem = {
  path: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
};

export type AppNavSection = {
  label: string;
  items: AppNavItem[];
};

/**
 * The canonical navigation model for the shared DH shell. Asset visibility is
 * still resolved by useClubAssets at render time; this file only owns labels,
 * routes, icons, ordering, and active-route behavior.
 */
export const APP_NAV_SECTIONS: AppNavSection[] = [
  {
    label: 'DH Club',
    items: [
      { path: '/dashboard', label: 'Home', icon: House },
      { path: '/chat', label: 'Chat', icon: MessageSquareText },
      { path: '/compete', label: 'Compete', icon: Swords },
      { path: '/club', label: 'Club', icon: Users },
    ],
  },
  {
    label: 'Club life',
    items: [
      { path: '/feed', label: 'Activity Feed', shortLabel: 'Feed', icon: Newspaper },
      { path: '/events', label: 'Events', icon: CalendarDays },
      { path: '/finds', label: 'The Drop', shortLabel: 'Drop', icon: Bookmark },
      { path: '/lore', label: 'Lore', icon: ScrollText },
      { path: '/celebrations', label: 'Celebrations', shortLabel: 'Bdays', icon: Cake },
      { path: '/polls', label: 'Polls', icon: MessageCircle },
      { path: '/rankings', label: 'Rankings', icon: BarChart3 },
      { path: '/posts', label: 'Posts', icon: FileText },
      { path: '/shared', label: 'Shared Media', shortLabel: 'Media', icon: Link2 },
    ],
  },
  {
    label: 'Games & stories',
    items: [
      { path: '/drafts', label: 'Draft Arena', shortLabel: 'Drafts', icon: Bookmark },
      { path: '/rune-delve', label: 'Rune Delve', shortLabel: 'Delve', icon: Sparkles },
      { path: '/nexus', label: 'Nexus Defense', shortLabel: 'Nexus', icon: Shield },
      { path: '/nfl', label: 'NFL Game Center', shortLabel: 'NFL', icon: Trophy },
      { path: '/brackets', label: 'Brackets', icon: BracketsIcon },
      { path: '/portfolio-wars', label: 'Portfolio Wars', shortLabel: 'Stocks', icon: TrendingUp },
      { path: '/lockbox', label: 'Lockbox', icon: Lock },
      { path: '/readshift', label: 'READSHIFT', shortLabel: 'Read', icon: BookMarked },
      { path: '/workouts', label: 'FORGE', icon: Flame },
      { path: '/narrative', label: 'Narrative RPG', shortLabel: 'RPG', icon: BookOpen },
      { path: '/journey', label: 'The Splendid Journey', shortLabel: 'Journey', icon: Compass },
    ],
  },
  {
    label: 'Account',
    items: [{ path: '/profile', label: 'Profile', shortLabel: 'You', icon: User }],
  },
];

export const MOBILE_PRIMARY_NAV: AppNavItem[] = [
  { path: '/dashboard', label: 'Home', icon: House },
  { path: '/chat', label: 'Chat', icon: MessageSquareText },
  { path: '/finds', label: 'Drop', icon: Bookmark },
  { path: '/compete', label: 'Compete', icon: Swords },
  { path: '/club', label: 'Club', icon: Users },
  { path: '/profile', label: 'You', icon: User },
];

const ROUTE_TITLES: Array<[RegExp, string]> = [
  [/^\/dashboard/, 'Home'],
  [/^\/chat/, 'Chat'],
  [/^\/compete/, 'Compete'],
  [/^\/club\/settings/, 'Club Settings'],
  [/^\/club\/assets/, 'Club Apps'],
  [/^\/club\/request/, 'Club Access'],
  [/^\/club/, 'Club'],
  [/^\/events/, 'Events'],
  [/^\/finds/, 'The Drop'],
  [/^\/lore/, 'Lore'],
  [/^\/feed/, 'Activity'],
  [/^\/profile/, 'Profile'],
  [/^\/notifications/, 'Notifications'],
  [/^\/posts/, 'Posts'],
  [/^\/polls/, 'Polls'],
  [/^\/rankings/, 'Rankings'],
  [/^\/shared/, 'Shared Media'],
  [/^\/celebrations/, 'Celebrations'],
  [/^\/nfl/, 'NFL Game Center'],
  [/^\/pickem/, 'NFL Game Center'],
  [/^\/brackets/, 'Brackets'],
  [/^\/pools/, 'Pools'],
  [/^\/admin/, 'Admin'],
];

export function getRouteTitle(pathname: string): string {
  return ROUTE_TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'DH Club';
}

export function isRouteActive(pathname: string, path: string): boolean {
  if (path === '/dashboard') return pathname === '/dashboard';
  if (path === '/club') return pathname === '/club';
  if (path === '/compete') return pathname === '/compete';
  if (path === '/feed') return pathname === '/feed';
  if (path === '/brackets') return pathname.startsWith('/brackets') || pathname.startsWith('/pools');
  return pathname === path || pathname.startsWith(`${path}/`);
}

const CLUB_LIFE_PREFIXES = APP_NAV_SECTIONS
  .find((section) => section.label === 'Club life')
  ?.items.map((item) => item.path) ?? [];
const COMPETE_PREFIXES = APP_NAV_SECTIONS
  .find((section) => section.label === 'Games & stories')
  ?.items.map((item) => item.path) ?? [];

/** Keeps the mobile bar oriented while a member is inside a hub destination. */
export function isMobilePrimaryActive(pathname: string, path: string): boolean {
  if (path === '/club') {
    return pathname === path || CLUB_LIFE_PREFIXES
      .filter((prefix) => prefix !== '/finds')
      .some((prefix) => isRouteActive(pathname, prefix));
  }
  if (path === '/compete') {
    return pathname === path
      || pathname.startsWith('/pickem')
      || COMPETE_PREFIXES.some((prefix) => isRouteActive(pathname, prefix));
  }
  return isRouteActive(pathname, path);
}

export const GAME_SHELL_PREFIXES = [
  '/rune-delve',
  '/nexus',
  '/nfl',
  '/pickem',
  '/drafts',
  '/portfolio-wars',
  '/readshift',
  '/workouts',
  '/journey',
] as const;

export function isGameShellRoute(pathname: string): boolean {
  return GAME_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Every shared destination that can earn a slot in the mobile tab bar. */
export const ALL_NAV_ITEMS: AppNavItem[] = APP_NAV_SECTIONS.flatMap((section) => section.items);

/** Fallback order for members who haven't built up a usage history yet. */
export const DEFAULT_TAB_ORDER = ['/chat', '/finds', '/compete', '/club'];
export const MOBILE_USAGE_SLOTS = 3;

/** Maps any pathname to the most specific shared destination it belongs to. */
export function navPathForRoute(pathname: string, items: AppNavItem[] = ALL_NAV_ITEMS): string | null {
  if (pathname.startsWith('/pickem')) return '/nfl';
  let best: string | null = null;
  for (const item of items) {
    const hit = pathname === item.path || pathname.startsWith(`${item.path}/`)
      || (item.path === '/brackets' && pathname.startsWith('/pools'));
    if (hit && (!best || item.path.length > best.length)) best = item.path;
  }
  return best;
}

/**
 * Home is always first, then the member's most visited destinations
 * (ties keep the default order), padded from DEFAULT_TAB_ORDER.
 */
export function pickMostUsedTabs(
  usage: Record<string, number>,
  available: AppNavItem[],
  slots = MOBILE_USAGE_SLOTS,
): AppNavItem[] {
  const home = available.find((item) => item.path === '/dashboard');
  const pool = available.filter((item) => item.path !== '/dashboard' && item.path !== '/profile');
  const rank = (path: string) => {
    const i = DEFAULT_TAB_ORDER.indexOf(path);
    return i === -1 ? DEFAULT_TAB_ORDER.length : i;
  };
  const chosen = [...pool]
    .sort((a, b) => (usage[b.path] ?? 0) - (usage[a.path] ?? 0) || rank(a.path) - rank(b.path))
    .slice(0, slots);
  return home ? [home, ...chosen] : chosen;
}

/** Picks the single tab that should light up, preferring exact destinations over hubs. */
export function activeTabPath(pathname: string, tabs: AppNavItem[]): string | null {
  const direct = tabs.find((tab) => isRouteActive(pathname, tab.path));
  if (direct) return direct.path;
  return tabs.find((tab) => isMobilePrimaryActive(pathname, tab.path))?.path ?? null;
}

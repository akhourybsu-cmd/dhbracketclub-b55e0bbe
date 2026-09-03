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
      { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
      { path: '/chat', label: 'Chat', icon: MessageSquareText },
      { path: '/compete', label: 'Compete', icon: Swords },
      { path: '/club', label: 'Club', icon: Users },
    ],
  },
  {
    label: 'Club life',
    items: [
      { path: '/feed', label: 'Activity Feed', icon: Newspaper },
      { path: '/events', label: 'Events', icon: CalendarDays },
      { path: '/lore', label: 'Lore', icon: ScrollText },
      { path: '/celebrations', label: 'Celebrations', icon: Cake },
      { path: '/polls', label: 'Polls', icon: MessageCircle },
      { path: '/rankings', label: 'Rankings', icon: BarChart3 },
      { path: '/posts', label: 'Posts', icon: FileText },
      { path: '/shared', label: 'Shared Media', icon: Link2 },
    ],
  },
  {
    label: 'Games & stories',
    items: [
      { path: '/drafts', label: 'Draft Arena', icon: Bookmark },
      { path: '/rune-delve', label: 'Rune Delve', icon: Sparkles },
      { path: '/nexus', label: 'Nexus Defense', icon: Shield },
      { path: '/pickem', label: "NFL Pick'em", icon: Trophy },
      { path: '/brackets', label: 'Brackets', icon: BracketsIcon },
      { path: '/portfolio-wars', label: 'Portfolio Wars', icon: TrendingUp },
      { path: '/lockbox', label: 'Lockbox', icon: Lock },
      { path: '/readshift', label: 'READSHIFT', icon: BookMarked },
      { path: '/workouts', label: 'FORGE', icon: Flame },
      { path: '/narrative', label: 'Narrative RPG', icon: BookOpen },
      { path: '/journey', label: 'The Splendid Journey', icon: Compass },
    ],
  },
  {
    label: 'Account',
    items: [{ path: '/profile', label: 'Profile', shortLabel: 'You', icon: User }],
  },
];

export const MOBILE_PRIMARY_NAV: AppNavItem[] = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/chat', label: 'Chat', icon: MessageSquareText },
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
  [/^\/lore/, 'Lore'],
  [/^\/feed/, 'Activity'],
  [/^\/profile/, 'Profile'],
  [/^\/notifications/, 'Notifications'],
  [/^\/posts/, 'Posts'],
  [/^\/polls/, 'Polls'],
  [/^\/rankings/, 'Rankings'],
  [/^\/shared/, 'Shared Media'],
  [/^\/celebrations/, 'Celebrations'],
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
    return pathname === path || CLUB_LIFE_PREFIXES.some((prefix) => isRouteActive(pathname, prefix));
  }
  if (path === '/compete') {
    return pathname === path || COMPETE_PREFIXES.some((prefix) => isRouteActive(pathname, prefix));
  }
  return isRouteActive(pathname, path);
}

export const GAME_SHELL_PREFIXES = [
  '/rune-delve',
  '/nexus',
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

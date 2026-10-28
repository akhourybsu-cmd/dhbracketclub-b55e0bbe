import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { ALL_NAV_ITEMS, navPathForRoute, pickMostUsedTabs, type AppNavItem } from '@/lib/appNavigation';

const PREFIX = 'dh_nav_usage_v1:';

function read(key: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(key) || '{}') ?? {}; } catch { return {}; }
}

/**
 * Counts visits per destination (per user + club) and returns the tab set.
 * The tab set is computed once per session so tabs never reshuffle under a
 * member's thumb mid-use; new habits show up next time the app opens.
 */
export function useMostUsedTabs(isAvailable: (path: string) => boolean): AppNavItem[] {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { club } = useClub();
  const key = `${PREFIX}${user?.id ?? 'anon'}:${club?.id ?? 'none'}`;
  const [snapshot] = useState(() => read(key));

  useEffect(() => {
    const path = navPathForRoute(pathname);
    if (!path || path === '/dashboard') return;
    const usage = read(key);
    usage[path] = (usage[path] ?? 0) + 1;
    try { localStorage.setItem(key, JSON.stringify(usage)); } catch { /* storage full */ }
  }, [pathname, key]);

  return useMemo(
    () => pickMostUsedTabs(snapshot, ALL_NAV_ITEMS.filter((item) => isAvailable(item.path))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, isAvailable],
  );
}

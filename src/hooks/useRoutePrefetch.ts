import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Lightweight route chunk prefetcher. Uses requestIdleCallback so it
 * never competes with the current render. Only prefetches a small set
 * of "likely next" routes per hub. Game/admin pages are NEVER eagerly
 * prefetched on mobile to keep low-end devices snappy.
 */

type PrefetchFn = () => Promise<unknown>;
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};
type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
};

// Map current path → list of dynamic imports to warm.
// IMPORTANT: imports must mirror the exact paths used in App.tsx so Vite
// dedupes the chunks.
const PREFETCH_MAP: Array<{ test: (p: string) => boolean; loaders: PrefetchFn[] }> = [
  {
    test: (p) => p === '/dashboard',
    loaders: [
      () => import('@/pages/ChatPage'),
      () => import('@/pages/CompetePage'),
      () => import('@/pages/ClubPage'),
    ],
  },
  {
    test: (p) => p === '/club',
    loaders: [
      () => import('@/pages/FeedPage'),
      () => import('@/pages/EventsPage'),
    ],
  },
  {
    test: (p) => p === '/compete',
    loaders: [
      () => import('@/pages/DraftsListPage'),
      () => import('@/pages/PickemHomePage'),
    ],
  },
  {
    test: (p) => p === '/nexus',
    loaders: [() => import('@/pages/NexusMissionsPage')],
  },
];

function ric(cb: () => void) {
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(cb, { timeout: 2000 });
  } else {
    setTimeout(cb, 600);
  }
}

export function useRoutePrefetch() {
  const location = useLocation();
  useEffect(() => {
    // Skip on slow connections / data saver
    const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (conn && (conn.saveData || /(^2g|slow-2g)/.test(conn.effectiveType || ''))) return;

    const entry = PREFETCH_MAP.find((e) => e.test(location.pathname));
    if (!entry) return;

    ric(() => {
      entry.loaders.forEach((l) => {
        l().catch(() => false);
      });
    });
  }, [location.pathname]);
}

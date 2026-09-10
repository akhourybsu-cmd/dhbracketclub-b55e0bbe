// DH Club Home — QuickBar persistence + selection state
//
// Stores the user's pinned-app slug list per (user, club) so each club gets
// its own dock. Lives in localStorage — a future pass can promote this to a
// `user_preferences` table without changing the public hook surface.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import type { InstalledAsset } from '@/types/assets';

const STORAGE_PREFIX = 'dh_home_quickbar_v1';
const MAX_PINNED = 6;
const DEFAULT_PINNED = 4;

function storageKey(userId: string, clubId: string | null) {
  return `${STORAGE_PREFIX}:${userId}:${clubId ?? 'noclub'}`;
}

function readPinned(userId: string, clubId: string | null): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, clubId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : null;
  } catch { return null; }
}

function writePinned(userId: string, clubId: string | null, slugs: string[]) {
  try { window.localStorage.setItem(storageKey(userId, clubId), JSON.stringify(slugs)); } catch { /* ignore */ }
}

export interface UseQuickBarReturn {
  /** Resolved, in-order InstalledAsset rows the user has pinned. */
  pinned: InstalledAsset[];
  /** All installed assets that aren't currently pinned (for the picker). */
  available: InstalledAsset[];
  /** Pin an asset by slug. No-op if already pinned or at MAX. */
  pin: (slug: string) => void;
  /** Remove an asset from the pinned list. */
  unpin: (slug: string) => void;
  /** Move a pinned slug up/down by one position. */
  move: (slug: string, direction: 'up' | 'down') => void;
  /** Reset to the default selection (first N installed assets by sort_order). */
  reset: () => void;
  /** Maximum pin count. Useful for the editor UI. */
  max: number;
}

/**
 * Compute a stable default pinned set when the user hasn't customized yet.
 * Picks the first DEFAULT_PINNED installed assets by `sort_order`.
 */
function defaultSelection(installed: InstalledAsset[]): string[] {
  return installed
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, DEFAULT_PINNED)
    .map(ia => ia.asset.slug);
}

export function useQuickBar(installedAssets: InstalledAsset[]): UseQuickBarReturn {
  const { user } = useAuth();
  const userId = user?.id;
  const { club } = useClub();
  const [pinnedSlugs, setPinnedSlugs] = useState<string[]>([]);

  // Load on mount / when user or club changes. Falls back to defaults the
  // first time a user lands on a club's Home.
  useEffect(() => {
    if (!userId || installedAssets.length === 0) { setPinnedSlugs([]); return; }
    const stored = readPinned(userId, club?.id ?? null);
    if (stored !== null) {
      // Filter to slugs still installed — uninstalled assets fall out cleanly.
      const valid = [...new Set(stored)].filter(s => installedAssets.some(ia => ia.asset.slug === s)).slice(0,MAX_PINNED);
      setPinnedSlugs(valid);
    } else {
      setPinnedSlugs(defaultSelection(installedAssets));
    }
  }, [userId, club?.id, installedAssets]);

  const persist = useCallback((next: string[]) => {
    if (!user) return;
    setPinnedSlugs(next);
    writePinned(user.id, club?.id ?? null, next);
  }, [user, club]);

  const pin = useCallback((slug: string) => {
    if (pinnedSlugs.includes(slug) || pinnedSlugs.length >= MAX_PINNED) return;
    persist([...pinnedSlugs, slug]);
  }, [pinnedSlugs, persist]);

  const unpin = useCallback((slug: string) => {
    if (!pinnedSlugs.includes(slug)) return;
    persist(pinnedSlugs.filter(s => s !== slug));
  }, [pinnedSlugs, persist]);

  const move = useCallback((slug: string, direction: 'up' | 'down') => {
    const idx = pinnedSlugs.indexOf(slug);
    if (idx < 0) return;
    const next = pinnedSlugs.slice();
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persist(next);
  }, [pinnedSlugs, persist]);

  const reset = useCallback(() => {
    persist(defaultSelection(installedAssets));
  }, [installedAssets, persist]);

  const pinned = useMemo(() => {
    const bySlug = new Map(installedAssets.map(ia => [ia.asset.slug, ia]));
    return pinnedSlugs.map(s => bySlug.get(s)).filter((ia): ia is InstalledAsset => !!ia);
  }, [pinnedSlugs, installedAssets]);

  const available = useMemo(() => {
    const pinnedSet = new Set(pinnedSlugs);
    return installedAssets
      .filter(ia => !pinnedSet.has(ia.asset.slug))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [pinnedSlugs, installedAssets]);

  return { pinned, available, pin, unpin, move, reset, max: MAX_PINNED };
}

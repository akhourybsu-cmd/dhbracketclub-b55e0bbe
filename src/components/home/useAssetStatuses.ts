// DH Club Home — per-asset live status resolver
//
// Single hook that, given the set of slugs the club has installed, fetches a
// minimum amount of data to render a one-line status chip on each asset
// launcher tile (e.g. "Your turn", "Picks open", "Resume W14").
//
// Design notes:
//   • Only fetches data for slugs that are actually installed — no waste.
//   • Slugs without a known status simply get null and the launcher renders
//     a neutral "Open" affordance.
//   • All requests run in parallel and the hook returns the first frame
//     immediately (status: null) so the UI never blocks.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDerivedDraftTurn } from '@/lib/draftTurn';
import { useAuth } from '@/contexts/AuthContext';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';

export type AssetStatusTone = 'live' | 'urgent' | 'info' | 'idle';

export interface AssetStatus {
  /** Short text shown under the asset name. Keep ≤ ~14 chars. */
  text: string;
  /** Tone — drives the chip color. */
  tone: AssetStatusTone;
}

export type AssetStatusMap = Partial<Record<string, AssetStatus | null>>;

const NEXUS_SAVE_PREFIX = 'nexus_run_state_v1';

/**
 * Fetch one-line status chips for each installed slug. Returns a map keyed
 * by slug. Missing entries mean "no status to show" — callers should render
 * a neutral default. Cheap by design — single round-trip per asset.
 */
export function useAssetStatuses(installedSlugs: string[]): { statuses: AssetStatusMap; loading: boolean } {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<AssetStatusMap>({});
  const [loading, setLoading] = useState(true);

  // Stable key — re-run only when the set of installed slugs changes.
  const key = installedSlugs.slice().sort().join('|');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const tasks: Array<Promise<[string, AssetStatus | null]>> = [];

    if (installedSlugs.includes('draft-arena')) {
      tasks.push(loadDraftArenaStatus(user.id).then(s => ['draft-arena', s] as const));
    }
    if (installedSlugs.includes('nexus-defense')) {
      tasks.push(loadNexusStatus(user.id).then(s => ['nexus-defense', s] as const));
    }
    if (installedSlugs.includes('nfl-pickem')) {
      tasks.push(loadPickemStatus(user.id).then(s => ['nfl-pickem', s] as const));
    }
    if (installedSlugs.includes('portfolio-wars')) {
      tasks.push(loadPortfolioWarsStatus().then(s => ['portfolio-wars', s] as const));
    }
    if (installedSlugs.includes('lockbox')) {
      tasks.push(loadLockboxStatus(user.id).then(s => ['lockbox', s] as const));
    }
    if (installedSlugs.includes('brackets')) {
      tasks.push(loadBracketsStatus(user.id).then(s => ['brackets', s] as const));
    }

    Promise.all(tasks).then(entries => {
      if (cancelled) return;
      const next: AssetStatusMap = {};
      for (const [slug, status] of entries) next[slug] = status;
      setStatuses(next);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key]);

  return { statuses, loading };
}

/* ─── Per-asset resolvers ──────────────────────────────────────────── */

async function loadDraftArenaStatus(userId: string): Promise<AssetStatus | null> {
  // Top priority: a draft where it's this user's turn. We derive the picker
  // from participants + picks rather than trusting drafts.current_pick_user_id,
  // which can lag behind the actual pick stream.
  const { data: liveDrafts } = await supabase
    .from('drafts')
    .select('id, num_rounds, status, current_pick_user_id')
    .eq('status', 'in_progress');

  const liveCount = liveDrafts?.length ?? 0;
  if (liveCount > 0) {
    const ids = liveDrafts!.map(d => d.id);
    const [{ data: parts }, { data: picks }] = await Promise.all([
      supabase.from('draft_participants').select('draft_id, user_id, pick_order').in('draft_id', ids),
      supabase.from('draft_picks').select('draft_id').in('draft_id', ids),
    ]);
    const partsByDraft = new Map<string, any[]>();
    (parts ?? []).forEach((p: any) => {
      const arr = partsByDraft.get(p.draft_id) ?? [];
      arr.push(p); partsByDraft.set(p.draft_id, arr);
    });
    const pickCounts = new Map<string, number>();
    (picks ?? []).forEach((p: any) => pickCounts.set(p.draft_id, (pickCounts.get(p.draft_id) ?? 0) + 1));
    const yourTurn = liveDrafts!.some(d => {
      const derived = getDerivedDraftTurn(d as any, partsByDraft.get(d.id) ?? [], pickCounts.get(d.id) ?? 0);
      return derived.current_pick_user_id === userId;
    });
    if (yourTurn) return { text: 'Your turn', tone: 'urgent' };
    return { text: `${liveCount} live`, tone: 'live' };
  }

  return null;
}

async function loadNexusStatus(userId: string): Promise<AssetStatus | null> {
  // Resumable run on this device wins.
  if (typeof window !== 'undefined') {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(`${NEXUS_SAVE_PREFIX}:${userId}:`)) continue;
      try {
        const raw = window.localStorage.getItem(k);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.state && parsed.state.status !== 'victory' && parsed.state.status !== 'defeat') {
          if (parsed.missionId === ENDLESS_MISSION_ID) {
            return { text: `W${(parsed.state.waveIndex ?? 0) + 1}`, tone: 'urgent' };
          }
          return { text: 'Resume', tone: 'urgent' };
        }
      } catch { /* ignore corrupted */ }
    }
  }

  // Active club operation.
  try {
    const { data: op } = await (supabase as any)
      .from('nexus_operations')
      .select('id, current_phase')
      .eq('status', 'active')
      .maybeSingle();
    if (op) return { text: `Op P${op.current_phase}`, tone: 'live' };
  } catch { /* table may not exist in older clubs */ }

  return null;
}

async function loadPickemStatus(userId: string): Promise<AssetStatus | null> {
  try {
    const { data: season } = await (supabase as any)
      .from('nfl_seasons').select('id, current_week, status')
      .order('year', { ascending: false }).limit(1).maybeSingle();
    if (!season || season.status !== 'active') return null;
    const { data: week } = await (supabase as any)
      .from('nfl_weeks').select('id, status').eq('season_id', season.id).eq('week_number', season.current_week).maybeSingle();
    if (!week || week.status === 'upcoming') return null;
    const [{ count: total }, { count: mine }] = await Promise.all([
      (supabase as any).from('nfl_games').select('id', { count: 'exact', head: true }).eq('week_id', week.id),
      (supabase as any).from('nfl_picks').select('id', { count: 'exact', head: true }).eq('week_id', week.id).eq('user_id', userId),
    ]);
    const remaining = Math.max(0, (total ?? 0) - (mine ?? 0));
    if (remaining > 0) return { text: `${remaining} pick${remaining === 1 ? '' : 's'}`, tone: 'urgent' };
    if ((total ?? 0) > 0) return { text: 'Card complete', tone: 'info' };
    return null;
  } catch { return null; }
}

async function loadPortfolioWarsStatus(): Promise<AssetStatus | null> {
  try {
    const { data: ch } = await supabase
      .from('pw_challenges')
      .select('status')
      .in('status', ['active', 'locked', 'upcoming'])
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ch) return null;
    if (ch.status === 'upcoming') return { text: 'Picks open', tone: 'urgent' };
    if (ch.status === 'active') return { text: 'Live week', tone: 'live' };
    if (ch.status === 'locked') return { text: 'Locked', tone: 'info' };
    return null;
  } catch { return null; }
}

async function loadLockboxStatus(userId: string): Promise<AssetStatus | null> {
  try {
    const { data: day } = await (supabase as any)
      .from('lockbox_days').select('id, starts_at')
      .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: false }).limit(1).maybeSingle();
    if (!day) return null;
    const { count: mine } = await (supabase as any)
      .from('lockbox_locks').select('id', { count: 'exact', head: true })
      .eq('day_id', day.id).eq('user_id', userId);
    if ((mine ?? 0) === 0) return { text: 'No lock', tone: 'urgent' };
    return { text: 'Locked', tone: 'info' };
  } catch { return null; }
}

async function loadBracketsStatus(userId: string): Promise<AssetStatus | null> {
  const { data: m } = await supabase.from('pool_members').select('pool_id').eq('user_id', userId);
  if (!m || m.length === 0) return null;
  const { data: pools } = await supabase.from('pools').select('id, lock_time').in('id', m.map(x => x.pool_id));
  if (!pools) return null;
  const now = Date.now();
  const open = pools.filter(p => new Date(p.lock_time).getTime() > now);
  if (open.length === 0) return { text: 'Locked', tone: 'info' };
  const next = open.reduce((a, b) => new Date(a.lock_time) < new Date(b.lock_time) ? a : b);
  const hours = Math.max(0, (new Date(next.lock_time).getTime() - now) / (1000 * 60 * 60));
  if (hours <= 24) return { text: `${Math.ceil(hours)}h lock`, tone: 'urgent' };
  return { text: `${open.length} open`, tone: 'live' };
}

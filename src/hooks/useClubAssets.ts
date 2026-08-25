import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';
import { useAuth } from '@/contexts/AuthContext';
import type { PlatformAsset, InstalledAsset } from '@/types/assets';
import { NAV_ASSET_SLUGS } from '@/types/assets';
import { HYDRATE_TIMEOUT_MS, QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

interface UseClubAssetsReturn {
  installedAssets: InstalledAsset[];
  allAssets: PlatformAsset[];
  loading: boolean;
  /** Asset ids currently being installed — drives per-card inline spinners. */
  pendingInstall: Set<string>;
  /** Installed-row ids currently being uninstalled. */
  pendingUninstall: Set<string>;
  /** Installed-row ids whose enable/visible toggle is in flight. */
  pendingToggle: Set<string>;
  /** True if slug is installed AND enabled for this club */
  isInstalled: (slug: string) => boolean;
  /** True if slug is installed, enabled, AND visible_to_members */
  isVisible: (slug: string) => boolean;
  /**
   * Filter a nav path list: if the club has configured any assets,
   * only paths whose slugs are installed+visible are returned.
   * If nothing is configured yet, all paths pass through (backward compat).
   */
  filterNavPaths: (paths: string[]) => string[];
  install: (assetId: string) => Promise<void>;
  uninstall: (installedId: string) => Promise<void>;
  /** Re-insert an asset after an undo — used by the optimistic uninstall flow. */
  restore: (asset: InstalledAsset) => Promise<void>;
  setEnabled: (installedId: string, enabled: boolean) => Promise<void>;
  setVisible: (installedId: string, visible: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const addToSet = (s: Set<string>, v: string) => {
  const next = new Set(s); next.add(v); return next;
};
const removeFromSet = (s: Set<string>, v: string) => {
  const next = new Set(s); next.delete(v); return next;
};

export function useClubAssets(): UseClubAssetsReturn {
  const { club } = useClub();
  const { user } = useAuth();
  const [installedAssets, setInstalledAssets] = useState<InstalledAsset[]>([]);
  const [allAssets, setAllAssets] = useState<PlatformAsset[]>([]);
  const [loading, setLoading] = useState(true);
  // Transient "pending" sets — drive per-asset spinners without freezing the UI.
  const [pendingInstall, setPendingInstall] = useState<Set<string>>(new Set());
  const [pendingUninstall, setPendingUninstall] = useState<Set<string>>(new Set());
  const [pendingToggle, setPendingToggle] = useState<Set<string>>(new Set());

  // Mirror current state in a ref so callbacks captured by toasts (or any
  // long-lived consumer) always see the latest installedAssets without
  // having to be in the useCallback dependency list. Without this, the
  // Undo toast's onClick captures a stale array and the dedup early-return
  // misfires.
  const installedRef = useRef<InstalledAsset[]>(installedAssets);
  useEffect(() => { installedRef.current = installedAssets; }, [installedAssets]);

  const fetchAssets = useCallback(async () => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    try {
      const [platformResult, installedResult] = await withTimeout(
        Promise.allSettled([
          withTimeout(
            (supabase as any).from('platform_assets')
              .select('*')
              .eq('is_active', true)
              .order('sort_order'),
            QUERY_TIMEOUT_MS,
            'platform assets',
          ),
          withTimeout(
            (supabase as any).from('club_installed_assets')
              .select('*, asset:platform_assets(*)')
              .eq('club_id', club.id)
              .order('sort_order'),
            QUERY_TIMEOUT_MS,
            'club installed assets',
          ),
        ]),
        HYDRATE_TIMEOUT_MS,
        'club assets hydrate',
      );

      const platformResponse = platformResult.status === 'fulfilled' ? platformResult.value : null;
      const installedResponse = installedResult.status === 'fulfilled' ? installedResult.value : null;
      if (platformResult.status === 'rejected') {
        console.error('[useClubAssets] platform_assets fetch failed:', platformResult.reason);
      }
      if (installedResult.status === 'rejected') {
        console.error('[useClubAssets] club_installed_assets fetch failed:', installedResult.reason);
      }
      if (platformResponse?.error) {
        console.error('[useClubAssets] platform_assets fetch error:', platformResponse.error.message, platformResponse.error.code);
      }
      if (installedResponse?.error) {
        console.error('[useClubAssets] club_installed_assets fetch error:', installedResponse.error.message, installedResponse.error.code);
      }
      setAllAssets((platformResponse?.data as PlatformAsset[]) ?? []);
      setInstalledAssets((installedResponse?.data as InstalledAsset[]) ?? []);
    } catch (err) {
      console.error('[useClubAssets] unexpected fetch error:', err);
      setAllAssets([]);
      setInstalledAssets([]);
    } finally {
      setLoading(false);
    }
  }, [club?.id]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const isInstalled = useCallback((slug: string) =>
    installedAssets.some(ia => ia.asset?.slug === slug && ia.enabled),
    [installedAssets]);

  const isVisible = useCallback((slug: string) => {
    const ia = installedAssets.find(ia => ia.asset?.slug === slug);
    if (!ia) return false; // not installed = not visible
    return ia.enabled && ia.visible_to_members;
  }, [installedAssets]);

  const filterNavPaths = useCallback((paths: string[]) => {
    // If the catalog table isn't seeded yet (no platform assets exist), pass everything
    // through so the nav doesn't go blank in uninitialized environments.
    if (allAssets.length === 0) return paths;
    return paths.filter(p => {
      const slug = NAV_ASSET_SLUGS[p];
      if (!slug) return true; // non-asset paths always pass (dashboard, compete, profile…)
      return isVisible(slug);
    });
  }, [allAssets, isVisible]);

  /**
   * Optimistic install. Inserts a temporary InstalledAsset row into local
   * state immediately so the UI updates without waiting on the network. The
   * server INSERT runs with `.select(..)` so we can replace the temp row
   * with the real one in a single round-trip. Any error rolls back the
   * temp row and rethrows for the caller's toast handler.
   */
  const install = useCallback(async (assetId: string) => {
    if (!club || !user) {
      throw new Error('Club or user not loaded');
    }
    // Guard against duplicates — if the asset is already installed for this
    // club, just no-op silently. The DB has a unique(club_id, asset_id)
    // constraint anyway; this catches the case before the network call.
    // Use the ref so toast/long-lived callers see latest state.
    if (installedRef.current.some(ia => ia.asset_id === assetId)) return;

    const asset = allAssets.find(a => a.id === assetId);
    const tempId = `temp-${assetId}-${Date.now()}`;
    const nowIso = new Date().toISOString();
    if (asset) {
      const optimistic: InstalledAsset = {
        id: tempId,
        club_id: club.id,
        asset_id: assetId,
        installed_by: user.id,
        installed_at: nowIso,
        enabled: true,
        visible_to_members: true,
        configuration_json: {},
        sort_order: 0,
        created_at: nowIso,
        updated_at: nowIso,
        asset,
      };
      setInstalledAssets(prev => [...prev, optimistic]);
    }
    setPendingInstall(prev => addToSet(prev, assetId));

    try {
      const { data, error } = await (supabase as any)
        .from('club_installed_assets')
        .insert({
          club_id: club.id,
          asset_id: assetId,
          installed_by: user.id,
          enabled: true,
          visible_to_members: true,
        })
        .select('*, asset:platform_assets(*)')
        .single();
      if (error) throw error;

      // Replace the temp row with the real one — keep position so list doesn't reflow.
      const real = data as InstalledAsset;
      setInstalledAssets(prev => prev.map(ia => ia.id === tempId ? real : ia));
    } catch (err) {
      console.error('[useClubAssets] install failed:', err);
      // Rollback the optimistic insert.
      setInstalledAssets(prev => prev.filter(ia => ia.id !== tempId));
      throw err;
    } finally {
      setPendingInstall(prev => removeFromSet(prev, assetId));
    }
  }, [club, user, allAssets]);

  /**
   * Optimistic uninstall. Captures the row first so we can restore it on
   * failure (or via an Undo toast). Rejects with the original row attached
   * to err.cause so callers can grab it for undo without re-querying.
   */
  const uninstall = useCallback(async (installedId: string) => {
    const target = installedRef.current.find(ia => ia.id === installedId);
    if (!target) return;
    setInstalledAssets(prev => prev.filter(ia => ia.id !== installedId));
    setPendingUninstall(prev => addToSet(prev, installedId));
    try {
      const { error } = await (supabase as any)
        .from('club_installed_assets')
        .delete()
        .eq('id', installedId);
      if (error) throw error;
    } catch (err) {
      console.error('[useClubAssets] uninstall failed:', err);
      // Rollback — restore the row.
      setInstalledAssets(prev => [...prev, target]);
      throw err;
    } finally {
      setPendingUninstall(prev => removeFromSet(prev, installedId));
    }
  }, []);

  /**
   * Re-insert a previously-uninstalled asset, used by the Undo toast flow.
   * Idempotent if the asset is already back in place.
   */
  const restore = useCallback(async (asset: InstalledAsset) => {
    if (!club || !user) return;
    if (installedRef.current.some(ia => ia.asset_id === asset.asset_id)) return;
    // Optimistic re-add.
    setInstalledAssets(prev => [...prev, asset]);
    try {
      const { data, error } = await (supabase as any)
        .from('club_installed_assets')
        .insert({
          club_id: club.id,
          asset_id: asset.asset_id,
          installed_by: user.id,
          enabled: asset.enabled,
          visible_to_members: asset.visible_to_members,
        })
        .select('*, asset:platform_assets(*)')
        .single();
      if (error) throw error;
      const real = data as InstalledAsset;
      setInstalledAssets(prev => prev.map(ia => ia.id === asset.id ? real : ia));
    } catch (err) {
      console.error('[useClubAssets] restore failed:', err);
      setInstalledAssets(prev => prev.filter(ia => ia.id !== asset.id));
      throw err;
    }
  }, [club, user]);

  /** Optimistic toggle with rollback. Snapshot from the ref so the captured
   *  callback closure always sees the latest installedAssets. */
  const setEnabled = useCallback(async (installedId: string, enabled: boolean) => {
    const before = installedRef.current;
    setInstalledAssets(prev => prev.map(ia => ia.id === installedId ? { ...ia, enabled } : ia));
    setPendingToggle(prev => addToSet(prev, installedId));
    try {
      const { error } = await (supabase as any)
        .from('club_installed_assets')
        .update({ enabled })
        .eq('id', installedId);
      if (error) throw error;
    } catch (err) {
      console.error('[useClubAssets] setEnabled failed:', err);
      setInstalledAssets(before);
      throw err;
    } finally {
      setPendingToggle(prev => removeFromSet(prev, installedId));
    }
  }, []);

  const setVisible = useCallback(async (installedId: string, visible_to_members: boolean) => {
    const before = installedRef.current;
    setInstalledAssets(prev => prev.map(ia => ia.id === installedId ? { ...ia, visible_to_members } : ia));
    setPendingToggle(prev => addToSet(prev, installedId));
    try {
      const { error } = await (supabase as any)
        .from('club_installed_assets')
        .update({ visible_to_members })
        .eq('id', installedId);
      if (error) throw error;
    } catch (err) {
      console.error('[useClubAssets] setVisible failed:', err);
      setInstalledAssets(before);
      throw err;
    } finally {
      setPendingToggle(prev => removeFromSet(prev, installedId));
    }
  }, []);

  return {
    installedAssets, allAssets, loading,
    pendingInstall, pendingUninstall, pendingToggle,
    isInstalled, isVisible, filterNavPaths,
    install, uninstall, restore, setEnabled, setVisible,
    refresh: fetchAssets,
  };
}

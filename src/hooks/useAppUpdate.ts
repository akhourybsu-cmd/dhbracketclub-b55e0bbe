import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { isMesomonConsole } from '@/lib/appNavigation';
import { fetchRemoteBuildId, nukeAndReload } from '@/lib/forceUpdate';

const CHECK_INTERVAL_MS = 30 * 1000;
const AUTO_NUKE_DELAY_MS = 10 * 1000;
// If we've been open this long without seeing a build change, do a soft reload
// on next focus to defeat aggressive Android Chrome caching of /version.json.
const STALE_BUNDLE_FALLBACK_MS = 5 * 60 * 1000;

// localStorage keys to break update loops across reloads. If we've already
// nuke-and-reloaded for a particular remote build id and the freshly-loaded
// bundle STILL doesn't match it, the deployment itself is inconsistent
// (CDN drift between /version.json and the JS bundle). Suppress further
// prompts for that remote id so users aren't stuck in a "Update available"
// loop on every app open.
const LS_LAST_NUKED_REMOTE = 'dh_update_last_nuked_remote_v1';
const LS_SESSION_PROMPTED = 'dh_update_session_prompted_v1';
const LS_LAST_PROMPTED_REMOTE = 'dh_update_last_prompted_remote_v1';

/**
 * Universal update detector. Independent of the service worker — fetches
 * /version.json (no-store) and compares against the build id baked into
 * this JS bundle. On mismatch: prominent toast + auto nuke after 10s.
 *
 * Loop protection: if we've already nuked once for a given remote build id
 * and the reloaded bundle still has a different local id, treat the deploy
 * as inconsistent and stop prompting until /version.json changes again.
 */
export function useAppUpdate() {
  const location = useLocation();
  const localBuildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
  const promptedRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSuccessfulProbeRef = useRef<number>(Date.now());
  const mountedAtRef = useRef<number>(Date.now());
  const softReloadedRef = useRef(false);
  const deferredUpdate = useRef<string | null>(null);
  const applyUpdate = useCallback((remote: string) => {
    if (isMesomonConsole(window.location.pathname)) {
      deferredUpdate.current = remote;
      return;
    }
    try { localStorage.setItem(LS_LAST_NUKED_REMOTE, remote); } catch { /* noop */ }
    void nukeAndReload();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const readLS = (k: string): string | null => {
      try { return localStorage.getItem(k); } catch { return null; }
    };
    const writeLS = (k: string, v: string) => {
      try { localStorage.setItem(k, v); } catch { /* noop */ }
    };

    // Don't auto-nuke during an active game run, chat composition, or form entry —
    // user would lose progress. Show toast but let them tap to update manually.
    const isBusyContext = (): boolean => {
      const p = window.location.pathname;
      if (p.startsWith('/nexus/battle') || p.startsWith('/rune-delve/play')) return true;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return true;
      return false;
    };

    const shouldPromptFor = (remote: string): boolean => {
      // Skip if remote/local aren't real build stamps.
      if (remote === localBuildId) return false;
      if (localBuildId === 'dev' || remote === 'dev') return false;
      // Loop guard: if we already nuked for this exact remote id and ended
      // up back here with a still-mismatched local id, the deploy is
      // inconsistent — suppress.
      if (readLS(LS_LAST_NUKED_REMOTE) === remote) {
        console.warn(
          '[update] suppressing prompt: already nuked for remote',
          remote,
          'but local is still',
          localBuildId,
          '— deploy may be inconsistent',
        );
        return false;
      }
      // Durable prompt dedupe. iOS installed PWAs can relaunch with a stale
      // bundle even after cache/SW cleanup, and sessionStorage is often reset
      // between standalone launches. If we already told this device about this
      // exact remote build, don't nag on every app open.
      if (readLS(LS_LAST_PROMPTED_REMOTE) === remote) {
        console.info('[update] suppressing prompt: already prompted for remote', remote);
        return false;
      }
      // Per-session dedupe.
      if (sessionStorage.getItem(LS_SESSION_PROMPTED) === remote) return false;
      return true;
    };

    const triggerUpdate = (remote: string) => {
      if (promptedRef.current) return;
      promptedRef.current = true;
      writeLS(LS_LAST_PROMPTED_REMOTE, remote);
      try { sessionStorage.setItem(LS_SESSION_PROMPTED, remote); } catch { /* noop */ }

      const doNuke = () => applyUpdate(remote);

      const busy = isBusyContext();
      toast('🚀 New version available', {
        description: busy
          ? 'Tap to update when you finish.'
          : 'Updating in 10 seconds — tap to update now.',
        duration: busy ? Infinity : AUTO_NUKE_DELAY_MS,
        action: {
          label: 'Update now',
          onClick: () => {
            if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
            doNuke();
          },
        },
      });

      if (!busy) {
        autoTimerRef.current = setTimeout(doNuke, AUTO_NUKE_DELAY_MS);
      }
    };

    const check = async () => {
      if (cancelled || promptedRef.current || isMesomonConsole(window.location.pathname)) return;
      const remote = await fetchRemoteBuildId();
      if (cancelled || !remote || isMesomonConsole(window.location.pathname)) return;
      lastSuccessfulProbeRef.current = Date.now();
      // If local now matches remote, clear any stale loop-guard marker so
      // future genuine deploys can prompt again.
      if (remote === localBuildId && readLS(LS_LAST_NUKED_REMOTE)) {
        try { localStorage.removeItem(LS_LAST_NUKED_REMOTE); } catch { /* noop */ }
      }
      if (remote === localBuildId && readLS(LS_LAST_PROMPTED_REMOTE)) {
        try { localStorage.removeItem(LS_LAST_PROMPTED_REMOTE); } catch { /* noop */ }
      }
      if (shouldPromptFor(remote)) {
        triggerUpdate(remote);
      }
    };

    // Initial check + interval
    void check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || isMesomonConsole(window.location.pathname)) return;
      void check();
      // Android fallback: if the JS bundle has been alive for >5min and we
      // haven't seen a build id update in that window, the cached bundle may
      // never see /version.json. Soft-reload once to force a fresh fetch.
      const aliveFor = Date.now() - mountedAtRef.current;
      const sinceProbe = Date.now() - lastSuccessfulProbeRef.current;
      if (
        !softReloadedRef.current &&
        !promptedRef.current &&
        aliveFor > STALE_BUNDLE_FALLBACK_MS &&
        sinceProbe > STALE_BUNDLE_FALLBACK_MS &&
        localBuildId !== 'dev'
      ) {
        softReloadedRef.current = true;
        const url = new URL(window.location.href);
        url.searchParams.set('_v', Date.now().toString());
        window.location.replace(url.toString());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);

    return () => {
      cancelled = true;
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
    // localBuildId is constant for the lifetime of this bundle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Probe on every route change too — cheap and catches stuck installs.
  // Reuses the same shouldPromptFor / loop guards via the effect above by
  // simply re-running check() through the visibility path is overkill;
  // inline a minimal version that respects the same localStorage guards.
  useEffect(() => {
    if (isMesomonConsole(location.pathname)) return;
    if (deferredUpdate.current) {
      const remote = deferredUpdate.current;
      deferredUpdate.current = null;
      applyUpdate(remote);
      return;
    }
    if (promptedRef.current) return;
    let cancelled = false;
    void (async () => {
      const remote = await fetchRemoteBuildId();
      if (cancelled || !remote || isMesomonConsole(window.location.pathname)) return;
      lastSuccessfulProbeRef.current = Date.now();
      if (remote === localBuildId) return;
      if (localBuildId === 'dev' || remote === 'dev') return;
      // Loop guard
      let lastNuked: string | null = null;
      try { lastNuked = localStorage.getItem(LS_LAST_NUKED_REMOTE); } catch { /* noop */ }
      if (lastNuked === remote) return;
      let lastPrompted: string | null = null;
      try { lastPrompted = localStorage.getItem(LS_LAST_PROMPTED_REMOTE); } catch { /* noop */ }
      if (lastPrompted === remote) return;
      let sessionPrompted: string | null = null;
      try { sessionPrompted = sessionStorage.getItem(LS_SESSION_PROMPTED); } catch { /* noop */ }
      if (sessionPrompted === remote) return;
      if (promptedRef.current) return;
      promptedRef.current = true;
      try { localStorage.setItem(LS_LAST_PROMPTED_REMOTE, remote); } catch { /* noop */ }
      try { sessionStorage.setItem(LS_SESSION_PROMPTED, remote); } catch { /* noop */ }
      const doNuke = () => applyUpdate(remote);
      toast('🚀 New version available', {
        description: 'Updating in 10 seconds — tap to update now.',
        duration: AUTO_NUKE_DELAY_MS,
        action: {
          label: 'Update now',
          onClick: () => {
            if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
            doNuke();
          },
        },
      });
      autoTimerRef.current = setTimeout(doNuke, AUTO_NUKE_DELAY_MS);
    })();
    return () => { cancelled = true; };
  }, [location.pathname, localBuildId, applyUpdate]);
}

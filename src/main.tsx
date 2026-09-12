import { createRoot } from "react-dom/client";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import App from "./App.tsx";
import "./index.css";
import { fetchRemoteBuildId, nukeAndReload } from "./lib/forceUpdate";

const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

// Recovery escape hatch: visit `/?fresh=1` to nuke service workers + caches.
async function maybeHardReset() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("fresh")) return false;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.error("Hard reset failed:", e);
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("fresh");
  window.location.replace(url.pathname + url.search + url.hash);
  return true;
}

// Auto-recover from stale-bundle ChunkLoadErrors. After a deploy, an Android
// PWA that managed to update index.html but kept an old chunk reference will
// throw "Loading chunk … failed" or similar — without intervention this leaves
// the app in a white-screen / silent-failure state. Detect and self-heal.
function installChunkErrorRecovery() {
  let recovering = false;
  const isChunkError = (msg: unknown): boolean => {
    if (!msg) return false;
    const s = typeof msg === "string" ? msg : String((msg as any)?.message ?? "");
    return (
      /ChunkLoadError/i.test(s) ||
      /Loading chunk [\w-]+ failed/i.test(s) ||
      /Failed to fetch dynamically imported module/i.test(s) ||
      /Importing a module script failed/i.test(s)
    );
  };
  const recover = (reason: string) => {
    if (recovering) return;
    recovering = true;
    console.warn("[chunk-recovery] triggering nukeAndReload:", reason);
    void nukeAndReload();
  };
  window.addEventListener("error", (e) => {
    if (isChunkError(e?.message) || isChunkError(e?.error)) {
      recover(`error: ${e?.message}`);
    }
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (isChunkError(e?.reason)) {
      recover(`unhandledrejection: ${e?.reason?.message ?? e?.reason}`);
    }
  });
}

// Register our minimal push-only service worker. Skips iframes/preview hosts
// to avoid interfering with the Lovable editor preview.
function registerPushSW() {
  if (!("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app") &&
      window.location.hostname.includes("id-preview--");

  if (isInIframe || isPreviewHost) return;

  // Defer registration so the bootstrap probe in index.html has time to evict
  // any legacy Workbox SWs first.
  window.addEventListener("load", () => {
    setTimeout(() => {
      // Cache-bust the SW URL with the current build id. New builds register
      // a "different" SW URL, forcing Chrome (especially Android WebAPK
      // contexts) to re-evaluate and re-fetch the script.
      navigator.serviceWorker
        .register(`/sw-push.js?v=${encodeURIComponent(BUILD_ID)}`, { scope: "/" })
        .then((reg) => {
          // On focus, ask the browser to re-check the SW script. On installed
          // Android PWAs this also nudges Chrome to revalidate the launch shell.
          window.addEventListener("focus", () => {
            reg.update().catch(() => false);
          });
        })
        .catch((err) => console.warn("[sw-push] register failed:", err));
    }, 1500);
  });
}

maybeHardReset().then((reset) => {
  if (reset) return;
  installChunkErrorRecovery();
  // Fire one immediate version probe at boot so cold launches detect
  // a new build instantly (instead of waiting for the 30s interval).
  void fetchRemoteBuildId();
  // Eagerly nudge any already-installed service worker (including legacy
  // Workbox SWs that cache Supabase REST responses) to revalidate its script.
  // This accelerates the self-destruct path so users heal within one session
  // instead of needing to manually clear their cache.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.update().catch(() => false)))
      .catch(() => false);
  }
  createRoot(document.getElementById("root")!).render(<App />);
  registerPushSW();
});

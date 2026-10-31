import { ReactNode, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { RuneDelveHUD } from "./RuneDelveHUD";
import { RuneDelveBoot } from "./RuneDelveBoot";
import { RouteWipe } from "./fx/RouteWipe";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import { NavLink, useLocation } from "react-router-dom";
import { Archive, BookOpen, Compass, Map as MapIcon, Shield, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import "./runeWorld.css";
import { useActiveQuests } from "@/hooks/useQuests";
import { RuneWorldScene } from "./RuneWorldScene";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import "./runeViewport.css";
import "./runeMenuMotion.css";
import { RuneRewardProvider } from "./RuneRewardReveal";
import { isRunePuzzleRoute } from "@/lib/runedelve/puzzles/routes";

function LegacyQuestSync() { useActiveQuests(); return null; }

/**
 * Full-screen game shell for Rune Delve. Applies the `.rd-mode` skin to the
 * entire viewport, mounts the in-game HUD, and plays the one-time boot
 * overlay on first entry into the module.
 *
 * The DH Club bottom nav and sidebar are hidden by AppLayout while any
 * `/rune-delve/*` route is active, so this shell owns the full viewport.
 */
export function RuneDelveLayout({ children }: { children: ReactNode }) {
  const { play } = useRuneDelveSfx();
  const { pathname } = useLocation();
  const puzzleRoute = isRunePuzzleRoute(pathname);
  const viewport = useRuneViewport();
  useEffect(() => {
    document.documentElement.classList.add("rd-viewport-active");
    document.body.classList.add("rd-viewport-active");
    return () => {
      document.documentElement.classList.remove("rd-viewport-active");
      document.body.classList.remove("rd-viewport-active");
    };
  }, []);
  const reducedMotion = useReducedMotion();
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.rdHidden = String(hidden);
    document.documentElement.dataset.rdMotion = reducedMotion
      ? "reduced"
      : "full";
    return () => {
      delete document.documentElement.dataset.rdHidden;
      delete document.documentElement.dataset.rdMotion;
    };
  }, [hidden, reducedMotion]);
  const isBattle =
    pathname.startsWith("/rune-delve/play/") ||
    pathname.startsWith("/rune-delve/chamber/") ||
    pathname === "/rune-delve/endless" ||
    pathname === "/rune-delve/expedition";

  // Global delegated tap/ripple/sound for any element opted-in via
  // `[data-rd-juice]` or `.rd-btn-juice`. Lets us add game-feel to every
  // existing button across all RD menus without touching each component.
  useEffect(() => {
    const root = document.querySelector(".rd-mode");
    if (!root) return;
    const rippleTimers = new Map<HTMLElement, number>();
    const pressedControls = new Set<HTMLElement>();
    const releasePresses = () => {
      for (const element of pressedControls) delete element.dataset.rdPress;
      pressedControls.clear();
    };
    const clearRipple = (element: HTMLElement) => {
      window.clearTimeout(rippleTimers.get(element));
      rippleTimers.delete(element);
      element.classList.remove("is-rippling");
    };
    const clearRipples = () => {
      for (const element of rippleTimers.keys()) clearRipple(element);
      releasePresses();
    };
    const onVisibility = () => {
      if (document.hidden) clearRipples();
    };
    const press = (
      target: HTMLElement | null,
      position?: { x: number; y: number },
    ) => {
      if (!target) return;
      const btn = target.closest(
        '.rd-btn-juice, .btn-press, button, [role="button"], a',
      ) as HTMLElement | null;
      if (
        !btn ||
        btn.getAttribute("aria-disabled") === "true" ||
        (btn as HTMLButtonElement).disabled
      )
        return;
      // Skip rune cells and FX overlays — they have their own audio.
      if (
        btn.closest("[data-rune-cell], [data-puzzle-cell]") ||
        btn.closest('[aria-hidden="true"]')
      )
        return;
      if (!reducedMotion && !document.hidden) {
        btn.dataset.rdPress = "true";
        pressedControls.add(btn);
      }
      // Apply ripple if the element has the juice class; otherwise just play sound.
      if (
        btn.classList.contains("rd-btn-juice") &&
        !reducedMotion &&
        !document.hidden
      ) {
        try {
          clearRipple(btn);
          const rect = btn.getBoundingClientRect();
          const x = position
            ? ((position.x - rect.left) / rect.width) * 100
            : 50;
          const y = position
            ? ((position.y - rect.top) / rect.height) * 100
            : 50;
          btn.style.setProperty("--rd-ripple-x", `${x}%`);
          btn.style.setProperty("--rd-ripple-y", `${y}%`);
          btn.classList.remove("is-rippling");
          void btn.offsetWidth;
          btn.classList.add("is-rippling");
          rippleTimers.set(
            btn,
            window.setTimeout(() => {
              clearRipple(btn);
              delete btn.dataset.rdPress;
              pressedControls.delete(btn);
            }, 520),
          );
        } catch {
          /* noop */
        }
      }
      play("ui.tap", { skipHaptic: true });
    };
    const onDown = (event: PointerEvent) => {
      press(event.target as HTMLElement | null, {
        x: event.clientX,
        y: event.clientY,
      });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return;
      const target = event.target as HTMLElement | null;
      if (
        event.key === "Enter" ||
        (event.key === " " && target?.closest('button, [role="button"]'))
      )
        press(target);
    };
    root.addEventListener("pointerdown", onDown as EventListener, {
      passive: true,
    });
    root.addEventListener("keydown", onKey as EventListener);
    window.addEventListener("pointerup", releasePresses);
    window.addEventListener("pointercancel", releasePresses);
    window.addEventListener("keyup", releasePresses);
    window.addEventListener("blur", clearRipples);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      root.removeEventListener("pointerdown", onDown as EventListener);
      root.removeEventListener("keydown", onKey as EventListener);
      window.removeEventListener("pointerup", releasePresses);
      window.removeEventListener("pointercancel", releasePresses);
      window.removeEventListener("keyup", releasePresses);
      window.removeEventListener("blur", clearRipples);
      document.removeEventListener("visibilitychange", onVisibility);
      clearRipples();
    };
  }, [play, reducedMotion]);

  return (
    <div
      className="rd-mode rd-shell rd-viewport relative"
      style={
        {
          "--rd-viewport-height": `${viewport.height}px`,
        } as React.CSSProperties
      }
      data-document-hidden={String(hidden)}
      data-rd-motion={reducedMotion ? "reduced" : "full"}
    >
      {/* Decorative ambient motes — non-interactive. */}
      {!puzzleRoute && <LegacyQuestSync />}
      <RuneWorldScene />

      <RuneDelveHUD />

      <RuneRewardProvider>
        <main
          className={cn(
            "rd-main mx-auto",
            isBattle && "is-battle",
            pathname === "/rune-delve" && "is-home",
          )}
        >
          {children}
        </main>
      </RuneRewardProvider>

      {!isBattle && (
        <nav className="rd-game-nav" aria-label="Rune Delve navigation">
          <div>
            <NavLink end to={puzzleRoute ? "/rune-delve" : "/rune-delve/legacy"}>
              <Compass />
              {puzzleRoute ? "Sanctum" : "Archive"}
            </NavLink>
            <NavLink to={puzzleRoute ? "/rune-delve/journey" : "/rune-delve/levels"}>
              <MapIcon />
              {puzzleRoute ? "Journey" : "Campaign"}
            </NavLink>
            <NavLink to={puzzleRoute ? "/rune-delve/guide" : "/rune-delve/hero"}>
              {puzzleRoute ? <BookOpen /> : <UserRound />}
              {puzzleRoute ? "Guide" : "Hero"}
            </NavLink>
            <NavLink to={puzzleRoute ? "/rune-delve/legacy" : "/rune-delve/armory"}>
              {puzzleRoute ? <Archive /> : <Shield />}
              {puzzleRoute ? "Archive" : "Armory"}
            </NavLink>
          </div>
        </nav>
      )}

      <RouteWipe />
      <RuneDelveBoot />
    </div>
  );
}

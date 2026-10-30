import { ReactNode, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { RuneDelveHUD } from "./RuneDelveHUD";
import { RuneDelveBoot } from "./RuneDelveBoot";
import { RouteWipe } from "./fx/RouteWipe";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import { NavLink, useLocation } from "react-router-dom";
import { Compass, Map as MapIcon, Shield, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import "./runeWorld.css";
import { useActiveQuests } from "@/hooks/useQuests";
import { RuneWorldScene } from "./RuneWorldScene";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import "./runeViewport.css";

/**
 * Full-screen game shell for Rune Delve. Applies the `.rd-mode` skin to the
 * entire viewport, mounts the in-game HUD, and plays the one-time boot
 * overlay on first entry into the module.
 *
 * The DH Club bottom nav and sidebar are hidden by AppLayout while any
 * `/rune-delve/*` route is active, so this shell owns the full viewport.
 */
export function RuneDelveLayout({ children }: { children: ReactNode }) {
  useActiveQuests();
  const { play } = useRuneDelveSfx();
  const { pathname } = useLocation();
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
    return () => {
      delete document.documentElement.dataset.rdHidden;
    };
  }, [hidden]);
  const isBattle =
    pathname.startsWith("/rune-delve/play/") ||
    pathname === "/rune-delve/endless" ||
    pathname === "/rune-delve/expedition";

  // Global delegated tap/ripple/sound for any element opted-in via
  // `[data-rd-juice]` or `.rd-btn-juice`. Lets us add game-feel to every
  // existing button across all RD menus without touching each component.
  useEffect(() => {
    const root = document.querySelector(".rd-mode");
    if (!root) return;
    const rippleTimers = new Map<HTMLElement, number>();
    const clearRipple = (element: HTMLElement) => {
      window.clearTimeout(rippleTimers.get(element));
      rippleTimers.delete(element);
      element.classList.remove("is-rippling");
    };
    const clearRipples = () => {
      for (const element of rippleTimers.keys()) clearRipple(element);
    };
    const onVisibility = () => {
      if (document.hidden) clearRipples();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
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
        btn.closest("[data-rune-cell]") ||
        btn.closest('[aria-hidden="true"]')
      )
        return;
      // Apply ripple if the element has the juice class; otherwise just play sound.
      if (
        btn.classList.contains("rd-btn-juice") &&
        !reducedMotion &&
        !document.hidden
      ) {
        try {
          clearRipple(btn);
          const rect = btn.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          btn.style.setProperty("--rd-ripple-x", `${x}%`);
          btn.style.setProperty("--rd-ripple-y", `${y}%`);
          btn.classList.remove("is-rippling");
          void btn.offsetWidth;
          btn.classList.add("is-rippling");
          rippleTimers.set(
            btn,
            window.setTimeout(() => clearRipple(btn), 520),
          );
        } catch {
          /* noop */
        }
      }
      play("ui.tap", { skipHaptic: true });
    };
    root.addEventListener("pointerdown", onDown as EventListener, {
      passive: true,
    });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      root.removeEventListener("pointerdown", onDown as EventListener);
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
      <RuneWorldScene />

      <RuneDelveHUD />

      <main
        className={cn(
          "rd-main mx-auto",
          isBattle && "is-battle",
          pathname === "/rune-delve" && "is-home",
        )}
      >
        {children}
      </main>

      {!isBattle && (
        <nav className="rd-game-nav" aria-label="Rune Delve navigation">
          <div>
            <NavLink end to="/rune-delve">
              <Compass />
              Sanctum
            </NavLink>
            <NavLink to="/rune-delve/levels">
              <MapIcon />
              Campaign
            </NavLink>
            <NavLink to="/rune-delve/hero">
              <UserRound />
              Hero
            </NavLink>
            <NavLink to="/rune-delve/armory">
              <Shield />
              Armory
            </NavLink>
          </div>
        </nav>
      )}

      <RouteWipe />
      <RuneDelveBoot />
    </div>
  );
}

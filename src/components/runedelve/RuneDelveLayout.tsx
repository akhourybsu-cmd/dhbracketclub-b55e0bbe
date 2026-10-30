import { ReactNode, useEffect } from "react";
import { RuneDelveHUD } from "./RuneDelveHUD";
import { RuneDelveBoot } from "./RuneDelveBoot";
import { RouteWipe } from "./fx/RouteWipe";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import { NavLink, useLocation } from "react-router-dom";
import { Compass, Map, Shield, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import "./runeWorld.css";

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
      if (btn.classList.contains("rd-btn-juice")) {
        try {
          const rect = btn.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          btn.style.setProperty("--rd-ripple-x", `${x}%`);
          btn.style.setProperty("--rd-ripple-y", `${y}%`);
          btn.classList.remove("is-rippling");
          void btn.offsetWidth;
          btn.classList.add("is-rippling");
          window.setTimeout(() => btn.classList.remove("is-rippling"), 520);
        } catch {
          /* noop */
        }
      }
      play("ui.tap", { skipHaptic: true });
    };
    root.addEventListener("pointerdown", onDown as EventListener, {
      passive: true,
    });
    return () =>
      root.removeEventListener("pointerdown", onDown as EventListener);
  }, [play]);

  return (
    <div className="rd-mode rd-shell relative min-h-[100dvh]">
      {/* Decorative ambient motes — non-interactive. */}
      <span
        className="rd-mote"
        aria-hidden
        style={{ top: "60px", left: "6px" }}
      />
      <span
        className="rd-mote rd-mote-2"
        aria-hidden
        style={{ top: "70px", right: "6px" }}
      />

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
              <Map />
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

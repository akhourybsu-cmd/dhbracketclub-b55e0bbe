import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Crosshair,
  FlaskConical,
  Hexagon,
  Home,
  Orbit,
  Trophy,
} from "lucide-react";
import { useNexusCore } from "@/hooks/useNexusCore";
import "./core.css";
import "./progression.css";
import "./menus.css";

export function CoreShell({ children }: { children: ReactNode }) {
  const { profile } = useNexusCore();
  const { pathname, key: menuKey } = useLocation();
  const content = useRef<HTMLElement>(null);
  const battle = pathname.startsWith("/nexus/battle/");
  const home = pathname === "/nexus";
  useEffect(() => {
    content.current?.scrollTo({ top: 0, left: 0 });
  }, [menuKey]);
  useEffect(() => {
    if (battle) return;
    document.documentElement.classList.add("nc-menu-active");
    document.body.classList.add("nc-menu-active");
    return () => {
      document.documentElement.classList.remove("nc-menu-active");
      document.body.classList.remove("nc-menu-active");
    };
  }, [battle]);
  if (battle) return <div className="nx-mode nc-shell">{children}</div>;
  const nav = [
    { to: "/nexus", label: "Home", icon: Home, active: home },
    {
      to: "/nexus/loadout/endless",
      label: "Loadout",
      icon: Crosshair,
      active: pathname.includes("/loadout/"),
    },
    {
      to: "/nexus/research",
      label: "Lab",
      icon: FlaskConical,
      active: pathname === "/nexus/research",
    },
    {
      to: "/nexus/leaderboard",
      label: "Records",
      icon: Trophy,
      active: pathname === "/nexus/leaderboard",
    },
  ];
  return createPortal(
    <div
      className={`nx-mode nc-shell nc-game-shell ${home ? "nc-title-shell" : pathname.includes("/loadout/") ? "nc-loadout-menu" : pathname.includes("/results/") ? "nc-result-menu" : ""}`}
    >
      <header className="nc-game-header">
        <Link
          to={home ? "/compete" : "/nexus"}
          className="nc-icon-button"
          aria-label={home ? "Exit Nexus" : "Back to title"}
        >
          <ArrowLeft size={19} />
        </Link>
        <Link to="/nexus" className="nc-game-brand">
          <Hexagon size={19} />
          <span>NEXUS</span>
        </Link>
        <Link
          to="/nexus/codex"
          className="nc-icon-button"
          aria-label="Field guide"
        >
          <BookOpen size={18} />
        </Link>
        <Link
          to="/nexus/research"
          className="nc-game-wallet"
          aria-label={`${profile?.credits ?? 0} credits. Open armory.`}
        >
          <Orbit size={15} />
          {profile?.credits.toLocaleString() ?? "—"}
        </Link>
      </header>
      <main
        className="nc-menu-content"
        ref={content}
        key={pathname}
        aria-label={home ? "Nexus title screen" : "Nexus game menu"}
      >
        {children}
      </main>
      {!home && (
        <nav className="nc-game-nav" aria-label="Nexus navigation">
          {nav.map(({ to, label, icon: Icon, active }) => (
            <Link key={to} to={to} aria-current={active ? "page" : undefined}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>,
    document.body,
  );
}

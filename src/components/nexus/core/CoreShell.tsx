import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, BookOpen, Hexagon, Orbit } from "lucide-react";
import { useNexusCore } from "@/hooks/useNexusCore";
import "./core.css";
import "./progression.css";

export function CoreShell({ children }: { children: ReactNode }) {
  const { profile } = useNexusCore();
  const { pathname } = useLocation();
  const battle = pathname.startsWith("/nexus/battle/");
  return (
    <div className="nx-mode nc-shell min-h-[100dvh]">
      {!battle && (
        <header className="nc-header">
          <Link
            to="/compete"
            className="nc-header-link"
            aria-label="Return to Compete"
          >
            <ArrowLeft size={18} />
          </Link>
          <Link to="/nexus" className="nc-brand">
            <span className="nc-brand-icon">
              <Hexagon size={22} />
            </span>
            <div>
              <strong>Nexus Defense</strong>
              <small>Endless / Arsenal</small>
            </div>
          </Link>
          <Link
            to="/nexus/codex"
            className="nc-header-link"
            aria-label="Field guide"
          >
            <BookOpen size={17} />
            <span>Field guide</span>
          </Link>
          <Link
            to="/nexus/research"
            className="nc-wallet"
            aria-label={`${profile?.credits ?? 0} credits. Open armory.`}
          >
            <Orbit size={14} />
            {profile?.credits.toLocaleString() ?? "—"}
          </Link>
        </header>
      )}
      {battle ? children : <main className="nc-main">{children}</main>}
    </div>
  );
}

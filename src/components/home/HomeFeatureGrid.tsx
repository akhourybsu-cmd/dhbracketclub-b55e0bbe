import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bookmark,
  Flame,
  Plus,
  Shield,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import type { HomeSignals } from "@/lib/home/signals";
import {
  portfolioHistory,
  portfolioReturn,
  homeRelativeTime,
} from "@/lib/home/signals";
import { homeShortcut, type HomeUpdate } from "@/lib/home/mobileHome";
import { kindMeta } from "@/lib/dailyFind";
import nexusEmblem from "@/assets/nexus-emblem.png";
import runeEmblem from "@/assets/runedelve-emblem.png";

export function HomeFeatureGrid({
  installed,
  signals,
  updates,
}: {
  installed: Set<string>;
  signals?: HomeSignals;
  updates: HomeUpdate[];
}) {
  const prioritized = [
    "daily-find",
    "portfolio-wars",
    "nexus-defense",
    "workout-competition",
    "draft-arena",
    "rune-delve",
    "readshift",
    "narrative-rpg",
    "nfl-pickem",
  ];
  const slugs = prioritized.filter((s) => installed.has(s)).slice(0, 4);
  if (!slugs.length) return null;
  const drop = signals?.drop.data?.[0],
    portfolio = signals?.portfolio.data,
    change = portfolioReturn(portfolio);
  const chart = portfolio ? portfolioHistory(portfolio.history) : null;
  const best = signals?.nexus.data?.endless_best,
    session = signals?.forge.data;
  const validDate =
    portfolio?.valued_at && Number.isFinite(Date.parse(portfolio.valued_at));
  return (
    <section className="home-focus-section" aria-label="In focus">
      <div className="home-section-heading">
        <div>
          <span className="home-eyebrow">YOUR WORLDS</span>
          <h2>In focus</h2>
        </div>
        <Link to="/compete" className="home-text-link">
          Explore
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="home-focus-grid">
        {slugs.map((slug) => {
          if (slug === "daily-find")
            return (
              <article
                key={slug}
                className="home-feature-card home-panel"
                data-feature="drop"
              >
                <div className="home-feature-heading">
                  <span>
                    <Bookmark size={16} />
                    THE DROP
                  </span>
                  <Link
                    to="/finds?compose=1"
                    className="home-small-icon"
                    aria-label="Add a Drop"
                  >
                    <Plus size={18} />
                  </Link>
                </div>
                <Link
                  to={drop ? `/finds/${encodeURIComponent(drop.id)}` : "/finds"}
                  className="home-feature-content"
                >
                  <span className="home-feature-caption">
                    {drop ? "Fresh from your club" : "Something worth sharing"}
                  </span>
                  <strong className="home-drop-title">
                    {drop?.title || "A good find starts a conversation."}
                  </strong>
                  <span className="home-feature-detail">
                    {drop
                      ? `${kindMeta(drop.kind).label} · ${drop.profiles?.display_name || "Club member"}`
                      : signals?.drop.error
                        ? "Open The Drop to catch up"
                        : "Share what you read, saw or learned."}
                  </span>
                  <span className="home-feature-footer">
                    {drop
                      ? homeRelativeTime(drop.created_at)
                      : "Discover The Drop"}
                    <ArrowRight size={15} />
                  </span>
                </Link>
              </article>
            );
          if (slug === "portfolio-wars")
            return (
              <article
                key={slug}
                className="home-feature-card home-panel"
                data-feature="portfolio"
              >
                <div className="home-feature-heading">
                  <span>
                    <TrendingUp size={16} />
                    PORTFOLIO WARS
                  </span>
                  <small>Game dollars</small>
                </div>
                <Link to="/portfolio-wars" className="home-feature-content">
                  <span className="home-feature-caption">
                    {change !== null
                      ? "Recorded portfolio value"
                      : "Your next market move"}
                  </span>
                  <strong className="home-feature-number">
                    {change !== null
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(Number(portfolio.total_value))
                      : "Build your book"}
                  </strong>
                  <div className="home-portfolio-trend">
                    <span
                      data-trend={
                        change === null
                          ? "neutral"
                          : change >= 0
                            ? "up"
                            : "down"
                      }
                    >
                      {change !== null
                        ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}% this season`
                        : signals?.portfolio.error
                          ? "Open your portfolio to refresh"
                          : "Find an edge. Follow your progress."}
                    </span>
                    {chart && (
                      <svg
                        viewBox="0 0 132 32"
                        role="img"
                        aria-label={`Last ${portfolio.history.length} recorded portfolio values`}
                      >
                        <polyline points={chart} />
                      </svg>
                    )}
                  </div>
                  <span className="home-feature-footer">
                    {validDate
                      ? `As of ${format(new Date(portfolio.valued_at), "MMM d, h:mm a")}`
                      : "Open portfolio"}
                    <ArrowRight size={15} />
                  </span>
                </Link>
              </article>
            );
          if (slug === "nexus-defense")
            return (
              <article
                key={slug}
                className="home-feature-card home-panel"
                data-feature="nexus"
              >
                <div className="home-feature-heading">
                  <span>
                    <Shield size={16} />
                    NEXUS DEFENSE
                  </span>
                  {signals?.checkpoint && (
                    <small className="home-saved-label">SAVED RUN</small>
                  )}
                </div>
                <Link
                  to={signals?.checkpoint ? "/nexus/battle/endless" : "/nexus"}
                  className="home-feature-content"
                >
                  <img
                    src={nexusEmblem}
                    alt=""
                    aria-hidden="true"
                    className="home-game-emblem"
                    loading="lazy"
                  />
                  <span className="home-feature-caption">
                    {signals?.checkpoint
                      ? "Ready when you are"
                      : "Your strongest defense"}
                  </span>
                  <strong className="home-feature-number">
                    {signals?.checkpoint
                      ? signals.checkpoint.waveLabel
                      : best > 0
                        ? `Wave ${best}`
                        : "Hold the line"}
                  </strong>
                  <span className="home-feature-detail">
                    {signals?.checkpoint
                      ? "Your defense is saved on this device."
                      : best > 0
                        ? "Your personal endless best."
                        : "One core. Endless possibilities."}
                  </span>
                  <span className="home-feature-footer">
                    {signals?.checkpoint ? "Resume defense" : "Enter Nexus"}
                    <ArrowRight size={15} />
                  </span>
                </Link>
              </article>
            );
          if (slug === "workout-competition")
            return (
              <article
                key={slug}
                className="home-feature-card home-panel"
                data-feature="forge"
              >
                <div className="home-feature-heading">
                  <span>
                    <Flame size={16} />
                    FORGE
                  </span>
                  {session && (
                    <small className="home-saved-label">IN PROGRESS</small>
                  )}
                </div>
                <Link to="/workouts/log" className="home-feature-content">
                  <span className="home-feature-caption">
                    {session
                      ? "Pick up where you left off"
                      : "Build a little momentum"}
                  </span>
                  <strong className="home-feature-title">
                    {session?.title || "Your next workout starts here."}
                  </strong>
                  <span className="home-feature-detail">
                    {session
                      ? "Your workout session is saved."
                      : "Log your movement. Grow your DH legacy."}
                  </span>
                  <span className="home-feature-footer">
                    {session ? "Resume workout" : "Log a workout"}
                    <ArrowRight size={15} />
                  </span>
                </Link>
              </article>
            );
          const meta = homeShortcut(slug),
            active = updates.find(
              (u) =>
                u.section === "playing" &&
                u.to.startsWith(meta?.path || "NONE"),
            );
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <article
              key={slug}
              className="home-feature-card home-panel"
              data-feature="other"
            >
              <div className="home-feature-heading">
                <span>
                  <Icon size={16} />
                  {meta.label}
                </span>
              </div>
              <Link
                to={active?.to || meta.path}
                className="home-feature-content"
              >
                {slug === "rune-delve" && (
                  <img
                    src={runeEmblem}
                    className="home-game-emblem"
                    loading="lazy"
                    alt=""
                    aria-hidden="true"
                  />
                )}
                <span className="home-feature-caption">
                  {active ? "In progress" : "A little friendly competition"}
                </span>
                <strong className="home-feature-title">
                  {active?.title || `Jump into ${meta.label}`}
                </strong>
                <span className="home-feature-detail">
                  {active?.detail || "Your next chapter is waiting."}
                </span>
                <span className="home-feature-footer">
                  {active ? "Continue" : "Explore"}
                  <ArrowRight size={15} />
                </span>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

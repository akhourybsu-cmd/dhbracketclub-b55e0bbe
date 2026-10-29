// Production home/header/inbox components, with an in-memory notification backend.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Bookmark,
  CalendarDays,
  Home,
  MessageSquare,
  Newspaper,
  Trophy,
  LayoutGrid,
} from "lucide-react";
import { MobileHome } from "../../src/components/home/MobileHome";
import { MobileAppHeader } from "../../src/components/mobile/MobileAppHeader";
import { NotificationBell } from "../../src/components/NotificationBell";
import NotificationsPage from "../../src/pages/NotificationsPage";
import { useQuickBar } from "../../src/components/home/useQuickBar";
import { useMediaQuery } from "../../src/hooks/useMediaQuery";
import type { InstalledAsset } from "../../src/types/assets";
import type { HomeSignals } from "../../src/lib/home/signals";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "../../src/index.css";

const assets = [
  "chat",
  "draft-arena",
  "nfl-pickem",
  "events",
  "feed",
  "rune-delve",
  "daily-find",
  "portfolio-wars",
  "nexus-defense",
  "workout-competition",
].map((slug, index) => ({
  id: slug,
  sort_order: index,
  asset: { slug, name: slug },
})) as InstalledAsset[];
const slugs = new Set(assets.map((item) => item.asset.slug));
const now = Date.now();
const signals: HomeSignals = {
  progress: {
    loading: false,
    error: false,
    data: {
      score: 1240,
      unlocked: 34,
      club_rank: 2,
      goals: [
        {
          key: "drop_posts",
          title: "Make the Drop",
          category: "drop",
          unit: "count",
          value: 19,
          target: 20,
          tier: 3,
          points: 40,
          progress: 14 / 15,
          tracked: true,
        },
      ],
    },
  },
  drop: {
    loading: false,
    error: false,
    data: [
      {
        id: "drop-demo",
        title: "Saturday plans, sorted.",
        kind: "article",
        created_at: new Date(now - 1800000).toISOString(),
        profiles: { display_name: "Jordan" },
      },
    ],
  },
  portfolio: {
    loading: false,
    error: false,
    data: {
      total_value: 58250,
      valued_at: new Date(now - 1800000).toISOString(),
      season: { starting_cash: 50000, status: "active" },
      history: [50000, 51500, 50900, 54300, 55100, 57400, 58250].map(
        (value, n) => ({ value, trading_date: `2026-10-${20 + n}` }),
      ),
    },
  },
  nexus: { loading: false, error: false, data: { endless_best: 18 } },
  forge: {
    loading: false,
    error: false,
    data: { id: "session", title: "Push day" },
  },
  checkpoint: { missionName: "Endless Defense", waveLabel: "Wave 12" },
};
function HomeFixture() {
  const shortcuts = useQuickBar(assets);
  return (
    <MobileHome
      displayName="Alex"
      clubName="DH Bracket Club"
      installedSlugs={slugs}
      shortcuts={shortcuts}
      signals={signals}
      onRefresh={() => {}}
      actions={[
        {
          id: "turn",
          label: "You’re on the clock",
          sub: "All-time movie villains · Round 3",
          to: "/drafts/demo",
          icon: Bookmark,
          priority: 100,
          accent: "primary",
          assetSlug: "draft-arena",
        },
        {
          id: "chat",
          label: "Catch up with your crew",
          sub: "3 conversations have new messages",
          to: "/chat",
          icon: MessageSquare,
          priority: 70,
          accent: "primary",
          assetSlug: "chat",
        },
      ]}
      updates={[
        {
          id: "one",
          section: "latest",
          title: "Jordan started a discussion",
          detail: "Thursday night football: who are we taking?",
          label: "Discussion",
          at: new Date(now - 900_000).toISOString(),
          to: "/posts/demo",
          icon: Newspaper,
        },
        {
          id: "two",
          section: "latest",
          title: "Morgan finished a draft",
          detail: "The greatest movie villains of all time",
          label: "Draft Arena",
          at: new Date(now - 3600_000).toISOString(),
          to: "/drafts/demo",
          icon: Bookmark,
        },
        {
          id: "three",
          section: "latest",
          title: "Sam added an event",
          detail: "Sunday watch party",
          label: "Event",
          at: new Date(now - 7200_000).toISOString(),
          to: "/events/demo",
          icon: CalendarDays,
        },
        {
          id: "event",
          section: "upcoming",
          title: "Sunday watch party",
          label: "Event",
          at: new Date(now + 3 * 86400_000).toISOString(),
          to: "/events/demo",
          icon: CalendarDays,
        },
        {
          id: "draft",
          section: "playing",
          title: "All-time movie villains",
          label: "Draft in progress",
          to: "/drafts/demo",
          icon: Bookmark,
        },
      ]}
    >
      <details className="rounded-2xl border border-border/70 bg-card px-4">
        <summary className="min-h-14 flex items-center text-sm font-semibold">
          Your season & stories
        </summary>
        <p className="pb-4 text-sm text-muted-foreground">Season overview</p>
      </details>
    </MobileHome>
  );
}
function App() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {desktop ? (
        <aside
          style={{ zIndex: 40 }}
          className="fixed left-0 top-0 flex h-full w-64 items-start gap-2 border-r border-border bg-card p-4"
        >
          <p className="flex-1 pt-3 text-sm font-bold">DH Bracket Club</p>
          <NotificationBell />
        </aside>
      ) : (
        <MobileAppHeader
          title="DH Bracket Club with an extra-long club name"
          onOpenMenu={() => {}}
        />
      )}
      <main
        style={desktop ? { marginLeft: 256 } : undefined}
        className={desktop ? "p-6" : "mx-auto max-w-[640px] px-4 pb-24 pt-4"}
      >
        <Routes>
          <Route path="/" element={<HomeFixture />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="*"
            element={
              <div>
                <h1>Destination reached</h1>
                <Link to="/">Home</Link>
              </div>
            }
          />
        </Routes>
      </main>
      {!desktop && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 flex h-16 items-center justify-around border-t border-border bg-background/95"
        >
          {[
            { to: "/", label: "Home", icon: Home },
            { to: "/chat", label: "Chat", icon: MessageSquare },
            { to: "/compete", label: "Compete", icon: Trophy },
            { to: "/feed", label: "Feed", icon: Newspaper },
            { to: "/apps", label: "Apps", icon: LayoutGrid },
          ].map((item) => (
            <Link
              to={item.to}
              key={item.to}
              className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })}
  >
    <MemoryRouter>
      <App />
    </MemoryRouter>
  </QueryClientProvider>,
);

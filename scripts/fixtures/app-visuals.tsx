/* eslint-disable react-refresh/only-export-components -- Isolated browser fixture entry. */
// Production member pages and shell. Only identity/transport are fixture-owned.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppLayout } from "../../src/components/AppLayout";
import CompetePage from "../../src/pages/CompetePage";
import ClubPage from "../../src/pages/ClubPage";
import EventsPage from "../../src/pages/EventsPage";
import PostsPage from "../../src/pages/PostsPage";
import PollsListPage from "../../src/pages/PollsListPage";
import RankingsListPage from "../../src/pages/RankingsListPage";
import LorePage from "../../src/pages/LorePage";
import NotificationsPage from "../../src/pages/NotificationsPage";
import LandingPage from "../../src/pages/LandingPage";
import AuthPage from "../../src/pages/AuthPage";
import ResetPasswordPage from "../../src/pages/ResetPasswordPage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../src/components/ui/dialog";
import { qa } from "./drop-backend";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "../../src/index.css";

const now = Date.now();
const date = new Date(now).toISOString();
const profile = { display_name: "Jordan", avatar_url: null };
qa.tables.events = [
  {
    id: "visual-event",
    title: "Sunday watch party",
    description: "A little time with the club.",
    starts_at: new Date(now + 3 * 86400000).toISOString(),
    ends_at: new Date(now + 3 * 86400000 + 7200000).toISOString(),
    location: "The clubhouse",
    event_type: "social",
    created_by: "jordan",
    created_at: date,
    profiles: profile,
  },
];
qa.tables.posts = [
  {
    id: "visual-post",
    user_id: "jordan",
    title: "What should we play next?",
    content:
      "Share your next club challenge. There is always room for another good idea.",
    is_pinned: true,
    created_at: date,
    profiles: profile,
  },
];
qa.tables.post_comments = [
  {
    id: "visual-reply",
    post_id: "visual-post",
    user_id: "member",
    body: "Count me in.",
    created_at: date,
  },
];
qa.tables.polls = [
  {
    id: "visual-poll",
    title: "Pick our next club night",
    description: "One small decision. A good night together.",
    question: "What should we do next?",
    created_by: "jordan",
    created_at: date,
    status: "open",
    closes_at: null,
    competitions: null,
    profiles: profile,
  },
];
qa.tables.poll_votes = [];
qa.tables.rankings = [
  {
    id: "visual-ranking",
    title: "The all-time favorites",
    description: "Make your picks and compare with the club.",
    created_by: "jordan",
    created_at: date,
    ranking_type: "ordered",
    status: "open",
    competitions: null,
    profiles: profile,
  },
];
qa.tables.ranking_submissions = [];
qa.tables.lore_entries = [
  {
    id: "visual-lore",
    created_by: "jordan",
    type: "moment",
    title: "The comeback everyone remembers",
    context: "Three rounds down. One final pick. A club classic.",
    people_involved: [],
    tags: ["club-classic"],
    image_url: null,
    era: "This season",
    status: "approved",
    source_message_id: null,
    created_at: date,
    updated_at: date,
    profiles: profile,
    reactions: [],
    contributions: [{ count: 0 }],
  },
];
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
Object.assign(window, { appVisualQueryClient: client });
function CurrentRoute() {
  const location = useLocation();
  return <span hidden data-qa-route={location.pathname + location.search} />;
}
function UnmountedDestination() {
  const location = useLocation();
  return (
    <div data-qa-unmounted-destination>
      <h1>Linked destination</h1>
      <p>{location.pathname}</p>
    </div>
  );
}
function SharedDialogFixture() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-8 border-t pt-6" data-qa-shared-layers>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="min-h-11 rounded-xl border px-4">
            Open long dialog
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>A longer shared dialog</DialogTitle>
            <DialogDescription>
              The default app dialog should keep its content and actions
              reachable.
            </DialogDescription>
          </DialogHeader>
          {Array.from({ length: 24 }, (_, index) => (
            <p key={index}>
              Visual layer {index + 1}. This is intentionally long content for
              checking the shared dialog frame, scrolling, close target and
              keyboard focus.
            </p>
          ))}
          <button
            className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground"
            onClick={() => setOpen(false)}
          >
            Complete visual check
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
const params = new URLSearchParams(location.search);
const initialRoute = params.get("route") || "/compete";
const publicRoute = ["/", "/auth", "/reset-password"].includes(initialRoute);
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" forcedTheme={params.get("theme") || "dark"}>
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <CurrentRoute />
        {publicRoute ? (
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Routes>
        ) : (
          <AppLayout>
            <Routes>
              <Route path="/compete" element={<CompetePage />} />
              <Route
                path="/club"
                element={
                  <>
                    <ClubPage />
                    {params.get("layers") === "1" && <SharedDialogFixture />}
                  </>
                }
              />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/posts" element={<PostsPage />} />
              <Route path="/polls" element={<PollsListPage />} />
              <Route path="/rankings" element={<RankingsListPage />} />
              <Route path="/lore" element={<LorePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="*" element={<UnmountedDestination />} />
            </Routes>
          </AppLayout>
        )}
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  </ThemeProvider>,
);

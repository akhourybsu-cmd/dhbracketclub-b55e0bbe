import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      const dom = { ...props };
      for (const key of ["initial", "animate", "exit", "transition"]) delete dom[key];
      return <div {...dom}>{children}</div>;
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "fixture-member" } }),
}));
vi.mock("@/hooks/useSoundEffect", () => ({
  useSoundEffect: () => ({ play: vi.fn() }),
}));
vi.mock("@/hooks/useRealtimeSubscription", () => ({
  useActivityFeedUpdates: () => {},
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        in: () => query,
        then: (resolve: (value: { data: []; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return query;
    },
  },
}));
import FeedPage from "@/pages/FeedPage";
import PostsPage from "@/pages/PostsPage";

function Location() {
  return <output data-testid="route">{useLocation().pathname}</output>;
}
function setup(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Location />
      <Routes>
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/posts/create" element={<PostsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
afterEach(cleanup);
describe("connected discussion entry", () => {
  it("opens the real composer from the activity feed Post link", async () => {
    setup("/feed");
    fireEvent.click(screen.getByRole("link", { name: "Post" }));
    expect(
      await screen.findByRole("textbox", { name: "Discussion title" }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Discussion message" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Post Discussion" }),
    ).toBeDisabled();
    expect(screen.getByTestId("route")).toHaveTextContent("/posts/create");
  });
  it("opens a direct create URL and returns to Discussions when dismissed", async () => {
    setup("/posts/create");
    expect(
      screen.getByRole("textbox", { name: "Discussion title" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Close new discussion" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "Discussion title" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("route")).toHaveTextContent("/posts");
    fireEvent.click(screen.getAllByRole("button", { name: "New Post" })[0]);
    expect(
      await screen.findByRole("textbox", { name: "Discussion title" }),
    ).toBeVisible();
  });
});

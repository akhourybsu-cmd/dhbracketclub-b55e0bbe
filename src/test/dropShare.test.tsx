import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
  navigate: vi.fn(),
  success: vi.fn(),
  installed: true,
  failChannels: false,
  insertCalls: [] as Record<string, unknown>[],
  insertAttempt: 0,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "member" } }),
}));
vi.mock("@/contexts/ClubContext", () => ({
  useClub: () => ({ club: { id: "club" }, isClubAdmin: false }),
}));
vi.mock("@/hooks/useClubAssets", () => ({
  useClubAssets: () => ({ isInstalled: () => mocks.installed }),
}));
vi.mock("@/components/dailyFind/useDropSheetViewport", () => ({
  useDropSheetViewport: () => {},
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("sonner", () => ({ toast: { success: mocks.success } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, functions: { invoke: mocks.invoke } },
}));
vi.mock("@/components/chat/ChatBottomSheet", () => ({
  ChatBottomSheet: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        {children}
      </section>
    ) : null,
}));
import { FindShareSheet } from "@/components/dailyFind/FindShareSheet";
import type { DailyFind } from "@/lib/dailyFind";
const find: DailyFind = {
  id: "00000000-0000-4000-8000-000000000001",
  club_id: "club",
  user_id: "member",
  find_date: "2026-10-30",
  kind: "learned",
  title: "A good find",
  note: null,
  url: null,
  image_path: null,
  tags: [],
  created_at: "2026-10-30T00:00:00Z",
  updated_at: "2026-10-30T00:00:00Z",
};
beforeEach(() => {
  mocks.installed = true;
  mocks.failChannels = false;
  mocks.insertCalls = [];
  mocks.insertAttempt = 0;
  mocks.navigate.mockReset();
  mocks.success.mockReset();
  mocks.invoke.mockReset().mockResolvedValue({});
  mocks.from.mockReset().mockImplementation((table: string) => {
    let body: Record<string, unknown> | null = null;
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        filters[key] = value;
        return query;
      },
      order: () => query,
      insert: (value: Record<string, unknown>) => {
        body = value;
        return query;
      },
      single: () => query,
      maybeSingle: () => query,
      then: (
        resolve: (value: unknown) => void,
        reject: (error: unknown) => void,
      ) => {
        let result: unknown;
        if (table === "channels")
          result = mocks.failChannels
            ? { data: null, error: { message: "Offline" } }
            : {
                data: [
                  {
                    id: "general",
                    club_id: "club",
                    name: "general",
                    channel_type: "general",
                    post_permission: "all",
                    is_default: true,
                  },
                  {
                    id: "private",
                    club_id: "club",
                    name: "admin",
                    channel_type: "admin_only",
                    post_permission: "all",
                  },
                  {
                    id: "announcements",
                    club_id: "club",
                    name: "announcements",
                    channel_type: "announcements",
                    post_permission: "admins",
                  },
                  {
                    id: "archived",
                    club_id: "club",
                    name: "old",
                    channel_type: "general",
                    post_permission: "all",
                    archived_at: "2026-10-01",
                  },
                ].filter((row) => row.club_id === filters.club_id),
                error: null,
              };
        else if (body) {
          mocks.insertCalls.push(body);
          mocks.insertAttempt++;
          result =
            mocks.insertAttempt === 1
              ? {
                  data: null,
                  error: { code: "network", message: "Lost acknowledgement" },
                }
              : {
                  data: null,
                  error: { code: "23505", message: "Already sent" },
                };
        } else
          result = {
            data: {
              id: filters.id,
              channel_id: "general",
              user_id: "member",
              content: "shared",
            },
            error: null,
          };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Drop sharing", () => {
  it("offers one postable active-club channel and safely confirms a retry", async () => {
    render(<FindShareSheet open onOpenChange={vi.fn()} find={find} />);
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Drop chat channel" }),
      ).toHaveValue("general"),
    );
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Send to Chat" }));
    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Couldn’t send to Chat",
    );
    fireEvent.click(screen.getByRole("button", { name: "Send to Chat" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledOnce());
    expect(mocks.insertCalls).toHaveLength(2);
    expect(mocks.insertCalls[0].id).toBe(mocks.insertCalls[1].id);
    expect(mocks.insertCalls[0]).toEqual(
      expect.objectContaining({
        club_id: "club",
        channel_id: "general",
        user_id: "member",
      }),
    );
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("shows a recoverable channel-load error without blocking copy actions", async () => {
    mocks.failChannels = true;
    render(<FindShareSheet open onOpenChange={vi.fn()} find={find} />);
    await expect(
      screen.findByText("Chat channels couldn’t load."),
    ).resolves.toBeVisible();
    mocks.failChannels = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Send to Chat" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Couldn’t copy",
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("keeps Chat gated when the asset is not installed", () => {
    mocks.installed = false;
    render(<FindShareSheet open onOpenChange={vi.fn()} find={find} />);
    expect(
      screen.queryByRole("button", { name: "Send to Chat" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeVisible();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

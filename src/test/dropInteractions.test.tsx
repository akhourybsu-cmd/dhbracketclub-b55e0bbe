import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyFind } from "@/lib/dailyFind";

const fixture = vi.hoisted(() => ({
  user: "member",
  club: "club",
  add: vi.fn(),
  image: vi.fn(),
  insert: vi.fn(),
  navigate: vi.fn(),
  success: vi.fn(),
  message: null as Promise<unknown> | null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: fixture.user } }),
}));
vi.mock("@/contexts/ClubContext", () => ({
  useClub: () => ({ club: { id: fixture.club }, isClubAdmin: false }),
}));
vi.mock("@/hooks/useClubAssets", () => ({
  useClubAssets: () => ({ isInstalled: () => true }),
}));
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  )),
  useNavigate: () => fixture.navigate,
}));
vi.mock("sonner", () => ({
  toast: { success: fixture.success, error: vi.fn() },
}));
vi.mock("@/components/dailyFind/useDropSheetViewport", () => ({
  useDropSheetViewport: () => {},
}));
vi.mock("@/components/dailyFind/FindLinkPreview", () => ({
  FindLinkPreview: () => null,
}));
vi.mock("@/hooks/useDailyFinds", () => ({
  useFindComments: () => ({ data: [], isLoading: false, isError: false }),
  useAddFindComment: () => ({ mutate: fixture.add, isPending: false }),
  useDeleteFindComment: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleFindReaction: () => ({ mutate: vi.fn(), isPending: false }),
  useFindImage: fixture.image,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? children : null,
  SheetContent: React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    function Content({ children }, ref) {
      return <section ref={ref}>{children}</section>;
    },
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));
vi.mock("@/components/chat/ChatBottomSheet", () => ({
  ChatBottomSheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <section>{children}</section> : null),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        single: () => query,
        insert: (body: unknown) => {
          fixture.insert(body);
          return query;
        },
        then: (
          resolve: (result: unknown) => void,
          reject: (error: unknown) => void,
        ) => {
          const result =
            table === "channels"
              ? Promise.resolve({
                  data: [
                    {
                      id: "general",
                      name: "general",
                      post_permission: "all",
                      channel_type: "general",
                      is_default: true,
                    },
                  ],
                  error: null,
                })
              : (fixture.message ??
                Promise.resolve({ data: null, error: null }));
          return result.then(resolve, reject);
        },
      };
      return query;
    },
    functions: { invoke: vi.fn().mockResolvedValue({}) },
  },
}));

import { FindCommentsSheet } from "@/components/dailyFind/FindCommentsSheet";
import { FindShareSheet } from "@/components/dailyFind/FindShareSheet";
import { FindPhoto } from "@/components/dailyFind/FindCard";

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
  fixture.user = "member";
  fixture.club = "club";
  fixture.message = null;
  fixture.add.mockReset();
  fixture.image
    .mockReset()
    .mockReturnValue({ url: "/photo.jpg", retry: vi.fn(), error: false });
  fixture.insert.mockReset();
  fixture.navigate.mockReset();
  fixture.success.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Drop comment and share continuity", () => {
  it("keeps Return for multiline text, ignores IME submission, and posts once through the explicit shortcut", () => {
    render(<FindCommentsSheet open onOpenChange={vi.fn()} find={find} />);
    const input = screen.getByRole("textbox", { name: "Add a comment" });
    expect(input.tagName).toBe("TEXTAREA");
    fireEvent.change(input, { target: { value: "First line\nSecond line" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true, keyCode: 229 });
    expect(fixture.add).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    expect(fixture.add).toHaveBeenCalledOnce();
    expect(fixture.add.mock.calls[0][0]).toEqual({
      findId: find.id,
      body: "First line\nSecond line",
    });
  });

  it("retains a failed comment and preserves the next draft while its retry completes", () => {
    render(<FindCommentsSheet open onOpenChange={vi.fn()} find={find} />);
    const input = screen.getByRole("textbox", { name: "Add a comment" });
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    act(() => {
      fixture.add.mock.calls[0][1].onError();
      fixture.add.mock.calls[0][1].onSettled();
    });
    expect(input).toHaveValue("Keep this draft");
    expect(screen.getByRole("alert")).toHaveTextContent("ready to retry");
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    fireEvent.change(input, { target: { value: "A different next thought" } });
    act(() => {
      fixture.add.mock.calls[1][1].onSuccess();
      fixture.add.mock.calls[1][1].onSettled();
    });
    expect(input).toHaveValue("A different next thought");
    expect(screen.getByRole("status")).toHaveTextContent("Comment posted.");
  });

  it("isolates comment drafts and pending callbacks across an A → B → A account switch", () => {
    const props = { open: true, onOpenChange: vi.fn(), find };
    const view = render(<FindCommentsSheet {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Add a comment" }), {
      target: { value: "Old account request" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    const pending = fixture.add.mock.calls[0][1];
    fixture.user = "other";
    view.rerender(<FindCommentsSheet {...props} />);
    expect(screen.getByRole("textbox", { name: "Add a comment" })).toHaveValue(
      "",
    );
    fixture.user = "member";
    view.rerender(<FindCommentsSheet {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Add a comment" }), {
      target: { value: "New session thought" },
    });
    act(() => {
      pending.onSuccess();
      pending.onSettled();
    });
    expect(screen.getByRole("textbox", { name: "Add a comment" })).toHaveValue(
      "New session thought",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("does not navigate or close a new account's sheet when an old share finishes", async () => {
    let resolveMessage!: (value: unknown) => void;
    fixture.message = new Promise((resolve) => {
      resolveMessage = resolve;
    });
    const props = { open: true, onOpenChange: vi.fn(), find };
    const view = render(<FindShareSheet {...props} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Send to Chat" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send to Chat" }));
    await waitFor(() => expect(fixture.insert).toHaveBeenCalledOnce());
    const sent = fixture.insert.mock.calls[0][0];
    fixture.user = "other";
    view.rerender(<FindShareSheet {...props} />);
    fixture.user = "member";
    view.rerender(<FindShareSheet {...props} />);
    await act(async () => {
      resolveMessage({
        data: {
          id: sent.id,
          channel_id: "general",
          user_id: "member",
          content: "shared",
        },
        error: null,
      });
    });
    expect(fixture.navigate).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Send to Chat" }),
      ).toBeEnabled(),
    );
  });

  it("opens one device share prompt at a time and treats dismissal as a normal return", async () => {
    let rejectShare!: (reason: unknown) => void;
    const share = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectShare = reject;
        }),
    );
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    render(<FindShareSheet open onOpenChange={vi.fn()} find={find} />);
    const button = screen.getByRole("button", { name: "Share…" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(share).toHaveBeenCalledOnce();
    await act(async () => {
      rejectShare(new DOMException("Dismissed", "AbortError"));
    });
    expect(button).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Drop photo loading", () => {
  it("signs nearby photos and pauses renewal for cards that leave the viewport", () => {
    let notify!: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const view = render(<FindPhoto path="member/photo.jpg" />);
    expect(fixture.image).toHaveBeenLastCalledWith("member/photo.jpg", false);
    act(() =>
      notify(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(fixture.image).toHaveBeenLastCalledWith("member/photo.jpg", true);
    act(() =>
      notify(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(fixture.image).toHaveBeenLastCalledWith("member/photo.jpg", false);
    expect(screen.getByRole("img", { name: "Shared photo" })).toHaveAttribute(
      "src",
      "/photo.jpg",
    );
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

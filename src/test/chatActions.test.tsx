import { useRef, useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "@/integrations/supabase/client",
  async () => await import("../../scripts/fixtures/chat-backend"),
);
vi.mock("@/hooks/useSoundEffect", () => ({
  useSoundEffect: () => ({ play: () => {} }),
}));
vi.mock("@/lib/chatNotifications", () => ({ notifyReaction: vi.fn() }));
import { qa } from "../../scripts/fixtures/chat-backend";
import { useChatActions } from "@/hooks/useChatActions";
import type { Message } from "@/components/chat/types";
const row: Message = {
  id: "target",
  channel_id: "general",
  user_id: "jordan",
  content: "Message",
  created_at: "2026-10-29T12:00:00Z",
  parent_message_id: null,
  is_pinned: false,
  edited_at: null,
  reactions: [],
};
const useActions = () => {
  const [messages, setMessages] = useState([row]);
  const echo = useRef(new Set<string>());
  return {
    messages,
    setMessages,
    echo,
    ...useChatActions("member", {
      messages,
      setMessages,
      reactionEchoRef: echo,
    }),
  };
};
beforeEach(() => {
  qa.failTables = [];
  qa.delayReactions = 0;
  qa.tables.message_reactions = [];
  qa.writes = [];
  qa.queries = [];
});
afterEach(cleanup);
describe("chat reactions", () => {
  it("keeps reaction chips in place and hides private attachment references while editing", async () => {
    const { result } = renderHook(useActions);
    const attachment =
      "lovable-private://chat-attachments-private/member/document.pdf#name=plan.pdf";
    act(() =>
      result.current.setMessages([
        {
          ...row,
          content: `Caption\n${attachment}`,
          reactions: [
            { emoji: "👍", count: 2, user_reacted: false },
            { emoji: "🔥", count: 1, user_reacted: false },
            { emoji: "😂", count: 3, user_reacted: false },
          ],
        },
      ]),
    );
    await act(() => result.current.toggleReaction("target", "🔥"));
    expect(
      result.current.messages[0].reactions.map((reaction) => reaction.emoji),
    ).toEqual(["👍", "🔥", "😂"]);
    act(() => result.current.startEditing(result.current.messages[0]));
    expect(result.current.editContent).toBe("Caption");
    await act(() => result.current.handleSaveEdit("target", "New caption"));
    expect(result.current.messages[0].content).toBe(
      `New caption\n${attachment}`,
    );
  });
  it("adds then removes the caller’s reaction without relying on synchronous React updaters", async () => {
    const { result } = renderHook(useActions);
    await act(() => result.current.toggleReaction("target", "🔥"));
    expect(result.current.messages[0].reactions).toEqual([
      { emoji: "🔥", count: 1, user_reacted: true },
    ]);
    await act(() => result.current.toggleReaction("target", "🔥"));
    expect(result.current.messages[0].reactions).toEqual([]);
    expect(qa.tables.message_reactions).toHaveLength(0);
  });
  it("rolls back a returned API error and clears its optimistic echo", async () => {
    qa.failTables = ["message_reactions"];
    const { result } = renderHook(useActions);
    await act(() => result.current.toggleReaction("target", "🔥"));
    expect(result.current.messages[0].reactions).toEqual([]);
    expect(result.current.echo.current.size).toBe(0);
  });
  it("prevents duplicate in-flight writes and preserves another member’s reaction on rollback", async () => {
    qa.delayReactions = 30;
    qa.failTables = ["message_reactions"];
    const { result } = renderHook(useActions);
    let pending: Promise<void>;
    act(() => {
      pending = result.current.toggleReaction("target", "🔥");
      void result.current.toggleReaction("target", "🔥");
    });
    act(() =>
      result.current.setMessages((previous) =>
        previous.map((message) => ({
          ...message,
          reactions: [{ emoji: "🔥", count: 2, user_reacted: true }],
        })),
      ),
    );
    await act(async () => {
      await pending;
    });
    expect(result.current.messages[0].reactions).toEqual([
      { emoji: "🔥", count: 1, user_reacted: false },
    ]);
    expect(
      qa.queries.filter((query) => query.table === "message_reactions"),
    ).toHaveLength(1);
  });
});

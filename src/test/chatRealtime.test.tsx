import { useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "@/integrations/supabase/client",
  async () => await import("../../scripts/fixtures/chat-backend"),
);
import { qa } from "../../scripts/fixtures/chat-backend";
import { useChatRealtime, useChatTyping } from "@/hooks/useChatRealtime";
import type { Message } from "@/components/chat/types";
const play = () => {};
const members = [{ id: "jordan", display_name: "Jordan", avatar_url: null }];
const row = (id: string, user_id = "jordan") => ({
  id,
  user_id,
  channel_id: "general",
  content: "Arrived",
  created_at: "2026-10-29T12:00:00.000Z",
  parent_message_id: null,
  is_pinned: false,
  edited_at: null,
});
const useLive = ({
  channel = "general",
  follow = true,
  reconnect = () => {},
} = {}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  return {
    messages,
    ...useChatRealtime({
      channelId: channel,
      userId: "member",
      members,
      play,
      setMessages,
      followLatest: follow,
      onReconnect: reconnect,
    }),
  };
};
beforeEach(() => {
  qa.delayMessages = 0;
  qa.failTables = [];
});
afterEach(cleanup);
describe("chat realtime continuity", () => {
  it("deduplicates redelivery and includes the caller’s messages from another device", async () => {
    const { result } = renderHook(() => useLive());
    await act(async () => {
      qa.emit("messages", "INSERT", row("own", "member"));
      qa.emit("messages", "INSERT", row("own", "member"));
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(["own"]);
    await act(async () => {
      qa.emit("messages", "INSERT", row("peer"));
      qa.emit("messages", "INSERT", row("peer"));
    });
    expect(result.current.messages).toHaveLength(2);
  });
  it("keeps an older context window intact and refreshes after reconnect", async () => {
    const reconnect = vi.fn();
    const { result } = renderHook(() => useLive({ follow: false, reconnect }));
    await act(async () => {
      qa.emit("messages", "INSERT", row("newer"));
    });
    expect(result.current.messages).toEqual([]);
    act(() => qa.status("chat-general", "CHANNEL_ERROR"));
    expect(result.current.connection).toBe("reconnecting");
    act(() => qa.status("chat-general", "SUBSCRIBED"));
    expect(reconnect).toHaveBeenCalledOnce();
    expect(result.current.connection).toBe("live");
  });
  it("discards an asynchronous reply lookup when its channel closes", async () => {
    qa.delayMessages = 20;
    const { result, rerender } = renderHook(
      ({ channel }) => useLive({ channel }),
      { initialProps: { channel: "general" } },
    );
    act(() =>
      qa.emit("messages", "INSERT", { ...row("late"), reply_to_id: "missing" }),
    );
    rerender({ channel: "sports" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 35));
    });
    expect(result.current.messages).toEqual([]);
  });
  it("resolves typing names against the member roster and drops unlisted sessions", async () => {
    const { result, rerender } = renderHook(
      ({ channel }) => useChatTyping(channel, "member", members),
      { initialProps: { channel: "general" } },
    );
    await act(async () => {
      qa.presence("typing-general", {
        jordan: [{ typing: true, name: "Forged label" }],
        unlisted: [{ typing: true, name: "Unlisted session" }],
      });
    });
    expect(result.current.typingUsers).toEqual(["Jordan"]);
    rerender({ channel: "sports" });
    expect(result.current.typingUsers).toEqual([]);
  });
});

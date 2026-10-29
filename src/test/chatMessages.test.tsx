import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "@/integrations/supabase/client",
  async () => await import("../../scripts/fixtures/chat-backend"),
);
import { qa } from "../../scripts/fixtures/chat-backend";
import { useChatMessages } from "@/hooks/useChatMessages";
import type { Message } from "@/components/chat/types";
const row = (id: string, channel_id = "general"): Message => ({
  id,
  channel_id,
  user_id: "sam",
  content: id,
  created_at: "2026-10-29T12:00:00.000Z",
  edited_at: null,
  is_pinned: false,
  parent_message_id: null,
});
beforeEach(() => {
  qa.failTables = [];
  qa.delayMessages = 0;
  qa.queries = [];
  qa.tables.messages = Array.from({ length: 60 }, (_, n) =>
    row(String(n).padStart(3, "0")),
  );
  qa.tables.message_reactions = [];
});
afterEach(cleanup);
describe("saved chat windows", () => {
  it("paginates simultaneous messages without losing or duplicating IDs", async () => {
    const { result } = renderHook(() => useChatMessages("member", "general"));
    await act(() => result.current.fetchMessages("general"));
    expect(result.current.messages).toHaveLength(50);
    await act(() =>
      result.current.fetchMessages("general", result.current.messages[0]),
    );
    expect(result.current.messages).toHaveLength(60);
    expect(new Set(result.current.messages.map((m) => m.id)).size).toBe(60);
  });
  it("loads complete context around a message with identical neighboring timestamps", async () => {
    const { result } = renderHook(() => useChatMessages("member", "general"));
    await act(() => result.current.fetchMessagesAround("general", "030"));
    expect(result.current.messages).toHaveLength(50);
    expect(result.current.messages[0].id).toBe("006");
    expect(result.current.messages[49].id).toBe("055");
  });
  it("turns API errors into a retryable error and settles its loading state", async () => {
    qa.failTables = ["messages"];
    const { result } = renderHook(() => useChatMessages("member", "general"));
    await act(() => result.current.fetchMessages("general"));
    expect(result.current.error).toBeTruthy();
    expect(result.current.loading).toBe(false);
    qa.failTables = [];
    await act(() => result.current.fetchMessages("general"));
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toHaveLength(50);
  });
  it("discards a slow result after changing channels, including enrichment", async () => {
    qa.delayMessages = 30;
    const { result, rerender } = renderHook(
      ({ channel }) => useChatMessages("member", channel),
      { initialProps: { channel: "general" } },
    );
    let pending: Promise<boolean>;
    act(() => {
      pending = result.current.fetchMessages("general");
    });
    rerender({ channel: "sports" });
    qa.delayMessages = 0;
    qa.tables.messages.push(row("sports", "sports"));
    await act(() => result.current.fetchMessages("sports"));
    await act(async () => {
      await pending;
    });
    expect(result.current.messages.map((m) => m.channel_id)).toEqual([
      "sports",
    ]);
  });
  it("keeps realtime arrivals during hydration and preserves history on reconnect", async () => {
    const { result } = renderHook(() => useChatMessages("member", "general"));
    qa.delayMessages = 10;
    let pending: Promise<boolean>;
    act(() => {
      pending = result.current.fetchMessages("general");
    });
    const arrival = {
      ...row("latest"),
      created_at: "2026-10-29T13:00:00.000Z",
    };
    act(() => result.current.setMessages([arrival]));
    await act(async () => {
      await pending;
    });
    expect(result.current.messages).toHaveLength(51);
    await act(() =>
      result.current.fetchMessages("general", result.current.messages[0]),
    );
    expect(result.current.messages).toHaveLength(61);
    await act(() => result.current.fetchMessages("general", undefined, true));
    expect(result.current.messages).toHaveLength(61);
    expect(
      result.current.messages[result.current.messages.length - 1]?.id,
    ).toBe("latest");
  });
});

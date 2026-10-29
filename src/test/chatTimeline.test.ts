import { describe, expect, it } from "vitest";
import {
  beforeMessage,
  mergeTimeline,
  timelineArrivals,
  shouldSendOnEnter,
} from "@/lib/chatTimeline";
import type { Message } from "@/components/chat/types";
const message = (
  id: string,
  created_at = "2026-10-29T12:00:00.000Z",
  user_id = "other",
): Message => ({
  id,
  created_at,
  user_id,
  channel_id: "room",
  content: id,
  parent_message_id: null,
  is_pinned: false,
  edited_at: null,
});
describe("chat timeline continuity", () => {
  it("distinguishes older history from genuine arrivals even when the last message is yours", () => {
    const current = [message("b"), message("c", undefined, "me")];
    expect(timelineArrivals(current, [message("a"), ...current])).toEqual([]);
    expect(
      timelineArrivals(current, [message("a"), ...current, message("d")]),
    ).toEqual([message("d")]);
  });
  it("ignores reactions and edits, while reconciling an optimistic replacement once", () => {
    expect(
      timelineArrivals(
        [message("a")],
        [{ ...message("a"), content: "Edited" }],
      ),
    ).toEqual([]);
    expect(
      timelineArrivals(
        [message("a"), message("temporary")],
        [message("a"), message("saved")],
      ),
    ).toEqual([message("saved")]);
    expect(
      timelineArrivals(
        [
          message("a"),
          { ...message("temporary"), content: "Hello", _optimistic: true },
        ],
        [message("a"), { ...message("saved"), content: "Hello" }],
      ),
    ).toEqual([]);
  });
  it("deduplicates overlapping pages and orders simultaneous messages by ID", () => {
    expect(
      mergeTimeline(
        [message("b"), message("a")],
        [{ ...message("b"), content: "Updated" }],
      ).map((m) => [m.id, m.content]),
    ).toEqual([
      ["a", "a"],
      ["b", "Updated"],
    ]);
    expect(beforeMessage(message("b"))).toContain(
      "and(created_at.eq.2026-10-29T12:00:00.000Z,id.lt.b)",
    );
    expect(beforeMessage(message("b"), "after")).toContain("id.gt.b");
  });
  it("keeps phone newlines, Shift+Enter and IME confirmation out of send", () => {
    expect(shouldSendOnEnter({ key: "Enter" }, false)).toBe(true);
    expect(shouldSendOnEnter({ key: "Enter" }, true)).toBe(false);
    expect(shouldSendOnEnter({ key: "Enter", shiftKey: true }, false)).toBe(
      false,
    );
    expect(shouldSendOnEnter({ key: "Enter", isComposing: true }, false)).toBe(
      false,
    );
    expect(shouldSendOnEnter({ key: "Enter", keyCode: 229 }, false)).toBe(
      false,
    );
  });
});

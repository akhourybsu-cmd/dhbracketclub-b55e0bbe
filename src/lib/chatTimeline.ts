import type { Message } from "@/components/chat/types";

type TimelineItem = Pick<Message, "id" | "created_at"> &
  Partial<Pick<Message, "_optimistic" | "user_id" | "content" | "reply_to_id">>;

/** Stable cursors include the ID so messages saved at the same instant survive. */
export function beforeMessage(
  message: TimelineItem,
  direction: "before" | "after" = "before",
) {
  const op = direction === "before" ? "lt" : "gt";
  return `created_at.${op}.${message.created_at},and(created_at.eq.${message.created_at},id.${op}.${message.id})`;
}

export function mergeTimeline(...groups: Message[][]): Message[] {
  const unique = new Map(groups.flat().map((message) => [message.id, message]));
  return [...unique.values()].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

/** Older history and reaction/edit refreshes are never new arrivals. */
export function timelineArrivals<T extends TimelineItem>(
  previous: TimelineItem[],
  next: T[],
): T[] {
  if (previous.length === 0) return [];
  const known = new Set(previous.map((message) => message.id));
  const fresh = (message: T) =>
    !known.has(message.id) &&
    !previous.some(
      (optimistic) =>
        optimistic._optimistic &&
        optimistic.user_id === message.user_id &&
        optimistic.content === message.content &&
        (optimistic.reply_to_id || null) === (message.reply_to_id || null),
    );
  for (let index = previous.length - 1; index >= 0; index--) {
    const anchor = next.findIndex(
      (message) => message.id === previous[index].id,
    );
    if (anchor !== -1) return next.slice(anchor + 1).filter(fresh);
  }
  const last = previous[previous.length - 1].created_at;
  return next.filter((message) => fresh(message) && message.created_at > last);
}

export function shouldSendOnEnter(
  event: {
    key: string;
    shiftKey?: boolean;
    isComposing?: boolean;
    keyCode?: number;
  },
  mobile: boolean,
) {
  return (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !mobile
  );
}

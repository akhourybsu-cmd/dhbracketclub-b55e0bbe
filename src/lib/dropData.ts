import type { DailyFind } from "@/lib/dailyFind";

export const DROP_PAGE_SIZE = 30;
export type DropCursor = Pick<DailyFind, "created_at" | "id">;

/** A timestamp alone loses posts when more than one shares a creation time. */
export function beforeDrop(cursor: DropCursor) {
  return `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`;
}

/** Handles list queries, detail queries and infinite-query pages without flattening them. */
export function patchDropData<T>(
  data: T,
  id: string,
  patch: (find: DailyFind) => DailyFind,
): T {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    const rows = data.map((row) => patchDropData(row, id, patch));
    return rows.some((row, index) => row !== data[index]) ? (rows as T) : data;
  }
  const value = data as Record<string, unknown>;
  if (value.id === id && typeof value.title === "string")
    return patch(data as unknown as DailyFind) as T;
  if (Array.isArray(value.pages)) {
    const pages = patchDropData(value.pages, id, patch);
    return pages === value.pages ? data : ({ ...value, pages } as T);
  }
  return data;
}

/** Rollback only the current member's reaction; other members' updates survive. */
export function setDropReaction(
  find: DailyFind,
  userId: string,
  emoji: string,
  reacted: boolean,
): DailyFind {
  const reactions = find.reactions || [];
  const already = reactions.some(
    (row) => row.user_id === userId && row.emoji === emoji,
  );
  if (already === reacted) return find;
  return {
    ...find,
    reactions: reacted
      ? [...reactions, { user_id: userId, emoji }]
      : reactions.filter(
          (row) => row.user_id !== userId || row.emoji !== emoji,
        ),
  };
}

export function changeDropCommentCount(
  find: DailyFind,
  delta: number,
): DailyFind {
  return {
    ...find,
    comments: [
      { count: Math.max(0, (find.comments?.[0]?.count || 0) + delta) },
    ],
  };
}

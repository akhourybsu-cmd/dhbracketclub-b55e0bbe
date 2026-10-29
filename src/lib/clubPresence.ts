export interface PresenceMember {
  user_id: string;
  display_name?: string;
  avatar_url?: string | null;
}
export interface DirectoryMember {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Presence can contain stale or forged names. Only use verified directory data. */
export function visiblePresence(
  state: Record<string, unknown[]>,
  directory: DirectoryMember[],
): PresenceMember[] {
  const online = new Set(
    Object.values(state)
      .flat()
      .flatMap((record) =>
        record &&
        typeof record === "object" &&
        "user_id" in record &&
        typeof record.user_id === "string"
          ? [record.user_id]
          : [],
      ),
  );
  return directory
    .filter((member) => online.has(member.id))
    .map((member) => ({
      user_id: member.id,
      display_name: member.display_name || "Club member",
      avatar_url: member.avatar_url,
    }));
}

import { runeRpc } from "./request";

/** Public, verified members of the active club. The server excludes private
 * testing identities even from their own competitive leaderboard. */
export async function runeClubMemberIds(clubId: string): Promise<string[]> {
  const { data } = await runeRpc<Array<{ id: string }>>(
    "dh_presence_directory",
    {
      p_club_id: clubId,
    },
    "Load club competitors",
  );
  return [
    ...new Set(
      (Array.isArray(data) ? data : [])
        .map((member: { id?: string }) => member.id)
        .filter((id: unknown): id is string => typeof id === "string"),
    ),
  ];
}

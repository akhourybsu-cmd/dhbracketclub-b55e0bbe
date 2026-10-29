// DH Club — Club-scoped online presence hook
//
// Wraps the same Supabase presence channel that MembersOnline uses
// (`online-presence:${clubId}`, keyed by user.id) and exposes the set
// of currently-online user IDs. This lets multiple surfaces (Home
// strip, chat avatar dots, etc.) share one truth without each
// opening its own channel.
//
// Presence identities and labels come from the verified club directory.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import { visiblePresence, type DirectoryMember } from "@/lib/clubPresence";

interface PresenceMeta {
  user_id: string;
  display_name?: string;
  avatar_url?: string | null;
}

interface UseClubPresenceOptions {
  /** Refresh the canonical directory when the member changes their name. */
  displayName?: string;
  /** Optional avatar URL to broadcast. */
  avatarUrl?: string | null;
  /** Set false to skip tracking — useful when this hook is called in
   *  a context where the user's presence shouldn't count (admin
   *  surfaces viewing other clubs, etc.). Defaults to true. */
  track?: boolean;
}

interface UseClubPresenceResult {
  /** Set of user IDs currently online in the user's active club. */
  onlineIds: Set<string>;
  /** Full presence rows for surfaces that want display_name/avatar. */
  users: PresenceMeta[];
}

export function useClubPresence(
  opts: UseClubPresenceOptions = {},
): UseClubPresenceResult {
  const { user } = useAuth();
  const userId = user?.id;
  const { club } = useClub();
  const [users, setUsers] = useState<PresenceMeta[]>([]);
  const { displayName, avatarUrl, track = true } = opts;

  useEffect(() => {
    setUsers([]);
    if (!userId || !club?.id) return;
    let alive = true;
    let directory: DirectoryMember[] = [];
    let subscribed = false;
    const channel = supabase.channel(`online-presence:${club.id}`, {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      if (alive) setUsers(visiblePresence(channel.presenceState(), directory));
    };
    const trackVerified = async () => {
      if (!alive || !subscribed || !track) return;
      const member = directory.find((row) => row.id === userId);
      if (member)
        await channel.track({
          user_id: member.id,
          display_name: member.display_name,
          avatar_url: member.avatar_url,
        });
    };
    const rpc = supabase.rpc as unknown as (
      name: string,
      args: { p_club_id: string },
    ) => PromiseLike<{ data: DirectoryMember[] | null; error: unknown }>;
    void withTimeout(
      rpc("dh_presence_directory", { p_club_id: club.id }),
      QUERY_TIMEOUT_MS,
      "club presence directory",
    )
      .then(({ data, error }) => {
        if (!alive || error || !Array.isArray(data)) return;
        directory = data;
        sync();
        void trackVerified().catch(() => {});
      })
      .catch(() => {});
    channel
      .on("presence", { event: "sync" }, () => {
        sync();
      })
      .subscribe(async (status) => {
        subscribed = status === "SUBSCRIBED";
        try {
          await trackVerified();
        } catch {
          /* Presence is optional. */
        }
      });

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [userId, club?.id, displayName, avatarUrl, track]);

  const onlineIds = useMemo(
    () => new Set(users.map((u) => u.user_id)),
    [users],
  );
  return { onlineIds, users };
}

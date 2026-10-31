/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import {
  buildUserScopedPath,
  mimeForExt,
  validateImageFile,
} from "@/lib/uploadValidation";
import { localDayKey, type DailyFind, type FindKind } from "@/lib/dailyFind";
import { isSafeUrl } from "@/lib/linkParser";
import {
  beforeDrop,
  DROP_PAGE_SIZE,
  patchDropData,
  setDropReaction,
  type DropCursor,
} from "@/lib/dropData";

const BUCKET = "daily-finds";
const SELECT =
  "*, profiles:user_id(id, display_name, avatar_url), reactions:daily_find_reactions(emoji, user_id), comments:daily_find_comments(count)";
const db = supabase as any;
class DropRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly uncertain = false,
  ) {
    super(message);
  }
}
async function run<T>(
  q: PromiseLike<{ data: T; error: any }>,
  label: string,
): Promise<T> {
  let response: { data: T; error: any };
  try {
    response = await withTimeout(Promise.resolve(q), QUERY_TIMEOUT_MS, label);
  } catch (error) {
    throw new DropRequestError(
      error instanceof Error ? error.message : `${label} failed`,
      undefined,
      true,
    );
  }
  if (response.error)
    throw new DropRequestError(
      response.error.message || `${label} failed`,
      response.error.code,
      !response.error.code &&
        /fetch|network|timed out|abort|connection/i.test(
          response.error.message || "",
        ),
    );
  return response.data;
}

/** The social feed reads small stable pages; it has no arbitrary 60-day cutoff. */
export function useDropFeed(mode: "all" | "mine" = "all") {
  const { club } = useClub(),
    { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["drop-feed", club?.id, user?.id, mode],
    enabled: !!club?.id && !!user?.id,
    initialPageParam: null as DropCursor | null,
    queryFn: async ({ pageParam, signal }) => {
      let q = db.from("daily_finds").select(SELECT).eq("club_id", club!.id);
      if (mode === "mine") q = q.eq("user_id", user!.id);
      if (pageParam) q = q.or(beforeDrop(pageParam));
      const data = await run<DailyFind[]>(
        q
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(DROP_PAGE_SIZE)
          .abortSignal(signal),
        "Load Drop feed",
      );
      return data || [];
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === DROP_PAGE_SIZE
        ? lastPage[lastPage.length - 1]
        : undefined,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Legacy date-range queries remain available to Home and calendar views. */
export function useDailyFinds(range: { from: string; to: string }) {
  const { club } = useClub(),
    { user } = useAuth();
  return useQuery({
    queryKey: ["daily-finds", club?.id, user?.id, range.from, range.to],
    enabled: !!club?.id && !!user?.id,
    queryFn: async ({ signal }) =>
      (await run<DailyFind[]>(
        db
          .from("daily_finds")
          .select(SELECT)
          .eq("club_id", club!.id)
          .gte("find_date", range.from)
          .lte("find_date", range.to)
          .order("find_date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(500)
          .abortSignal(signal),
        "Load finds",
      )) || [],
  });
}
export function useSearchFinds(term: string, tag: string | null) {
  const { club } = useClub(),
    { user } = useAuth();
  const text = term.trim().replace(/[%,()]/g, " ");
  return useQuery({
    queryKey: ["daily-finds-search", club?.id, user?.id, term, tag],
    enabled: !!club?.id && !!user?.id && (text.length >= 2 || !!tag),
    queryFn: async ({ signal }) => {
      let q = db.from("daily_finds").select(SELECT).eq("club_id", club!.id);
      if (text.length >= 2)
        q = q.or(`title.ilike.%${text}%,note.ilike.%${text}%`);
      if (tag) q = q.contains("tags", [tag]);
      return (
        (await run<DailyFind[]>(
          q
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(100)
            .abortSignal(signal),
          "Search finds",
        )) || []
      );
    },
  });
}
export function useDailyFind(id: string | undefined) {
  const { club } = useClub(),
    { user } = useAuth();
  return useQuery({
    queryKey: ["daily-find", id, club?.id, user?.id],
    enabled: !!id && !!club?.id && !!user?.id,
    queryFn: async ({ signal }) =>
      (await run<DailyFind | null>(
        db
          .from("daily_finds")
          .select(SELECT)
          .eq("id", id)
          .eq("club_id", club!.id)
          .abortSignal(signal)
          .maybeSingle(),
        "Load find",
      )) || null,
  });
}
export interface FindComment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}
export function useFindComments(findId: string | undefined) {
  const { club } = useClub(),
    { user } = useAuth();
  return useQuery({
    queryKey: ["daily-find-comments", findId, club?.id, user?.id],
    enabled: !!findId && !!club?.id && !!user?.id,
    queryFn: async ({ signal }) =>
      (await run<FindComment[]>(
        db
          .from("daily_find_comments")
          .select(
            "id, body, created_at, user_id, profiles:user_id(display_name, avatar_url)",
          )
          .eq("find_id", findId)
          .order("created_at")
          .order("id")
          .abortSignal(signal),
        "Load comments",
      )) || [],
  });
}

interface DropScope {
  clubId: string;
  userId: string;
}
function isDropCache(key: QueryKey, scope: DropScope, findId?: string) {
  return (
    (["drop-feed", "daily-finds", "daily-finds-search"].includes(
      String(key[0]),
    ) &&
      key[1] === scope.clubId &&
      key[2] === scope.userId) ||
    (key[0] === "daily-find" &&
      key[2] === scope.clubId &&
      key[3] === scope.userId &&
      (!findId || key[1] === findId))
  );
}
function patchFindCaches(
  cache: QueryClient,
  scope: DropScope,
  findId: string,
  patch: (find: DailyFind) => DailyFind,
) {
  cache.setQueriesData(
    { predicate: (query) => isDropCache(query.queryKey, scope, findId) },
    (data) => patchDropData(data, findId, patch),
  );
}
function useInvalidate() {
  const cache = useQueryClient();
  return (
    scope: DropScope,
    findId?: string,
    structural = true,
    comments = structural,
  ) => {
    void cache.invalidateQueries({
      predicate: (q) => isDropCache(q.queryKey, scope, findId),
      // Interaction reads reconcile one row; structural changes still refresh
      // page boundaries. Reading positions do not move after a like/comment.
      refetchType: structural ? "active" : "none",
    });
    if (findId && comments)
      void cache.invalidateQueries({
        queryKey: ["daily-find-comments", findId, scope.clubId, scope.userId],
      });
    void cache.invalidateQueries({
      queryKey: ["home-signals", scope.userId, scope.clubId],
    });
    void cache.invalidateQueries({
      queryKey: ["dh-score", scope.userId, scope.clubId],
    });
    void cache.invalidateQueries({
      queryKey: ["dh-feats", scope.userId, scope.clubId],
    });
  };
}

let reconciliationSerial = 0;
const reconciliations = new Map<string, number>();
/** Confirm the changed entity without refetching every accumulated feed page. */
async function reconcileFind(
  cache: QueryClient,
  scope: DropScope,
  findId: string,
) {
  const key = JSON.stringify([scope.clubId, scope.userId, findId]);
  const serial = ++reconciliationSerial;
  reconciliations.set(key, serial);
  try {
    const find = await run<DailyFind | null>(
      db
        .from("daily_finds")
        .select(SELECT)
        .eq("id", findId)
        .eq("club_id", scope.clubId)
        .maybeSingle(),
      "Update Drop",
    );
    if (reconciliations.get(key) !== serial) return;
    if (find) patchFindCaches(cache, scope, findId, () => find);
    else {
      // A concurrent deletion changes page boundaries and merits a list read.
      void cache.invalidateQueries({
        predicate: (q) => isDropCache(q.queryKey, scope, findId),
      });
    }
  } catch {
    // The write already succeeded. Keep its acknowledged state and leave the
    // affected caches stale for the next normal read instead of reporting a
    // failed interaction or automatically replaying a write.
  } finally {
    if (reconciliations.get(key) === serial) reconciliations.delete(key);
  }
}
async function removePhoto(path: string) {
  await run(
    supabase.storage.from(BUCKET).remove([path]),
    "Remove Drop photo",
  ).catch(() => {});
}
export interface NewFindInput {
  kind: FindKind;
  title: string;
  note?: string;
  url?: string;
  tags: string[];
  image?: File | null;
}
interface CreateAttempt {
  key: string;
  id: string;
  path: string | null;
  uploaded: boolean;
}
export function useCreateFind() {
  const { user } = useAuth(),
    { club } = useClub(),
    invalidate = useInvalidate();
  const attemptRef = useRef<CreateAttempt | null>(null);
  return useMutation({
    retry: false,
    mutationFn: async (input: NewFindInput) => {
      if (!user || !club) throw new Error("Not signed in");
      const scope = { userId: user.id, clubId: club.id };
      const title = input.title.trim(),
        note = input.note?.trim() || null,
        url = input.url?.trim() || null;
      if (!title || title.length > 160 || (note?.length || 0) > 2000)
        throw new Error("Check your Drop text and try again");
      if (url && (!/^https?:\/\//i.test(url) || !isSafeUrl(url)))
        throw new Error("Add a valid http or https link");
      if (input.kind === "photo" && !input.image)
        throw new Error("Add a photo to share");
      const key = JSON.stringify([
        club.id,
        user.id,
        input.kind,
        title,
        note,
        url,
        input.tags,
        input.image && [
          input.image.name,
          input.image.size,
          input.image.type,
          input.image.lastModified,
        ],
      ]);
      if (attemptRef.current?.key !== key)
        attemptRef.current = {
          key,
          id: crypto.randomUUID(),
          path: null,
          uploaded: false,
        };
      const attempt = attemptRef.current;
      if (input.image && !attempt.uploaded) {
        const v = validateImageFile(input.image, {
          maxBytes: 10 * 1024 * 1024,
          label: "Photo",
        });
        if (!v.ok) throw new Error(v.error);
        attempt.path ||= `${club.id}/${buildUserScopedPath(user.id, v.ext!)}`;
        try {
          await run(
            supabase.storage.from(BUCKET).upload(attempt.path, input.image, {
              contentType: input.image.type || mimeForExt(v.ext!),
              upsert: false,
            }),
            "Upload Drop photo",
          );
        } catch (error) {
          if (
            !(error instanceof DropRequestError) ||
            !/already exists|duplicate/i.test(error.message)
          )
            throw error;
        }
        attempt.uploaded = true;
      }
      try {
        const result = await run<{ id: string }>(
          db
            .from("daily_finds")
            .insert({
              id: attempt.id,
              club_id: club.id,
              user_id: user.id,
              find_date: localDayKey(),
              kind: input.kind,
              title,
              note,
              url,
              image_path: attempt.path,
              tags: input.tags,
            })
            .select("id")
            .single(),
          "Share Drop",
        );
        return { ...result, scope };
      } catch (error) {
        if (error instanceof DropRequestError && error.code === "23505") {
          const saved = await run<{ id: string } | null>(
            db
              .from("daily_finds")
              .select("id")
              .eq("id", attempt.id)
              .eq("user_id", user.id)
              .eq("club_id", club.id)
              .maybeSingle(),
            "Confirm Drop",
          );
          if (saved) return { ...saved, scope };
        }
        if (error instanceof DropRequestError && !error.uncertain) {
          if (attempt.uploaded && attempt.path) void removePhoto(attempt.path);
          if (attemptRef.current === attempt) attemptRef.current = null;
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      if (attemptRef.current?.id === result.id) attemptRef.current = null;
      invalidate(result.scope);
    },
  });
}
export function useDeleteFind() {
  const { user } = useAuth(),
    { club } = useClub(),
    invalidate = useInvalidate();
  return useMutation({
    retry: false,
    mutationFn: async (find: DailyFind) => {
      if (!user || !club) throw new Error("Not signed in");
      const scope = { userId: user.id, clubId: club.id };
      await run(
        db.from("daily_finds").delete().eq("id", find.id),
        "Delete find",
      );
      if (find.image_path) void removePhoto(find.image_path);
      return { scope };
    },
    onSuccess: (result, find) => invalidate(result.scope, find.id),
  });
}
export function useToggleFindReaction() {
  const { user } = useAuth(),
    { club } = useClub(),
    cache = useQueryClient(),
    invalidate = useInvalidate();
  return useMutation({
    retry: false,
    mutationFn: async ({
      findId,
      emoji,
      has,
    }: {
      findId: string;
      emoji: string;
      has: boolean;
    }) => {
      if (!user || !club) throw new Error("Not signed in");
      const scope = { userId: user.id, clubId: club.id };
      if (has)
        await run(
          db
            .from("daily_find_reactions")
            .delete()
            .eq("find_id", findId)
            .eq("user_id", user.id)
            .eq("emoji", emoji),
          "Remove reaction",
        );
      else {
        try {
          await run(
            db
              .from("daily_find_reactions")
              .insert({ find_id: findId, user_id: user.id, emoji }),
            "Add reaction",
          );
        } catch (error) {
          if (!(error instanceof DropRequestError) || error.code !== "23505")
            throw error;
        }
      }
      return { scope };
    },
    onMutate: async (variables) => {
      const scope = user && club ? { userId: user.id, clubId: club.id } : null;
      if (!scope) return null;
      await cache.cancelQueries({
        predicate: (q) => isDropCache(q.queryKey, scope, variables.findId),
      });
      patchFindCaches(cache, scope, variables.findId, (find) =>
        setDropReaction(find, scope.userId, variables.emoji, !variables.has),
      );
      return scope;
    },
    onError: (_error, variables, context) => {
      if (context?.userId)
        patchFindCaches(cache, context, variables.findId, (find) =>
          setDropReaction(
            find,
            context.userId!,
            variables.emoji,
            variables.has,
          ),
        );
    },
    onSuccess: async (result, variables) => {
      invalidate(result.scope, variables.findId, false);
      await reconcileFind(cache, result.scope, variables.findId);
    },
  });
}
export function useAddFindComment() {
  const { user } = useAuth(),
    { club } = useClub(),
    cache = useQueryClient(),
    invalidate = useInvalidate();
  const attempt = useRef<{ key: string; id: string } | null>(null);
  return useMutation({
    retry: false,
    mutationFn: async ({ findId, body }: { findId: string; body: string }) => {
      if (!user || !club) throw new Error("Not signed in");
      const scope = { userId: user.id, clubId: club.id };
      const text = body.trim();
      if (!text || text.length > 1000)
        throw new Error("Comments must be 1–1,000 characters");
      const key = JSON.stringify([club.id, user.id, findId, text]);
      if (attempt.current?.key !== key)
        attempt.current = { key, id: crypto.randomUUID() };
      const request = attempt.current;
      try {
        await run(
          db.from("daily_find_comments").insert({
            id: request.id,
            find_id: findId,
            user_id: user.id,
            body: text,
          }),
          "Post comment",
        );
      } catch (error) {
        if (!(error instanceof DropRequestError) || error.code !== "23505")
          throw error;
      }
      return { scope, attemptId: request.id };
    },
    onSuccess: async (result, variables) => {
      if (attempt.current?.id === result.attemptId) attempt.current = null;
      invalidate(result.scope, variables.findId, false, true);
      await reconcileFind(cache, result.scope, variables.findId);
    },
  });
}
export function useDeleteFindComment() {
  const cache = useQueryClient(),
    { user } = useAuth(),
    { club } = useClub(),
    invalidate = useInvalidate();
  return useMutation({
    retry: false,
    mutationFn: async ({ id }: { id: string; findId: string }) => {
      if (!user || !club) throw new Error("Not signed in");
      const scope = { userId: user.id, clubId: club.id };
      await run(
        db.from("daily_find_comments").delete().eq("id", id),
        "Delete comment",
      );
      return { scope };
    },
    onSuccess: async (result, variables) => {
      cache.setQueriesData<FindComment[]>(
        {
          queryKey: [
            "daily-find-comments",
            variables.findId,
            result.scope.clubId,
            result.scope.userId,
          ],
        },
        (rows) => rows?.filter((row) => row.id !== variables.id),
      );
      invalidate(result.scope, variables.findId, false, true);
      await reconcileFind(cache, result.scope, variables.findId);
    },
  });
}

/** Signed photos are scoped to the current account and reset immediately on path changes. */
export function useFindImage(path: string | null | undefined, enabled = true) {
  const { user } = useAuth(),
    { club } = useClub();
  const query = useQuery({
    queryKey: ["daily-find-image", user?.id, club?.id, path],
    enabled: enabled && !!path && !!user && !!club,
    queryFn: async () => {
      const data = await run<{ signedUrl: string }>(
        supabase.storage.from(BUCKET).createSignedUrl(path!, 3600),
        "Load Drop photo",
      );
      if (!data?.signedUrl) throw new Error("Photo unavailable");
      return data.signedUrl;
    },
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return {
    url: query.data || null,
    loading: !!path && query.isPending,
    error: query.isError,
    retry: () => query.refetch(),
  };
}
export function useFindImageUrl(path: string | null | undefined) {
  return useFindImage(path).url;
}

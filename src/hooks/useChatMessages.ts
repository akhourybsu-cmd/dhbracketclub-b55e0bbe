/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Message } from "@/components/chat/types";
import {
  HYDRATE_TIMEOUT_MS,
  QUERY_TIMEOUT_MS,
  withTimeout,
} from "@/lib/asyncGuards";
import { memberErrorMessage } from "@/lib/memberData";
import { beforeMessage, mergeTimeline } from "@/lib/chatTimeline";

const PAGE_SIZE = 50;

export function useChatMessages(
  userId: string | undefined,
  channelId?: string,
  externalActiveRef?: React.RefObject<string | null>,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const olderRequestRef = useRef(false);
  // Track the active channel to discard stale fetch results
  const localChannelRef = useRef<string | null>(null);
  const activeChannelRef = externalActiveRef || localChannelRef;
  const windowChannelRef = useRef<string | null>(null);
  if (!externalActiveRef && channelId !== undefined)
    localChannelRef.current = channelId;

  const enrichMessages = useCallback(
    async (rawMsgs: any[]): Promise<Message[]> => {
      if (rawMsgs.length === 0 || !userId) return [];
      const msgIds = rawMsgs.map((m) => m.id);
      const [repliesRes, rxnsRes] = await withTimeout(
        Promise.all([
          withTimeout(
            supabase
              .from("messages")
              .select("parent_message_id")
              .in("parent_message_id", msgIds),
            QUERY_TIMEOUT_MS,
            "chat reply counts",
          ),
          withTimeout(
            supabase
              .from("message_reactions")
              .select("*")
              .in("message_id", msgIds),
            QUERY_TIMEOUT_MS,
            "chat reactions",
          ),
        ]),
        HYDRATE_TIMEOUT_MS,
        "chat message enrichment",
      );

      const replyCounts = new Map<string, number>();
      (repliesRes.data || []).forEach((r: any) => {
        replyCounts.set(
          r.parent_message_id,
          (replyCounts.get(r.parent_message_id) || 0) + 1,
        );
      });

      const grouped = new Map<
        string,
        Map<string, { count: number; userReacted: boolean }>
      >();
      (rxnsRes.data || []).forEach((r: any) => {
        if (!grouped.has(r.message_id)) grouped.set(r.message_id, new Map());
        const em = grouped.get(r.message_id)!;
        if (!em.has(r.emoji)) em.set(r.emoji, { count: 0, userReacted: false });
        const entry = em.get(r.emoji)!;
        entry.count++;
        if (r.user_id === userId) entry.userReacted = true;
      });

      // Resolve inline-reply references: batch-fetch the messages being replied
      // to (may be outside this page) for the quoted-reference preview.
      const refIds = [
        ...new Set(rawMsgs.map((m) => m.reply_to_id).filter(Boolean)),
      ] as string[];
      const refMap = new Map<
        string,
        {
          id: string;
          content: string;
          user_id: string;
          display_name?: string | null;
        }
      >();
      if (refIds.length) {
        const { data: refs } = await withTimeout(
          supabase
            .from("messages")
            .select("id, content, user_id, profiles:user_id(display_name)")
            .in("id", refIds),
          QUERY_TIMEOUT_MS,
          "chat reply references",
        );
        (refs || []).forEach((r: any) =>
          refMap.set(r.id, {
            id: r.id,
            content: r.content,
            user_id: r.user_id,
            display_name: r.profiles?.display_name,
          }),
        );
      }

      return rawMsgs.map((m) => ({
        ...m,
        reply_count: replyCounts.get(m.id) || 0,
        reply_to: m.reply_to_id ? (refMap.get(m.reply_to_id) ?? null) : null,
        reactions: grouped.has(m.id)
          ? Array.from(grouped.get(m.id)!.entries()).map(([emoji, v]) => ({
              emoji,
              count: v.count,
              user_reacted: v.userReacted,
            }))
          : [],
      }));
    },
    [userId],
  );

  const fetchMessages = useCallback(
    async (
      channelId: string,
      before?: Pick<Message, "id" | "created_at">,
      preserveHistory = false,
    ) => {
      if (
        !userId ||
        (externalActiveRef && externalActiveRef.current !== channelId)
      )
        return false;
      // Track which channel this fetch is for
      if (!before) {
        if (!externalActiveRef) localChannelRef.current = channelId;
        setError(null);
        setLoading(true);
        requestRef.current++;
      }
      const request = requestRef.current;

      let query = supabase
        .from("messages")
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("channel_id", channelId)
        .is("parent_message_id", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);

      if (before) query = query.or(beforeMessage(before));

      try {
        const { data, error: apiError } = await withTimeout(
          query,
          QUERY_TIMEOUT_MS,
          "chat messages",
        );
        if (apiError) throw apiError;
        if (!data) return false;

        // Discard result if user switched channels while this was in flight
        if (
          activeChannelRef.current !== channelId ||
          request !== requestRef.current
        )
          return false;

        const reversed = [...data].reverse();
        const enriched = await enrichMessages(reversed);
        if (
          activeChannelRef.current !== channelId ||
          request !== requestRef.current
        )
          return false;

        windowChannelRef.current = channelId;
        if (before) {
          setMessages((prev) => mergeTimeline(enriched, prev));
        } else {
          // Keep messages delivered by realtime while this page was loading.
          setMessages((prev) =>
            preserveHistory
              ? mergeTimeline(prev, enriched)
              : mergeTimeline(
                  enriched,
                  prev.filter(
                    (message) =>
                      message.channel_id === channelId &&
                      (message._optimistic ||
                        (!enriched.some(
                          (fetched) => fetched.id === message.id,
                        ) &&
                          message.created_at >=
                            (enriched[enriched.length - 1]?.created_at || ""))),
                  ),
                ),
          );
        }
        setHasMore(data.length === PAGE_SIZE);
        if (!before) setHasNewer(false);
        setOlderError(null);
        return true;
      } catch (error) {
        console.error("[useChatMessages] fetch failed", error);
        if (
          !before &&
          activeChannelRef.current === channelId &&
          request === requestRef.current
        ) {
          setError(memberErrorMessage(error));
        } else if (
          before &&
          activeChannelRef.current === channelId &&
          request === requestRef.current
        ) {
          setOlderError(memberErrorMessage(error));
        }
        return false;
      } finally {
        if (
          !before &&
          activeChannelRef.current === channelId &&
          request === requestRef.current
        )
          setLoading(false);
      }
    },
    [userId, enrichMessages, externalActiveRef, activeChannelRef],
  );

  /**
   * Load a focused window around one message. This makes notification and
   * search deep links reliable even when the target is older than the newest
   * 50-message page.
   */
  const fetchMessagesAround = useCallback(
    async (channelId: string, messageId: string): Promise<boolean> => {
      if (
        !userId ||
        (externalActiveRef && externalActiveRef.current !== channelId)
      )
        return false;
      if (!externalActiveRef) localChannelRef.current = channelId;
      setError(null);
      setLoading(true);
      const request = ++requestRef.current;

      try {
        const { data: target, error: targetError } = await withTimeout(
          supabase
            .from("messages")
            .select("*, profiles:user_id(display_name, avatar_url)")
            .eq("channel_id", channelId)
            .eq("id", messageId)
            .is("parent_message_id", null)
            .maybeSingle(),
          QUERY_TIMEOUT_MS,
          "chat target message",
        );
        if (targetError) throw targetError;
        if (!target || activeChannelRef.current !== channelId) return false;

        const [olderResponse, newerResponse] = await withTimeout(
          Promise.all([
            withTimeout(
              supabase
                .from("messages")
                .select("*, profiles:user_id(display_name, avatar_url)")
                .eq("channel_id", channelId)
                .is("parent_message_id", null)
                .or(beforeMessage(target))
                .order("created_at", { ascending: false })
                .order("id", { ascending: false })
                .limit(24),
              QUERY_TIMEOUT_MS,
              "chat context before",
            ),
            withTimeout(
              supabase
                .from("messages")
                .select("*, profiles:user_id(display_name, avatar_url)")
                .eq("channel_id", channelId)
                .is("parent_message_id", null)
                .or(beforeMessage(target, "after"))
                .order("created_at", { ascending: true })
                .order("id", { ascending: true })
                .limit(26),
              QUERY_TIMEOUT_MS,
              "chat context after",
            ),
          ]),
          HYDRATE_TIMEOUT_MS,
          "chat message context",
        );

        if (olderResponse.error || newerResponse.error)
          throw olderResponse.error || newerResponse.error;
        const older = olderResponse.data,
          newer = newerResponse.data;
        if (activeChannelRef.current !== channelId) return false;
        const raw = [...(older || [])]
          .reverse()
          .concat([target], (newer || []).slice(0, 25));
        const enriched = await enrichMessages(raw);
        if (
          activeChannelRef.current !== channelId ||
          request !== requestRef.current
        )
          return false;
        windowChannelRef.current = channelId;
        setMessages(mergeTimeline(enriched));
        setHasMore((older || []).length === 24);
        setHasNewer((newer || []).length > 25);
        return true;
      } catch (fetchError) {
        console.error("[useChatMessages] focused fetch failed", fetchError);
        if (
          activeChannelRef.current === channelId &&
          request === requestRef.current
        )
          setError(memberErrorMessage(fetchError));
        return false;
      } finally {
        if (
          activeChannelRef.current === channelId &&
          request === requestRef.current
        )
          setLoading(false);
      }
    },
    [userId, enrichMessages, externalActiveRef, activeChannelRef],
  );

  const loadOlderMessages = useCallback(
    (channelId: string) => {
      if (olderRequestRef.current || !hasMore || messages.length === 0) return;
      olderRequestRef.current = true;
      setLoadingMore(true);
      fetchMessages(channelId, messages[0]).finally(() => {
        olderRequestRef.current = false;
        setLoadingMore(false);
      });
    },
    [hasMore, messages, fetchMessages],
  );

  return {
    messages,
    setMessages,
    hasMore,
    hasNewer:
      hasNewer &&
      windowChannelRef.current === (channelId || activeChannelRef.current),
    loadingMore,
    loading,
    olderError,
    error,
    fetchMessages,
    fetchMessagesAround,
    loadOlderMessages,
  };
}

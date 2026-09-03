/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Message } from '@/components/chat/types';
import { HYDRATE_TIMEOUT_MS, QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

const PAGE_SIZE = 50;

export function useChatMessages(userId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Track the active channel to discard stale fetch results
  const activeChannelRef = useRef<string | null>(null);

  const enrichMessages = useCallback(async (rawMsgs: any[]): Promise<Message[]> => {
    if (rawMsgs.length === 0 || !userId) return [];
    const msgIds = rawMsgs.map(m => m.id);
    const [repliesRes, rxnsRes] = await withTimeout(
      Promise.all([
        withTimeout(
          supabase.from('messages').select('parent_message_id').in('parent_message_id', msgIds),
          QUERY_TIMEOUT_MS,
          'chat reply counts',
        ),
        withTimeout(
          supabase.from('message_reactions').select('*').in('message_id', msgIds),
          QUERY_TIMEOUT_MS,
          'chat reactions',
        ),
      ]),
      HYDRATE_TIMEOUT_MS,
      'chat message enrichment',
    );

    const replyCounts = new Map<string, number>();
    (repliesRes.data || []).forEach((r: any) => {
      replyCounts.set(r.parent_message_id, (replyCounts.get(r.parent_message_id) || 0) + 1);
    });

    const grouped = new Map<string, Map<string, { count: number; userReacted: boolean }>>();
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
    const refIds = [...new Set(rawMsgs.map(m => m.reply_to_id).filter(Boolean))] as string[];
    const refMap = new Map<string, { id: string; content: string; user_id: string; display_name?: string | null }>();
    if (refIds.length) {
      const { data: refs } = await withTimeout(
        supabase
          .from('messages')
          .select('id, content, user_id, profiles:user_id(display_name)')
          .in('id', refIds),
        QUERY_TIMEOUT_MS,
        'chat reply references',
      );
      (refs || []).forEach((r: any) => refMap.set(r.id, {
        id: r.id, content: r.content, user_id: r.user_id, display_name: r.profiles?.display_name,
      }));
    }

    return rawMsgs.map(m => ({
      ...m,
      reply_count: replyCounts.get(m.id) || 0,
      reply_to: m.reply_to_id ? (refMap.get(m.reply_to_id) ?? null) : null,
      reactions: grouped.has(m.id)
        ? Array.from(grouped.get(m.id)!.entries()).map(([emoji, v]) => ({ emoji, count: v.count, user_reacted: v.userReacted }))
        : [],
    }));
  }, [userId]);

  const setActiveChannel = useCallback((channelId: string) => {
    activeChannelRef.current = channelId;
  }, []);

  const fetchMessages = useCallback(async (channelId: string, before?: string) => {
    if (!userId) return;
    // Track which channel this fetch is for
    if (!before) activeChannelRef.current = channelId;

    let query = supabase
      .from('messages')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('channel_id', channelId)
      .is('parent_message_id', null)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (before) query = query.lt('created_at', before);

    try {
      const { data } = await withTimeout(query, QUERY_TIMEOUT_MS, 'chat messages');
      if (!data) return;

      // Discard result if user switched channels while this was in flight
      if (activeChannelRef.current !== channelId) return;

      const reversed = [...data].reverse();
      const enriched = await enrichMessages(reversed);

      if (before) {
        setMessages(prev => [...enriched, ...prev]);
      } else {
        setMessages(enriched);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      console.error('[useChatMessages] fetch failed', error);
    }
  }, [userId, enrichMessages]);

  const loadOlderMessages = useCallback((channelId: string) => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    fetchMessages(channelId, messages[0].created_at).finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, messages, fetchMessages]);

  return {
    messages,
    setMessages,
    hasMore,
    loadingMore,
    fetchMessages,
    loadOlderMessages,
  };
}

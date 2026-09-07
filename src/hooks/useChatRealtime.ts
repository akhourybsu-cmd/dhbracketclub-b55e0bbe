import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Message } from '@/components/chat/types';
import type { MentionMember } from '@/components/chat/MessageComposer';

type RealtimeMessage = Omit<Message, 'profiles' | 'reply_count' | 'reactions' | 'reply_to' | '_optimistic'>;
type RealtimeReaction = { message_id: string; emoji: string; user_id: string };
type ReplyReference = {
  id: string;
  content: string;
  user_id: string;
  profiles?: { display_name: string } | null;
};

interface UseChatRealtimeOptions {
  channelId: string | undefined;
  userId: string | undefined;
  members: MentionMember[];
  play: (sound: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  /** Shared echo set from useChatActions. Whenever we optimistically
   *  toggle a reaction locally, an entry is added here so that the
   *  inevitable INSERT/DELETE realtime event for OUR own toggle gets
   *  detected and skipped — otherwise the reaction count would
   *  double-apply (once optimistically, once on the realtime echo). */
  reactionEchoRef?: React.RefObject<Set<string>>;
}

export function useChatRealtime({
  channelId,
  userId,
  members,
  play,
  setMessages,
  reactionEchoRef,
}: UseChatRealtimeOptions) {
  // Use refs for values that change frequently but shouldn't cause re-subscribe
  const membersRef = useRef(members);
  membersRef.current = members;

  useEffect(() => {
    if (!channelId || !userId) return;

    const channel = supabase
      .channel(`chat-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const newMsg = payload.new as RealtimeMessage;
          // Legacy thread children (parent_message_id set) never appear in the
          // channel timeline — the fetch excludes them and inline replies use
          // reply_to_id instead. Ignore them here too.
          if (newMsg.parent_message_id) return;
          if (newMsg.user_id === userId) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              const hasOptimistic = prev.some(m => m._optimistic && m.content === newMsg.content);
              if (hasOptimistic) {
                return prev.map(m => m._optimistic && m.content === newMsg.content
                  ? { ...newMsg, profiles: m.profiles, reply_count: 0, reactions: [], reply_to: m.reply_to ?? null }
                  : m);
              }
              return prev;
            });
            return;
          }
          const cached = membersRef.current.find(m => m.id === newMsg.user_id);
          const profiles = cached
            ? { display_name: cached.display_name, avatar_url: cached.avatar_url }
            : (await supabase.from('profiles').select('display_name, avatar_url').eq('id', newMsg.user_id).single()).data;
          // Resolve the inline-reply reference (if any) for the quoted preview.
          let replyTo = null;
          if (newMsg.reply_to_id) {
            const { data: ref } = await supabase
              .from('messages')
              .select('id, content, user_id, profiles:user_id(display_name)')
              .eq('id', newMsg.reply_to_id)
              .maybeSingle();
            if (ref) {
              const reply = ref as unknown as ReplyReference;
              replyTo = { id: reply.id, content: reply.content, user_id: reply.user_id, display_name: reply.profiles?.display_name };
            }
          }
          setMessages(prev => [...prev, { ...newMsg, profiles, reply_count: 0, reactions: [], reply_to: replyTo }]);
          play('ping');
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const updated = payload.new as Pick<Message, 'id' | 'content' | 'edited_at' | 'is_pinned'>;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, content: updated.content, edited_at: updated.edited_at, is_pinned: updated.is_pinned } : m));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.new as RealtimeReaction;
          // Echo dedup: if THIS user just optimistically added this
          // reaction, the count has already been bumped locally. The
          // realtime event is the server echo of our action — consume
          // it from the echo set and skip the apply.
          if (r.user_id === userId && reactionEchoRef?.current?.has(`${r.message_id}:${r.emoji}:add`)) {
            reactionEchoRef.current.delete(`${r.message_id}:${r.emoji}:add`);
            return;
          }
          setMessages(prev => prev.map(m => {
            if (m.id !== r.message_id) return m;
            const existing = (m.reactions || []).find(rx => rx.emoji === r.emoji);
            const reactions = existing
              ? (m.reactions || []).map(rx => rx.emoji === r.emoji
                ? { ...rx, count: rx.count + 1, user_reacted: r.user_id === userId ? true : rx.user_reacted }
                : rx)
              : [...(m.reactions || []), { emoji: r.emoji, count: 1, user_reacted: r.user_id === userId }];
            return { ...m, reactions };
          }));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.old as RealtimeReaction;
          // Echo dedup mirror of the INSERT case — skip the apply
          // when the DELETE is our own optimistic un-react.
          if (r.user_id === userId && reactionEchoRef?.current?.has(`${r.message_id}:${r.emoji}:remove`)) {
            reactionEchoRef.current.delete(`${r.message_id}:${r.emoji}:remove`);
            return;
          }
          setMessages(prev => prev.map(m => {
            if (m.id !== r.message_id) return m;
            const existing = (m.reactions || []).find(rx => rx.emoji === r.emoji);
            const reactions = existing && existing.count > 1
              ? (m.reactions || []).map(rx => rx.emoji === r.emoji
                ? { ...rx, count: rx.count - 1, user_reacted: r.user_id === userId ? false : rx.user_reacted }
                : rx)
              : (m.reactions || []).filter(rx => rx.emoji !== r.emoji);
            return { ...m, reactions };
          }));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [channelId, userId, play, reactionEchoRef, setMessages]);
}

export function useChatTyping(
  channelId: string | undefined,
  userId: string | undefined,
  displayName: string,
) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcast = useRef(0);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!channelId || !userId) return;

    const presenceChannel = supabase.channel(`typing-${channelId}`, {
      config: { presence: { key: userId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const typing: string[] = [];
        for (const [uid, presences] of Object.entries(state)) {
          if (uid === userId) continue;
          const p = (presences as Array<{ typing?: boolean; name?: string }>)?.[0];
          if (p?.typing && p?.name) typing.push(p.name);
        }
        setTypingUsers(typing);
      })
      .subscribe();

    presenceRef.current = presenceChannel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      supabase.removeChannel(presenceChannel);
      presenceRef.current = null;
    };
  }, [channelId, userId]);

  const broadcastTyping = useCallback(() => {
    if (!presenceRef.current || !userId) return;
    const now = Date.now();
    if (now - lastTypingBroadcast.current >= 2000) {
      lastTypingBroadcast.current = now;
      void presenceRef.current.track({
        typing: true,
        name: displayName || 'Someone',
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      void presenceRef.current?.track({ typing: false, name: '' });
    }, 3000);
  }, [userId, displayName]);

  return { typingUsers, broadcastTyping };
}

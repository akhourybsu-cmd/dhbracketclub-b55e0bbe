import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';
import type { Message } from '@/components/chat/types';
import { notifyReaction } from '@/lib/chatNotifications';

// Legacy path: when the caller didn't wire optimistic state setters,
// we still need to know whether to DELETE or INSERT. Used only when
// `setMessages` wasn't provided to useChatActions.
async function userHasReaction(messageId: string, emoji: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('message_reactions').select('id')
    .eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
    .maybeSingle();
  return !!data;
}

interface UseChatActionsOptions {
  /** Setter for the main messages array — used by optimistic
   *  reaction toggling so the UI updates in the same frame as the
   *  tap. */
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  /** Shared echo set keyed by `${messageId}:${emoji}:${action}`.
   *  Whenever we optimistically toggle a reaction here, we record an
   *  entry; useChatRealtime checks the set and skips its own apply
   *  when an INSERT/DELETE comes back as the echo of our optimistic
   *  action. Prevents double-counting. */
  reactionEchoRef?: React.RefObject<Set<string>>;
}

export function useChatActions(userId: string | undefined, opts: UseChatActionsOptions = {}) {
  const { play } = useSoundEffect();
  const { setMessages, reactionEchoRef } = opts;

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Helper — applies the local optimistic toggle and returns whether
  // the user was already reacted (so the caller knows which DB op to
  // run). Read-modify-write happens inside the setMessages updater
  // closure so we always see fresh state even if the user mashes the
  // button.
  const applyOptimisticToggle = useCallback((messageId: string, emoji: string): 'added' | 'removed' | null => {
    if (!setMessages) return null;
    let action: 'added' | 'removed' | null = null;
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = [...(m.reactions || [])];
      const existingIndex = reactions.findIndex(rx => rx.emoji === emoji);
      const existing = existingIndex >= 0 ? reactions[existingIndex] : undefined;
      if (existing?.user_reacted) {
        action = 'removed';
        const updated = { ...existing, count: existing.count - 1, user_reacted: false };
        reactions[existingIndex] = updated;
        return {
          ...m,
          reactions: updated.count <= 0 ? reactions.filter(rx => rx.emoji !== emoji) : reactions,
        };
      } else if (existing) {
        action = 'added';
        reactions[existingIndex] = { ...existing, count: existing.count + 1, user_reacted: true };
        return { ...m, reactions };
      } else {
        action = 'added';
        return { ...m, reactions: [...reactions, { emoji, count: 1, user_reacted: true }] };
      }
    }));
    return action;
  }, [setMessages]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    play('tap');

    // 1. Optimistic local toggle — visible in the same frame as the
    //    tap. If setMessages wasn't wired (legacy callsites), we fall
    //    through to the slower request-first path below.
    const action = applyOptimisticToggle(messageId, emoji);

    // 2. Record the echo so the realtime listener can dedup the
    //    INSERT/DELETE event that's about to come back for OUR own
    //    user_id + emoji + message.
    if (action && reactionEchoRef?.current) {
      reactionEchoRef.current.add(`${messageId}:${emoji}:${action === 'added' ? 'add' : 'remove'}`);
    }

    // 3. Run the DB call. If anything fails, roll the optimistic
    //    state back AND clear the echo (so a later genuine state
    //    update doesn't get swallowed).
    try {
      if (action === 'removed' || (action === null /* legacy path */ && await userHasReaction(messageId, emoji, userId))) {
        const { data: existing } = await supabase
          .from('message_reactions').select('id')
          .eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
          .maybeSingle();
        if (existing) await supabase.from('message_reactions').delete().eq('id', existing.id);
        return; // un-reacting never sends a notification
      }
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
    } catch (err) {
      // Rollback: re-apply the inverse toggle locally and clear the
      // echo entry so the system snaps back to truth.
      if (action) {
        reactionEchoRef?.current?.delete(`${messageId}:${emoji}:${action === 'added' ? 'add' : 'remove'}`);
        applyOptimisticToggle(messageId, emoji);
      }
      toast.error('Reaction failed');
      return;
    }

    // 4. Personal push to the message author only (skips self-reactions).
    // Tag-grouped per-message so emoji-spam coalesces into one notification.
    if (action === 'added') {
      try {
        const [{ data: msg }, { data: reactor }] = await Promise.all([
          supabase.from('messages').select('user_id, channel_id').eq('id', messageId).maybeSingle(),
          supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
        ]);
        if (msg && msg.user_id && msg.user_id !== userId) {
          await notifyReaction({
            messageId,
            channelId: msg.channel_id,
            authorId: msg.user_id,
            reactorId: userId,
            reactorDisplayName: reactor?.display_name || 'Someone',
            emoji,
          });
        }
      } catch { /* fire-and-forget */ }
    }
  }, [userId, play, applyOptimisticToggle, reactionEchoRef]);

  const togglePin = useCallback(async (msg: Message): Promise<boolean> => {
    if (!userId) return false;
    play('tap');
    const wasPinned = msg.is_pinned;
    setMessages?.(prev => prev.map(message => message.id === msg.id ? { ...message, is_pinned: !wasPinned } : message));
    const { error } = await supabase.rpc('toggle_message_pin', { p_message_id: msg.id });
    if (error) {
      setMessages?.(prev => prev.map(message => message.id === msg.id ? { ...message, is_pinned: wasPinned } : message));
      toast.error('Failed to pin message');
      return false;
    } else {
      toast.success(wasPinned ? 'Unpinned' : 'Pinned');
      return true;
    }
  }, [userId, play, setMessages]);

  const deleteMessage = useCallback(async (msgId: string) => {
    // DB cascades handle legacy thread replies and reactions automatically.
    // Remove in the same frame, then restore in chronological order on error.
    let removed: Message | undefined;
    setMessages?.(prev => {
      removed = prev.find(message => message.id === msgId);
      return prev.filter(message => message.id !== msgId);
    });
    const { error } = await supabase.from('messages').delete().eq('id', msgId);
    if (!error) return;
    if (removed) {
      const restore = removed;
      setMessages?.(prev => prev.some(message => message.id === msgId)
        ? prev
        : [...prev, restore].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    }
    toast.error('Could not delete message');
  }, [setMessages]);

  const startEditing = useCallback((msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  }, []);

  const handleSaveEdit = useCallback(async (msgId: string, content: string) => {
    if (!content.trim()) return;
    play('tap');
    const nextContent = content.trim();
    let previous: Message | undefined;
    const editedAt = new Date().toISOString();
    setMessages?.(prev => prev.map(message => {
      if (message.id !== msgId) return message;
      previous = message;
      return { ...message, content: nextContent, edited_at: editedAt };
    }));
    const { error } = await supabase.from('messages').update({ content: nextContent, edited_at: editedAt }).eq('id', msgId);
    if (error) {
      if (previous) {
        const restore = previous;
        setMessages?.(prev => prev.map(message => message.id === msgId ? restore : message));
      }
      toast.error('Could not edit message');
      return;
    }
    setEditingMessageId(null);
    setEditContent('');
    toast.success('Message edited');
  }, [play, setMessages]);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditContent('');
  }, []);

  return {
    play,
    toggleReaction,
    togglePin,
    deleteMessage,
    startEditing,
    handleSaveEdit,
    editingMessageId,
    editContent,
    setEditContent,
    cancelEdit,
  };
}

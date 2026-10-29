import { useCallback, useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSoundEffect } from "@/hooks/useSoundEffect";
import { chatToast as toast } from "@/lib/chatToast";
import type { Message } from "@/components/chat/types";
import { memberData } from "@/lib/memberData";
import { notifyReaction } from "@/lib/chatNotifications";

// Legacy path: when the caller didn't wire optimistic state setters,
// we still need to know whether to DELETE or INSERT. Used only when
// `setMessages` wasn't provided to useChatActions.
async function userHasReaction(
  messageId: string,
  emoji: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  return !!data;
}

interface UseChatActionsOptions {
  /** Setter for the main messages array — used by optimistic
   *  reaction toggling so the UI updates in the same frame as the
   *  tap. */
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  messages?: Message[];
  activeChannelRef?: React.RefObject<string | null>;
  /** Shared echo set keyed by `${messageId}:${emoji}:${action}`.
   *  Whenever we optimistically toggle a reaction here, we record an
   *  entry; useChatRealtime checks the set and skips its own apply
   *  when an INSERT/DELETE comes back as the echo of our optimistic
   *  action. Prevents double-counting. */
  reactionEchoRef?: React.RefObject<Set<string>>;
}

export function useChatActions(
  userId: string | undefined,
  opts: UseChatActionsOptions = {},
) {
  const { play } = useSoundEffect();
  const { setMessages, reactionEchoRef } = opts;
  const messagesRef = useRef(opts.messages || []);
  messagesRef.current = opts.messages || messagesRef.current;
  const pendingReactions = useRef(new Set<string>());
  const echoTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(
    () => () => {
      for (const [key, timer] of echoTimers.current) {
        clearTimeout(timer);
        reactionEchoRef?.current?.delete(key);
      }
      echoTimers.current.clear();
    },
    [reactionEchoRef],
  );

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Change only this member's contribution; peers arriving during a failed
  // request remain intact when we roll back.
  const setUserReaction = useCallback(
    (messageId: string, emoji: string, reacted: boolean) => {
      const update = (rows: Message[]) =>
        rows.map((message) => {
          if (message.id !== messageId) return message;
          const existing = message.reactions?.find(
            (reaction) => reaction.emoji === emoji,
          );
          if (!!existing?.user_reacted === reacted) return message;
          const count = Math.max(
            0,
            (existing?.count || 0) + (reacted ? 1 : -1),
          );
          const rest = (message.reactions || []).filter(
            (reaction) => reaction.emoji !== emoji,
          );
          return {
            ...message,
            reactions: count
              ? existing
                ? (message.reactions || []).map((reaction) =>
                    reaction.emoji === emoji
                      ? { emoji, count, user_reacted: reacted }
                      : reaction,
                  )
                : [...rest, { emoji, count, user_reacted: reacted }]
              : rest,
          };
        });
      messagesRef.current = update(messagesRef.current);
      setMessages?.(update);
    },
    [setMessages],
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId) return;
      const key = `${messageId}:${emoji}`;
      if (pendingReactions.current.has(key)) return;
      pendingReactions.current.add(key);
      const message = messagesRef.current.find(
        (message) => message.id === messageId,
      );
      let wasReacted = !!message?.reactions?.find(
        (reaction) => reaction.emoji === emoji,
      )?.user_reacted;
      let echoKey = "";
      try {
        if (!setMessages)
          wasReacted = await userHasReaction(messageId, emoji, userId);
        play("tap");
        setUserReaction(messageId, emoji, !wasReacted);
        echoKey = `${key}:${wasReacted ? "remove" : "add"}`;
        reactionEchoRef?.current?.add(echoKey);
        clearTimeout(echoTimers.current.get(echoKey));
        const recordedKey = echoKey;
        echoTimers.current.set(
          recordedKey,
          setTimeout(() => {
            reactionEchoRef?.current?.delete(recordedKey);
            echoTimers.current.delete(recordedKey);
          }, 10000),
        );
        if (wasReacted) {
          await memberData(
            supabase
              .from("message_reactions")
              .delete()
              .eq("message_id", messageId)
              .eq("user_id", userId)
              .eq("emoji", emoji),
            "Remove reaction",
          );
        } else {
          await memberData(
            supabase
              .from("message_reactions")
              .insert({ message_id: messageId, user_id: userId, emoji }),
            "Save reaction",
          );
        }
      } catch {
        if (echoKey) reactionEchoRef?.current?.delete(echoKey);
        setUserReaction(messageId, emoji, wasReacted);
        toast.error("Couldn’t save that reaction. Try again.");
        return;
      } finally {
        pendingReactions.current.delete(key);
      }
      if (wasReacted) return;
      // Notification delivery never holds up the interaction.
      void (async () => {
        try {
          const [msg, reactor] = await Promise.all([
            memberData(
              supabase
                .from("messages")
                .select("user_id, channel_id")
                .eq("id", messageId)
                .maybeSingle(),
              "Reaction recipient",
            ),
            memberData(
              supabase
                .from("profiles")
                .select("display_name")
                .eq("id", userId)
                .maybeSingle(),
              "Reaction sender",
            ),
          ]);
          if (msg?.user_id && msg.user_id !== userId)
            await notifyReaction({
              messageId,
              channelId: msg.channel_id,
              authorId: msg.user_id,
              reactorId: userId,
              reactorDisplayName: reactor?.display_name || "Club member",
              emoji,
            });
        } catch {
          /* Optional notification. */
        }
      })();
    },
    [userId, play, setMessages, setUserReaction, reactionEchoRef],
  );

  const togglePin = useCallback(
    async (msg: Message): Promise<boolean> => {
      if (!userId) return false;
      play("tap");
      const wasPinned = msg.is_pinned;
      setMessages?.((prev) =>
        prev.map((message) =>
          message.id === msg.id
            ? { ...message, is_pinned: !wasPinned }
            : message,
        ),
      );
      const { error } = await supabase.rpc("toggle_message_pin", {
        p_message_id: msg.id,
      });
      if (error) {
        setMessages?.((prev) =>
          prev.map((message) =>
            message.id === msg.id
              ? { ...message, is_pinned: wasPinned }
              : message,
          ),
        );
        toast.error("Failed to pin message");
        return false;
      } else {
        toast.success(wasPinned ? "Unpinned" : "Pinned");
        return true;
      }
    },
    [userId, play, setMessages],
  );

  const deleteMessage = useCallback(
    async (msgId: string) => {
      // DB cascades handle legacy thread replies and reactions automatically.
      // Remove in the same frame, then restore in chronological order on error.
      const removed = messagesRef.current.find(
        (message) => message.id === msgId,
      );
      setMessages?.((prev) => {
        return prev.filter((message) => message.id !== msgId);
      });
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", msgId);
      if (!error) return;
      if (
        removed &&
        (!opts.activeChannelRef ||
          opts.activeChannelRef.current === removed.channel_id)
      ) {
        const restore = removed;
        setMessages?.((prev) =>
          prev.some((message) => message.id === msgId)
            ? prev
            : [...prev, restore].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              ),
        );
      }
      toast.error("Could not delete message");
    },
    [setMessages, opts.activeChannelRef],
  );

  const startEditing = useCallback((msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(
      msg.content.replace(/lovable-private:\/\/[^\s]+/gi, "").trim(),
    );
  }, []);

  const handleSaveEdit = useCallback(
    async (msgId: string, content: string) => {
      const previous = messagesRef.current.find(
        (message) => message.id === msgId,
      );
      const attachments =
        previous?.content.match(/lovable-private:\/\/[^\s]+/gi) || [];
      const nextContent = [content.trim(), ...attachments]
        .filter(Boolean)
        .join("\n");
      if (!nextContent) return;
      play("tap");
      const editedAt = new Date().toISOString();
      setMessages?.((prev) =>
        prev.map((message) => {
          if (message.id !== msgId) return message;
          return { ...message, content: nextContent, edited_at: editedAt };
        }),
      );
      const { error } = await supabase
        .from("messages")
        .update({ content: nextContent, edited_at: editedAt })
        .eq("id", msgId);
      if (error) {
        if (previous) {
          const restore = previous;
          setMessages?.((prev) =>
            prev.map((message) =>
              message.id === msgId
                ? {
                    ...message,
                    content: restore.content,
                    edited_at: restore.edited_at,
                  }
                : message,
            ),
          );
        }
        toast.error("Could not edit message");
        return;
      }
      setEditingMessageId(null);
      setEditContent("");
      toast.success("Message edited");
    },
    [play, setMessages],
  );

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditContent("");
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

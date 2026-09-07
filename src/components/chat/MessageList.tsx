import { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react';
import { MessageSquare, ChevronDown, SearchX } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageBubble } from './MessageBubble';
import { cn } from '@/lib/utils';
import type { Message, Channel } from './types';

interface MessageListProps {
  messages: Message[];
  selectedChannel: Channel | null;
  userId: string | undefined;
  currentDisplayName?: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onReply: (msg: Message) => void;
  onReplyJump?: (msgId: string) => void;
  onTogglePin: (msg: Message) => void;
  onStartEditing: (msg: Message) => void;
  onDeleteMessage: (msgId: string) => void;
  onSaveEdit: (msgId: string, content: string) => void;
  editingMessageId: string | null;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onCancelEdit: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  isSearchActive?: boolean;
  lastReadAt?: string | null;
  // undefined = read-state still loading (list defers its open-scroll decision).
  scrollToBottomTrigger?: number;
  /** Set of user IDs currently online in the user's club, surfaced
   *  as a green dot on each message's avatar (Discord-style). */
  onlineUserIds?: Set<string>;
  /** Bump `n` to scroll to `id` and briefly highlight it (jump-to-message). */
  jumpSignal?: { id: string; n: number } | null;
}

function getDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function MessageList({
  messages, selectedChannel, userId, currentDisplayName,
  onToggleReaction, onReply, onReplyJump, onTogglePin,
  onStartEditing, onDeleteMessage, onSaveEdit,
  editingMessageId, editContent, onEditContentChange, onCancelEdit,
  onLoadMore, hasMore, loadingMore, isSearchActive, lastReadAt,
  scrollToBottomTrigger, onlineUserIds, jumpSignal,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [openOverlayMessageId, setOpenOverlayMessageId] = useState<string | null>(null);
  const prevMsgCount = useRef(messages.length);

  const handleToggleOverlay = useCallback((msgId: string | null) => {
    setOpenOverlayMessageId(msgId);
  }, []);

  // Track whether we just switched channels — used by the auto-scroll
  // effect to know it should snap instantly (no smooth scroll) on the
  // first render after a channel change, and only smooth-scroll for
  // genuine new-message arrivals.
  const justSwitchedRef = useRef(true);

  // Unread divider: index of the last already-read message (the divider renders
  // right after it). Computed up here so the channel-open scroll can target it,
  // matching Discord's "land on your first unread" behavior.
  const unreadDividerAfterIdx = (() => {
    if (!lastReadAt || isSearchActive) return -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (new Date(messages[i].created_at) <= new Date(lastReadAt)) return i;
    }
    return -1;
  })();
  const hasUnreadDivider = unreadDividerAfterIdx >= 0 && unreadDividerAfterIdx < messages.length - 1;
  const unreadCount = hasUnreadDivider ? messages.length - 1 - unreadDividerAfterIdx : 0;

  // Reset auto-scroll state when channel changes.
  //
  // Previously this effect set up a MutationObserver that re-scrolled
  // for 1500ms on EVERY DOM mutation — including image loads, framer-
  // motion animation enter/exit, and child re-renders — which caused
  // visible scroll bumps during the first second after switching.
  // Dropping the observer: the auto-scroll effect below already
  // handles "messages added → scroll to bottom" via its `messages`
  // dependency, and the ResizeObserver below handles viewport/image
  // resize. The observer was solving a problem the other two effects
  // already solve.
  useEffect(() => {
    setAutoScroll(true);
    setNewMsgCount(0);
    justSwitchedRef.current = true;
  }, [selectedChannel?.id]);

  // Scroll preservation on load-more (prepend)
  const prevScrollHeight = useRef<number | null>(null);

  useEffect(() => {
    if (loadingMore && scrollRef.current) {
      prevScrollHeight.current = scrollRef.current.scrollHeight;
    }
  }, [loadingMore]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || prevScrollHeight.current === null) return;
    if (!loadingMore && messages.length > prevMsgCount.current) {
      const delta = el.scrollHeight - prevScrollHeight.current;
      if (delta > 0) {
        el.scrollTop += delta;
      }
      prevScrollHeight.current = null;
    }
  }, [messages, loadingMore]);

  // Auto scroll to bottom on new messages.
  //
  // Behaviour:
  //   • First render after a channel switch → snap instant (no smooth)
  //     so the initial position lands before the user sees anything.
  //   • Subsequent renders while autoScroll=true → smooth-scroll for
  //     new arrivals.
  //   • autoScroll=false → bump the "new messages" badge instead.
  useEffect(() => {
    // First render after a channel switch: land on the unread divider if there
    // is one (so you start reading where you left off), otherwise snap to the
    // bottom. Either way, do it instantly before the user sees anything.
    if (justSwitchedRef.current) {
      // Wait until messages have loaded AND the channel's read-state has
      // resolved (undefined = still loading) before choosing where to land.
      if (messages.length === 0 || lastReadAt === undefined) return;
      justSwitchedRef.current = false;
      prevMsgCount.current = messages.length;
      setNewMsgCount(0);
      if (hasUnreadDivider && dividerRef.current) {
        dividerRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
        setAutoScroll(false); // we're parked at the divider, not the bottom
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
      return;
    }

    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else if (messages.length > prevMsgCount.current && prevScrollHeight.current === null) {
      setNewMsgCount(prev => prev + (messages.length - prevMsgCount.current));
    }
    prevMsgCount.current = messages.length;
  }, [messages, autoScroll, hasUnreadDivider, lastReadAt]);

  // Re-anchor on resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (autoScroll) {
          messagesEndRef.current?.scrollIntoView();
        }
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoScroll]);

  // External scroll-to-bottom trigger
  useEffect(() => {
    if (scrollToBottomTrigger && autoScroll) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView();
      });
    }
  }, [autoScroll, scrollToBottomTrigger]);

  // Passive scroll handler
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!el) return;

        if (el.scrollTop < 80 && hasMore && !loadingMore && onLoadMore) {
          onLoadMore();
        }

        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setAutoScroll(nearBottom);
        if (nearBottom) setNewMsgCount(0);
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasMore, loadingMore, onLoadMore]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
    setNewMsgCount(0);
  };

  // Jump-to-message: scroll a target message into view and pulse a highlight
  // ring. Best-effort — if the message isn't in the loaded window it's a no-op.
  useEffect(() => {
    if (!jumpSignal) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${jumpSignal.id}"]`);
    if (!el) return;
    setAutoScroll(false);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('rounded-xl', 'ring-2', 'ring-primary/50', 'transition-shadow');
    const t = setTimeout(() => {
      el.classList.remove('ring-2', 'ring-primary/50');
    }, 1800);
    return () => clearTimeout(t);
  }, [jumpSignal]);

  const filtered = messages;
  // (unread divider position is computed near the top of the component)

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 relative" style={{ minHeight: 0, overscrollBehavior: 'contain' }}>
      {/* Desktop reading lane: caps the conversation at a comfortable
          measure instead of letting bubbles span an ultrawide canvas. */}
      <div className="py-2 w-full lg:max-w-[760px] lg:mx-auto">
        {loadingMore && (
          <div className="text-center py-2">
            <span className="text-[10px] text-muted-foreground/50 font-medium">Loading older messages…</span>
          </div>
        )}

        {/* Empty state for no messages */}
        {messages.length === 0 && !isSearchActive && (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))' }}>
              <MessageSquare className="w-6 h-6 text-muted-foreground/65" />
            </div>
            <p className="text-sm text-muted-foreground/60 font-medium">Welcome to #{selectedChannel?.name}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">{selectedChannel?.description || 'Start the conversation'}</p>
          </div>
        )}

        {/* Empty state for search with no results */}
        {isSearchActive && messages.length === 0 && (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))' }}>
              <SearchX className="w-6 h-6 text-muted-foreground/65" />
            </div>
            <p className="text-sm text-muted-foreground/60 font-medium">No messages found</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">Try a different search term</p>
          </div>
        )}

        {filtered.map((msg, idx) => {
          const prevMsg = idx > 0 ? filtered[idx - 1] : null;
          const nextMsg = idx < filtered.length - 1 ? filtered[idx + 1] : null;
          const showDate = !prevMsg || getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at);
          const sameAuthor = !!prevMsg && prevMsg.user_id === msg.user_id &&
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 300000 &&
            getDateLabel(msg.created_at) === getDateLabel(prevMsg.created_at);
          const nextSameAuthor = !!nextMsg && nextMsg.user_id === msg.user_id &&
            new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime() < 300000 &&
            getDateLabel(msg.created_at) === getDateLabel(nextMsg.created_at);

          // Dynamic spacing: larger gap between different senders
          const senderGap = !sameAuthor && idx > 0 && !showDate;

          return (
            <div key={msg.id} data-message-id={msg.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}>
              {showDate && (
                <div className={cn("flex items-center gap-3", idx === 0 ? "py-3" : "pt-5 pb-3")}>
                  <div className="flex-1 h-px bg-border/10" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 px-2">{getDateLabel(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-border/10" />
                </div>
              )}

              {/* New messages divider */}
              {hasUnreadDivider && idx === unreadDividerAfterIdx + 1 && (
                <div ref={dividerRef} className="flex items-center gap-3 py-4">
                  <div className="flex-1 h-px bg-primary/25" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary/80 bg-primary/10 px-3 py-1 rounded-full">
                    {unreadCount === 1 ? '1 New Message' : `${unreadCount} New Messages`}
                  </span>
                  <div className="flex-1 h-px bg-primary/25" />
                </div>
              )}

              {/* Sender block spacer */}
              {senderGap && <div className="h-4" />}

              <MessageBubble
                msg={msg}
                isOwn={msg.user_id === userId}
                sameAuthor={sameAuthor}
                nextSameAuthor={nextSameAuthor}
                currentUserId={userId}
                currentDisplayName={currentDisplayName}
                isAuthorOnline={!!onlineUserIds?.has(msg.user_id)}
                onToggleReaction={onToggleReaction}
                onReply={onReply}
                onReplyJump={onReplyJump}
                onTogglePin={onTogglePin}
                onStartEditing={onStartEditing}
                onDeleteMessage={onDeleteMessage}
                onSaveEdit={onSaveEdit}
                editingMessageId={editingMessageId}
                editContent={editContent}
                onEditContentChange={onEditContentChange}
                onCancelEdit={onCancelEdit}
                isOverlayOpen={openOverlayMessageId === msg.id}
                onToggleOverlay={handleToggleOverlay}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom FAB */}
      <AnimatePresence>
        {!autoScroll && (
           <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={scrollToBottom}
            aria-label={newMsgCount > 0 ? `Jump to ${newMsgCount} new message${newMsgCount === 1 ? '' : 's'}` : 'Jump to latest message'}
            // 44×44 on mobile (HIG floating-action minimum), tighter
            // 40×40 on lg+ since pointer-precision is higher on desktop.
            className="sticky bottom-3 ml-auto mr-3 w-11 h-11 lg:w-10 lg:h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-20"
            style={{ touchAction: 'manipulation' }}
          >
            <ChevronDown className="w-5 h-5" />
            {newMsgCount > 0 && (
              <span aria-live="polite" className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
                {newMsgCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

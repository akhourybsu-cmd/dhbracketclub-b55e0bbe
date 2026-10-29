import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useLayoutEffect,
} from "react";
import { MessageSquare, ChevronDown, SearchX } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";
import type { Message, Channel } from "./types";
import { timelineArrivals } from "@/lib/chatTimeline";
import { chatMessagePreview } from "@/lib/chatExperience";

export interface TimelinePosition {
  top: number;
  atLatest: boolean;
}

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
  hasNewer?: boolean;
  onLoadLatest?: () => void;
  loading?: boolean;
  olderError?: string | null;
  onAtLatestChange?: (atLatest: boolean) => void;
  savedPosition?: TimelinePosition;
  onPositionChange?: (position: TimelinePosition) => void;
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

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function MessageList({
  messages,
  selectedChannel,
  userId,
  currentDisplayName,
  onToggleReaction,
  onReply,
  onReplyJump,
  onTogglePin,
  onStartEditing,
  onDeleteMessage,
  onSaveEdit,
  editingMessageId,
  editContent,
  onEditContentChange,
  onCancelEdit,
  onLoadMore,
  hasMore,
  hasNewer,
  onLoadLatest,
  loadingMore,
  loading,
  olderError,
  onAtLatestChange,
  savedPosition,
  onPositionChange,
  isSearchActive,
  lastReadAt,
  scrollToBottomTrigger,
  onlineUserIds,
  jumpSignal,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const initialPosition = useRef(savedPosition);
  const positionCallback = useRef(onPositionChange);
  positionCallback.current = onPositionChange;
  const [autoScroll, setAutoScroll] = useState(savedPosition?.atLatest ?? true);
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [openOverlayMessageId, setOpenOverlayMessageId] = useState<
    string | null
  >(null);
  const prevMsgCount = useRef(messages.length);
  const previousMessages = useRef<Message[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const reducedMotion = useReducedMotion();

  const handleToggleOverlay = useCallback((msgId: string | null) => {
    setOpenOverlayMessageId(msgId);
  }, []);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reducedMotion ? "auto" : behavior,
      });
    },
    [reducedMotion],
  );

  // Track whether we just switched channels — used by the auto-scroll
  // effect to know it should snap instantly (no smooth scroll) on the
  // first render after a channel change, and only smooth-scroll for
  // genuine new-message arrivals.
  const justSwitchedRef = useRef(true);

  // Unread divider: index of the last already-read message. It remains visible
  // in history, while opening a conversation always starts at the latest message.
  // Only messages from other people count as unread — your own never do.
  const unreadDividerAfterIdx = (() => {
    if (!lastReadAt || isSearchActive) return -1;
    const readAt = new Date(lastReadAt).getTime();
    const firstUnread = messages.findIndex(
      (m) => m.user_id !== userId && new Date(m.created_at).getTime() > readAt,
    );
    return firstUnread;
  })();
  const hasUnreadDivider = unreadDividerAfterIdx >= 0;
  const unreadCount = hasUnreadDivider
    ? messages.slice(unreadDividerAfterIdx).filter((m) => m.user_id !== userId)
        .length
    : 0;

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
    setAutoScroll(initialPosition.current?.atLatest ?? true);
    setNewMsgCount(0);
    justSwitchedRef.current = true;
    previousMessages.current = [];
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
  //   • First render after a channel switch → snap to latest instantly.
  //   • Sending your own message → always return to latest, even if you had
  //     scrolled upward before composing it.
  //   • Subsequent renders while autoScroll=true → smooth-scroll for
  //     new arrivals.
  //   • autoScroll=false → bump the "new messages" badge instead.
  useEffect(() => {
    // First render after a channel switch always opens at the latest message.
    if (justSwitchedRef.current) {
      // Wait until messages have loaded AND the channel's read-state has
      // resolved (undefined = still loading) before choosing where to land.
      if (messages.length === 0 || lastReadAt === undefined) return;
      justSwitchedRef.current = false;
      prevMsgCount.current = messages.length;
      previousMessages.current = messages;
      setNewMsgCount(0);
      const restore = initialPosition.current;
      if (!jumpSignal && restore && !restore.atLatest) {
        if (scrollRef.current) scrollRef.current.scrollTop = restore.top;
        setAutoScroll(false);
      } else {
        if (!jumpSignal) scrollToLatest("auto");
        setAutoScroll(!jumpSignal);
      }
      return;
    }

    const addedMessages = timelineArrivals(previousMessages.current, messages);
    const sentByCurrentUser = Boolean(
      userId &&
      addedMessages.some(
        (message) => message.user_id === userId && message._optimistic,
      ),
    );

    if (
      (autoScrollRef.current && addedMessages.length > 0) ||
      sentByCurrentUser
    ) {
      scrollToLatest("smooth");
      if (sentByCurrentUser) setAutoScroll(true);
      setNewMsgCount(0);
    } else if (!autoScroll && addedMessages.length > 0) {
      setNewMsgCount(
        (prev) =>
          prev +
          addedMessages.filter((message) => message.user_id !== userId).length,
      );
    }
    const incoming = addedMessages.filter(
      (message) => message.user_id !== userId,
    );
    if (incoming.length)
      setAnnouncement(
        `${incoming[incoming.length - 1].profiles?.display_name || "Club member"}: ${chatMessagePreview(incoming[incoming.length - 1].content, 120)}`,
      );
    previousMessages.current = messages;
    prevMsgCount.current = messages.length;
  }, [messages, autoScroll, lastReadAt, scrollToLatest, userId, jumpSignal]);

  useEffect(() => {
    onAtLatestChange?.(autoScroll && !hasNewer);
  }, [autoScroll, hasNewer, onAtLatestChange]);

  // Re-anchor on resize
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (autoScrollRef.current) {
          scrollToLatest("auto");
        }
      });
    });
    observer.observe(el);
    observer.observe(content);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
    };
  }, [autoScroll, scrollToLatest]);

  // External scroll-to-bottom trigger
  const latestTriggerRef = useRef(scrollToBottomTrigger);
  useEffect(() => {
    if (
      scrollToBottomTrigger &&
      scrollToBottomTrigger !== latestTriggerRef.current
    ) {
      latestTriggerRef.current = scrollToBottomTrigger;
      requestAnimationFrame(() => {
        scrollToLatest("auto");
        setAutoScroll(true);
        setNewMsgCount(0);
      });
    }
  }, [scrollToBottomTrigger, scrollToLatest]);

  // Passive scroll handler
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      autoScrollRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!el) return;

        if (
          el.scrollTop < 80 &&
          hasMore &&
          !loadingMore &&
          !olderError &&
          onLoadMore
        ) {
          onLoadMore();
        }

        const nearBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        positionCallback.current?.({ top: el.scrollTop, atLatest: nearBottom });
        setAutoScroll(nearBottom);
        if (nearBottom) setNewMsgCount(0);
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasMore, loadingMore, onLoadMore, olderError]);

  const scrollToBottom = () => {
    if (hasNewer && onLoadLatest) {
      onLoadLatest();
      return;
    }
    scrollToLatest("smooth");
    setAutoScroll(true);
    setNewMsgCount(0);
  };

  // Jump-to-message: scroll a target message into view and pulse a highlight
  // ring. Best-effort — if the message isn't in the loaded window it's a no-op.
  useEffect(() => {
    if (!jumpSignal) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-message-id="${jumpSignal.id}"]`,
    );
    if (!el) return;
    setAutoScroll(false);
    el.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
    el.classList.add(
      "rounded-xl",
      "ring-2",
      "ring-primary/50",
      "transition-shadow",
    );
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary/50");
    }, 1800);
    return () => clearTimeout(t);
  }, [jumpSignal, reducedMotion]);

  const filtered = messages;
  // (unread divider position is computed near the top of the component)

  return (
    <div className="chat-timeline relative flex min-h-0 flex-1">
      <div
        ref={scrollRef}
        role="log"
        aria-label={`Messages in ${selectedChannel?.name || "this channel"}`}
        aria-live="off"
        aria-busy={loading}
        className="chat-message-scroll flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 relative"
        style={{
          minHeight: 0,
          overscrollBehavior: "contain",
          overflowAnchor: "none",
          WebkitOverflowScrolling: "touch",
          scrollbarGutter: "stable",
        }}
      >
        {/* Desktop reading lane: caps the conversation at a comfortable
          measure instead of letting bubbles span an ultrawide canvas. */}
        <div
          ref={contentRef}
          className="chat-reading-lane py-2 w-full lg:max-w-[760px] lg:mx-auto"
        >
          {olderError && (
            <button
              type="button"
              className="chat-history-retry"
              onClick={onLoadMore}
            >
              Couldn’t load earlier messages · Retry
            </button>
          )}
          {loading && messages.length === 0 && (
            <div
              className="chat-message-skeleton"
              role="status"
              aria-label="Loading messages"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} data-own={n % 3 === 0}>
                  <span />
                  <span />
                </div>
              ))}
            </div>
          )}
          {/* Floating pill so loading older history never pushes the conversation down. */}
          {loadingMore && (
            <div className="sticky top-2 z-10 h-0 flex justify-center pointer-events-none">
              <span className="text-[10px] text-muted-foreground font-medium bg-card/95 border border-border/40 rounded-full px-3 py-1 shadow-sm">
                Loading older messages…
              </span>
            </div>
          )}

          {/* Empty state for no messages */}
          {messages.length === 0 && !loading && !isSearchActive && (
            <div className="chat-conversation-empty text-center py-20">
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))",
                }}
              >
                <MessageSquare className="w-6 h-6 text-muted-foreground/65" />
              </div>
              <p className="text-sm text-foreground font-semibold">
                Make the first move.
              </p>
              <p className="text-[13px] text-muted-foreground mt-1">
                {selectedChannel?.description ||
                  `Start something in #${selectedChannel?.name || "this channel"}.`}
              </p>
            </div>
          )}

          {/* Empty state for search with no results */}
          {isSearchActive && messages.length === 0 && (
            <div className="text-center py-20">
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))",
                }}
              >
                <SearchX className="w-6 h-6 text-muted-foreground/65" />
              </div>
              <p className="text-sm text-muted-foreground/60 font-medium">
                No messages found
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Try a different search term
              </p>
            </div>
          )}

          {filtered.map((msg, idx) => {
            const prevMsg = idx > 0 ? filtered[idx - 1] : null;
            const nextMsg =
              idx < filtered.length - 1 ? filtered[idx + 1] : null;
            const showDate =
              !prevMsg ||
              getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at);
            const sameAuthor =
              !!prevMsg &&
              prevMsg.user_id === msg.user_id &&
              new Date(msg.created_at).getTime() -
                new Date(prevMsg.created_at).getTime() <
                300000 &&
              getDateLabel(msg.created_at) === getDateLabel(prevMsg.created_at);
            const nextSameAuthor =
              !!nextMsg &&
              nextMsg.user_id === msg.user_id &&
              new Date(nextMsg.created_at).getTime() -
                new Date(msg.created_at).getTime() <
                300000 &&
              getDateLabel(msg.created_at) === getDateLabel(nextMsg.created_at);

            // Dynamic spacing: larger gap between different senders
            const senderGap = !sameAuthor && idx > 0 && !showDate;

            return (
              <div key={msg.id} data-message-id={msg.id}>
                {showDate && (
                  <div
                    className={cn(
                      "chat-date-divider flex items-center gap-3",
                      idx === 0 ? "py-3" : "pt-5 pb-3",
                    )}
                  >
                    <div className="flex-1 h-px bg-border/10" />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 px-2">
                      {getDateLabel(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-border/10" />
                  </div>
                )}

                {/* New messages divider */}
                {hasUnreadDivider && idx === unreadDividerAfterIdx && (
                  <div
                    ref={dividerRef}
                    className="flex items-center gap-3 py-4"
                  >
                    <div className="flex-1 h-px bg-primary/25" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary/80 bg-primary/10 px-3 py-1 rounded-full">
                      {unreadCount === 1
                        ? "1 New Message"
                        : `${unreadCount} New Messages`}
                    </span>
                    <div className="flex-1 h-px bg-primary/25" />
                  </div>
                )}

                {/* Sender block spacer */}
                {senderGap && <div className="h-4" />}

                <MessageBubble
                  msg={msg}
                  keyboardEntry={idx === filtered.length - 1}
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
      </div>
      <span id="chat-message-keyboard-help" className="sr-only">
        Use Up and Down to move through messages. Enter opens message actions.
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      {/* Scroll-to-bottom FAB */}
      <AnimatePresence>
        {(!autoScroll || hasNewer) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={scrollToBottom}
            aria-label={
              newMsgCount > 0
                ? `Jump to ${newMsgCount} new message${newMsgCount === 1 ? "" : "s"}`
                : "Jump to latest message"
            }
            // 44×44 on mobile (HIG floating-action minimum), tighter
            // 40×40 on lg+ since pointer-precision is higher on desktop.
            className="chat-latest-button absolute bottom-3 right-4 h-11 min-w-11 gap-2 rounded-full bg-primary px-3 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-20"
            style={{ touchAction: "manipulation" }}
          >
            <ChevronDown className="w-5 h-5" />
            <span className="text-xs font-semibold">
              {newMsgCount ? `${newMsgCount} new` : "Latest"}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

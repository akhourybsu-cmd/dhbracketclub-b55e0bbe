export type ChannelType = 'general' | 'announcements' | 'admin_only' | 'event';
export type PostPermission = 'all' | 'admins';
export type NotificationMode = 'all' | 'mentions' | 'muted';

export type Channel = {
  id: string;
  club_id?: string;
  name: string;
  description: string | null;
  icon: string | null;
  category_id: string | null;
  position: number;
  is_default: boolean;
  channel_type: ChannelType;
  post_permission: PostPermission;
  archived_at?: string | null;
};

export type Category = { id: string; name: string; position: number };

export type MessageReaction = {
  emoji: string;
  count: number;
  user_reacted: boolean;
};

export type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  parent_message_id: string | null;
  is_pinned: boolean;
  created_at: string;
  edited_at: string | null;
  profiles?: { display_name: string; avatar_url: string | null };
  reply_count?: number;
  reactions?: MessageReaction[];
  _optimistic?: boolean;
  /** Inline reply: the message this one is replying to. */
  reply_to_id?: string | null;
  /** Denormalized preview of the referenced message (for the quoted reference). */
  reply_to?: { id: string; content: string; user_id: string; display_name?: string | null } | null;
};

export type ChannelMeta = {
  lastMessage?: string;
  lastMessageAt?: string;
  lastAuthor?: string;
  lastAuthorId?: string;
  unread: boolean;
  /** Best-effort count from the recent-message window loaded for the sidebar. */
  unreadCount?: number;
  /** Unread messages in that window that explicitly mention the current member. */
  mentionCount?: number;
};

// Trimmed to 6 (iMessage-style tapback count) so the action overlay
// fits comfortably on narrow phones alongside Reply / Pin / Edit / Delete.
export const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '💀', '👀'];

export const CHANNEL_EMOJI: Record<string, string> = {
  general: '💬',
  announcements: '📢',
  sports: '🏀',
  'movies-tv': '🎬',
  food: '🍕',
  random: '🎲',
  trips: '✈️',
  fantasy: '🏆',
};

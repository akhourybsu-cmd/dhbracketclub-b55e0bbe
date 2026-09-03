import { useState, useMemo, memo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Hash, Plus, Settings, GripVertical, FolderPlus, Menu, ChevronDown } from 'lucide-react';
import { useNavDrawer } from '@/contexts/NavDrawerContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Channel, Category, ChannelMeta } from './types';
import { CHANNEL_EMOJI } from './types';
import { getChannelTypeMeta } from './channelTypeMeta';
import { StatusPill } from '@/components/ui/status-pill';

interface ChannelListProps {
  channels: Channel[];
  categories: Category[];
  channelMeta: Map<string, ChannelMeta>;
  selectedChannel: Channel | null;
  currentUserId?: string;
  isAdmin?: boolean;
  loading: boolean;
  onSelectChannel: (ch: Channel) => void;
  onCreateChannel: (name: string, categoryId: string) => void;
  onEditChannel?: (channelId: string, newName: string) => void;
  onReorderChannels?: (categoryId: string, reordered: Channel[]) => void;
  onOpenSettings?: (channel: Channel) => void;
  onCreateCategory?: (name: string) => void;
}

function formatPreviewTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  if (differenceInDays(new Date(), d) < 7) return format(d, 'EEE');
  return format(d, 'MMM d');
}

interface ChannelRowProps {
  ch: Channel;
  meta: ChannelMeta | undefined;
  isCurrent: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  reorderEnabled: boolean;
  onSelect: () => void;
  onOpenSettings?: (ch: Channel) => void;
}

const ChannelRow = memo(function ChannelRow({ ch, meta, isCurrent, currentUserId, isAdmin, reorderEnabled, onSelect, onOpenSettings }: ChannelRowProps) {
  const dragControls = useDragControls();
  const lastIsMine = !!currentUserId && meta?.lastAuthorId === currentUserId;
  // Hard guard: never show unread when the latest message is from the current user
  const isUnread = !!meta?.unread && !lastIsMine;
  const typeMeta = getChannelTypeMeta(ch.channel_type);
  const TypeIcon = typeMeta.icon;
  const isElevated = ch.channel_type === 'announcements' || ch.channel_type === 'admin_only';
  const emoji = (ch.icon && ch.icon !== 'hash') ? ch.icon : CHANNEL_EMOJI[ch.name];
  const hasPreview = !!meta?.lastMessage;

  // Truncate the last message — strip image-only URLs for cleaner preview
  let previewText = meta?.lastMessage || '';
  let isPhotoOnly = false;
  if (previewText) {
    const lines = previewText.split('\n').filter(l => l.trim());
    const firstTextLine = lines.find(l => !/^(?:https?|lovable-private):\/\/\S+$/.test(l.trim()));
    if (firstTextLine) {
      previewText = firstTextLine;
    } else if (lines.length > 0) {
      previewText = 'Photo';
      isPhotoOnly = true;
    } else {
      previewText = '';
    }
  }
  const previewPrefix = lastIsMine ? 'You' : (meta?.lastAuthor || '');

  return (
    <Reorder.Item
      value={ch}
      dragListener={false}
      dragControls={dragControls}
      className="list-none"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
        className={cn(
          // Discord-style row: a thin left-edge accent bar appears
          // on the active channel via a pseudo-element. Inactive rows
          // get the standard hover-tint; unread rows lift slightly.
            "relative w-full min-h-[62px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 cursor-pointer group active:bg-muted/50 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // Active state — stronger bg + dedicated treatment
          isCurrent
            ? "bg-primary/12 hover:bg-primary/15"
            : isUnread
              ? "bg-muted/35 hover:bg-muted/45"
              : "hover:bg-muted/25",
        )}
      >
        {/* Active channel left-edge accent strip — Discord's signature
            "you are here" cue. Only renders on the selected row. */}
        {isCurrent && (
          <span
            aria-hidden
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary"
            style={{ boxShadow: '0 0 8px hsl(var(--primary) / 0.6)' }}
          />
        )}

        {/* Icon tile */}
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0 transition-colors relative",
            !isElevated && (isCurrent ? "bg-primary/20" : isUnread ? "bg-primary/12" : "bg-muted/40"),
          )}
          style={isElevated ? { background: `hsl(${typeMeta.accent} / ${isUnread ? 0.22 : 0.14})` } : undefined}
        >
          {isElevated
            ? <TypeIcon className="w-4 h-4" style={{ color: `hsl(${typeMeta.accent})` }} />
            : emoji ? emoji : <Hash className="w-4 h-4 text-muted-foreground/60" />}
        </div>

        {/* Title + preview */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-[14px] tracking-tight truncate flex items-center gap-1.5",
              isUnread ? "font-bold text-foreground" : isCurrent ? "font-bold text-foreground" : "font-semibold text-foreground/85",
            )}>
              {/* Discord-style "# " prefix when the channel has no
                  custom emoji icon — makes the row read as a true
                  text channel instead of a generic list item. */}
              {!emoji && !isElevated && (
                <span className="text-muted-foreground/45 font-medium flex-shrink-0">#</span>
              )}
              <span className="truncate">{ch.name}</span>
              {isElevated && (
                <StatusPill accent={typeMeta.accent} size="xs" className="flex-shrink-0">
                  {ch.channel_type === 'announcements' ? 'News' : 'Admin'}
                </StatusPill>
              )}
            </span>
            {meta?.lastMessageAt && (
              <span className={cn(
                "text-[10px] font-medium flex-shrink-0 tabular-nums",
                isUnread ? "text-primary font-semibold" : "text-muted-foreground/55",
              )}>
                {formatPreviewTime(meta.lastMessageAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {hasPreview ? (
              <p className={cn(
                "text-[12px] truncate flex-1 min-w-0",
                isUnread ? "text-foreground/85 font-medium" : "text-muted-foreground/65",
              )}>
                {previewPrefix && <span className={cn("font-semibold", isUnread ? "text-foreground/90" : "text-foreground/60")}>{previewPrefix}: </span>}
                {isPhotoOnly ? (lastIsMine ? 'sent a photo' : 'sent a photo') : previewText}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/45 truncate flex-1 italic">
                {ch.description || 'No messages yet'}
              </p>
            )}
            {isUnread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
          </div>
        </div>

        {/* Drag handle — long-press to reorder. Hidden by default; visible on group-hover (desktop) or always when reorder enabled. */}
        {reorderEnabled && (
          <button
            onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
            onClick={(e) => e.stopPropagation()}
            className="hidden lg:flex flex-shrink-0 items-center justify-center w-7 h-7 rounded-md opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-opacity touch-none"
            title="Drag to reorder"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}

        {/* Settings — admin only */}
        {onOpenSettings && isAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onOpenSettings(ch); }}
            className="flex-shrink-0 p-1.5 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted/50 transition-opacity hidden lg:block"
            title="Channel settings"
            aria-label="Channel settings"
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </Reorder.Item>
  );
}, (prev, next) =>
  prev.ch.id === next.ch.id &&
  prev.ch.name === next.ch.name &&
  prev.ch.icon === next.ch.icon &&
  prev.ch.channel_type === next.ch.channel_type &&
  prev.isCurrent === next.isCurrent &&
  prev.meta === next.meta &&
  prev.reorderEnabled === next.reorderEnabled &&
  prev.currentUserId === next.currentUserId &&
  prev.isAdmin === next.isAdmin
);

// localStorage key for collapsed category IDs. Per-user persistence
// would require keying off user_id, but for now this is a simple
// device-local UX setting — the same user sees their collapse state
// across sessions regardless of which DH club they're in.
const COLLAPSED_CATEGORIES_KEY = 'dh_chat_collapsed_categories_v1';

function readCollapsedCategories(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_CATEGORIES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function writeCollapsedCategories(s: Set<string>) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(COLLAPSED_CATEGORIES_KEY, JSON.stringify([...s])); } catch { /* full storage */ }
}

export function ChannelList({
  channels, categories, channelMeta, selectedChannel, currentUserId, isAdmin,
  loading, onSelectChannel, onCreateChannel, onReorderChannels,
  onOpenSettings, onCreateCategory,
}: ChannelListProps) {
  const { setOpen: setNavOpen } = useNavDrawer();
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(readCollapsedCategories);

  // Persist collapse state on change.
  useEffect(() => { writeCollapsedCategories(collapsedCategories); }, [collapsedCategories]);

  // Defensive: if the active channel is inside a collapsed category,
  // auto-expand that category so the active row is always visible.
  // Without this, picking a channel from search / mobile drawer could
  // hide it on return to the list — confusing.
  useEffect(() => {
    if (!selectedChannel?.category_id) return;
    if (!collapsedCategories.has(selectedChannel.category_id)) return;
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.delete(selectedChannel.category_id);
      return next;
    });
  }, [selectedChannel?.category_id, collapsedCategories]);

  const toggleCategory = useCallback((id: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Sort channels within each category by most recent activity (unread/recent on top), preserving fallback to position
  const groupedChannels = useMemo(() => categories.map(cat => {
    const chs = channels.filter(ch => ch.category_id === cat.id);
    const sorted = [...chs].sort((a, b) => {
      const ma = channelMeta.get(a.id);
      const mb = channelMeta.get(b.id);
      const ta = ma?.lastMessageAt ? new Date(ma.lastMessageAt).getTime() : 0;
      const tb = mb?.lastMessageAt ? new Date(mb.lastMessageAt).getTime() : 0;
      if (ta !== tb) return tb - ta;
      return a.position - b.position;
    });
    return { ...cat, channels: sorted };
  }), [categories, channels, channelMeta]);

  const handleCreate = () => {
    if (!newChannelName.trim()) return;
    onCreateChannel(newChannelName.trim().toLowerCase().replace(/\s+/g, '-'), newChannelCategory || categories[0]?.id || '');
    setNewChannelName('');
    setShowNewChannel(false);
  };

  const handleCreateCat = () => {
    if (!newCategoryName.trim() || !onCreateCategory) return;
    onCreateCategory(newCategoryName.trim());
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  return (
    <div
      className="px-3 pt-2 pb-6 lg:pb-4 lg:px-4"
      style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
    >
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header — slim treatment to match the rest of the app's
            compact section headers. Title was previously text-2xl
            (24px) on every breakpoint which made this header feel
            disproportionately large vs. the channel rows below;
            shrunk to text-[17px] / sm:text-lg and tightened the
            vertical chrome (pb-2 mb-3) so the channel list reads
            as the primary content of this column. */}
        <div className="flex items-center gap-2 border-b border-border/10 pb-2 mb-3 px-1">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setNavOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted/40 active:bg-muted/60 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-foreground/85" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] sm:text-lg font-extrabold tracking-tight leading-tight">Chat</h1>
            <p className="text-[10.5px] text-muted-foreground/55 font-medium leading-none mt-0.5">DH conversations</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1">
              {onCreateCategory && (
                <Button size="sm" variant="ghost" onClick={() => setShowNewCategory(true)} className="h-11 w-11 lg:h-9 lg:w-9 p-0 rounded-xl hover:bg-muted/30" title="New Category" aria-label="New Category">
                  <FolderPlus className="w-4 h-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(true)} className="h-11 w-11 lg:h-9 lg:w-9 p-0 rounded-xl hover:bg-muted/30" title="New Channel" aria-label="New Channel">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* New Category inline form */}
        <AnimatePresence>
          {showNewCategory && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-xs font-bold">New Category</h3>
                <Input placeholder="Category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="h-9 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateCat} disabled={!newCategoryName.trim()} className="flex-1 h-11 text-xs font-bold">Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewCategory(false)} className="h-11 text-xs">Cancel</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showNewChannel && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-xs font-bold">New Channel</h3>
                <Input placeholder="channel-name" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} className="h-9 text-sm" />
                <select value={newChannelCategory} onChange={e => setNewChannelCategory(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={!newChannelName.trim()} className="flex-1 h-11 text-xs font-bold">Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(false)} className="h-11 text-xs">Cancel</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          {groupedChannels.map(group => {
            if (group.channels.length === 0) return null;
            const isCollapsed = collapsedCategories.has(group.id);
            // Count unread channels in this group so the badge on a
            // collapsed category can show "you have things to read."
            const unreadInGroup = group.channels.reduce((n, ch) => {
              const m = channelMeta.get(ch.id);
              const lastIsMine = !!currentUserId && m?.lastAuthorId === currentUserId;
              return n + (m?.unread && !lastIsMine ? 1 : 0);
            }, 0);
            return (
              <div key={group.id}>
                {/* Discord-style category header: clickable chevron +
                    uppercase label + optional unread count when
                    collapsed. The whole row toggles. */}
                <button
                  type="button"
                  onClick={() => toggleCategory(group.id)}
                  // Explicit min-h on mobile so the chevron + label
                  // has a real 36px tap zone. Desktop is unchanged
                  // (the row collapses to its natural text height).
                  className="w-full flex items-center gap-1.5 px-2 mb-1.5 group/cat rounded-lg hover:bg-muted/15 transition-colors active:scale-[0.99] min-h-11 lg:min-h-0"
                  aria-expanded={!isCollapsed}
                >
                  <ChevronDown
                    className={cn(
                      'w-3 h-3 text-muted-foreground/55 transition-transform',
                      isCollapsed && '-rotate-90',
                    )}
                  />
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/65 group-hover/cat:text-muted-foreground/85 transition-colors">
                    {group.name}
                  </p>
                  {isCollapsed && unreadInGroup > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full bg-primary text-[9px] font-extrabold text-primary-foreground tabular-nums">
                      {unreadInGroup}
                    </span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <Reorder.Group
                        axis="y"
                        values={group.channels}
                        onReorder={(newOrder) => onReorderChannels?.(group.id, newOrder)}
                        className="space-y-0.5"
                      >
                        {group.channels.map((ch) => (
                          <ChannelRow
                            key={ch.id}
                            ch={ch}
                            meta={channelMeta.get(ch.id)}
                            isCurrent={selectedChannel?.id === ch.id}
                            currentUserId={currentUserId}
                            isAdmin={isAdmin}
                            reorderEnabled={!!onReorderChannels && !!isAdmin}
                            onSelect={() => onSelectChannel(ch)}
                            onOpenSettings={onOpenSettings}
                          />
                        ))}
                      </Reorder.Group>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {loading && channels.length === 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 px-2 mb-1.5">
              <span className="inline-block h-2 w-16 rounded skeleton-shimmer" />
            </p>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                <div className="w-10 h-10 rounded-xl skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded-md w-24 skeleton-shimmer" />
                  <div className="h-2.5 rounded-md w-40 skeleton-shimmer" />
                </div>
                <div className="h-2.5 w-10 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        )}

        {channels.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.03))' }}>
              <Hash className="w-7 h-7 text-primary/40" />
            </div>
            <p className="text-sm text-muted-foreground/70 font-semibold">No channels yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create one to start chatting with the crew</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

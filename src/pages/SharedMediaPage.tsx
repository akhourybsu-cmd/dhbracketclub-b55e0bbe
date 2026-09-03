import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { cn } from '@/lib/utils';
import { Link2, Image as ImageIcon, Play, Music, Globe, ExternalLink, Loader2, Filter, Trash2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { ChatAttachmentImage } from '@/components/chat/ChatAttachmentImage';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MediaType = 'all' | 'link' | 'image' | 'youtube' | 'spotify';

interface MediaItem {
  id: string;
  url: string;
  content_type: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  embed_type: string | null;
  embed_id: string | null;
  created_at: string;
  message_id: string;
  channel_id?: string;
  user_id?: string;
  sender_name?: string;
  sender_avatar?: string | null;
  channel_name?: string;
}

const TYPE_TABS: { value: MediaType; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Globe },
  { value: 'link', label: 'Links', icon: Link2 },
  { value: 'image', label: 'Images', icon: ImageIcon },
  { value: 'youtube', label: 'YouTube', icon: Play },
  { value: 'spotify', label: 'Spotify', icon: Music },
];

const PAGE_SIZE = 30;

export default function SharedMediaPage() {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<MediaType>('all');
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  // Cursor-based pagination: oldestCreatedAt is the `created_at` of
  // the oldest item we currently hold. Next page fetches `lt(created_at,
  // oldestCreatedAt)`. hasMore flips false when the server returns
  // fewer than PAGE_SIZE rows.
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Stable ref so the realtime subscription effect doesn't have to depend
  // on fetchMedia (which itself depends on filters). Avoids tearing down
  // + recreating the channel on every filter change.
  const fetchRef = useRef<() => Promise<void>>();

  /** Internal page loader. mode='initial' resets everything;
   *  mode='more' appends and uses the existing cursor. */
  const loadPage = useCallback(async (mode: 'initial' | 'more') => {
    if (!user) return;
    if (mode === 'initial') {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      // Step 1: when filtering by channel, resolve message_ids for that
      // channel server-side first.
      let scopedMessageIds: string[] | null = null;
      if (filterChannel !== 'all') {
        const { data: msgs, error: mErr } = await supabase
          .from('messages')
          .select('id')
          .eq('channel_id', filterChannel)
          .order('created_at', { ascending: false })
          .limit(500);
        if (mErr) throw mErr;
        scopedMessageIds = (msgs ?? []).map((m: any) => m.id);
        if (scopedMessageIds.length === 0) {
          if (mode === 'initial') setItems([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
      }

      // Step 2: pull previews. RLS scopes to current club automatically.
      let query = supabase
        .from('message_link_previews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (activeType !== 'all') {
        query = query.eq('content_type', activeType);
      }
      if (scopedMessageIds) {
        query = query.in('message_id', scopedMessageIds);
      }
      // Cursor: only on "more" loads, never on initial (which is the
      // newest page).
      if (mode === 'more' && oldestCreatedAt) {
        query = query.lt('created_at', oldestCreatedAt);
      }

      const { data: previews, error: pErr } = await query;
      if (pErr) throw pErr;
      const rows = previews ?? [];
      // hasMore = server returned a full page; if it returned fewer
      // than PAGE_SIZE we know there's nothing more after this batch.
      const morePossible = rows.length === PAGE_SIZE;
      if (rows.length === 0) {
        if (mode === 'initial') setItems([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const messageIds = [...new Set(rows.map((p: any) => p.message_id))];
      const { data: messagesData, error: msgErr } = await supabase
        .from('messages')
        .select('id, channel_id, user_id, profiles:user_id(display_name, avatar_url)')
        .in('id', messageIds);
      if (msgErr) throw msgErr;

      const msgMap = new Map<string, any>();
      (messagesData || []).forEach((m: any) => msgMap.set(m.id, m));

      const channelIds = [...new Set((messagesData || []).map((m: any) => m.channel_id).filter(Boolean))];
      const { data: chData } = channelIds.length > 0
        ? await supabase.from('channels').select('id, name').in('id', channelIds)
        : { data: [] };
      const chMap = new Map((chData || []).map(c => [c.id, c.name]));

      const newBatch: MediaItem[] = rows.map((p: any) => {
        const msg = msgMap.get(p.message_id);
        return {
          ...p,
          channel_id: msg?.channel_id,
          user_id: msg?.user_id,
          sender_name: msg?.profiles?.display_name || 'Unknown',
          sender_avatar: msg?.profiles?.avatar_url || null,
          channel_name: chMap.get(msg?.channel_id) || 'Unknown',
        };
      });

      // Merge + dedup by (message_id, url). Realtime INSERTs can race
      // with a "load more" so the safety-net dedup is important here.
      setItems(prev => {
        const merged = mode === 'initial' ? newBatch : [...prev, ...newBatch];
        const seen = new Set<string>();
        return merged.filter(item => {
          const key = `${item.message_id}:${item.url}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      // Advance cursor to the oldest row in this batch.
      const oldest = rows[rows.length - 1]?.created_at as string | undefined;
      if (oldest) setOldestCreatedAt(oldest);
      setHasMore(morePossible);
    } catch (err: any) {
      console.error('SharedMedia fetch error:', err);
      if (mode === 'initial') {
        setError(err?.message ?? 'Failed to load shared media.');
        setItems([]);
      } else {
        toast.error(`Couldn't load more: ${err?.message ?? 'unknown error'}`);
      }
    }
    setLoading(false);
    setLoadingMore(false);
  }, [user, activeType, filterChannel, oldestCreatedAt]);

  // Initial-load wrapper used by the realtime + retry paths.
  const fetchMedia = useCallback(async () => {
    setOldestCreatedAt(null);
    setHasMore(true);
    await loadPage('initial');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeType, filterChannel]);

  const loadMore = useCallback(() => loadPage('more'), [loadPage]);

  useEffect(() => { fetchRef.current = fetchMedia; }, [fetchMedia]);
  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  // Fetch channels once.
  useEffect(() => {
    supabase.from('channels').select('id, name').order('position').then(({ data }) => {
      if (data) setChannels(data);
    });
  }, []);

  // Realtime: new shared link previews appear without a manual refresh.
  // Scoped by club_id so other clubs' inserts are filtered out at the
  // realtime broker level (in addition to RLS). The effect re-subscribes
  // only when the club changes — filter changes use the existing fetch.
  useEffect(() => {
    if (!club?.id) return;
    const channel = (supabase as any)
      .channel(`shared-media:${club.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_link_previews', filter: `club_id=eq.${club.id}` },
        () => { fetchRef.current?.(); },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_link_previews', filter: `club_id=eq.${club.id}` },
        (payload: any) => {
          // Optimistic — remove deleted id from local view without a refetch.
          const deletedId = payload.old?.id;
          if (deletedId) setItems(prev => prev.filter(i => i.id !== deletedId));
        },
      )
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [club?.id]);

  const handleDelete = async (itemId: string) => {
    // Optimistic: hide immediately, rollback on RLS denial so the user
    // sees a clear error if they're not the sender / admin.
    const snapshot = items;
    setItems(prev => prev.filter(i => i.id !== itemId));
    const { error } = await supabase.from('message_link_previews').delete().eq('id', itemId);
    if (error) {
      setItems(snapshot);
      // Postgrest surfaces a friendly message when the delete row count
      // is zero — most often that means RLS rejected the row.
      toast.error(error.message?.includes('Results contain 0 rows')
        ? "You can only remove links you shared (or ask an admin)."
        : `Couldn't remove: ${error.message}`);
    } else {
      toast.success('Removed from shared');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'youtube': return <Play className="w-3 h-3 text-[#FF0000]" />;
      case 'spotify': return <Music className="w-3 h-3 text-[#1DB954]" />;
      case 'image': return <ImageIcon className="w-3 h-3 text-primary/70" />;
      default: return <Link2 className="w-3 h-3 text-muted-foreground/60" />;
    }
  };

  return (
    <div className="member-page space-y-5">
      <div className="page-header mb-0">
        <div className="page-header-icon"><Link2 /></div>
        <div>
          <h1 className="page-header-title">Shared Media</h1>
          <p className="page-header-subtitle">Links and media from every channel</p>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TYPE_TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeType === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveType(tab.value)}
              className={cn(
                "flex min-h-11 items-center gap-1.5 px-3 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-150",
                active
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "bg-muted/15 text-muted-foreground/60 border border-border/10 hover:bg-muted/30 hover:text-foreground/70"
              )}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Channel filter — flex-1 on phones so it doesn't overflow at 360px;
          capped on sm+. */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="h-11 text-xs flex-1 sm:max-w-[220px] bg-muted/20 border-border/35 rounded-xl">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {channels.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>#{ch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Media grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-muted-foreground/40 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'hsl(var(--destructive) / 0.12)' }}>
            <AlertCircle className="w-6 h-6 text-destructive/70" />
          </div>
          <p className="text-sm font-medium">Couldn't load shared media</p>
          <p className="text-[11px] text-muted-foreground/55 mt-1 max-w-xs mx-auto break-words">{error}</p>
          <button
            onClick={() => fetchMedia()}
            className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-[11.5px] font-extrabold bg-muted/30 border border-border/40 active:scale-95"
          >
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        // Distinguish filtered-empty from truly-empty so the user knows
        // whether to share a link or just relax the filter.
        (() => {
          const filtered = activeType !== 'all' || filterChannel !== 'all';
          return (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))' }}>
                <Link2 className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground/60 font-medium">
                {filtered ? 'No matches for these filters' : 'No shared media yet'}
              </p>
              <p className="text-[11px] text-muted-foreground/40 mt-1">
                {filtered
                  ? 'Try a different type or channel filter.'
                  : 'Links and media shared in chat will appear here.'}
              </p>
              {filtered && (
                <button
                  onClick={() => { setActiveType('all'); setFilterChannel('all'); }}
                  className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-[11px] font-bold bg-muted/30 border border-border/40 active:scale-95"
                >
                  Reset filters
                </button>
              )}
            </div>
          );
        })()
      ) : (
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
          {items.map(item => (
            <MediaItemCard
              key={item.id}
              item={item}
              getTypeIcon={getTypeIcon}
              onDelete={handleDelete}
              canDelete={!!user && (item.user_id === user.id || isClubAdmin)}
            />
          ))}
          {/* Load more — only shows when the server might have more
              rows than we've fetched. Uses cursor pagination via
              created_at so duplicates are impossible. */}
          {hasMore && (
            <div className="pt-2 pb-4 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-[11.5px] font-extrabold bg-muted/30 border border-border/40 hover:bg-muted/50 active:scale-95 transition disabled:opacity-55"
              >
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
          {!hasMore && items.length >= PAGE_SIZE && (
            <p className="text-center text-[10.5px] text-muted-foreground/40 py-3">You've reached the end.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MediaItemCard({ item, getTypeIcon, onDelete, canDelete }: { item: MediaItem; getTypeIcon: (type: string) => React.ReactNode; onDelete: (id: string) => void; canDelete: boolean }) {
  const isPrivateImage = item.content_type === 'image' && item.url.startsWith('lovable-private://');
  let hostname = '';
  try { hostname = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}

  // For private attachments, the outer anchor href can't be the sentinel.
  // Disable the outer anchor; the thumbnail itself opens the signed URL.
  const Wrapper: any = isPrivateImage ? 'div' : 'a';
  const wrapperProps = isPrivateImage
    ? { className: 'block' }
    : { href: item.url, target: '_blank', rel: 'noopener noreferrer', className: 'block' };

  return (
    <div className="glass-card p-3.5 hover:bg-muted/15 transition-colors group relative">
      <Wrapper {...wrapperProps}>
        <div className="flex gap-3 relative z-10">
          {/* Thumbnail */}
          {item.content_type === 'image' ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted/20">
              {isPrivateImage ? (
                <ChatAttachmentImage url={item.url} className="!max-w-none !max-h-none w-full h-full !rounded-none !border-0" />
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
          ) : item.content_type === 'youtube' && item.embed_id ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black/30 relative">
              <img src={`https://img.youtube.com/vi/${item.embed_id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-[#FF0000] flex items-center justify-center">
                  <Play className="w-3 h-3 text-white fill-white ml-px" />
                </div>
              </div>
            </div>
          ) : item.image_url ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted/20">
              <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg flex-shrink-0 bg-muted/12 flex items-center justify-center">
              {getTypeIcon(item.content_type)}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-[12px] font-semibold text-foreground/85 leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              {item.title || hostname || 'Link'}
            </p>
            {item.description && (
              <p className="text-[10px] text-muted-foreground/50 leading-snug line-clamp-1">{item.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
                {getTypeIcon(item.content_type)}
                {hostname}
              </span>
              {item.channel_name && (
                <>
                  <span className="text-[8px] text-muted-foreground/30">•</span>
                  <span className="text-[9px] text-muted-foreground/40">#{item.channel_name}</span>
                </>
              )}
              <span className="text-[8px] text-muted-foreground/30">•</span>
              <span className="text-[9px] text-muted-foreground/35">{format(new Date(item.created_at), 'MMM d')}</span>
            </div>
            {item.sender_name && (
              <div className="flex items-center gap-1.5 mt-1">
                <UserAvatar userId={item.user_id || ''} name={item.sender_name} avatarUrl={item.sender_avatar} size={14} />
                <span className="text-[9px] text-muted-foreground/40 font-medium">{item.sender_name}</span>
              </div>
            )}
          </div>

          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0 mt-0.5" />
        </div>
      </Wrapper>

      {/* Delete button — only rendered when the viewer can actually
          delete (sender or club admin). Hides clutter for everyone else. */}
      {canDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item.id); }}
          className="absolute top-2 right-2 w-11 h-11 rounded-xl bg-destructive/10 text-destructive/70 hover:bg-destructive/20 hover:text-destructive opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-20 flex items-center justify-center"
          title="Remove from shared"
          aria-label="Remove from shared"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

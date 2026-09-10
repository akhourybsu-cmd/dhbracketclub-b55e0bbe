import { useEffect } from 'react';
import { useInfiniteQuery, useIsMutating, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { memberData, memberErrorMessage } from '@/lib/memberData';
import { notificationCursor } from '@/lib/notifications';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

export interface AppNotification {
  id: string; user_id: string; club_id: string | null; type: string; title: string;
  body: string | null; url: string | null; actor_user_id: string | null; read_at: string | null; created_at: string;
}
// notifications is not in the generated schema yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
interface Cursor { id: string; created_at: string }
interface Page { rows: AppNotification[]; cursor: Cursor | null }
type Inbox = InfiniteData<Page>;
type Change = { operation: 'read' | 'all' | 'dismiss'; id?: string; at: string };
const subscriptions = new WeakMap<QueryClient, Map<string, { users: number; close: () => void }>>();

function subscribeInbox(cache: QueryClient, uid: string) {
  let registry = subscriptions.get(cache);
  if (!registry) { registry = new Map(); subscriptions.set(cache, registry); }
  let shared = registry.get(uid);
  if (!shared) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = sb.channel('notifications-' + uid + '-' + Date.now() + '-' + Math.random());
    try {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!cache.isMutating({ mutationKey: ['notifications',uid,'write'] })) void cache.invalidateQueries({queryKey:['notifications',uid]});
        }, 200);
      }).subscribe();
    } catch {
      // The bounded 30-second polling path also covers reconnects/realtime outages.
    }
    shared = { users: 0, close: () => { clearTimeout(timer); void sb.removeChannel(channel); } };
    registry.set(uid, shared);
  }
  shared.users++;
  return () => { if (--shared.users === 0) { shared.close(); registry.delete(uid); } };
}

/** One shared inbox/count across bell and page; scoped by account, with safe rollback. */
export function useNotifications({ pageSize = 30, unreadOnly = false }: { pageSize?: number; unreadOnly?: boolean } = {}) {
  const { user } = useAuth();
  const uid = user?.id;
  const cache = useQueryClient();
  const root = ['notifications',uid] as const;
  const writes = [...root,'write'];
  const pending = useIsMutating({mutationKey:writes}) > 0;
  const size = Math.min(100,Math.max(1,pageSize));
  const list = useInfiniteQuery({
    queryKey: [...root,'list',unreadOnly,size], enabled: !!uid && !pending,
    initialPageParam: null as Cursor | null,
    staleTime: 15_000, refetchInterval: 30_000, retry: 1,
    queryFn: async ({pageParam,signal}): Promise<Page> => {
      let request = sb.from('notifications').select('*').eq('user_id',uid)
        .order('created_at',{ascending:false}).order('id',{ascending:false});
      if (unreadOnly) request = request.is('read_at',null);
      if (pageParam) request = request.or(notificationCursor(pageParam.id,pageParam.created_at));
      const rows = await memberData<AppNotification[]>(request.limit(size).abortSignal(signal),'Load notifications');
      return { rows: rows || [], cursor: rows?.length === size ? {id:rows.at(-1)!.id,created_at:rows.at(-1)!.created_at} : null };
    },
    getNextPageParam: page => page.cursor ?? undefined,
  });
  const count = useQuery({
    queryKey: [...root,'count'], enabled: !!uid && !pending, staleTime: 15_000, refetchInterval: 30_000, retry: 1,
    queryFn: async ({signal}) => {
      const result = await withTimeout(sb.from('notifications').select('id',{head:true,count:'exact'})
        .eq('user_id',uid).is('read_at',null).abortSignal(signal),QUERY_TIMEOUT_MS,'Unread notification count') as {count:number|null;error:{message:string}|null};
      if (result.error) throw new Error(result.error.message);
      if (result.count === null) throw new Error('Notification count unavailable');
      return result.count;
    },
  });
  useEffect(() => uid ? subscribeInbox(cache,uid) : undefined,[cache,uid]);

  const mutation = useMutation({
    mutationKey: writes,
    mutationFn: async (change: Change) => {
      if (!uid) throw new Error('Sign in to update notifications');
      const table = sb.from('notifications');
      let request = change.operation === 'dismiss' ? table.delete() : table.update({read_at:change.at});
      request = request.eq('user_id',uid);
      if (change.operation === 'all') request = request.is('read_at',null).lte('created_at',change.at);
      else request = request.eq('id',change.id);
      if (change.operation === 'read') request = request.is('read_at',null);
      // AbortSignal.timeout is missing on some older mobile browsers.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
      try { await memberData(request.select('id').abortSignal(controller.signal),'Update notification'); }
      finally { clearTimeout(timer); }
    },
    onMutate: async (change: Change) => {
      await cache.cancelQueries({queryKey:root});
      const snapshots = cache.getQueriesData<Inbox>({queryKey:[...root,'list']});
      const previousCount = cache.getQueryData<number>([...root,'count']);
      const wasUnread = snapshots.some(([,data]) => data?.pages.some(page => page.rows.some(row => row.id === change.id && !row.read_at)));
      for (const [key,data] of snapshots) {
        if (!data) continue;
        cache.setQueryData<Inbox>(key,{...data,pages:data.pages.map(page=>({...page,rows:page.rows.flatMap(row=>{
          const affected = change.operation === 'all' ? Date.parse(row.created_at) <= Date.parse(change.at) : row.id === change.id;
          if (!affected) return [row];
          if (change.operation === 'dismiss' || key[3] === true) return [];
          return [{...row,read_at:row.read_at || change.at}];
        })}))});
      }
      if (previousCount !== undefined) cache.setQueryData([...root,'count'],change.operation === 'all' ? 0 : Math.max(0,previousCount-(wasUnread?1:0)));
      return {snapshots,previousCount};
    },
    onError: (error,_change,context) => {
      context?.snapshots.forEach(([key,data])=>cache.setQueryData(key,data));
      if (context?.previousCount !== undefined) cache.setQueryData([...root,'count'],context.previousCount);
      toast.error('Could not update notifications. Your inbox was restored. ' + memberErrorMessage(error));
    },
    onSettled: () => { void cache.invalidateQueries({queryKey:root}); },
  });
  const change = async (operation: Change['operation'],id?:string) => {
    if (!uid || cache.isMutating({mutationKey:writes})) return false;
    try { await mutation.mutateAsync({operation,id,at:new Date().toISOString()}); return true; } catch { return false; }
  };
  const items = [...new Map((list.data?.pages.flatMap(page=>page.rows) || []).map(row=>[row.id,row])).values()];
  const error = list.error || count.error;
  return {
    items, unreadCount:count.data ?? 0, loading:!!uid && (list.isLoading || count.isLoading),
    refreshing:list.isFetching || count.isFetching,
    loadingMore:list.isFetchingNextPage, hasMore:!!list.hasNextPage, pending,
    error:error ? memberErrorMessage(error) : null,
    loadMore:async()=>{ if (list.hasNextPage && !list.isFetchingNextPage && !pending) await list.fetchNextPage(); },
    markRead:(id:string)=>items.find(row=>row.id===id)?.read_at ? Promise.resolve(true) : change('read',id),
    markAllRead:()=>change('all'), dismiss:(id:string)=>change('dismiss',id),
    refresh:async()=>{ await cache.invalidateQueries({queryKey:root}); },
  };
}

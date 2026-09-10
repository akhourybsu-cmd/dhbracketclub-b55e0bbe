import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotificationBackend, notificationRow } from './fixtures/notificationBackend';
import { useNotifications } from '@/hooks/useNotifications';
import { useQuickBar } from '@/components/home/useQuickBar';
import type { InstalledAsset } from '@/types/assets';

const mock=vi.hoisted(()=>({user:'member',club:'club',db:null as ReturnType<typeof createNotificationBackend>|null,toast:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:(...args:Parameters<ReturnType<typeof createNotificationBackend>['from']>)=>mock.db!.from(...args),channel:(name:string)=>mock.db!.channel(name),removeChannel:(channel:Parameters<ReturnType<typeof createNotificationBackend>['removeChannel']>[0])=>mock.db!.removeChannel(channel)}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:mock.user?{id:mock.user}:null})}));
vi.mock('@/contexts/ClubContext',()=>({useClub:()=>({club:{id:mock.club}})}));
vi.mock('sonner',()=>({toast:{error:mock.toast}}));
let cache:QueryClient;
function Wrapper({children}:{children:React.ReactNode}){return <QueryClientProvider client={cache}>{children}</QueryClientProvider>;}
beforeEach(()=>{mock.user='member';mock.club='club';mock.db=createNotificationBackend(Array.from({length:128},(_,n)=>notificationRow(n+1)));mock.toast.mockClear();localStorage.clear();cache=new QueryClient({defaultOptions:{queries:{retryDelay:1}}});});
afterEach(()=>{cleanup();cache.clear();});

describe('Shared notification inbox',()=>{
  it('counts all unread rows, scopes by account, and paginates equal timestamps without gaps',async()=>{
    mock.db!.rows.push(notificationRow(200,'someone-else'));
    const {result}=renderHook(()=>useNotifications({pageSize:30}),{wrapper:Wrapper});
    await waitFor(()=>expect(result.current.unreadCount).toBe(128));
    expect(result.current.items).toHaveLength(30);
    await act(()=>result.current.loadMore());
    await waitFor(()=>expect(result.current.items).toHaveLength(60));
    expect(new Set(result.current.items.map(row=>row.id)).size).toBe(60);
    expect(result.current.items.at(-1)?.id).toBe(notificationRow(69).id);
    expect(mock.db!.cursors[0]).toContain('id.lt.');
  });
  it('shares one realtime subscription and synchronizes read, unread-filter and dismissal caches',async()=>{
    const {result,unmount}=renderHook(()=>({bell:useNotifications(),page:useNotifications({unreadOnly:true})}),{wrapper:Wrapper});
    await waitFor(()=>expect(result.current.page.items).toHaveLength(30));
    expect(mock.db!.subscribers).toBe(1);
    const id=result.current.bell.items[0].id;
    await act(()=>result.current.page.markRead(id));
    await waitFor(()=>expect(result.current.bell.unreadCount).toBe(127));
    expect(result.current.bell.items.find(row=>row.id===id)?.read_at).toBeTruthy();
    expect(result.current.page.items.some(row=>row.id===id)).toBe(false);
    await act(()=>result.current.bell.dismiss(id));
    await waitFor(()=>expect(result.current.bell.items.some(row=>row.id===id)).toBe(false));
    expect(result.current.bell.unreadCount).toBe(127);
    expect(mock.db!.writes.every(write=>write.user==='member')).toBe(true);
    unmount();expect(mock.db!.subscribers).toBe(0);
  });
  it('rolls back failed writes in every view and reports failure',async()=>{
    const {result}=renderHook(()=>({bell:useNotifications(),page:useNotifications({unreadOnly:true})}),{wrapper:Wrapper});
    await waitFor(()=>expect(result.current.page.unreadCount).toBe(128));
    const id=result.current.bell.items[0].id;mock.db!.failWrites=true;
    await act(async()=>expect(await result.current.page.dismiss(id)).toBe(false));
    await waitFor(()=>expect(result.current.bell.unreadCount).toBe(128));
    expect(result.current.page.items.some(row=>row.id===id)).toBe(true);
    expect(result.current.bell.items.some(row=>row.id===id)).toBe(true);
    expect(mock.toast).toHaveBeenCalledOnce();
  });
  it('mark-all preserves notifications arriving after the click and never changes other accounts',async()=>{
    mock.db!.rows.push(notificationRow(200,'other'));
    const {result}=renderHook(()=>useNotifications(),{wrapper:Wrapper});
    await waitFor(()=>expect(result.current.unreadCount).toBe(128));
    const future={...notificationRow(300),created_at:new Date(Date.now()+60_000).toISOString()};
    mock.db!.beforeWrite=()=>{mock.db!.rows.push(future);};
    await act(()=>result.current.markAllRead());
    await waitFor(()=>expect(result.current.unreadCount).toBe(1));
    expect(mock.db!.rows.find(row=>row.id===future.id)?.read_at).toBeNull();
    expect(mock.db!.rows.find(row=>row.user_id==='other')?.read_at).toBeNull();
  });
  it('rejects overlapping writes and refreshes arrivals through the shared channel',async()=>{
    const {result}=renderHook(()=>useNotifications(),{wrapper:Wrapper});
    await waitFor(()=>expect(result.current.unreadCount).toBe(128));
    let release:()=>void;mock.db!.beforeWrite=()=>new Promise<void>(resolve=>{release=resolve;});
    let first:Promise<boolean>;
    act(()=>{first=result.current.markRead(notificationRow(128).id);});
    await waitFor(()=>expect(result.current.pending).toBe(true));
    expect(await result.current.dismiss(notificationRow(127).id)).toBe(false);
    await act(async()=>{release!();await first;});
    mock.db!.rows.push(notificationRow(300));act(()=>mock.db!.emit());
    await waitFor(()=>expect(result.current.items[0].id).toBe(notificationRow(300).id));
    expect(mock.db!.writes).toHaveLength(1);
  });
  it('exposes read failures with a working retry and clears the previous account inbox',async()=>{
    mock.db!.failReads=true;
    const {result,rerender}=renderHook(()=>useNotifications(),{wrapper:Wrapper});
    await waitFor(()=>expect(result.current.error).toBeTruthy());
    expect(result.current.loading).toBe(false);
    mock.db!.failReads=false;await act(()=>result.current.refresh());
    await waitFor(()=>expect(result.current.unreadCount).toBe(128));
    act(()=>{mock.user='other';rerender();});
    expect(result.current.items).toHaveLength(0);
    await waitFor(()=>expect(result.current.loading).toBe(false));
    expect(result.current.unreadCount).toBe(0);
  });
});

describe('Home shortcut persistence',()=>{
  const assets=['chat','nfl-pickem'].map((slug,i)=>({id:slug,sort_order:i,asset:{slug,name:slug}})) as InstalledAsset[];
  it('remembers intentionally unpinning every app across remounts and keeps club preferences separate',()=>{
    const first=renderHook(()=>useQuickBar(assets));
    act(()=>first.result.current.unpin('chat'));act(()=>first.result.current.unpin('nfl-pickem'));
    first.unmount();const second=renderHook(()=>useQuickBar(assets));
    expect(second.result.current.pinned).toHaveLength(0);
    act(()=>{mock.club='another-club';second.rerender();});
    expect(second.result.current.pinned).toHaveLength(2);
    act(()=>{mock.club='club';second.rerender();});
    expect(second.result.current.pinned).toHaveLength(0);
  });
});

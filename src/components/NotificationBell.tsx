import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { notifIcon } from '@/components/notifications/meta';
import { notificationPath, notificationTime } from '@/lib/notifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MobileIconButton } from '@/components/mobile/MobileIconButton';

export function NotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, unreadCount, loading, refreshing, error, pending, markRead, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.key]);
  const openItem = (item: AppNotification) => {
    void markRead(item.id);
    const path = notificationPath(item.url);
    if (path) { setOpen(false); navigate(path); }
  };
  return <Popover open={open} onOpenChange={setOpen} modal>
    <PopoverTrigger asChild>
      <MobileIconButton aria-label={'Notifications' + (unreadCount ? ' (' + unreadCount + ' unread)' : '')}
        className={cn('relative h-11 w-11 shrink-0', className)}>
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && <span aria-hidden className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold tabular-nums text-destructive-foreground ring-2 ring-background">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </MobileIconButton>
    </PopoverTrigger>
    <PopoverContent align="end" side="bottom" sideOffset={8} collisionPadding={12} aria-label="Notifications"
      className="z-[70] flex w-[calc(100vw-24px)] max-w-[390px] flex-col overflow-hidden rounded-2xl border-border p-0 shadow-xl"
      style={{ maxHeight: 'min(36rem, var(--radix-popover-content-available-height))' }}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Notifications</h2><p className="text-xs text-muted-foreground">{loading ? 'Checking your inbox…' : error ? 'Could not refresh' : unreadCount ? unreadCount + ' unread' : 'You’re up to date'}</p></div>
        <MobileIconButton aria-label="Refresh notifications" onClick={() => void refresh()} disabled={refreshing || pending}><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></MobileIconButton>
        <MobileIconButton aria-label="Close notifications" onClick={() => setOpen(false)}><X className="h-4 w-4" /></MobileIconButton>
      </div>
      {unreadCount > 0 && <button disabled={pending} onClick={() => void markAllRead()} className="flex min-h-11 shrink-0 items-center justify-end gap-1.5 border-b border-border px-4 text-xs font-semibold text-primary disabled:opacity-50"><CheckCheck className="h-4 w-4" />Mark all read</button>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={loading}>
        {error && <div role="alert" className="border-b border-border p-4 text-sm"><p>{error}</p><button onClick={() => void refresh()} className="mt-1 min-h-11 font-semibold text-primary">Try again</button></div>}
        {loading && !items.length ? <div className="space-y-3 p-4" aria-label="Loading notifications">{[1,2,3].map(n => <div key={n} className="h-14 rounded-xl skeleton-shimmer" />)}</div>
          : !items.length && !error ? <div className="px-5 py-10 text-center"><Bell className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="text-sm font-semibold">No notifications yet</p><p className="mt-1 text-xs text-muted-foreground">Mentions, replies, and your next turn will appear here.</p></div>
          : <ul className="divide-y divide-border">{items.map(item => {
            const { icon: Icon, color } = notifIcon(item.type);
            return <li key={item.id}><button disabled={pending} onClick={() => openItem(item)} className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', !item.read_at && 'bg-primary/5')}>
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-4 w-4" style={{color:'hsl(var(--' + color + '))'}} /></span>
              <span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-semibold leading-snug">{item.title}</span>{item.body && <span className="mt-1 block line-clamp-2 break-words text-xs text-muted-foreground">{item.body}</span>}<span className="mt-1.5 block text-[11px] text-muted-foreground">{notificationTime(item.created_at)}</span></span>
              {!item.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            </button></li>;
          })}</ul>}
      </div>
      <button onClick={() => { setOpen(false); navigate('/notifications'); }} className="flex min-h-12 shrink-0 items-center justify-center gap-1 border-t border-border bg-popover px-4 text-xs font-semibold text-primary hover:bg-muted/50">Open notification inbox<ChevronRight className="h-4 w-4" /></button>
    </PopoverContent>
  </Popover>;
}

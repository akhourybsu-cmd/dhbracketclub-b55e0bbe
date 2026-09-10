import { Link } from 'react-router-dom';
import { Menu, User } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { MobileIconButton } from './MobileIconButton';

export function MobileAppHeader({ title, onOpenMenu }: { title: string; onOpenMenu: () => void }) {
  return <header className="sticky top-0 z-40 shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-xl"
    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
    <div className="flex h-14 min-w-0 items-center gap-1"
      style={{ paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))' }}>
      <MobileIconButton aria-label="Open navigation menu" onClick={onOpenMenu} className="h-11 w-11 shrink-0"><Menu className="h-5 w-5" /></MobileIconButton>
      <p className="min-w-0 flex-1 truncate px-1 text-sm font-bold tracking-tight">{title}</p>
      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <Link to="/profile" aria-label="Profile" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/50"><User className="h-4 w-4" /></span>
        </Link>
      </div>
    </div>
  </header>;
}

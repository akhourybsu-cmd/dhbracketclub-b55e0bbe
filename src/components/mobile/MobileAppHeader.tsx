import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu, User } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { cn } from '@/lib/utils';
import { MobileIconButton } from './MobileIconButton';

/**
 * App-style top bar. Top-level screens show the menu; nested screens show a
 * back chevron. Gains a hairline + shadow once the page is scrolled.
 */
export function MobileAppHeader({ title, onOpenMenu }: { title: string; onOpenMenu: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const nested = pathname.split('/').filter(Boolean).length > 1;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(`/${pathname.split('/').filter(Boolean)[0]}`);
  };

  return <header className={cn('sticky top-0 z-40 shrink-0 border-b bg-background/90 backdrop-blur-xl backdrop-saturate-150 transition-[border-color,box-shadow] duration-200',
      scrolled ? 'border-border/50 shadow-[0_6px_18px_-12px_hsl(var(--foreground)/0.35)]' : 'border-transparent')}
    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
    <div className="flex h-14 min-w-0 items-center gap-1"
      style={{ paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))' }}>
      {nested
        ? <MobileIconButton aria-label="Go back" onClick={back} className="h-11 w-11 shrink-0"><ChevronLeft className="h-6 w-6" /></MobileIconButton>
        : <MobileIconButton aria-label="Open navigation menu" onClick={onOpenMenu} className="h-11 w-11 shrink-0"><Menu className="h-5 w-5" /></MobileIconButton>}
      <p key={title} className="min-w-0 flex-1 truncate px-1 text-[17px] font-bold tracking-[-0.02em] animate-in fade-in slide-in-from-bottom-1 duration-200">{title}</p>
      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <Link to="/profile" aria-label="Profile" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/15 bg-primary/5 text-primary"><User className="h-4 w-4" /></span>
        </Link>
      </div>
    </div>
  </header>;
}

import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, LogOut, Settings, Shield } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { useClubAssets } from '@/hooks/useClubAssets';
import { NAV_ASSET_SLUGS } from '@/types/assets';
import dhMonogram from '@/assets/dh-monogram.png';
import { APP_NAV_SECTIONS, isRouteActive, type AppNavItem } from '@/lib/appNavigation';

type NavEntry = AppNavItem & { badge?: number };
type Section = { label: string; items: NavEntry[] };

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unreadChatCount?: number;
}

export function AppDrawer({ open, onOpenChange, unreadChatCount = 0 }: AppDrawerProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { club, isClubAdmin, isPlatformOwner, isAppAdmin } = useClub();
  const { play } = useSoundEffect();
  const { filterNavPaths, installedAssets, isVisible } = useClubAssets();

  // Close only when navigation actually completes, not whenever the sheet's
  // own open state changes.
  const previousPathRef = useRef(location.pathname);
  useEffect(() => {
    if (previousPathRef.current !== location.pathname && open) onOpenChange(false);
    previousPathRef.current = location.pathname;
  }, [location.pathname, onOpenChange, open]);

  const rawSections: Section[] = APP_NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      badge: item.path === '/chat' ? unreadChatCount : undefined,
    })),
  }));

  const sections: Section[] = rawSections.map(sec => ({
    ...sec,
    items: sec.items.filter(item => filterNavPaths([item.path]).length > 0),
  })).filter(sec => sec.items.length > 0);

  // Catch-all: any installed + visible asset that has a route but isn't
  // hardcoded above still shows up, so newly added plugins never go missing.
  const listedPaths = new Set(rawSections.flatMap(s => s.items.map(i => i.path)));
  const extras: NavEntry[] = (Object.entries(NAV_ASSET_SLUGS) as [string, string][])
    .filter(([path, slug]) => !listedPaths.has(path) && isVisible(slug))
    .map(([path, slug]) => ({
      path,
      label: installedAssets.find(ia => ia.asset?.slug === slug)?.asset?.name ?? slug,
      icon: LayoutGrid,
    }));
  if (extras.length > 0) sections.push({ label: 'More Apps', items: extras });


  if (isClubAdmin || isPlatformOwner || isAppAdmin) {
    sections.push({
      label: 'Admin',
      items: [
        ...(isClubAdmin ? [{ path: '/club/settings', label: 'Club Settings', icon: Settings }] : []),
        ...((isAppAdmin || isPlatformOwner) ? [{ path: '/admin', label: 'Admin Portal', icon: Shield }] : []),
      ],
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="p-0 w-[86vw] max-w-[340px] sm:max-w-[360px] flex flex-col gap-0 border-r border-border/30 bg-background"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SheetDescription className="sr-only">Browse all sections of the app</SheetDescription>

        {/* Identity header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/25 flex items-center gap-3">
          {club?.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-11 h-11 object-cover rounded-xl" />
          ) : (
            <img src={dhMonogram} alt="DH" className="w-11 h-11 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-extrabold tracking-tight leading-tight truncate gradient-text">
              {club?.name ?? 'DH Club'}
            </h2>
            <p className="text-[10px] text-muted-foreground/80 font-semibold uppercase tracking-[0.14em] mt-0.5 truncate">
              {user?.email ?? 'Compete With Your Crew'}
            </p>
          </div>
        </div>

        {/* Nav scroll area */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {sections.map((sec) => (
            <div key={sec.label} className="mb-3">
              {/* Matches the SectionHeader spec used across Home so eyebrows
                  read as one visual family across the shell. */}
              <p className="px-3 mb-1 text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70">
                {sec.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(location.pathname, item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => { play('tap'); }}
                      className={cn(
                        'group flex items-center gap-3 px-3 py-2.5 rounded-xl min-h-[44px] text-[14px] font-medium transition-colors',
                        active
                          ? 'bg-primary/15 text-primary'
                          : 'text-foreground/85 hover:bg-muted/50 active:bg-muted/70',
                      )}
                    >
                      <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', active && 'text-primary')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        // Unread count chip — uses the calm-shell pill family
                        // (token-driven, no hardcoded color) so it visually
                        // belongs with StatusPill chips elsewhere.
                        <span
                          className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold tabular-nums flex items-center justify-center border"
                          style={{
                            backgroundColor: 'hsl(var(--primary) / 0.18)',
                            borderColor: 'hsl(var(--primary) / 0.4)',
                            color: 'hsl(var(--primary))',
                          }}
                        >
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/25 flex items-center justify-between gap-2">
          <ThemeToggle />
          <button
            onClick={async () => { play('tap'); await signOut(); }}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-destructive transition-colors px-3 py-2 rounded-lg hover:bg-destructive/10 min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { activeTabPath, type AppNavItem } from '@/lib/appNavigation';

/**
 * Floating mobile tab bar: Home + the member's most used destinations + More
 * (opens the full app drawer). Tapping the active tab scrolls back to top.
 */
export function BottomTabBar({ unreadChatCount = 0, items, onOpenMore }: {
  unreadChatCount?: number; items: AppNavItem[]; onOpenMore: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { play } = useSoundEffect();
  const active = activeTabPath(pathname, items);

  const tap = () => { play('tap'); navigator.vibrate?.(8); };
  const go = (path: string) => {
    tap();
    if (path === pathname) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    navigate(path);
  };

  const tabs = [...items.map((t) => ({ ...t, key: t.path })), { key: 'more', path: '', label: 'More', icon: LayoutGrid }];

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pointer-events-none"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      aria-label="Primary"
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-stretch rounded-[1.6rem] border border-border/50 bg-card/95 p-1 shadow-[0_10px_30px_-8px_hsl(var(--background)/0.7),0_2px_8px_hsl(var(--foreground)/0.06)] backdrop-blur-xl backdrop-saturate-150">
        {tabs.map((tab) => {
          const isMore = tab.key === 'more';
          const on = !isMore && active === tab.path;
          const Icon = tab.icon;
          const badge = tab.path === '/chat' ? unreadChatCount : 0;
          const label = 'shortLabel' in tab && tab.shortLabel ? tab.shortLabel : tab.label;
          return (
            <button
              key={tab.key}
              onClick={() => (isMore ? (tap(), onOpenMore()) : go(tab.path))}
              aria-label={isMore ? 'More apps' : tab.label}
              aria-current={on ? 'page' : undefined}
              className="relative flex h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.3rem] touch-manipulation transition-transform duration-100 active:scale-[0.92]"
            >
              {on && (
                <motion.span
                  layoutId="bottomTabPill"
                  className="absolute inset-0 rounded-[1.3rem] bg-primary/12 ring-1 ring-primary/20"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative flex h-6 items-center justify-center">
                <Icon className={cn('h-[21px] w-[21px] transition-colors', on ? 'text-primary' : 'text-muted-foreground')} strokeWidth={on ? 2.4 : 2} />
                {badge > 0 && (
                  <span className="absolute -right-2.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-1 text-[8.5px] font-black tabular-nums text-destructive-foreground ring-2 ring-card">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className={cn('relative max-w-full truncate px-0.5 text-[10px] font-semibold tracking-tight transition-colors', on ? 'text-primary' : 'text-muted-foreground')}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { isMobilePrimaryActive, MOBILE_PRIMARY_NAV } from '@/lib/appNavigation';

/**
 * Persistent mobile bottom tab bar — one-tap access to the core sections with
 * a spring-animated active indicator, tap haptics, and a live chat badge.
 * Hidden on desktop (sidebar takes over) and inside full-screen shells
 * (chat / game modes), which AppLayout gates via `showMobileHeader`.
 */
export function BottomTabBar({ unreadChatCount = 0 }: { unreadChatCount?: number }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { play } = useSoundEffect();

  const go = (path: string, active: boolean) => {
    if (active) return;
    play('tap');
    navigator.vibrate?.(8);
    navigate(path);
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/40 bg-card/[0.90] shadow-[0_-6px_20px_hsl(var(--background)/0.28)]"
      style={{
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
      aria-label="Primary"
    >
      <div className="flex items-stretch">
        {MOBILE_PRIMARY_NAV.map(tab => {
          const active = isMobilePrimaryActive(pathname, tab.path);
          const Icon = tab.icon;
          const badge = tab.path === '/chat' ? unreadChatCount : 0;
          return (
            <button
              key={tab.path}
              onClick={() => go(tab.path, active)}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 h-[58px] min-w-0 touch-manipulation active:scale-[0.94] transition-transform duration-100"
            >
              <div className="relative flex items-center justify-center w-12 h-7">
                {active && (
                  <motion.div
                    layoutId="bottomTabGlow"
                    className="absolute inset-0 rounded-full bg-primary/15"
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <Icon
                  className={cn('relative w-[22px] h-[22px] transition-colors duration-150', active ? 'text-primary' : 'text-muted-foreground/75')}
                  strokeWidth={active ? 2.4 : 2}
                />
                {badge > 0 && (
                  <span className="absolute -top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-destructive-foreground text-[8.5px] font-black flex items-center justify-center ring-2 ring-background tabular-nums">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-bold tracking-tight transition-colors duration-150', active ? 'text-primary' : 'text-muted-foreground/75')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

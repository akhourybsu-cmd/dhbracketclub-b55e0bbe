import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PickemHUD } from './PickemHUD';
import { PickemBoot } from './PickemBoot';
import { PickemCommandNav } from './PickemCommandNav';

/**
 * Full-screen standalone shell for NFL Game Center. Applies the
 * `.pk-mode` skin to the entire viewport, mounts the in-game HUD, and
 * plays the one-time boot overlay on first entry into /nfl/* or /pickem/*.
 *
 * AppLayout hides the DH Club bottom nav and sidebar while any Game Center
 * route is active, so this shell owns the full viewport — exactly how
 * Nexus Defense and Rune Delve work.
 */
export function PickemLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pk-mode pk-shell relative min-h-[100dvh]">
      <PickemHUD />
      <PickemCommandNav />

      <main
        className={cn('nfl-command nfl-command-main mx-auto px-3 sm:px-5 pt-4 max-w-[1180px]')}
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      <PickemBoot />
    </div>
  );
}

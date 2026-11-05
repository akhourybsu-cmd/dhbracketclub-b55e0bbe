import { ReactNode, useEffect, useRef, useState } from 'react';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { DraftArenaHUD } from './DraftArenaHUD';
import { DraftArenaBoot } from './DraftArenaBoot';
import { DraftSeasonWelcomeController } from './DraftSeasonWelcomeController';
import { useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';
import { bindDraftViewport } from '@/lib/draft/viewport';
import './draftArena.css';
import './draftArenaMobile.css';
import './draftArenaForms.css';
import './draftArenaKeyboard.css';

/**
 * Full-screen standalone shell for the Draft Arena. Applies the `.da-mode`
 * skin to the entire viewport, mounts the in-game HUD, and plays the
 * one-time boot overlay on first entry into /drafts/*.
 *
 * AppLayout hides the DH Club bottom nav and sidebar while any /drafts/*
 * route is active, so this shell owns the full viewport — exactly how
 * Nexus Defense, Rune Delve, and Pick'em work.
 */
export function DraftArenaLayout({ children }: { children: ReactNode }) {
  const { palette } = useDraftArenaPalette();
  const location = useLocation();
  const isLive = location.pathname === '/drafts/live' || location.pathname.startsWith('/drafts/live/') || (location.pathname.endsWith('/magazine') && new URLSearchParams(location.search).get('live') === '1');
  const reducedMotion = useReducedMotion();
  const shell = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    const main = shell.current?.querySelector<HTMLElement>('.da-arena-main');
    if (main) main.scrollTop = 0;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const releaseViewport = bindDraftViewport();
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      releaseViewport();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <div ref={shell} className={`da-mode da-lounge da-shell da-arena-shell${isLive ? ' da-live-arena' : ''}`} data-da-palette={palette} data-da-live={isLive || undefined}
      data-da-motion={reducedMotion ? 'reduced' : 'full'} data-da-hidden={hidden}>
      <div className="da-arena-architecture" aria-hidden="true"><i /><i /><i /></div>
      <DraftArenaHUD />

      {/* Mobile scrolls the complete page; desktop workspaces retain their panes. */}
      <main className="da-arena-main" id="draft-arena-main" tabIndex={-1}>
        {children}
      </main>

      <DraftArenaBoot />
      {!isLive && <DraftSeasonWelcomeController />}
    </div>
    </MotionConfig>
  );
}


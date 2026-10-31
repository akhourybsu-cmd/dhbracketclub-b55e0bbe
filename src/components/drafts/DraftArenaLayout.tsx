import { ReactNode, useEffect, useRef, useState } from 'react';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import { DraftArenaHUD } from './DraftArenaHUD';
import { DraftArenaBoot } from './DraftArenaBoot';
import { DraftSeasonWelcomeController } from './DraftSeasonWelcomeController';
import { useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';
import './draftArena.css';

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
  const reducedMotion = useReducedMotion();
  const shell = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    const viewport = window.visualViewport;
    const rootStyle = document.documentElement.style;
    const previousHeight = rootStyle.getPropertyValue('--da-viewport-height');
    const previousPriority = rootStyle.getPropertyPriority('--da-viewport-height');
    const previousShortViewport = document.documentElement.getAttribute('data-da-short-viewport');
    const resize = () => {
      const visibleHeight = viewport?.height ?? window.innerHeight;
      const height = `${visibleHeight}px`;
      shell.current?.style.setProperty('--da-viewport-height', height);
      // Portaled composers and artwork drawers share the visible keyboard bounds.
      rootStyle.setProperty('--da-viewport-height', height);
      document.documentElement.dataset.daShortViewport = String(visibleHeight < 340);
    };
    const visibility = () => setHidden(document.hidden);
    resize();
    viewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      viewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      if (previousHeight) rootStyle.setProperty('--da-viewport-height', previousHeight, previousPriority);
      else rootStyle.removeProperty('--da-viewport-height');
      if (previousShortViewport === null) document.documentElement.removeAttribute('data-da-short-viewport');
      else document.documentElement.setAttribute('data-da-short-viewport', previousShortViewport);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <div ref={shell} className="da-mode da-lounge da-shell da-arena-shell" data-da-palette={palette}
      data-da-motion={reducedMotion ? 'reduced' : 'full'} data-da-hidden={hidden}>
      <div className="da-arena-architecture" aria-hidden="true"><i /><i /><i /></div>
      <DraftArenaHUD />

      {/* Dense workspaces own one bounded pane. Older report and archive
          screens retain the main viewport scroller so every action stays reachable. */}
      <main className="da-arena-main" id="draft-arena-main" tabIndex={-1}>
        {children}
      </main>

      <DraftArenaBoot />
      <DraftSeasonWelcomeController />
    </div>
    </MotionConfig>
  );
}


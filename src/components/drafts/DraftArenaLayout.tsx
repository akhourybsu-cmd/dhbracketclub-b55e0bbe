import { ReactNode } from 'react';
import { DraftArenaHUD } from './DraftArenaHUD';
import { DraftArenaBoot } from './DraftArenaBoot';
import { DraftSeasonWelcomeController } from './DraftSeasonWelcomeController';

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
  return (
    <div className="da-mode da-lounge da-shell relative min-h-[100dvh]">
      <DraftArenaHUD />

      {/* Shell width: mobile-first 640px cap (the original calm phone
          column) widens to 1100px on lg+ so dense surfaces like the war
          room and Stats Hub can adopt a 2-column desktop layout. Pages
          inside that don't want the extra room — long-form report
          content, etc. — re-apply a narrower max-width on their inner
          wrapper (e.g. `lg:max-w-[760px] lg:mx-auto`). Mobile/tablet
          (<lg) is unchanged. */}
      <main
        className="max-w-[640px] lg:max-w-[1100px] mx-auto px-3 sm:px-5 pt-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      <DraftArenaBoot />
      <DraftSeasonWelcomeController />
    </div>
  );
}


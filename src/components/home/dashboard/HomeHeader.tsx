// DH Club Home — Header (club command center title bar)
//
// Premium desktop header for the new Home dashboard:
//   • Large club name + personalized greeting
//   • Right-side action group:
//     - Search button (route to /chat search if available, else placeholder)
//     - Notifications bell with optional badge count
//     - Compact "Create" button → opens StartSomethingMenu
//     - Primary "Start Something" CTA → opens StartSomethingMenu
//     - User avatar → /profile
//
// On mobile the action group collapses to just bell + avatar; the
// primary CTAs move into the ClubPulseCard chips instead.

import { Link, useNavigate } from 'react-router-dom';
import { Search, Activity, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dhMonogram from '@/assets/dh-monogram.png';
import type { Club } from '@/contexts/ClubContext';
import { getAccentTextColor } from '@/lib/colorContrast';
import { StartSomethingMenu } from './StartSomethingMenu';

interface Props {
  club: Club | null;
  displayName: string;
  avatarUrl: string | null;
  /** Slugs of installed assets so the StartSomethingMenu only offers
   *  options the club has actually enabled. */
  installedSlugs: Set<string>;
}

const WEEKDAY_GREETING = (h: number) => {
  if (h < 5)  return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Late night';
};

export function HomeHeader({ club, displayName, avatarUrl, installedSlugs }: Props) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const firstName = displayName.trim().split(/\s+/)[0] || '';
  const greeting = WEEKDAY_GREETING(new Date().getHours());
  const accent = club?.accent_color ?? '152 72% 46%';
  const accentText = getAccentTextColor(accent);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="flex items-center justify-between gap-4 pb-4 mb-1 border-b border-border/45">
      {/* Title block */}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl lg:text-[28px] font-extrabold tracking-[-0.035em] leading-none truncate">
          {club?.name ?? 'DH Club'}
        </h1>
        <p className="text-[12px] text-muted-foreground/80 mt-1 leading-snug truncate">
          {greeting}{firstName ? `, ${firstName}` : ''}
          {club?.name ? ` — here's what's happening in the club.` : ' — welcome.'}
        </p>
      </div>

      {/* Action group — full set on lg+, condensed on mobile */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Search opens Chat directly in its all-channel search view. */}
        <button
          type="button"
          onClick={() => navigate('/chat?search=all')}
          aria-label="Search chat"
          className="hidden sm:inline-flex w-10 h-10 rounded-xl items-center justify-center text-muted-foreground/80 hover:text-foreground hover:bg-muted/55 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          title="Search all chat"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* The global shell already owns notifications. This shortcut is
            intentionally Activity so the two controls are never ambiguous. */}
        <button
          type="button"
          onClick={() => navigate('/feed')}
          aria-label="View club activity"
          className="relative w-10 h-10 rounded-xl inline-flex items-center justify-center text-muted-foreground/80 hover:text-foreground hover:bg-muted/55 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          title="Club activity"
        >
          <Activity className="w-4 h-4" />
        </button>

        {/* Single global Create button — opens the creation menu
            (Poll, Draft, Event, RPG, …). The old duplicate
            "Start Something" CTA has been folded into this one so the
            viewport never shows two competing creation buttons. */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Create"
          className="h-10 px-4 rounded-xl inline-flex items-center gap-1.5 text-[12.5px] font-extrabold active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{
            background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
            color: accentText,
            boxShadow: `0 0 18px -4px hsl(${accent} / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.2)`,
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Create</span>
        </button>


        {/* Avatar — routes to profile */}
        <Link
          to="/profile"
          aria-label="Profile"
          className="ml-1 w-10 h-10 rounded-full overflow-hidden inline-flex items-center justify-center flex-shrink-0 border border-border/55 hover:border-primary/55 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{
            background: avatarUrl ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.25), hsl(${accent} / 0.05))`,
            color: `hsl(${accent})`,
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : displayName ? (
            <span className="text-sm font-extrabold">{displayName.charAt(0).toUpperCase()}</span>
          ) : (
            <img src={dhMonogram} alt="" className="w-7 h-7 object-contain opacity-90" />
          )}
        </Link>
      </div>

      {/* Start Something menu — controlled overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
            onClick={() => setMenuOpen(false)}
            role="presentation"
          >
            <div
              className="fixed inset-0 bg-background/70 backdrop-blur-sm"
              aria-hidden
            />
            <StartSomethingMenu
              accent={accent}
              installedSlugs={installedSlugs}
              onClose={() => setMenuOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

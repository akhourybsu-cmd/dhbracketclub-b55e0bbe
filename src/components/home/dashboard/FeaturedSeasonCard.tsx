// DH Club Home — Featured Draft Arena season card
//
// Premium spotlight card for the active draft season. Shows:
//   • The DRAFT ARENA eyebrow label
//   • Season name (e.g. "Season 4")
//   • Picks-submitted progress text + a progress bar
//   • A row of participant avatars (up to 6 + "+N more" pip)
//   • Two CTAs: "Open Season" and "View Board"
//   • Decorative HorseKnight SVG on the right
//
// Hidden when:
//   • Draft Arena asset isn't installed
//   • OR no active season exists yet (defers to the absence card below
//     in HomeDashboard which renders a generic "no active season" hint)

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import type { CSSProperties } from 'react';
import { HorseKnight } from './svg/HorseKnight';
import { getAccentTextColor } from '@/lib/colorContrast';

interface ParticipantAvatar {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface Props {
  /** Active season's display name (e.g. "Season 4"). */
  seasonName: string;
  /** Season UUID — used to construct the season route. */
  seasonId?: string;
  /** Picks already submitted (for progress text + bar). */
  picksCompleted: number;
  /** Total picks target for the season (for progress denominator). */
  picksTarget: number;
  /** Optional participant avatars to render in the avatar stack. */
  participants?: ParticipantAvatar[];
  /** HSL triple — used for accent gradients + glow. */
  accent: string;
}

export function FeaturedSeasonCard({
  seasonName, seasonId, picksCompleted, picksTarget, participants = [], accent,
}: Props) {
  const pct = picksTarget > 0
    ? Math.min(100, Math.round((picksCompleted / picksTarget) * 100))
    : 0;
  const displayedAvatars = participants.slice(0, 6);
  const extraAvatars = Math.max(0, participants.length - displayedAvatars.length);
  const accentText = getAccentTextColor(accent);

  // Routes — fall back to the drafts list if no seasonId so the
  // buttons still navigate somewhere useful.
  const openSeasonUrl = seasonId ? `/drafts/seasons/${seasonId}` : '/drafts';
  const viewBoardUrl  = '/drafts';

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl mb-6"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 0% 30%, hsl(${accent} / 0.12), transparent 65%),
          linear-gradient(180deg, hsl(var(--home-panel) / 0.98), hsl(var(--home-panel-strong) / 0.98))
        `,
        border: `1px solid hsl(${accent} / 0.32)`,
        boxShadow: `0 12px 40px -20px hsl(${accent} / 0.32), var(--home-panel-shadow)`,
      }}
      aria-label={`Featured — Draft Arena ${seasonName}`}
    >
      {/* Horse knight artwork — absolute on the right, hidden on
          narrow screens so the text column gets its breathing room. */}
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-[260px] hidden md:block pointer-events-none"
        style={{ opacity: 0.85 }}
      >
        <HorseKnight accent={accent} className="w-full h-full" />
      </div>

      <div className="relative p-5 lg:p-6 md:pr-[240px]">
        {/* Eyebrow */}
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-1.5"
          style={{ color: 'hsl(var(--home-accent-ink))' }}
        >
          Draft Arena
        </p>

        {/* Season title */}
        <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">{seasonName}</h2>

        {/* Progress text */}
        <p className="text-[12px] text-muted-foreground/85 mt-1.5">
          {picksTarget > 0
            ? `${picksCompleted} of ${picksTarget} picks submitted`
            : 'Season in setup'}
        </p>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-card/60 border border-border/30 max-w-md">
          <div
            className="h-full transition-[width] duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, hsl(${accent}), hsl(${accent} / 0.7))`,
              boxShadow: `0 0 12px hsl(${accent} / 0.45)`,
            }}
          />
        </div>
        <p className="text-[10px] font-bold mt-1 tabular-nums" style={{ color: `hsl(${accent})` }}>
          {pct}%
        </p>

        {/* Participant avatars */}
        {displayedAvatars.length > 0 && (
          <div className="flex items-center mt-3 -space-x-2">
            {displayedAvatars.map((p) => (
              <div
                key={p.user_id}
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-extrabold ring-2"
                style={{
                  background: p.avatar_url ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.25), hsl(${accent} / 0.08))`,
                  color: `hsl(${accent})`,
                  '--tw-ring-color': 'hsl(var(--home-avatar-ring))',
                } as CSSProperties}
                title={p.display_name ?? 'Participant'}
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.display_name ?? ''} className="w-full h-full object-cover" />
                ) : (
                  (p.display_name ?? '?').charAt(0).toUpperCase()
                )}
              </div>
            ))}
            {extraAvatars > 0 && (
              <div
                className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[9.5px] font-extrabold ring-2"
                style={{
                  background: 'hsl(var(--home-panel-muted))',
                  color: 'hsl(var(--home-accent-ink))',
                  '--tw-ring-color': 'hsl(var(--home-avatar-ring))',
                  border: `1px solid hsl(${accent} / 0.35)`,
                } as CSSProperties}
              >
                +{extraAvatars}
              </div>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link
            to={openSeasonUrl}
            className="h-10 px-4 rounded-xl inline-flex items-center gap-1.5 text-[12.5px] font-extrabold active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
              color: accentText,
              boxShadow: `0 0 18px -4px hsl(${accent} / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.2)`,
            }}
          >
            Open Season <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to={viewBoardUrl}
            className="h-10 px-3.5 rounded-xl inline-flex items-center gap-1.5 text-[12.5px] font-bold border border-border/55 bg-card/70 hover:bg-muted/70 hover:border-primary/30 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <LayoutGrid className="w-3.5 h-3.5" /> View Board
          </Link>
        </div>
      </div>
    </motion.section>
  );
}

// Rune Delve — Chamber Briefing Card
//
// Fantasy-distinct briefing surface. Deliberately *unlike* the Nexus
// Defense briefing: warm parchment-stone gradient (not cold tactical
// card), rune-rubbing texture (not square grid), ✦ runic separator
// (not ◆), Cinzel display headings (Rune Delve's existing serif), and
// stat readouts framed as scroll lines, not HUD lozenges.

import { motion } from 'framer-motion';
import { Grid3X3, ShieldCheck, Skull, Gem, ScrollText } from 'lucide-react';
import { RuneLayoutPreview } from './RuneLayoutPreview';
import type { RuneLayout } from '@/lib/runedelve/runeLayouts';
import { RuneStatBadge } from './RuneStatBadge';

interface Props {
  layout: RuneLayout;
  /** Level number badge — shown in the eyebrow. */
  levelNumber?: number;
  /** Optional override title (defaults to layout.name). */
  title?: string;
  /** Set false for a denser inline form. */
  showStrategy?: boolean;
}

export function DelveBriefingCard({ layout, levelNumber, title, showStrategy = true }: Props) {
  const accent = `hsl(${layout.preview.accent})`;
  const accentBorder = `hsl(${layout.preview.accent} / 0.45)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        // Warm torchlit stone — parchment-meets-cavern, not a tactical card.
        background:
          'radial-gradient(ellipse 100% 70% at 50% 0%, hsl(28 55% 14% / 0.95), transparent 70%),' +
          'radial-gradient(ellipse 90% 60% at 100% 100%, hsl(15 60% 10% / 0.95), transparent 70%),' +
          'linear-gradient(160deg, hsl(22 30% 10%), hsl(20 35% 6%))',
        border: `1px solid ${accentBorder}`,
        boxShadow:
          `0 0 22px -10px hsl(28 80% 45% / 0.45), ` +
          `inset 0 1px 0 hsl(38 60% 60% / 0.10), ` +
          `inset 0 0 0 1px hsl(28 60% 30% / 0.18)`,
      }}
    >
      {/* Cross-hatch rune-rubbing texture (rotated stripes) */}
      <svg
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.18, mixBlendMode: 'overlay' }}
      >
        <defs>
          <pattern id="rd-card-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(38)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="hsl(35 55% 50%)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#rd-card-hatch)" />
      </svg>

      {/* Soft torch glow upper-right */}
      <div
        aria-hidden
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, hsl(28 100% 55% / 0.18), transparent 65%)',
          filter: 'blur(14px)',
        }}
      />

      <div className="relative p-3.5 flex gap-3">
        {/* Layout preview */}
        <div className="flex-shrink-0">
          <RuneLayoutPreview layout={layout} size="md" />
          <div
            className="font-rd-display text-[8px] mt-1.5 text-center truncate"
            style={{ color: 'hsl(40 85% 70%)', letterSpacing: '0.22em', maxWidth: '64px' }}
            title={layout.name}
          >
            {layout.name.toUpperCase()}
          </div>
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              aria-hidden
              className="inline-block text-[10px] leading-none"
              style={{ color: 'hsl(40 100% 65%)', textShadow: '0 0 6px hsl(40 100% 50% / 0.7)' }}
            >
              ✦
            </span>
            <p className="font-rd-display text-[9.5px] font-extrabold uppercase" style={{ color: 'hsl(38 85% 70%)', letterSpacing: '0.28em' }}>
              {levelNumber !== undefined ? `LEVEL ${String(levelNumber).padStart(2, '0')} · ` : ''}
              {layout.category.toUpperCase()}
            </p>
          </div>
          <h2 className="rd-title text-[16px] font-extrabold tracking-wide leading-tight mb-1.5">
            {title ?? layout.name}
          </h2>
          <p className="font-rd-flavor text-[11.5px] text-foreground/85 leading-relaxed">{layout.briefing}</p>

          {/* Chamber stat scroll */}
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <RuneStatBadge icon={Grid3X3} label="Board" value="5×5" accent={accent} />
            <RuneStatBadge icon={ShieldCheck} label="Plain" value={25 - layout.preview.hazardZones - layout.preview.treasureZones} accent={accent} />
            <RuneStatBadge icon={Skull}    label="Hazards" value={layout.preview.hazardZones} accent={accent} tone="danger" />
            <RuneStatBadge icon={Gem}      label="Treasure" value={layout.preview.treasureZones} accent={accent} tone="treasure" />
          </div>

          {showStrategy && (
            <div
              className="mt-2.5 px-2.5 py-1.5 rounded-lg flex items-start gap-1.5"
              style={{
                background: 'linear-gradient(180deg, hsl(28 45% 14% / 0.65), hsl(20 50% 8% / 0.65))',
                border: `1px solid hsl(38 60% 40% / 0.4)`,
              }}
            >
              <ScrollText className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'hsl(40 90% 70%)' }} />
              <div className="min-w-0">
                <p className="font-rd-display text-[8px] uppercase tracking-[0.24em]" style={{ color: 'hsl(38 85% 70%)' }}>Strategy</p>
                <p className="text-[10.5px] text-foreground/90 leading-snug mt-0.5">{layout.recommendedStrategy}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// DH Club Home — Club Pulse
//
// Desktop hierarchy rule: space is proportional to how much the user
// needs to act.
//
//   • ACTIONABLE (>=1 pending action)
//       → full hero: top action as the headline + primary CTA, with the
//         remaining pending actions rendered as contextual chips
//         ("Continue your draft", "Vote in an open poll", …).
//
//   • ALL CLEAR (no pending actions)
//       → compact single-row confirmation banner. The reclaimed vertical
//         space goes to live/recent content below instead of being spent
//         announcing an absence of information.

import { Link } from 'react-router-dom';
import { MessageCircle, Bookmark, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { Club } from '@/contexts/ClubContext';
import type { NextAction } from '@/lib/home/nextAction';
import { getAccentTextColor } from '@/lib/colorContrast';
import { DhShield } from './svg/DhShield';

interface Props {
  club: Club | null;
  /** Ranked pending actions. `[0]` drives the headline; the rest become chips. */
  actions: NextAction[];
  installedSlugs: Set<string>;
  /** Anchor id for the activity feed below. */
  activityAnchorId: string;
}

interface ChipDef {
  label: string;
  hint: string;
  icon: LucideIcon;
  gateSlug?: string;
  to: string;
  onActivate?: () => void;
}

export function ClubPulseCard({ club, actions, installedSlugs, activityAnchorId }: Props) {
  const accent = club?.accent_color ?? '152 72% 46%';
  const accentText = getAccentTextColor(accent);
  const pendingAction = actions[0] ?? null;

  const scrollToActivity = () => {
    const el = document.getElementById(activityAnchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ── ALL CLEAR — compact banner ─────────────────────────────── */
  if (!pendingAction) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-xl mb-4 flex items-center gap-3 px-3.5 py-2.5"
        style={{
          background: `linear-gradient(90deg, hsl(${accent} / 0.10), hsl(var(--home-panel-strong) / 0.9))`,
          border: `1px solid hsl(${accent} / 0.24)`,
          boxShadow: 'var(--home-panel-shadow)',
        }}
      >
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
        <p className="text-[12.5px] font-bold leading-tight min-w-0 flex-1 truncate">
          All clear — nothing needs you right now.
        </p>
        <button
          type="button"
          onClick={scrollToActivity}
          className="text-[11.5px] font-extrabold whitespace-nowrap hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md"
          style={{ color: 'hsl(var(--home-accent-ink))' }}
        >
          Recent activity →
        </button>
      </motion.div>
    );
  }

  /* ── ACTIONABLE — hero ──────────────────────────────────────── */

  // Contextual chips: the remaining pending actions first, then a small
  // set of stable fallbacks so the row never renders half-empty.
  const contextual: ChipDef[] = actions.slice(1, 4).map(a => ({
    label: a.label,
    hint: a.sub ?? a.tag ?? 'Jump in',
    icon: a.icon,
    to: a.to,
  }));

  const fallbacks: ChipDef[] = [
    { label: 'Open Draft Arena', hint: 'Make your picks', icon: Bookmark, gateSlug: 'draft-arena', to: '/drafts' },
    { label: 'Start a Poll', hint: 'Get crew input', icon: MessageCircle, gateSlug: 'polls', to: '/polls' },
    { label: 'Check Activity', hint: "See what's new", icon: Sparkles, to: `#${activityAnchorId}`, onActivate: scrollToActivity },
  ];

  const chips = [...contextual, ...fallbacks].slice(0, 3);
  const HeadIcon = pendingAction.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl mb-5"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 0% 50%, hsl(${accent} / 0.10), transparent 60%),
          linear-gradient(180deg, hsl(var(--home-panel) / 0.98), hsl(var(--home-panel-strong) / 0.98))
        `,
        border: `1px solid hsl(${accent} / 0.32)`,
        boxShadow: `0 16px 48px -22px hsl(${accent} / 0.32), var(--home-panel-shadow)`,
      }}
    >
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-[240px] hidden md:block pointer-events-none"
        style={{ opacity: 0.85 }}
      >
        <DhShield
          accent={accent}
          monogram={club?.name?.charAt(0).toUpperCase() ?? 'DH'}
          className="w-full h-full"
        />
      </div>

      {/* Desktop density: padding trimmed ~20% vs the previous hero. */}
      <div className="relative p-4 lg:p-5 md:pr-[230px]">
        <div className="flex items-center gap-1.5 mb-1.5">
          <HeadIcon className="w-3.5 h-3.5" style={{ color: `hsl(${accent})` }} />
          <span
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: 'hsl(var(--home-accent-ink))' }}
          >
            {pendingAction.tag ?? 'Needs you'}
          </span>
        </div>

        <h2 className="text-[19px] lg:text-[23px] font-extrabold tracking-tight leading-tight">
          {pendingAction.label}
        </h2>
        <p className="text-[12.5px] text-muted-foreground/85 leading-snug mt-1 max-w-md">
          {pendingAction.sub ?? 'Tap below to handle it now.'}
        </p>

        <Link
          to={pendingAction.to}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl mt-3 text-[12.5px] font-extrabold active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{
            background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
            color: accentText,
          }}
        >
          Go now <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 max-w-3xl">
          {chips.map((chip) => {
            const Icon = chip.icon;
            const isInstalled = !chip.gateSlug || installedSlugs.has(chip.gateSlug);
            const destination = isInstalled ? chip.to : '/club/assets';

            const inner = (
              <>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `hsl(${accent} / 0.15)`,
                    color: `hsl(${accent})`,
                    border: `1px solid hsl(${accent} / 0.3)`,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[12px] font-extrabold tracking-tight leading-tight truncate">
                    {chip.label}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground/70 leading-tight mt-0.5 truncate">
                    {isInstalled ? chip.hint : 'Install to unlock'}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/55 flex-shrink-0" />
              </>
            );

            const classes = "flex items-center gap-2.5 rounded-xl p-2.5 transition hover:-translate-y-0.5 hover:border-primary/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45";
            const style = {
              background: 'hsl(var(--home-panel-muted) / 0.72)',
              border: '1px solid hsl(var(--home-panel-border) / 0.58)',
              opacity: isInstalled ? 1 : 0.6,
            } as const;

            if (chip.onActivate && isInstalled) {
              return (
                <button key={chip.label} type="button" onClick={chip.onActivate} className={classes} style={style}>
                  {inner}
                </button>
              );
            }
            return (
              <Link key={chip.label} to={destination} className={classes} style={style}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

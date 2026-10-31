// DH Club — First-time club onboarding flow
//
// 3 screens. Mobile-first. Skippable. Capped explicitly so it never grows
// into a long tour when a club has many installed assets — per-feature
// deep dives happen via the New Feature prompts after onboarding ends.
//
// Screen 1: Welcome to [Club Name] + club mark + theme accent
// Screen 2: Your Club Home (hero / quick bar / apps explained)
// Screen 3: Apps in this Club (grid of installed features the user has access to)

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, X, Sparkles, Star, Bookmark,
} from 'lucide-react';
import dhMonogram from '@/assets/dh-monogram.png';
import draftEmblem from '@/assets/draft-emblem.png';
import runedelveEmblem from '@/assets/runedelve-emblem.png';
import nexusEmblem from '@/assets/nexus-emblem.png';
import pickemEmblem from '@/assets/pickem-emblem.png';
import type { Club } from '@/contexts/ClubContext';
import type { InstalledAsset } from '@/types/assets';
import { resolveOnboarding, isVisibleToRole } from '@/lib/onboarding/registry';
import { ONBOARDING_ICONS as ICON_BY_NAME } from '@/lib/onboarding/icons';

const EMBLEM_BY_SLUG: Record<string, string> = {
  'draft-arena':   draftEmblem,
  'rune-delve':    runedelveEmblem,
  'nexus-defense': nexusEmblem,
  'nfl-pickem':    pickemEmblem,
};

interface Props {
  open: boolean;
  club: Club | null;
  displayName: string;
  installedAssets: InstalledAsset[];
  isAdmin: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}

export function ClubOnboardingFlow({
  open, club, displayName, installedAssets, isAdmin,
  onComplete, onDismiss,
}: Props) {
  const [step, setStep] = useState(0);
  const totalSteps = 3;
  const accent = club?.accent_color ?? '152 72% 46%';

  // Only show features the user has access to
  const visibleFeatures = installedAssets
    .filter(ia => ia.enabled)
    .map(ia => ({ asset: ia.asset, onboarding: resolveOnboarding(ia.asset) }))
    .filter(f => isVisibleToRole(f.onboarding, isAdmin));

  if (!open || typeof document === 'undefined') return null;

  const handleNext = () => {
    if (step >= totalSteps - 1) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };
  const handleBack = () => setStep(s => Math.max(0, s - 1));

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] flex flex-col"
        style={{
          background:
            `radial-gradient(ellipse 90% 50% at 50% 0%, hsl(${accent} / 0.18), transparent 70%),` +
            'linear-gradient(180deg, hsl(var(--background)), hsl(var(--background)))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Top bar — Skip + dots */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/65 hover:text-foreground transition-colors"
            aria-label="Skip onboarding"
          >
            Skip
          </button>
          <ProgressDots total={totalSteps} active={step} accent={accent} />
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close onboarding"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground active:scale-90 transition"
            style={{ background: 'hsl(var(--muted) / 0.4)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Slides */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && (
              <WelcomeStep key="welcome" club={club} displayName={displayName} accent={accent} />
            )}
            {step === 1 && (
              <HomeOverviewStep key="home" accent={accent} />
            )}
            {step === 2 && (
              <AppsOverviewStep key="apps" features={visibleFeatures} accent={accent} />
            )}
          </AnimatePresence>
        </div>

        {/* Bottom controls */}
        <div className="px-4 pt-2 pb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            aria-label="Previous step"
            className="w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
            style={{
              background: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border) / 0.4)',
              color: 'hsl(var(--foreground) / 0.75)',
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 h-11 rounded-xl font-extrabold text-[13px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            style={{
              background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
              color: 'hsl(218 50% 6%)',
              boxShadow: `0 6px 18px -6px hsl(${accent} / 0.6)`,
            }}
          >
            {step === totalSteps - 1 ? (
              <>Enter Club <ChevronRight className="w-4 h-4" strokeWidth={3} /></>
            ) : (
              <>Next <ChevronRight className="w-4 h-4" strokeWidth={3} /></>
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

/* ─── Step components ──────────────────────────────────────────── */

function WelcomeStep({ club, displayName, accent }: { club: Club | null; displayName: string; accent: string }) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 flex flex-col items-center justify-center text-center"
    >
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: club?.logo_url ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.22), hsl(${accent} / 0.06))`,
          border: `1.5px solid hsl(${accent} / 0.4)`,
          boxShadow: `0 0 28px -6px hsl(${accent} / 0.55)`,
        }}
      >
        {club?.logo_url ? (
          <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover rounded-3xl" />
        ) : (
          <img src={dhMonogram} alt="" className="w-12 h-12 object-contain" />
        )}
      </div>
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.25em] mb-1"
        style={{ color: `hsl(${accent})` }}
      >
        Welcome to
      </p>
      <h1 className="text-[28px] font-extrabold tracking-tight leading-tight mb-3">
        {club?.name ?? 'DH Club'}
      </h1>
      <p className="text-[13px] text-foreground/75 max-w-[300px] leading-relaxed">
        {displayName ? `Quick tour, ${displayName.split(' ')[0]}. ` : 'Quick tour. '}
        Here's what this club has available and how to find it.
      </p>
    </motion.div>
  );
}

function HomeOverviewStep({ accent }: { accent: string }) {
  const highlights = [
    { icon: Sparkles, title: 'Your next move', body: 'See draft turns, unread conversations and the club activity that needs your attention.' },
    { icon: Bookmark, title: 'Your apps', body: 'Keep your most-used apps close. Edit your shortcuts from Home.' },
    { icon: Star,     title: 'Your DH Score', body: 'Track achievements across the club and see what to work toward next.' },
  ];

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 flex flex-col"
    >
      <div className="text-center mb-5 mt-2">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.25em] mb-1"
          style={{ color: `hsl(${accent})` }}
        >
          Step 2 · The Home Screen
        </p>
        <h2 className="text-[22px] font-extrabold tracking-tight leading-tight">Your club, at a glance</h2>
        <p className="text-[11.5px] text-muted-foreground/75 mt-1.5 max-w-[300px] mx-auto leading-relaxed">
          Home adapts to what your club has installed. No clutter, no empty sections.
        </p>
      </div>
      <div className="space-y-2.5">
        {highlights.map(h => (
          <div
            key={h.title}
            className="rounded-2xl p-3 flex items-start gap-3"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
              border: `1px solid hsl(${accent} / 0.22)`,
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${accent} / 0.18), hsl(${accent} / 0.04))`,
                color: `hsl(${accent})`,
              }}
            >
              <h.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold leading-tight">{h.title}</p>
              <p className="text-[11px] text-muted-foreground/80 leading-snug mt-0.5">{h.body}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AppsOverviewStep({
  features,
  accent,
}: {
  features: Array<{ asset: InstalledAsset['asset']; onboarding: ReturnType<typeof resolveOnboarding> }>;
  accent: string;
}) {
  const empty = features.length === 0;
  return (
    <motion.div
      key="apps"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 flex flex-col"
    >
      <div className="text-center mb-5 mt-2">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.25em] mb-1"
          style={{ color: `hsl(${accent})` }}
        >
          Step 3 · Apps in this Club
        </p>
        <h2 className="text-[22px] font-extrabold tracking-tight leading-tight">
          {empty ? 'No apps yet' : `${features.length} app${features.length === 1 ? '' : 's'} installed`}
        </h2>
        <p className="text-[11.5px] text-muted-foreground/75 mt-1.5 max-w-[300px] mx-auto leading-relaxed">
          {empty
            ? 'Your admin will enable games and tools from the Asset Library. You\'ll see them here as they\'re added.'
            : "Tap any tile after onboarding to dive in. When new apps are added, you'll get a quick intro."}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {features.map(f => {
          const Icon = ICON_BY_NAME[f.onboarding.iconKey ?? f.asset.icon_name] ?? Star;
          const emblem = EMBLEM_BY_SLUG[f.asset.slug];
          return (
            <div
              key={f.asset.id}
              className="rounded-2xl p-2.5 flex flex-col items-center gap-1.5 aspect-square"
              style={{
                background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
                border: `1px solid hsl(${accent} / 0.22)`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${accent} / 0.18), hsl(${accent} / 0.04))`,
                  border: `1px solid hsl(${accent} / 0.28)`,
                  color: `hsl(${accent})`,
                }}
              >
                {emblem ? (
                  <img src={emblem} alt="" className="w-6 h-6 object-contain" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <p className="text-[10px] font-bold leading-tight text-center line-clamp-2">{f.asset.name}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ProgressDots({ total, active, accent }: { total: number; active: number; accent: string }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${active + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i === active ? '18px' : '6px',
            height: '6px',
            background: i === active ? `hsl(${accent})` : 'hsl(var(--muted-foreground) / 0.35)',
            boxShadow: i === active ? `0 0 8px hsl(${accent} / 0.55)` : undefined,
          }}
        />
      ))}
    </div>
  );
}

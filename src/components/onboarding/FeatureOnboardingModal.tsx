// DH Club — Single-feature onboarding modal
//
// Tutorial modal for one feature. Drives the New Feature carousel, the
// admin Preview surface from Asset Library, and any future deep-link
// tutorial routes. Mobile-first bottom sheet with progress dots.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Check, Sparkles,
} from 'lucide-react';
import type { FeatureOnboarding } from '@/lib/onboarding/registry';
import { ONBOARDING_ICONS as ICON_BY_NAME } from '@/lib/onboarding/icons';

interface Props {
  open: boolean;
  onboarding: FeatureOnboarding | null;
  /** Accent (HSL parts) — defaults to the club accent when called from Home. */
  accent: string;
  onClose: () => void;
  onComplete?: () => void;
  onDismiss?: () => void;
  onRemindLater?: () => void;
  /** Admin preview mode hides the "remind later / dismiss" affordances. */
  previewMode?: boolean;
}

export function FeatureOnboardingModal({
  open, onboarding, accent,
  onClose, onComplete, onDismiss, onRemindLater,
  previewMode,
}: Props) {
  const [step, setStep] = useState(0);

  if (!open || !onboarding || typeof document === 'undefined') return null;

  const totalSteps = onboarding.onboardingSteps.length;
  const isLast = step >= totalSteps - 1;
  const HeaderIcon = ICON_BY_NAME[onboarding.iconKey ?? ''] ?? Sparkles;

  const handleNext = () => {
    if (isLast) {
      onComplete?.();
      onClose();
      setTimeout(() => setStep(0), 200);
    } else {
      setStep(s => s + 1);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => setStep(0), 200);
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] flex items-end justify-center"
        style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-2xl"
          style={{
            background:
              `radial-gradient(ellipse 90% 40% at 50% 0%, hsl(${accent} / 0.18), transparent 70%),` +
              'linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)))',
            border: `1px solid hsl(${accent} / 0.32)`,
            boxShadow: `0 -10px 30px -8px hsl(${accent} / 0.32)`,
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Drag handle + close */}
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
            <div className="w-10 h-1 rounded-full bg-border/40 mx-auto" />
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground active:scale-90 transition"
            style={{ background: 'hsl(var(--muted) / 0.4)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Header */}
          <div className="px-5 pt-2">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, hsl(${accent} / 0.22), hsl(${accent} / 0.04))`,
                  border: `1.5px solid hsl(${accent} / 0.4)`,
                  color: `hsl(${accent})`,
                  boxShadow: `0 0 16px -6px hsl(${accent} / 0.5)`,
                }}
              >
                <HeaderIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[9px] font-extrabold uppercase tracking-[0.22em] truncate"
                  style={{ color: `hsl(${accent})` }}
                >
                  {previewMode ? 'Preview · ' : '✦ New · '}{onboarding.featureType.toUpperCase()}
                </p>
                <h2 className="text-[17px] font-extrabold tracking-tight leading-tight truncate">
                  {onboarding.onboardingTitle}
                </h2>
              </div>
            </div>
            <p className="text-[12px] text-foreground/80 leading-relaxed">
              {onboarding.onboardingSummary}
            </p>
            {onboarding.tags && onboarding.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {onboarding.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[9px] font-extrabold uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-md"
                    style={{
                      color: `hsl(${accent})`,
                      background: `hsl(${accent} / 0.14)`,
                      border: `1px solid hsl(${accent} / 0.28)`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Step content */}
          <div className="px-5 mt-4 mb-3">
            <AnimatePresence mode="wait" initial={false}>
              <StepCard
                key={step}
                step={onboarding.onboardingSteps[step]}
                accent={accent}
              />
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          {totalSteps > 1 && (
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: i === step ? '18px' : '6px',
                    height: '6px',
                    background: i === step ? `hsl(${accent})` : 'hsl(var(--muted-foreground) / 0.3)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="px-5 flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                aria-label="Previous"
                className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition"
                style={{
                  background: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border) / 0.4)',
                  color: 'hsl(var(--foreground) / 0.75)',
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              !previewMode && (
                <button
                  type="button"
                  onClick={() => { onRemindLater?.(); handleClose(); }}
                  className="h-11 px-3 rounded-xl text-[11px] font-bold active:scale-[0.98] transition"
                  style={{
                    background: 'hsl(var(--muted) / 0.4)',
                    border: '1px solid hsl(var(--border) / 0.4)',
                    color: 'hsl(var(--foreground) / 0.75)',
                  }}
                >
                  Maybe later
                </button>
              )
            )}

            {isLast && onboarding.primaryCta ? (
              <Link
                to={onboarding.primaryCta.route}
                onClick={() => { onComplete?.(); handleClose(); }}
                className="flex-1 h-11 rounded-xl font-extrabold text-[13px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                style={{
                  background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
                  color: 'hsl(218 50% 6%)',
                  boxShadow: `0 6px 18px -6px hsl(${accent} / 0.6)`,
                }}
              >
                {onboarding.primaryCta.label} <ChevronRight className="w-4 h-4" strokeWidth={3} />
              </Link>
            ) : (
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
                {isLast ? 'Done' : 'Next'} <ChevronRight className="w-4 h-4" strokeWidth={3} />
              </button>
            )}
          </div>

          {/* Don't show again — only on first step, not in preview */}
          {!previewMode && step === 0 && totalSteps > 1 && (
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => { onDismiss?.(); handleClose(); }}
                className="text-[10.5px] text-muted-foreground/55 hover:text-muted-foreground/80 transition-colors"
              >
                Don&apos;t show again
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function StepCard({
  step,
  accent,
}: {
  step: FeatureOnboarding['onboardingSteps'][number];
  accent: string;
}) {
  const Icon = ICON_BY_NAME[step.iconKey ?? ''] ?? Sparkles;
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl p-3.5 flex items-start gap-3"
      style={{
        background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
        border: `1px solid hsl(${accent} / 0.28)`,
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(${accent} / 0.22), hsl(${accent} / 0.04))`,
          color: `hsl(${accent})`,
        }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight">{step.title}</p>
        <p className="text-[12px] text-foreground/80 leading-relaxed mt-1">{step.body}</p>
      </div>
    </motion.div>
  );
}

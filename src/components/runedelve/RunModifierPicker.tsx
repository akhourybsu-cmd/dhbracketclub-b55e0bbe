// Rune Delve — Run Modifier Picker (R3)
//
// Overlay shown at the start of every chamber. Presents three random
// modifiers and a Skip ("Steady Path") affordance so the player can
// always opt out. Once picked, persists for the rest of the run and
// is reflected on the HUD + results card.
//
// Visual style: card grid. Each card shows the modifier glyph, tier
// pip, name, and description. Tier 3 ("volatile") cards get a brighter
// border so the risk is legible at a glance.

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RunModifier } from '@/lib/runedelve/runModifiers';

interface Props {
  offer: RunModifier[];
  onPick: (mod: RunModifier) => void;
  /** "Take the Steady Path" — picker dismisses with no modifier active. */
  onSkip: () => void;
}

const TIER_LABEL: Record<RunModifier['tier'], string> = {
  0: 'Steady',
  1: 'Mild',
  2: 'Strong',
  3: 'Volatile',
};

export function RunModifierPicker({ offer, onPick, onSkip }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 50%, hsl(218 50% 10% / 0.92), hsl(218 60% 4% / 0.96))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="max-w-md w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-5"
        >
          <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full mb-2"
            style={{
              background: 'hsl(45 95% 55% / 0.12)',
              border: '1px solid hsl(45 95% 55% / 0.32)',
              color: 'hsl(45 95% 60%)',
            }}>
            <Sparkles className="w-3 h-3" />
            <span className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]">Optional Chamber Rule</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Pick your edge.</h2>
          <p className="text-[12px] text-muted-foreground/75 mt-1 leading-snug">
            Each choice has a trade-off. Steady Path adds no extra rule.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="space-y-2.5 mb-4">
          {offer.map((mod, i) => (
            <motion.button
              key={mod.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.08 + i * 0.07 }}
              onClick={() => onPick(mod)}
              className={cn(
                'w-full text-left rounded-2xl p-4 flex items-start gap-3 active:scale-[0.985] transition-transform',
                mod.tier === 3 && 'rd-mod-volatile',
              )}
              style={{
                background: `linear-gradient(135deg, hsl(${mod.accent} / 0.14), hsl(${mod.accent} / 0.04) 60%, hsl(var(--card) / 0.7))`,
                border: `1px solid hsl(${mod.accent} / ${mod.tier === 3 ? 0.55 : 0.32})`,
                boxShadow: mod.tier === 3
                  ? `0 0 22px -6px hsl(${mod.accent} / 0.35)`
                  : `0 6px 18px -10px hsl(${mod.accent} / 0.25)`,
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, hsl(${mod.accent} / 0.28), hsl(${mod.accent} / 0.08))`,
                  border: `1px solid hsl(${mod.accent} / 0.4)`,
                  color: `hsl(${mod.accent})`,
                }}
                aria-hidden
              >
                {mod.glyph}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h3 className="font-extrabold text-[14px] tracking-tight">{mod.name}</h3>
                  <span
                    className="text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-[1px] rounded-full"
                    style={{
                      background: `hsl(${mod.accent} / 0.18)`,
                      color: `hsl(${mod.accent})`,
                      border: `1px solid hsl(${mod.accent} / 0.4)`,
                    }}
                  >
                    {TIER_LABEL[mod.tier]}
                  </span>
                </div>
                <p className="font-rd-flavor text-[12px] text-foreground/80 leading-snug">{mod.description}</p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Skip — Steady Path */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.35 }}
          className="text-center"
        >
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-[11.5px] font-extrabold text-foreground/80 hover:text-foreground transition-colors px-4 py-3 rounded-xl border border-border/45 bg-card/30 active:bg-muted/30"
          >
            ◇ Steady Path · No bonus, no penalty
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

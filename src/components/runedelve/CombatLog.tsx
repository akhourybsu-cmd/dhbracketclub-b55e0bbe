import { AnimatePresence, motion } from "framer-motion";
import {
  Sword,
  Heart,
  Sparkles,
  Shield,
  Skull,
  Zap,
  AlertTriangle,
  Droplet,
} from "lucide-react";

export type CombatLogKind =
  | "damage" // you dealt damage
  | "kill" // enemy slain
  | "heal" // healed HP
  | "mana" // gained mana
  | "shield" // gained guard turns
  | "taken" // hp lost from enemies
  | "mitigated" // shield reduced damage
  | "corruption" // hp lost from corruption tiles
  | "heavy" // telegraphed heavy strike
  | "laststand" // saved by Last Stand
  | "ability" // ability fired
  | "info"; // generic

export interface CombatLogEntry {
  id: string;
  kind: CombatLogKind;
  text: string;
  amount?: number;
}

interface IconStyle {
  icon: typeof Sword;
  /** raw HSL token, e.g. "var(--destructive)" or "0 84% 60%" */
  color: string;
  bg: string;
}

const STYLES: Record<CombatLogKind, IconStyle> = {
  damage: {
    icon: Sword,
    color: "hsl(var(--destructive))",
    bg: "hsl(var(--destructive) / 0.16)",
  },
  kill: {
    icon: Skull,
    color: "hsl(var(--gold))",
    bg: "hsl(var(--gold) / 0.18)",
  },
  heal: {
    icon: Heart,
    color: "hsl(142 76% 55%)",
    bg: "hsl(142 76% 55% / 0.16)",
  },
  mana: {
    icon: Sparkles,
    color: "hsl(210 90% 65%)",
    bg: "hsl(210 90% 65% / 0.16)",
  },
  shield: {
    icon: Shield,
    color: "hsl(var(--gold))",
    bg: "hsl(var(--gold) / 0.16)",
  },
  taken: {
    icon: Droplet,
    color: "hsl(0 84% 65%)",
    bg: "hsl(0 84% 65% / 0.16)",
  },
  mitigated: {
    icon: Shield,
    color: "hsl(48 96% 65%)",
    bg: "hsl(48 96% 65% / 0.14)",
  },
  corruption: {
    icon: AlertTriangle,
    color: "hsl(280 70% 65%)",
    bg: "hsl(280 70% 65% / 0.16)",
  },
  heavy: { icon: Zap, color: "hsl(28 96% 60%)", bg: "hsl(28 96% 60% / 0.18)" },
  laststand: {
    icon: Heart,
    color: "hsl(0 84% 65%)",
    bg: "hsl(0 84% 65% / 0.18)",
  },
  ability: {
    icon: Sparkles,
    color: "hsl(var(--primary))",
    bg: "hsl(var(--primary) / 0.18)",
  },
  info: {
    icon: Sword,
    color: "hsl(var(--muted-foreground))",
    bg: "hsl(var(--muted) / 0.4)",
  },
};

/**
 * Premium animated combat feed. Renders the most recent N entries from oldest
 * (top, faded) to newest (bottom, full opacity). Each entry slides up + fades
 * on enter and gracefully fades on exit. Designed to fit just below the rune
 * board within the existing fantasy aesthetic.
 */
export function CombatLog({
  entries,
  max = 4,
}: {
  entries: CombatLogEntry[];
  max?: number;
}) {
  const visible = entries.slice(-max);

  return (
    <div
      className="relative rounded-xl px-2.5 py-2 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--rd-stone-edge) / 0.55), hsl(var(--rd-stone-edge) / 0.35))",
        border: "1px solid hsl(var(--gold) / 0.18)",
        boxShadow: "inset 0 1px 0 hsl(var(--gold) / 0.08)",
      }}
      aria-live="polite"
      aria-atomic="false"
    >
      {/* Header chip */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <p
          className="text-[8.5px] font-extrabold uppercase tracking-[0.18em]"
          style={{ color: "hsl(var(--gold) / 0.85)" }}
        >
          Battle Chronicle
        </p>
        {entries.length === 0 && (
          <span className="text-[9px] text-foreground/50 italic">
            awaiting your move…
          </span>
        )}
      </div>

      <ul className="space-y-1 min-h-[2.25rem]">
        <AnimatePresence initial={false}>
          {visible.map((entry, idx) => {
            const style = STYLES[entry.kind];
            const Icon = style.icon;
            // Older entries fade slightly so the freshest line pops.
            const ageOpacity =
              visible.length > 1
                ? 0.55 + 0.45 * (idx / Math.max(visible.length - 1, 1))
                : 1;
            return (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: ageOpacity, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 30,
                  mass: 0.7,
                }}
                className="flex items-center gap-2"
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: style.bg,
                    border: `1px solid ${style.color}`,
                  }}
                >
                  <Icon className="w-3 h-3" style={{ color: style.color }} />
                </span>
                <span className="text-[11px] font-semibold leading-snug flex-1 min-w-0 text-foreground/95">
                  {entry.text}
                </span>
                {entry.amount != null && (
                  <span
                    className="text-[11px] font-extrabold tabular-nums shrink-0"
                    style={{ color: style.color }}
                  >
                    {entry.kind === "heal" ||
                    entry.kind === "mana" ||
                    entry.kind === "shield"
                      ? "+"
                      : ""}
                    {entry.amount}
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

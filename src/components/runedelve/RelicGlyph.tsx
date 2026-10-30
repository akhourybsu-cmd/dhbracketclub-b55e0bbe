import {
  Activity,
  Compass,
  Crown,
  Droplets,
  Eye,
  Flame,
  Gem,
  Heart,
  KeyRound,
  Leaf,
  Mountain,
  Orbit,
  Shield,
  Sparkles,
  Sun,
  Swords,
  Target,
  Timer,
  WandSparkles,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { RelicDef } from "@/lib/runedelve/relics";
import { cn } from "@/lib/utils";

const GLYPHS: Record<string, LucideIcon> = {
  ember_edge: Flame,
  aether_spark: Gem,
  iron_resolve: Shield,
  verdant_heart: Leaf,
  keysight: KeyRound,
  quickstep: Wind,
  shrine_ward: Sun,
  wanderers_compass: Compass,
  mirror_shard: Sparkles,
  brambleward: Mountain,
  crimson_tide: Droplets,
  sapphire_flow: Gem,
  last_stand: Heart,
  cleansing_touch: WandSparkles,
  momentum: Zap,
  foresight: Eye,
  bulwark: Shield,
  spiked_aegis: Swords,
  vampiric_sigil: Droplets,
  rune_echo: Orbit,
  executioners_mark: Target,
  first_light: Sun,
  bloodbond: Heart,
  desperate_surge: Activity,
  cracked_crown: Crown,
  foreseers_lens: Timer,
  void_pact: Orbit,
  phoenix_heart: Flame,
};

/** A consistent, readable item silhouette instead of device-dependent emoji. */
export function RelicGlyph({
  relic,
  className,
}: {
  relic: RelicDef;
  className?: string;
}) {
  const Glyph = GLYPHS[relic.id] ?? Gem;
  return (
    <span
      className={cn("rd-relic-glyph", className)}
      data-category={relic.category}
      data-tier={relic.tier}
      aria-hidden="true"
    >
      <span className="rd-relic-glyph-ring" />
      <svg className="rd-relic-frame" viewBox="0 0 80 80" fill="none" focusable="false">
        <path d="M26 5h28l21 21v28L54 75H26L5 54V26Z" stroke="currentColor" strokeWidth=".75" />
        <path d="m27 9-18 18m44-18 18 18m0 26L53 71M9 53l18 18" stroke="currentColor" strokeWidth="2" />
        {relic.tier >= 2 && <path d="M23 3 15 15 3 23m54-20 8 12 12 8m0 34L65 65 57 77M3 57l12 8 8 12" stroke="currentColor" strokeWidth=".8" />}
        {relic.tier === 3 && <path d="m40 0 4 5-4 5-4-5Zm40 40-5 4-5-4 5-4ZM40 80l-4-5 4-5 4 5ZM0 40l5-4 5 4-5 4Z" fill="currentColor" />}
        <path d="m40 8 2 3-2 3-2-3Zm29 32-3 2-3-2 3-2ZM40 66l2 3-2 3-2-3ZM14 40l-3 2-3-2 3-2Z" fill="currentColor" opacity=".7" />
      </svg>
      <Glyph className="rd-relic-symbol" strokeWidth={1.35} />
    </span>
  );
}

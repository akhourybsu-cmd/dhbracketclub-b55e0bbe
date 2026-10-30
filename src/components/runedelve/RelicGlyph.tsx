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
      <Glyph strokeWidth={1.4} />
    </span>
  );
}

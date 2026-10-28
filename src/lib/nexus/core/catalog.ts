import type { CoreScenario, EnemyType, ResearchId, UpgradeId } from "./types";

export const CAMPAIGN: CoreScenario[] = [
  {
    id: "1",
    title: "First light",
    subtitle: "SECTOR 01",
    description:
      "Bring the reactor online. Hold against drones and learn to build your core.",
    waves: 5,
    difficulty: 1,
    reward: 70,
    speed: 1,
    hp: 1,
    mode: "campaign",
  },
  {
    id: "2",
    title: "Fast approach",
    subtitle: "SECTOR 02",
    description:
      "Runners close the distance fast. Fire rate and a wider range give you breathing room.",
    waves: 6,
    difficulty: 1.15,
    reward: 85,
    speed: 1.08,
    hp: 1.08,
    mode: "campaign",
  },
  {
    id: "3",
    title: "Swarm signal",
    subtitle: "SECTOR 03",
    description:
      "The perimeter fills with smaller threats. Multiple shots and orbitals control the crowd.",
    waves: 7,
    difficulty: 1.3,
    reward: 100,
    speed: 1,
    hp: 1.12,
    mode: "campaign",
  },
  {
    id: "4",
    title: "Iron rain",
    subtitle: "SECTOR 04",
    description:
      "Heavy armor enters the field. Build damage before the tanks reach your shield.",
    waves: 8,
    difficulty: 1.45,
    reward: 120,
    speed: 1,
    hp: 1.2,
    mode: "campaign",
  },
  {
    id: "5",
    title: "Fracture",
    subtitle: "SECTOR 05",
    description:
      "Splitters leave a second threat behind. Keep a nova ready when the circle closes.",
    waves: 9,
    difficulty: 1.6,
    reward: 140,
    speed: 1.04,
    hp: 1.25,
    mode: "campaign",
  },
  {
    id: "6",
    title: "Event horizon",
    subtitle: "SECTOR 06",
    description:
      "Mixed attacks from every direction. Balance a lethal reactor with a resilient hull.",
    waves: 10,
    difficulty: 1.8,
    reward: 160,
    speed: 1.08,
    hp: 1.3,
    mode: "campaign",
  },
  {
    id: "7",
    title: "Dark matter",
    subtitle: "SECTOR 07",
    description:
      "A faster, heavier assault. Fortify early and save energy for the final approach.",
    waves: 11,
    difficulty: 2,
    reward: 180,
    speed: 1.12,
    hp: 1.4,
    mode: "campaign",
  },
  {
    id: "8",
    title: "Last star",
    subtitle: "SECTOR 08",
    description:
      "The final siege. Two siege-class bosses stand between your core and a clear horizon.",
    waves: 12,
    difficulty: 2.2,
    reward: 220,
    speed: 1.15,
    hp: 1.5,
    mode: "campaign",
  },
];

export const ENDLESS: CoreScenario = {
  id: "endless",
  mode: "endless",
  title: "Into the infinite",
  subtitle: "ENDLESS",
  description:
    "No final wave. Every fifth wave brings a siege boss. Build, adapt, and set your next record.",
  waves: null,
  difficulty: 1,
  reward: 0,
  speed: 1,
  hp: 1,
};

export const CHALLENGES: CoreScenario[] = [
  {
    id: "rush",
    mode: "challenge",
    title: "Velocity",
    subtitle: "SPEED CHALLENGE",
    description:
      "All enemies move 60% faster. Hold for 8 waves before the perimeter collapses.",
    waves: 8,
    difficulty: 1.1,
    reward: 120,
    speed: 1.6,
    hp: 0.9,
    rule: "rush",
  },
  {
    id: "glass",
    mode: "challenge",
    title: "Glass cannon",
    subtitle: "PRECISION CHALLENGE",
    description:
      "One hull point. No shield, armor, or repair. Double weapon damage. Make every shot count.",
    waves: 6,
    difficulty: 1,
    reward: 150,
    speed: 1,
    hp: 1,
    rule: "glass",
  },
  {
    id: "siege",
    mode: "challenge",
    title: "Heavy metal",
    subtitle: "SIEGE CHALLENGE",
    description:
      "Armored enemies from wave one and a boss every third wave. Break the siege in 9 waves.",
    waves: 9,
    difficulty: 1.15,
    reward: 150,
    speed: 0.85,
    hp: 1.25,
    rule: "siege",
  },
  {
    id: "blackout",
    mode: "challenge",
    title: "Blackout",
    subtitle: "SURVIVAL CHALLENGE",
    description:
      "Hull repair and shield recharge are offline. Survive 8 waves on what you can build.",
    waves: 8,
    difficulty: 1,
    reward: 130,
    speed: 1,
    hp: 1,
    rule: "blackout",
  },
];

export function getScenario(id?: string): CoreScenario | undefined {
  // Keep old Endless launch URLs useful, without loading the path-based engine.
  if (id === "100" || id === "endless") return ENDLESS;
  return [...CAMPAIGN, ...CHALLENGES].find((s) => s.id === id);
}

export const ENEMIES: Record<
  EnemyType,
  {
    name: string;
    hp: number;
    speed: number;
    damage: number;
    radius: number;
    bounty: number;
    color: string;
    detail: string;
  }
> = {
  drone: {
    name: "Drone",
    hp: 24,
    speed: 22,
    damage: 9,
    radius: 9,
    bounty: 7,
    color: "hsl(12 95% 65%)",
    detail: "Steady approach. The backbone of every assault.",
  },
  runner: {
    name: "Runner",
    hp: 18,
    speed: 49,
    damage: 7,
    radius: 7,
    bounty: 8,
    color: "hsl(42 100% 64%)",
    detail: "Light and fast. Range and fire rate buy you time.",
  },
  swarm: {
    name: "Swarm",
    hp: 10,
    speed: 33,
    damage: 5,
    radius: 5,
    bounty: 4,
    color: "hsl(330 90% 71%)",
    detail: "Small, numerous, and fragile. Orbitals thin the pack.",
  },
  tank: {
    name: "Bulwark",
    hp: 100,
    speed: 13,
    damage: 19,
    radius: 14,
    bounty: 17,
    color: "hsl(275 88% 73%)",
    detail: "Slow heavy armor absorbs 25% of weapon damage.",
  },
  splitter: {
    name: "Splitter",
    hp: 65,
    speed: 20,
    damage: 13,
    radius: 11,
    bounty: 14,
    color: "hsl(155 79% 62%)",
    detail: "Releases three swarm units when destroyed.",
  },
  boss: {
    name: "Siege engine",
    hp: 400,
    speed: 9,
    damage: 32,
    radius: 23,
    bounty: 65,
    color: "hsl(0 92% 68%)",
    detail: "A massive armored threat. Arrives every fifth wave.",
  },
};

export const UPGRADES: {
  id: UpgradeId;
  name: string;
  category: "attack" | "weapons" | "defense" | "utility";
  description: string;
  cost: number;
  growth?: number;
  max: number;
  icon: string;
}[] = [
  {
    id: "damage",
    name: "Weapon power",
    category: "attack",
    description: "+22% base damage for all weapons",
    cost: 28,
    max: 10,
    icon: "Crosshair",
  },
  {
    id: "haste",
    name: "Fire rate",
    category: "attack",
    description: "+16% base pulse fire rate",
    cost: 34,
    max: 8,
    icon: "Zap",
  },
  {
    id: "range",
    name: "Targeting range",
    category: "attack",
    description: "+20 detection radius",
    cost: 40,
    max: 6,
    icon: "Radar",
  },
  {
    id: "multishot",
    name: "Multishot",
    category: "attack",
    description: "+1 simultaneous target",
    cost: 110,
    growth: 1.85,
    max: 3,
    icon: "Split",
  },
  {
    id: "critical",
    name: "Critical strike",
    category: "attack",
    description: "+6% chance of 2.5× pulse damage",
    cost: 30,
    max: 5,
    icon: "Sparkles",
  },
  {
    id: "hull",
    name: "Hull plating",
    category: "defense",
    description: "+45 max hull · restores 45",
    cost: 36,
    max: 8,
    icon: "Heart",
  },
  {
    id: "shield",
    name: "Barrier",
    category: "defense",
    description: "+30 shield · restores 30",
    cost: 40,
    max: 8,
    icon: "Shield",
  },
  {
    id: "regen",
    name: "Nanite repair",
    category: "defense",
    description: "+1.1 hull repaired per second",
    cost: 60,
    max: 5,
    icon: "HeartPulse",
  },
  {
    id: "armor",
    name: "Reactive armor",
    category: "defense",
    description: "+6% damage reduction per level",
    cost: 50,
    max: 6,
    icon: "Hexagon",
  },
  {
    id: "income",
    name: "Energy siphon",
    category: "utility",
    description: "+10% energy from kills & waves",
    cost: 50,
    growth: 1.75,
    max: 6,
    icon: "BatteryCharging",
  },
  {
    id: "orbit",
    name: "Orbital blades",
    category: "weapons",
    description: "Add an orbiting close-range weapon",
    cost: 75,
    growth: 1.65,
    max: 4,
    icon: "Orbit",
  },
  {
    id: "frost",
    name: "Stasis field",
    category: "utility",
    description: "+8% inner-ring movement slow",
    cost: 65,
    max: 4,
    icon: "Snowflake",
  },
  {
    id: "arc",
    name: "Chain arc",
    category: "weapons",
    description: "Lightning jumps between nearby enemies",
    cost: 100,
    growth: 1.6,
    max: 5,
    icon: "Zap",
  },
  {
    id: "rail",
    name: "Rail lance",
    category: "weapons",
    description: "Piercing beam bypasses armor",
    cost: 135,
    growth: 1.6,
    max: 5,
    icon: "Crosshair",
  },
];

export const RESEARCH: {
  id: ResearchId;
  name: string;
  description: string;
  cost: number;
  max: number;
  icon: string;
}[] = [
  {
    id: "weapons",
    name: "Weapon amplifier",
    description: "+8% base damage for all weapons",
    cost: 35,
    max: 10,
    icon: "Crosshair",
  },
  {
    id: "reactor",
    name: "Reactor tuning",
    description: "+5% starting fire rate per level",
    cost: 40,
    max: 10,
    icon: "Zap",
  },
  {
    id: "plating",
    name: "Core structure",
    description: "+20 starting hull per level",
    cost: 30,
    max: 10,
    icon: "Heart",
  },
  {
    id: "barrier",
    name: "Shield matrix",
    description: "+15 starting shield per level",
    cost: 30,
    max: 10,
    icon: "Shield",
  },
  {
    id: "salvage",
    name: "Energy reserves",
    description: "+12 starting energy per level",
    cost: 35,
    max: 10,
    icon: "BatteryCharging",
  },
  {
    id: "nova",
    name: "Nova capacitor",
    description: "+15% nova damage per level",
    cost: 40,
    max: 10,
    icon: "Orbit",
  },
];

import type {
  AuxiliaryId,
  CoreLoadout,
  CoreRun,
  ModuleId,
  UnlockId,
  UpgradeId,
} from "./types";

export const STARTER_LOADOUT: CoreLoadout = { weapons: [], module: null };
export const POWER_BUDGET = 4;
export const WEAPON_SLOTS = 2;
export const ARMORY: {
  id: UnlockId;
  name: string;
  kind: "weapon" | "module";
  role: string;
  description: string;
  tradeoff: string;
  icon: string;
  cost: number;
  waves: number;
  power: number;
}[] = [
  {
    id: "orbit",
    name: "Orbital blades",
    kind: "weapon",
    role: "Close defense",
    description:
      "Rotating blades repeatedly strike anything near your hull. Each battle upgrade adds a blade.",
    tradeoff: "Cheap power draw; cannot intercept distant threats.",
    icon: "Orbit",
    cost: 90,
    waves: 5,
    power: 1,
  },
  {
    id: "arc",
    name: "Chain arc",
    kind: "weapon",
    role: "Crowd control",
    description:
      "Instant lightning jumps through a cluster of enemies. More upgrades add jumps and damage.",
    tradeoff: "Excellent against packs; each jump loses damage.",
    icon: "Zap",
    cost: 160,
    waves: 15,
    power: 2,
  },
  {
    id: "rail",
    name: "Rail lance",
    kind: "weapon",
    role: "Armor breaker",
    description:
      "A high-damage beam seeks the strongest enemy, bypassing armor and piercing aligned enemies.",
    tradeoff: "Slow firing cycle; draws 3 of your 4 power.",
    icon: "Crosshair",
    cost: 300,
    waves: 35,
    power: 3,
  },
  {
    id: "mortar",
    name: "Siege mortar",
    kind: "weapon",
    role: "Area bombardment",
    description:
      "Lobs a delayed shell into the densest group. Every enemy in the blast takes full splash damage.",
    tradeoff: "Wide coverage; fast enemies can leave the impact zone.",
    icon: "Radar",
    cost: 450,
    waves: 60,
    power: 2,
  },
  {
    id: "flak",
    name: "Flak battery",
    kind: "weapon",
    role: "Fast interception",
    description:
      "Proximity bursts prioritize the fastest enemy inside range and damage its neighbors.",
    tradeoff: "Short range and modest damage against isolated armor.",
    icon: "Radar",
    cost: 850,
    waves: 140,
    power: 1,
  },
  {
    id: "laser",
    name: "Prism laser",
    kind: "weapon",
    role: "Sustained boss damage",
    description:
      "A continuous beam locks the strongest target. Damage ramps to three times its initial output over three seconds.",
    tradeoff: "Heat resets when the target dies or leaves range.",
    icon: "Crosshair",
    cost: 1400,
    waves: 250,
    power: 2,
  },
  {
    id: "venom",
    name: "Corrosive injector",
    kind: "weapon",
    role: "Armor attrition",
    description:
      "Coats a fresh target with four seconds of corrosion that bypasses armor. Upgrades spread it to more enemies.",
    tradeoff: "Damage takes time. Reapplying refreshes rather than stacking.",
    icon: "Sparkles",
    cost: 2800,
    waves: 650,
    power: 2,
  },
  {
    id: "repair",
    name: "Repair nanites",
    kind: "module",
    role: "Sustain",
    description:
      "Fortify the core with +20% max hull and repair 2.5 hull per second. Unlocks further nanite repairs.",
    tradeoff: "Occupies your one support slot.",
    icon: "HeartPulse",
    cost: 100,
    waves: 10,
    power: 0,
  },
  {
    id: "siphon",
    name: "Energy siphon",
    kind: "module",
    role: "Economy",
    description:
      "Start with +10% energy from kills and waves. Unlocks further income upgrades.",
    tradeoff: "Pays off over time; provides no immediate protection.",
    icon: "BatteryCharging",
    cost: 180,
    waves: 25,
    power: 0,
  },
  {
    id: "stasis",
    name: "Stasis field",
    kind: "module",
    role: "Control",
    description:
      "Slow enemies by 10% inside the inner ring. Unlocks stronger stasis upgrades.",
    tradeoff: "Inner-ring protection; sacrifices repair or extra income.",
    icon: "Snowflake",
    cost: 250,
    waves: 40,
    power: 0,
  },
  {
    id: "capacitor",
    name: "Pulse capacitor",
    kind: "module",
    role: "Active abilities",
    description:
      "Nova and Overdrive recharge 15% faster. Unlocks ability-cycling upgrades.",
    tradeoff:
      "Requires active ability use; replaces economy and repair support.",
    icon: "Zap",
    cost: 1800,
    waves: 400,
    power: 0,
  },
  {
    id: "thorns",
    name: "Retaliation grid",
    kind: "module",
    role: "Contact defense",
    description:
      "Return 30 armor-piercing damage plus 1% of the attacker's max hull, with the hull bonus capped at four times the base return. Unlocks stronger retaliation.",
    tradeoff: "Only fires after a hit. Does not prevent incoming damage.",
    icon: "Hexagon",
    cost: 3500,
    waves: 1000,
    power: 0,
  },
];
export const AUXILIARIES = ARMORY.filter((a) => a.kind === "weapon");
export const MODULES = ARMORY.filter((a) => a.kind === "module");
export const MILESTONES = [
  { wave: 5, credits: 20 },
  { wave: 10, credits: 35 },
  { wave: 15, credits: 55 },
  { wave: 20, credits: 85 },
  { wave: 25, credits: 120 },
];
export function loadoutPower(loadout: CoreLoadout) {
  return loadout.weapons.reduce(
    (sum, id) => sum + (ARMORY.find((a) => a.id === id)?.power ?? 99),
    0,
  );
}
export function loadoutError(
  value: unknown,
  unlocks?: readonly string[],
): string | null {
  if (!value || typeof value !== "object") return "Choose a loadout";
  const l = value as CoreLoadout;
  if (
    !Array.isArray(l.weapons) ||
    l.weapons.length > WEAPON_SLOTS ||
    new Set(l.weapons).size !== l.weapons.length ||
    l.weapons.some((id) => !AUXILIARIES.some((a) => a.id === id))
  )
    return "Choose up to two different auxiliary weapons";
  if (l.module !== null && !MODULES.some((a) => a.id === l.module))
    return "Unknown support module";
  if (loadoutPower(l) > POWER_BUDGET)
    return "Your weapons exceed the 4 power limit";
  if (
    unlocks &&
    [...l.weapons, ...(l.module ? [l.module] : [])].some(
      (id) => !unlocks.includes(id),
    )
  )
    return "Unlock this equipment in the armory first";
  return null;
}
const moduleUpgrades: Partial<Record<UpgradeId, ModuleId>> = {
  regen: "repair",
  income: "siphon",
  frost: "stasis",
  cooldown: "capacitor",
  thorns: "thorns",
};
export function upgradeAvailable(
  run: Pick<CoreRun, "loadout" | "balanceVersion">,
  id: UpgradeId,
) {
  if (
    (run.balanceVersion || 0) < 6 &&
    ["laser", "venom", "flak", "cooldown", "thorns"].includes(id)
  )
    return false;
  if (!run.loadout) return id !== "mortar"; // Archived runs keep their original arsenal.
  if (AUXILIARIES.some((a) => a.id === id))
    return run.loadout.weapons.includes(id as AuxiliaryId);
  const module = moduleUpgrades[id];
  return !module || run.loadout.module === module;
}
export function startingLevel(run: Pick<CoreRun, "loadout">, id: UpgradeId) {
  return run.loadout?.weapons.includes(id as AuxiliaryId) ? 1 : 0;
}
export function milestoneCredits(cleared: number, previousBest = 0) {
  return MILESTONES.filter(
    (m) => m.wave > previousBest && m.wave <= cleared,
  ).reduce((sum, m) => sum + m.credits, 0);
}

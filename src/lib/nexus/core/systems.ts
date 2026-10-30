import { RESEARCH, UPGRADES } from "./catalog";
import { upgradeAvailable } from "./progression";
import { combatRules } from "./rules";
export { BALANCE_VERSION } from "./rules";
import type {
  CombatMetrics,
  CoreRun,
  CoreScenario,
  ResearchId,
  UpgradeId,
  WeaponId,
} from "./types";

export const WEAPON_IDS: WeaponId[] = [
  "pulse",
  "arc",
  "rail",
  "orbit",
  "mortar",
  "nova",
  "laser",
  "venom",
  "flak",
  "thorns",
];
export const WEAPON_NAMES: Record<WeaponId, string> = {
  pulse: "Pulse cannon",
  arc: "Chain arc",
  rail: "Rail lance",
  orbit: "Orbital blades",
  nova: "Nova burst",
  mortar: "Siege mortar",
  laser: "Prism laser",
  venom: "Corrosive injector",
  flak: "Flak battery",
  thorns: "Retaliation grid",
};
export const SYSTEMS = {
  damage: 16,
  damageStep: 0.22,
  fireRate: 1.8,
  hasteStep: 0.16,
  range: 230,
  rangeStep: 20,
  critStep: 0.06,
  critMultiplier: 2.5,
  hull: 180,
  hullStep: 45,
  shield: 50,
  shieldStep: 30,
  regenStep: 1.1,
  armorStep: 0.06,
  shieldRegen: 4,
  shieldRegenStep: 0.6,
  shieldDelay: 3,
  incomeStep: 0.1,
  slowStep: 0.08,
  slowRadius: 165,
  orbitalRadius: 72,
  orbitalHitRadius: 28,
  orbitalInterval: 0.2,
  projectileSpeed: 640,
  novaRange: 350,
  novaDamage: 65,
  novaCooldown: 20,
  overdriveDuration: 6,
  overdriveCooldown: 30,
  overdriveMultiplier: 2,
};

export function emptyMetrics(energy = 0): CombatMetrics {
  const record = () =>
    Object.fromEntries(WEAPON_IDS.map((k) => [k, 0])) as Record<
      WeaponId,
      number
    >;
  return {
    damage: record(),
    kills: record(),
    shots: record(),
    energyEarned: energy,
    energySpent: 0,
    shieldAbsorbed: 0,
  };
}

const ARCHIVED_CAPS: Partial<Record<UpgradeId, number>> = {
  damage: 10,
  haste: 8,
  range: 6,
  multishot: 3,
  critical: 5,
  hull: 8,
  shield: 8,
  regen: 5,
  armor: 6,
  income: 6,
  orbit: 4,
  frost: 4,
  arc: 5,
  rail: 5,
  mortar: 5,
};
export function upgradeCap(id: UpgradeId, balanceVersion = 6) {
  return balanceVersion >= 6
    ? UPGRADES.find((u) => u.id === id)?.max || 0
    : ARCHIVED_CAPS[id] || 0;
}

export function stats(
  s: Pick<
    CoreRun,
    "upgrades" | "research" | "overdriveTime" | "loadout" | "balanceVersion"
  >,
  scenario: CoreScenario,
) {
  const rules = combatRules(s.balanceVersion);
  const u = (id: UpgradeId) =>
      upgradeAvailable(s, id)
        ? Math.min(upgradeCap(id, s.balanceVersion || 3), s.upgrades[id] || 0)
        : 0,
    r = s.research;
  const glass = scenario.rule === "glass",
    boost = s.overdriveTime > 0 ? SYSTEMS.overdriveMultiplier : 1;
  const power =
    (1 + u("damage") * SYSTEMS.damageStep) *
    (1 + (r.weapons || 0) * 0.08) *
    (glass ? 2 : 1);
  const reactor = 1 + (r.reactor || 0) * 0.05;
  return {
    damage: (s.loadout ? 11 : SYSTEMS.damage) * power,
    fireRate:
      SYSTEMS.fireRate * (1 + u("haste") * SYSTEMS.hasteStep) * reactor * boost,
    range: SYSTEMS.range + u("range") * SYSTEMS.rangeStep,
    targets: 1 + u("multishot"),
    critical: u("critical") * SYSTEMS.critStep,
    maxHp: glass
      ? 1
      : (SYSTEMS.hull + (r.plating || 0) * 20 + u("hull") * SYSTEMS.hullStep) *
        (s.loadout?.module === "repair" ? rules.repairHull : 1),
    maxShield: glass
      ? 0
      : SYSTEMS.shield +
        (r.barrier || 0) * 15 +
        u("shield") * SYSTEMS.shieldStep,
    regen:
      glass || scenario.rule === "blackout"
        ? 0
        : u("regen") * SYSTEMS.regenStep +
          (s.loadout?.module === "repair" ? rules.repairRegen : 0),
    shieldRegen:
      glass || scenario.rule === "blackout"
        ? 0
        : SYSTEMS.shieldRegen + u("shield") * SYSTEMS.shieldRegenStep,
    armor: glass ? 0 : Math.min(0.6, u("armor") * SYSTEMS.armorStep),
    income:
      1 +
      u("income") * SYSTEMS.incomeStep +
      (s.loadout?.module === "siphon" ? 0.1 : 0),
    orbit: u("orbit"),
    orbitDamage: rules.orbitDamage * power * boost,
    orbitHitRadius: rules.orbitHitRadius,
    slow: Math.min(
      0.65,
      u("frost") * rules.slowStep +
        (s.loadout?.module === "stasis" ? rules.stasis : 0),
    ),
    novaDamage:
      SYSTEMS.novaDamage * (1 + (r.nova || 0) * 0.15) * (1 + u("damage") * 0.1),
    arcDamage: u("arc")
      ? (s.loadout ? rules.arcDamage : 24) * power * (1 + (u("arc") - 1) * 0.3)
      : 0,
    arcTargets: u("arc") ? 2 + u("arc") : 0,
    arcJump: rules.arcJump,
    arcFalloff: rules.arcFalloff,
    arcInterval: rules.arcInterval / reactor / boost,
    railDamage: u("rail")
      ? (s.loadout ? rules.railDamage : 62) *
        power *
        (1 + (u("rail") - 1) * 0.35)
      : 0,
    railInterval:
      Math.max(2.5, rules.railInterval - (u("rail") - 1) * 0.3) /
      reactor /
      boost,
    mortarDamage: u("mortar")
      ? rules.mortarDamage * power * (1 + (u("mortar") - 1) * 0.32)
      : 0,
    mortarRadius:
      rules.mortarRadius +
      Math.max(0, u("mortar") - 1) * rules.mortarRadiusStep,
    mortarInterval: rules.mortarInterval / reactor / boost,
    laserDamage: u("laser")
      ? 22 * power * (1 + (u("laser") - 1) * 0.26) * boost
      : 0,
    venomDps: u("venom") ? 18 * power * (1 + (u("venom") - 1) * 0.3) : 0,
    venomTargets: u("venom") ? 1 + Math.floor((u("venom") - 1) / 3) : 0,
    venomInterval: 1.8 / reactor / boost,
    flakDamage: u("flak") ? 22 * power * (1 + (u("flak") - 1) * 0.3) : 0,
    flakRadius: 48 + Math.max(0, u("flak") - 1) * 3,
    flakRange: Math.min(200, SYSTEMS.range + u("range") * SYSTEMS.rangeStep),
    flakInterval: 1.1 / reactor / boost,
    thornsDamage:
      s.loadout?.module === "thorns" ? 30 * power * (1 + u("thorns") * 0.3) : 0,
    novaCooldown:
      SYSTEMS.novaCooldown *
      (s.loadout?.module === "capacitor"
        ? 0.85 * (1 - u("cooldown") * 0.04)
        : 1),
    overdriveCooldown:
      SYSTEMS.overdriveCooldown *
      (s.loadout?.module === "capacitor"
        ? 0.85 * (1 - u("cooldown") * 0.04)
        : 1),
  };
}

export function upgradeCost(id: UpgradeId, level: number) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def || !Number.isInteger(level) || level < 0) return Infinity;
  return Math.round(def.cost * (def.growth || 1.4) ** level);
}
export function researchCost(id: ResearchId, level: number) {
  const def = RESEARCH.find((r) => r.id === id);
  return def && Number.isInteger(level) && level >= 0
    ? Math.round(
        def.cost *
          1.35 ** Math.min(level, 10) *
          1.16 ** Math.max(0, level - 10),
      )
    : Infinity;
}

export function upgradePreview(
  s: CoreRun,
  scenario: CoreScenario,
  id: UpgradeId,
) {
  const a = stats(s, scenario),
    b = stats(
      { ...s, upgrades: { ...s.upgrades, [id]: (s.upgrades[id] || 0) + 1 } },
      scenario,
    );
  const n = (x: number) => Number(x.toFixed(1)).toString(),
    pair = (x: number, y: number, suffix = "") => `${n(x)} → ${n(y)}${suffix}`;
  switch (id) {
    case "damage":
      return pair(a.damage, b.damage, " pulse damage · all weapons scale");
    case "haste":
      return pair(a.fireRate, b.fireRate, " pulse shots/s");
    case "range":
      return pair(a.range, b.range, " detection radius");
    case "multishot":
      return pair(a.targets, b.targets, " pulse targets");
    case "critical":
      return pair(a.critical * 100, b.critical * 100, "% · 2.5× pulse hits");
    case "hull":
      return pair(
        a.maxHp,
        b.maxHp,
        ` max hull · +${n(b.maxHp - a.maxHp)} restored`,
      );
    case "shield":
      return pair(a.maxShield, b.maxShield, " max barrier · +30 restored");
    case "regen":
      return pair(a.regen, b.regen, " hull repaired/s");
    case "armor":
      return pair(a.armor * 100, b.armor * 100, "% damage reduction");
    case "income":
      return pair(a.income, b.income, "× energy earned");
    case "orbit":
      return pair(
        a.orbit,
        b.orbit,
        ` blades · ${n(b.orbitDamage)} damage/contact`,
      );
    case "frost":
      return pair(a.slow * 100, b.slow * 100, "% slow within 165");
    case "arc":
      return `${n(b.arcDamage)} damage · ${b.arcTargets} targets · ${n(b.arcInterval)}s recharge`;
    case "rail":
      return `${n(b.railDamage)} piercing damage · ${n(b.railInterval)}s recharge`;
    case "laser":
      return `${n(b.laserDamage)}–${n(b.laserDamage * 3)} beam damage/s · heat builds over 3s`;
    case "venom":
      return `${n(b.venomDps)} armor-piercing damage/s · ${b.venomTargets} targets · 4s duration`;
    case "flak":
      return `${n(b.flakDamage)} burst damage · ${b.flakRadius} splash · ${n(b.flakInterval)}s cycle`;
    case "cooldown":
      return pair(a.novaCooldown, b.novaCooldown, "s Nova recharge");
    case "thorns":
      return pair(a.thornsDamage, b.thornsDamage, " base return · +capped 1% attacker hull");
    case "mortar":
      return `${n(b.mortarDamage)} splash damage · ${b.mortarRadius} blast radius · ${n(b.mortarInterval)}s cycle`;
  }
}

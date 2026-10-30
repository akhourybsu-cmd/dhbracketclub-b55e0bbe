import { ENEMIES, RESEARCH, UPGRADES, getScenario } from "./catalog";
import type { CoreRun } from "./types";
import {
  BALANCE_VERSION,
  WEAPON_IDS,
  emptyMetrics,
  stats,
  upgradeCap,
} from "./systems";
import { loadoutError, startingLevel, upgradeAvailable } from "./progression";

const key = (userId: string, clubId: string) =>
  `nexus_core_run_v2:${userId}:${clubId}`;
export function clearCoreRun(userId?: string, clubId?: string) {
  if (userId && clubId)
    try {
      localStorage.removeItem(key(userId, clubId));
    } catch {
      /* storage unavailable */
    }
}
export function readCoreRun(userId?: string, clubId?: string): CoreRun | null {
  if (!userId || !clubId) return null;
  try {
    const s = JSON.parse(localStorage.getItem(key(userId, clubId)) || "null");
    if (
      !s ||
      s.version !== 2 ||
      (s.balanceVersion !== undefined &&
        (!Number.isInteger(s.balanceVersion) ||
          s.balanceVersion < 1 ||
          s.balanceVersion > BALANCE_VERSION)) ||
      !getScenario(s.scenarioId) ||
      (s.balanceVersion >= 6 &&
        (!Number.isInteger(s.difficulty) ||
          s.difficulty < 1 ||
          s.difficulty > 6)) ||
      ((s.balanceVersion || 0) < 6 &&
        s.difficulty !== undefined &&
        s.difficulty !== 1) ||
      ((s.balanceVersion || 0) < 6 &&
        s.loadout &&
        [...(s.loadout.weapons || []), s.loadout.module].some((id) =>
          ["laser", "venom", "flak", "capacitor", "thorns"].includes(id),
        )) ||
      typeof s.id !== "string" ||
      !["ready", "wave", "intermission", "victory", "defeat"].includes(
        s.phase,
      ) ||
      ![
        "hp",
        "shield",
        "energy",
        "nextId",
        "time",
        "wave",
        "cleared",
        "waveTime",
        "spawnCd",
        "breakTime",
        "kills",
        "score",
        "damageTaken",
        "fireCd",
        "novaCd",
        "overdriveCd",
        "overdriveTime",
        "orbitalCd",
        "seed",
      ].every((k) => Number.isFinite(s[k])) ||
      !Array.isArray(s.enemies) ||
      !Array.isArray(s.toSpawn) ||
      !Array.isArray(s.projectiles) ||
      !Array.isArray(s.effects) ||
      !s.upgrades ||
      !s.research ||
      (s.balanceVersion >= 4 &&
        (s.scenarioId !== "endless" || !!loadoutError(s.loadout))) ||
      !["nearest", "strongest", "fastest"].includes(s.targeting) ||
      !Object.entries(s.research).every(
        ([k, v]) =>
          RESEARCH.some((r) => r.id === k) &&
          Number.isInteger(v) &&
          Number(v) >= 0 &&
          Number(v) <= ((s.balanceVersion || 0) >= 6 ? 30 : 10),
      ) ||
      !Object.entries(s.upgrades).every(([k, v]) => {
        const def = UPGRADES.find((u) => u.id === k);
        return (
          !!def &&
          Number.isInteger(v) &&
          Number(v) >= 0 &&
          Number(v) <= upgradeCap(def.id, s.balanceVersion || 3)
        );
      }) ||
      ![
        "arcCd",
        "railCd",
        "mortarCd",
        "laserCd",
        "laserTarget",
        "laserHeat",
        "venomCd",
        "flakCd",
        "shieldDelay",
        "energyRemainder",
      ].every((k) => s[k] === undefined || Number.isFinite(s[k])) ||
      (s.metrics &&
        !(
          ["energyEarned", "energySpent", "shieldAbsorbed"].every(
            (k) => Number.isFinite(s.metrics[k]) && s.metrics[k] >= 0,
          ) &&
          ["damage", "kills", "shots"].every(
            (k) =>
              s.metrics[k] &&
              WEAPON_IDS.every(
                (id) =>
                  (((id === "mortar" && (s.balanceVersion || 0) < 4) ||
                    (["laser", "venom", "flak", "thorns"].includes(id) &&
                      (s.balanceVersion || 0) < 6)) &&
                    s.metrics[k][id] === undefined) ||
                  (Number.isFinite(s.metrics[k][id]) && s.metrics[k][id] >= 0),
              ),
          )
        )) ||
      (s.shells !== undefined &&
        (!Array.isArray(s.shells) ||
          !s.shells.every(
            (p) =>
              p &&
              ["id", "x", "y", "delay", "damage", "radius"].every((k) =>
                Number.isFinite(p[k]),
              ),
          ))) ||
      !s.toSpawn.every((k) =>
        Object.prototype.hasOwnProperty.call(ENEMIES, k),
      ) ||
      !s.enemies.every(
        (e) =>
          e &&
          Object.prototype.hasOwnProperty.call(ENEMIES, e.kind) &&
          [
            "id",
            "x",
            "y",
            "hp",
            "maxHp",
            "speed",
            "damage",
            "radius",
            "bounty",
            "attackCd",
            "slowed",
          ].every((k) => Number.isFinite(e[k])) &&
          ["venomTime", "venomDps"].every(
            (k) => e[k] === undefined || (Number.isFinite(e[k]) && e[k] >= 0),
          ) &&
          (e.venomTime === undefined || e.venomTime <= 4),
      ) ||
      !s.projectiles.every(
        (p) =>
          p &&
          ["id", "x", "y", "target", "damage"].every((k) =>
            Number.isFinite(p[k]),
          ),
      ) ||
      !s.effects.every(
        (e) =>
          e &&
          ["id", "x", "y", "life", "maxLife"].every((k) =>
            Number.isFinite(e[k]),
          ),
      )
    )
      return null;
    const migrated = {
      ...s,
      arcCd: s.arcCd ?? 0,
      railCd: s.railCd ?? 0,
      mortarCd: s.mortarCd ?? 0,
      laserCd: s.laserCd ?? 0,
      laserHeat: s.laserHeat ?? 0,
      venomCd: s.venomCd ?? 0,
      flakCd: s.flakCd ?? 0,
      shells: s.shells ?? [],
      shieldDelay: s.shieldDelay ?? 0,
      energyRemainder: s.energyRemainder ?? 0,
      metrics: s.metrics ?? emptyMetrics(s.energy),
    } as CoreRun;
    if (
      migrated.balanceVersion! >= 4 &&
      UPGRADES.some(
        (u) =>
          (!upgradeAvailable(migrated, u.id) &&
            (migrated.upgrades[u.id] || 0) > 0) ||
          (migrated.upgrades[u.id] || 0) < startingLevel(migrated, u.id),
      )
    )
      return null;
    for (const field of ["damage", "kills", "shots"] as const)
      migrated.metrics![field] = {
        ...emptyMetrics()[field],
        ...migrated.metrics![field],
      };
    const max = stats(migrated, getScenario(s.scenarioId)!);
    migrated.hp = Math.min(migrated.hp, max.maxHp);
    migrated.shield = Math.min(migrated.shield, max.maxShield);
    return migrated;
  } catch {
    return null;
  }
}
export function saveCoreRun(
  run: CoreRun,
  userId?: string,
  clubId?: string,
): boolean {
  if (!userId || !clubId) return false;
  try {
    localStorage.setItem(key(userId, clubId), JSON.stringify(run));
    return true;
  } catch {
    return false;
  }
}

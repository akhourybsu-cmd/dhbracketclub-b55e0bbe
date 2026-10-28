import { ENEMIES, getScenario } from "./catalog";
import type { CoreRun } from "./types";

const key = (userId: string, clubId: string) =>
  `nexus_core_run_v2:${userId}:${clubId}`;
export function readCoreRun(userId?: string, clubId?: string): CoreRun | null {
  if (!userId || !clubId) return null;
  try {
    const s = JSON.parse(localStorage.getItem(key(userId, clubId)) || "null");
    if (
      !s ||
      s.version !== 2 ||
      !getScenario(s.scenarioId) ||
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
      !["nearest", "strongest", "fastest"].includes(s.targeting) ||
      !Object.values(s.research).every(
        (v) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 10,
      ) ||
      !Object.values(s.upgrades).every(
        (v) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 10,
      ) ||
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
          ].every((k) => Number.isFinite(e[k])),
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
    return s;
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

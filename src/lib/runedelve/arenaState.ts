import { applyChain, MAX_HP, MAX_MANA, type CombatState } from "./combatEngine";
import { advanceResonance } from "./resonance";
import { ENDLESS_TIME_LIMIT_SEC, endlessScore } from "./endlessMode";
import { RUNE_TYPES, type Enemy, type RuneType } from "./dungeonGenerator";
import type { HeroClass } from "./classConfig";

export const ARENA_MAX_GUARD = 12;
export const ARENA_SAVE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface ArenaRun {
  version: 1;
  requestId: string;
  cls: HeroClass;
  seed: number;
  tick: number;
  grid: RuneType[][];
  combat: CombatState;
  elapsed: number;
  attackAt: number;
  spawnAt: number | null;
  paused: boolean;
  savedAt: number;
  result: null | {
    reason: "timeout" | "defeated";
    kills: number;
    score: number;
  };
}

/** An active arena belongs to the account. Midnight must not discard a live board. */
export function arenaStorageKey(userId: string): string {
  return `rd-arena-v1:${userId}`;
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const integer = (value: unknown, min: number, max: number): value is number =>
  number(value, min, max) && Number.isInteger(value);
const rune = (value: unknown): value is RuneType =>
  RUNE_TYPES.includes(value as RuneType);

function validEnemy(value: unknown): value is Enemy {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !value.id.length ||
    typeof value.name !== "string" ||
    typeof value.emoji !== "string"
  )
    return false;
  if (
    !number(value.maxHp, 1, 100_000) ||
    !number(value.hp, 0, value.maxHp) ||
    !number(value.damage, 0, 10_000)
  )
    return false;
  for (const key of [
    "intent",
    "intentMax",
    "abilityCooldown",
    "abilityCooldownMax",
    "armor",
    "phaseLockTurns",
    "phaseLockNextAt",
  ]) {
    if (value[key] !== undefined && !number(value[key], 0, 100_000))
      return false;
  }
  for (const key of [
    "archetypeId",
    "family",
    "role",
    "ability",
    "telegraphLabel",
  ]) {
    if (value[key] !== undefined && typeof value[key] !== "string")
      return false;
  }
  return (
    value.tier === undefined || value.tier === "mini" || value.tier === "boss"
  );
}

function validCombat(value: unknown): value is CombatState {
  if (!object(value) || value.maxHp !== MAX_HP || !number(value.hp, 0, MAX_HP))
    return false;
  if (
    !integer(value.mana, 0, MAX_MANA) ||
    !integer(value.shieldTurns, 0, ARENA_MAX_GUARD) ||
    !integer(value.turnsRemaining, 0, 10_000)
  )
    return false;
  if (
    !integer(value.enemiesDefeated, 0, 10_000) ||
    !number(value.totalDamage, 0, 10_000_000) ||
    !integer(value.longestChain, 0, 25)
  )
    return false;
  if (
    typeof value.shadowstepActive !== "boolean" ||
    typeof value.abilityUsed !== "boolean" ||
    typeof value.rogueBonusTriggered !== "boolean"
  )
    return false;
  if (
    !Array.isArray(value.enemies) ||
    value.enemies.length < 1 ||
    value.enemies.length > 3 ||
    !value.enemies.every(validEnemy)
  )
    return false;
  if (
    new Set(value.enemies.map((enemy) => enemy.id)).size !==
    value.enemies.length
  )
    return false;
  if (value.resonance !== undefined) {
    const ring = value.resonance;
    if (
      !object(ring) ||
      !Array.isArray(ring.colors) ||
      ring.colors.length > 3 ||
      !ring.colors.every(rune)
    )
      return false;
    if (
      new Set(ring.colors).size !== ring.colors.length ||
      !integer(ring.bursts, 0, 10_000)
    )
      return false;
  }
  return true;
}

/** Reject a damaged checkpoint before the board or combat components render it. Restores always pause. */
export function parseArenaRun(
  raw: string | null,
  now = Date.now(),
): ArenaRun | null {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (
      !object(value) ||
      value.version !== 1 ||
      !["warrior", "mage", "rogue", "cleric"].includes(value.cls as string)
    )
      return null;
    if (
      typeof value.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.requestId,
      )
    )
      return null;
    if (
      !integer(value.seed, 0, 0xffffffff) ||
      !integer(value.tick, 0, 100_000) ||
      typeof value.paused !== "boolean"
    )
      return null;
    if (
      !number(value.elapsed, 0, ENDLESS_TIME_LIMIT_SEC) ||
      !number(value.attackAt, 0, ENDLESS_TIME_LIMIT_SEC + 5)
    )
      return null;
    if (
      value.spawnAt !== null &&
      !number(value.spawnAt, 0, ENDLESS_TIME_LIMIT_SEC + 1)
    )
      return null;
    if (
      !Array.isArray(value.grid) ||
      value.grid.length !== 5 ||
      !value.grid.every(
        (row) => Array.isArray(row) && row.length === 5 && row.every(rune),
      )
    )
      return null;
    if (!validCombat(value.combat)) return null;
    if (
      !number(now, 0, Number.MAX_SAFE_INTEGER) ||
      !number(
        value.savedAt,
        Math.max(0, now - ARENA_SAVE_MAX_AGE_MS),
        now + 60_000,
      )
    )
      return null;
    if (value.result !== null) {
      const result = value.result;
      if (
        !object(result) ||
        !["timeout", "defeated"].includes(result.reason as string)
      )
        return null;
      if (
        result.kills !== value.combat.enemiesDefeated ||
        result.score !==
          endlessScore(value.combat.enemiesDefeated, value.combat.totalDamage)
      )
        return null;
      if (result.reason === "timeout" && value.elapsed < ENDLESS_TIME_LIMIT_SEC)
        return null;
      if (result.reason === "defeated" && value.combat.hp > 0) return null;
    } else if (value.elapsed >= ENDLESS_TIME_LIMIT_SEC || value.combat.hp <= 0)
      return null;
    return { ...value, paused: true } as unknown as ArenaRun;
  } catch {
    return null;
  }
}

/** Exact player-phase effects; the same next state can commit the chain before the real-time attack clock. */
export function previewArenaChain(
  run: Pick<ArenaRun, "combat" | "cls">,
  type: RuneType,
  length: number,
) {
  const applied = applyChain(run.combat, type, length, run.cls);
  const resonance = advanceResonance(applied.next, type);
  const next = {
    ...resonance.next,
    shieldTurns: Math.min(ARENA_MAX_GUARD, resonance.next.shieldTurns),
  };
  const damage = next.totalDamage - run.combat.totalDamage;
  const healing = next.hp - run.combat.hp;
  const mana = next.mana - run.combat.mana;
  const guard = next.shieldTurns - run.combat.shieldTurns;
  const pieces: string[] = [];
  if (damage > 0 || type === "red") pieces.push(`${damage} dmg`);
  if (healing > 0 || type === "green")
    pieces.push(healing > 0 ? `+${healing} HP` : "HP full");
  if (mana > 0 || type === "blue")
    pieces.push(mana > 0 ? `+${mana} mana` : "Mana full");
  if (guard > 0 || type === "gold")
    pieces.push(guard > 0 ? `+${guard} guard` : "Guard full");
  return {
    next,
    damage,
    healing,
    mana,
    guard,
    burst: !!resonance.burst,
    text: pieces.join(" · "),
  };
}

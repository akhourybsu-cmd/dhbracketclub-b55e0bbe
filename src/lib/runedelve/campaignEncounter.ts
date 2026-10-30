import type { Enemy } from "./dungeonGenerator";
import { ENEMY_ROSTER } from "./enemyRoster";
import { applyInitialIntents } from "./telegraph";

export type StoredCampaignEnemy = Omit<Enemy, "id" | "maxHp"> &
  Partial<Pick<Enemy, "id" | "maxHp">>;

/** Opening foes and reinforcements obey the same path and equipment rules. */
export function prepareCampaignEnemies(
  stored: StoredCampaignEnemy[],
  options: {
    idPrefix: string;
    seed: number;
    level: number;
    telegraphed: boolean;
    foresightTurns: number;
    hpMultiplier: number;
  },
): Enemy[] {
  let enemies = stored.map((enemy, index): Enemy => {
    const rawName = String(enemy.name ?? "")
      .replace(/^(Elite |Boss |Mini-Boss |Echo of )/, "")
      .trim()
      .toLowerCase();
    const archetypeId =
      enemy.archetypeId ??
      ENEMY_ROSTER.find((entry) => entry.name.toLowerCase() === rawName)?.id ??
      (rawName === "slime"
        ? "ember_slime"
        : rawName === "skeleton"
          ? "skeleton_warrior"
          : undefined);
    return {
      ...enemy,
      id: enemy.id ?? `${options.idPrefix}${index}`,
      archetypeId,
      hp: Math.max(1, Math.round(enemy.hp * options.hpMultiplier)),
      maxHp: Math.max(
        1,
        Math.round((enemy.maxHp ?? enemy.hp) * options.hpMultiplier),
      ),
      abilityCooldownMax: enemy.abilityCooldownMax ?? enemy.abilityCooldown,
    };
  });
  if (options.telegraphed) {
    enemies = applyInitialIntents(enemies, options.seed, options.level);
    if (options.foresightTurns > 0) {
      enemies = enemies.map((enemy) =>
        enemy.intent == null
          ? enemy
          : {
              ...enemy,
              intent: enemy.intent + options.foresightTurns,
              intentMax:
                (enemy.intentMax ?? enemy.intent) + options.foresightTurns,
            },
      );
    }
  }
  return enemies;
}

/** Wave recovery grants extend the budget without erasing turns already used. */
export function campaignTurnBudget(
  openingTurns: number,
  fallbackTurns: number,
  waves: Array<{ reinforcement_turns: number }> | null,
  wavesSpawned: number,
): number {
  return (
    (openingTurns > 0 ? openingTurns : fallbackTurns) +
    (waves ?? [])
      .slice(0, wavesSpawned)
      .reduce((sum, wave) => sum + (wave.reinforcement_turns ?? 2), 0)
  );
}

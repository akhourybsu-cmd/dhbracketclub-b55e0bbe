// ─────────────────────────────────────────────────────────────────────────────
// Enemy abilities — pure resolvers + per-ability combat-log voice.
//
// Each ability is referenced by id from `enemyRoster.ts`. The combat engine
// calls `tickAbility()` during the enemy phase: when an enemy's ability
// cooldown hits 0 we run the resolver, which returns a list of `AbilityEffect`
// patches AND a list of CombatLog entries. The PlayPage applies the patches
// to its non-enemy state (corruption / seals / new minions) and pushes the
// log entries.
//
// Design rules (mobile-first):
// • One ability per enemy.
// • One ability fires at a time per enemy.
// • Telegraphed when the cooldown hits 1 (handled in EnemyDisplay).
// • Combat-log text always names the actor + the move + the target/result.
// • Pure functions — no React, no DB, no globals.
// ─────────────────────────────────────────────────────────────────────────────

import type { Enemy } from './dungeonGenerator';
import type { CombatLogEntry } from '@/components/runedelve/CombatLog';
import { MINION_BONE_HUSK } from './enemyRoster';

export type EnemyAbilityId =
  | 'heavy_strike'
  | 'shield_self'
  | 'heal_ally'
  | 'summon_minion'
  | 'corrupt_tile'
  | 'seal_tile';

/** Side-effects the PlayPage must apply on top of enemy mutations. */
export type AbilityEffect =
  | { kind: 'corrupt_tile' }            // request 1 corrupted cell on the board
  | { kind: 'seal_tile' }               // request 1 sealed cell on the board
  | { kind: 'spawn_minion'; enemy: Enemy } // append a new enemy
  | { kind: 'damage_hero'; amount: number }; // direct hero damage (heavy strike)

export interface AbilityResolution {
  /** Mutated enemy list (cooldowns reset, armor applied, hp restored, etc). */
  enemies: Enemy[];
  /** Side-effects for the PlayPage layer. */
  effects: AbilityEffect[];
  /** One log entry per ability that actually fired this turn. */
  logs: Array<Omit<CombatLogEntry, 'id'>>;
}

const HEAVY_STRIKE_BONUS = 14; // flat extra damage on the heavy
const SHIELD_ARMOR = 4;        // damage reduction granted by shield_self
const SHIELD_DURATION = 2;     // turns of armor (we just store the value; decay below)
const HEAL_AMOUNT = 16;        // hp restored to wounded ally
const MINION_CAP_PER_FIGHT = 1; // one new target is enough tactical pressure

/**
 * Run one tick of the ability system over the live enemy list. Mutations are
 * returned, never applied in place — keeps the engine pure and testable.
 *
 * Order:
 *   1) decrement every ability cooldown by 1 (clamped at 0)
 *   2) for each enemy whose cooldown hit 0 AND who is alive, fire the ability
 *   3) reset that enemy's cooldown
 *   4) decay any active armor by 1 (so shield_self lasts ~2 enemy turns)
 */
export function tickEnemyAbilities(enemies: Enemy[], summonsSoFar = 0): AbilityResolution {
  const effects: AbilityEffect[] = [];
  const logs: Array<Omit<CombatLogEntry, 'id'>> = [];
  let summons = summonsSoFar;
  // Patch table: ability id → patch fn applied during the final pass. Used by
  // heal_ally so heals actually land on the returned object (the prior
  // implementation mutated an intermediate copy that was overwritten by the
  // outer .map).
  const healPatch = new Map<string, number>(); // enemy.id → new hp

  // Step 1 — tick cooldowns.
  let next = enemies.map(e => {
    if (e.hp <= 0 || !e.ability || e.abilityCooldown == null) return e;
    return { ...e, abilityCooldown: Math.max(0, e.abilityCooldown - 1) };
  });

  // Step 2 — fire abilities whose cooldown is now 0.
  next = next.map(e => {
    if (e.hp <= 0 || !e.ability) return e;
    if (e.abilityCooldown !== 0) return e;
    const reset = e.abilityCooldownMax ?? 4;

    switch (e.ability) {
      case 'heavy_strike': {
        const dmg = HEAVY_STRIKE_BONUS + Math.round(e.damage * 0.5);
        effects.push({ kind: 'damage_hero', amount: dmg });
        logs.push({
          kind: 'heavy',
          text: `${e.name} unleashed a charged blast`,
          amount: dmg,
        });
        return { ...e, abilityCooldown: reset };
      }

      case 'shield_self': {
        logs.push({
          kind: 'shield',
          text: `${e.name} hardened its wards (+${SHIELD_ARMOR} armor)`,
          amount: SHIELD_ARMOR,
        });
        return { ...e, abilityCooldown: reset, armor: (e.armor ?? 0) + SHIELD_ARMOR };
      }

      case 'heal_ally': {
        // Find the most-wounded LIVING ally (prefer not self if anyone else is hurt).
        // Account for any heals already queued this tick so two chanters don't
        // both target the same ally and overheal.
        const candidates = next
          .filter(o => o.hp > 0 && o.hp < o.maxHp && o.id !== e.id)
          .map(o => ({ enemy: o, hp: healPatch.get(o.id) ?? o.hp }))
          .filter(c => c.hp < c.enemy.maxHp)
          .sort((a, b) => (a.hp / a.enemy.maxHp) - (b.hp / b.enemy.maxHp));
        const targetCand = candidates[0];
        if (!targetCand) {
          // No wounded ally — silent skip but still reset CD so we try again later.
          return { ...e, abilityCooldown: reset };
        }
        const target = targetCand.enemy;
        const currentHp = targetCand.hp;
        const heal = Math.min(HEAL_AMOUNT, target.maxHp - currentHp);
        // Queue the patch — applied to the post-map enemy object below so the
        // mutation actually survives the .map's object replacement.
        healPatch.set(target.id, currentHp + heal);
        logs.push({
          kind: 'heal',
          text: `${e.name} mended ${target.name}`,
          amount: heal,
        });
        return { ...e, abilityCooldown: reset };
      }

      case 'summon_minion': {
        if (summons >= MINION_CAP_PER_FIGHT) {
          // Cap reached — skip but reset CD so the log doesn't get spammy.
          return { ...e, abilityCooldown: reset };
        }
        summons++;
        const minionId = `${e.id}-minion-${summons}`;
        const minion: Enemy = {
          id: minionId,
          archetypeId: MINION_BONE_HUSK.id,
          name: MINION_BONE_HUSK.name,
          emoji: MINION_BONE_HUSK.emoji,
          hp: MINION_BONE_HUSK.baseHp,
          maxHp: MINION_BONE_HUSK.baseHp,
          damage: MINION_BONE_HUSK.baseDamage,
          family: MINION_BONE_HUSK.family,
          role: MINION_BONE_HUSK.role,
        };
        effects.push({ kind: 'spawn_minion', enemy: minion });
        logs.push({
          kind: 'ability',
          text: `${e.name} summoned a ${MINION_BONE_HUSK.name}`,
        });
        return { ...e, abilityCooldown: reset };
      }

      case 'corrupt_tile': {
        effects.push({ kind: 'corrupt_tile' });
        logs.push({
          kind: 'corruption',
          text: `${e.name} corrupted a rune`,
        });
        return { ...e, abilityCooldown: reset };
      }

      case 'seal_tile': {
        effects.push({ kind: 'seal_tile' });
        logs.push({
          kind: 'info',
          text: `${e.name} sealed a rune`,
        });
        return { ...e, abilityCooldown: reset };
      }

      default:
        return { ...e, abilityCooldown: reset };
    }
  });

  // Step 3.5 — apply queued heal patches BEFORE armor decay so the new HP
  // value lands on the returned enemy reference.
  if (healPatch.size > 0) {
    next = next.map(e => {
      const newHp = healPatch.get(e.id);
      if (newHp == null) return e;
      return { ...e, hp: Math.min(e.maxHp, newHp) };
    });
  }

  // Step 4 — decay armor (shield_self's effect has a soft duration).
  // We decay by 1 each tick so a single shield_self lasts ~SHIELD_DURATION turns
  // before fading. Multiple casts stack additively but still drain over time.
  next = next.map(e => {
    if (!e.armor || e.hp <= 0) return e;
    const decayed = Math.max(0, e.armor - Math.ceil(SHIELD_ARMOR / SHIELD_DURATION));
    if (decayed === e.armor) return e;
    return { ...e, armor: decayed === 0 ? undefined : decayed };
  });

  return { enemies: next, effects, logs };
}

/**
 * Apply per-enemy armor to a damage amount before subtracting from HP.
 * Used by the player chain resolver (combatEngine) so armored enemies feel
 * tanky without changing the existing applyChain math.
 */
export function applyArmorToDamage(target: Enemy, damage: number): number {
  if (!target.armor || target.armor <= 0) return damage;
  return Math.max(1, damage - target.armor);
}

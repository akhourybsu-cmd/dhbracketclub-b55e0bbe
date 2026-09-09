import type { Enemy } from './dungeonGenerator';
import type { HeroClass } from './classConfig';
import type { RuneType } from './dungeonGenerator';
import { resolveEnemyAttack, tickIntents, HEAVY_DAMAGE_MULT } from './telegraph';
import {
  applyBossTurnEffects,
  applyPhaseLockOnDamage,
  enemyDamageMultiplier,
  filterTargetable,
  type BossRuleId,
} from './bossRules';
import { tickEnemyAbilities, applyArmorToDamage, type AbilityEffect } from './enemyAbilities';
import type { CombatLogEntry } from '@/components/runedelve/CombatLog';
import type { MasteryId } from './classMastery';
import {
  getMasteryCleaveDamage,
  getMasterySanctuaryHeal,
  getMasteryArcChainFraction,
  shadowstepClearsCooldown,
} from './masteryEffects';

export interface CombatState {
  hp: number;
  maxHp: number;
  mana: number; // 0..3
  shieldTurns: number;
  shadowstepActive: boolean;
  enemies: Enemy[];
  turnsRemaining: number;
  totalDamage: number;
  enemiesDefeated: number;
  longestChain: number;
  abilityUsed: boolean;
  rogueBonusTriggered: boolean;
}

export interface ChainResolution {
  type: RuneType;
  length: number;
  damageDealt: number;
  manaGained: number;
  hpHealed: number;
  guardGained: number;
  enemyKills: string[];
}

export const MAX_HP = 100;
export const MAX_MANA = 3;

/** Shared campaign-depth scalar for rune and ability power. */
export function campaignPowerMultiplier(level = 1): number {
  if (level <= 25) return 1;
  if (level <= 50) return 1 + (level - 25) * 0.008;
  if (level <= 100) return 1.20 + (level - 50) * 0.008;
  return 1.60 + (level - 100) * 0.010;
}

/** Base red-chain damage shared by combat and the board's live preview. */
export function redChainDamage(length: number, cls: HeroClass, level = 1): number {
  const classMultiplier: Record<HeroClass, number> = {
    warrior: 1.30,
    mage: 1.20,
    rogue: 1.40,
    cleric: 1.45,
  };
  const depthMultiplier = campaignPowerMultiplier(level);
  // Rogue's score-only passive left it roughly 20–30 clear-rate points behind
  // the other classes because most campaign goals care about combat, not the
  // final leaderboard total. Long red chains now deliver the same +15% payoff
  // in combat and scoring, reinforcing one clear class identity.
  const rogueLongChain = cls === 'rogue' && length >= 5 ? 1.15 : 1;
  return Math.round(length * 8 * classMultiplier[cls] * depthMultiplier * rogueLongChain);
}

export function initialCombat(enemies: Enemy[], turns: number, opts?: { bonusMaxHp?: number }): CombatState {
  const bonus = Math.max(0, opts?.bonusMaxHp ?? 0);
  const maxHp = MAX_HP + bonus;
  return {
    hp: maxHp,
    maxHp,
    mana: 0,
    shieldTurns: 0,
    shadowstepActive: false,
    enemies: enemies.map(e => ({ ...e })),
    turnsRemaining: turns,
    totalDamage: 0,
    enemiesDefeated: 0,
    longestChain: 0,
    abilityUsed: false,
    rogueBonusTriggered: false,
  };
}

// Apply chain — return new state + resolution summary.
// `rogueBonusThreshold` lets relics (Momentum) lower the chain length needed
// to trigger the rogue's score-bonus stamp. Defaults to 5.
export function applyChain(
  state: CombatState,
  type: RuneType,
  length: number,
  cls: HeroClass,
  bossRule: BossRuleId | null = null,
  rogueBonusThreshold = 5,
  level = 1,
): { next: CombatState; resolution: ChainResolution } {
  const next: CombatState = { ...state, enemies: state.enemies.map(e => ({ ...e })) };
  const resolution: ChainResolution = {
    type, length,
    damageDealt: 0, manaGained: 0, hpHealed: 0, guardGained: 0,
    enemyKills: [],
  };
  next.longestChain = Math.max(next.longestChain, length);

  if (type === 'red') {
    let dmg = redChainDamage(length, cls, level);
    if (next.shadowstepActive) {
      dmg = Math.round(dmg * 2);
      next.shadowstepActive = false;
    }
    // Damage first TARGETABLE enemy. Boss rules can hide the final foe.
    const targets = filterTargetable(bossRule, next.enemies);
    const target = targets[0];
    if (target) {
      const live = next.enemies.find(e => e.id === target.id)!;
      // Enemy armor (from shield_self ability) softens the hit before HP loss.
      const afterArmor = applyArmorToDamage(live, dmg);
      const applied = Math.min(afterArmor, live.hp);
      live.hp -= applied;
      resolution.damageDealt = applied;
      next.totalDamage += applied;
      if (live.hp <= 0) {
        next.enemiesDefeated += 1;
        resolution.enemyKills.push(live.id);
      }
    }
    // Phase Lock — kick in a 1-turn immunity each time a fresh 25% slice falls.
    next.enemies = applyPhaseLockOnDamage(bossRule, next.enemies);
  } else if (type === 'blue') {
    let mana = 1;
    if (cls === 'mage') mana = 2;
    if (length >= 5) mana += 1;
    const manaBefore = next.mana;
    next.mana = Math.min(MAX_MANA, next.mana + mana);
    // Report what entered the pool, not theoretical power lost to the cap.
    resolution.manaGained = next.mana - manaBefore;
  } else if (type === 'green') {
    let heal = length * 6;
    if (cls === 'cleric') heal = Math.round(heal * 1.5);
    const applied = Math.min(heal, next.maxHp - next.hp);
    next.hp += applied;
    resolution.hpHealed = applied;
  } else if (type === 'gold') {
    const shieldBefore = next.shieldTurns;
    next.shieldTurns = Math.max(next.shieldTurns, 1) + Math.floor(length / 3);
    // Existing shield duration is not newly gained guard.
    resolution.guardGained = next.shieldTurns - shieldBefore;
  }

  if (cls === 'rogue' && length >= rogueBonusThreshold) {
    next.rogueBonusTriggered = true;
  }

  return { next, resolution };
}

// After player chain, enemies act. Returns next state plus any ability logs
// and side-effects (corrupt/seal/spawn) for the page layer to apply.
//
// When `telegraphed` is true (Band-2 mechanic), Band-2 intents tick first,
// then enemies whose intent hit 0 deal a heavy strike (and reset). Otherwise
// behaves like classic damage.
//
// Per-enemy ABILITIES (shield_self, heal_ally, summon_minion, corrupt_tile,
// seal_tile, heavy_strike) tick on their own cooldown — independent of the
// Band-2 telegraph system, and only resolve once the standard attack pass
// has fired so the log reads in chronological order.
//
// `bossRule` (Band 5) can mutate per-enemy outgoing damage (enrager) and
// trigger end-of-turn effects (regenerator).
export function enemiesAttack(
  state: CombatState,
  telegraphed = false,
  bossRule: BossRuleId | null = null,
  summonsSoFar = 0,
  thornsOpts?: { cls?: HeroClass; relicMultiplier?: number },
): CombatState & {
  heavyFired?: boolean;
  abilityLogs?: Array<Omit<CombatLogEntry, 'id'>>;
  abilityEffects?: AbilityEffect[];
  thornsLog?: Omit<CombatLogEntry, 'id'>;
} {
  const ticked = telegraphed ? tickIntents(state.enemies) : state.enemies;
  let next: CombatState = { ...state, enemies: ticked.map(e => ({ ...e })) };
  let heavyFired = false;
  // Snapshot pre-attack info needed for Thorns calc.
  const shieldWasUp = next.shieldTurns > 0;
  let rawIncomingForThorns = 0;
  // Capture which enemies were "swinging" this turn — used to split Thorns.
  const attackerSnapshot = next.enemies.map(e => ({ id: e.id, alive: e.hp > 0 }));
  if (telegraphed) {
    // Apply enrager / aura multiplier in-place by temporarily scaling each
    // enemy's damage for the resolve call, then restoring.
    const original = next.enemies.map(e => e.damage);
    next.enemies.forEach(e => { e.damage = Math.round(e.damage * enemyDamageMultiplier(bossRule, e, next.enemies)); });
    // Compute raw (pre-shield) damage directly from the scaled enemies so the
    // Thorns math is independent of resolveEnemyAttack's internal guard math
    // (which varies for heavy strikes via HEAVY_GUARD_PIERCE).
    rawIncomingForThorns = next.enemies.reduce((sum, e) => {
      if (e.hp <= 0) return sum;
      const isHeavy = e.intent != null && e.intent <= 0;
      const dmg = isHeavy ? Math.round(e.damage * HEAVY_DAMAGE_MULT) : e.damage;
      return sum + dmg;
    }, 0);
    const r = resolveEnemyAttack(next.enemies, next.shieldTurns > 0);
    next.enemies = r.enemies.map((e, i) => ({ ...e, damage: original[i] ?? e.damage }));
    heavyFired = r.heavyFired;
    if (next.shieldTurns > 0) next.shieldTurns -= 1;
    next.hp = Math.max(0, next.hp - r.totalDamage);
  } else {
    let totalIncoming = 0;
    for (const e of next.enemies) {
      if (e.hp > 0) totalIncoming += Math.round(e.damage * enemyDamageMultiplier(bossRule, e, next.enemies));
    }
    rawIncomingForThorns = totalIncoming;
    if (next.shieldTurns > 0) {
      totalIncoming = Math.round(totalIncoming * 0.4);
      next.shieldTurns -= 1;
    }
    next.hp = Math.max(0, next.hp - totalIncoming);
  }

  // ── Shield Thorns ──────────────────────────────────────────────────────
  // Reflect a portion of the raw pre-shield damage back at attackers when
  // shield was active. Splits evenly across living, targetable enemies who
  // were alive and swinging at the start of the enemy phase.
  let thornsLog: Omit<CombatLogEntry, 'id'> | undefined;
  if (shieldWasUp && rawIncomingForThorns > 0) {
    const baseRate = thornsOpts?.cls === 'warrior' ? 0.40 : 0.25;
    const relicMul = thornsOpts?.relicMultiplier ?? 1;
    const totalThorns = Math.round(rawIncomingForThorns * baseRate * relicMul);
    if (totalThorns > 0) {
      // Living, targetable attackers (boss-rule respects untargetable / phaselock).
      const targetable = filterTargetable(bossRule, next.enemies);
      const targetableIds = new Set(targetable.map(e => e.id));
      // Was swinging this turn AND still standing AND not phased/locked-out.
      const validTargets = next.enemies.filter(e => {
        const snap = attackerSnapshot.find(a => a.id === e.id);
        return snap?.alive && e.hp > 0 && targetableIds.has(e.id);
      });
      if (validTargets.length > 0) {
        const perEnemy = Math.floor(totalThorns / validTargets.length);
        let remainder = totalThorns - perEnemy * validTargets.length;
        let totalApplied = 0;
        const killedNames: string[] = [];
        const targetIdSet = new Set(validTargets.map(t => t.id));
        next.enemies = next.enemies.map(e => {
          if (!targetIdSet.has(e.id) || e.hp <= 0) return e;
          const portion = perEnemy + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder -= 1;
          if (portion <= 0) return e;
          const afterArmor = applyArmorToDamage(e, portion);
          const applied = Math.min(afterArmor, e.hp);
          if (applied <= 0) return e;
          const newHp = e.hp - applied;
          totalApplied += applied;
          if (newHp <= 0) {
            next.enemiesDefeated += 1;
            killedNames.push(e.name);
          }
          return { ...e, hp: newHp };
        });
        if (totalApplied > 0) {
          next.totalDamage += totalApplied;
          const tName = validTargets.length === 1
            ? validTargets[0].name
            : `${validTargets.length} enemies`;
          const killSuffix = killedNames.length
            ? ` (${killedNames.length === 1 ? `slew ${killedNames[0]}` : `${killedNames.length} slain`})`
            : '';
          thornsLog = {
            kind: 'damage',
            text: `🌵 Thorns reflected to ${tName}${killSuffix}`,
            amount: totalApplied,
          };
        }
      }
    }
  }

  // ── Ability tick ──────────────────────────────────────────────────────
  // Run AFTER the standard attack so heavy_strike / heal_ally land on the
  // post-damage state. Effects (corrupt/seal/spawn) bubble up to the page.
  const abilityResult = tickEnemyAbilities(next.enemies, summonsSoFar);
  next.enemies = abilityResult.enemies;
  // heavy_strike fires `damage_hero` effects — apply them here so the engine
  // remains the single source of truth for hero HP changes.
  for (const eff of abilityResult.effects) {
    if (eff.kind === 'damage_hero') {
      // Heavy ability strikes ignore the standard guard scaling because the
      // log already labels them as a "charged blast" — keeps numbers honest.
      next.hp = Math.max(0, next.hp - eff.amount);
    }
  }

  next.turnsRemaining = Math.max(0, next.turnsRemaining - 1);
  // Boss-rule end-of-turn effects (e.g. regenerator, splitter, phaselock decay).
  const bossOut = applyBossTurnEffects(next, bossRule);
  next = bossOut.state;
  // Merge boss logs alongside ability logs so the Battle Chronicle reads them
  // chronologically as a single batch.
  const mergedLogs = [...(abilityResult.logs ?? []), ...bossOut.logs];
  return {
    ...next,
    heavyFired,
    abilityLogs: mergedLogs,
    // Strip the damage_hero effects we already applied — only board effects
    // and spawns need to leave the engine.
    abilityEffects: abilityResult.effects.filter(e => e.kind !== 'damage_hero'),
    thornsLog,
  };
}

// Always decrement the turn counter at the end of the player's action,
// even if the chain (or ability) killed every enemy and we skip the enemy phase.
// Without this the killing-blow turn doesn't count, inflating "turns remaining" score.
export function endTurn(state: CombatState): CombatState {
  return { ...state, turnsRemaining: Math.max(0, state.turnsRemaining - 1) };
}

export function isRunOver(state: CombatState): { over: boolean; cleared: boolean } {
  const allDead = state.enemies.every(e => e.hp <= 0);
  if (allDead) return { over: true, cleared: true };
  if (state.hp <= 0) return { over: true, cleared: false };
  if (state.turnsRemaining <= 0) return { over: true, cleared: false };
  return { over: false, cleared: false };
}

export function useAbility(
  state: CombatState,
  cls: HeroClass,
  bossRule: BossRuleId | null = null,
  activeMasteries: MasteryId[] = [],
  level = 1,
  manaCost: number = MAX_MANA,
): { next: CombatState; ok: boolean } {
  // cost 0 is a legitimate free cast (First Light relic) — it fires at any mana
  // and spends nothing. Otherwise clamp into the 1..MAX_MANA range.
  const cost = Math.max(0, Math.min(MAX_MANA, manaCost));
  if (state.mana < cost) return { next: state, ok: false };
  // Spend exactly `cost` orbs (Mage T4 Deep Reserve casts at 2; First Light at 0).
  const next: CombatState = { ...state, mana: state.mana - cost, abilityUsed: true, enemies: state.enemies.map(e => ({ ...e })) };
  const targetable = filterTargetable(bossRule, next.enemies);
  const targetableIds = new Set(targetable.map(e => e.id));
  // Mirror the chain-damage depth scalar so abilities scale with the campaign.
  const depthMul = campaignPowerMultiplier(level);
  if (cls === 'warrior') {
    // Cleave: 40 dmg to all targetable enemies (50 with Honed Cleave T3).
    const cleaveDmg = Math.round((getMasteryCleaveDamage(activeMasteries) ?? 40) * depthMul);
    for (const e of next.enemies) {
      if (e.hp > 0 && targetableIds.has(e.id)) {
        const applied = Math.min(applyArmorToDamage(e, cleaveDmg), e.hp);
        e.hp -= applied;
        next.totalDamage += applied;
        if (e.hp <= 0) next.enemiesDefeated += 1;
      }
    }
  } else if (cls === 'mage') {
    const arcBaseDmg = Math.round(80 * depthMul);
    const t = targetable[0];
    if (t) {
      const live = next.enemies.find(e => e.id === t.id)!;
      const applied = Math.min(applyArmorToDamage(live, arcBaseDmg), live.hp);
      live.hp -= applied;
      next.totalDamage += applied;
      if (live.hp <= 0) next.enemiesDefeated += 1;
    }
    // ── Arc Cascade (Mage T3) — chain 30% damage to a 2nd targetable foe.
    const arcFrac = getMasteryArcChainFraction(activeMasteries);
    if (arcFrac > 0) {
      const remaining = filterTargetable(bossRule, next.enemies).filter(e => e.hp > 0);
      const second = remaining[0];
      if (second) {
        const live2 = next.enemies.find(e => e.id === second.id)!;
        const arcDmg = Math.round(arcBaseDmg * arcFrac);
        const applied = Math.min(applyArmorToDamage(live2, arcDmg), live2.hp);
        if (applied > 0) {
          live2.hp -= applied;
          next.totalDamage += applied;
          if (live2.hp <= 0) next.enemiesDefeated += 1;
        }
      }
    }
  } else if (cls === 'rogue') {
    next.shadowstepActive = true;
    // ── Veilcut (Rogue T3) — also clear one enemy's ability cooldown.
    if (shadowstepClearsCooldown(activeMasteries)) {
      const candidate = next.enemies.find(e =>
        e.hp > 0 && (e.abilityCooldown ?? 0) > 0,
      );
      if (candidate) candidate.abilityCooldown = 0;
    }
  } else if (cls === 'cleric') {
    // Sanctuary: 30 heal (40 with Greater Sanctuary T3).
    const sanctHeal = getMasterySanctuaryHeal(activeMasteries) ?? 30;
    const heal = Math.min(sanctHeal, next.maxHp - next.hp);
    next.hp += heal;
    next.shieldTurns = Math.max(next.shieldTurns, 2);
    // Rebalance v6 — Sanctuary now also smites: a modest holy AoE so the Cleric
    // isn't the only class whose ability deals zero damage (that gap left it
    // unable to burst high-HP boss walls and locked out of the deep campaign).
    // Depth-scaled like every other ability so it keeps pace with the curve.
    const smite = Math.round(22 * depthMul);
    for (const e of next.enemies) {
      if (e.hp > 0 && targetableIds.has(e.id)) {
        const applied = Math.min(applyArmorToDamage(e, smite), e.hp);
        e.hp -= applied;
        next.totalDamage += applied;
        if (e.hp <= 0) next.enemiesDefeated += 1;
      }
    }
  }
  // Phase Lock — abilities can damage the boss too, so credit threshold ticks.
  next.enemies = applyPhaseLockOnDamage(bossRule, next.enemies);
  return { next, ok: true };
}

/**
 * Append a wave of reinforcements mid-fight. Adds the new enemies to the
 * encounter and grants `bonusTurns` extra turns so the level stays clearable.
 * Pure — returns a fresh state object.
 */
export function spawnWave(state: CombatState, enemies: Enemy[], bonusTurns = 2): CombatState {
  if (!enemies.length) return state;
  return {
    ...state,
    enemies: [...state.enemies, ...enemies.map(e => ({ ...e }))],
    turnsRemaining: state.turnsRemaining + bonusTurns,
  };
}

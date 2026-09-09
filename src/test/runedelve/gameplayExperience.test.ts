import { describe, expect, it } from 'vitest';
import { advanceChainSelection } from '@/lib/runedelve/chainControls';
import { applyChain, initialCombat, redChainDamage, type CombatState } from '@/lib/runedelve/combatEngine';
import type { Enemy, RuneType } from '@/lib/runedelve/dungeonGenerator';
import { generateLevel } from '@/lib/runedelve/levelGenerator';
import { evaluateObjective, getObjectiveProgress, getPriorityEnemy } from '@/lib/runedelve/objectives';
import { liveScore } from '@/lib/runedelve/scoring';
import { simulateLevel } from '@/lib/runedelve/simulator';
import type { HeroClass } from '@/lib/runedelve/classConfig';
import { buildSnapshot } from '@/lib/runedelve/runSnapshot';
import { mechanicsForLevel } from '@/lib/runedelve/mechanics';
import { ALL_LAYOUTS } from '@/lib/runedelve/runeLayouts';

const grid: RuneType[][] = [
  ['red', 'red', 'blue', 'green', 'gold'],
  ['red', 'red', 'blue', 'green', 'gold'],
  ['blue', 'blue', 'blue', 'green', 'gold'],
  ['green', 'green', 'gold', 'gold', 'gold'],
  ['red', 'blue', 'green', 'gold', 'red'],
];

function enemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'enemy-1',
    name: 'Cave Warden',
    emoji: '👹',
    hp: 100,
    maxHp: 100,
    damage: 8,
    ...overrides,
  };
}

function combat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    ...initialCombat([enemy()], 10),
    ...overrides,
  };
}

describe('Rune Delve · device-friendly chain controls', () => {
  it('builds, backtracks, and validates tap chains with the drag rules', () => {
    let chain = advanceChainSelection(grid, [], { r: 0, c: 0 }).chain;
    chain = advanceChainSelection(grid, chain, { r: 0, c: 1 }).chain;
    chain = advanceChainSelection(grid, chain, { r: 1, c: 1 }).chain;
    expect(chain).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }]);

    const wrongColor = advanceChainSelection(grid, chain, { r: 0, c: 2 });
    expect(wrongColor.changed).toBe(false);
    expect(wrongColor.reason).toBe('wrong-rune');

    const backtracked = advanceChainSelection(grid, chain, { r: 0, c: 1 });
    expect(backtracked.chain).toHaveLength(2);
    expect(backtracked.changed).toBe(true);
  });

  it('blocks sealed cells and eclipsed chain starts without blocking extensions', () => {
    const sealed = advanceChainSelection(grid, [], { r: 0, c: 0 }, new Set(['0-0']));
    expect(sealed.reason).toBe('sealed');

    const eclipse = new Set(['0-0', '0-1']);
    const badStart = advanceChainSelection(grid, [], { r: 0, c: 0 }, undefined, eclipse);
    expect(badStart.reason).toBe('eclipsed-start');

    const start = advanceChainSelection(grid, [], { r: 1, c: 0 }, undefined, eclipse);
    const extension = advanceChainSelection(grid, start.chain, { r: 0, c: 1 }, undefined, eclipse);
    expect(extension.changed).toBe(true);
  });

  it('preserves turn bonuses and the chosen path across a mobile resume', () => {
    const state = combat({ turnsRemaining: 13 });
    const snapshot = buildSnapshot({
      levelNumber: 102,
      generationSeed: 55,
      grid,
      combat: state,
      initialTurns: 17,
      seals: new Set(),
      corruption: { cells: new Set(), sources: new Set() },
      log: [],
      lastStandUsed: 0,
      phoenixUsed: false,
      bonusUsedThisCycle: false,
      redChainCount: 0,
      chainCountTotal: 1,
      abilityUsedCount: 0,
      corruptCleansedCount: 0,
      defeatedArchetypes: new Map(),
      wavesSpawned: 0,
      rngTick: 1,
      activeRelicsSnapshot: null,
      activeModifierId: 'steady_path',
    });

    expect(snapshot.initialTurns).toBe(17);
    expect(snapshot.activeModifierId).toBe('steady_path');
    expect(snapshot.combat.turnsRemaining).toBe(13);
  });
});

describe('Rune Delve · objective truth', () => {
  it('uses one live score formula for the HUD and score objective', () => {
    const state = combat({
      hp: 72,
      turnsRemaining: 4,
      totalDamage: 155,
      enemiesDefeated: 2,
      longestChain: 6,
    });
    expect(liveScore(state)).toBe(1_265);
    expect(evaluateObjective(state, 10, 'reach_score', 1_265)).toEqual({ over: true, cleared: true });
    expect(evaluateObjective(state, 10, 'reach_score', 1_266)).toEqual({ over: false, cleared: false });
    expect(getObjectiveProgress(state, 10, 'reach_score', 1_500).current).toBe(1_265);
  });

  it('clears a champion objective when the champion falls, even with a minion alive', () => {
    const state = combat({
      enemies: [
        enemy({ id: 'minion', hp: 30 }),
        enemy({ id: 'boss', name: 'Boss Cave Warden', tier: 'boss', hp: 0 }),
      ],
    });
    expect(getPriorityEnemy(state.enemies)?.id).toBe('boss');
    expect(evaluateObjective(state, 10, 'defeat_elite', 0)).toEqual({ over: true, cleared: true });
  });

  it('treats surviving the final turn as a clear and hero defeat as a loss', () => {
    expect(evaluateObjective(combat({ turnsRemaining: 0 }), 10, 'survive', 10)).toEqual({ over: true, cleared: true });
    expect(evaluateObjective(combat({ hp: 0, turnsRemaining: 0 }), 10, 'survive', 10)).toEqual({ over: true, cleared: false });
  });
});

describe('Rune Delve · combat clarity and campaign integrity', () => {
  const classes: HeroClass[] = ['warrior', 'mage', 'rogue', 'cleric'];

  it('keeps the attack preview formula identical to applied base damage', () => {
    for (const heroClass of classes) {
      for (const level of [1, 50, 102, 150]) {
        const foe = enemy({ hp: 5_000, maxHp: 5_000 });
        const result = applyChain(initialCombat([foe], 20), 'red', 7, heroClass, null, 5, level);
        expect(result.resolution.damageDealt).toBe(redChainDamage(7, heroClass, level));
      }
    }
  });

  it('reports only mana and shield duration that were actually gained', () => {
    const foe = enemy({ hp: 5_000, maxHp: 5_000 });
    const cappedMana = applyChain(
      combat({ enemies: [foe], mana: 2 }),
      'blue',
      5,
      'mage',
    );
    expect(cappedMana.next.mana).toBe(3);
    expect(cappedMana.resolution.manaGained).toBe(1);

    const stackedGuard = applyChain(
      combat({ enemies: [foe], shieldTurns: 4 }),
      'gold',
      3,
      'warrior',
    );
    expect(stackedGuard.next.shieldTurns).toBe(5);
    expect(stackedGuard.resolution.guardGained).toBe(1);
  });

  it('gives Rogue long red chains the advertised combat payoff', () => {
    const shortPerRune = redChainDamage(4, 'rogue', 50) / 4;
    const longPerRune = redChainDamage(5, 'rogue', 50) / 5;
    expect(longPerRune).toBeGreaterThan(shortPerRune * 1.1);
  });

  it('generates every campaign chamber with valid enemies, objectives, and unique ids', () => {
    for (let levelNumber = 1; levelNumber <= 150; levelNumber += 1) {
      const level = generateLevel(levelNumber);
      const allEnemies = [
        ...level.enemy_config,
        ...(level.modifiers?.waves ?? []).flatMap(wave => wave.enemies),
      ];
      expect(level.board_size).toBe(5);
      expect(level.turn_limit).toBeGreaterThan(0);
      expect(allEnemies.length).toBeGreaterThan(0);
      expect(new Set(allEnemies.map(foe => foe.id)).size).toBe(allEnemies.length);
      expect(allEnemies.every(foe => foe.hp > 0 && foe.maxHp > 0 && foe.damage > 0)).toBe(true);

      if (level.objective_type === 'defeat_elite') {
        expect(getPriorityEnemy(allEnemies), `level ${levelNumber} needs a champion target`).toBeTruthy();
      }
      if (level.objective_type === 'reach_score') {
        const startingState = initialCombat(level.enemy_config, level.turn_limit);
        const startingScore = liveScore(startingState);
        expect(
          evaluateObjective(startingState, level.turn_limit, 'reach_score', level.objective_target).over,
          `level ${levelNumber} must not start at or above its score target`,
        ).toBe(false);
        expect(level.objective_target - startingScore).toBeGreaterThanOrEqual(225);
        expect(level.objective_target - startingScore).toBeLessThanOrEqual(325);
      }

      const mechanics = level.modifiers.mechanics ?? [];
      expect(mechanics.length, `level ${levelNumber} exceeds the two-rule cap`).toBeLessThanOrEqual(2);
      if (mechanics.includes('multi_objective')) {
        expect(level.modifiers.secondary_objective, `level ${levelNumber} advertises a missing bonus`).toBeTruthy();
      }
      if (level.modifiers.secondary_objective) {
        expect(mechanics, `level ${levelNumber} hides its bonus rule`).toContain('multi_objective');
      }
      if (level.modifiers.boss_rule) {
        expect(mechanics, `boss level ${levelNumber} should focus on its boss rule`).toHaveLength(0);
        expect(
          getPriorityEnemy(allEnemies),
          `boss-rule level ${levelNumber} must generate an actual boss target`,
        ).toBeTruthy();
        if (level.modifiers.boss_kind === 'chapter') {
          expect(
            getPriorityEnemy(level.enemy_config),
            `chapter boss ${levelNumber} warm-up should not contain a fake elite`,
          ).toBeUndefined();
          expect(level.modifiers.waves?.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps focus encounters simple and endgame remixes varied', () => {
    for (let level = 1; level <= 150; level += 1) {
      expect(mechanicsForLevel(level).length).toBeLessThanOrEqual(2);
    }
    expect(mechanicsForLevel(125)).toEqual([]);
    expect(mechanicsForLevel(130)).toEqual([]);
    expect(new Set([126, 127, 128, 129, 131, 132].flatMap(mechanicsForLevel)).size).toBeGreaterThan(4);
  });

  it('gives the Last Stand flagship a guard that makes its rule meaningful', () => {
    const level = generateLevel(130);
    const bossWave = level.modifiers.waves?.[0]?.enemies ?? [];
    expect(level.modifiers.boss_rule).toBe('last_stand');
    expect(bossWave).toHaveLength(2);
    expect(bossWave[0].name).toMatch(/^Oathbound /);
    expect(getPriorityEnemy(bossWave)?.id).toBe(bossWave[1].id);
  });

  it('budgets reinforcement turns for ordinary summoner rooms', () => {
    const level = generateLevel(106);
    expect(level.enemy_config.some(foe => foe.ability === 'summon_minion')).toBe(true);
    expect(level.turn_limit).toBe(17);
  });

  it('keeps the final boss from rolling support-level threat', () => {
    const level = generateLevel(150);
    const boss = getPriorityEnemy(level.modifiers.waves?.[0]?.enemies ?? []);
    expect(level.turn_limit).toBe(19);
    expect(boss?.maxHp).toBe(400);
    expect(boss?.damage).toBeGreaterThanOrEqual(20);
  });

  it('keeps chamber briefings faithful to fixed board zones', () => {
    const copy = ALL_LAYOUTS.map(layout => `${layout.briefing} ${layout.recommendedStrategy}`).join(' ').toLowerCase();
    for (const falsePromise of ['activates twice', 'both branches must hold', 'dim beat', 'false relic', 'one shot']) {
      expect(copy).not.toContain(falsePromise);
    }
  });

  it('keeps every major campaign milestone winnable by at least one class', () => {
    for (const level of [1, 10, 25, 50, 75, 100, 125, 150]) {
      const rates = classes.map(heroClass => simulateLevel(level, heroClass, 10, 0xD311E).aggregate.clearRate);
      expect(Math.max(...rates), `level ${level} clear rates: ${rates.join(', ')}`).toBeGreaterThan(0);
    }
  }, 30_000);

  it('keeps every score-objective chamber achievable through active play', () => {
    for (const level of [34, 51, 68, 85, 102, 119, 136]) {
      const rates = classes.map(heroClass => simulateLevel(level, heroClass, 12, 0x5C0AE).aggregate.clearRate);
      expect(Math.min(...rates), `score level ${level} clear rates: ${rates.join(', ')}`).toBeGreaterThan(0);
    }
  }, 30_000);
});

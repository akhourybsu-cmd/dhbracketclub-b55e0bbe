import { describe, expect, it } from 'vitest';
import { bondFighter, createBattle, makeCompanion, resolveBattleTurn } from '@/lib/mesomon/battle';
import { MOVES, SPECIES } from '@/lib/mesomon/data/species';
import { createNewSave, createSession, reduceGame } from '@/lib/mesomon/engine';
import { habitatSeed, individualStats, statBounds, strikeDamage } from '@/lib/mesomon/individuals';
import { migrateSave } from '@/lib/mesomon/save';
import { freshEnvelope, parseLocalEnvelope } from '@/lib/mesomon/storage';
import type { BattleAction, IndividualStats, MesomonSaveV1, SpeciesId, StoryEvent } from '@/lib/mesomon/types';

const attributes: (keyof IndividualStats)[] = ['maxVitality', 'power', 'guard', 'agility', 'resonance'];

function finishScene(save: MesomonSaveV1, event: StoryEvent) {
  const dialogue = { id: 'fixture', lines: [{ speaker: 'Tavian', text: 'Ready.' }], index: 0, onFinish: event };
  return reduceGame(createSession({ ...save, dialogue }), { type: 'advance' }).save;
}

describe('Port Marche individuals', () => {
  it('rolls all attributes within each species’ bounds, including both ends', () => {
    for (const speciesId of Object.keys(SPECIES) as SpeciesId[]) {
      const rolls = Array.from({ length: 256 }, (_, i) => individualStats(speciesId, i));
      for (const key of attributes) {
        const values = rolls.map(stats => stats[key]);
        expect([Math.min(...values), Math.max(...values)]).toEqual(statBounds(speciesId, key));
      }
      expect(rolls[7]).toEqual(individualStats(speciesId, 7));
      expect(new Set(rolls.map(roll => JSON.stringify(roll))).size).toBeGreaterThan(100);
    }
    expect(statBounds('rift-wretch', 'resonance')).toEqual([0, 0]);
    expect(statBounds('muddren', 'guard')[0]).toBeGreaterThan(statBounds('gleamwing', 'guard')[1]);
    expect(statBounds('gleamwing', 'agility')[0]).toBeGreaterThan(statBounds('rillik', 'agility')[1]);
  });

  it('keeps the same field individual when revisiting or reloading, and rolls independently in other journeys', () => {
    const start = createNewSave(1, 150);
    const first = finishScene(start, 'first-bond');
    const other = finishScene(createNewSave(1, 934), 'first-bond');
    expect(first.party[0]).toEqual(first.collection[first.party[0].id]);
    expect(first.party[0]).not.toEqual(other.party[0]);
    const battle = finishScene(first, 'tutorial-complete').battle!;
    expect(finishScene(migrateSave(first)!, 'tutorial-complete').battle?.enemy).toEqual(battle.enemy);
    expect(finishScene(other, 'tutorial-complete').battle?.enemy.id).not.toBe(battle.enemy.id);
    expect(battle.allies[0]).toMatchObject(Object.fromEntries(attributes.map(key => [key, first.party[0][key]])));
    expect(habitatSeed(first, 'another-nest')).not.toBe(habitatSeed(first, 'passage-encounter'));
  });

  it('carries the encountered individual’s identity and stats into the next fight after bonding', () => {
    const save = finishScene(createNewSave(1, 73), 'first-bond');
    const encounter = finishScene(save, 'wild-complete');
    const foe = encounter.battle!.enemy;
    encounter.battle = { ...encounter.battle!, phase: 'resonated' };
    const bonded = reduceGame(createSession(encounter), { type: 'advance' }).save;
    const member = bonded.party.find(ally => ally.id === foe.id)!;
    expect(member).toMatchObject(foe);
    expect(migrateSave(bonded)?.collection[foe.id]).toEqual(member);
    expect(createBattle(bonded.party, 'tressel').allies[1]).toEqual(foe);
    expect(bondFighter(createBattle(save.party, 'rift-wretch', 'chamber-boss').enemy)).toBeNull();
  });

  it('uses individual attack and defense for damage in both directions, with bounded seeded variation', () => {
    const member = individualStats('rillik', 124);
    const foe = { ...individualStats('tressel', 44), speciesId: 'tressel' as const };
    const move = MOVES['brine-snap'];
    expect(strikeDamage(move, { ...member, power: member.power + 6 }, foe, 0.5)).toBeGreaterThan(strikeDamage(move, member, foe, 0.5));
    expect(strikeDamage(move, member, { ...foe, guard: foe.guard + 8 }, 0.5)).toBeLessThan(strikeDamage(move, member, foe, 0.5));
    expect(strikeDamage(move, member, foe, 1) - strikeDamage(move, member, foe, 0)).toBeLessThanOrEqual(3);
    const encounter = createBattle([makeCompanion('rillik')], 'tressel');
    const normal = resolveBattleTurn(encounter, { type: 'move', moveId: 'brine-snap' });
    const strongFoe = { ...encounter, enemy: { ...encounter.enemy, power: encounter.enemy.power + 12 } };
    expect(resolveBattleTurn(strongFoe, { type: 'move', moveId: 'brine-snap' }).allies[0].vitality).toBeLessThan(normal.allies[0].vitality);
    const strongAlly = { ...encounter, allies: [{ ...encounter.allies[0], power: encounter.allies[0].power + 12 }] };
    expect(resolveBattleTurn(strongAlly, { type: 'move', moveId: 'brine-snap' }).enemy.vitality).toBeLessThan(normal.enemy.vitality);
  });

  it('gives the same individual the same move damage on either side, across neutral and existing affinity matchups', () => {
    for (const target of ['rillik', 'gleamwing'] as const) {
      const attacker = makeCompanion('tressel', 'quay-tressel', 49354);
      const defender = makeCompanion(target, 'target', 9021);
      const againstWild = createBattle([attacker], target);
      const againstBonded = createBattle([defender], 'tressel');
      // Swap controllers, keeping both individuals, their signature attacks and the RNG seed.
      const tressel = againstWild.allies[0], opponent = againstBonded.allies[0];
      const wild = resolveBattleTurn({ ...againstBonded, seed: 3456, allies: [opponent], enemy: tressel }, {
        type: 'move', moveId: opponent.moves[0],
      });
      const bonded = resolveBattleTurn({ ...againstWild, seed: 3456, allies: [tressel], enemy: opponent }, {
        type: 'move', moveId: 'splinter-swipe',
      });
      expect(opponent.vitality - wild.allies[0].vitality).toBeGreaterThan(0);
      expect(wild.allies[0].vitality).toBe(bonded.enemy.vitality);
      expect(wild.enemy.vitality).toBe(bonded.allies[0].vitality);
    }
  });

  it('orders ordinary attacks by individual speed, breaks ties from the saved seed, and honors priority', () => {
    const base = createBattle([makeCompanion('rillik')], 'tressel');
    const choose = (agility: number, seed: number) => resolveBattleTurn({
      ...base, seed, allies: [{ ...base.allies[0], agility }],
    }, { type: 'move', moveId: 'brine-snap' });
    const isRillikFirst = (log: string[]) => log[0].startsWith('Rillik');
    expect(isRillikFirst(choose(base.enemy.agility + 1, 1).log)).toBe(true);
    expect(isRillikFirst(choose(base.enemy.agility - 1, 1).log)).toBe(false);
    const tie = (seed: number) => choose(base.enemy.agility, seed);
    expect(tie(32767)).toEqual(tie(32767));
    const outcomes = new Set([1, 12345, 32767, 894521].map(seed => isRillikFirst(tie(seed).log)));
    expect(outcomes.size).toBe(2);
    expect(isRillikFirst(resolveBattleTurn({ ...base, allies: [{ ...base.allies[0], agility: 1 }] }, { type: 'guard' }).log)).toBe(true);
  });

  it('keeps both required fights reachable with a rolled starter and the original supplies', () => {
    for (let seed = 0; seed < 128; seed++) {
      const save = finishScene(createNewSave(1, seed), 'first-bond');
      let nest = finishScene(save, 'tutorial-complete').battle!;
      while (nest.phase === 'choosing' && nest.turn < 10) {
        nest = resolveBattleTurn(nest, { type: 'move', moveId: 'brine-snap' });
      }
      expect(nest.phase, `nest, seed ${seed}`).toBe('won');
      save.party[0].vitality = nest.allies[0].vitality;
      let chamber = finishScene(save, 'boss-introduced').battle!;
      while (chamber.phase === 'choosing' && chamber.turn < 20) {
        const supplies = 2 - chamber.usedTinctures;
        let action: BattleAction = { type: 'move', moveId: 'brine-snap' };
        if (chamber.allies[0].vitality <= 18 && supplies > 0) action = { type: 'item', itemId: 'tincture' };
        else if ((chamber.turn + 1) % 3 === 0) action = { type: 'guard' };
        chamber = resolveBattleTurn(chamber, action, { tinctures: supplies });
      }
      expect(chamber.phase, `chamber, seed ${seed}`).toBe('won');
    }
  });

  it('preserves old health, base attributes, active battle state and the exact pending RPC payload', () => {
    const current = finishScene(createNewSave(1, 45), 'first-bond');
    const rillik = current.party[0];
    const old = { id: rillik.id, speciesId: rillik.speciesId, moves: rillik.moves, level: 5, experience: 20, vitality: 19, maxVitality: 48 };
    const { journeySeed: removedSeed, ...withoutSeed } = current;
    expect(removedSeed).toBe(45);
    const legacy = { ...withoutSeed, party: [old], collection: { [old.id]: old } };
    const legacyAlly = { ...old, power: 15, guard: 13, agility: 15, resonance: 19 };
    const battle = createBattle([legacyAlly], 'tressel');
    const raw = { ...legacy, battle };
    const restored = migrateSave(raw)!;
    expect(restored.party[0]).toEqual(legacyAlly);
    expect(restored.party[0]).toEqual(restored.collection[old.id]);
    expect(restored.battle).toEqual(battle);
    expect(habitatSeed(restored, 'lamp')).toBe(habitatSeed(migrateSave(raw)!, 'lamp'));
    const requestId = 'e182ab01-a2a6-4ffe-b26e-3922a5538f16';
    const envelope = parseLocalEnvelope({ ...freshEnvelope(restored), save:raw, pending:{state:raw, requestId, expectedRevision:3} }, 1)!;
    expect(envelope.save.party[0]).toEqual(legacyAlly);
    expect(envelope.pending!.state).toEqual(raw);
    expect(migrateSave({ ...current, journeySeed: -1 })).toBeNull();
    expect(migrateSave({ ...current, party: [{ ...rillik, power: Number.NaN }] })).toBeNull();
  });
});

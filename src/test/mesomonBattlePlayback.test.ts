import { describe, expect, it } from 'vitest';
import { createBattle, makeCompanion, resolveBattleTurn, startBattleTurn } from '@/lib/mesomon/battle';
import { advanceBattleBeat, battleBeatDuration, getBattleBeat } from '@/lib/mesomon/battlePlayback';
import { createNewSave, createSession, reduceGame } from '@/lib/mesomon/engine';
import { migrateSave } from '@/lib/mesomon/save';
import type { BattleAction, GameSession } from '@/lib/mesomon/types';

const attack = { type: 'move', moveId: 'brine-snap' } as const;
const choose = (session: GameSession, action: BattleAction = attack) => reduceGame(session, { type: 'battle', action });

function fight() {
  const save = createNewSave();
  const rillik = makeCompanion('rillik');
  save.party = [rillik];
  save.collection = { [rillik.id]: rillik };
  save.battle = createBattle(save.party, 'tressel', 'passage-encounter', 420197);
  return createSession(save);
}

describe('Mesomon turn playback', () => {
  it.each([true, false])('shows exactly the actions taken in initiative order (ally first: %s)', allyFirst => {
    const before = fight().save.battle!;
    before.allies[0].agility = allyFirst ? before.enemy.agility + 1 : before.enemy.agility - 1;
    const resolved = resolveBattleTurn(before, attack);
    let staged = startBattleTurn(before, attack, {});
    const first = allyFirst ? 'ally' : 'enemy', second = allyFirst ? 'enemy' : 'ally';
    const beats = staged.playback!.beats;
    expect(beats.map(beat => [beat.side, beat.kind])).toEqual([
      [first, 'action'], [first, 'impact'], [second, 'action'], [second, 'impact'],
    ]);
    expect(beats.find(beat => beat.kind === 'action' && beat.side === 'enemy')?.text).toContain('Splinter Swipe');
    expect(beats[0]).toMatchObject({ allyVitality: [before.allies[0].vitality], enemyVitality: before.enemy.vitality });
    expect(beats[1]).toMatchObject({
      allyVitality: [allyFirst ? before.allies[0].vitality : resolved.allies[0].vitality],
      enemyVitality: allyFirst ? resolved.enemy.vitality : before.enemy.vitality,
    });
    expect(beats[3]).toMatchObject({ allyVitality: [resolved.allies[0].vitality], enemyVitality: resolved.enemy.vitality });
    while (staged.playback) staged = advanceBattleBeat(staged, staged.turn, staged.playback.index);
    expect(staged).toEqual(resolved);
  });

  it('respects the opponent’s move priority, even against a faster companion', () => {
    const before = createBattle([makeCompanion('rillik')], 'gleamwing', 'gleamwing-encounter', 130);
    before.allies[0].agility = before.enemy.agility + 10;
    const attackTurn = startBattleTurn(before, attack, {});
    expect(getBattleBeat(attackTurn)).toMatchObject({ side: 'enemy', text: 'Gleamwing uses Quick Tackle.' });
    const guardTurn = startBattleTurn(before, { type: 'guard' }, {});
    expect(getBattleBeat(guardTurn)?.side).toBe('ally');
  });

  it('keeps a terminal hit on screen and never grants a counterattack to a defeated fighter', () => {
    let session = fight();
    const before = session.save.battle!;
    before.allies[0].agility = before.enemy.agility + 1;
    before.enemy.vitality = 1;
    session = choose(session);
    const won = session.save.battle!;
    expect(won.phase).toBe('won');
    expect(won.playback!.beats.map(beat => beat.side)).toEqual(['ally', 'ally']);
    expect(getBattleBeat(won)?.enemyVitality).toBe(1);
    session = reduceGame(session, { type: 'input', action: 'confirm' });
    expect(getBattleBeat(session.save.battle!)?.enemyVitality).toBe(0);
    expect(session.save.party[0].experience).toBe(0);
    session = reduceGame(session, { type: 'advance' });
    expect(session.save.battle?.phase).toBe('won');
    expect(session.save.battle?.playback).toBeUndefined();
    expect(session.save.party[0].experience).toBe(0);
    session = reduceGame(session, { type: 'advance' });
    expect(session.save.battle).toBeNull();
    expect(session.save.party[0].experience).toBe(20);
  });

  it('resumes at the saved beat, rejects stale automatic/Next events, and commits one seed per turn', () => {
    let session = choose(fight());
    const turn = session.save.battle!.turn;
    expect(choose(session)).toBe(session);
    session = reduceGame(session, { type: 'battle-beat', turn, index: 0 });
    const restored = createSession(migrateSave(JSON.parse(JSON.stringify(session.save)))!);
    expect(restored.save.battle).toEqual(session.save.battle);
    expect(reduceGame(restored, { type: 'battle-beat', turn, index: 0 })).toBe(restored);
    expect(reduceGame(restored, { type: 'battle-beat', turn: turn - 1, index: 1 })).toBe(restored);
    session = reduceGame(restored, { type: 'settings', settings: { battleSpeed: 'fast', reducedMotion: true } });
    expect(session.save.battle).toEqual(restored.save.battle);
    expect(battleBeatDuration(session.save.battle!, 'fast')).toBeLessThan(battleBeatDuration(session.save.battle!, 'normal'));
    while (session.save.battle?.playback) session = reduceGame(session, { type: 'advance' });
    expect(session.save.battle?.seed).toBe(restored.save.battle?.seed);
    expect(choose(session).save.battle?.turn).toBe(turn + 1);
  });

  it('keeps both Wretch impacts separate even with protection', () => {
    const before = createBattle([makeCompanion('rillik')], 'rift-wretch', 'chamber-boss', 123);
    before.turn = 2;
    const resolved = startBattleTurn(before, { type: 'guard' }, {});
    const hits = resolved.playback!.beats.filter(beat => beat.kind === 'impact');
    expect(hits.map(hit => hit.side)).toEqual(['enemy', 'enemy']);
    expect(hits[0].allyVitality[0]).toBeLessThan(before.allies[0].vitality);
    expect(hits[1].allyVitality[0]).toBeLessThan(hits[0].allyVitality[0]);
    expect(hits[1].allyVitality[0]).toBe(resolved.allies[0].vitality);
  });

  it('shows a forced switch only after the outgoing ally falls and never reuses its selected move', () => {
    const before = createBattle([makeCompanion('rillik'), makeCompanion('muddren')], 'gleamwing', 'gleamwing-encounter', 765);
    before.allies[0].vitality = 1;
    before.allies[0].agility = 1;
    const resolved = startBattleTurn(before, attack, {});
    const beats = resolved.playback!.beats;
    expect(beats.map(beat => [beat.side, beat.activeIndex])).toEqual([['enemy', 0], ['enemy', 0], ['field', 1]]);
    expect(beats[1].allyVitality[0]).toBe(0);
    expect(resolved.enemy.vitality).toBe(before.enemy.vitality);
  });

  it('does not spend a turn or start playback when the command is refused', () => {
    const before = fight().save.battle!;
    const invalid = startBattleTurn(before, { type: 'item', itemId: 'tincture' }, { tinctures: 0 });
    expect(invalid.playback).toBeUndefined();
    expect(invalid.turn).toBe(before.turn);
    expect(invalid.seed).toBe(before.seed);
    expect(invalid.log).toEqual(['No tinctures left.']);
  });

  it('plays the offer and acceptance before recording a bond, and does not double-spend a crystal', () => {
    let session = fight();
    session.save.battle!.agitation = 0;
    session = choose(session, { type: 'resonate' });
    expect(session.save.battle!.playback!.beats.map(beat => beat.side)).toEqual(['ally', 'enemy']);
    expect(choose(session, { type: 'resonate' })).toBe(session);
    while (session.save.battle?.playback) session = reduceGame(session, { type: 'advance' });
    expect(session.save.inventory['crystal-bud']).toBe(2);
    expect(session.save.party).toHaveLength(1);
    session = createSession(migrateSave(session.save)!);
    session = reduceGame(session, { type: 'advance' });
    expect(session.save.inventory['crystal-bud']).toBe(1);
    expect(session.save.party).toHaveLength(2);
    session = reduceGame(session, { type: 'advance' });
    expect(session.save.inventory['crystal-bud']).toBe(1);
  });

  it('accepts previous saves without a timeline and validates a persisted cursor and visible vitals', () => {
    const session = fight();
    expect(migrateSave(session.save)?.battle?.playback).toBeUndefined();
    const next = choose(session);
    const bad = JSON.parse(JSON.stringify(next.save));
    bad.battle.playback.index = 11;
    expect(migrateSave(bad)).toBeNull();
    bad.battle.playback.index = 0;
    const final = bad.battle.playback.beats.at(-1);
    final.allyVitality[0] -= 1;
    expect(migrateSave(bad)).toBeNull();
    final.allyVitality[0] += 1;
    bad.battle.playback.beats[0].allyVitality[0] = 999;
    expect(migrateSave(bad)).toBeNull();
  });
});

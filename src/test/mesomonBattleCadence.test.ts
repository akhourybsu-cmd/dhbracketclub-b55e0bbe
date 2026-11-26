import { describe, expect, it } from 'vitest';
import { createBattle, makeCompanion, startBattleTurn } from '@/lib/mesomon/battle';
import { advanceBattleBeat, battleBeatDuration, getBattleBeat, getBattleHitSide } from '@/lib/mesomon/battlePlayback';
import { createNewSave } from '@/lib/mesomon/engine';
import { migrateSave } from '@/lib/mesomon/save';
import type { BattleState, MesomonSettings } from '@/lib/mesomon/types';

function durations(state: BattleState, speed: MesomonSettings['battleSpeed']) {
  const result: number[] = [];
  while (state.playback) {
    result.push(battleBeatDuration(state, speed));
    state = advanceBattleBeat(state, state.turn, state.playback.index);
  }
  return result;
}

describe('Port Marche turn cadence', () => {
  it('returns an ordinary two-attack exchange to commands within three seconds on Normal and two on Fast', () => {
    const battle = startBattleTurn(createBattle([makeCompanion('rillik')], 'tressel'), { type: 'move', moveId: 'brine-snap' }, {});
    expect(battle.playback!.beats.map(beat => beat.kind)).toEqual(['action', 'impact', 'action', 'impact']);
    const normal = durations(battle, 'normal');
    const fast = durations(battle, 'fast');
    expect(normal.reduce((sum, delay) => sum + delay, 0)).toBeLessThanOrEqual(3000);
    expect(fast.reduce((sum, delay) => sum + delay, 0)).toBeLessThanOrEqual(2000);
    expect(fast.every((delay, index) => delay >= 300 && delay < normal[index])).toBe(true);
  });

  it('separates the two pulses and holds the last hit when a fight ends', () => {
    const boss = createBattle([makeCompanion('rillik')], 'rift-wretch', 'chamber-boss');
    boss.turn = 2;
    const turn = startBattleTurn(boss, {type: 'guard'}, {});
    const firstHit = turn.playback!.beats.findIndex(beat => beat.kind === 'impact');
    const times = durations(turn, 'normal');
    expect(times[firstHit]).toBeLessThan(times[firstHit + 1]);
    boss.stability = 1;
    const finishing = startBattleTurn(boss, { type: 'move', moveId: 'resonant-cry' }, {});
    const final = advanceBattleBeat(finishing, finishing.turn, 0);
    expect(getBattleBeat(final)?.stability).toBe(0);
    expect(getBattleHitSide(final)).toBeNull();
    expect(battleBeatDuration(final, 'normal')).toBeGreaterThan(1000);
    expect(battleBeatDuration(final, 'normal', true)).toBe(0);
  });

  it('round-trips authored cues and manual advance, and resumes turns saved before cues existed', () => {
    const save = createNewSave();
    save.party = [makeCompanion('rillik')];
    save.collection = { [save.party[0].id]: save.party[0] };
    save.settings.manualBattle = true;
    save.battle = startBattleTurn(createBattle(save.party, 'tressel'), {type: 'move', moveId: 'brine-snap'}, {});
    const restored = migrateSave(JSON.parse(JSON.stringify(save)))!;
    expect(restored.settings.manualBattle).toBe(true);
    expect(restored.battle?.playback).toEqual(save.battle.playback);
    for (const beat of save.battle.playback!.beats) delete beat.cue;
    delete save.settings.manualBattle;
    expect(migrateSave(save)?.battle?.playback).toEqual(save.battle.playback);
  });
});

import { describe, expect, it } from 'vitest';
import { createBattle, hasIncomingDoublePulse, makeCompanion, resonanceEligibility, resolveBattleTurn, startBattleTurn } from '@/lib/mesomon/battle';
import type { BattleAction, BattleState } from '@/lib/mesomon/types';

const brace = { type: 'guard' } as const;
const veil = { type: 'move', moveId: 'tidal-veil' } as const;
const shell = { type: 'move', moveId: 'mud-wrap' } as const;
const dodge = { type: 'move', moveId: 'reedstep' } as const;
const cry = { type: 'move', moveId: 'resonant-cry' } as const;
const attack = { type: 'move', moveId: 'brine-snap' } as const;

function enemyHits(battle: BattleState, action: BattleAction) {
  const result = startBattleTurn(battle, action, {});
  const hits = result.playback!.beats.filter(beat => beat.side === 'enemy' && beat.kind === 'impact');
  return hits.map((hit, index) =>
    (index === 0 ? battle.allies[0].vitality : hits[index - 1].allyVitality[0]) - hit.allyVitality[0],
  );
}

describe('defense, observation and nonviolent encounters', () => {
  it('makes Mud Wrap the strongest single-hit shield and Veil the best cover across two hits', () => {
    const before = createBattle([makeCompanion('muddren')], 'rift-wretch', 'chamber-boss', 4493);
    // An unusually strong opponent makes the different reductions observable even after rounding.
    before.enemy.power = 28;
    expect(enemyHits(before, shell)[0]).toBeLessThan(enemyHits(before, veil)[0]);
    expect(enemyHits(before, veil)[0]).toBeLessThan(enemyHits(before, brace)[0]);
    before.turn = 2;
    const shellHits = enemyHits(before, shell), veilHits = enemyHits(before, veil);
    expect(shellHits).toHaveLength(2);
    expect(shellHits[1]).toBeGreaterThan(shellHits[0]);
    expect(veilHits[1]).toBe(veilHits[0]);
    expect(veilHits[0] + veilHits[1]).toBeLessThan(shellHits[0] + shellHits[1]);
    for (const action of [veil, shell]) {
      expect(resolveBattleTurn({ ...before, mudbound: 2 }, action).mudbound).toBe(0);
    }
  });

  it('uses the same pulse clock for the warning and both hits, and only rebounds a pulse the companion holds', () => {
    const before = createBattle([makeCompanion('muddren')], 'rift-wretch', 'chamber-boss', 17);
    const wild = createBattle([makeCompanion('muddren')], 'tressel');
    for (let turn = 0; turn < 9; turn++) {
      const choosing = { ...before, turn };
      expect(hasIncomingDoublePulse({ ...wild, turn })).toBe(false);
      expect(enemyHits(choosing, brace)).toHaveLength(hasIncomingDoublePulse(choosing) ? 2 : 1);
      const expected = (turn + 1) % 3 === 0 ? before.stability - 8 : before.stability;
      expect(resolveBattleTurn(choosing, brace).stability).toBe(expected);
      expect(resolveBattleTurn(choosing, veil).stability).toBe(expected);
      expect(resolveBattleTurn(choosing, shell).stability).toBe(before.stability);
    }
    const last = startBattleTurn({ ...before, turn: 2, stability: 3 }, brace, {});
    expect(last).toMatchObject({ phase: 'won', stability: 0 });
    expect(last.playback!.beats.at(-1)).toMatchObject({ side: 'field', cue: 'rift-lash', stability: 0, enemyVitality: 0 });
    const exhausted = { ...before, turn: 2, allies: [{ ...before.allies[0], vitality: 1 }] };
    expect(resolveBattleTurn(exhausted, brace)).toMatchObject({ phase: 'lost', stability: before.stability });
  });

  it('lets a clean dodge settle a wild encounter and avoid contact mud, with no benefit on a miss', () => {
    const before = createBattle([makeCompanion('rillik')], 'muddren', 'passage-encounter', 34);
    const outcomes = new Set<boolean>();
    for (let i = 1; i <= 32; i++) {
      const next = startBattleTurn({ ...before, seed: i * 1000003, turn: 1 }, dodge, {});
      const dodged = next.playback!.beats.some(beat => beat.cue === 'dodge');
      outcomes.add(dodged);
      expect(next.agitation).toBe(dodged ? before.agitation - 13 : before.agitation);
      expect(next.mudbound).toBe(dodged ? 0 : 2);
      expect(next.allies[0].vitality === before.allies[0].vitality).toBe(dodged);
    }
    expect(outcomes.size).toBe(2);
  });

  it('makes a calm creature stand down without a free attack or dependence on carrying a crystal', () => {
    const before = createBattle([makeCompanion('rillik')], 'tressel');
    const firstCry = resolveBattleTurn(before, cry);
    expect(firstCry.allies[0].vitality).toBeLessThan(before.allies[0].vitality);
    const settled = startBattleTurn(firstCry, cry, { emptyBuds: 0 });
    expect(settled.allies[0].vitality).toBe(firstCry.allies[0].vitality);
    expect(settled.playback!.beats.at(-1)).toMatchObject({ side: 'enemy', kind: 'notice', cue: 'resonant-cry' });
    expect(resonanceEligibility(settled, 0).eligible).toBe(false);
    expect(resonanceEligibility(settled, 1).eligible).toBe(true);
    expect(resolveBattleTurn({ ...firstCry, frenzy: true }, cry).allies[0].vitality).toBeLessThan(firstCry.allies[0].vitality);
    const stillFrightened = resolveBattleTurn(before, attack);
    expect(stillFrightened.agitation).toBe(before.agitation);
    let passive = before;
    while (passive.phase === 'choosing' && passive.turn < 60) passive = resolveBattleTurn(passive, brace);
    expect(passive.phase).toBe('lost');
    expect(passive.agitation).toBe(before.agitation);
  });

  it('records the real healing amount before the counterattack and sends the switched-in ally into danger', () => {
    const before = createBattle([makeCompanion('rillik'), makeCompanion('gleamwing')], 'tressel');
    before.allies[0].vitality -= 3;
    const healed = startBattleTurn(before, { type: 'item', itemId: 'tincture' }, { tinctures: 1 });
    const [use, gain] = healed.playback!.beats;
    expect(use).toMatchObject({ side: 'ally', kind: 'action', cue: 'tincture', allyVitality: [before.allies[0].vitality, before.allies[1].vitality] });
    expect(gain).toMatchObject({ kind: 'impact', cue: 'tincture', allyVitality: [before.allies[0].maxVitality, before.allies[1].vitality] });
    expect(healed.usedTinctures).toBe(1);
    const switched = startBattleTurn(before, { type: 'switch', index: 1 }, {});
    expect(switched.playback!.beats[0]).toMatchObject({ kind: 'notice', cue: 'switch', activeIndex: 1 });
    expect(switched.allies[0].vitality).toBe(before.allies[0].vitality);
    expect(switched.allies[1].vitality).toBeLessThan(before.allies[1].vitality);
  });
});

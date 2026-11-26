import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import type { BattleBeat, BattleCue } from '../types';
import { createBattle, makeCompanion, startBattleTurn } from '../battle';
import { impactDefense, paintBattleEffect } from './battleEffects';
import { battleOpacity, battlePose, fighterMotion } from './battleMotion';

function frame(side: BattleBeat['side'], kind: BattleBeat['kind'], cue?: BattleCue): BattleBeat {
  return { side, kind, cue, text: 'Turn', activeIndex: 0, allyVitality: [30], enemyVitality: 30, agitation: 30, stability: 0 };
}

function render(beat: BattleBeat, elapsed = 180, reduced = false, second = false) {
  const strokes: { shape: string; color: number; alpha: number; args: number[] }[] = [];
  let color = 0, alpha = 1;
  const trace = {
    lineStyle(_width: number, nextColor: number, nextAlpha = 1) {
      color = nextColor; alpha = nextAlpha; return trace;
    },
    fillStyle(nextColor: number, nextAlpha = 1) {
      color = nextColor; alpha = nextAlpha; return trace;
    },
    lineBetween(...args: number[]) { strokes.push({ shape: 'line', color, alpha, args }); return trace; },
    strokeEllipse(...args: number[]) { strokes.push({ shape: 'oval', color, alpha, args }); return trace; },
    fillTriangle(...args: number[]) { strokes.push({ shape: 'triangle', color, alpha, args }); return trace; },
    fillCircle(...args: number[]) { strokes.push({ shape: 'disc', color, alpha, args }); return trace; },
    fillEllipse(...args: number[]) { strokes.push({ shape: 'fill-oval', color, alpha, args }); return trace; },
    fillRect(...args: number[]) { strokes.push({ shape: 'rectangle', color, alpha, args }); return trace; },
  };
  paintBattleEffect(trace as unknown as Phaser.GameObjects.Graphics, beat, elapsed, reduced, second);
  return strokes;
}

describe('Port Marche battle choreography', () => {
  it('sends water from its caster toward the other ledge and splashes at that ledge only on impact', () => {
    for (const side of ['ally', 'enemy'] as const) {
      const forward = side === 'ally' ? 1 : -1;
      const action = frame(side, 'action', 'brine-snap');
      const first = render(action, 0).find(stroke => stroke.shape === 'disc')!;
      const late = render(action, 260).find(stroke => stroke.shape === 'disc')!;
      expect((late.args[0] - first.args[0]) * forward).toBeGreaterThan(30);
      const splash = render(frame(side, 'impact', 'brine-snap'));
      expect(splash.filter(stroke => stroke.shape === 'disc')).toHaveLength(3);
      for (const stroke of splash) expect(side === 'ally' ? stroke.args[0] > 80 : stroke.args[0] < 80).toBe(true);
    }
  });

  it('uses different silhouettes for the ten moves and a bounded number of primitives per frame', () => {
    const cues: BattleCue[] = ['brine-snap', 'splinter-swipe', 'quick-tackle', 'bank-break', 'rift-lash', 'lantern-dust', 'resonant-cry', 'tidal-veil', 'mud-wrap', 'reedstep'];
    const shapes = cues.map(cue => render(frame('ally', 'action', cue)));
    expect(new Set(shapes.map(strokes => JSON.stringify(strokes))).size).toBe(cues.length);
    for (const strokes of shapes) {
      expect(strokes.length).toBeGreaterThan(0);
      expect(strokes.length).toBeLessThanOrEqual(12);
      expect(strokes.every(stroke => stroke.args.every(Number.isFinite))).toBe(true);
    }
    expect(shapes[cues.indexOf('resonant-cry')].map(stroke => stroke.shape)).toEqual(['oval', 'oval', 'oval']);
    expect(shapes[cues.indexOf('bank-break')].filter(stroke => stroke.shape === 'triangle')).toHaveLength(3);
  });

  it('anchors a tincture, brace, substitution and mud to the correct fighter', () => {
    for (const cue of ['guard', 'tidal-veil', 'tincture', 'reedstep', 'mud-wrap'] as const) {
      const support = frame('ally', 'notice', cue);
      expect(render(support).every(stroke => stroke.args[0] < 80)).toBe(true);
      expect(fighterMotion('enemy', support, null)).toBe('ready');
    }
    for (const cue of ['switch', 'mudbound', 'flee'] as const) {
      expect(render(frame('field', 'notice', cue)).every(stroke => stroke.args[0] < 80)).toBe(true);
    }
    expect(fighterMotion('ally', frame('field', 'notice', 'switch'), null)).toBe('arrive');
    expect(fighterMotion('ally', frame('field', 'notice', 'flee'), null)).toBe('withdraw');
    expect(fighterMotion('enemy', frame('ally', 'notice', 'switch'), null)).toBe('ready');
    expect(render(frame('enemy', 'notice', 'resonate')).every(stroke => stroke.args[0] > 80)).toBe(true);
  });

  it('visibly intercepts both pulses with Veil or Brace, and just the first with Mud Wrap', () => {
    const battle = createBattle([makeCompanion('rillik')], 'rift-wretch', 'chamber-boss');
    for (const shield of ['tidal-veil', 'guard', 'mud-wrap'] as const) {
      const stance = frame('ally', 'notice', shield);
      const beats = [stance, frame('enemy', 'action', 'rift-lash'), frame('enemy', 'impact', 'rift-lash'), frame('enemy', 'impact', 'rift-lash')];
      expect(impactDefense({ ...battle, playback: { beats, index: 2 } }, 'ally')).toBe(stance);
      expect(impactDefense({ ...battle, playback: { beats, index: 3 } }, 'ally')).toBe(shield === 'mud-wrap' ? null : stance);
      expect(impactDefense({ ...battle, playback: { beats, index: 2 } }, null)).toBeNull();
    }
  });

  it('shows the bottle at the ally and recovery marks there when the committed HP increases', () => {
    const battle = createBattle([makeCompanion('rillik')], 'muddren', 'passage-encounter');
    battle.allies[0].vitality = 4;
    const beats = startBattleTurn(battle, { type: 'item', itemId: 'tincture' }, { tinctures: 1 }).playback!.beats.filter(beat => beat.cue === 'tincture');
    expect(beats.map(beat => beat.kind)).toEqual(['action', 'impact']);
    expect(beats[1].allyVitality[0]).toBeGreaterThan(beats[0].allyVitality[0]);
    expect(beats[1].enemyVitality).toBe(beats[0].enemyVitality);
    for (const reduced of [true, false]) {
      const [bottle, recovery] = beats.map(beat => render(beat, 190, reduced));
      expect(bottle.some(stroke => stroke.shape === 'fill-oval')).toBe(true);
      expect(recovery.map(stroke => stroke.shape)).toEqual(Array(6).fill('line'));
      for (const stroke of [...bottle, ...recovery]) expect(stroke.args[0]).toBeLessThan(80);
    }
    for (const beat of beats) {
      expect(fighterMotion('ally', beat, null)).toBe('ready');
      expect(fighterMotion('enemy', beat, null)).toBe('ready');
    }
  });

  it('renders the return pulse separately, the Wretch’s backlash on its own ledge and a dodge on the evader', () => {
    const hit = frame('enemy', 'impact', 'rift-lash');
    expect(render(hit, 100, false, true)).not.toEqual(render(hit, 100, false, false));
    expect(render(frame('field', 'notice', 'rift-lash')).every(stroke => stroke.args[0] > 80)).toBe(true);
    const dodge = frame('enemy', 'impact', 'dodge');
    expect(render(dodge).every(stroke => stroke.args[0] < 80)).toBe(true);
    expect(fighterMotion('ally', dodge, null)).toBe('dodge');
    expect(fighterMotion('enemy', dodge, null)).toBe('ready');
    expect(fighterMotion('ally', hit, 'ally')).toBe('hit');
  });

  it('lets a creature sing without performing a contact lunge and preserves legacy beats', () => {
    const song = frame('ally', 'action', 'resonant-cry');
    const cue = fighterMotion('ally', song, null);
    expect(cue).toBe('cast');
    expect(battlePose('ally', cue, 110, false)).toEqual({ x: 45, y: 98, spark: false, cel: 'action' });
    expect(fighterMotion('enemy', frame('ally', 'impact', 'resonant-cry'), null)).toBe('ready');
    const settles = frame('enemy', 'notice', 'resonant-cry');
    expect(fighterMotion('enemy', settles, null)).toBe('ready');
    expect(render(settles).every(stroke => stroke.args[0] > 80)).toBe(true);
    const old = frame('enemy', 'action');
    expect(render(old)).toEqual([]);
    expect(fighterMotion('enemy', old, null)).toBe('act');
  });

  it('uses static geometry with reduced motion and preserves the hit before a knockout fades', () => {
    const beat = frame('enemy', 'action', 'rift-lash');
    expect(render(beat, 0, true)).toEqual(render(beat, 3000, true));
    expect(render(beat, 500)).toEqual(render(beat, 3000));
    for (const cue of ['cast', 'brace', 'arrive', 'dodge', 'withdraw'] as const) {
      expect(battlePose('enemy', cue, 0, true)).toEqual(battlePose('enemy', cue, 999, true));
      expect(battlePose('enemy', cue, 0, true)).toMatchObject({ x: 116, y: 67, spark: false });
    }
    expect(battleOpacity(false, true, 60, false)).toBe(1);
    expect(battleOpacity(false, true, 170, false)).toBeLessThan(1);
    expect(battleOpacity(false, true, 300, false)).toBeCloseTo(0.35);
    expect(battleOpacity(false, true, 0, true)).toBe(0.35);
    expect(battleOpacity(true, false, 200, false)).toBe(1);
  });
});

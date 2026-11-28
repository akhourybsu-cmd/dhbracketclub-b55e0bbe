import { describe, expect, it } from 'vitest';
import { createRun, INPUT, killPoints, MAX_TICKS, stepRun, summarize, type Enemy, type RunState } from '../../supabase/functions/_shared/arcade/riftwatch';
import { beginWave } from '../../supabase/functions/_shared/arcade/formations';
import { CHAIN_TICKS, MAX_REPLAY_EVENTS, RIFTWATCH_RULESET } from '../../supabase/functions/_shared/arcade/rules';
import { decodeReplay, recordInput, verifyReplay, type ReplayEvent } from '../../supabase/functions/_shared/arcade/replay';

function run(seed: string, frameRate: number) {
  const s = createRun(seed);
  const input: ReplayEvent[] = [];
  let debt = 0, maximumBullets = 0;
  while (s.phase !== 'over') {
    // Exact rational frame clock. 30 Hz renders two 60 Hz steps; 144 Hz sometimes renders none.
    debt += 60;
    while (debt >= frameRate && !s.reason) {
      debt -= frameRate;
      const mask = INPUT.fire | (s.tick % 180 < 90 ? INPUT.left : INPUT.right) | (s.tick % 360 === 0 ? INPUT.pulse : 0);
      expect(recordInput(input, s.tick, mask)).toBe(true);
      stepRun(s, mask);
      maximumBullets = Math.max(maximumBullets, s.projectiles.length);
    }
  }
  return { summary: summarize(s), input, maximumBullets, reason: s.reason };
}

function isolate(s: RunState, enemies: Enemy[]) {
  s.enemies = enemies;
  s.population = enemies.length;
  s.nextShot = s.waveLimit;
  s.nextStep = s.waveLimit;
  s.nextDive = s.waveLimit;
  s.projectiles = [];
  s.warnings = [];
}
function playerShot(s: RunState, e: Enemy, dx = 0) {
  s.projectiles.push({ id: s.nextId++, kind: 'player', x: e.x + dx, y: e.y, vx: 0, vy: 0 });
  stepRun(s, 0);
}
function enemyShot(s: RunState, x: number, y: number) {
  s.projectiles.push({ id: s.nextId++, kind: 'shard', x, y, vx: 0, vy: 0 });
}
function anchorWave() {
  const s = createRun('moon');
  s.wave = 4;
  beginWave(s);
  const anchor = s.enemies.find(e => e.kind === 'anchor')!;
  isolate(s, [anchor]);
  return { s, anchor };
}

describe('Riftwatch launch rules', () => {
  it('plays and verifies the same terminal run under different render cadences', () => {
    const a = run('wet slate', 30);
    const b = run('wet slate', 144);
    expect(a).toEqual(b);
    // Published replay fixture for riftwatch-1.0.0. A balance change requires a new ruleset.
    expect(a.summary).toEqual({ score: 1842, wave: 3, kills: 37, simulationTicks: 10985 });
    expect(a.maximumBullets).toBeLessThanOrEqual(18);
    expect(verifyReplay('wet slate', a.input, a.summary)).toEqual(a.summary);
    expect(() => verifyReplay('other coast', a.input, a.summary)).toThrow();
    expect(() => verifyReplay('wet slate', a.input, { ...a.summary, score: a.summary.score + 10 })).toThrow('summary_mismatch');
  });
  it('has a reproducible empty replay and keeps completed runs immutable', () => {
    const s = createRun('locked harbor');
    while (s.phase !== 'over') stepRun(s, 0);
    const expected = { score: 0, wave: 1, kills: 0, simulationTicks: s.tick };
    expect(s.tick).toBeGreaterThan(3000);
    expect(s.reason).toBe('line');
    expect(verifyReplay('locked harbor', [], expected)).toEqual(expected);
    const snapshot = JSON.stringify(s);
    stepRun(s, INPUT.fire);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
  it('pays a finite enemy once and rounds 12.5 points up only on the base bounty', () => {
    const s = createRun('quay');
    const [a, b, c] = s.enemies;
    isolate(s, [a, b, c]);
    playerShot(s, a); playerShot(s, b);
    expect([s.score, s.kills, s.chain]).toEqual([23, 2, 2]);
    playerShot(s, b);
    expect([s.score, s.kills]).toEqual([23, 2]);
    expect(killPoints('herald', 4, 1)).toBe(61);
    expect(killPoints('diver', 9, 1)).toBe(100);
    expect(killPoints('anchor', 5, 10)).toBe(1500);
  });
  it('holds the chain for the inclusive 2.25-second window, even if a shot misses', () => {
    const s = createRun('quay');
    const [a, b, c] = s.enemies;
    isolate(s, [a, b, c]);
    playerShot(s, a);
    while (s.tick < CHAIN_TICKS) stepRun(s, s.tick % 2 ? INPUT.fire : 0);
    playerShot(s, b);
    expect(s.chain).toBe(2);
    while (s.tick <= s.lastKill + CHAIN_TICKS + 1) stepRun(s, 0);
    expect(s.chain).toBe(0);
  });
  it('changes direction immediately, has no drift, limits held fire and releases pulse only on a press', () => {
    const s = createRun('coast');
    stepRun(s, INPUT.left); const x = s.playerX;
    stepRun(s, 0); expect(s.playerX).toBe(x);
    stepRun(s, INPUT.right); expect(s.playerX).toBe(80);
    s.wards = [];
    for (let i = 0; i < 8; i++) stepRun(s, INPUT.fire);
    expect(s.projectiles.filter(p => p.kind === 'player')).toHaveLength(1);
    enemyShot(s, s.playerX + 2, s.playerY - 12); enemyShot(s, 12, 30);
    s.pulse = 100;
    const before = s.score;
    stepRun(s, INPUT.pulse);
    expect(s.projectiles.filter(p => p.kind === 'shard')).toHaveLength(1);
    expect(s.projectiles.find(p => p.kind === 'shard')?.x).toBe(12);
    expect(s.enemies).toHaveLength(s.population);
    expect(s.pulse).toBe(0);
    expect(s.score).toBe(before);
    s.pulse = 100;
    stepRun(s, INPUT.pulse);
    expect(s.pulse).toBe(100);
  });
  it('telegraphs dive lanes then freezes a departing Diver briefly on Pulse', () => {
    const s = createRun('watch');
    s.wave = 3; beginWave(s);
    const diver = s.enemies.find(e => e.kind === 'diver')!;
    s.nextDive = 1;
    stepRun(s, 0);
    expect(diver.tellUntil - s.tick).toBeGreaterThan(30);
    expect(diver.diveTargetX).toBe(s.playerX);
    while (diver.diveStart < 0) stepRun(s, INPUT.right);
    for (let i = 0; i < 24; i++)stepRun(s, 0);
    const { x, y } = diver;
    s.pulse = 100;
    for (let i = 0; i < 30; i++)stepRun(s, INPUT.pulse);
    expect([diver.x, diver.y]).toEqual([x, y]);
    for (let i = 0; i < 30; i++)stepRun(s, 0);
    expect(diver.y).toBeGreaterThan(y);
  });
  it('specific wards absorb both kinds of fire and persist between ordinary waves', () => {
    const s = createRun('dock');
    const ward = s.wards[0];
    const healthy = s.wards.filter(c => c.hp === 2).length;
    enemyShot(s, ward.x, ward.y); stepRun(s, 0);
    expect(ward.hp).toBe(1);
    s.projectiles.push({ id: s.nextId++, kind: 'player', x: ward.x, y: ward.y, vx: 0, vy: 0 });
    stepRun(s, 0);
    expect(ward.hp).toBe(0);
    expect(s.wards.filter(c => c.hp === 2)).toHaveLength(healthy - 1);
    beginWave(s);
    expect(ward.hp).toBe(0);
  });
  it('pays wave, perfect and ward totals once and fire can shorten the tally', () => {
    const s = createRun('quay'), [e] = s.enemies;
    const intact = s.wards.length;
    isolate(s, [e]);
    s.wards[0].hp = 0;
    playerShot(s, e);
    expect(s.phase).toBe('tally');
    expect(s.waveBonus).toEqual({ clear: 200, perfect: 150, wards: (intact - 1) * 5 });
    expect(s.score).toBe(360 + (intact - 1) * 5);
    expect(s.chain).toBe(0);
    const saved = s.score;
    for (let i = 0; i < 12; i++)stepRun(s, INPUT.fire);
    expect([s.phase, s.wave, s.score]).toEqual(['play', 2, saved]);
  });
  it('charges on kills and over time, observes damage immunity and removes the perfect bonus', () => {
    const s = createRun('quay');
    const [a, b] = s.enemies; isolate(s, [a, b]);
    for (let i = 0; i < 36; i++)stepRun(s, 0);
    expect(s.pulse).toBe(1);
    playerShot(s, a);
    expect(s.pulse).toBe(7);
    enemyShot(s, s.playerX, s.playerY); stepRun(s, 0);
    expect([s.integrity, s.chain]).toEqual([2, 0]);
    enemyShot(s, s.playerX, s.playerY); stepRun(s, 0);
    expect(s.integrity).toBe(2);
    playerShot(s, b); expect(s.waveBonus.perfect).toBe(0);
  });
  it('signals every hostile launch ahead of time, from above the ward line', () => {
    const s = createRun('sliver');
    for (let i = 0; i < 5; i++)beginWave(s);
    const tells = new Map<number, { x: number; y: number }[]>();
    for (let i = 0; i < 1200; i++) {
      for (const w of s.warnings) {
        const list = tells.get(w.fireTick) ?? []; list.push({ x: w.x, y: w.y }); tells.set(w.fireTick, list);
      }
      const tick = s.tick;
      stepRun(s, 0);
      for (const event of s.events.filter(e => e.kind === 'enemy-fire')) {
        expect(tells.get(tick)).toContainEqual({ x: event.x, y: event.y });
        expect(event.y).toBeLessThan(118);
      }
    }
    expect(tells.size).toBeGreaterThan(5);
  });
  it('requires both anchor nodes before the core can score and repairs a bounded group of ward cells', () => {
    const { s, anchor } = anchorWave();
    s.wards.forEach(c => c.hp = 0);
    playerShot(s, anchor);
    expect(anchor.hp).toBe(anchor.maxHp);
    expect(s.score).toBe(0);
    for (const side of [-1, 1]) {
      const ix = side === -1 ? 0 : 1;
      while (anchor.nodes[ix]) playerShot(s, anchor, side * 9);
    }
    while (anchor.hp) playerShot(s, anchor);
    expect(s.kills).toBe(1);
    expect(s.score).toBe(750 + 1000 + 750);
    expect(s.wards.filter(c => c.hp === 1)).toHaveLength(12);
    expect(s.phase).toBe('tally');
  });
  it('rejects stale inputs, unsupported masks, nonterminal, oversized and post-terminal streams', () => {
    const s = createRun('harbor');
    while (s.phase !== 'over') stepRun(s, 0);
    const summary = summarize(s);
    for (const events of [null, [[1, 0]], [[0, 16]], [[-1, 1]], [[1.4, 2]], [[3, 1], [1, 2]],
      [[0, 1], [0, 2]], [[1, 1], [3, 1]], [[0, 1, 2]], [[summary.simulationTicks, 1]],
      Array(MAX_REPLAY_EVENTS + 1).fill([1, 2])]) {
      expect(() => verifyReplay('harbor', events, summary)).toThrow('invalid_replay');
    }
    expect(() => verifyReplay('harbor', [], { ...summary, simulationTicks: 30 })).toThrow('nonterminal_replay');
    expect(() => verifyReplay('harbor', [], { ...summary, simulationTicks: summary.simulationTicks + 5 })).toThrow('nonterminal_replay');
    expect(() => verifyReplay('harbor', [], { ...summary, simulationTicks: MAX_TICKS + 1 })).toThrow('invalid_summary');
    expect(() => verifyReplay('harbor', [], { ...summary, kills: -1 })).toThrow('invalid_summary');
    expect(() => verifyReplay('harbor', [], { ...summary, score: NaN })).toThrow('invalid_summary');
    expect(RIFTWATCH_RULESET).toBe('riftwatch-1.0.0');
  });
  it('records simultaneous input without redundant masks and detects a full input log', () => {
    const events: ReplayEvent[] = [];
    for (let i = 0; i < 8; i++)recordInput(events, i, i < 2 ? 0 : i < 5 ? 5 : 0);
    expect(events).toEqual([[2, 5], [5, 0]]);
    expect(decodeReplay(events, 8)).toBe(events);
    const full = Array<ReplayEvent>(MAX_REPLAY_EVENTS).fill([0, 1]);
    expect(recordInput(full, 25, 2)).toBe(false);
  });
  it('finishes by breach at the hard cap, by breach at the wave ceiling, or by integrity loss', () => {
    const s = createRun('storm');
    s.tick = MAX_TICKS - 1; stepRun(s, 0);
    expect([s.reason, s.tick]).toEqual(['line', MAX_TICKS]);
    expect(s.enemies.some(enemy => enemy.y >= 126)).toBe(true);
    const lastTally = createRun('arriving front');
    lastTally.phase = 'tally'; lastTally.tick = MAX_TICKS - 1; stepRun(lastTally, 0);
    expect([lastTally.reason, lastTally.tick]).toEqual(['line', MAX_TICKS]);
    const t = createRun('low'); t.waveTick = t.waveLimit;
    for (let i = 0; i < 80; i++)stepRun(t, 0);
    expect(t.reason).toBe('line');
    const u = createRun('hit'); u.integrity = 1;
    enemyShot(u, u.playerX, u.playerY); stepRun(u, 0);
    expect(u.reason).toBe('integrity');
  });
  it('teaches the roster in order, scales fifth-wave nodes and bounds deep formations and cadence', () => {
    const s = createRun('waves');
    for (let wave = 1; wave <= 100; wave++) {
      const kinds = s.enemies.map(e => e.kind);
      expect(kinds.length).toBeLessThanOrEqual(26);
      expect(s.shotInterval).toBeGreaterThanOrEqual(38);
      expect(s.stepInterval).toBeGreaterThanOrEqual(7);
      expect(kinds.includes('anchor')).toBe(wave % 5 === 0);
      if (wave < 3) expect(kinds).not.toContain('sliver');
      if (wave < 4) expect(kinds).not.toContain('diver');
      if (wave === 3) expect(kinds).toContain('sliver');
      if (wave === 4) expect(kinds.filter(k => k === 'diver')).toHaveLength(1);
      if (wave === 10) expect(s.enemies.find(e => e.kind === 'anchor')?.nodes[0]).toBe(3);
      beginWave(s);
    }
  });
});

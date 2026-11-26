import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MesomonAudio } from '../audio';
import { createBattle, makeCompanion } from '../battle';
import type { BattleBeat, BattleState, MesomonSettings } from '../types';

class FakeGain {
  gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn(); disconnect = vi.fn();
}
class FakeOscillator {
  type = 'sine'; frequency = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }; onended: (() => void) | null = null;
  connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
}
class FakeContext {
  static instances: FakeContext[] = [];
  sampleRate = 22050; currentTime = 10; state = 'suspended'; destination = {}; gains: FakeGain[] = []; oscillators: FakeOscillator[] = [];
  constructor() { FakeContext.instances.push(this); }
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { return { buffer: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }; }
  createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createOscillator() { const oscillator = new FakeOscillator(); this.oscillators.push(oscillator); return oscillator; }
}
const settings: MesomonSettings = { mute: false, musicVolume: 0.4, ambientVolume: 0.6, textSpeed: 'normal', battleSpeed: 'normal', reducedMotion: false, haptics: false, sealAssist: false };

function playback(...frames: Array<Pick<BattleBeat, 'kind' | 'cue'> & { damage?: number }>): BattleState {
  const battle = createBattle([makeCompanion('rillik', 'rillik-first')], 'tressel', 'passage-encounter', 1357);
  const beats: BattleBeat[] = frames.map(({ kind, cue, damage = 0 }) => ({
    side: 'ally', kind, cue, text: '', activeIndex: 0, allyVitality: [battle.allies[0].vitality],
    enemyVitality: battle.enemy.vitality - damage, agitation: battle.agitation, stability: battle.stability,
  }));
  return { ...battle, turn: 1, playback: { index: 0, beats } };
}

describe('Mesomon presentation audio lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers(); FakeContext.instances = []; vi.stubGlobal('AudioContext', FakeContext); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('never creates an audio context or timer until a user explicitly unlocks it', () => {
    const audio = new MesomonAudio(); audio.setScene('chamber'); audio.setSettings(settings); audio.cue('bond');
    expect(FakeContext.instances).toHaveLength(0); expect(vi.getTimerCount()).toBe(0); audio.destroy();
  });
  it('honors independent scene buses and mute before the first gesture', async () => {
    const audio = new MesomonAudio(); audio.setSettings({ ...settings, mute: true }); await audio.unlock();
    const context = FakeContext.instances[0];
    expect(context.oscillators).toHaveLength(0); expect(context.gains.map(g => g.gain.value)).toEqual([0, 0, 0]);
    audio.setSettings(settings);
    expect(context.gains[0].gain.value).toBeCloseTo(0.4 * 0.065); expect(context.gains[1].gain.value).toBeCloseTo(0.6 * 0.04);
    audio.destroy();
  });
  it('bounds simultaneous effect voices and clears scheduled work on pause and exit', async () => {
    const audio = new MesomonAudio(); await audio.unlock(); const context = FakeContext.instances[0];
    for (let i = 0; i < 100; i++) audio.cue('bond');
    expect(context.oscillators.length).toBeLessThanOrEqual(13);
    audio.pause(true); expect(vi.getTimerCount()).toBe(0); expect(context.oscillators.every(o => o.stop.mock.calls.length > 0)).toBe(true);
    audio.pause(false); expect(vi.getTimerCount()).toBe(1);
    audio.destroy(); expect(vi.getTimerCount()).toBe(0); expect(context.close).toHaveBeenCalledOnce();
    const count = context.oscillators.length; await audio.unlock(); audio.cue('confirm'); expect(context.oscillators).toHaveLength(count);
  });
  it('sounds a move once, then gives the loss of HP its own impact', async () => {
    const audio = new MesomonAudio();
    audio.setScene('battle');
    audio.setSettings({ ...settings, mute: true });
    await audio.unlock();
    audio.setSettings(settings);
    const ctx = FakeContext.instances[0];
    const battle = playback({ kind: 'action', cue: 'brine-snap' }, { kind: 'impact', cue: 'brine-snap', damage: 6 });
    audio.battleBeat(battle);
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledOnce();
    audio.battleBeat({ ...battle });
    expect(ctx.oscillators).toHaveLength(2);
    battle.playback!.index = 1;
    audio.battleBeat(battle);
    expect(ctx.oscillators.slice(2).map(osc => osc.type)).toEqual(['square', 'triangle']);
    audio.battleBeat(battle);
    expect(ctx.oscillators).toHaveLength(4);
    audio.destroy();
  });

  it('plays dodge and calming resolutions without inventing a physical hit', async () => {
    const audio = new MesomonAudio();
    audio.setSettings({ ...settings, mute: true });
    await audio.unlock();
    audio.setSettings(settings);
    const battle = playback({ kind: 'notice', cue: 'guard' }, { kind: 'impact', cue: 'dodge' },
      { kind: 'impact', cue: 'resonant-cry' }, { kind: 'impact' });
    const ctx = FakeContext.instances[0];
    for (let i = 0; i < battle.playback!.beats.length; i++) {
      battle.playback!.index = i;
      audio.battleBeat(battle);
    }
    expect(ctx.oscillators.map(osc => osc.type)).toEqual(['square', 'sine', 'sine']);
    expect(ctx.oscillators[1].frequency.exponentialRampToValueAtTime.mock.calls[0][0])
      .toBeGreaterThan(ctx.oscillators[1].frequency.setValueAtTime.mock.calls[0][0]);
    audio.destroy();
  });

  it('uses changes in saved HP for older fights without move cues', async () => {
    const audio = new MesomonAudio();
    audio.setSettings({ ...settings, mute: true }); await audio.unlock(); audio.setSettings(settings);
    const battle = playback({ kind: 'action' }, { kind: 'impact', damage: 4 });
    const context = FakeContext.instances[0];
    audio.battleBeat(battle);
    expect(context.oscillators).toHaveLength(0);
    battle.playback!.index = 1;
    audio.battleBeat(battle);
    expect(context.oscillators.map(osc => osc.type)).toEqual(['square', 'triangle']);
    audio.setSettings({ ...settings, mute: true });
    expect(context.oscillators.every(osc => osc.disconnect.mock.calls.length > 0)).toBe(true);
    audio.destroy();
  });

  it('reserves the crystal chime for contact and pairs a tincture with a recovery sound', async () => {
    const audio = new MesomonAudio();
    audio.setSettings({ ...settings, mute: true }); await audio.unlock(); audio.setSettings(settings);
    const battle = playback({ kind: 'notice', cue: 'resonate' }, { kind: 'notice', cue: 'resonate' },
      { kind: 'action', cue: 'tincture' }, { kind: 'impact', cue: 'tincture' });
    const { beats } = battle.playback!;
    beats[1].side = 'enemy';
    const context = FakeContext.instances[0];
    const counts = beats.map((_, index) => {
      battle.playback!.index = index;
      audio.battleBeat(battle);
      return context.oscillators.length;
    });
    expect(counts).toEqual([0, 2, 3, 5]);
    expect(context.oscillators[2].type).toBe('triangle');
    expect(context.oscillators[3].type).toBe('sine');
    audio.destroy();
  });

  it('keeps quiet during mute and pause and never replays a missed cue on resume', async () => {
    const audio = new MesomonAudio(), battle = playback({ kind: 'action', cue: 'quick-tackle' }, { kind: 'notice', cue: 'tincture' });
    audio.setSettings({ ...settings, mute: true });
    await audio.unlock();
    audio.battleBeat(battle);
    const ctx = FakeContext.instances[0];
    audio.setSettings(settings); audio.battleBeat(battle);
    expect(ctx.oscillators).toHaveLength(0);
    audio.pause(true); battle.playback!.index = 1; audio.battleBeat(battle);
    expect(ctx.oscillators).toHaveLength(0);
    audio.pause(false);
    const scoreVoices = ctx.oscillators.length;
    audio.battleBeat(battle);
    expect(ctx.oscillators).toHaveLength(scoreVoices);
    audio.destroy();
  });

  it('keeps the game usable when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined); const audio = new MesomonAudio();
    await expect(audio.unlock()).resolves.toBeUndefined(); expect(() => { audio.cue('seal'); audio.pause(true); audio.destroy(); }).not.toThrow();
  });
});

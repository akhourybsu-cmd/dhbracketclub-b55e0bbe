import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MesomonAudio } from '../audio';
import type { MesomonSettings } from '../types';

class FakeGain {
  gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn(); disconnect = vi.fn();
}
class FakeOscillator {
  type = 'sine'; frequency = { value: 0 }; onended: (() => void) | null = null;
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
  it('keeps the game usable when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined); const audio = new MesomonAudio();
    await expect(audio.unlock()).resolves.toBeUndefined(); expect(() => { audio.cue('seal'); audio.pause(true); audio.destroy(); }).not.toThrow();
  });
});

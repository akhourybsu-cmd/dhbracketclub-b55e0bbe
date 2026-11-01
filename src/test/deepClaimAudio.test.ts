import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeepClaimAudio, deepClaimAudioPreferenceKey, type DeepClaimAudio } from '@/lib/deepClaim/audio';

class Param { value = 0; setValueAtTime = vi.fn((value: number) => { this.value = value; }); exponentialRampToValueAtTime = vi.fn(); setTargetAtTime = vi.fn(); }
class Node { connect = vi.fn(() => this); disconnect = vi.fn(); }
class Source extends Node {
  frequency = new Param(); type = ''; buffer: unknown; onended: (() => void) | null = null; start = vi.fn();
  stop = vi.fn((when?: number) => { if (when === undefined) this.onended?.(); });
}
class Gain extends Node { gain = new Param(); }
const contexts: FakeContext[] = [];
class FakeContext {
  state: AudioContextState = 'suspended'; currentTime = 0; sampleRate = 8000; destination = new Node(); sources: Source[] = []; gains: Gain[] = [];
  constructor() { contexts.push(this); }
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createOscillator() { const source = new Source(); this.sources.push(source); return source; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  createBuffer(_channels: number, size: number) { return { getChannelData: () => new Float32Array(size) }; }
  resume = vi.fn(async () => { this.state = 'running'; }); suspend = vi.fn(async () => { this.state = 'suspended'; }); close = vi.fn(async () => { this.state = 'closed'; });
}
const controllers: DeepClaimAudio[] = [];
let visibility: DocumentVisibilityState = 'visible';
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
function audio(id = 'member-a') { const controller = createDeepClaimAudio(id); controllers.push(controller); return controller; }
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); contexts.length = 0; visibility = 'visible';
  vi.spyOn(globalThis, 'setInterval'); vi.spyOn(globalThis, 'clearInterval');
  vi.stubGlobal('AudioContext', FakeContext);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  controllers.splice(0).forEach(controller => controller.dispose()); localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals();
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility); else delete (document as unknown as Record<string, unknown>).visibilityState;
});

describe('Deep Claim gesture-only original audio', () => {
  it('defaults to silence and never creates or resumes an AudioContext merely by rendering, updating settings or playing a cue', () => {
    const events = vi.spyOn(document, 'addEventListener');
    const controller = audio();
    expect(events.mock.calls.some(([name]) => name === 'visibilitychange')).toBe(false);
    expect(controller.getSnapshot().master).toBe(false);
    controller.play('pickaxe'); controller.updateSettings({ master: true }); controller.setActive(true);
    expect(contexts).toHaveLength(0);
  });
  it('persists bounded opt-in category preferences per user and leaves other accounts untouched', () => {
    const first = audio('user:a'); first.updateSettings({ master: true, music: false, sfx: true, ambient: false, volume: 9 });
    expect(first.getSnapshot().volume).toBe(1);
    expect(localStorage.getItem(deepClaimAudioPreferenceKey('user:a'))).toContain('"master":true');
    const restored = audio('user:a'); expect(restored.getSnapshot()).toEqual(first.getSnapshot());
    expect(audio('user:b').getSnapshot()).toMatchObject({ master: false, volume: .65 }); expect(contexts).toHaveLength(0);
  });
  it('unlocks only explicitly, attenuates distant mining and caps simultaneous sources', async () => {
    const controller = audio(); controller.updateSettings({ master: true, music: false, ambient: false });
    expect(await controller.unlock()).toBe(true); const context = contexts[0];
    controller.play('pickaxe', 0); const near = context.gains[1].gain.setValueAtTime.mock.calls[0]?.[0];
    const before = context.sources.length; context.currentTime += 1;
    controller.play('pickaxe', 60); const far = context.gains[before + 1].gain.setValueAtTime.mock.calls[0]?.[0];
    expect(far).toBeLessThan(near);
    for (let index = 0; index < 20; index++) { context.currentTime += 1; controller.play('complete'); }
    expect(context.sources.length).toBeLessThanOrEqual(14);
    const capped = context.sources.length; context.currentTime += 1; controller.play('pickaxe', 1000); expect(context.sources).toHaveLength(capped);
  });
  it('honors the existing app master mute and stops active audio on backgrounding', async () => {
    const controller = audio(); controller.updateSettings({ master: true }); await controller.unlock();
    const context = contexts[0]; expect(context.sources.length).toBeGreaterThan(0);
    const musicTimer = vi.mocked(setInterval).mock.results.at(-1)?.value;
    visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    expect(context.suspend).toHaveBeenCalled(); expect(clearInterval).toHaveBeenCalledWith(musicTimer);
    const count = context.sources.length; controller.play('complete'); expect(context.sources).toHaveLength(count);
    visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
    localStorage.setItem('dh-club-sound-settings-v1', JSON.stringify({ master: false, categories: { ui: true, combat: true, rewards: true, ambient: true } }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'dh-club-sound-settings-v1' }));
    const muted = context.sources.length; context.currentTime += 1; controller.play('complete');
    expect(context.sources).toHaveLength(muted); expect(context.state).toBe('suspended');
  });
  it('removes queued category voices immediately and never restarts a disposed controller', async () => {
    const controller = audio(); controller.updateSettings({ master: true, ambient: false }); await controller.unlock();
    const musicTimer = vi.mocked(setInterval).mock.results.at(-1)?.value;
    const context = contexts[0], musical = [...context.sources]; expect(musical.length).toBeGreaterThan(0);
    controller.updateSettings({ music: false }); expect(musical.every(source => source.stop.mock.calls.some(call => call[0] === undefined))).toBe(true);
    controller.setActive(false); expect(context.state).toBe('suspended');
    controller.dispose(); expect(context.close).toHaveBeenCalledOnce();
    expect(await controller.unlock()).toBe(false); controller.play('dispatch');
    expect(contexts).toHaveLength(1); expect(clearInterval).toHaveBeenCalledWith(musicTimer);
  });
});

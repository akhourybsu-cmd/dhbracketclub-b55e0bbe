import { getSoundSettings } from '@/hooks/useSoundSettings';

export interface DeepClaimAudioSettings { master: boolean; music: boolean; sfx: boolean; ambient: boolean; volume: number }
export type DeepClaimAudioCue = 'pickaxe' | 'haul' | 'deposit' | 'building' | 'upgrade' | 'dispatch' | 'complete' | 'error';
type Listener = () => void;
interface Voice { source: OscillatorNode | AudioBufferSourceNode; gain: GainNode; group: 'music' | 'ambient' | 'sfx' }
const DEFAULTS: DeepClaimAudioSettings = { master: false, music: true, sfx: true, ambient: true, volume: .65 };
const MAX_VOICES = 14;
const MUSIC = [220, 293.66, 329.63, 392, 440, 392, 329.63, 293.66, 220, 196, 220, 293.66];
export const deepClaimAudioPreferenceKey = (userId: string) => `dh:deep-claim:audio:v1:${encodeURIComponent(userId)}`;
const unit = (value: number) => Math.max(0, Math.min(1, value));

function read(key: string): DeepClaimAudioSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<DeepClaimAudioSettings> | null;
    return { master: value?.master === true, music: value?.music !== false, sfx: value?.sfx !== false, ambient: value?.ambient !== false,
      volume: typeof value?.volume === 'number' && Number.isFinite(value.volume) ? unit(value.volume) : DEFAULTS.volume };
  } catch { return { ...DEFAULTS }; }
}

/** Original frontier plucks and mining cues. No context exists before unlock(). */
export class DeepClaimAudio {
  private settings: DeepClaimAudioSettings;
  private listeners = new Set<Listener>();
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private voices = new Set<Voice>();
  private ambientVoices: Voice[] = [];
  private cueTimes = new Map<DeepClaimAudioCue, number>();
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = true;
  private unlocked = false;
  private disposed = false;
  private listening = false;
  private nextNoteAt = 0;
  private note = 0;
  private readonly key: string;
  constructor(userId: string) {
    this.key = deepClaimAudioPreferenceKey(userId); this.settings = read(this.key);
  }
  private listen() {
    if (this.listening || this.disposed) return;
    this.listening = true;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof window !== 'undefined') window.addEventListener('storage', this.onStorage);
  }
  getSnapshot = () => this.settings;
  subscribe = (listener: Listener) => { this.listen(); this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  updateSettings = (patch: Partial<DeepClaimAudioSettings>) => {
    if (this.disposed) return;
    this.settings = { master: typeof patch.master === 'boolean' ? patch.master : this.settings.master,
      music: typeof patch.music === 'boolean' ? patch.music : this.settings.music,
      sfx: typeof patch.sfx === 'boolean' ? patch.sfx : this.settings.sfx,
      ambient: typeof patch.ambient === 'boolean' ? patch.ambient : this.settings.ambient,
      volume: typeof patch.volume === 'number' && Number.isFinite(patch.volume) ? unit(patch.volume) : this.settings.volume };
    try { localStorage.setItem(this.key, JSON.stringify(this.settings)); } catch { /* In-memory opt-in still works when storage is blocked. */ }
    this.listeners.forEach(listener => listener()); this.sync();
  };
  /** Call directly from an opt-in click/tap. Merely enabling a setting never unlocks audio. */
  unlock = async (): Promise<boolean> => {
    if (this.disposed || typeof window === 'undefined') return false;
    this.listen();
    try {
      if (!this.context || this.context.state === 'closed') {
        const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;
        this.context = new Ctor(); this.output = this.context.createGain(); this.output.gain.value = 0; this.output.connect(this.context.destination);
      }
      await this.context.resume();
      if (this.disposed) return false;
      this.unlocked = true; this.sync(); return this.context.state === 'running';
    } catch { return false; }
  };
  setActive = (active: boolean) => { this.listen(); if (this.active !== active && !this.disposed) { this.active = active; this.sync(); } };
  private audible() {
    return !this.disposed && this.active && this.unlocked && this.settings.master && getSoundSettings().master
      && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
  }
  private sync() {
    const c = this.context;
    if (!c || !this.output) return;
    const audible = this.audible();
    this.output.gain.setTargetAtTime(audible ? this.settings.volume * .65 : 0, c.currentTime, .02);
    if (!audible) {
      this.stopLoops(); this.stopVoices();
      if (c.state === 'running') void c.suspend().catch(() => {});
      return;
    }
    const global = getSoundSettings();
    if (!this.settings.music || !global.categories.ambient) this.stopVoices('music');
    if (!this.settings.ambient || !global.categories.ambient) { this.stopVoices('ambient'); this.ambientVoices = []; }
    if (!this.settings.sfx) this.stopVoices('sfx');
    if (c.state === 'suspended') void c.resume().then(() => { if (!this.disposed) this.startLoops(); }).catch(() => {});
    else this.startLoops();
  }
  private voice(frequency: number, duration: number, peak: number, type: OscillatorType = 'triangle', delay = 0, group: Voice['group'] = 'sfx'): Voice | null {
    const c = this.context, output = this.output;
    if (!c || !output || this.voices.size >= MAX_VOICES || !this.audible()) return null;
    const source = c.createOscillator(), gain = c.createGain(), at = c.currentTime + delay;
    source.type = type; source.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration); source.connect(gain); gain.connect(output);
    const voice = { source, gain, group }; this.voices.add(voice);
    source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); };
    source.start(at); source.stop(at + duration + .02); return voice;
  }
  private strike(peak: number) {
    const c = this.context, output = this.output;
    if (!c || !output || this.voices.size >= MAX_VOICES) return;
    if (!this.noise) {
      this.noise = c.createBuffer(1, Math.ceil(c.sampleRate * .11), c.sampleRate);
      const channel = this.noise.getChannelData(0); let noiseState = 0x46d3;
      for (let index = 0; index < channel.length; index++) { noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0; channel[index] = (noiseState / 0xffffffff * 2 - 1) * Math.exp(-index / channel.length * 9); }
    }
    const source = c.createBufferSource(), gain = c.createGain(); source.buffer = this.noise;
    gain.gain.setValueAtTime(peak, c.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .105);
    source.connect(gain); gain.connect(output); const voice: Voice = { source, gain, group: 'sfx' }; this.voices.add(voice);
    source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); };
    source.start(); source.stop(c.currentTime + .12);
  }
  play = (cue: DeepClaimAudioCue, distanceTiles = 0) => {
    const c = this.context, global = getSoundSettings();
    if (!c || !this.audible() || !this.settings.sfx || c.state !== 'running' || !Number.isFinite(distanceTiles) || distanceTiles < 0 || distanceTiles > 85) return;
    const mining = cue === 'pickaxe' || cue === 'haul' || cue === 'deposit';
    if (!(mining ? global.categories.combat : global.categories.ui)) return;
    const previous = this.cueTimes.get(cue) ?? -Infinity;
    if (c.currentTime - previous < (mining ? .18 : .09)) return;
    this.cueTimes.set(cue, c.currentTime);
    const gain = .11 / (1 + distanceTiles * .07);
    if (cue === 'pickaxe') { this.strike(gain * .5); this.voice(920, .095, gain * .7, 'triangle'); this.voice(420, .14, gain * .35, 'sine', .013); }
    else if (cue === 'haul') { this.strike(gain * .25); this.voice(110, .1, gain * .3, 'triangle'); }
    else if (cue === 'error') { this.voice(164.81, .14, gain * .5, 'triangle'); this.voice(146.83, .18, gain * .4, 'triangle', .12); }
    else if (cue === 'building') { this.voice(293.66, .14, gain * .5, 'triangle'); this.voice(440, .2, gain * .4, 'sine', .075); }
    else {
      const notes = cue === 'complete' || cue === 'upgrade' ? [293.66, 392, 440, 587.33] : cue === 'dispatch' ? [220, 293.66, 392] : [392, 440, 587.33];
      notes.forEach((frequency, index) => this.voice(frequency, .28, gain * .55, 'triangle', index * .085));
    }
  };
  private startLoops() {
    if (!this.context || !this.audible()) return;
    const ambientAllowed = getSoundSettings().categories.ambient;
    if (this.settings.ambient && ambientAllowed && this.ambientVoices.length === 0) {
      for (const frequency of [73.42, 110]) { const voice = this.voice(frequency, 60 * 60, .012, 'sine', 0, 'ambient'); if (voice) this.ambientVoices.push(voice); }
    } else if (!this.settings.ambient || !ambientAllowed) { this.ambientVoices.forEach(voice => { try { voice.source.stop(); } catch { /* Already ended. */ } }); this.ambientVoices = []; }
    if (this.settings.music && ambientAllowed && !this.timer) {
      this.nextNoteAt = this.context.currentTime + .15;
      const schedule = () => {
        const c = this.context;
        if (!c || !this.audible() || !this.settings.music) return;
        while (this.nextNoteAt < c.currentTime + .8) {
          this.voice(MUSIC[this.note % MUSIC.length], .65, .032, 'triangle', Math.max(0, this.nextNoteAt - c.currentTime), 'music');
          if (this.note % 4 === 0) this.voice(110, .72, .016, 'sine', Math.max(0, this.nextNoteAt - c.currentTime), 'music');
          this.note++; this.nextNoteAt += this.note % 4 === 0 ? 1.4 : .7;
        }
      };
      schedule(); this.timer = setInterval(schedule, 250);
    } else if ((!this.settings.music || !ambientAllowed) && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  private stopLoops() { if (this.timer) clearInterval(this.timer); this.timer = null; this.ambientVoices = []; }
  private stopVoices(group?: Voice['group']) { this.voices.forEach(voice => { if (group && voice.group !== group) return; try { voice.source.stop(); } catch { /* Already ended. */ } voice.source.disconnect(); voice.gain.disconnect(); this.voices.delete(voice); }); }
  private onVisibility = () => this.sync();
  private onStorage = (event: StorageEvent) => { if (event.key === this.key || event.key?.startsWith('dh-club-sound')) { if (event.key === this.key) { this.settings = read(this.key); this.listeners.forEach(listener => listener()); } this.sync(); } };
  dispose = () => {
    if (this.disposed) return;
    this.disposed = true; this.stopLoops(); this.stopVoices(); this.listeners.clear();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    if (typeof window !== 'undefined') window.removeEventListener('storage', this.onStorage);
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = null; this.output = null; this.noise = null;
  };
}
export function createDeepClaimAudio(userId: string) { return new DeepClaimAudio(userId); }

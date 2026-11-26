import type { BattleCue, BattleState, MapId, MesomonSettings, SpeciesId } from './types';
import { getBattleBeat, getBattleHitSide } from './battlePlayback';

type Scene = MapId | 'battle' | 'boss';
type Cue = 'ally-hit' | 'enemy-hit' | 'confirm' | 'cancel' | 'menu' | 'bond' | 'seal' | SpeciesId;
const THEMES: Record<'harbor' | 'workshop' | 'underwharf' | 'battle' | 'boss', number[]> = {
  harbor: [62, 69, 67, 64, 65, 62, 59, 57, 62, 64, 69, 67, 64, 60, 62, 57],
  workshop: [62, 65, 69, 72, 71, 69, 65, 64, 62, 60, 59, 57],
  underwharf: [38, 45, 46, 45, 41, 38, 37, 33],
  battle: [50, 57, 53, 60, 58, 57, 53, 55, 50, 57, 62, 60, 58, 55, 53, 57],
  boss: [38, 45, 46, 50, 49, 45, 41, 40, 38, 46, 45, 49, 50, 41, 40, 37],
};
const noteFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12);

interface Gesture {
  wave: OscillatorType;
  from: number;
  to: number;
  duration: number;
  /** Interval above the final note, sounded once as a quiet answering voice. */
  answer?: number;
}

// MIDI pitches and seconds. Keep even the longest gesture under a quick beat.
const BATTLE_GESTURES: Record<BattleCue, Gesture> = {
  'brine-snap':     { wave: 'triangle', from: 84, to: 58, duration: .09, answer: 5 },
  'quick-tackle':   { wave: 'square', from: 62, to: 75, duration: .055 },
  'splinter-swipe': { wave: 'sawtooth', from: 79, to: 60, duration: .07 },
  'bank-break':     { wave: 'triangle', from: 48, to: 34, duration: .15, answer: 7 },
  'rift-lash':      { wave: 'sawtooth', from: 41, to: 53, duration: .13, answer: 1 },
  'resonant-cry':   { wave: 'sine', from: 69, to: 76, duration: .16, answer: 5 },
  'lantern-dust':   { wave: 'sine', from: 90, to: 86, duration: .10, answer: 7 },
  'tidal-veil':     { wave: 'sine', from: 55, to: 72, duration: .15, answer: 7 },
  'mud-wrap':       { wave: 'triangle', from: 52, to: 41, duration: .11 },
  reedstep:         { wave: 'triangle', from: 72, to: 84, duration: .065, answer: 4 },
  guard:            { wave: 'square', from: 51, to: 47, duration: .06 },
  tincture:         { wave: 'triangle', from: 73, to: 80, duration: .045 },
  switch:           { wave: 'triangle', from: 76, to: 67, duration: .09, answer: 7 },
  dodge:            { wave: 'sine', from: 85, to: 95, duration: .055 },
  mudbound:         { wave: 'sawtooth', from: 45, to: 36, duration: .14 },
  resonate:         { wave: 'sine', from: 74, to: 74, duration: .17, answer: 7 },
  flee:             { wave: 'triangle', from: 64, to: 57, duration: .085 },
};
const HEALING_TONE: Gesture = { wave: 'sine', from: 74, to: 81, duration: .12, answer: 5 };
const SETTLING_TONE: Gesture = { wave: 'sine', from: 76, to: 69, duration: .14 };

/** Small original score synthesized locally. No samples, remote music or autoplay. */
export class MesomonAudio {
  private context: AudioContext | null = null;
  private music: GainNode | null = null;
  private ambient: GainNode | null = null;
  private effects: GainNode | null = null;
  private nodes = new Set<AudioScheduledSourceNode>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private scene: Scene = 'ship';
  private paused = false;
  private disposed = false;
  private index = 0;
  private lastBattleBeat = '';
  private noiseBuffer: AudioBuffer | null = null;
  private settings: Pick<MesomonSettings, 'mute' | 'musicVolume' | 'ambientVolume'> = { mute: false, musicVolume: 0.45, ambientVolume: 0.4 };

  async unlock(): Promise<void> {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.music = this.context.createGain(); this.ambient = this.context.createGain(); this.effects = this.context.createGain();
        this.music.connect(this.context.destination); this.ambient.connect(this.context.destination); this.effects.connect(this.context.destination);
        this.applyVolumes();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (!this.paused && !this.timer) this.schedule();
    } catch { /* Browsers without Web Audio remain fully playable. */ }
  }
  setSettings(settings: MesomonSettings): void {
    if (settings.mute && !this.settings.mute) this.stopSources();
    this.settings = { mute: settings.mute, musicVolume: settings.musicVolume, ambientVolume: settings.ambientVolume };
    this.applyVolumes();
  }
  private applyVolumes(): void {
    const mute = this.settings.mute || this.paused;
    if (this.music) this.music.gain.value = mute ? 0 : Math.max(0, Math.min(1, this.settings.musicVolume)) * 0.065;
    if (this.ambient) this.ambient.gain.value = mute ? 0 : Math.max(0, Math.min(1, this.settings.ambientVolume)) * 0.04;
    if (this.effects) this.effects.gain.value = mute ? 0 : 0.09;
  }
  setScene(scene: Scene): void {
    if (this.scene === scene) return;
    this.scene = scene; this.index = 0; this.lastBattleBeat = '';
    this.stopSources();
  }
  private theme(): keyof typeof THEMES {
    if (this.scene === 'battle' || this.scene === 'boss') return this.scene;
    return this.scene === 'workshop' ? 'workshop' : ['passage', 'chamber'].includes(this.scene) ? 'underwharf' : 'harbor';
  }
  private tone(note: number, at: number, duration: number, gain: GainNode | null, waveform: OscillatorType = 'triangle', amplitude = 1, endNote?: number): void {
    const ctx = this.context;
    if (!ctx || !gain || this.disposed || this.nodes.size > 12) return;
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(noteFrequency(note), at);
    if (endNote !== undefined) oscillator.frequency.exponentialRampToValueAtTime(noteFrequency(endNote), at + duration);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(amplitude, at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(envelope); envelope.connect(gain); this.nodes.add(oscillator);
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + 0.02);
  }
  private water(at: number, duration: number): void {
    const ctx = this.context;
    if (!ctx || !this.ambient || this.nodes.size > 12) return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
      const samples = this.noiseBuffer.getChannelData(0); let seed = 74183;
      for (let i = 0; i < samples.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; samples[i] = seed / 2147483648 - 1; }
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
    source.buffer = this.noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = this.theme() === 'underwharf' ? 280 : 650;
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(0.25, at + 0.8); envelope.gain.linearRampToValueAtTime(0, at + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.ambient); this.nodes.add(source);
    source.onended = () => { this.nodes.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(at); source.stop(at + duration);
  }
  private schedule(): void {
    this.timer = null;
    const ctx = this.context;
    if (this.disposed || this.paused || !ctx || ctx.state !== 'running') return;
    const theme = this.theme(), melody = THEMES[theme], now = ctx.currentTime;
    const tempo = theme === 'battle' || theme === 'boss' ? 245 : theme === 'underwharf' ? 790 : 460;
    if (!this.settings.mute) {
      this.tone(melody[this.index % melody.length], now, tempo / 1000 * 0.85, this.music, theme === 'boss' ? 'sawtooth' : 'triangle', theme === 'boss' ? 0.36 : 0.8);
      if (this.index % 4 === 0) this.tone(melody[this.index % melody.length] - 12, now, tempo / 1000 * 2.6, this.music, 'sine', 0.6);
      // Quiet oscillating water/industrial room tone; bounded, distance-free scene bed.
      if (this.index % 8 === 0) {
        this.water(now, 2.8);
        this.tone(theme === 'underwharf' ? 26 : 31, now, 2.8, this.ambient, 'sine', 0.4);
        if (theme === 'harbor') this.tone(86, now + 0.45, 0.16, this.ambient, 'sine', 0.18);
      }
    }
    this.index++; this.timer = setTimeout(() => this.schedule(), tempo);
  }
  battleBeat(battle: BattleState): void {
    const playback = battle.playback, beat = getBattleBeat(battle);
    if (!playback || !beat) return;
    const key = `${battle.id}:${battle.turn}:${playback.index}`;
    if (key === this.lastBattleBeat) return;
    this.lastBattleBeat = key;
    const ctx = this.context;
    if (!ctx || this.disposed || this.paused || this.settings.mute || ctx.state !== 'running') return;

    const calming = beat.cue === 'resonant-cry' || beat.cue === 'lantern-dust';
    // The crystal rings on contact. A wild creature lowering its guard gets a quiet beat.
    if (beat.kind === 'notice' && ((beat.cue === 'resonate' && beat.side === 'ally') || (calming && beat.side === 'enemy'))) return;
    let gesture = beat.cue ? BATTLE_GESTURES[beat.cue] : undefined;
    if (beat.kind === 'impact' && beat.cue !== 'dodge') {
      if (calming) {
        gesture = SETTLING_TONE;
      } else if (beat.cue === 'tincture') {
        gesture = HEALING_TONE;
      } else {
        const target = getBattleHitSide(battle);
        if (target) this.cue(target === 'ally' ? 'ally-hit' : 'enemy-hit');
        return;
      }
    }
    if (!gesture) return;
    // Keep harmonically rich square/saw voices softer than the rounder voices.
    const amp = gesture.wave === 'square' || gesture.wave === 'sawtooth' ? .21 : .48;
    this.tone(gesture.from, ctx.currentTime, gesture.duration, this.effects, gesture.wave, amp, gesture.to);
    if (gesture.answer !== undefined) {
      this.tone(gesture.to + gesture.answer, ctx.currentTime + gesture.duration * .65,
        gesture.duration * .8, this.effects, 'sine', .24);
    }
  }
  cue(cue: Cue): void {
    const ctx = this.context;
    if (!ctx || this.paused || this.settings.mute || ctx.state !== 'running') return;
    if (cue === 'ally-hit' || cue === 'enemy-hit') {
      const pitch = cue === 'ally-hit' ? 44 : 56;
      this.tone(pitch + 7, ctx.currentTime, 0.045, this.effects, 'square', 0.19);
      this.tone(pitch, ctx.currentTime + 0.035, 0.09, this.effects, 'triangle', 0.48);
      return;
    }
    const notes: Partial<Record<Cue, number[]>> = {
      confirm: [74, 81], cancel: [65, 60], menu: [69, 74], bond: [62, 69, 65, 74], seal: [61, 66, 62, 69, 74],
      rillik: [81, 84, 79], muddren: [43, 38], gleamwing: [91, 93, 86], tressel: [76, 71, 78], 'rift-wretch': [37, 38, 49],
    };
    (notes[cue] ?? [74]).forEach((note, i) => this.tone(note, ctx.currentTime + i * 0.13, cue === 'seal' || cue === 'bond' ? 0.4 : 0.13, this.effects, cue === 'rift-wretch' ? 'sawtooth' : 'triangle', cue === 'rift-wretch' ? 0.3 : 0.6));
  }
  pause(paused: boolean): void {
    this.paused = paused; this.applyVolumes();
    if (paused) { this.stopSources(); if (this.timer) clearTimeout(this.timer); this.timer = null; }
    else if (this.context && !this.timer) this.schedule();
  }
  private stopSources(): void {
    for (const source of this.nodes) { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); }
    this.nodes.clear();
  }
  destroy(): void {
    this.disposed = true; if (this.timer) clearTimeout(this.timer); this.timer = null; this.stopSources();
    this.music?.disconnect(); this.ambient?.disconnect(); this.effects?.disconnect();
    void this.context?.close().catch(() => {}); this.context = null;
  }
}

import type { RunState } from '../../../supabase/functions/_shared/arcade/model';

interface Mix { music: number; sfx: number; muted: boolean }
type Scene = 'title' | 'play' | 'results' | 'paused';
type Channel = 'music' | 'sfx';
const titlePhrase = [62, 0, 69, 65, 0, 67, 0, 74, 69, 0, 65, 0, 67, 64, 0, 0];
const patrolPhrase = [50, 0, 57, 0, 53, 0, 0, 55, 50, 0, 0, 57, 0, 52, 0, 0];
const roots = [38, 41, 34, 36];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const gainLevel = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export class RiftwatchAudio {
  private context: AudioContext | null = null;
  private buses: Record<Channel, GainNode> | null = null;
  private voices = new Map<OscillatorNode, GainNode>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private scene: Scene = 'title';
  private mix: Mix = { music: .32, sfx: .58, muted: false };
  private beat = 0;
  private wave = 1;
  private pressure = 0;
  private lastRun: RunState | null = null;
  private heardTick = -1;

  configure(mix: Mix) {
    this.mix = { music: gainLevel(mix.music), sfx: gainLevel(mix.sfx), muted: mix.muted };
    this.applyMix();
    if (mix.muted) this.quiet();
    else this.wake();
  }
  /** Call only at a member's button, key, or controller gesture. */
  unlock() {
    if (this.disposed || this.mix.muted) return;
    if (!this.context) {
      const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return;
      try {
        const ctx = new Audio();
        this.context = ctx;
        this.buses = { music: ctx.createGain(), sfx: ctx.createGain() };
        this.buses.music.connect(ctx.destination);
        this.buses.sfx.connect(ctx.destination);
        this.applyMix();
      } catch { return; }
    }
    this.wake();
  }
  title() { this.setScene('title'); }
  play() { this.setScene('play'); }
  results() { this.setScene('results'); }
  pause() { this.setScene('paused'); }

  private setScene(next: Scene) {
    if (next !== this.scene) {
      this.cancelBeat();
      this.beat = 0;
      this.scene = next;
    }
    if (next === 'paused' || this.mix.muted) this.quiet();
    else this.wake();
  }
  private applyMix() {
    if (!this.buses) return;
    this.buses.music.gain.value = this.mix.muted ? 0 : this.mix.music * .23;
    this.buses.sfx.gain.value = this.mix.muted ? 0 : this.mix.sfx * .32;
  }
  private wake() {
    const ctx = this.context;
    if (!ctx || this.disposed || this.scene === 'paused' || document.hidden || this.mix.muted) return;
    const start = () => {
      if (ctx !== this.context || ctx.state !== 'running' || this.disposed || this.mix.muted || document.hidden) return;
      if (this.timer === null && (this.scene === 'title' || this.scene === 'play')) this.scheduleBeat();
    };
    if (ctx.state === 'running') start();
    else if (ctx.state !== 'closed') void ctx.resume().then(start).catch(() => {});
  }
  private tone(channel: Channel, wave: OscillatorType, pitch: number, duration: number, level: number, delay = 0, endPitch = pitch) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || !this.buses || this.mix.muted || this.scene === 'paused' || this.disposed || document.hidden) return;
    if (this.mix[channel] <= 0 || this.voices.size >= (channel === 'music' ? 8 : 12)) return;
    const osc = ctx.createOscillator(), env = ctx.createGain();
    const start = ctx.currentTime + delay, end = start + duration;
    osc.type = wave;
    osc.frequency.setValueAtTime(hz(pitch), start);
    if (endPitch !== pitch) osc.frequency.exponentialRampToValueAtTime(hz(endPitch), end);
    env.gain.setValueAtTime(.0001, start);
    env.gain.linearRampToValueAtTime(level, start + Math.min(.015, duration/4));
    env.gain.exponentialRampToValueAtTime(.0001, end);
    osc.connect(env); env.connect(this.buses[channel]);
    this.voices.set(osc, env);
    osc.onended = () => { this.voices.delete(osc); osc.disconnect(); env.disconnect(); };
    osc.start(start); osc.stop(end + .008);
  }

  private scheduleBeat() {
    if (this.scene !== 'play' && this.scene !== 'title') return;
    const slot = this.beat % 16, bar = Math.floor(this.beat/16) % 4;
    const bass = roots[bar];
    let interval: number;
    if (this.scene === 'title') {
      interval = .235;
      const note = titlePhrase[slot];
      if (note) this.tone('music','triangle',note+bass-38,.32,.26);
      if (slot === 0 || slot === 7 || slot === 12) this.tone('music','sine',bass,.68,.36);
      if (slot === 3 || slot === 11) this.tone('music','triangle',bass+19,.40,.12,.066);
    } else {
      interval = Math.max(.12,.24 - Math.min(10,this.wave-1)*.006 - this.pressure*.048);
      const note = patrolPhrase[slot];
      if (note) this.tone('music','triangle',note+bass-38,.14,.20);
      if (slot === 0 || slot === 6 || slot === 11) this.tone('music','sine',bass+4,.15,.35,0,bass-3);
      if (this.pressure > .45 && slot % 4 === 3) this.tone('music','triangle',bass+23,.055,.09);
      if (this.wave % 5 === 0 && (slot === 2 || slot === 9)) {
        this.tone('music','sawtooth',bass-5,.21,.07,0,bass-4);
        this.tone('music','sine',bass+7,.30,.22,.045);
      }
    }
    this.beat = (this.beat + 1) % 64;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.disposed && !this.mix.muted && !document.hidden && this.context?.state === 'running') this.scheduleBeat();
    }, interval*1000);
  }
  /** Consume each tick once, including when rendering catches up over several steps. */
  update(state: RunState) {
    if (this.lastRun === state && this.heardTick === state.tick) return;
    this.lastRun = state;
    this.heardTick = state.tick;
    this.wave = state.wave;
    this.pressure = 1 - state.enemies.length / Math.max(1, state.population);
    if (!this.context || this.scene !== 'play' || document.hidden) return;
    let hostileHeard = false;
    for (const event of state.events) {
      switch (event.kind) {
        case 'fire': this.tone('sfx','triangle',76,.065,.21,0,64); break;
        case 'enemy-fire':
          if (hostileHeard) break;
          hostileHeard = true;
          if (event.value === 2) this.tone('sfx','sine',44,.19,.31,0,56);
          else if (event.value === 1) this.tone('sfx','sawtooth',53,.12,.12,0,42);
          else this.tone('sfx','triangle',62,.085,.15,0,57);
          break;
        case 'ward': this.tone('sfx','triangle',event.value ? 68 : 58,.09,.23,0,43); break;
        case 'kill': this.tone('sfx','triangle',69,.14,.22,0,62); break;
        case 'node': this.tone('sfx','sine',event.value ? 78 : 83,.17,.34,0,70); break;
        case 'hit':
          this.tone('sfx','sawtooth',55,.18,.15,0,34);
          this.tone('sfx','sine',43,.32,.38,.04,31);
          if (event.value) this.tone('sfx','triangle',59+event.value*2,.20,.26,.18);
          break;
        case 'pulse':
          this.tone('sfx','sine',36,.29,.52,0,70);
          this.tone('sfx','triangle',66,.27,.20,.12,55);
          break;
        case 'wave-clear': this.phrase([62,69,72],.09,.19); break;
        case 'wave-start':
          if (state.wave % 5 === 0) this.phrase([45,44,50],.14,.25);
          break;
        case 'over': this.phrase([57,53,50,38],.135,.24); break;
      }
    }
  }
  cue(kind: 'best' | 'rank') {
    if (kind === 'best') this.phrase([62,65,69,74],.09,.23);
    else this.phrase([65,72,77],.13,.23);
  }
  private phrase(notes: number[], space: number, duration: number) {
    notes.forEach((note,i) => this.tone('sfx','triangle',note,duration,.28,i*space));
  }
  private cancelBeat() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private quiet() {
    this.cancelBeat();
    for (const [osc, env] of this.voices) {
      osc.onended = null;
      try { osc.stop(); } catch { /* A scheduled envelope may already have ended. */ }
      osc.disconnect(); env.disconnect();
    }
    this.voices.clear();
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }
  dispose() {
    this.disposed = true;
    this.quiet();
    this.buses?.music.disconnect(); this.buses?.sfx.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = null;
    this.buses = null;
    this.lastRun = null;
  }
}

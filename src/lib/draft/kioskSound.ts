/**
 * Kiosk audio — Web Audio only (no assets). Used by the projector screen for
 * the final-seconds ticker, the pick chime, and the expiry horn.
 */
let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.1, delay = 0) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + duration);
}

export const kioskSound = {
  /** One-per-second tick in the final stretch. */
  tick: () => tone(1180, 0.05, 'square', 0.05),
  /** Louder tick for the last five seconds. */
  tickUrgent: () => tone(1420, 0.07, 'square', 0.09),
  /** A selection landed. */
  pick: () => {
    tone(523, 0.12, 'triangle', 0.09);
    tone(784, 0.16, 'triangle', 0.08, 0.09);
    tone(1046, 0.22, 'sine', 0.07, 0.19);
  },
  /** A submitted selection has been locked but not revealed yet. */
  locked: () => {
    tone(110, 0.32, 'sine', 0.08);
    tone(220, 0.2, 'triangle', 0.05, 0.2);
  },
  /** Suspense lift immediately before the selection appears. */
  reveal: () => {
    tone(392, 0.18, 'sine', 0.055);
    tone(523, 0.22, 'triangle', 0.065, 0.16);
    tone(784, 0.4, 'sine', 0.075, 0.34);
  },
  /** Short impact as the selection settles into the board. */
  land: () => {
    tone(1046, 0.1, 'triangle', 0.075);
    tone(523, 0.28, 'sine', 0.065, 0.06);
  },
  /** Clock expired. */
  horn: () => {
    tone(196, 0.55, 'sawtooth', 0.09);
    tone(147, 0.7, 'sawtooth', 0.07, 0.05);
  },
  /** Draft opened / round rolled over. */
  fanfare: () => {
    tone(523, 0.14, 'triangle', 0.08);
    tone(659, 0.14, 'triangle', 0.08, 0.13);
    tone(784, 0.14, 'triangle', 0.08, 0.26);
    tone(1046, 0.4, 'triangle', 0.09, 0.39);
  },
  /** Clock is on the picker. */
  onClock: () => {
    tone(880, 0.1, 'sine', 0.08);
    tone(1175, 0.18, 'sine', 0.07, 0.1);
  },
  unlock: () => {
    const c = audio();
    if (c && c.state === 'suspended') void c.resume();
  },
};

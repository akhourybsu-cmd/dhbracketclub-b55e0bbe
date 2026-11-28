import { MAX_REPLAY_EVENTS, MAX_TICKS } from './rules.ts';
import { createRun, stepRun, summarize } from './riftwatch.ts';
import type { RunSummary } from './model.ts';

export type ReplayEvent = [tick: number, mask: number];

/** Call once before each simulated tick, including wave tallies. Mask zero is implied at tick zero. */
export function recordInput(events: ReplayEvent[], tick: number, mask: number): boolean {
  const last = events[events.length - 1];
  if (mask === (last?.[1] ?? 0)) return true;
  if (events.length >= MAX_REPLAY_EVENTS) return false;
  events.push([tick, mask]);
  return true;
}

/** All entries are state changes. Simultaneous actions occupy the same four-bit mask. */
export function decodeReplay(value: unknown, ticks: number): ReplayEvent[] {
  if (!Array.isArray(value) || value.length > MAX_REPLAY_EVENTS) throw new Error('invalid_replay');
  let previousTick = -1, previousMask = 0;
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('invalid_replay');
    const [tick, mask] = row;
    if (!Number.isSafeInteger(tick) || tick <= previousTick || tick >= ticks ||
      !Number.isSafeInteger(mask) || mask < 0 || mask > 15 || mask === previousMask) {
      throw new Error('invalid_replay');
    }
    previousTick = tick; previousMask = mask;
  }
  return value as ReplayEvent[];
}

/** Recompute a terminal result from the issued seed. A claimed score is only a comparison. */
export function verifyReplay(seed: string, events: unknown, expected: unknown): RunSummary {
  if (typeof seed !== 'string' || !seed.length || seed.length > 128) throw new Error('invalid_seed');
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) throw new Error('invalid_summary');
  const summaryKeys = ['score', 'wave', 'kills', 'simulationTicks'] as const;
  const claim = expected as RunSummary;
  if (Object.keys(claim).length !== summaryKeys.length ||
    !summaryKeys.every(k => Object.prototype.hasOwnProperty.call(claim, k) && Number.isSafeInteger(claim[k]) && claim[k] >= 0) ||
    claim.wave < 1 || claim.simulationTicks < 1 || claim.simulationTicks > MAX_TICKS) throw new Error('invalid_summary');
  const sequence = decodeReplay(events, claim.simulationTicks);
  const s = createRun(seed);
  let index = 0, mask = 0;
  while (s.tick < claim.simulationTicks && s.phase !== 'over') {
    if (index < sequence.length && s.tick === sequence[index][0]) mask = sequence[index++][1];
    stepRun(s, mask);
  }
  if (s.phase !== 'over' || index !== sequence.length || s.tick !== claim.simulationTicks) throw new Error('nonterminal_replay');
  const verified = summarize(s);
  if (summaryKeys.some(k => verified[k] !== claim[k])) throw new Error('summary_mismatch');
  return verified;
}

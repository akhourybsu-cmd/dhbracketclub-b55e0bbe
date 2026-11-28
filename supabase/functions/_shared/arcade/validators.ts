import type { ArcadeSummary } from './contracts.ts';
import { verifyReplay } from './replay.ts';
import { MAX_REPLAY_EVENTS, MAX_TICKS, REPLAY_ENCODING_VERSION, RIFTWATCH_KEY, RIFTWATCH_RULESET, TICK_RATE } from './rules.ts';

export interface ArcadeValidator {
  key: string;
  version: string;
  encodingVersion: number;
  maxEvents: number;
  maxTicks: number;
  ticksPerSecond: number;
  verify: (seed: string, events: unknown, summary: ArcadeSummary) => ArcadeSummary;
}

// Register immutable ruleset versions here. Only the database's current version can issue new tickets.
export const arcadeValidators: readonly ArcadeValidator[] = [{
  key: RIFTWATCH_KEY,
  version: RIFTWATCH_RULESET,
  encodingVersion: REPLAY_ENCODING_VERSION,
  maxEvents: MAX_REPLAY_EVENTS,
  maxTicks: MAX_TICKS,
  ticksPerSecond: TICK_RATE,
  verify: verifyReplay,
}];

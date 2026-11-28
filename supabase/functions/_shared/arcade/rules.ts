// Immutable ranked rules. New competitive balance must get a new version.
export const RIFTWATCH_KEY = 'riftwatch';
export const RIFTWATCH_RULESET = 'riftwatch-1.0.0';
export const TICK_RATE = 60;
export const MAX_TICKS = 30 * 60 * TICK_RATE;
export const MAX_REPLAY_EVENTS = 8192;
export const REPLAY_ENCODING_VERSION = 1;
export const INPUT = { left: 1, right: 2, fire: 4, pulse: 8 } as const;
export const BASE_POINTS = { flicker: 10, sliver: 20, herald: 35, diver: 50, anchor: 500 } as const;
export const CHAIN_TICKS = 135;
export const PULSE_RADIUS = 42;

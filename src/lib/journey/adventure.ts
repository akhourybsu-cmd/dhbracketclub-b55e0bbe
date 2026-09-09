import type {
  AdventureOutcome,
  RunState,
  RuntimeEncounterPayload,
  RuntimeEncounterRoll,
} from './types';

const numberOr = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const JOURNEY_STAT_LABELS: Record<string, string> = {
  might: 'Might',
  finesse: 'Finesse',
  wits: 'Wits',
  resolve: 'Resolve',
};

export function statLabel(stat: string): string {
  return JOURNEY_STAT_LABELS[stat] ?? stat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function encounterProgress(payload: RuntimeEncounterPayload): number {
  return Math.max(0, numberOr(payload.session.player_state?.progress, 0));
}

export function encounterFocus(payload: RuntimeEncounterPayload): number {
  return Math.max(0, numberOr(payload.session.player_state?.focus, payload.definition.max_focus));
}

export function encounterRound(payload: RuntimeEncounterPayload): number {
  return Math.min(
    Math.max(1, numberOr(payload.session.round, 1)),
    Math.max(1, payload.definition.max_rounds),
  );
}

export function encounterProgressPercent(payload: RuntimeEncounterPayload): number {
  const target = Math.max(1, numberOr(payload.definition.target_progress, 1));
  return Math.min(100, Math.round((encounterProgress(payload) / target) * 100));
}

export function encounterOutcomeLabel(outcome: AdventureOutcome): string {
  if (outcome === 'victory') return 'Challenge overcome';
  if (outcome === 'defeat') return 'A costly way forward';
  if (outcome === 'escaped') return 'You found another way';
  if (outcome === 'resolved') return 'Encounter resolved';
  return 'Challenge underway';
}

export function latestEncounterRoll(payload: RuntimeEncounterPayload): RuntimeEncounterRoll | null {
  return payload.session.player_state?.last_result
    ?? payload.session.log?.[payload.session.log.length - 1]
    ?? null;
}

export type ExposureBand = 'steady' | 'strained' | 'dangerous' | 'critical';

export function exposureBand(state: RunState): { value: number; band: ExposureBand; label: string } {
  const value = Math.max(0, numberOr(state.variables?.EXPOSURE, 0));
  if (value >= 6) return { value, band: 'critical', label: 'Critical resonance' };
  if (value >= 4) return { value, band: 'dangerous', label: 'Dangerous resonance' };
  if (value >= 2) return { value, band: 'strained', label: 'Stone answering' };
  return { value, band: 'steady', label: 'Resonance steady' };
}

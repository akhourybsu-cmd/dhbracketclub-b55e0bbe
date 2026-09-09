import type { JourneyDecisionImpact, RunState } from './types';

export type JourneyPathKey = 'guardian' | 'seeker' | 'defiant' | 'maker';

export interface JourneyPathDefinition {
  key: JourneyPathKey;
  variable: string;
  label: string;
  title: string;
  description: string;
}

export const JOURNEY_PATHS: JourneyPathDefinition[] = [
  {
    key: 'guardian',
    variable: 'PATH_GUARDIAN',
    label: 'Guardian',
    title: 'The Guardian',
    description: 'Theron puts lives and bonds ahead of proof, orders, and clean victories.',
  },
  {
    key: 'seeker',
    variable: 'PATH_SEEKER',
    label: 'Seeker',
    title: 'The Seeker',
    description: 'Theron follows evidence into danger and refuses a comfortable explanation.',
  },
  {
    key: 'defiant',
    variable: 'PATH_DEFIANT',
    label: 'Defiant',
    title: 'The Defiant',
    description: 'Theron challenges the people who turn procedure into permission to ignore harm.',
  },
  {
    key: 'maker',
    variable: 'PATH_MAKER',
    label: 'Maker',
    title: 'The Maker',
    description: 'Theron trusts craft, preparation, and practical solutions when certainty fails.',
  },
];

const finiteScore = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export function journeyPathScores(state: RunState) {
  return JOURNEY_PATHS.map((path) => ({
    ...path,
    score: finiteScore(state.variables?.[path.variable]),
  }));
}

export function dominantJourneyPath(state: RunState) {
  const ranked = journeyPathScores(state).sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 0 ? ranked[0] : null;
}

export function journeyPathLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return JOURNEY_PATHS.find((path) => path.key === key)?.label ?? null;
}

export function parseDecisionImpact(value: unknown): JourneyDecisionImpact | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.choice_text !== 'string' || raw.choice_text.length === 0) return null;
  const path = typeof raw.path === 'string' ? raw.path : null;
  return {
    choice_text: raw.choice_text,
    path,
    path_label: typeof raw.path_label === 'string' ? raw.path_label : journeyPathLabel(path),
    outcome_text: typeof raw.outcome_text === 'string' ? raw.outcome_text : null,
    impact: Array.isArray(raw.impact)
      ? raw.impact.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [],
  };
}

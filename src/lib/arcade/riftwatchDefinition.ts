import { RIFTWATCH_KEY, RIFTWATCH_RULESET } from '../../../supabase/functions/_shared/arcade/rules';

// Safe to read on Home. The simulation, art and audio load with the cartridge.
export const RIFTWATCH = {
  key: RIFTWATCH_KEY,
  name: 'Riftwatch',
  tagline: 'Hold the line. Seal the sky.',
  shortDescription: 'Pilot a ward-skiff through descending rift formations.',
  route: '/riftwatch',
  practiceRoute: '/riftwatch/practice',
  rulesetVersion: RIFTWATCH_RULESET,
  supportsRankedScores: true,
  supportsPractice: true,
  leaderboardPeriods: ['today', 'week', 'all_time'],
  accentColor: '#45C4B0',
  thumbnailAsset: '/games/riftwatch/cartridge.png',
} as const;

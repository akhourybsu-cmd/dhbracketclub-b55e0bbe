import type { ComponentType } from 'react';
import { RIFTWATCH } from '@/lib/arcade/riftwatchDefinition';

export interface PocketGameProps {
  onExitPocketGame: () => void;
}

export interface PocketCartridge {
  id: string;
  assetSlug: string;
  title: string;
  edition: string;
  labelArtwork: string;
  arcade?: {
    rulesetVersion: string;
    supportsRankedScores: boolean;
    supportsPractice: boolean;
    leaderboardPeriods: readonly ('today' | 'week' | 'all_time')[];
    shortDescription: string;
    route: string;
    accentColor: string;
  };
  load: () => Promise<{ default: ComponentType<PocketGameProps> }>;
}

// The home launcher also reads this catalog. Game code loads only on insertion.
export const POCKET_CARTRIDGES: readonly PocketCartridge[] = [
  {
    id: 'mesomon',
    assetSlug: 'mesomon',
    title: 'Mesomon',
    edition: 'Port Marche',
    labelArtwork: '/games/mesomon/cover.webp?v=5',
    load: () => import('@/pages/MesomonPage').then(module => ({ default: module.PocketMesomon })),
  },
  {
    id: RIFTWATCH.key,
    assetSlug: RIFTWATCH.key,
    title: RIFTWATCH.name,
    edition: 'Formation arcade',
    labelArtwork: RIFTWATCH.thumbnailAsset,
    arcade: RIFTWATCH,
    load: () => import('@/pages/RiftwatchPage'),
  },
];

export function hasPocketCartridges(installed: ReadonlySet<string>) {
  return POCKET_CARTRIDGES.some(cartridge => installed.has(cartridge.assetSlug));
}

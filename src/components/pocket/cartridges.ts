import type { ComponentType } from 'react';

export interface PocketGameProps {
  onExitPocketGame: () => void;
}

export interface PocketCartridge {
  id: string;
  assetSlug: string;
  title: string;
  edition: string;
  labelArtwork: string;
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
];

export function hasPocketCartridges(installed: ReadonlySet<string>) {
  return POCKET_CARTRIDGES.some(cartridge => installed.has(cartridge.assetSlug));
}

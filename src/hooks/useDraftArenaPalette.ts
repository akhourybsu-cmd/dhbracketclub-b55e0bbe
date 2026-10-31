import { useCallback, useEffect, useState } from 'react';

export const DRAFT_ARENA_PALETTES = [
  { id: 'heritage', label: 'Heritage Bronze', swatchClass: 'da-palette-swatch-heritage' },
  { id: 'broadcast', label: 'Broadcast Blue', swatchClass: 'da-palette-swatch-broadcast' },
  { id: 'club', label: 'Club Emerald', swatchClass: 'da-palette-swatch-club' },
  { id: 'signal', label: 'Signal Red', swatchClass: 'da-palette-swatch-signal' },
] as const;

export type DraftArenaPalette = (typeof DRAFT_ARENA_PALETTES)[number]['id'];

const STORAGE_KEY = 'dh_draft_arena_palette_v1';
const CHANGE_EVENT = 'dh-draft-arena-palette-change';
let paletteOwners = 0;

function isPalette(value: string | null): value is DraftArenaPalette {
  return DRAFT_ARENA_PALETTES.some((palette) => palette.id === value);
}

function readPalette(): DraftArenaPalette {
  if (typeof window === 'undefined') return 'heritage';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isPalette(stored) ? stored : 'heritage';
  } catch {
    return 'heritage';
  }
}

export function useDraftArenaPalette() {
  const [palette, setPaletteState] = useState<DraftArenaPalette>(readPalette);

  useEffect(() => {
    paletteOwners++;
    return () => {
      paletteOwners--;
      if (paletteOwners === 0) delete document.documentElement.dataset.daPalette;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.daPalette = palette;
  }, [palette]);

  useEffect(() => {
    const sync = () => setPaletteState(readPalette());
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const setPalette = useCallback((next: DraftArenaPalette) => {
    setPaletteState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // A private browsing restriction should not prevent in-session theming.
    }
  }, []);

  return { palette, setPalette };
}

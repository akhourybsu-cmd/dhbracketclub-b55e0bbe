import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SeasonPodium } from '@/components/draft/SeasonPodium';

class ControlledImage extends EventTarget {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { super(); images.push(this); }
}
const images: ControlledImage[] = [];

beforeEach(() => {
  images.length = 0;
  vi.stubGlobal('Image', ControlledImage);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('replaces a failed champion portrait with an intact Unicode initial without retrying on unrelated updates', () => {
  const champion = { display_name: '🐴 Champion', avatar_url: 'https://example.test/broken-portrait.webp' };
  const view = render(<SeasonPodium champion={champion} seasonName="Season One" />);
  expect(images).toHaveLength(1);
  act(() => images[0].dispatchEvent(new Event('error')));
  const fallback = screen.getByLabelText(champion.display_name);
  expect(fallback).toHaveTextContent('🐴');
  view.rerender(<SeasonPodium champion={champion} seasonName="Season One · final standings" />);
  expect(images).toHaveLength(1);
  expect(screen.getByLabelText(champion.display_name)).toBe(fallback);
});

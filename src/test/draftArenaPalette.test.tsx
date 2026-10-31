import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';

afterEach(() => { cleanup(); localStorage.clear(); });

it('keeps the saved arena palette when an overlapping dialog subscriber unmounts', () => {
  localStorage.setItem('dh_draft_arena_palette_v1', 'broadcast');
  const layout = renderHook(() => useDraftArenaPalette());
  const composer = renderHook(() => useDraftArenaPalette());
  expect(document.documentElement.dataset.daPalette).toBe('broadcast');
  act(() => composer.result.current.setPalette('club'));
  expect(layout.result.current.palette).toBe('club');
  expect(document.documentElement.dataset.daPalette).toBe('club');
  composer.unmount();
  expect(document.documentElement.dataset.daPalette).toBe('club');
  layout.unmount();
  expect(document.documentElement.dataset.daPalette).toBeUndefined();
});

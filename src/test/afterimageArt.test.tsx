import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AfterimageArt } from '@/components/showdown/afterimage/AfterimageArt';
import { AfterimageScene } from '@/components/showdown/afterimage/AfterimageScene';
import { AFTERIMAGE_ASSET_IDS, AFTERIMAGE_THEME_IDS, type AfterimageSceneView } from '@/lib/showdown/afterimage/types';

afterEach(cleanup);

const scene: AfterimageSceneView = {
  id: 'miniature-workshop', version: 1, difficulty: 'easy', title: 'A quiet workshop',
  theme: 'workshop', background: 'workshop', width: 1000, height: 700, phase: 'reconstruct',
  objects: [{ id: 'fixed-piece', assetId: 'book', label: 'Book', x: 180, y: 185, layer: 0 }],
  slots: [{ id: 'place-a', x: 500, y: 405, width: 180, height: 160, layer: 1, label: 'Position 1' }, { id: 'place-b', x: 820, y: 605, width: 180, height: 160, layer: 1, label: 'Position 2' }],
  tray: [{ id: 'token-l', assetId: 'lantern', label: 'Lantern' }, { id: 'token-k', assetId: 'key', label: 'Key', orientation: 15 }],
  a11y: { label: 'Workshop memory scene', instructions: 'Return the missing objects to their positions.' },
};

describe('Afterimage original miniature artwork', () => {
  it('renders every registered asset with a distinctive local vector silhouette and accessible name', () => {
    const { container } = render(<>{AFTERIMAGE_ASSET_IDS.map(assetId => <AfterimageArt key={assetId} assetId={assetId} />)}</>);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(30);
    expect(new Set(images.map(image => image.getAttribute('aria-label'))).size).toBe(30);
    const silhouettes = images.map(image => Array.from(image.querySelectorAll('g path')).map(path => path.getAttribute('d')).join('|'));
    expect(new Set(silhouettes).size).toBe(30);
    expect(silhouettes.every(Boolean)).toBe(true);
    expect(container.querySelector('image,img,canvas')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('keeps paints isolated when the same object appears in multiple scene comparisons', () => {
    const { container } = render(<><AfterimageArt assetId="orb" /><AfterimageArt assetId="orb" /></>);
    const ids = Array.from(container.querySelectorAll('[id]')).map(node => node.id);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(ids.length);
    for (const node of container.querySelectorAll('[fill^="url(#"]')) {
      const target = node.getAttribute('fill')?.slice(5, -1);
      expect(ids).toContain(target);
    }
  });

  it('allows a decorative miniature without repeating the parent control name', () => {
    const { container } = render(<AfterimageArt assetId="flask" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).not.toHaveAttribute('aria-label');
  });
});

describe('Afterimage scene rendering and private recall feedback', () => {
  it('renders six deterministic architectural themes without external assets', () => {
    const { container, rerender } = render(<AfterimageScene scene={scene} />);
    const backgrounds = new Set<string>();
    for (const theme of AFTERIMAGE_THEME_IDS) {
      rerender(<AfterimageScene scene={{ ...scene, background: theme, theme }} />);
      expect(container.querySelector('[data-afterimage-theme]')).toHaveAttribute('data-afterimage-theme', theme);
      backgrounds.add(container.querySelector('.ai-scene-backdrop')?.innerHTML ?? '');
    }
    expect(backgrounds.size).toBe(6);
    expect(container.querySelector('image,img')).toBeNull();
  });

  it('uses canonical centers and 180×160 logical touch targets that exceed 44px at a 280px board', () => {
    render(<AfterimageScene scene={scene} />);
    const slot = screen.getByRole('button', { name: 'Position 1: empty' });
    expect(slot).toHaveStyle({ left: '50%', width: '18%' });
    expect(Number.parseFloat(slot.style.height)).toBeCloseTo(160 / 700 * 100);
    expect(280 * Number.parseFloat(slot.style.width) / 100).toBeGreaterThanOrEqual(44);
    expect(280 * 700 / 1000 * Number.parseFloat(slot.style.height) / 100).toBeGreaterThanOrEqual(44);
    expect(slot).toHaveAttribute('data-ai-slot', 'place-a');
    expect(slot).toHaveAttribute('data-afterimage-slot', 'place-a');
    expect(screen.getByRole('img', { name: 'Book, upper left' })).toHaveStyle({ left: '18%', width: '14%' });
  });

  it('never names missing answers or grades a placement during reconstruction', () => {
    const { container } = render(<AfterimageScene scene={scene} placements={{ 'place-a': 'token-k' }} feedback={{ 'place-a': 'wrong', 'place-b': 'correct' }} />);
    expect(screen.getByRole('button', { name: 'Position 1: Key' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Position 2: empty' })).toBeVisible();
    expect(container.querySelector('.ai-scene-slot-grade')).toBeNull();
    expect(container.querySelector('[class*="--wrong"],[class*="--correct"]')).toBeNull();
    expect(screen.queryByRole('img', { name: /Lantern/ })).toBeNull();
  });

  it('resolves placements only against the supplied tray tokens and ignores unknown IDs', () => {
    const { container } = render(<AfterimageScene scene={scene} placements={{ 'place-a': 'fixed-piece', 'place-b': 'lantern' }} />);
    expect(screen.getByRole('button', { name: 'Position 1: empty' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Position 2: empty' })).toBeVisible();
    expect(container.querySelector('.ai-scene-slot-art')).toBeNull();
  });

  it('supports tap selection and drag/drop without making score or answer decisions', () => {
    const select = vi.fn(), drop = vi.fn(), over = vi.fn(), start = vi.fn(), end = vi.fn();
    render(<AfterimageScene scene={scene} placements={{ 'place-a': 'token-k' }} selectedSlotId="place-a" onSlotSelect={select} onSlotDrop={drop} onSlotDragOver={over} onSlotDragStart={start} onSlotDragEnd={end} />);
    const slot = screen.getByRole('button', { name: 'Position 1: Key' });
    expect(slot).toHaveAttribute('aria-pressed', 'true');
    expect(slot).toHaveAttribute('draggable', 'true');
    fireEvent.click(slot);
    fireEvent.dragOver(slot);
    fireEvent.drop(slot);
    fireEvent.dragStart(slot);
    fireEvent.dragEnd(slot);
    expect(select).toHaveBeenCalledExactlyOnceWith('place-a');
    expect(drop.mock.calls[0][0]).toBe('place-a');
    expect(over.mock.calls[0][0]).toBe('place-a');
    expect(start.mock.calls[0][0]).toBe('place-a');
    expect(end.mock.calls[0][0]).toBe('place-a');
    expect(screen.getByRole('button', { name: 'Position 2: empty' })).toHaveAttribute('draggable', 'false');
  });

  it('reveals explicit grades only in completed-match results and keeps review noninteractive', () => {
    const select = vi.fn();
    const { container } = render(<AfterimageScene scene={{ ...scene, phase: 'review' }} mode="results" readOnly placements={{ 'place-a': 'token-k' }} feedback={{ 'place-a': 'wrong', 'place-b': 'empty' }} onSlotSelect={select} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Position 1: Key, wrong' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Position 2: empty, empty' })).toBeVisible();
    expect(container.querySelectorAll('.ai-scene-slot-grade')).toHaveLength(2);
    fireEvent.click(screen.getByRole('img', { name: 'Position 1: Key, wrong' }));
    expect(select).not.toHaveBeenCalled();
  });

  it('keeps a ready scene empty and presents study objects without recall controls', () => {
    const { container, rerender } = render(<AfterimageScene scene={{ ...scene, phase: 'ready', objects: [], slots: [], tray: [] }} />);
    expect(screen.getByRole('group', { name: 'Workshop memory scene' })).toBeVisible();
    expect(container.querySelectorAll('.ai-scene-object,.ai-scene-slot')).toHaveLength(0);
    rerender(<AfterimageScene scene={{ ...scene, phase: 'study', slots: [], tray: [] }} />);
    expect(screen.getByRole('img', { name: 'Book, upper left' })).toBeVisible();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FirstBondScene } from '@/components/mesomon/FirstBondScene';
import { BOND_ART } from '@/lib/mesomon/assets';
import type { BondShot } from '@/lib/mesomon/types';

afterEach(cleanup);
const frame = (shot: BondShot, reducedMotion = false, paused = false) =>
  <FirstBondScene shot={shot} reducedMotion={reducedMotion} paused={paused} />;

describe('First bond illustrations', () => {
  it('shows the saved moment, even when neighbouring plates finish loading first', () => {
    const view = render(frame('touch'));
    const image = (src: string) => view.container.querySelector<HTMLImageElement>(`img[src="${src}"]`)!;
    fireEvent.load(image(BOND_ART.offer));
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.load(image(BOND_ART.touch));
    expect(screen.getByRole('img', {name: /front paw/})).toHaveAttribute('data-bond-shot', 'touch');
    expect(view.container.querySelector('.mm-bond-setting')).toBeInTheDocument();
    expect(view.container.querySelector('.mm-bond-crystal')).toBeNull();
    view.rerender(frame('bond', true));
    expect(view.container.querySelector('.mm-bond-crystal')).toBeInTheDocument();
    expect(screen.getByRole('img', {name: /blue crystal/})).toHaveAttribute('data-still', 'true');
    expect(image(BOND_ART.touch)).toHaveAttribute('data-active', 'true');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the field visible when the selected plate cannot load, then uses another ready shot', () => {
    const view = render(frame('return'));
    const first = view.container.querySelector<HTMLImageElement>(`img[src="${BOND_ART.return}"]`)!;
    fireEvent.error(first);
    expect(view.container.firstElementChild).toHaveAttribute('data-ready', 'false');
    const offer = view.container.querySelector<HTMLImageElement>(`img[src="${BOND_ART.offer}"]`)!;
    fireEvent.load(offer);
    view.rerender(frame('glow', false, true));
    expect(screen.getByRole('img', {name: /tail/})).toHaveAttribute('data-paused', 'true');
    expect(view.container.querySelector('.mm-bond-core')).toBeInTheDocument();
    view.rerender(frame('offer'));
    expect(screen.getByRole('img', {name: /open hand/})).toHaveAttribute('data-bond-shot', 'offer');
    expect(view.container.querySelector('.mm-bond-tail')).toBeNull();
    expect(offer).toHaveAttribute('data-active', 'true');
  });
});

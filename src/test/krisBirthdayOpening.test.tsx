import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import KrisBirthdayOpening from '@/components/celebrations/KrisBirthdayOpening';

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => motion.reduced }));
vi.mock('@/components/Confetti', () => ({ Confetti: () => <canvas data-testid="confetti" /> }));

function Opening() {
  const [open, setOpen] = useState(true);
  return open ? <KrisBirthdayOpening onDismiss={() => setOpen(false)} /> : <h1>Club home</h1>;
}

describe('Kris birthday card', () => {
  it('opens with an accessible greeting, lets the member celebrate again, and enters the app', async () => {
    motion.reduced = false;
    render(<Opening />);
    expect(screen.getByRole('dialog', { name: 'Happy birthday, Kris!' })).toHaveAccessibleDescription('Love, your DH crew.');
    const button = screen.getByRole('button', { name: 'Enter DH Club' });
    await waitFor(() => expect(button).toHaveFocus());
    const first = screen.getByTestId('confetti');
    fireEvent.click(screen.getByRole('button', { name: 'Throw confetti' }));
    expect(screen.getByTestId('confetti')).not.toBe(first);
    fireEvent.click(button);
    expect(screen.getByRole('heading', { name: 'Club home' })).toBeVisible();
  });

  it('offers a still card and Escape dismissal when reduced motion is enabled', async () => {
    motion.reduced = true;
    render(<Opening />);
    expect(screen.queryByTestId('confetti')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Throw confetti' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(await screen.findByRole('heading', { name: 'Club home' })).toBeVisible();
  });
});

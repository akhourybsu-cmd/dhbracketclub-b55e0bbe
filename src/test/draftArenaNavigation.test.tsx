import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftArenaAppearance, DraftArenaPaletteList } from '@/components/drafts/DraftArenaAppearance';
import { DraftArenaMenu } from '@/components/drafts/DraftArenaMenu';
import { DraftArenaHUD } from '@/components/drafts/DraftArenaHUD';

vi.mock('@/hooks/useDraftSeasons', () => ({
  useCurrentSeason: () => ({ season: { id: 'season-4', season_number: 4 } }),
  formatSeasonChip: () => 'S4',
}));

afterEach(() => { cleanup(); localStorage.clear(); });

describe('Draft Arena navigation and display controls', () => {
  it('supports radio-group arrow keys, wrapping and one tab stop while saving the selected palette', () => {
    render(<DraftArenaPaletteList />);
    const bronze = screen.getByRole('radio', { name: 'Heritage Bronze' });
    const red = screen.getByRole('radio', { name: 'Signal Red' });
    bronze.focus();
    fireEvent.keyDown(bronze, { key: 'ArrowLeft' });
    expect(red).toHaveFocus();
    expect(red).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('dh_draft_arena_palette_v1')).toBe('signal');
    expect(screen.getAllByRole('radio').filter((option) => option.tabIndex === 0)).toEqual([red]);
    fireEvent.keyDown(red, { key: 'Home' });
    expect(bronze).toHaveFocus();
    expect(bronze).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(bronze, { key: 'End' });
    expect(red).toHaveFocus();
    fireEvent.keyDown(red, { key: 'ArrowRight' });
    expect(bronze).toHaveFocus();
    expect(bronze).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps keyboard focus in the active palette group when several presentations are mounted', () => {
    render(<><DraftArenaPaletteList /><DraftArenaPaletteList /></>);
    const [first, second] = screen.getAllByRole('radiogroup', { name: 'Draft Arena palette' });
    const initial = within(first).getByRole('radio', { name: 'Heritage Bronze' });
    initial.focus();
    fireEvent.keyDown(initial, { key: 'ArrowDown' });
    expect(within(first).getByRole('radio', { name: 'Broadcast Blue' })).toHaveFocus();
    expect(within(second).getByRole('radio', { name: 'Broadcast Blue' })).toHaveAttribute('aria-checked', 'true');
  });

  it('names the standalone palette popover and dismisses it with Escape', async () => {
    render(<DraftArenaAppearance />);
    fireEvent.click(screen.getByRole('button', { name: 'Draft Arena color palette' }));
    const panel = await screen.findByRole('dialog', { name: 'Arena palette' });
    expect(panel).toBeVisible();
    fireEvent.keyDown(panel, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Arena palette' })).not.toBeInTheDocument());
  });

  it('matches the lobby fallback tab and closes the drawer on external route changes', async () => {
    let navigate: ReturnType<typeof useNavigate>;
    function Harness() {
      navigate = useNavigate();
      return <DraftArenaMenu />;
    }
    render(<MemoryRouter initialEntries={['/drafts?tab=unknown']}><Harness /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Draft Arena menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Draft Arena menu' });
    expect(within(drawer).getByRole('link', { name: /Draft rooms/ })).toHaveAttribute('aria-current', 'page');
    act(() => navigate('/drafts?tab=stats'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Draft Arena menu' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Draft Arena menu' }));
    expect(within(await screen.findByRole('dialog', { name: 'Draft Arena menu' })).getByRole('link', { name: /Career stats/ })).toHaveAttribute('aria-current', 'page');
  });

  it('retains exit cancellation and destination while clearing stale confirmation after navigation', async () => {
    let navigate: ReturnType<typeof useNavigate>;
    function Harness() {
      navigate = useNavigate();
      const location = useLocation();
      return <><DraftArenaHUD /><output data-testid="arena-route">{location.pathname}</output></>;
    }
    render(<MemoryRouter initialEntries={['/drafts']}><Harness /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Exit Draft Arena' }));
    await screen.findByRole('alertdialog', { name: 'Leave the Draft Arena?' });
    fireEvent.click(screen.getByRole('button', { name: 'Stay in the Arena' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('arena-route')).toHaveTextContent('/drafts');
    fireEvent.click(screen.getByRole('button', { name: 'Exit Draft Arena' }));
    await screen.findByRole('alertdialog');
    act(() => navigate('/drafts/active'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    act(() => navigate('/drafts'));
    fireEvent.click(screen.getByRole('button', { name: 'Exit Draft Arena' }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    await waitFor(() => expect(screen.getByTestId('arena-route')).toHaveTextContent('/compete'));
  });
});

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DHPocketPage from '@/pages/DHPocketPage';
import type { PocketCartridge, PocketGameProps } from '@/components/pocket/cartridges';

const settings = vi.hoisted(() => ({
  active: new Set(['mesomon', 'test-title']),
  visible: new Set(['mesomon', 'test-title']),
  admin: false,
  failures: 0,
  loads: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club' }, isClubAdmin: settings.admin, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({
  useClubAssets: () => ({
    loading: false, refresh: vi.fn(),
    isInstalled: (slug: string) => settings.active.has(slug),
    isVisible: (slug: string) => settings.visible.has(slug),
  }),
}));
vi.mock('@/components/pocket/cartridges', async importOriginal => {
  const actual = await importOriginal<typeof import('@/components/pocket/cartridges')>();
  function entry(id: string, title: string): PocketCartridge {
    return {
      ...actual.POCKET_CARTRIDGES[0], id, title, assetSlug: id,
      load: async () => {
        settings.loads(id);
        if (settings.failures > 0) {
          settings.failures--;
          throw new Error('Interrupted cartridge download');
        }
        return { default: ({ onExitPocketGame }: PocketGameProps) =>
          <button onClick={onExitPocketGame}>Eject {title}</button> };
      },
    };
  }
  return { ...actual, POCKET_CARTRIDGES: [entry('mesomon', 'Mesomon'), entry('test-title', 'Test Title')] };
});

function Home() {
  const navigate = useNavigate();
  return <><Link to="/dh-pocket">Launch DH Pocket</Link><button onClick={() => navigate(-1)}>History back</button></>;
}
function start(entries = ['/dashboard', '/dh-pocket']) {
  return render(<MemoryRouter initialEntries={entries}>
    <Routes><Route path="/dh-pocket" element={<DHPocketPage />} /><Route path="/dashboard" element={<Home />} /></Routes>
  </MemoryRouter>);
}
async function elapse(ms = 1800) { await act(() => vi.advanceTimersByTimeAsync(ms)); }
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const click = (name: string | RegExp) => fireEvent.click(button(name));

beforeEach(() => {
  localStorage.clear();
  settings.active = new Set(['mesomon', 'test-title']);
  settings.visible = new Set(settings.active);
  settings.admin = false;
  settings.failures = 0;
  settings.loads.mockClear();
  vi.useFakeTimers();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('DH Pocket cartridges', () => {
  it('powers up in the shell, selects a second cartridge with the D-pad and launches with A', async () => {
    start();
    const device = document.querySelector('.pocket-device');
    expect(screen.getByRole('img', { name: 'DH Games' })).toBeInTheDocument();
    expect(settings.loads).not.toHaveBeenCalled();
    await elapse();
    expect(screen.getByRole('heading', { name: 'Select a Game' })).toBeInTheDocument();
    expect(button('Play Mesomon')).toHaveFocus();
    click('Browse right');
    expect(button('Play Test Title')).toHaveFocus();
    click('A — Launch cartridge');
    expect(screen.getByText(/Loading Test Title/)).toBeInTheDocument();
    await elapse(1000);
    expect(document.querySelector('.pocket-device')).toBe(device);
    click('Eject Test Title');
    expect(screen.queryByRole('img', { name: 'DH Games' })).not.toBeInTheDocument();
    expect(button('Play Test Title')).toHaveFocus();
    expect(button('Play Test Title')).toHaveAttribute('aria-current', 'true');
    expect(settings.loads.mock.calls).toEqual([['test-title']]);
  });

  it('keeps card focus in step with arrow keys, restores the last choice when reopened and allows a direct tap', async () => {
    start();
    await elapse();
    fireEvent.keyDown(button('Play Mesomon'), { key: 'ArrowLeft' });
    expect(button('Play Test Title')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'z' });
    await elapse(1000);
    click('Eject Test Title');
    click('Close handheld and return to DH Club');
    fireEvent.click(screen.getByRole('link', { name: 'Launch DH Pocket' }));
    await elapse();
    expect(button('Play Test Title')).toHaveFocus();
    click('Play Mesomon');
    await elapse(1000);
    expect(button('Eject Mesomon')).toBeInTheDocument();
  });

  it('does not leave the shelf underneath Home when powered off from a running game', async () => {
    start();
    await elapse();
    click('Play Mesomon');
    await elapse(1000);
    click('Close handheld and return to DH Club');
    expect(screen.getByRole('link', { name: 'Launch DH Pocket' })).toBeInTheDocument();
    click('History back');
    expect(screen.getByRole('link', { name: 'Launch DH Pocket' })).toBeInTheDocument();
  });

  it('resumes a cartridge URL after reload and ejects to its shelf when entered directly', async () => {
    start(['/dh-pocket?game=test-title']);
    expect(screen.getByText(/Loading Test Title/)).toBeInTheDocument();
    await elapse();
    click('Eject Test Title');
    expect(button('Play Test Title')).toHaveFocus();
  });

  it('filters hidden cartridges even on a direct URL and provides an empty library', async () => {
    settings.visible.clear();
    start(['/dh-pocket?game=mesomon']);
    await elapse();
    expect(screen.getByRole('heading', { name: 'No cartridges installed' })).toBeInTheDocument();
    expect(settings.loads).not.toHaveBeenCalled();
    expect(button('A — Launch cartridge')).toBeDisabled();
    click('B — Close handheld');
    expect(screen.getByRole('link', { name: 'Launch DH Pocket' })).toBeInTheDocument();
  });

  it('allows admins to launch hidden installed titles and recovers an interrupted module fetch', async () => {
    settings.visible.clear();
    settings.admin = true;
    settings.failures = 1;
    start(['/dh-pocket?game=mesomon']);
    await elapse();
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load Mesomon');
    click('Try again');
    await elapse();
    expect(button('Eject Mesomon')).toBeInTheDocument();
    expect(settings.loads).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending insertion before the cartridge can mount', async () => {
    start();
    await elapse();
    click('Play Test Title');
    click('B — Return to cartridges');
    await elapse();
    expect(button('Play Test Title')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Eject Test Title' })).not.toBeInTheDocument();
  });
});

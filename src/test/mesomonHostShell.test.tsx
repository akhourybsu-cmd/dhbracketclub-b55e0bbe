import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useThemeChrome } from '@/hooks/useThemeChrome';
import { isMesomonConsole } from '@/lib/appNavigation';
import { fetchRemoteBuildId, nukeAndReload } from '@/lib/forceUpdate';

vi.mock('@/lib/forceUpdate', () => ({ fetchRemoteBuildId: vi.fn(), nukeAndReload: vi.fn() }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('sonner', () => ({ toast: vi.fn() }));

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function Shell() {
  const { pathname } = useLocation();
  useThemeChrome(isMesomonConsole(pathname));
  useAppUpdate();
  return <><Link to="/mesomon">Play</Link><Link to="/compete">Exit</Link></>;
}

function openShell(path: string) {
  history.replaceState({}, '', path);
  return render(<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Shell /></BrowserRouter>);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState({}, '', '/');
  document.querySelector('meta[name="theme-color"]')?.remove();
  document.querySelector('meta[name="color-scheme"]')?.remove();
});

describe('Mesomon console identity', () => {
  it('opens and restores the actual document head on cold launches and client navigation', () => {
    const document = new DOMParser().parseFromString(read('index.html'), 'text/html');
    const script = Array.from(document.scripts).find(tag => tag.textContent?.includes('dh:route-changed'));
    const location = { pathname: '/MESOMON/' };
    const link = (rel: string) => document.querySelector(`link[rel="${rel}"]`)?.getAttribute('href');
    const meta = (name: string) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
    const originalTitle = document.title;
    expect(script).toBeDefined();
    runInNewContext(script!.textContent!, { document, location });

    expect(document.title).toBe('Mesomon · Port Marche');
    expect(meta('theme-color')).toBe('#102224');
    expect(meta('apple-mobile-web-app-title')).toBe('Mesomon');
    expect(link('manifest')).toBe('/games/mesomon/app.webmanifest');
    expect(link('icon')).toBe('/games/mesomon/icon-192.png');
    expect(link('apple-touch-icon')).toBe('/games/mesomon/icon-192.png');

    for (const path of ['/compete', '/mesomon-news', '/mesomon/save/1', '/mesomon']) {
      location.pathname = path;
      document.dispatchEvent(new Event('dh:route-changed'));
      expect(document.documentElement.hasAttribute('data-mesomon-console')).toBe(isMesomonConsole(path));
      expect(document.title).toBe(isMesomonConsole(path) ? 'Mesomon · Port Marche' : originalTitle);
      expect(link('manifest')).toBe(isMesomonConsole(path) ? '/games/mesomon/app.webmanifest' : '/manifest.webmanifest');
      expect(link('icon')).toBe(isMesomonConsole(path) ? '/games/mesomon/icon-192.png' : '/favicon.png');
      expect(meta('apple-mobile-web-app-title')).toBe(isMesomonConsole(path) ? 'Mesomon' : 'DH Club');
    }
  });

  it('publishes separate game and club installs with correctly sized home-screen artwork', () => {
    const game = JSON.parse(read('public/games/mesomon/app.webmanifest'));
    const club = JSON.parse(read('public/manifest.webmanifest'));
    expect(game.id).not.toBe(club.id);
    expect(game.start_url).toBe('/mesomon');
    expect(game.display_override).toContain('fullscreen');
    expect(club.start_url).toMatch(/^\/dashboard/);
    for (const icon of game.icons) {
      const png = readFileSync(resolve(process.cwd(), 'public/games/mesomon', icon.src));
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
  });

  it.each([
    { entry: '/mesomon', gameMounted: false, recover: true },
    { entry: '/mesomon', gameMounted: true, recover: false },
    { entry: '/compete', gameMounted: true, recover: false },
  ])('handles a stale bootstrap response from $entry with gameMounted=$gameMounted', async ({ entry, gameMounted, recover }) => {
    const document = new DOMParser().parseFromString(read('index.html'), 'text/html');
    document.documentElement.toggleAttribute('data-mesomon-console', entry === '/mesomon');
    const script = Array.from(document.scripts).find(tag => tag.textContent?.includes('var forceKill'));
    const location = { href: `https://example.test${entry}`, replace: vi.fn() };
    localStorage.setItem('__dh_build_id__', 'old');
    let respond!: (response: { ok: boolean; text: () => string }) => void;
    const fetch = () => new Promise(resolve => { respond = resolve; });
    runInNewContext(script!.textContent!, {
      document, window: { location }, navigator: {}, URL, localStorage, sessionStorage, fetch,
      console: { warn: vi.fn(), error: vi.fn() },
    });
    if (gameMounted) {
      location.href = 'https://example.test/mesomon';
      document.documentElement.toggleAttribute('data-mesomon-console', true);
      const consoleShell = document.createElement('main');
      consoleShell.className = 'mm-device';
      document.body.append(consoleShell);
    }
    respond({ ok: true, text: () => '{"buildId":"latest"}' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(location.replace).toHaveBeenCalledTimes(recover ? 1 : 0);
    expect(sessionStorage.getItem('__dh_nuked__')).toBe(recover ? '1' : null);
  });

  it('keeps the console chrome dark, suppresses update checks, and restores a light club theme on exit', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchRemoteBuildId).mockResolvedValue('dev');
    openShell('/mesomon');
    const color = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
    expect(color.content).toBe('#102224');
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(40000);
    });
    expect(fetchRemoteBuildId).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByText('Exit')); });
    expect(color.content).toBe('#e9eeea');
    expect(fetchRemoteBuildId).toHaveBeenCalled();
  });

  it('defers a previously scheduled club update across a game session and applies it once on exit', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('__BUILD_ID__', 'local');
    vi.mocked(fetchRemoteBuildId).mockResolvedValue('next');
    await act(async () => { openShell('/compete'); });
    expect(localStorage.getItem('dh_update_last_prompted_remote_v1')).toBe('next');
    await act(async () => { fireEvent.click(screen.getByText('Play')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(11000); });
    expect(nukeAndReload).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByText('Exit')); });
    expect(nukeAndReload).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('dh_update_last_nuked_remote_v1')).toBe('next');
  });
});

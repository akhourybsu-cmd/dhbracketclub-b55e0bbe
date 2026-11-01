import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AssetGuard } from '@/components/auth/AssetGuard';
import { DeepClaimDiscoveryCard } from '@/components/deepClaim/DeepClaimDiscoveryCard';
import { DeepClaimMark } from '@/components/deepClaim/DeepClaimMark';
import { QuickBar } from '@/components/home/QuickBar';
import CompetePage from '@/pages/CompetePage';
import { ALL_NAV_ITEMS, activeTabPath, getRouteTitle, isGameShellRoute, isMobilePrimaryActive, navPathForRoute, pickMostUsedTabs } from '@/lib/appNavigation';
import { homeShortcut } from '@/lib/home/mobileHome';
import { getOnboarding } from '@/lib/onboarding/registry';
import { ONBOARDING_ICONS } from '@/lib/onboarding/icons';
import { NAV_ASSET_SLUGS, type InstalledAsset } from '@/types/assets';

const state = vi.hoisted(() => ({ installed: false, loading: false, appAdmin: false }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ isInstalled: (slug: string) => slug === 'deep-claim' && state.installed, loading: state.loading }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member-a' } }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-a' }, isAppAdmin: state.appAdmin }) }));
vi.mock('@/hooks/useDraftSeasons', () => ({ useCurrentSeason: () => ({ season: null, loading: false }), useSeasonEntries: () => ({ entries: [] }), getSeasonDraftTarget: () => 12 }));
vi.mock('@/components/showdown/ShowdownDiscoveryCard', () => ({ ShowdownDiscoveryCard: () => <div>Showdown discovery</div> }));

beforeEach(() => { state.installed = false; state.loading = false; state.appAdmin = false; });
afterEach(cleanup);

function guarded() {
  return <MemoryRouter initialEntries={['/deep-claim']}><Routes><Route path="/deep-claim" element={<AssetGuard slug="deep-claim"><h1>Your company</h1></AssetGuard>} /><Route path="/dashboard" element={<h1>DH Home</h1>} /></Routes></MemoryRouter>;
}

describe('Deep Claim existing application integration', () => {
  it('joins canonical navigation, titles, Compete context and immersive shells exactly once', () => {
    expect(ALL_NAV_ITEMS.filter(item => item.path === '/deep-claim')).toHaveLength(1);
    expect(NAV_ASSET_SLUGS['/deep-claim']).toBe('deep-claim');
    expect(getRouteTitle('/deep-claim')).toBe('Deep Claim');
    expect(navPathForRoute('/deep-claim')).toBe('/deep-claim');
    expect(isGameShellRoute('/deep-claim')).toBe(true);
    expect(isMobilePrimaryActive('/deep-claim', '/compete')).toBe(true);
    const defaults = pickMostUsedTabs({}, ALL_NAV_ITEMS);
    expect(defaults.map(item => item.path)).toEqual(['/dashboard', '/chat', '/finds', '/compete']);
    expect(activeTabPath('/deep-claim', defaults)).toBe('/compete');
  });

  it('provides the installed home shortcut without adding a new homepage panel', () => {
    expect(homeShortcut('deep-claim')).toEqual(expect.objectContaining({ path: '/deep-claim', label: 'Deep Claim' }));
    const installed = { id: 'installed', asset: { slug: 'deep-claim', name: 'Deep Claim' } } as InstalledAsset;
    render(<MemoryRouter><QuickBar pinned={[installed]} accent="152 72% 46%" onEditClick={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/deep-claim');
  });

  it('uses the current three-step onboarding and available icon map', () => {
    const intro = getOnboarding('deep-claim');
    expect(intro).toEqual(expect.objectContaining({ featureType: 'game', featureKey: 'deep-claim', version: 1 }));
    expect(intro?.onboardingSteps).toHaveLength(3);
    expect(intro?.primaryCta.route).toBe('/deep-claim');
    expect(intro?.onboardingSteps[1].body).toMatch(/exploration or extraction/);
    expect(intro?.onboardingSteps[2].body).toMatch(/while you are away/);
    for (const step of intro?.onboardingSteps ?? []) expect(ONBOARDING_ICONS[step.iconKey!]).toBeTruthy();
    expect(ONBOARDING_ICONS[intro!.iconKey!]).toBeTruthy();
  });

  it('keeps the Compete card hidden until this club installs and enables the asset', () => {
    const view = render(<MemoryRouter><CompetePage /></MemoryRouter>);
    expect(screen.queryByRole('heading', { name: 'Deep Claim' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Draft Arena' })).toBeInTheDocument();
    state.installed = true;
    view.rerender(<MemoryRouter><CompetePage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Deep Claim' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /A PROSPECTOR’S EMPIRE Deep Claim/ })).toHaveAttribute('href', '/deep-claim');
  });

  it('redirects a direct link when the asset is not installed', () => {
    render(guarded());
    expect(screen.getByRole('heading', { name: 'DH Home' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your company' })).toBeNull();
  });

  it('waits for asset hydration before redirecting or exposing the game', () => {
    state.loading = true;
    render(guarded());
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('allows the existing installed-member flow and preserves the existing admin audit bypass', () => {
    state.installed = true;
    const view = render(guarded());
    expect(screen.getByRole('heading', { name: 'Your company' })).toBeInTheDocument();
    state.installed = false; state.appAdmin = true;
    view.rerender(guarded());
    expect(screen.getByRole('heading', { name: 'Your company' })).toBeInTheDocument();
  });

  it('registers a lazy asset-guarded route inside the established protected club shell', () => {
    const source = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    expect(source).toContain('const DeepClaimPage = lazyWithRetry(() => import("./pages/DeepClaimPage"))');
    expect(source).toContain('<Route path="/deep-claim" element={<ProtectedPage assetSlug="deep-claim"><DeepClaimPage /></ProtectedPage>} />');
    expect(source).toMatch(/<ProtectedRoute>\s*<ClubGate>/);
  });

  it('uses a self-contained original emblem and a single real discovery link', () => {
    const view = render(<DeepClaimMark label="Deep Claim company emblem" />);
    expect(screen.getByRole('img', { name: 'Deep Claim company emblem' })).toBeVisible();
    expect(view.container.querySelector('image,img,canvas')).toBeNull();
    view.rerender(<MemoryRouter><DeepClaimDiscoveryCard /></MemoryRouter>);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/deep-claim');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MesomonDiscoveryCard } from '@/components/mesomon/MesomonDiscoveryCard';
import { APP_NAV_SECTIONS, getRouteTitle, isGameShellRoute, isMobilePrimaryActive, navPathForRoute } from '@/lib/appNavigation';
import { getOnboarding } from '@/lib/onboarding/registry';
import { NAV_ASSET_SLUGS } from '@/types/assets';

afterEach(cleanup);

describe('Mesomon in the shared DH application', () => {
  it('has one asset-backed navigation destination grouped with games', () => {
    const games = APP_NAV_SECTIONS.find(section => section.label === 'Games & stories');
    const entries = APP_NAV_SECTIONS.flatMap(section => section.items).filter(item => item.path === '/mesomon');
    expect(entries).toHaveLength(1);
    expect(games?.items).toContain(entries[0]);
    expect(NAV_ASSET_SLUGS[entries[0].path]).toBe('mesomon');
    expect(navPathForRoute('/mesomon')).toBe('/mesomon');
    expect(isMobilePrimaryActive('/mesomon', '/compete')).toBe(true);
  });

  it('uses the immersive shell only for its real route while preserving ordinary pages', () => {
    expect(isGameShellRoute('/mesomon')).toBe(true);
    expect(isGameShellRoute('/mesomon/save/1')).toBe(true);
    expect(isGameShellRoute('/mesomon-settings')).toBe(false);
    expect(isGameShellRoute('/mesomonic')).toBe(false);
    for (const page of ['/compete', '/dashboard', '/chat', '/club', '/finds']) {
      expect(isGameShellRoute(page)).toBe(false);
    }
    for (const page of ['/deep-claim', '/drafts/lineup/123', '/showdown/123', '/rune-delve']) {
      expect(isGameShellRoute(page)).toBe(true);
    }
    expect(getRouteTitle('/mesomon')).toBe('Mesomon');
    expect(getRouteTitle('/mesomonic')).toBe('DH Club');
  });

  it('reuses installation onboarding with a short, directly playable introduction', () => {
    const onboarding = getOnboarding('mesomon');
    expect(onboarding?.featureType).toBe('game');
    expect(onboarding?.primaryCta.route).toBe('/mesomon');
    expect(onboarding?.onboardingSteps).toHaveLength(3);
    expect(onboarding?.onboardingSteps.some(step => step.body.includes('demons cannot be bonded'))).toBe(true);
    expect(onboarding?.onboardingSteps.every(step => step.body.length < 190)).toBe(true);
  });

  it('offers a single accessible discovery link without loading the game engine', () => {
    const { container } = render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(MesomonDiscoveryCard)));
    const link = screen.getByRole('link', { name: /Mesomon.*Enter Port Marche/i });
    expect(link).toHaveAttribute('href', '/mesomon');
    expect(screen.getByRole('heading', { name: 'Mesomon' })).toBeVisible();
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy');
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  APP_NAV_SECTIONS,
  ALL_NAV_ITEMS,
  activeTabPath,
  navPathForRoute,
  pickMostUsedTabs,
  getRouteTitle,
  isGameShellRoute,
  isMobilePrimaryActive,
  isRouteActive,
} from '@/lib/appNavigation';

describe('shared app navigation', () => {
  it('keeps shared route paths unique', () => {
    const paths = APP_NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('starts new members on Home, Chat, Drop, Compete', () => {
    expect(pickMostUsedTabs({}, ALL_NAV_ITEMS).map((i) => i.path)).toEqual(['/dashboard', '/chat', '/finds', '/compete']);
  });

  it('promotes the three most used destinations after Home', () => {
    const tabs = pickMostUsedTabs({ '/drafts': 9, '/portfolio-wars': 5, '/chat': 2, '/finds': 1 }, ALL_NAV_ITEMS);
    expect(tabs.map((i) => i.path)).toEqual(['/dashboard', '/drafts', '/portfolio-wars', '/chat']);
  });

  it('never offers an uninstalled app as a tab', () => {
    const available = ALL_NAV_ITEMS.filter((i) => i.path !== '/drafts');
    expect(pickMostUsedTabs({ '/drafts': 50 }, available).map((i) => i.path)).not.toContain('/drafts');
  });

  it('counts nested routes toward their destination', () => {
    expect(navPathForRoute('/drafts/abc/magazine')).toBe('/drafts');
    expect(navPathForRoute('/pickem/week/3')).toBe('/nfl');
  });

  it('lights only the exact tab, not its hub', () => {
    const tabs = pickMostUsedTabs({}, ALL_NAV_ITEMS);
    expect(activeTabPath('/finds/123', tabs)).toBe('/finds');
  });

  it('does not make hub tabs active on their nested feature routes', () => {
    expect(isRouteActive('/club', '/club')).toBe(true);
    expect(isRouteActive('/club/settings', '/club')).toBe(false);
    expect(isRouteActive('/compete', '/compete')).toBe(true);
    expect(isRouteActive('/drafts/123', '/compete')).toBe(false);
  });

  it('groups legacy pool routes under Brackets', () => {
    expect(isRouteActive('/pools/abc/leaderboard', '/brackets')).toBe(true);
  });

  it('keeps mobile hub context active on nested destinations', () => {
    expect(isMobilePrimaryActive('/events/123', '/club')).toBe(true);
    expect(isMobilePrimaryActive('/brackets', '/compete')).toBe(true);
    expect(isMobilePrimaryActive('/nfl/crazy-chain', '/compete')).toBe(true);
    expect(isMobilePrimaryActive('/pickem/week/2', '/compete')).toBe(true);
    expect(isMobilePrimaryActive('/chat', '/club')).toBe(false);
  });

  it('identifies immersive game routes without treating community routes as games', () => {
    expect(isGameShellRoute('/nexus/battle/1')).toBe(true);
    expect(isGameShellRoute('/workouts/log')).toBe(true);
    expect(isGameShellRoute('/nfl/crazy-chain')).toBe(true);
    expect(isGameShellRoute('/chat')).toBe(false);
    expect(isGameShellRoute('/club')).toBe(false);
  });

  it('provides stable shell titles with a safe fallback', () => {
    expect(getRouteTitle('/club/settings')).toBe('Club Settings');
    expect(getRouteTitle('/notifications')).toBe('Notifications');
    expect(getRouteTitle('/future-surface')).toBe('DH Club');
  });
});

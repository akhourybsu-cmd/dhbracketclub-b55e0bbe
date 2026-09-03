import { describe, expect, it } from 'vitest';
import {
  APP_NAV_SECTIONS,
  MOBILE_PRIMARY_NAV,
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

  it('keeps the mobile bar focused on five primary destinations', () => {
    expect(MOBILE_PRIMARY_NAV.map((item) => item.path)).toEqual([
      '/dashboard',
      '/chat',
      '/compete',
      '/club',
      '/profile',
    ]);
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
    expect(isMobilePrimaryActive('/chat', '/club')).toBe(false);
  });

  it('identifies immersive game routes without treating community routes as games', () => {
    expect(isGameShellRoute('/nexus/battle/1')).toBe(true);
    expect(isGameShellRoute('/workouts/log')).toBe(true);
    expect(isGameShellRoute('/chat')).toBe(false);
    expect(isGameShellRoute('/club')).toBe(false);
  });

  it('provides stable shell titles with a safe fallback', () => {
    expect(getRouteTitle('/club/settings')).toBe('Club Settings');
    expect(getRouteTitle('/notifications')).toBe('Notifications');
    expect(getRouteTitle('/future-surface')).toBe('DH Club');
  });
});

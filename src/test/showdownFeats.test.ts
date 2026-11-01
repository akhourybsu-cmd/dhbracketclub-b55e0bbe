import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import showdownCatalog from '@/lib/feats/showdownCatalog.json';
import originalCatalog from '@/lib/feats/catalog.json';
import expeditionCatalog from '@/lib/feats/runeExpeditionCatalog.json';
import puzzleCatalog from '@/lib/feats/runePuzzleCatalog.json';
import { FEAT_CATEGORIES, FEAT_TIERS, featActionPath, featProgress } from '@/lib/feats/progression';
import type { FeatDefinition, FeatUnlock } from '@/lib/feats/types';

describe('Showdown source-backed DH Feats', () => {
  it('adds six finite families without replacing any existing category or tier system', () => {
    const all = [...originalCatalog, ...expeditionCatalog, ...puzzleCatalog, ...showdownCatalog];
    expect(new Set(all.map(row => row.key)).size).toBe(all.length);
    expect(all).toHaveLength(76);
    expect(showdownCatalog).toHaveLength(6);
    expect(showdownCatalog.reduce((sum, feat) => sum + feat.points.reduce((a, b) => a + b, 0), 0)).toBe(595);
    for (const feat of showdownCatalog) {
      expect(feat.category).toBe('showdown');
      expect(feat.thresholds).toHaveLength(FEAT_TIERS.length);
      expect(feat.points).toHaveLength(feat.thresholds.length);
      feat.thresholds.forEach((target, index) => {
        expect(target).toBeGreaterThan(index ? feat.thresholds[index - 1] : 0);
        expect(feat.points[index]).toBeGreaterThan(0);
        expect(feat.points[index]).toBeLessThanOrEqual(50);
      });
      expect(featActionPath(feat)).toBe('/showdown');
    }
    expect(FEAT_CATEGORIES.showdown).toEqual({ name: 'DH Showdown', asset: 'dh-showdown', path: '/showdown', icon: 'Swords' });
  });
  it('keeps the browser catalog exactly equal to the migration-backed definitions', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261101030000_showdown_discovery_feats.sql'), 'utf8');
    const raw = sql.match(/\$showdown_catalog\$([\s\S]*?)\$showdown_catalog\$/)?.[1];
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual(showdownCatalog);
  });
  it('preserves earned receipts after source totals change, without generating a new reward path', () => {
    const feat = showdownCatalog[0] as FeatDefinition;
    const unlock: FeatUnlock = { feat_key: feat.key, tier: 1, points: feat.points[0], target: feat.thresholds[0], historical: false, earned_at: '2026-11-01T00:00:00Z' };
    const progress = featProgress(feat, 0, [unlock]);
    expect(progress.earned).toBe(1);
    expect(progress.earnedPoints).toBe(5);
    expect(progress.current).toBe(1);
    expect(progress.target).toBe(5);
    expect(progress.index).toBe(1);
  });
});

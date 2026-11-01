import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import catalog from '@/lib/feats/deepClaimCatalog.json';
import { FEAT_CATEGORIES, featActionPath, unseenFeats } from '@/lib/feats/progression';
import { FeatIcon } from '@/components/feats/FeatArtwork';
import { notifIcon } from '@/components/notifications/meta';
import type { FeatBoard, FeatUnlock } from '@/lib/feats/types';

describe('Deep Claim uses the shared DH Feats and inbox', () => {
  it('publishes seven stable source families and a finite 590-point, 32-unlock budget', () => {
    expect(catalog).toHaveLength(7);
    expect(new Set(catalog.map(item => item.key)).size).toBe(7);
    expect(catalog.reduce((sum, item) => sum + item.points.length, 0)).toBe(32);
    expect(catalog.flatMap(item => item.points).reduce((sum, points) => sum + points, 0)).toBe(590);
    for (const item of catalog) {
      expect(item.category).toBe('deep_claim'); expect(item.points).toHaveLength(item.thresholds.length);
      item.thresholds.forEach((target, index) => { expect(target).toBeGreaterThan(index ? item.thresholds[index - 1] : 0); expect(item.points[index]).toBeGreaterThan(0); });
      expect(featActionPath(item)).toBe('/deep-claim');
    }
    expect(FEAT_CATEGORIES.deep_claim).toMatchObject({ asset: 'deep-claim', path: '/deep-claim' });
  });
  it('ships the same canonical definitions as the actual SQL integration', () => {
    const sql = readFileSync('supabase/migrations/20261102061000_deep_claim_dh_integration.sql', 'utf8');
    const embedded = sql.match(/\$dc_feat_catalog\$([\s\S]*?)\$dc_feat_catalog\$/)?.[1];
    expect(embedded).toBeTruthy(); expect(JSON.parse(embedded!)).toEqual(catalog);
  });
  it('keeps imported history outside new-unlock celebrations', () => {
    const receipts: FeatUnlock[] = [
      { feat_key: 'deep_claim_shifts', tier: 1, points: 5, target: 1, historical: true, earned_at: '2026-11-01T12:00:00Z' },
      { feat_key: 'deep_claim_research', tier: 1, points: 5, target: 1, historical: false, earned_at: '2026-11-01T12:00:00Z' },
    ];
    expect(unseenFeats({ unlocks: receipts, seen_at: '2026-11-01T11:00:00Z' } as FeatBoard).map(item => item.feat_key)).toEqual(['deep_claim_research']);
  });
  it('gives the existing goal artwork and notification inbox a real mining symbol', () => {
    const { container } = render(<FeatIcon name="Pickaxe" />);
    expect(container.querySelector('.lucide-pickaxe')).not.toBeNull();
    expect(notifIcon('deep_claim').icon).toBeTruthy(); expect(notifIcon('deep_claim').color).toBe('warning');
  });
});

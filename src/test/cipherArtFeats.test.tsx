import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CipherFeedback, CipherPeg } from '@/components/showdown/cipher/CipherPeg';
import { CipherMark } from '@/components/showdown/cipher/CipherMark';
import { CIPHER_COLOR_IDS } from '@/lib/showdown/cipher/types';
import cipherCatalog from '@/lib/feats/cipherCatalog.json';
import originalCatalog from '@/lib/feats/catalog.json';
import showdownCatalog from '@/lib/feats/showdownCatalog.json';
import expeditionCatalog from '@/lib/feats/runeExpeditionCatalog.json';
import puzzleCatalog from '@/lib/feats/runePuzzleCatalog.json';
import { FEAT_CATEGORIES, featActionPath, featProgress } from '@/lib/feats/progression';
import type { FeatDefinition, FeatUnlock } from '@/lib/feats/types';

afterEach(cleanup);

describe('Cipher Duel tactile local artwork', () => {
  it('gives all six colors distinct visible geometry and accessible color/symbol names', () => {
    const { container } = render(<>{CIPHER_COLOR_IDS.map(color => <CipherPeg key={color} color={color} />)}</>);
    expect(screen.getAllByRole('img')).toHaveLength(6);
    const symbols = Array.from(container.querySelectorAll('[data-cipher-symbol]'));
    expect(symbols.map(peg => peg.getAttribute('data-cipher-symbol'))).toEqual(['triangle', 'circle', 'cross', 'square', 'diamond', 'waves']);
    expect(new Set(symbols.map(peg => peg.querySelector('path[transform]')?.getAttribute('d'))).size).toBe(6);
    CIPHER_COLOR_IDS.forEach(color => expect(screen.getByRole('img', { name: new RegExp(`${color} peg, .* symbol`) })).toBeVisible());
    expect(container.querySelector('img,image')).toBeNull();
  });
  it('renders a recessed socket for null or undefined without a colored cap or symbol', () => {
    const { container } = render(<><CipherPeg /><CipherPeg color={null} /></>);
    expect(screen.getAllByRole('img', { name: 'Empty peg socket' })).toHaveLength(2);
    expect(container.querySelectorAll('[data-cipher-symbol="socket"]')).toHaveLength(2);
    expect(container.querySelectorAll('.cipher-peg--filled')).toHaveLength(0);
    expect(container.querySelectorAll('radialGradient')).toHaveLength(2);
  });
  it('supports repeated color pegs with isolated SVG paints', () => {
    const { container } = render(<>{Array.from({ length: 4 }, (_, index) => <CipherPeg color="red" key={index} decorative />)}</>);
    expect(screen.queryByRole('img')).toBeNull();
    const ids = Array.from(container.querySelectorAll('[id]')).map(node => node.id);
    expect(ids.length).toBe(12);
    expect(new Set(ids).size).toBe(ids.length);
    for (const node of container.querySelectorAll('[fill^="url(#"]')) expect(ids).toContain(node.getAttribute('fill')?.slice(5, -1));
  });
  it('accepts parent sizing and a noninteractive selected ring', () => {
    const { container } = render(<CipherPeg color="purple" size={44} selected label="Selected purple diamond" />);
    expect(screen.getByRole('img', { name: 'Selected purple diamond' })).toHaveStyle({ width: '44px', height: '44px' });
    expect(container.querySelector('.cipher-peg--selected')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('shows only official count clues in a separate four-marker cluster, not aligned code positions', () => {
    const { container } = render(<CipherFeedback exact={2} color_only={1} />);
    expect(screen.getByRole('img', { name: '2 exact matches, 1 color-only match. Clues do not indicate positions.' })).toBeVisible();
    expect(container.querySelectorAll('.cipher-feedback-pin')).toHaveLength(4);
    expect(container.querySelectorAll('.cipher-feedback-pin--exact')).toHaveLength(2);
    expect(container.querySelectorAll('.cipher-feedback-pin--color')).toHaveLength(1);
    expect(container.querySelectorAll('.cipher-feedback-pin--blank')).toHaveLength(1);
    expect(container.querySelector('[data-cipher-color]')).toBeNull();
  });
  it('supports the camel-case official feedback contract and sensible blank clues', () => {
    const { container, rerender } = render(<CipherFeedback exact={4} colorOnly={0} />);
    expect(container.querySelectorAll('.cipher-feedback-pin--exact')).toHaveLength(4);
    rerender(<CipherFeedback exact={0} colorOnly={0} />);
    expect(container.querySelectorAll('.cipher-feedback-pin--blank')).toHaveLength(4);
    expect(screen.getByRole('img')).toHaveAccessibleName(/0 exact matches, 0 color-only matches/);
  });
  it('renders the original four-peg brand without network images or external branding', () => {
    const { container } = render(<CipherMark className="test-mark" />);
    expect(screen.getByRole('img', { name: 'Cipher Duel' })).toHaveClass('cd-mark', 'cipher-mark', 'test-mark');
    expect(container.querySelectorAll('g')).toHaveLength(4);
    expect(container.querySelector('image,img')).toBeNull();
    expect(container.textContent).toBe('');
  });
});

describe('Cipher Duel permanent DH Feats catalog', () => {
  it('adds six unique single-tier awards with a finite 75-point total', () => {
    const all = [...originalCatalog, ...expeditionCatalog, ...puzzleCatalog, ...showdownCatalog, ...cipherCatalog];
    expect(new Set(all.map(row => row.key)).size).toBe(all.length);
    expect(cipherCatalog.map(row => row.title)).toEqual(['FIRST BREAK', 'CODE CRACKER', 'MASTER DECODER', 'UNBREAKABLE', 'RIVALRY', 'PERFECT READ']);
    expect(cipherCatalog.map(row => row.points)).toEqual([[5], [10], [15], [15], [10], [20]]);
    expect(cipherCatalog.reduce((sum, row) => sum + row.points[0], 0)).toBe(75);
    cipherCatalog.forEach(feat => {
      expect(feat.category).toBe('showdown');
      expect(feat.thresholds).toEqual([feat.key.endsWith('_rivalry') ? 10 : 1]);
      expect(featActionPath(feat)).toBe('/showdown?game=cipher_duel');
    });
    expect(FEAT_CATEGORIES.showdown.asset).toBe('dh-showdown');
    expect(featActionPath(showdownCatalog[0])).toBe('/showdown');
  });
  it('matches the complete production migration catalog exactly', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261101070000_cipher_duel_feats.sql'), 'utf8');
    const raw = sql.match(/\$cipher_catalog\$([\s\S]*?)\$cipher_catalog\$/)?.[1];
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual(cipherCatalog);
  });
  it('uses the current ledger receipt to finish each award permanently without adding repeat tiers', () => {
    for (const row of cipherCatalog) {
      const feat = row as FeatDefinition;
      const receipt: FeatUnlock = { feat_key: feat.key, tier: 1, points: feat.points[0], target: feat.thresholds[0], earned_at: '2026-11-01T00:00:00Z', historical: false };
      const progress = featProgress(feat, 0, [receipt]);
      expect(progress.maxed).toBe(true);
      expect(progress.earned).toBe(1);
      expect(progress.progress).toBe(1);
      expect(progress.earnedPoints).toBe(feat.points[0]);
      expect(progress.current).toBe(feat.thresholds[0]);
    }
  });
});

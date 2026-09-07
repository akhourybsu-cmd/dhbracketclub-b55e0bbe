import { describe, expect, it } from 'vitest';
import { getAccentTextColor } from '@/lib/colorContrast';

describe('getAccentTextColor', () => {
  it('uses dark ink on a bright club accent', () => {
    expect(getAccentTextColor('152 72% 46%')).toBe('hsl(160 36% 7%)');
  });

  it('uses white on a dark club accent', () => {
    expect(getAccentTextColor('220 70% 24%')).toBe('hsl(0 0% 100%)');
  });

  it('falls back to the semantic foreground for an invalid value', () => {
    expect(getAccentTextColor('var(--primary)')).toBe('hsl(var(--primary-foreground))');
  });
});

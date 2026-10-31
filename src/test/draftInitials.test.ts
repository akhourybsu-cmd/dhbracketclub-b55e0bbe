import { describe, expect, it } from 'vitest';
import { draftInitials } from '@/lib/draft/presentation';

describe('Draft avatar identity', () => {
  it('retains ordinary two-word initials and handles missing names', () => {
    expect(draftInitials('  Alex   Khoury ')).toBe('AK');
    expect(draftInitials('Alex')).toBe('A');
    expect(draftInitials(null)).toBe('?');
    expect(draftInitials(' ', 'DA')).toBe('DA');
  });
  it('keeps emoji, flags, joined glyphs and accents intact', () => {
    expect(draftInitials('🦊Fox 🛡Guard')).toBe('🦊🛡');
    expect(draftInitials('👩‍💻Coder 🇺🇸Captain')).toBe('👩‍💻🇺🇸');
    expect(draftInitials('e\u0301lodie\t三笠')).toBe('É三');
  });
});

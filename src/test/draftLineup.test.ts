import { afterEach, describe, expect, it } from 'vitest';
import {
  LINEUP_TEMPLATES, createLineupConfig, draftRoomPath, lineupProgress,
  openLineupSlots, parseLineupConfig, validateLineupConfig,
} from '@/lib/draft/lineup';
import {
  clearLineupCreateReceipt, lineupCreateKey, readLineupCreateReceipt, writeLineupCreateReceipt,
  type LineupCreateReceipt,
} from '@/components/draft/lineup/lineupCreateReceipt';

afterEach(() => localStorage.clear());

describe('Lineup requirements', () => {
  it.each(LINEUP_TEMPLATES)('ships a usable, distinct $name lineup', template => {
    const config = createLineupConfig(template.id);
    expect(validateLineupConfig(config)).toEqual([]);
    expect(parseLineupConfig(config)).toEqual(config);
    expect(new Set(config.slots.map(slot => slot.id)).size).toBe(config.slots.length);
    expect(config.slots.length).toBeGreaterThanOrEqual(2);
    expect(config.slots.length).toBeLessThanOrEqual(20);
  });

  it('lets two receivers occupy independent roles and gives each new draft its own configuration', () => {
    const first = createLineupConfig('football-skills');
    const second = createLineupConfig('football-skills');
    expect(first.slots.filter(slot => slot.label.startsWith('Receiver'))).toHaveLength(2);
    first.slots[0].label = 'Captain';
    first.slots.pop();
    expect(second.slots[0].label).toBe('Quarterback');
    expect(createLineupConfig('football-skills')).toEqual(second);
    expect(() => createLineupConfig('missing-template')).toThrow(/choose/i);
  });

  it.each([
    { label: 'missing configuration', value: null },
    { label: 'an array instead of configuration', value: [] },
    { label: 'unsupported version', value: { ...createLineupConfig('breakfast'), version: 2 } },
    { label: 'string version', value: { ...createLineupConfig('breakfast'), version: '1' } },
    { label: 'invalid template id', value: { ...createLineupConfig('breakfast'), template_id: '../breakfast' } },
    { label: 'unsupported scoring override', value: { ...createLineupConfig('breakfast'), winner: 'me' } },
    { label: 'too few slots', value: { ...createLineupConfig('breakfast'), slots: [{ id: 'drink', label: 'Drink' }] } },
    { label: 'too many slots', value: { version: 1, template_id: 'custom', slots: Array.from({ length: 21 }, (_, i) => ({ id: `slot-${i}`, label: `Role ${i}` })) } },
    { label: 'duplicate logical slots', value: { ...createLineupConfig('breakfast'), slots: [{ id: 'drink', label: 'Drink' }, { id: 'drink', label: 'Another drink' }] } },
    { label: 'unusable logical id', value: { ...createLineupConfig('breakfast'), slots: [{ id: 'Drink!', label: 'Drink' }, { id: 'side', label: 'Side' }] } },
    { label: 'empty name', value: { ...createLineupConfig('breakfast'), slots: [{ id: 'drink', label: ' ' }, { id: 'side', label: 'Side' }] } },
    { label: 'overlong name', value: { ...createLineupConfig('breakfast'), slots: [{ id: 'drink', label: 'A'.repeat(37) }, { id: 'side', label: 'Side' }] } },
    { label: 'overlong role guidance', value: { ...createLineupConfig('breakfast'), slots: [{ id: 'drink', label: 'Drink', description: 'A'.repeat(121) }, { id: 'side', label: 'Side' }] } },
    { label: 'non-text guidance', value: { ...createLineupConfig('breakfast'), slots: [{ id: 'drink', label: 'Drink', description: 5 }, { id: 'side', label: 'Side' }] } },
    { label: 'unknown slot data', value: { ...createLineupConfig('breakfast'), slots: [{ id: 'drink', label: 'Drink', score: 10 }, { id: 'side', label: 'Side' }] } },
    { label: 'non-object slot', value: { ...createLineupConfig('breakfast'), slots: [null, { id: 'side', label: 'Side' }] } },
  ])('rejects $label before a draft can use it', ({ value }) => {
    expect(validateLineupConfig(value).length).toBeGreaterThan(0);
    expect(parseLineupConfig(value)).toBeNull();
  });

  it('accepts the largest supported lineup and canonicalizes edited labels without mutating their form values', () => {
    const custom = { version: 1, template_id: 'custom', slots: Array.from({ length: 20 }, (_, i) => ({ id: `slot-${i}`, label: ` Role ${i} ` })) };
    const parsed = parseLineupConfig(custom);
    expect(parsed?.slots).toHaveLength(20);
    expect(parsed?.slots[0].label).toBe('Role 0');
    expect(custom.slots[0].label).toBe(' Role 0 ');
  });

  it('fills roles in any order independently for each participant', () => {
    const config = createLineupConfig('breakfast');
    const picks = [
      { user_id: 'alice', lineup_slot_id: 'sweet' },
      { user_id: 'bob', lineup_slot_id: 'drink' },
      { user_id: 'alice', lineup_slot_id: 'side' },
    ];
    expect(openLineupSlots(config, picks, 'alice').map(slot => slot.id)).toEqual(['drink', 'entree']);
    expect(openLineupSlots(config, picks, 'bob').map(slot => slot.id)).toEqual(['entree', 'side', 'sweet']);
    expect(lineupProgress(config, picks, 'alice')).toEqual({ filled: 2, total: 4, complete: false, percent: 50 });
    expect(lineupProgress(config, picks, 'new-member')).toEqual({ filled: 0, total: 4, complete: false, percent: 0 });
    const completed = [...picks, { user_id: 'alice', lineup_slot_id: 'drink' }, { user_id: 'alice', lineup_slot_id: 'entree' }];
    expect(lineupProgress(config, completed, 'alice')).toEqual({ filled: 4, total: 4, complete: true, percent: 100 });
  });

  it('does not inflate progress from repeated or unrelated cached rows', () => {
    const config = createLineupConfig('breakfast');
    const picks = [
      { user_id: 'alice', lineup_slot_id: 'drink' }, { user_id: 'alice', lineup_slot_id: 'drink' },
      { user_id: 'alice', lineup_slot_id: 'unknown' }, { user_id: 'alice', lineup_slot_id: null },
    ];
    expect(lineupProgress(config, picks, 'alice')).toEqual({ filled: 1, total: 4, complete: false, percent: 25 });
  });

  it('routes each draft experience to its own room without allowing an ID to change the route', () => {
    expect(draftRoomPath({ id: 'match', draft_format: 'lineup' })).toBe('/drafts/lineup/match');
    expect(draftRoomPath({ id: 'match', is_live: true })).toBe('/drafts/live/match');
    expect(draftRoomPath({ id: 'match' })).toBe('/drafts/match');
    expect(draftRoomPath({ id: '../other?tab=host', draft_format: 'lineup' })).toBe('/drafts/lineup/..%2Fother%3Ftab%3Dhost');
  });
});

describe('Unconfirmed lineup creation recovery', () => {
  const receipt = (): LineupCreateReceipt => ({
    requestId: 'b621584e-cf61-408d-81cf-31f81b362186', topic: 'Our breakfast', description: 'Weekend picks',
    aiContext: 'Foods available in the UK', lineupConfig: createLineupConfig('breakfast'),
  });

  it('recovers the same request and frozen choices only for the original user and club', () => {
    const key = lineupCreateKey('alice', 'club-a'), original = receipt();
    expect(writeLineupCreateReceipt(key, original)).toBe(true);
    expect(readLineupCreateReceipt(key)).toEqual(original);
    expect(readLineupCreateReceipt(lineupCreateKey('bob', 'club-a'))).toBeNull();
    expect(readLineupCreateReceipt(lineupCreateKey('alice', 'club-b'))).toBeNull();
    clearLineupCreateReceipt(key);
    expect(readLineupCreateReceipt(key)).toBeNull();
  });

  it.each([
    { topic: '' }, { requestId: 'not-a-uuid' }, { description: 'a'.repeat(201) },
    { aiContext: 'a'.repeat(1001) }, { lineupConfig: { version: 99 } },
  ])('ignores malformed stored requests: %j', invalid => {
    const key = lineupCreateKey('alice', 'club');
    localStorage.setItem(key, JSON.stringify({ ...receipt(), ...invalid }));
    expect(readLineupCreateReceipt(key)).toBeNull();
  });

  it('treats corrupt storage as absent instead of trapping setup', () => {
    const key = lineupCreateKey('alice', 'club');
    localStorage.setItem(key, '{broken-json');
    expect(readLineupCreateReceipt(key)).toBeNull();
    expect(lineupCreateKey('alice:club-b', 'club-a')).not.toBe(lineupCreateKey('alice', 'club-b:club-a'));
  });
});

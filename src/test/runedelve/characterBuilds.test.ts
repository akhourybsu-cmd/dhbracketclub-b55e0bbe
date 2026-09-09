import { describe, expect, it } from 'vitest';
import { buildCharacterSheet } from '@/lib/runedelve/characterStats';
import { ensureUniqueCombatLogIds, snapshotKey } from '@/lib/runedelve/runSnapshot';

function stat(sheet: ReturnType<typeof buildCharacterSheet>, id: string) {
  const found = sheet.stats.find(entry => entry.id === id);
  if (!found) throw new Error(`Missing character stat: ${id}`);
  return found;
}

describe('Rune Delve · character build clarity', () => {
  it('shows a fresh class with honest baseline combat values', () => {
    const sheet = buildCharacterSheet({
      cls: 'mage',
      classLevel: 1,
      campaignLevel: 1,
      slots: [],
    });

    expect(sheet.masteryCount).toBe(0);
    expect(sheet.equippedCount).toBe(0);
    expect(sheet.startingMana).toBe(0);
    expect(sheet.abilityCost).toBe(3);
    expect(stat(sheet, 'hp')).toMatchObject({ base: 100, effective: 100 });
    expect(stat(sheet, 'strike')).toMatchObject({ base: 48, effective: 48 });
    expect(stat(sheet, 'mana')).toMatchObject({ base: 3, effective: 3 });
  });

  it('counts cleared chapters for Iron Constitution without granting Chapter 1 a free HP', () => {
    const chapterOne = buildCharacterSheet({
      cls: 'warrior', classLevel: 15, campaignLevel: 1, slots: [],
    });
    const chapterTwo = buildCharacterSheet({
      cls: 'warrior', classLevel: 15, campaignLevel: 51, slots: [],
    });

    expect(stat(chapterOne, 'hp').effective).toBe(100);
    expect(stat(chapterTwo, 'hp').effective).toBe(101);
  });

  it('converts Aether Spark mana above the cap into visible opening shield turns', () => {
    const sheet = buildCharacterSheet({
      cls: 'mage',
      classLevel: 5,
      campaignLevel: 20,
      slots: ['aether_spark'],
      rankById: new Map([['aether_spark', 5]]),
    });

    expect(sheet.startingMana).toBe(3);
    expect(sheet.startingShield).toBe(4);
    expect(sheet.bonuses.find(bonus => bonus.id === 'aether_spark')?.detail)
      .toContain('3 overflow becomes shield turns');
  });

  it('shows campaign-scaled ability output instead of the level-1 base value', () => {
    const sheet = buildCharacterSheet({
      cls: 'mage', classLevel: 20, campaignLevel: 103, slots: [],
    });

    expect(sheet.abilityDetail).toBe('130 damage to one target');
  });

  it('surfaces both sides of the Void Pact tradeoff in headline stats', () => {
    const baseline = buildCharacterSheet({
      cls: 'rogue', classLevel: 1, campaignLevel: 1, slots: [],
    });
    const pact = buildCharacterSheet({
      cls: 'rogue',
      classLevel: 1,
      campaignLevel: 1,
      slots: ['void_pact'],
      rankById: new Map([['void_pact', 5]]),
    });

    expect(stat(pact, 'hp').effective).toBe(90);
    expect(stat(pact, 'strike').effective).toBeGreaterThan(stat(baseline, 'strike').effective);
  });
});

describe('Rune Delve · class isolation', () => {
  it('uses a different mobile-resume key for every class on the same level', () => {
    const warrior = snapshotKey('player', 'level-10', 'warrior');
    const mage = snapshotKey('player', 'level-10', 'mage');

    expect(warrior).not.toBe(mage);
    expect(warrior).toContain(':warrior:');
    expect(mage).toContain(':mage:');
  });

  it('repairs duplicate animated combat-log keys from restored runs', () => {
    const repaired = ensureUniqueCombatLogIds([
      { id: 'l-1', kind: 'info', text: 'Entered the level' },
      { id: 'l-1', kind: 'ability', text: 'Cast an ability' },
      { id: 'l-2', kind: 'mana', text: 'Gained mana' },
    ], 1234);

    expect(repaired.map(entry => entry.id)).toEqual([
      'l-1',
      'l-1-1234-1',
      'l-2',
    ]);
  });
});

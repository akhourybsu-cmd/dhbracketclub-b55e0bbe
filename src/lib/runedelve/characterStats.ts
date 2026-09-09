import { getClass, type HeroClass } from './classConfig';
import { getActiveMasteries, MASTERY_TIERS, type MasteryId } from './classMastery';
import {
  getMasteryAbilityManaCost,
  getMasteryChainDamageMult,
  getMasteryCleaveDamage,
  getMasteryHpPerChapter,
  getMasterySanctuaryHeal,
  getMasteryShieldBonus,
  getMasteryStartingMana,
  getMasteryArcChainFraction,
} from './masteryEffects';
import { chapterFor } from './levelGenerator';
import { campaignPowerMultiplier, MAX_HP, MAX_MANA, redChainDamage } from './combatEngine';
import {
  buildActive,
  computeChainMods,
  getForeseerBonusTurns,
  getStartingMana,
  getStartingShieldTurns,
  getVoidPactHpCost,
  thornsRelicMultiplier,
} from './relicEffects';
import { describeRelicAtRank, RELIC_BY_ID } from './relics';

export interface CharacterSheetInput {
  cls: HeroClass;
  classLevel: number;
  campaignLevel: number;
  slots: Array<string | null | undefined>;
  rankById?: Map<string, number>;
}

export interface CharacterStat {
  id: 'hp' | 'strike' | 'heal' | 'mana' | 'guard' | 'thorns';
  label: string;
  icon: string;
  base: number;
  effective: number;
  suffix: string;
  note: string;
}

export interface CharacterBonus {
  id: string;
  icon: string;
  name: string;
  source: 'Class' | 'Mastery' | 'Relic';
  detail: string;
  rank?: number;
}

export interface CharacterSheet {
  cls: HeroClass;
  classLevel: number;
  campaignLevel: number;
  chapter: number;
  masteryCount: number;
  equippedCount: number;
  relicRankTotal: number;
  stats: CharacterStat[];
  startingMana: number;
  startingShield: number;
  bonusTurns: number;
  abilityName: string;
  abilityCost: number;
  abilityDetail: string;
  passive: string;
  bonuses: CharacterBonus[];
}

const FIVE_RUNE_CHAIN = 5;

function abilityDetail(cls: HeroClass, active: MasteryId[], campaignLevel: number): string {
  const depth = campaignPowerMultiplier(campaignLevel);
  switch (cls) {
    case 'warrior':
      return `${Math.round((getMasteryCleaveDamage(active) ?? 40) * depth)} damage to every enemy`;
    case 'mage': {
      const chain = getMasteryArcChainFraction(active);
      const main = Math.round(80 * depth);
      return chain > 0
        ? `${main} damage; second target takes ${Math.round(main * chain)}`
        : `${main} damage to one target`;
    }
    case 'rogue':
      return 'Next attack deals ×2 damage and score';
    case 'cleric':
      return `Heal ${getMasterySanctuaryHeal(active) ?? 30} HP, gain a 2-turn shield, and deal ${Math.round(22 * depth)} damage to every enemy`;
  }
}

/**
 * A deterministic, player-facing snapshot of the values the combat screen
 * actually uses. Conditional effects (first-chain bonuses, low-HP bonuses,
 * crits, revives) stay in `bonuses` instead of being folded into the headline
 * numbers, so the sheet never promises damage that is not always available.
 */
export function buildCharacterSheet(input: CharacterSheetInput): CharacterSheet {
  const cls = getClass(input.cls);
  const chapter = chapterFor(Math.max(1, input.campaignLevel));
  const activeMasteries = getActiveMasteries(input.cls, input.classLevel);
  const activeRelics = buildActive(input.slots, input.rankById);
  const equipped = Array.from(activeRelics.ranks.entries());

  const stableContext = {
    length: FIVE_RUNE_CHAIN,
    redChainCountSoFar: 2,
    isFirstChainOfRun: false,
    hpRatio: 0.5,
    enemyHpRatioBeforeHit: 0.5,
    chainNumberThisRun: 1,
  } as const;
  const redMods = computeChainMods(activeRelics, { ...stableContext, chainType: 'red' });
  const greenMods = computeChainMods(activeRelics, { ...stableContext, chainType: 'green' });
  const blueMods = computeChainMods(activeRelics, { ...stableContext, chainType: 'blue' });
  const goldMods = computeChainMods(activeRelics, { ...stableContext, chainType: 'gold' });

  const chaptersCleared = Math.max(0, chapter - 1);
  const baseHp = MAX_HP;
  const masteryHp = getMasteryHpPerChapter(activeMasteries) * chaptersCleared;
  const effectiveHp = Math.max(10, baseHp + masteryHp - getVoidPactHpCost(activeRelics));

  const baseStrike = redChainDamage(FIVE_RUNE_CHAIN, input.cls, input.campaignLevel);
  const effectiveStrike = Math.round(
    baseStrike
      * redMods.bonusDamageMult
      * getMasteryChainDamageMult(activeMasteries, 'red'),
  );

  const baseHeal = input.cls === 'cleric' ? 45 : 30;
  const effectiveHeal = baseHeal + greenMods.bonusHealFlat;

  const baseMana = Math.min(MAX_MANA, (input.cls === 'mage' ? 2 : 1) + 1);
  const effectiveMana = Math.min(MAX_MANA, baseMana + blueMods.bonusManaFlat);

  const baseGuard = 1 + Math.floor(FIVE_RUNE_CHAIN / 3);
  const effectiveGuard = baseGuard + goldMods.bonusShieldTurns + getMasteryShieldBonus(activeMasteries);

  const openingManaPower = getStartingMana(activeRelics) + getMasteryStartingMana(activeMasteries);
  const startingMana = Math.min(MAX_MANA, openingManaPower);
  const overflowShield = Math.max(0, openingManaPower - MAX_MANA);
  const startingShield = getStartingShieldTurns(activeRelics) + overflowShield;

  const baseThorns = input.cls === 'warrior' ? 40 : 25;
  const effectiveThorns = Math.round(baseThorns * thornsRelicMultiplier(activeRelics));

  const bonuses: CharacterBonus[] = [
    {
      id: `class-${input.cls}`,
      icon: cls.emoji,
      name: `${cls.name} passive`,
      source: 'Class',
      detail: cls.passive,
    },
    ...MASTERY_TIERS[input.cls]
      .filter(m => input.classLevel >= m.unlockLevel)
      .map(m => ({
        id: m.id,
        icon: '✦',
        name: m.name,
        source: 'Mastery' as const,
        detail: m.summary,
      })),
    ...equipped.flatMap(([id, rank]) => {
      const relic = RELIC_BY_ID[id];
      if (!relic) return [];
      return [{
        id: relic.id,
        icon: relic.icon,
        name: relic.name,
        source: 'Relic' as const,
        detail: describeRelicAtRank(relic, rank),
        rank,
      }];
    }),
  ];

  return {
    cls: input.cls,
    classLevel: input.classLevel,
    campaignLevel: input.campaignLevel,
    chapter,
    masteryCount: activeMasteries.length,
    equippedCount: equipped.length,
    relicRankTotal: equipped.reduce((sum, [, rank]) => sum + rank, 0),
    stats: [
      { id: 'hp', label: 'Max HP', icon: '♥', base: baseHp, effective: effectiveHp, suffix: '', note: 'Opening health' },
      { id: 'strike', label: '5-Rune Strike', icon: '⚔', base: baseStrike, effective: effectiveStrike, suffix: ' dmg', note: `At campaign L${input.campaignLevel}` },
      { id: 'heal', label: '5-Rune Heal', icon: '❀', base: baseHeal, effective: effectiveHeal, suffix: ' HP', note: 'Reliable green chain' },
      { id: 'mana', label: '5-Rune Mana', icon: '✦', base: baseMana, effective: effectiveMana, suffix: ' orbs', note: `Maximum ${MAX_MANA}` },
      { id: 'guard', label: '5-Rune Guard', icon: '◈', base: baseGuard, effective: effectiveGuard, suffix: ' turns', note: 'Shield duration' },
      { id: 'thorns', label: 'Shield Thorns', icon: '⛨', base: baseThorns, effective: effectiveThorns, suffix: '%', note: 'Damage reflected' },
    ],
    startingMana,
    startingShield,
    bonusTurns: getForeseerBonusTurns(activeRelics),
    abilityName: cls.abilityName,
    abilityCost: getMasteryAbilityManaCost(activeMasteries, cls.abilityCost),
    abilityDetail: abilityDetail(input.cls, activeMasteries, input.campaignLevel),
    passive: cls.passive,
    bonuses,
  };
}

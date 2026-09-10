export type ChainLegStatus = 'pending' | 'hit' | 'miss' | 'void';
export type ChainCardStatus = 'locked' | 'won' | 'lost' | 'void';
export type ChainOperator = 'gte' | 'lte' | 'eq';

export interface ChainProgressCard {
  weekNumber: number;
  status: ChainCardStatus;
  linksWon: number;
  linksRisked: number;
  hitLegs: number;
}

export interface ChainProgress {
  currentChain: number;
  bestChain: number;
  perfectWeeks: number;
  totalHitLegs: number;
  totalCards: number;
  bustedCards: number;
  longestCard: number;
  lastSettledWeek: number | null;
}

export function evaluateChainLeg(actual: number, operator: ChainOperator, threshold: number): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(threshold)) return false;
  if (operator === 'gte') return actual >= threshold;
  if (operator === 'lte') return actual <= threshold;
  return actual === threshold;
}

export function deriveChainCardStatus(statuses: ChainLegStatus[]): ChainCardStatus {
  if (statuses.length === 0 || statuses.every(status => status === 'void')) return 'void';
  if (statuses.includes('miss')) return 'lost';
  if (statuses.includes('pending')) return 'locked';
  return 'won';
}

export function calculateChainProgress(cards: ChainProgressCard[]): ChainProgress {
  let currentChain = 0;
  let bestChain = 0;
  let perfectWeeks = 0;
  let totalHitLegs = 0;
  let totalCards = 0;
  let bustedCards = 0;
  let longestCard = 0;
  let lastSettledWeek: number | null = null;

  const ordered = [...cards].sort((a, b) => a.weekNumber - b.weekNumber);
  for (const card of ordered) {
    if (card.status === 'locked') continue;
    totalHitLegs += card.hitLegs;
    lastSettledWeek = card.weekNumber;
    if (card.status === 'won') {
      currentChain += card.linksWon;
      bestChain = Math.max(bestChain, currentChain);
      perfectWeeks += 1;
      totalCards += 1;
      longestCard = Math.max(longestCard, card.linksWon);
    } else if (card.status === 'lost') {
      currentChain = 0;
      bustedCards += 1;
      totalCards += 1;
      longestCard = Math.max(longestCard, card.linksRisked);
    }
  }

  return {
    currentChain,
    bestChain,
    perfectWeeks,
    totalHitLegs,
    totalCards,
    bustedCards,
    longestCard,
    lastSettledWeek,
  };
}

export const CHAIN_MARKET_LABELS: Record<string, string> = {
  team_win: 'To win',
  team_points: 'Team points',
  game_total: 'Game total',
  passing_touchdowns: 'Passing TDs',
  passing_yards: 'Passing yards',
  rushing_yards: 'Rushing yards',
  receiving_yards: 'Receiving yards',
  receptions: 'Receptions',
  anytime_touchdown: 'Anytime TD',
  team_sacks: 'Team sacks',
  team_turnovers: 'Team takeaways',
};

export function formatThreshold(operator: ChainOperator, threshold: number): string {
  if (operator === 'gte') return `${threshold}+`;
  if (operator === 'lte') return `${threshold} or fewer`;
  return `exactly ${threshold}`;
}

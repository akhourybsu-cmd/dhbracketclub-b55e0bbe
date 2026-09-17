export const PICKEM_SHARE_MARKER = '🏈 **NFL Pick’em card**';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PickemShareTarget {
  weekId: string;
  weekNumber: number;
}

export function buildPickemShareUrl(origin: string, weekId: string, weekNumber: number): string {
  const url = new URL(`/pickem/week/${weekNumber}`, origin);
  url.searchParams.set('weekId', weekId);
  return url.toString();
}

export function buildPickemShareMessage(args: {
  origin: string;
  weekId: string;
  weekNumber: number;
  weekLabel: string;
  pickedCount: number;
  totalGames: number;
}): string {
  return [
    PICKEM_SHARE_MARKER,
    `**${args.weekLabel}**`,
    `${args.pickedCount}/${args.totalGames} games picked`,
    buildPickemShareUrl(args.origin, args.weekId, args.weekNumber),
  ].join('\n');
}

export function getPickemShareTarget(url: string): PickemShareTarget | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/pickem\/week\/(\d+)\/?$/i);
    const weekId = parsed.searchParams.get('weekId');
    const weekNumber = Number(match?.[1]);
    if (!match || !weekId || !UUID_RE.test(weekId) || !Number.isInteger(weekNumber) || weekNumber < 1) return null;
    return { weekId, weekNumber };
  } catch {
    return null;
  }
}

export function isPickemShareMessage(content: string): boolean {
  if (!content.startsWith(PICKEM_SHARE_MARKER)) return false;
  const url = content.match(/https?:\/\/[^\s]+/)?.[0];
  return Boolean(url && getPickemShareTarget(url));
}
import { parseLineupConfig, type LineupConfig } from '@/lib/draft/lineup';

export const LINEUP_CREATE_PREFIX = 'dh:draft:lineup:create:v1:';
export interface LineupCreateReceipt {
  requestId: string;
  topic: string;
  description: string;
  aiContext: string;
  lineupConfig: LineupConfig;
}

export function lineupCreateKey(userId: string, clubId: string): string {
  return `${LINEUP_CREATE_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(clubId)}`;
}

/** An unacknowledged create always retries its original payload and receipt. */
export function readLineupCreateReceipt(key: string): LineupCreateReceipt | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const row = JSON.parse(raw);
    const config = parseLineupConfig(row.lineupConfig);
    if (!config || typeof row.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.requestId)
      || typeof row.topic !== 'string' || !row.topic.trim() || row.topic.length > 100
      || typeof row.description !== 'string' || row.description.length > 200
      || typeof row.aiContext !== 'string' || row.aiContext.length > 1000) return null;
    return { requestId: row.requestId, topic: row.topic, description: row.description, aiContext: row.aiContext, lineupConfig: config };
  } catch { return null; }
}

export function writeLineupCreateReceipt(key: string, receipt: LineupCreateReceipt): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(receipt));
    return localStorage.getItem(key) === JSON.stringify(receipt);
  } catch { return false; }
}

export function clearLineupCreateReceipt(key: string) {
  try { localStorage.removeItem(key); } catch { /* The server receipt still prevents duplicate creation. */ }
}

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestKey = (key: string, id: string) => `${key}:request:${id}`;
const activeKey = (key: string) => `${key}:active`;
function parseReceipt(raw: string | null): LineupCreateReceipt | null {
  try {
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

/** Each tab resumes its own exact request; another request is reviewed first. */
export function readLineupCreateReceipt(key: string): LineupCreateReceipt | null {
  try {
    let active: string | null = null;
    try { active = sessionStorage.getItem(activeKey(key)); } catch { /* In-memory retry remains available. */ }
    if (active && UUID.test(active)) {
      const own = parseReceipt(localStorage.getItem(requestKey(key, active)));
      if (own?.requestId === active) return own;
      try { sessionStorage.removeItem(activeKey(key)); } catch { /* Optional tab reference. */ }
      return null; // Another tab already confirmed this request.
    }
    const legacy = parseReceipt(localStorage.getItem(key));
    const candidates = legacy ? [legacy] : Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((name): name is string => !!name?.startsWith(`${key}:request:`))
      .map(name => parseReceipt(localStorage.getItem(name))).filter((row): row is LineupCreateReceipt => !!row);
    const pending = candidates[0];
    if (!pending) return null;
    const frozen = parseReceipt(localStorage.getItem(requestKey(key, pending.requestId))) ?? pending;
    try {
      localStorage.setItem(requestKey(key, frozen.requestId), JSON.stringify(frozen));
      sessionStorage.setItem(activeKey(key), frozen.requestId);
    } catch { /* The caller displays the recovered payload before retry. */ }
    return frozen;
  } catch { return null; }
}

export function writeLineupCreateReceipt(key: string, receipt: LineupCreateReceipt): boolean {
  const frozen = parseReceipt(JSON.stringify(receipt));
  if (!frozen) throw new Error('This saved lineup request is invalid. Review its choices.');
  try {
    const target = requestKey(key, receipt.requestId), value = JSON.stringify(frozen);
    const existing = parseReceipt(localStorage.getItem(target));
    if (existing && JSON.stringify(existing) !== value) throw new Error('LINEUP_RECOVERY: A saved request cannot change its choices.');
    const count = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter(name => name?.startsWith(`${key}:request:`)).length;
    if (!existing && count >= 16) throw new Error('LINEUP_RECOVERY: Confirm an earlier lineup request before creating another.');
    localStorage.setItem(target, value);
    sessionStorage.setItem(activeKey(key), receipt.requestId);
    // Compatibility/discovery pointer; per-request records remain authoritative.
    localStorage.setItem(key, value);
    return localStorage.getItem(target) === value && sessionStorage.getItem(activeKey(key)) === receipt.requestId;
  } catch (failure) {
    if (failure instanceof Error && failure.message.startsWith('LINEUP_RECOVERY:')) throw failure;
    return false;
  }
}

export function clearLineupCreateReceipt(key: string, requestId: string) {
  try {
    localStorage.removeItem(requestKey(key, requestId));
    if (parseReceipt(localStorage.getItem(key))?.requestId === requestId) localStorage.removeItem(key);
  } catch { /* The server receipt still prevents duplicate creation. */ }
  try { if (sessionStorage.getItem(activeKey(key)) === requestId) sessionStorage.removeItem(activeKey(key)); } catch { /* Optional tab reference. */ }
}

export function clearRejectedLineupCreateReceipt(key: string, requestId: string, failure: unknown): boolean {
  const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
  if (!/^(P\d|22|23|42|54)/.test(code)) return false;
  clearLineupCreateReceipt(key, requestId);
  return true;
}

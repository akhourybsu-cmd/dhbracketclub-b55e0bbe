import type { DeepClaimDiscovery } from '@/lib/deepClaim/types';

/** Presentation receipts only. No private content, value, inventory or decisions are stored. */
export interface DiscoveryRevealReceipt { version: 1; baselineAt: string; seen: string[]; pending: string[] }
const LIMIT = 128;
const quality = { common: 0, fine: 1, exceptional: 2, flawless: 3 };
function boundedSeen(ids: readonly string[], discoveries: readonly DeepClaimDiscovery[]) {
  const unique = [...new Set(ids)];
  const pendingIds = new Set(discoveries.filter(find => find.status === 'pending').map(find => find.id));
  const pinned = unique.filter(id => pendingIds.has(id)).slice(-LIMIT);
  const available = LIMIT - pinned.length;
  return [...(available > 0 ? unique.filter(id => !pendingIds.has(id)).slice(-available) : []), ...pinned];
}
export function discoveryRevealKey(userId: string, clubId: string, companyId: string) { return `dh:deep-claim:reveals:v1:${userId}:${clubId}:${companyId}`; }
export function readDiscoveryReveals(key: string): DiscoveryRevealReceipt | null {
  try { const value = JSON.parse(localStorage.getItem(key) ?? 'null'); return value?.version === 1 && Number.isFinite(Date.parse(value.baselineAt)) && Array.isArray(value.seen) && value.seen.length <= LIMIT && value.seen.every((id: unknown) => typeof id === 'string') && Array.isArray(value.pending) && value.pending.length <= 24 && value.pending.every((id: unknown) => typeof id === 'string') ? value : null; } catch { return null; }
}
export function saveDiscoveryReveals(key: string, receipt: DiscoveryRevealReceipt) { try { localStorage.setItem(key, JSON.stringify(receipt)); } catch { /* Session receipts still work when device storage is unavailable. */ } }
export function observeDiscoveryReveals(previous: DiscoveryRevealReceipt | null, discoveries: readonly DeepClaimDiscovery[], serverNow: string): DiscoveryRevealReceipt {
  // First authoritative hydration establishes a quiet baseline for existing companies.
  if (!previous) return { version: 1, baselineAt: serverNow, seen: boundedSeen(discoveries.map(find => find.id), discoveries), pending: [] };
  const eligible = discoveries.filter(find => find.status === 'pending' && quality[find.quality] > 0 && Date.parse(find.discovered_at) >= Date.parse(previous.baselineAt));
  const available = new Set(eligible.map(find => find.id));
  const pending = [...new Set([...previous.pending.filter(id => available.has(id)), ...eligible.filter(find => !previous.seen.includes(find.id)).map(find => find.id)])].slice(0, 24);
  return { ...previous, seen: boundedSeen(previous.seen, discoveries), pending };
}
export function nextDiscoveryReveal(receipt: DiscoveryRevealReceipt, discoveries: readonly DeepClaimDiscovery[]): DeepClaimDiscovery | null {
  return discoveries.filter(find => find.status === 'pending' && receipt.pending.includes(find.id)).sort((a, b) => quality[b.quality] - quality[a.quality] || a.discovered_at.localeCompare(b.discovered_at) || a.id.localeCompare(b.id))[0] ?? null;
}
export function markDiscoveryRevealed(receipt: DiscoveryRevealReceipt, id: string, discoveries: readonly DeepClaimDiscovery[]): DiscoveryRevealReceipt { return { ...receipt, seen: boundedSeen([...receipt.seen, id], discoveries), pending: receipt.pending.filter(value => value !== id) }; }

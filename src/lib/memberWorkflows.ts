export type RsvpStatus = 'going' | 'maybe' | 'pass';

/** Selecting the active RSVP clears it; selecting another status replaces it. */
export function nextRsvpStatus(
  current: RsvpStatus | null | undefined,
  requested: RsvpStatus,
): RsvpStatus | null {
  return current === requested ? null : requested;
}

/** Keeps the visible going count in sync while an RSVP request is in flight. */
export function optimisticGoingCount(
  count: number,
  current: RsvpStatus | null | undefined,
  next: RsvpStatus | null,
): number {
  const delta = (next === 'going' ? 1 : 0) - (current === 'going' ? 1 : 0);
  return Math.max(0, count + delta);
}

/** Immutable one-step reorder used by ranking controls. */
export function moveListItem<T>(items: readonly T[], index: number, direction: 'up' | 'down'): T[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Appends a paginated response without duplicating realtime-inserted rows. */
export function mergeUniqueById<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const seen = new Set(current.map(item => item.id));
  return [...current, ...incoming.filter(item => !seen.has(item.id))];
}

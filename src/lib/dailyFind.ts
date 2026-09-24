// The Drop — shared helpers (types, local-date keys, chat share markers).

export type FindKind = 'learned' | 'article' | 'photo';

export interface DailyFind {
  id: string;
  club_id: string;
  user_id: string;
  find_date: string; // YYYY-MM-DD (poster's local day)
  kind: FindKind;
  title: string;
  note: string | null;
  url: string | null;
  image_path: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  profiles?: { id: string; display_name: string; avatar_url: string | null } | null;
  reactions?: { emoji: string; user_id: string }[];
  comments?: { count: number }[];
}

export const FIND_KINDS: { value: FindKind; label: string; emoji: string; prompt: string }[] = [
  { value: 'learned', label: 'Learned', emoji: '💡', prompt: 'What did you learn today?' },
  { value: 'article', label: 'Read', emoji: '📰', prompt: 'What is worth reading?' },
  { value: 'photo', label: 'Saw', emoji: '📸', prompt: 'What caught your eye?' },
];

export const FIND_REACTIONS = ['🤯', '💡', '🔥', '😂', '❤️', '🤔'] as const;

export function kindMeta(kind: FindKind) {
  return FIND_KINDS.find(k => k.value === kind) ?? FIND_KINDS[0];
}

/** Local calendar day key (YYYY-MM-DD) — never UTC, so late-night finds land on the right day. */
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDayKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return parseDayKey(key).toLocaleDateString(undefined, opts);
}

/** Normalise free-text tags: lowercase, strip #, dedupe, max 5. */
export function normalizeTags(input: string): string[] {
  const tags = input
    .split(/[,\s]+/)
    .map(t => t.replace(/^#+/, '').trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter(t => t.length > 0 && t.length <= 24);
  return [...new Set(tags)].slice(0, 5);
}

/** Longest run of consecutive days ending today (or yesterday) in a set of day keys. */
export function currentStreak(dayKeys: Iterable<string>, today = new Date()): number {
  const set = new Set(dayKeys);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!set.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(localDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ─── Chat sharing ───
export const DAILY_FIND_SHARE_MARKER = '▣ **The Drop**';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildFindShareUrl(findId: string, origin = 'https://dryhorse.app'): string {
  return new URL(`/finds/${findId}`, origin).toString();
}

export function buildFindShareMessage(find: Pick<DailyFind, 'id' | 'title'>): string {
  return [DAILY_FIND_SHARE_MARKER, `**${find.title}**`, buildFindShareUrl(find.id)].join('\n');
}

export function getFindShareTarget(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/^\/finds\/([0-9a-f-]{36})\/?$/i);
    return m && UUID_RE.test(m[1]) ? m[1] : null;
  } catch {
    return null;
  }
}

export function isDailyFindShareMessage(content: string): boolean {
  if (!content.startsWith(DAILY_FIND_SHARE_MARKER) && !content.startsWith('💡 **Daily Find**')) return false;
  const url = content.match(/https?:\/\/[^\s]+/)?.[0];
  return Boolean(url && getFindShareTarget(url));
}

import { formatDistanceToNowStrict } from 'date-fns';

/** Only internal deep links belong in the personal notification inbox. */
export function notificationPath(url: string | null) {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('\\') || [...url].some(char=>char.charCodeAt(0)<32)) return null;
  return url;
}

export function notificationTime(iso: string) {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? formatDistanceToNowStrict(date, { addSuffix: true }) : 'Recently';
}

export function notificationCursor(id: string, createdAt: string) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id) || !/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(createdAt)) throw new Error('Invalid notification cursor');
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
}

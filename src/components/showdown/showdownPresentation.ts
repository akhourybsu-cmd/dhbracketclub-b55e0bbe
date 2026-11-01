export function showdownDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently';
}

export function showdownTimeLeft(value: string, now = Date.now()): string {
  const remaining = Date.parse(value) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Expired';
  if (remaining < 3600000) return `${Math.max(1, Math.ceil(remaining / 60000))}m left`;
  return `${Math.ceil(remaining / 3600000)}h left`;
}

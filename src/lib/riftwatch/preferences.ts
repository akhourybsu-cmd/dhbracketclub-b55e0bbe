export interface RiftPreferences {
  music: number;
  sfx: number;
  muted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}
export function readLocal<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw && raw.length <= 600_000 ? JSON.parse(raw) as T : null;
  } catch { return null; }
}
export function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Practice and in-memory result retry also work without device storage. */ }
}
function volume(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
export function readPreferences(): RiftPreferences {
  const saved = readLocal<Partial<RiftPreferences>>('dh:riftwatch:settings:v1');
  return { music: volume(saved?.music, .32), sfx: volume(saved?.sfx, .58),
    muted: saved?.muted ?? false,
    reducedMotion: saved?.reducedMotion ?? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
    highContrast: saved?.highContrast ?? false };
}

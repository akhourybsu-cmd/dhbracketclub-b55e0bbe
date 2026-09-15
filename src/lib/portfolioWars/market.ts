/**
 * US equity market calendar helpers for Portfolio Wars.
 * All logic runs in America/New_York regardless of the viewer's timezone.
 */

/** Full-day market closures (YYYY-MM-DD, ET). */
export const MARKET_HOLIDAYS = new Set<string>([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

/** Early closes at 1:00 pm ET. */
export const MARKET_EARLY_CLOSES = new Set<string>([
  '2026-11-27', '2026-12-24', '2027-11-26',
]);

const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;
const EARLY_CLOSE_MINUTES = 13 * 60;

export interface EtParts {
  date: string;        // YYYY-MM-DD in ET
  weekday: number;     // 0 = Sunday
  minutes: number;     // minutes since ET midnight
  hour: number;
  minute: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
});

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Break a Date into Eastern-time parts. */
export function etParts(at: Date = new Date()): EtParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(at)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  let hour = parseInt(map.hour ?? '0', 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(map.minute ?? '0', 10);
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    weekday: WEEKDAYS[map.weekday ?? 'Mon'] ?? 1,
    minutes: hour * 60 + minute,
    hour,
    minute,
  };
}

export function isTradingDay(date: string, weekday: number): boolean {
  if (weekday === 0 || weekday === 6) return false;
  return !MARKET_HOLIDAYS.has(date);
}

export function closeMinutesFor(date: string): number {
  return MARKET_EARLY_CLOSES.has(date) ? EARLY_CLOSE_MINUTES : CLOSE_MINUTES;
}

export type MarketPhase = 'open' | 'pre' | 'after' | 'closed';

export interface MarketState {
  phase: MarketPhase;
  isOpen: boolean;
  label: string;
  /** Milliseconds until the next open (when closed) or the close (when open). */
  msUntilChange: number;
  changeLabel: string;
}

/** Current market state, in Eastern time. */
export function marketState(at: Date = new Date()): MarketState {
  const p = etParts(at);
  const tradingDay = isTradingDay(p.date, p.weekday);
  const close = closeMinutesFor(p.date);

  if (tradingDay && p.minutes >= OPEN_MINUTES && p.minutes < close) {
    return {
      phase: 'open',
      isOpen: true,
      label: 'Market open',
      msUntilChange: (close - p.minutes) * 60_000,
      changeLabel: 'until close',
    };
  }

  const nextOpen = msUntilNextOpen(at);
  if (tradingDay && p.minutes < OPEN_MINUTES) {
    return { phase: 'pre', isOpen: false, label: 'Pre-market', msUntilChange: nextOpen, changeLabel: 'until open' };
  }
  if (tradingDay) {
    return { phase: 'after', isOpen: false, label: 'After hours', msUntilChange: nextOpen, changeLabel: 'until open' };
  }
  return { phase: 'closed', isOpen: false, label: 'Market closed', msUntilChange: nextOpen, changeLabel: 'until open' };
}

/** Milliseconds until the next 9:30 am ET session open. */
export function msUntilNextOpen(at: Date = new Date()): number {
  let cursor = at.getTime();
  for (let i = 0; i < 400; i++) {
    const p = etParts(new Date(cursor));
    if (isTradingDay(p.date, p.weekday) && p.minutes < OPEN_MINUTES) {
      return (OPEN_MINUTES - p.minutes) * 60_000 - (at.getTime() % 60_000);
    }
    // jump to just after midnight ET of the following day
    const toMidnight = (24 * 60 - p.minutes) * 60_000;
    cursor += toMidnight + 60_000;
  }
  return 0;
}

/** "2h 14m" / "48m" / "22s" */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

export function currentQuarter(at: Date = new Date()): { year: number; quarter: number } {
  const p = etParts(at);
  const [y, m] = p.date.split('-').map(Number);
  return { year: y, quarter: Math.ceil(m / 3) };
}

export function seasonLabel(year: number, quarter: number): string {
  return `Q${quarter} ${year}`;
}

export const money = (n: number | null | undefined, decimals = 2): string =>
  n == null || Number.isNaN(n)
    ? '—'
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const pct = (n: number | null | undefined, decimals = 2): string =>
  n == null || Number.isNaN(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;

export const shareCount = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');

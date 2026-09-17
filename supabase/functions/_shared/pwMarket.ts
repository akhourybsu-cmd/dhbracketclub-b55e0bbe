// Eastern-time US equity market calendar helpers, shared by Portfolio Wars functions.
// Mirrors src/lib/portfolioWars/market.ts — keep the holiday tables in sync.

export const MARKET_HOLIDAYS = new Set<string>([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

export const MARKET_EARLY_CLOSES = new Set<string>([
  "2026-11-27", "2026-12-24", "2027-11-26",
]);

const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;
const EARLY_CLOSE_MINUTES = 13 * 60;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
});

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface EtParts {
  date: string;
  weekday: number;
  minutes: number;
}

export function etParts(at: Date = new Date()): EtParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(at)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  let hour = parseInt(map.hour ?? "0", 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(map.minute ?? "0", 10);
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    weekday: WEEKDAYS[map.weekday ?? "Mon"] ?? 1,
    minutes: hour * 60 + minute,
  };
}

export function isTradingDay(date: string, weekday: number): boolean {
  if (weekday === 0 || weekday === 6) return false;
  return !MARKET_HOLIDAYS.has(date);
}

export function isMarketOpen(at: Date = new Date()): boolean {
  const p = etParts(at);
  if (!isTradingDay(p.date, p.weekday)) return false;
  const close = MARKET_EARLY_CLOSES.has(p.date) ? EARLY_CLOSE_MINUTES : CLOSE_MINUTES;
  return p.minutes >= OPEN_MINUTES && p.minutes < close;
}

export function etDate(at: Date = new Date()): string {
  return etParts(at).date;
}

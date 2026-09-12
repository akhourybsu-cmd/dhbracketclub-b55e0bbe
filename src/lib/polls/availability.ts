// Date-availability polls ("when can everyone meet?") — pure helpers.
//
// No DB access here. Dates are handled as timezone-naive calendar keys
// ("yyyy-MM-dd") so a Friendsgiving date never shifts across timezones.

export type AvailabilityResponse = 'yes' | 'maybe' | 'no';

export const RESPONSE_CYCLE: AvailabilityResponse[] = ['yes', 'maybe', 'no'];

export type DateOption = {
  id: string;
  /** "yyyy-MM-dd" */
  date: string;
  label: string;
};

export type AvailabilityVote = {
  user_id: string;
  option_id: string;
  response: AvailabilityResponse;
  display_name?: string | null;
};

export type MemberRef = {
  user_id: string;
  display_name: string | null;
};

export type DateTally = {
  option: DateOption;
  yes: MemberRef[];
  maybe: MemberRef[];
  no: MemberRef[];
  /** yes counts double, maybe counts single. */
  score: number;
  /** Everyone who answered the poll said yes, and at least one person did. */
  allAvailable: boolean;
};

/** Local calendar key for a Date. */
export function toDateKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Parse a "yyyy-MM-dd" key into a local Date (midday, so DST can't shift it). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri, Nov 27" — label stored alongside the date and shown in results. */
export function formatDateOptionLabel(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Next cycle step when a member taps a date. */
export function nextResponse(
  current: AvailabilityResponse | null,
  allowMaybe = true,
): AvailabilityResponse | null {
  if (current === null) return 'yes';
  if (current === 'yes') return allowMaybe ? 'maybe' : 'no';
  if (current === 'maybe') return 'no';
  return null; // cycling off clears the answer
}

function memberLabel(vote: AvailabilityVote, members: MemberRef[]): MemberRef {
  const match = members.find((m) => m.user_id === vote.user_id);
  return {
    user_id: vote.user_id,
    display_name: vote.display_name ?? match?.display_name ?? null,
  };
}

/**
 * Tally + rank candidate dates.
 * Order: everyone-available first, then most yes, then most maybe,
 * then fewest no, then earliest date.
 */
export function rankDateOptions(
  options: DateOption[],
  votes: AvailabilityVote[],
  members: MemberRef[] = [],
): DateTally[] {
  const respondents = new Set(votes.map((v) => v.user_id));

  const tallies: DateTally[] = options.map((option) => {
    const forOption = votes.filter((v) => v.option_id === option.id);
    const yes = forOption.filter((v) => v.response === 'yes').map((v) => memberLabel(v, members));
    const maybe = forOption.filter((v) => v.response === 'maybe').map((v) => memberLabel(v, members));
    const no = forOption.filter((v) => v.response === 'no').map((v) => memberLabel(v, members));
    return {
      option,
      yes,
      maybe,
      no,
      score: yes.length * 2 + maybe.length,
      allAvailable: respondents.size > 0 && yes.length === respondents.size,
    };
  });

  return tallies.sort((a, b) => {
    if (a.allAvailable !== b.allAvailable) return a.allAvailable ? -1 : 1;
    if (b.yes.length !== a.yes.length) return b.yes.length - a.yes.length;
    if (b.maybe.length !== a.maybe.length) return b.maybe.length - a.maybe.length;
    if (a.no.length !== b.no.length) return a.no.length - b.no.length;
    return a.option.date.localeCompare(b.option.date);
  });
}

/** Members of the club who haven't answered any date yet. */
export function pendingMembers(members: MemberRef[], votes: AvailabilityVote[]): MemberRef[] {
  const answered = new Set(votes.map((v) => v.user_id));
  return members.filter((m) => !answered.has(m.user_id));
}

/** "6 yes · 1 maybe · 2 no" — omits empty buckets. */
export function summarizeTally(t: DateTally): string {
  const parts: string[] = [];
  if (t.yes.length) parts.push(`${t.yes.length} yes`);
  if (t.maybe.length) parts.push(`${t.maybe.length} maybe`);
  if (t.no.length) parts.push(`${t.no.length} no`);
  return parts.length ? parts.join(' · ') : 'No answers yet';
}

/** Month grid (6 weeks, Sunday-first) of local dates for a calendar view. */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function formatMonthTitle(month: Date): string {
  return `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;
}

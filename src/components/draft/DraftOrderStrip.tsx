import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { draftInitials } from '@/lib/draft/presentation';

export interface DraftOrderParticipant {
  id: string;
  user_id: string;
  pick_order: number;
  profiles?: { display_name?: string | null } | null;
}

interface DraftOrderStripProps {
  participants: DraftOrderParticipant[];
  /** Total picks already made in the draft. */
  picksMade: number;
  /** 1-based number of the pick currently on the clock. */
  currentPickNumber: number;
  numRounds: number;
  currentUserId?: string | null;
  /** How many upcoming turns to preview. */
  lookahead?: number;
}

function initialsOf(name: string) {
  return draftInitials(name);
}

/**
 * Compact "who picks next" strip for the live draft room.
 *
 * The room previously showed only the current picker, so players had no
 * way to see where they sat in the snake order without counting picks by
 * hand. This derives the upcoming turns straight from the snake formula
 * (single source of truth: pick number → seat) rather than trusting any
 * stored `current_pick_user_id`.
 */
export function DraftOrderStrip({
  participants,
  picksMade,
  currentPickNumber,
  numRounds,
  currentUserId,
  lookahead = 6,
}: DraftOrderStripProps) {
  const ordered = useMemo(
    () => [...participants].sort((a, b) => a.pick_order - b.pick_order),
    [participants],
  );

  const upcoming = useMemo(() => {
    const n = ordered.length;
    if (n === 0) return [];
    const totalPicks = n * numRounds;
    const out: { pickNumber: number; round: number; p: DraftOrderParticipant }[] = [];
    for (let pick = currentPickNumber; pick <= totalPicks && out.length < lookahead; pick++) {
      const round = Math.ceil(pick / n);
      const posInRound = (pick - 1) % n;
      const seat = round % 2 === 1 ? posInRound : n - 1 - posInRound;
      out.push({ pickNumber: pick, round, p: ordered[seat] });
    }
    return out;
  }, [ordered, currentPickNumber, numRounds, lookahead]);

  if (upcoming.length === 0) return null;

  const totalPicks = ordered.length * numRounds;
  const pct = totalPicks > 0 ? Math.min(100, (picksMade / totalPicks) * 100) : 0;

  return (
    <div
      className="rounded-2xl mb-5 overflow-hidden"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(45 95% 55% / 0.16)' }}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/70">
          Draft Order
        </span>
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground/60">
          {picksMade}/{totalPicks} picks
        </span>
      </div>

      <div className="px-4 mt-2">
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, hsl(45 95% 55%), hsl(40 95% 50%))' }}
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-3">
        {upcoming.map(({ pickNumber, round, p }, i) => {
          const name = p?.profiles?.display_name || 'Unknown';
          const isNow = i === 0;
          const isMe = !!currentUserId && p?.user_id === currentUserId;
          return (
            <div
              key={pickNumber}
              className={cn(
                'flex-shrink-0 w-[86px] rounded-xl px-2 py-2 text-center',
                isNow && 'shadow-[0_0_14px_-4px_hsl(45_95%_55%/0.6)]',
              )}
              style={{
                background: isNow ? 'hsl(45 95% 55% / 0.14)' : 'hsl(var(--muted) / 0.35)',
                border: `1px solid ${isNow ? 'hsl(45 95% 55% / 0.5)' : isMe ? 'hsl(45 95% 55% / 0.28)' : 'hsl(var(--border))'}`,
              }}
            >
              <div
                className="mx-auto mb-1 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                style={{
                  background: isNow ? 'hsl(45 95% 55% / 0.26)' : 'hsl(var(--muted) / 0.7)',
                  color: isNow ? 'hsl(45 95% 68%)' : 'hsl(var(--muted-foreground))',
                }}
              >
                {initialsOf(name)}
              </div>
              <p
                className="text-[10px] font-bold leading-tight break-words"
                style={{ color: isNow ? 'hsl(45 95% 72%)' : undefined }}
              >
                {isMe ? 'You' : name}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/55 mt-0.5">
                {isNow ? 'On clock' : `R${round} · #${pickNumber}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { MoveLeft, MoveRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BoardParticipant {
  user_id: string;
  pick_order: number;
  profiles?: { display_name: string };
}

export interface BoardPick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round: number;
}

interface DraftBoardProps {
  participants: BoardParticipant[];
  picks: BoardPick[];
  numRounds: number;
  /** The pick number currently on the clock (1-based). */
  currentPickNumber: number;
  currentUserId?: string;
  /** pick id → enrichment (image urls etc.) */
  enrichments: Map<string, { image_url?: string | null; thumbnail_url?: string | null }>;
  /** picks made since the viewer's last visit */
  newPickIds: Set<string>;
}

function initials(name?: string) {
  return (name || '?').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

/**
 * The snake-draft board — the centerpiece of the draft room.
 * Desktop: full rounds × participants grid. Mobile: horizontally
 * swipeable round panels with snap, plus round-chip quick nav.
 */
export function DraftBoard({
  participants,
  picks,
  numRounds,
  currentPickNumber,
  currentUserId,
  enrichments,
  newPickIds,
}: DraftBoardProps) {
  const ordered = useMemo(
    () => [...participants].sort((a, b) => a.pick_order - b.pick_order),
    [participants],
  );
  const n = ordered.length;
  const totalPicks = n * numRounds;

  const pickByCell = useMemo(() => {
    const m = new Map<string, BoardPick>();
    picks.forEach((p) => m.set(`${p.round}:${p.user_id}`, p));
    return m;
  }, [picks]);

  const currentRound = Math.min(numRounds, Math.ceil(currentPickNumber / Math.max(1, n)));
  const trackRef = useRef<HTMLDivElement>(null);

  // Center the current round on mount (mobile swipe track).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const panel = track.querySelector<HTMLElement>(`[data-round="${currentRound}"]`);
    if (panel) {
      track.scrollTo({ left: panel.offsetLeft - (track.clientWidth - panel.clientWidth) / 2 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (n === 0) return null;

  const roundOrder = (round: number) =>
    round % 2 === 1 ? ordered : [...ordered].reverse();

  const pickNumberFor = (round: number, participantIdx: number) =>
    (round - 1) * n + participantIdx + 1;

  const renderCellContent = (round: number, p: BoardParticipant, idx: number, dense: boolean) => {
    const pick = pickByCell.get(`${round}:${p.user_id}`);
    const pickNum = pickNumberFor(round, idx);
    const isCurrent = !pick && pickNum === currentPickNumber;
    const isYou = p.user_id === currentUserId;
    const isNew = pick ? newPickIds.has(pick.id) : false;
    const enrichment = pick ? enrichments.get(pick.id) : undefined;
    const img = enrichment?.thumbnail_url || enrichment?.image_url;

    if (pick) {
      return (
        <div
          className={cn('dl-cell', isNew && 'dl-cell-new', isYou && 'dl-cell-you')}
          title={`${pick.pick_text} — ${p.profiles?.display_name || 'Unknown'}`}
        >
          {isNew && <span className="dl-new-dot" aria-label="New since your last visit" />}
          {img ? (
            <img src={img} alt="" loading="lazy" decoding="async" className="dl-cell-img" />
          ) : (
            <span className="dl-cell-num dl-display">{pick.pick_number}</span>
          )}
          <span className="dl-cell-text">{pick.pick_text}</span>
        </div>
      );
    }
    if (isCurrent) {
      return (
        <div className="dl-cell dl-cell-current">
          <span className="dl-cell-clock">On Clock</span>
          <span className="dl-cell-num dl-display">{pickNum}</span>
        </div>
      );
    }
    return (
      <div className={cn('dl-cell dl-cell-future', isYou && 'dl-cell-you')}>
        <span className="dl-cell-num dl-display">{pickNum}</span>
        {!dense && <span className="dl-cell-empty">—</span>}
      </div>
    );
  };

  const rounds = Array.from({ length: numRounds }, (_, i) => i + 1);

  return (
    <div className="da-lounge">
      {/* ── Mobile: swipeable round panels ── */}
      <div className="md:hidden">
        {/* Round quick-nav chips */}
        <div className="flex gap-1.5 overflow-x-auto dl-no-scrollbar pb-2 px-0.5" role="tablist" aria-label="Rounds">
          {rounds.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={r === currentRound}
              onClick={() => {
                const track = trackRef.current;
                const panel = track?.querySelector<HTMLElement>(`[data-round="${r}"]`);
                if (track && panel) {
                  track.scrollTo({ left: panel.offsetLeft - (track.clientWidth - panel.clientWidth) / 2, behavior: 'smooth' });
                }
              }}
              className={cn('dl-round-chip dl-display', r === currentRound && 'dl-round-chip-active')}
            >
              R{r}
            </button>
          ))}
        </div>

        <div ref={trackRef} className="dl-rounds-track dl-no-scrollbar">
          {rounds.map((round) => {
            const order = roundOrder(round);
            const made = order.filter((p) => pickByCell.has(`${round}:${p.user_id}`)).length;
            const DirIcon = round % 2 === 1 ? MoveRight : MoveLeft;
            return (
              <section key={round} data-round={round} className="dl-round-panel" aria-label={`Round ${round}`}>
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <p className="dl-eyebrow flex items-center gap-1.5">
                    Round {round}
                    <DirIcon className="w-3 h-3 text-[hsl(45,42%,55%)]" aria-hidden />
                  </p>
                  <p className="dl-display text-[10px] font-bold tabular-nums text-zinc-500">{made}/{n}</p>
                </div>
                <div className="space-y-1.5">
                  {order.map((p, idx) => {
                    const pick = pickByCell.get(`${round}:${p.user_id}`);
                    const pickNum = pickNumberFor(round, idx);
                    const isCurrent = !pick && pickNum === currentPickNumber;
                    return (
                      <div key={p.user_id} className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'dl-display w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                            p.user_id === currentUserId ? 'dl-avatar-gold' : 'dl-avatar-muted',
                          )}
                        >
                          {initials(p.profiles?.display_name)}
                        </div>
                        <div className="flex-1 min-w-0">{renderCellContent(round, p, idx, false)}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* ── Desktop/tablet: full board grid ── */}
      <div className="hidden md:block dl-card overflow-hidden">
        <div
          className="grid"
          style={{ gridTemplateColumns: `3rem repeat(${n}, minmax(7rem, 1fr))` }}
        >
          {/* Header row — participants */}
          <div className="dl-board-corner" aria-hidden />
          {ordered.map((p) => (
            <div key={p.user_id} className={cn('dl-board-head', p.user_id === currentUserId && 'dl-board-head-you')}>
              <div
                className={cn(
                  'dl-display w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold',
                  p.user_id === currentUserId ? 'dl-avatar-gold' : 'dl-avatar-muted',
                )}
              >
                {initials(p.profiles?.display_name)}
              </div>
              <span className="dl-display text-[11px] font-bold truncate max-w-full">
                {p.profiles?.display_name || 'Unknown'}
              </span>
            </div>
          ))}

          {/* Round rows */}
          {rounds.map((round) => {
            const order = roundOrder(round);
            const DirIcon = round % 2 === 1 ? MoveRight : MoveLeft;
            return [
              <div key={`rl-${round}`} className="dl-board-roundlabel">
                <span className="dl-display text-[11px] font-bold text-zinc-500">R{round}</span>
                <DirIcon className="w-3 h-3 text-[hsl(45,42%,55%)]" aria-hidden />
              </div>,
              ...order.map((p, idx) => (
                <div key={`${round}:${p.user_id}`} className="dl-board-cell">
                  {renderCellContent(round, p, idx, true)}
                </div>
              )),
            ];
          })}
        </div>
        <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 font-medium">
            Snake draft — order reverses each round
          </span>
          <span className="dl-display text-[10px] font-bold tabular-nums text-zinc-400">
            {picks.length}/{totalPicks} picks
          </span>
        </div>
      </div>
    </div>
  );
}

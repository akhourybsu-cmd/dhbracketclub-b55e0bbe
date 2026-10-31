import { useEffect, useMemo, useRef, useState } from 'react';
import { MoveLeft, MoveRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from 'framer-motion';
import { DraftPickArtwork } from './DraftPickArtwork';
import { draftInitials } from '@/lib/draft/presentation';

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
  /** live drafts: slots the host passed, keyed `${round}:${user_id}` */
  skippedSlots?: Set<string>;
}

function initials(name?: string) {
  return draftInitials(name);
}

function centerInTrack(track: HTMLElement, panel: HTMLElement, behavior: ScrollBehavior = 'auto') {
  const left = panel.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
  track.scrollTo({ left: Math.max(0, left - (track.clientWidth - panel.clientWidth) / 2), behavior });
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
  skippedSlots,
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
  const roundsRef = useRef<HTMLDivElement>(null);
  const [viewedRound, setViewedRound] = useState(currentRound);
  const viewedRoundRef = useRef(viewedRound);
  viewedRoundRef.current = viewedRound;
  const hadParticipants = useRef(n > 0);
  const repositioning = useRef(false);
  const reducedMotion = useReducedMotion();

  // Keep the explored round centered when crossing the desktop/mobile breakpoint.
  // Width changes alone recenter the track; normal swiping remains under player control.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (!hadParticipants.current && n > 0) {
      viewedRoundRef.current = currentRound;
      setViewedRound(currentRound);
    }
    hadParticipants.current = n > 0;
    let lastWidth = -1;
    let frame: number | undefined;
    const resize = () => {
      const width = track.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      repositioning.current = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (!width) return;
      const round = Math.max(1, Math.min(numRounds, viewedRoundRef.current));
      const panel = track.querySelector<HTMLElement>(`[data-round="${round}"]`);
      if (panel) centerInTrack(track, panel);
      const nav = roundsRef.current;
      const chip = nav?.querySelector<HTMLElement>(`[data-round-tab="${round}"]`);
      if (nav && chip) centerInTrack(nav, chip);
      frame = requestAnimationFrame(() => { repositioning.current = false; });
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(track);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [n, numRounds, currentRound]);

  useEffect(() => {
    const nav = roundsRef.current;
    const chip = nav?.querySelector<HTMLElement>(`[data-round-tab="${viewedRound}"]`);
    if (nav && chip && nav.clientWidth) centerInTrack(nav, chip);
  }, [viewedRound]);

  if (n === 0) return null;

  const roundOrder = (round: number) =>
    round % 2 === 1 ? ordered : [...ordered].reverse();

  /**
   * Each participant keeps their own column, so the pick number has to follow
   * the snake direction instead of the column index — otherwise a reversed
   * round shows someone's pick underneath the wrong person's name.
   */
  const pickNumberFor = (round: number, columnIdx: number) => {
    const posInRound = round % 2 === 1 ? columnIdx : n - 1 - columnIdx;
    return (round - 1) * n + posInRound + 1;
  };

  const columnIndexOf = (p: BoardParticipant) =>
    Math.max(0, ordered.findIndex((o) => o.user_id === p.user_id));

  const renderCellContent = (round: number, p: BoardParticipant, _idx: number, dense: boolean) => {
    const pick = pickByCell.get(`${round}:${p.user_id}`);
    const skipped = skippedSlots?.has(`${round}:${p.user_id}`) ?? false;
    const pickNum = pickNumberFor(round, columnIndexOf(p));
    const isCurrent = !pick && !skipped && pickNum === currentPickNumber;
    const isYou = p.user_id === currentUserId;
    const isNew = pick ? newPickIds.has(pick.id) : false;
    const enrichment = pick ? enrichments.get(pick.id) : undefined;

    if (!pick && skipped) {
      return (
        <div className="dl-cell dl-cell-future dl-cell-passed" title="Pick passed">
          <span className="dl-cell-num dl-display">{pickNum}</span>
          <span className="dl-cell-text">Passed</span>
        </div>
      );
    }

    if (pick) {
      return (
        <div
          className={cn('dl-cell', isNew && 'dl-cell-new', isYou && 'dl-cell-you')}
          title={`${pick.pick_text} — ${p.profiles?.display_name || 'Unknown'}`}
        >
          {isNew && <span className="dl-new-dot" aria-label="New since your last visit" />}
          <DraftPickArtwork artwork={enrichment} label={pick.pick_text} className="dl-cell-img" />
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
  const chooseRound = (round: number, behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth') => {
    viewedRoundRef.current = round;
    setViewedRound(round);
    const track = trackRef.current;
    const panel = track?.querySelector<HTMLElement>(`[data-round="${round}"]`);
    if (track && panel) centerInTrack(track, panel, behavior);
  };

  return (
    <div className="da-lounge da-room-board">
      {/* ── Mobile: swipeable round panels ── */}
      <div className="md:hidden">
        {/* Round quick-nav chips */}
        <div ref={roundsRef} className="flex gap-1.5 overflow-x-auto dl-no-scrollbar pb-2 px-0.5" role="tablist" aria-label="Rounds">
          {rounds.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              data-round-tab={r}
              tabIndex={r === viewedRound ? 0 : -1}
              aria-selected={r === viewedRound}
              onClick={() => chooseRound(r)}
              onKeyDown={(event) => {
                const next = event.key === 'ArrowRight' ? Math.min(numRounds, r + 1)
                  : event.key === 'ArrowLeft' ? Math.max(1, r - 1)
                    : event.key === 'Home' ? 1 : event.key === 'End' ? numRounds : null;
                if (next === null) return;
                event.preventDefault();
                chooseRound(next, 'auto');
                roundsRef.current?.querySelector<HTMLButtonElement>(`[data-round-tab="${next}"]`)?.focus({ preventScroll: true });
              }}
              className={cn('dl-round-chip dl-display', r === viewedRound && 'dl-round-chip-active')}
              aria-label={`View round ${r}${r === currentRound ? ', current round' : ''}`}
              title={r === currentRound ? 'Current round' : undefined}
            >
              R{r}
            </button>
          ))}
        </div>

        <div ref={trackRef} className="dl-rounds-track dl-no-scrollbar" onScroll={(event) => {
          const track = event.currentTarget;
          if (!track.clientWidth || repositioning.current) return;
          const middle = track.scrollLeft + track.clientWidth / 2;
          const nearest = [...track.querySelectorAll<HTMLElement>('[data-round]')].sort((a, b) => Math.abs(a.offsetLeft + a.clientWidth / 2 - middle) - Math.abs(b.offsetLeft + b.clientWidth / 2 - middle))[0];
          if (nearest) setViewedRound(Number(nearest.dataset.round));
        }}>
          {rounds.map((round) => {
            const order = roundOrder(round);
            const made = order.filter((p) => pickByCell.has(`${round}:${p.user_id}`)).length;
            const DirIcon = round % 2 === 1 ? MoveRight : MoveLeft;
            return (
              <section key={round} data-round={round} className="dl-round-panel" aria-label={`Round ${round}`}>
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <p className="dl-eyebrow flex items-center gap-1.5">
                    Round {round}
                    <DirIcon className="w-3 h-3 text-primary" aria-hidden />
                  </p>
                  <p className="dl-display text-[10px] font-bold tabular-nums text-muted-foreground">{made}/{n}</p>
                </div>
                <div className="space-y-1.5">
                  {order.map((p, idx) => {
                    const pick = pickByCell.get(`${round}:${p.user_id}`);
                    const pickNum = pickNumberFor(round, columnIndexOf(p));
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
      <div className="hidden md:block dl-card da-room-board-wide">
        <div className="da-room-board-scroll" tabIndex={0} role="region" aria-label="Full draft board">
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
            const DirIcon = round % 2 === 1 ? MoveRight : MoveLeft;
            return [
              <div key={`rl-${round}`} className="dl-board-roundlabel">
                <span className="dl-display text-[11px] font-bold text-muted-foreground">R{round}</span>
                <DirIcon className="w-3 h-3 text-primary" aria-hidden />
              </div>,
              // Columns stay locked to their owner; the round arrow conveys direction.
              ...ordered.map((p, idx) => (
                <div key={`${round}:${p.user_id}`} className="dl-board-cell">
                  {renderCellContent(round, p, idx, true)}
                </div>
              )),
            ];
          })}
        </div>
        </div>
        <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">
            Snake draft — order reverses each round
          </span>
          <span className="dl-display text-[10px] font-bold tabular-nums text-muted-foreground/85">
            {picks.length}/{totalPicks} picks
          </span>
        </div>
      </div>
    </div>
  );
}

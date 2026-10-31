import { motion } from 'framer-motion';
import { Trophy, Eye, Pencil } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  getPlayoffRoundShort,
  getPlayoffRoundName,
  getPlayoffGlyph,
  formatSeriesScore,
  type PlayoffRound,
} from '@/lib/playoffStyle';

// Reference the .da-mode token so the gold automatically deepens on
// the Daylight Coliseum (light) variant — no per-component theme check.
const GOLD = 'var(--da-gold)';

interface PlayerSide {
  userId: string | null;
  name: string | null;
  seed?: number | null;
  picksMade: number;
}

interface PlayoffMatchupHeroProps {
  round: PlayoffRound;
  matchNumber?: number | null;
  seasonName?: string | null;
  topic: string;
  status: 'setup' | 'in_progress' | 'complete';
  isMyTurn: boolean;
  isParticipant: boolean;
  currentPickerUserId?: string | null;
  currentRound: number;
  totalRounds: number;
  totalPicksMade: number;
  totalPicksExpected: number;
  playerA: PlayerSide;
  playerB: PlayerSide;
  finalsWins?: Record<string, number> | null;
  // Slots for actions (kept as render props so parent owns logic)
  shareSlot?: ReactNode;
  refreshSlot?: ReactNode;
  menuSlot?: ReactNode;
  onEditTopic?: () => void;
  canEditTopic?: boolean;
}

function Initials({ name }: { name: string | null }) {
  const initials = (name || '?')
    .split(/\s+/)
    .map(p => Array.from(p)[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return <>{initials}</>;
}

/** Stage-aware visual intensity for the playoff hero. */
function stageIntensity(round: PlayoffRound): {
  glowOpacity: number;
  borderOpacity: number;
  ringHsl: string;
  showCrown: boolean;
  showBrackets: boolean;
} {
  switch (round) {
    case 'final':
      return { glowOpacity: 0.55, borderOpacity: 0.5, ringHsl: GOLD, showCrown: true, showBrackets: true };
    case 'sf':
      return { glowOpacity: 0.38, borderOpacity: 0.38, ringHsl: GOLD, showCrown: false, showBrackets: true };
    case 'third_place':
      return { glowOpacity: 0.3, borderOpacity: 0.3, ringHsl: '30 70% 55%', showCrown: false, showBrackets: false };
    case 'qf':
    default:
      return { glowOpacity: 0.28, borderOpacity: 0.32, ringHsl: GOLD, showCrown: false, showBrackets: false };
  }
}

/**
 * Premium playoff matchup hero — replaces the generic draft header for playoff drafts.
 * Mobile-first, packs round identity + H2H + topic + status + actions above the fold.
 */
export function PlayoffMatchupHero({
  round,
  matchNumber,
  seasonName,
  topic,
  status,
  isMyTurn,
  isParticipant,
  currentPickerUserId,
  currentRound,
  totalRounds,
  totalPicksMade,
  totalPicksExpected,
  playerA,
  playerB,
  finalsWins,
  shareSlot,
  refreshSlot,
  menuSlot,
  onEditTopic,
  canEditTopic,
}: PlayoffMatchupHeroProps) {
  const series = formatSeriesScore(round, finalsWins, playerA.userId, playerB.userId);
  const glyph = getPlayoffGlyph(round);
  const roundName = getPlayoffRoundName(round);
  const progressPct = totalPicksExpected > 0
    ? Math.min(100, Math.round((totalPicksMade / totalPicksExpected) * 100))
    : 0;
  const stage = stageIntensity(round);

  const statusLabel =
    status === 'complete' ? 'Final' :
    status === 'in_progress' ? 'Live' :
    'Warming Up';

  const aIsActive = currentPickerUserId === playerA.userId && status === 'in_progress';
  const bIsActive = currentPickerUserId === playerB.userId && status === 'in_progress';

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl mb-4"
      style={{
        background: `
          radial-gradient(120% 80% at 0% 0%, hsl(${GOLD} / ${0.14 + stage.glowOpacity * 0.15}), transparent 55%),
          radial-gradient(120% 80% at 100% 0%, hsl(${GOLD} / ${0.1 + stage.glowOpacity * 0.1}), transparent 55%),
          linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.96) 100%)
        `,
        border: `1px solid hsl(${GOLD} / ${stage.borderOpacity})`,
        boxShadow: `0 10px 40px -16px hsl(${GOLD} / ${stage.glowOpacity}), inset 0 1px 0 hsl(${GOLD} / 0.18)`,
      }}
      aria-label={`${roundName} playoff matchup`}
    >
      {/* Top hairline */}
      <div
        className="absolute inset-x-0 top-0 h-px da-stage-glint"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${GOLD} / 0.85), transparent)` }}
      />

      {/* Subtle drifting bracket lines for SF/Finals */}
      {stage.showBrackets && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none da-bracket-drift"
          aria-hidden
          viewBox="0 0 400 240"
          preserveAspectRatio="none"
        >
          <g stroke={`hsl(${GOLD} / 0.08)`} strokeWidth="1" fill="none">
            <path d="M0 60 H120 V120 H280 V60 H400" />
            <path d="M0 180 H120 V120 H280 V180 H400" />
          </g>
        </svg>
      )}

      {/* Decorative glyph / crown */}
      <div
        className={cn(
          'absolute -right-4 -top-6 text-[88px] leading-none select-none pointer-events-none',
          stage.showCrown ? 'opacity-[0.1] da-crown-float' : 'opacity-[0.06]',
        )}
        aria-hidden
      >
        {glyph}
      </div>

      {/* ── Row 1: round chip + status + actions ───────────────────────── */}
      <div className="relative flex flex-wrap items-center gap-2 px-3.5 pt-3">
        <span
          className="shrink-0 inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md font-extrabold uppercase tracking-[0.18em] text-[9px] da-round-chip"
          style={{
            background: `linear-gradient(135deg, hsl(${GOLD} / 0.95), hsl(38 92% 50% / 0.85))`,
            color: 'hsl(160 10% 5%)',
            boxShadow: `0 0 10px hsl(${GOLD} / 0.4)`,
          }}
        >
          <Trophy className="w-2.5 h-2.5" strokeWidth={2.5} />
          {getPlayoffRoundShort(round)}
        </span>
        {round === 'final' && matchNumber ? (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(${GOLD})` }}>
            Game {matchNumber}
          </span>
        ) : null}
        {seasonName && (
          <span title={seasonName} className="min-w-0 flex-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 truncate">
            · {seasonName}
          </span>
        )}

        <span className="ml-auto shrink-0 inline-flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-[3px] rounded-full text-[9px] font-extrabold uppercase tracking-wider',
              status === 'in_progress' ? '' : 'bg-muted/50 text-muted-foreground',
            )}
            style={
              status === 'in_progress'
                ? { background: `hsl(${GOLD} / 0.18)`, color: `hsl(${GOLD})`, border: `1px solid hsl(${GOLD} / 0.4)` }
                : status === 'complete'
                ? { background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.3)' }
                : undefined
            }
          >
            {status === 'in_progress' && (
              <span
                className="w-1.5 h-1.5 rounded-full da-live-breathe"
                style={{ background: `hsl(${GOLD})`, boxShadow: `0 0 6px hsl(${GOLD})` }}
              />
            )}
            {statusLabel}
          </span>
          {shareSlot}
          {refreshSlot}
          {menuSlot}
        </span>
      </div>

      {/* ── Row 2: head-to-head ──────────────────────────────────────── */}
      <div className="relative px-3.5 pt-3 pb-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          {/* Player A */}
          <PlayerCell side="left" player={playerA} isActive={aIsActive} ringHsl={stage.ringHsl} />

          {/* VS pillar */}
          <div className="flex flex-col items-center gap-1 px-1">
            <span
              className="relative text-[10px] font-black tracking-[0.2em] da-vs-shimmer"
              style={{ color: `hsl(${GOLD})`, textShadow: `0 0 12px hsl(${GOLD} / 0.5)` }}
            >
              VS
            </span>
            {series ? (
              <span
                className="font-mono text-[11px] font-extrabold tabular-nums px-1.5 py-[1px] rounded"
                style={{ background: `hsl(${GOLD} / 0.18)`, color: `hsl(${GOLD})` }}
              >
                {series}
              </span>
            ) : (
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                {roundName}
              </span>
            )}
          </div>

          {/* Player B */}
          <PlayerCell side="right" player={playerB} isActive={bIsActive} ringHsl={stage.ringHsl} />
        </div>
      </div>

      {/* ── Row 3: topic ─────────────────────────────────────────────── */}
      <div className="relative px-3.5 pt-1 pb-2">
        <div className="flex items-start gap-1.5">
          <p className="text-[15px] font-extrabold tracking-tight leading-tight text-foreground/95 [overflow-wrap:anywhere] flex-1 min-w-0">
            {topic}
          </p>
          {canEditTopic && onEditTopic && (
            <button
              onClick={onEditTopic}
              className="p-2 -mr-1 -mt-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors flex-shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center"
              aria-label="Edit topic"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Row 4: progress + spectator pill ─────────────────────────── */}
      <div className="relative px-3.5 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div
              className="h-[5px] rounded-full overflow-hidden"
              style={{ background: 'hsl(var(--muted) / 0.5)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, hsl(${GOLD}), hsl(38 92% 50%))`,
                  boxShadow: `0 0 8px hsl(${GOLD} / 0.6)`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Round {Math.min(currentRound, totalRounds)} of {totalRounds}
              </span>
              <span className="font-mono text-[9px] font-extrabold tabular-nums" style={{ color: `hsl(${GOLD})` }}>
                {totalPicksMade}/{totalPicksExpected}
              </span>
            </div>
          </div>
          {!isParticipant && (
            <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[9px] font-bold uppercase tracking-wider bg-muted/40 text-muted-foreground border border-border/40 flex-shrink-0">
              <Eye className="w-2.5 h-2.5" /> Spectator
            </span>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function PlayerCell({
  side,
  player,
  isActive,
  ringHsl,
}: {
  side: 'left' | 'right';
  player: PlayerSide;
  isActive: boolean;
  ringHsl: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 min-w-0 rounded-xl px-2 py-1.5 transition-all',
        side === 'right' && 'flex-row-reverse text-right',
      )}
      style={
        isActive
          ? {
              background: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, hsl(${ringHsl} / 0.16), transparent)`,
            }
          : undefined
      }
    >
      {/* Avatar with optional rotating ring when active */}
      <div className="relative flex-shrink-0" style={{ width: 40, height: 40 }}>
        {isActive && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full da-avatar-ring"
            style={{
              background: `conic-gradient(from 0deg, hsl(${ringHsl}) 0deg, hsl(${ringHsl} / 0.1) 140deg, hsl(${ringHsl}) 280deg, hsl(${ringHsl} / 0.1) 360deg)`,
              padding: 2,
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
              filter: `drop-shadow(0 0 8px hsl(${ringHsl} / 0.55))`,
            }}
          />
        )}
        <div
          className={cn(
            'absolute inset-[2px] rounded-full flex items-center justify-center font-extrabold text-[12px]',
            !isActive && 'border-2',
          )}
          style={{
            background: isActive
              ? `linear-gradient(135deg, hsl(${ringHsl} / 0.28), hsl(38 92% 50% / 0.16))`
              : 'hsl(var(--muted) / 0.4)',
            borderColor: isActive ? undefined : 'hsl(var(--border))',
            color: isActive ? `hsl(${ringHsl})` : 'hsl(var(--foreground) / 0.7)',
          }}
        >
          <Initials name={player.name} />
        </div>
        {isActive && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full da-live-breathe"
            style={{ background: `hsl(${ringHsl})`, boxShadow: `0 0 6px hsl(${ringHsl})`, border: '1.5px solid hsl(var(--card))' }}
            aria-label="On the clock"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1" style={{ flexDirection: side === 'right' ? 'row-reverse' : undefined }}>
          {player.seed != null && (
            <span
              className="font-mono text-[9px] font-extrabold tabular-nums px-1 py-px rounded"
              style={{ background: 'hsl(var(--muted) / 0.6)', color: 'hsl(var(--muted-foreground))' }}
            >
              #{player.seed}
            </span>
          )}
          {isActive && (
            <span
              className="text-[9.5px] font-extrabold uppercase tracking-wider px-1 py-px rounded da-live-breathe"
              style={{ background: `hsl(${ringHsl} / 0.2)`, color: `hsl(${ringHsl})` }}
            >
              On Clock
            </span>
          )}
        </div>
        <div title={player.name || undefined} className="text-[12px] font-extrabold leading-tight truncate">
          {player.name || 'TBD'}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {player.picksMade} {player.picksMade === 1 ? 'pick' : 'picks'}
        </div>
      </div>
    </div>
  );
}

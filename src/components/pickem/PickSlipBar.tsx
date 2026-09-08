import { Check, ChevronUp, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Sticky bottom Pick Card — non-gambling pick summary.
 * Mobile-first; respects safe-area; collapses to a single bar.
 */
export function PickSlipBar({
  picked,
  total,
  remaining,
  status,
  cardLocked = false,
  onToggleCardLock,
  weekLockAt,
  tiebreakerRequired = false,
  tiebreakerReady = true,
}: {
  picked: number;
  total: number;
  remaining: number;
  status: 'open' | 'partial' | 'complete' | 'locked';
  cardLocked?: boolean;
  onToggleCardLock?: () => void;
  weekLockAt?: Date | null;
  tiebreakerRequired?: boolean;
  tiebreakerReady?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!weekLockAt || status === 'locked') return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [weekLockAt, status]);

  if (total === 0) return null;

  const pct = Math.round((picked / total) * 100);
  const allGamesDone = remaining === 0;
  const allDone = allGamesDone && tiebreakerReady;

  const label =
    status === 'locked' ? 'All picks locked'
    : cardLocked ? 'Card locked'
    : allGamesDone && !tiebreakerReady ? 'Add your tiebreaker'
    : allDone ? 'Your card is complete'
    : `${remaining} pick${remaining === 1 ? '' : 's'} remaining`;

  const accent =
    status === 'locked' ? 'hsl(var(--muted-foreground))'
    : cardLocked ? 'hsl(var(--gold))'
    : allDone ? 'hsl(var(--success))'
    : 'hsl(var(--gold))';

  // Show the Lock/Unlock card CTA whenever the week is still open and at least one pick exists.
  const showLockToggle = status !== 'locked' && picked > 0 && !!onToggleCardLock;

  // Countdown: human "Picks freeze in 2h 14m"
  let freezeIn: string | null = null;
  if (weekLockAt && status !== 'locked') {
    const diff = weekLockAt.getTime() - now;
    if (diff > 0) {
      const totalMin = Math.floor(diff / 60_000);
      const days = Math.floor(totalMin / 1440);
      const hrs = Math.floor((totalMin % 1440) / 60);
      const mins = totalMin % 60;
      if (days > 0) freezeIn = `${days}d ${hrs}h`;
      else if (hrs > 0) freezeIn = `${hrs}h ${mins}m`;
      else freezeIn = `${mins}m`;
    }
  }

  return (
    <div
      className="fixed left-0 right-0 z-30 px-3"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-[640px] mx-auto space-y-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'w-full pk-scorebug px-4 py-2.5 flex items-center gap-3 active:scale-[0.99] transition-transform',
            'backdrop-blur-md',
          )}
          style={{ borderColor: `${accent.replace(')', ' / 0.45)')}`, boxShadow: `0 -2px 16px ${accent.replace(')', ' / 0.18)')}, var(--shadow-card)` }}
          aria-expanded={open}
        >
          {/* Status orb */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${accent.replace(')', ' / 0.15)')}`, border: `1px solid ${accent.replace(')', ' / 0.45)')}` }}
          >
            {status === 'locked' ? (
              <Lock className="w-4 h-4" style={{ color: accent }} />
            ) : cardLocked ? (
              <Lock className="w-4 h-4" style={{ color: accent }} />
            ) : allDone ? (
              <Check className="w-4 h-4" style={{ color: accent }} />
            ) : (
              <span className="text-[11px] font-extrabold tabular-nums" style={{ color: accent }}>
                {picked}
              </span>
            )}
          </div>

          {/* Text + progress */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: accent }}>
              Pick Card
            </p>
            <p className="text-[12px] font-extrabold text-white truncate">{label}</p>
            <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: accent, boxShadow: `0 0 8px ${accent.replace(')', ' / 0.6)')}` }}
              />
            </div>
            {freezeIn && (
              <p className="text-[10px] text-white/55 mt-1 tabular-nums">
                Picks freeze in <span className="text-white/85 font-extrabold">{freezeIn}</span>
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <p className="text-[14px] font-extrabold tabular-nums leading-none text-white">
              {picked}<span className="text-white/55 text-[11px]">/{total}</span>
            </p>
            <ChevronUp
              className={cn('w-3.5 h-3.5 text-white/60 mt-1 transition-transform inline-block', open && 'rotate-180')}
            />
          </div>
        </button>

        {/* Lock / Unlock card CTA */}
        {showLockToggle && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCardLock!(); }}
            className={cn(
              'w-full rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.14em] btn-press transition-colors backdrop-blur-md border',
              cardLocked
                ? 'bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted/60'
                : 'bg-gold/15 border-gold/45 text-gold hover:bg-gold/20',
            )}
            style={!cardLocked ? { boxShadow: '0 0 14px hsl(var(--gold) / 0.25)' } : undefined}
          >
            {cardLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {cardLocked ? 'Unlock card' : (allDone ? 'Lock card' : 'Lock current picks')}
          </button>
        )}

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              transition={{ duration: 0.18 }}
              className="pk-scorebug p-3 text-[11px] text-white/75 leading-relaxed"
            >
              <p>
                <strong className="text-white">Tap a team to pick — tap again to unselect.</strong>{' '}
                Lock your card to prevent accidental changes. You can unlock anytime before picks freeze
                {weekLockAt ? ` (${weekLockAt.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}).` : '.'}
                {tiebreakerRequired && !tiebreakerReady ? ' Your featured-game tiebreaker is still missing.' : ''}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

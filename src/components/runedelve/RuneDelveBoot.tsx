import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { chapterFor, chapterMeta } from '@/lib/runedelve/levelGenerator';
import { getClass } from '@/lib/runedelve/classConfig';
import { useRuneDelveSfx } from '@/hooks/useRuneDelveSfx';
import runedelveEmblem from '@/assets/runedelve-emblem.png';

const BOOT_FLAG = 'rd_boot_played_v1';
const DURATION = 1400; // ms — short, premium, never annoying

const FLAVORS = [
  'Awakening the sigils…',
  'Charging your runes…',
  'Lighting the torches…',
  'Unsealing the vault…',
  'Descending into the depths…',
];

/**
 * Premium fantasy entry sequence for Rune Delve.
 *
 * Mobile-first composition: vertical stack centered on screen with a
 * glowing arcane sigil, animated rune title, hero/chapter context line,
 * an engraved "rune-charge" loading bar, and a rotating flavor subtitle.
 *
 * Plays once per browser session via sessionStorage so route changes
 * inside Rune Delve do not retrigger it.
 */
export function RuneDelveBoot() {
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [flavorIdx, setFlavorIdx] = useState(0);
  const { play } = useRuneDelveSfx();
  const playedReady = useRef(false);
  const reducedMotion = useReducedMotion();

  const { data: hero } = useRuneDelveHero();
  const { data: progressData } = useMyProgress(hero?.class);

  const chapter = progressData ? chapterFor(progressData.highest_unlocked_level) : 1;
  const meta = chapterMeta(chapter);
  const cls = hero ? getClass(hero.class) : null;

  // Pick a stable flavor for this boot from the chapter (keeps it themed).
  const flavor = useMemo(() => FLAVORS[(chapter - 1) % FLAVORS.length], [chapter]);

  useEffect(() => {
    let played = false;
    try {
      played = sessionStorage.getItem(BOOT_FLAG) === '1';
    } catch { /* session storage is optional */ }
    if (played) return;

    // Respect the OS/browser motion preference by skipping the cinematic
    // entirely. The game remains immediately usable and does not replay it.
    if (reducedMotion) {
      try {
        sessionStorage.setItem(BOOT_FLAG, '1');
      } catch { /* session storage is optional */ }
      return;
    }

    setShow(true);
    try {
      sessionStorage.setItem(BOOT_FLAG, '1');
    } catch { /* session storage is optional */ }

    // Boot drone — long, slow rising tone synced to the bar fill.
    play('boot.charge', { skipHaptic: true });

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      // Ease-out for a premium "filling" feel
      const linear = Math.min(1, elapsed / DURATION);
      const eased = 1 - Math.pow(1 - linear, 1.6);
      setProgress(Math.round(eased * 100));
      // Swap flavor at ~55%
      if (linear > 0.55) setFlavorIdx(1);
      if (linear < 1) raf = requestAnimationFrame(tick);
      else {
        if (!playedReady.current) {
          playedReady.current = true;
          play('boot.ready');
        }
        setTimeout(() => setShow(false), 220);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, reducedMotion]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center px-6"
          style={{
            background:
              'radial-gradient(ellipse 75% 55% at 50% 38%, hsl(var(--rd-arcane) / 0.28), transparent 65%),' +
              'radial-gradient(ellipse 90% 60% at 50% 110%, hsl(var(--rd-ember) / 0.18), transparent 70%),' +
              'radial-gradient(ellipse 60% 40% at 50% 0%, hsl(var(--rd-rune-blue) / 0.14), transparent 70%),' +
              'linear-gradient(180deg, hsl(230 20% 4%), hsl(230 16% 7%))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Drifting arcane motes — purely decorative */}
          <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  left: `${(i * 17 + 8) % 100}%`,
                  bottom: -10,
                  background: 'hsl(var(--rd-arcane) / 0.55)',
                  boxShadow: '0 0 10px hsl(var(--rd-arcane) / 0.7)',
                }}
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: -480, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 4 + i * 0.3,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: 'easeOut',
                }}
              />
            ))}
          </div>

          {/* Vignette frame to deepen edges */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 50%, hsl(0 0% 0% / 0.55) 100%)',
            }}
          />

          {/* Sigil ring */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-36 h-36 mb-7 flex items-center justify-center"
          >
            {/* Outer pulsing halo */}
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, hsl(var(--rd-arcane) / 0.5), transparent 70%)',
                filter: 'blur(8px)',
              }}
            />
            {/* Slow rotating rune ring */}
            <motion.div
              className="absolute inset-0 rounded-full border"
              animate={{ rotate: 360 }}
              transition={{ duration: 14, ease: 'linear', repeat: Infinity }}
              style={{
                borderStyle: 'dashed',
                borderColor: 'hsl(var(--rd-arcane) / 0.55)',
                boxShadow:
                  '0 0 30px hsl(var(--rd-arcane) / 0.35), inset 0 0 24px hsl(var(--rd-arcane) / 0.25)',
              }}
            />
            {/* Inner counter-rotating ring */}
            <motion.div
              className="absolute inset-3 rounded-full border"
              animate={{ rotate: -360 }}
              transition={{ duration: 22, ease: 'linear', repeat: Infinity }}
              style={{
                borderColor: 'hsl(var(--rd-rune-blue) / 0.4)',
                borderStyle: 'dotted',
              }}
            />
            {/* Rune Delve emblem */}
            <img
              src={runedelveEmblem}
              alt="Rune Delve"
              width={128}
              height={128}
              className="relative w-[120px] h-[120px] object-contain"
              style={{ filter: 'drop-shadow(0 0 18px hsl(var(--rd-arcane) / 0.7))' }}
            />
          </motion.div>

          {/* Title block */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="text-center"
          >
            <p
              className="font-rd-display text-[10px] font-extrabold uppercase tracking-[0.45em] mb-1.5"
              style={{ color: 'hsl(var(--rd-arcane))' }}
            >
              ◆ Rune Delve ◆
            </p>
            <h1
              className="rd-title text-[30px] leading-none tracking-wide"
              style={{
                background:
                  'linear-gradient(180deg, hsl(150 20% 98%) 0%, hsl(var(--rd-arcane) / 0.85) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 24px hsl(var(--rd-arcane) / 0.35)',
              }}
            >
              {meta.name}
            </h1>
            <p className="text-[11px] font-bold mt-1.5 italic" style={{ color: 'hsl(150 14% 78%)' }}>
              {meta.subtitle}
            </p>
          </motion.div>

          {/* Hero / chapter context line */}
          {hero && progressData && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full"
              style={{
                background: 'hsl(var(--rd-stone-edge) / 0.85)',
                border: '1px solid hsl(var(--rd-arcane) / 0.25)',
              }}
            >
              <span className="text-[10px] font-extrabold tracking-wide truncate max-w-[140px]">
                {hero.hero_name}
              </span>
              <span className="text-[9px] text-muted-foreground">·</span>
              <span className="text-[10px] font-bold text-muted-foreground">
                Ch {chapter} · L{progressData.highest_unlocked_level}
              </span>
            </motion.div>
          )}

          {/* Engraved rune-charge bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="mt-8 w-full max-w-[260px]"
          >
            <div
              className="relative h-2 rounded-full overflow-hidden"
              style={{
                background: 'hsl(var(--rd-stone-edge))',
                boxShadow:
                  'inset 0 1px 2px hsl(0 0% 0% / 0.7), inset 0 -1px 0 hsl(var(--rd-arcane) / 0.15)',
              }}
            >
              {/* Tick marks (engraved divisions) */}
              <div
                aria-hidden
                className="absolute inset-0 flex items-stretch justify-between px-[2px] pointer-events-none opacity-50"
              >
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="w-px" style={{ background: 'hsl(0 0% 0% / 0.5)' }} />
                ))}
              </div>
              {/* Fill */}
              <motion.div
                className="h-full relative"
                style={{
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, hsl(var(--rd-rune-blue)), hsl(var(--rd-arcane)) 60%, hsl(var(--rd-ember)))',
                  boxShadow: '0 0 14px hsl(var(--rd-arcane) / 0.85)',
                }}
              >
                {/* Leading shimmer */}
                <span
                  className="absolute right-0 top-0 bottom-0 w-6"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.5))',
                  }}
                />
              </motion.div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <AnimatePresence mode="wait">
                <motion.p
                  key={flavorIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: 'hsl(var(--rd-arcane))' }}
                >
                  {flavorIdx === 0 ? flavor : 'Entering the realm…'}
                </motion.p>
              </AnimatePresence>
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                {progress}%
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

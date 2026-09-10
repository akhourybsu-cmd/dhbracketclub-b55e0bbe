import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import pickemEmblem from '@/assets/pickem-emblem.png';

const BOOT_FLAG = 'pk_boot_played_v1';
const DURATION = 1300;

const STAGES = [
  'Tuning broadcast feed…',
  'Loading season schedule…',
  'Game Center online',
];

/**
 * One-time stadium-light boot intro for the NFL Game Center standalone shell.
 * Plays once per browser session on first entry into /nfl/* or /pickem/*.
 * Matches the Nexus / RuneDelve "loading into another app" pattern.
 */
export function PickemBoot() {
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let played = false;
    try { played = sessionStorage.getItem(BOOT_FLAG) === '1'; } catch { /* Storage can be disabled in privacy mode. */ }
    if (played) return;

    setShow(true);
    try { sessionStorage.setItem(BOOT_FLAG, '1'); } catch { /* The intro still works without persistence. */ }

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      const linear = Math.min(1, elapsed / DURATION);
      const eased = 1 - Math.pow(1 - linear, 1.7);
      setProgress(Math.round(eased * 100));
      if (linear > 0.45 && linear <= 0.85) setStage(1);
      if (linear > 0.85) setStage(2);
      if (linear < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setShow(false), 280);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center px-6"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 38%, hsl(152 72% 36% / 0.30), transparent 60%),' +
              'radial-gradient(ellipse 90% 60% at 50% 110%, hsl(45 95% 55% / 0.18), transparent 70%),' +
              'linear-gradient(180deg, hsl(160 50% 4%), hsl(160 60% 2%))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Yard-line shimmer */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, transparent 0, transparent 48px, hsl(0 0% 100% / 0.05) 48px, hsl(0 0% 100% / 0.05) 49px)',
              maskImage: 'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 25%, black 75%, transparent 100%)',
            }}
          />

          {/* Stadium light flares */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 18% 12%, hsl(45 95% 70% / 0.15), transparent 35%),' +
                'radial-gradient(circle at 82% 12%, hsl(45 95% 70% / 0.15), transparent 35%)',
            }}
          />

          {/* Emblem with rotating ring */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-32 h-32 mb-7 flex items-center justify-center"
          >
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, hsl(45 95% 55% / 0.55), transparent 70%)',
                filter: 'blur(10px)',
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
              style={{
                borderStyle: 'dashed',
                borderColor: 'hsl(45 95% 55% / 0.55)',
                boxShadow:
                  '0 0 24px hsl(45 95% 55% / 0.4), inset 0 0 18px hsl(152 72% 46% / 0.2)',
              }}
            />
            <img
              src={pickemEmblem}
              alt="NFL Game Center"
              width={104}
              height={104}
              className="relative w-[104px] h-[104px] object-contain"
              style={{ filter: 'drop-shadow(0 0 18px hsl(45 95% 55% / 0.65))' }}
            />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="text-center"
          >
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.32em] mb-1.5"
              style={{ color: 'hsl(45 95% 60%)' }}
            >
              ◆ DH · NFL COMMAND DECK ◆
            </p>
            <h1
              className="text-[26px] font-black leading-none tracking-tight"
              style={{
                background:
                  'linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(45 95% 60% / 0.95) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 24px hsl(45 95% 55% / 0.35)',
              }}
            >
              NFL Game Center
            </h1>
            <p className="text-[10px] font-bold mt-1.5" style={{ color: 'hsl(150 12% 78%)' }}>
              Booting broadcast deck
            </p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-8 w-full max-w-[260px]"
          >
            <div
              className="relative h-1.5 rounded-full overflow-hidden"
              style={{
                background: 'hsl(160 35% 8%)',
                boxShadow:
                  'inset 0 1px 2px hsl(0 0% 0% / 0.7), inset 0 0 0 1px hsl(45 95% 55% / 0.2)',
              }}
            >
              <motion.div
                className="h-full relative"
                style={{
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, hsl(152 72% 46%), hsl(45 95% 55%) 60%, hsl(45 100% 70%))',
                  boxShadow: '0 0 14px hsl(45 95% 55% / 0.85)',
                }}
              >
                <span
                  className="absolute right-0 top-0 bottom-0 w-5"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.55))',
                  }}
                />
              </motion.div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <AnimatePresence mode="wait">
                <motion.p
                  key={stage}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="text-[9px] font-extrabold uppercase tracking-[0.24em]"
                  style={{ color: 'hsl(45 95% 60%)' }}
                >
                  {STAGES[stage]}
                </motion.p>
              </AnimatePresence>
              <span className="text-[10px] font-mono tabular-nums text-white/55">
                {progress}%
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

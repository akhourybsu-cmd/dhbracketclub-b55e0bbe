import { AnimatePresence, motion } from 'framer-motion';
import type { PickReveal } from './usePickReveals';

interface PickRevealOverlayProps {
  reveal: PickReveal | null;
  reduceMotion: boolean;
}

/**
 * Full-screen cinematic pick announcement: "Pick locked" → "The pick is in" →
 * the pick itself with a clip-path wipe. Shared by the projector kiosk and
 * each player's personal kiosk.
 */
export function PickRevealOverlay({ reveal, reduceMotion }: PickRevealOverlayProps) {
  return (
    <AnimatePresence mode="wait">
      {reveal && reveal.phase !== 'landing' && (
        <motion.div
          key={reveal.pick.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.35 }}
          className="da-kiosk-reveal fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-8 pointer-events-none"
        >
          <div className="da-kiosk-reveal-beam" aria-hidden />
          <div className="da-kiosk-reveal-lines" aria-hidden />
          <AnimatePresence mode="wait">
            {reveal.phase === 'locked' && (
              <motion.div
                key="locked"
                initial={{ opacity: 0, scale: 1.16, letterSpacing: '0.32em' }}
                animate={{ opacity: 1, scale: 1, letterSpacing: '0.18em' }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.55 }}
                className="da-kiosk-reveal-status dl-display"
              >
                <span className="da-kiosk-lock-mark" aria-hidden />
                Pick locked
              </motion.div>
            )}
            {reveal.phase === 'confirmed' && (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, filter: 'blur(8px)' }}
                transition={{ duration: reduceMotion ? 0.12 : 0.45 }}
                className="text-center"
              >
                <p className="da-kiosk-reveal-kicker dl-display">Selection confirmed</p>
                <p className="da-kiosk-reveal-in dl-display">The pick is in</p>
              </motion.div>
            )}
            {reveal.phase === 'reveal' && (
              <motion.div
                key="reveal"
                layoutId={`kiosk-pick-${reveal.pick.id}`}
                initial={{ opacity: 0, y: 24, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0.15 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="da-kiosk-reveal-card"
              >
                <p className="da-kiosk-reveal-kicker dl-display">
                  Pick #{reveal.pick.pick_number} · Round {reveal.pick.round}
                </p>
                <motion.p
                  initial={{ clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ clipPath: 'inset(0 0% 0 0)' }}
                  transition={{ delay: reduceMotion ? 0 : 0.25, duration: reduceMotion ? 0.15 : 1.1, ease: [0.22, 1, 0.36, 1] }}
                  className="da-kiosk-reveal-pick dl-display"
                >
                  {reveal.pick.pick_text}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 1.15, duration: 0.4 }}
                  className="da-kiosk-reveal-name dl-display"
                >
                  {reveal.name}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

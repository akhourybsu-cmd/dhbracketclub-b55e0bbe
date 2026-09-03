import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';

// Snappy route transitions: the exit is near-instant (so `mode="wait"` barely
// pauses before the next page enters) and the enter is a quick spring. This
// keeps navigation feeling immediate while retaining a touch of polish.
const MOTION: Variants = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: { duration: 0.06, ease: 'linear' } },
};

// prefers-reduced-motion: fade only, no movement.
const REDUCED: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.06 } },
};

export const PageTransition = forwardRef<HTMLDivElement, { children: ReactNode }>(
  ({ children }, ref) => {
    const reduce = useReducedMotion();
    return (
      <motion.div ref={ref} initial="initial" animate="animate" exit="exit" variants={reduce ? REDUCED : MOTION}>
        {children}
      </motion.div>
    );
  }
);

PageTransition.displayName = 'PageTransition';

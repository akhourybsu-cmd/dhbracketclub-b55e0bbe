import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ReactNode, forwardRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Direction-aware, native-feeling transitions:
//  • going deeper (list → detail) slides in from the right
//  • going back up slides in from the left
//  • switching between top-level tabs is a quick fade + settle
// Exit is near-instant so `mode="wait"` never feels laggy.
let lastPath = typeof window !== 'undefined' ? window.location.pathname : '/';
const depth = (p: string) => p.split('/').filter(Boolean).length;

function directionFor(next: string): 'push' | 'pop' | 'tab' {
  const prev = lastPath;
  lastPath = next;
  const a = depth(prev);
  const b = depth(next);
  if (b > a) return 'push';
  if (b < a) return 'pop';
  return 'tab';
}

const ease = [0.22, 1, 0.36, 1] as const;
const VARIANTS: Record<'push' | 'pop' | 'tab', Variants> = {
  push: { initial: { opacity: 0, x: 28 }, animate: { opacity: 1, x: 0, transition: { duration: 0.24, ease } }, exit: { opacity: 0, transition: { duration: 0.06 } } },
  pop: { initial: { opacity: 0, x: -22 }, animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease } }, exit: { opacity: 0, transition: { duration: 0.06 } } },
  tab: { initial: { opacity: 0, scale: 0.985 }, animate: { opacity: 1, scale: 1, transition: { duration: 0.18, ease } }, exit: { opacity: 0, transition: { duration: 0.05 } } },
};

const REDUCED: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.06 } },
};

export const PageTransition = forwardRef<HTMLDivElement, { children: ReactNode }>(
  ({ children }, ref) => {
    const reduce = useReducedMotion();
    const { pathname } = useLocation();
    const [dir] = useState(() => directionFor(pathname));
    return (
      <motion.div ref={ref} initial="initial" animate="animate" exit="exit" variants={reduce ? REDUCED : VARIANTS[dir]}>
        {children}
      </motion.div>
    );
  }
);

PageTransition.displayName = 'PageTransition';

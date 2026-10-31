import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Transition } from 'framer-motion';

/** Shared spring used across draft list rows + pick input feedback. */
export const springSnap: Transition = { type: 'spring', stiffness: 260, damping: 24 };

/** Slow breathing pulse used by the On-the-Clock hero glow. */
export const pulseGlow = {
  initial: { opacity: 0.45 },
  animate: {
    opacity: [0.45, 0.8, 0.45],
    transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
  },
};

function subscribeMotion(listener: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', listener);
  document.addEventListener('visibilitychange', listener);
  return () => {
    query.removeEventListener('change', listener);
    document.removeEventListener('visibilitychange', listener);
  };
}
const motionEnabled = () => !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotion = () => false;
function useDraftMotionEnabled() {
  return useSyncExternalStore(subscribeMotion, motionEnabled, serverMotion);
}

/**
 * Animate a numeric value from 0 → target on first mount, and tween on
 * subsequent changes. Pure rAF, no deps.
 */
export function useCountUp(value: number, durationMs = 700): number {
  const enabled = useDraftMotionEnabled();
  const [display, setDisplay] = useState(() => enabled ? 0 : value);
  const displayRef = useRef(display);

  useEffect(() => {
    let frame: number | undefined;
    let start: number | null = null;
    const from = displayRef.current;
    if (!enabled || durationMs <= 0 || !Number.isFinite(value) || from === value) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    const step = (t: number) => {
      if (start == null) start = t;
      const elapsed = t - start;
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (value - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [value, durationMs, enabled]);

  return enabled ? display : value;
}

/**
 * Returns the set of IDs newly added since the previous render. The very
 * first render returns an empty set so we never highlight on initial mount.
 */
export function useFirstSeen<T extends string | number>(
  ids: T[],
  { ready = true, scope = '' }: { ready?: boolean; scope?: string } = {},
): Set<T> {
  const enabled = useDraftMotionEnabled();
  const seenRef = useRef<{ scope: string; ids: Set<T> } | null>(null);
  const [fresh, setFresh] = useState<Set<T>>(new Set());
  const identity = JSON.stringify(ids);

  useEffect(() => {
    const currentIds = JSON.parse(identity) as T[];
    if (!ready) {
      seenRef.current = null;
      setFresh(new Set());
      return;
    }
    if (!seenRef.current || seenRef.current.scope !== scope || !enabled) {
      seenRef.current = { scope, ids: new Set(currentIds) };
      setFresh(new Set());
      return;
    }
    const next = new Set<T>();
    for (const id of currentIds) {
      if (!seenRef.current.ids.has(id)) next.add(id);
      seenRef.current.ids.add(id);
    }
    setFresh(next);
    if (!next.size) return;
    const timer = window.setTimeout(() => setFresh(new Set()), 900);
    return () => window.clearTimeout(timer);
  }, [identity, ready, scope, enabled]);

  return enabled && ready ? fresh : new Set();
}

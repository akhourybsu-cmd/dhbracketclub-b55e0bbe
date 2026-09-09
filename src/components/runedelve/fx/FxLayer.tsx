import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import type { FxEntry } from '@/hooks/useFxQueue';
import { RuneChainFx } from './RuneChainFx';
import { AbilityFx } from './AbilityFx';

interface Props {
  queue: FxEntry[];
  onComplete: (id: string) => void;
}

/**
 * Single overlay layer for all Rune Delve combat FX. Mounted once inside the
 * play page's relative root. Tracks its own bounding rect so children can
 * position effects in absolute coords relative to the board area.
 */
export function FxLayer({ queue, onComplete }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const reducedMotion = useReducedMotion();

  // Combat stays responsive for players who disable animation: consume queued
  // effects immediately instead of leaving invisible entries waiting on an
  // animation callback that will never fire.
  useEffect(() => {
    if (!reducedMotion) return;
    queue.forEach(fx => onComplete(fx.id));
  }, [onComplete, queue, reducedMotion]);

  useEffect(() => {
    if (!ref.current) return;
    const update = () => setRect(ref.current!.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ zIndex: 30 }}
    >
      <AnimatePresence>
        {!reducedMotion && rect && queue.map(fx =>
          fx.kind === 'rune' ? (
            <RuneChainFx key={fx.id} fx={fx} containerRect={rect} onDone={() => onComplete(fx.id)} />
          ) : (
            <AbilityFx key={fx.id} fx={fx} containerRect={rect} onDone={() => onComplete(fx.id)} />
          ),
        )}
      </AnimatePresence>
    </div>
  );
}

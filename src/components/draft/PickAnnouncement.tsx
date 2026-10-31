import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';

interface PickAnnouncementProps {
  pick: {
    id?: string;
    displayName: string;
    pickText: string;
    round: number;
    pickNumber: number;
  } | null;
  onHide?: () => void;
}

/** A short broadcast receipt for a newly confirmed pick, never a blocking modal. */
export function PickAnnouncement({ pick, onHide }: PickAnnouncementProps) {
  const [currentPick, setCurrentPick] = useState<PickAnnouncementProps['pick']>(null);
  const timerRef = useRef<number>();
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  const reduce = useReducedMotion();
  const key = pick ? (pick.id ?? `${pick.pickNumber}:${pick.pickText}:${pick.displayName}`) : null;

  useEffect(() => {
    if (!pick || document.hidden) { setCurrentPick(null); return; }
    setCurrentPick(pick);
    const timer = window.setTimeout(() => {
      setCurrentPick(null);
      onHideRef.current?.();
    }, 3200);
    timerRef.current = timer;
    const hide = () => {
      if (!document.hidden) return;
      window.clearTimeout(timer);
      setCurrentPick(null);
      onHideRef.current?.();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide);
    };
    // The display identity is stable while live clocks and parent views rerender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <AnimatePresence>
      {currentPick && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="da-pick-receipt"
          role="status"
          aria-live="polite"
        >
          <span className="da-pick-receipt-mark" aria-hidden="true"><Check size={18} /></span>
          <div>
            <small>SELECTION LOCKED · R{currentPick.round} / #{currentPick.pickNumber}</small>
            <strong>{currentPick.pickText}</strong>
            <span>{currentPick.displayName}</span>
          </div>
          <button type="button" aria-label="Dismiss pick announcement" onClick={() => { window.clearTimeout(timerRef.current); setCurrentPick(null); onHideRef.current?.(); }}><X size={16} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

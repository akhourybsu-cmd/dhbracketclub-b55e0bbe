import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import draftEmblem from '@/assets/draft-emblem.png';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const BOOT_FLAG = 'da_boot_played_v1';

function shouldEnter() {
  try {
    return sessionStorage.getItem(BOOT_FLAG) !== '1' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden;
  } catch {
    return false;
  }
}

/** A short, skippable entrance. It never represents network or draft progress. */
export function DraftArenaBoot() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(shouldEnter);

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(BOOT_FLAG, '1'); } catch { /* optional presentation */ }
    const timer = window.setTimeout(() => setShow(false), 1100);
    const visibility = () => { if (document.hidden) setShow(false); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [show]);
  useEffect(() => { if (reduced) setShow(false); }, [reduced]);

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="da-mode da-lounge da-arena-boot" aria-describedby="da-arena-entrance-description">
        <div className="da-arena-boot-grid" aria-hidden="true" />
        <motion.div className="da-arena-boot-medallion"
          initial={{ opacity: 0, scale: 0.82, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} aria-hidden="true">
          <span /><span />
          <img src={draftEmblem} alt="" width={110} height={110} />
        </motion.div>
        <div className="da-arena-boot-copy">
          <p className="da-arena-eyebrow">DH · DRAFT LEAGUE</p>
          <DialogTitle>Draft Arena</DialogTitle>
          <DialogDescription id="da-arena-entrance-description">Your league. Your next move.</DialogDescription>
        </div>
        <div className="da-arena-entrance-rule" aria-hidden="true"><i /></div>
        <button type="button" className="da-arena-boot-skip" onClick={() => setShow(false)}>
          Enter arena<ArrowRight size={16} aria-hidden="true" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

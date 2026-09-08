import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { resolveAttachmentUrl } from '@/lib/chatAttachments';

interface Props {
  urls: string[];
  /** Index of the image the user tapped. */
  index: number;
  onClose: () => void;
}

/**
 * Fullscreen image viewer for chat attachments. Resolves signed URLs on demand
 * (reusing the shared cache the thumbnails already warmed), supports swipe on
 * touch, arrow buttons + arrow keys on desktop, Esc to close, and tap-backdrop
 * to dismiss. Portaled to <body> so it escapes any transformed ancestor.
 */
export function ChatImageLightbox({ urls, index, onClose }: Props) {
  const [current, setCurrent] = useState(index);
  const [resolved, setResolved] = useState<Record<number, string | null>>({});
  const total = urls.length;

  useEffect(() => setCurrent(index), [index]);

  const go = useCallback((dir: number) => {
    setCurrent(c => (c + dir + total) % total);
  }, [total]);

  // Resolve the current image + its neighbors so swiping is instant.
  useEffect(() => {
    let cancelled = false;
    const want = [current, (current + 1) % total, (current - 1 + total) % total];
    for (const i of want) {
      if (i in resolved) continue;
      resolveAttachmentUrl(urls[i]).then(u => {
        if (!cancelled) setResolved(prev => (i in prev ? prev : { ...prev, [i]: u }));
      });
    }
    return () => { cancelled = true; };
  }, [current, total, urls, resolved]);

  // Keyboard nav + scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && total > 1) go(1);
      else if (e.key === 'ArrowLeft' && total > 1) go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose, total]);

  const currentUrl = resolved[current];
  const isLoading = !(current in resolved);

  const node = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {currentUrl && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10"
          aria-label="Open full image in a new tab"
        >
          <ExternalLink className="w-[18px] h-[18px]" />
        </a>
      )}

      {total > 1 && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-white/80 tabular-nums z-10">
          {current + 1} / {total}
        </div>
      )}

      {total > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); go(-1); }}
            className="hidden sm:flex absolute left-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); go(1); }}
            className="hidden sm:flex absolute right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          className="flex items-center justify-center max-w-[92vw] max-h-[86vh]"
          style={{ maxWidth: '92dvw', maxHeight: '86dvh' }}
          drag={total > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -80) go(1);
            else if (info.offset.x > 80) go(-1);
          }}
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.14 }}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt=""
              className="max-w-[92vw] max-h-[86vh] object-contain rounded-lg select-none"
              style={{ maxWidth: '92dvw', maxHeight: '86dvh' }}
              draggable={false}
            />
          ) : isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-white/70" />
          ) : (
            <span className="text-white/60 text-sm">Image unavailable</span>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );

  return createPortal(node, document.body);
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Send, Sparkles, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PickSuggestionState {
  corrected_text?: string | null;
  is_duplicate?: boolean;
  is_irrelevant?: boolean;
  relevance_note?: string | null;
}

interface PickComposerFieldsProps {
  pickText: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  localDuplicate: boolean;
  suggestion: PickSuggestionState | null;
  onApplyCorrection: (text: string) => void;
  onDismissSuggestion: () => void;
  topic: string;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/** Input + AI suggestion banners shared by the pick sheet and inline composer. */
export function PickComposerFields({
  pickText,
  onTextChange,
  onSubmit,
  submitting,
  localDuplicate,
  suggestion,
  onApplyCorrection,
  onDismissSuggestion,
  topic,
  autoFocus,
  inputRef,
}: PickComposerFieldsProps) {
  return (
    <div>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={pickText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Enter your pick…"
          maxLength={100}
          autoFocus={autoFocus}
          className="form-input flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pickText.trim() && !submitting && !localDuplicate) onSubmit();
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !pickText.trim() || localDuplicate}
          title={localDuplicate ? 'This pick has already been taken' : undefined}
          className="dl-cta h-11 px-4"
        >
          <Send className={cn('w-4 h-4', submitting && 'animate-pulse')} />
        </button>
      </div>
      {localDuplicate && (
        <p className="mt-1.5 text-[11px] font-medium text-yellow-500/90">Already on the board — pick something else.</p>
      )}

      <AnimatePresence>
        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="overflow-hidden"
          >
            {suggestion.corrected_text && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-foreground/80 flex-1">
                  Did you mean{' '}
                  <button
                    onClick={() => onApplyCorrection(suggestion.corrected_text!)}
                    className="font-bold text-primary hover:underline"
                  >
                    {suggestion.corrected_text}
                  </button>
                  ?
                </span>
                <button onClick={onDismissSuggestion} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {suggestion.is_duplicate && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                <span className="text-foreground/80 flex-1">
                  {suggestion.relevance_note || 'This pick may already have been taken.'}
                </span>
                <button onClick={onDismissSuggestion} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {suggestion.is_irrelevant && !suggestion.is_duplicate && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                <span className="text-foreground/80 flex-1">
                  {suggestion.relevance_note || `This might not be relevant to "${topic}".`}
                </span>
                <button onClick={onDismissSuggestion} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MakePickSheetProps extends PickComposerFieldsProps {
  open: boolean;
  onClose: () => void;
  currentRound: number;
  currentPickNumber: number;
}

/**
 * Bottom-sheet pick composer (portaled to body to escape transformed
 * ancestors). Keeps the draft board visible above the sheet.
 */
export function MakePickSheet({
  open,
  onClose,
  currentRound,
  currentPickNumber,
  ...fields
}: MakePickSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="da-lounge fixed inset-x-0 bottom-0 z-[90] dl-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Make your pick"
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-white/15 mb-4" />
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="dl-eyebrow">Your Pick</p>
                <p className="dl-display text-lg font-bold text-white">
                  Round {currentRound} · Pick #{currentPickNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg text-zinc-500 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <PickComposerFields {...fields} autoFocus />
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-zinc-600 font-bold">
              The board stays visible above — check what's taken
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

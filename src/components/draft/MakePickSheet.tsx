import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, Send, Sparkles, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PersonalDraftDesk } from '@/components/draft/PersonalDraftDesk';

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
          className="form-input flex-1 h-12 text-[15px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pickText.trim() && !submitting && !localDuplicate) onSubmit();
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !pickText.trim() || localDuplicate}
          title={localDuplicate ? 'This pick has already been taken' : undefined}
          className="dl-cta h-12 px-5"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Sending pick" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {localDuplicate && (
        <p className="mt-1.5 text-[11px] font-medium text-[hsl(var(--warning,38_92%_50%))]">Already on the board — pick something else.</p>
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
                <button onClick={onDismissSuggestion} className="w-8 h-8 -mr-1 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Dismiss">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {suggestion.is_duplicate && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--da-accent-2,var(--da-gold))/0.1)] border border-[hsl(var(--da-accent-2,var(--da-gold))/0.3)] text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--da-accent-2,var(--da-gold)))] flex-shrink-0" />
                <span className="text-foreground/80 flex-1">
                  {suggestion.relevance_note || 'This pick may already have been taken.'}
                </span>
                <button onClick={onDismissSuggestion} className="w-8 h-8 -mr-1 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Dismiss">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {suggestion.is_irrelevant && !suggestion.is_duplicate && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/25 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                <span className="text-foreground/80 flex-1">
                  {suggestion.relevance_note || `This might not be relevant to "${topic}".`}
                </span>
                <button onClick={onDismissSuggestion} className="w-8 h-8 -mr-1 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Dismiss">
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
  draftId?: string;
  userId?: string;
  taken?: Set<string>;
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
  draftId,
  userId,
  taken = new Set<string>(),
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
            className="fixed inset-0 z-[80] bg-background/70 backdrop-blur-sm"
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
            <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30 mb-4" />
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="dl-eyebrow">Your Pick</p>
                <p className="dl-display text-lg font-bold text-foreground">
                  Round {currentRound} · Pick #{currentPickNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 -mr-2 -mt-1 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <PickComposerFields {...fields} autoFocus />
            <div className="mt-4">
              <PersonalDraftDesk
                compact
                draftId={draftId}
                userId={userId}
                taken={taken}
                onChoose={fields.onTextChange}
              />
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
              The board stays visible above — check what's taken
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

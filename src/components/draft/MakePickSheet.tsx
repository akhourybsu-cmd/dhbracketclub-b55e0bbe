import { AnimatePresence, motion } from 'framer-motion';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Loader2, Send, Sparkles, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PersonalDraftDesk } from '@/components/draft/PersonalDraftDesk';
import { Dialog, DialogOverlay, DialogPortal, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';

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
    <div className="da-pick-compose">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={pickText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Enter your pick…"
          aria-label="Your draft pick"
          maxLength={100}
          autoFocus={autoFocus}
          className="form-input flex-1 h-12 text-[15px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pickText.trim() && !submitting && !localDuplicate) onSubmit();
          }}
        />
        <button
          type="button"
          aria-label="Submit pick"
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
                    type="button"
                    onClick={() => onApplyCorrection(suggestion.corrected_text!)}
                    className="font-bold text-primary hover:underline"
                  >
                    {suggestion.corrected_text}
                  </button>
                  ?
                </span>
                <button type="button" onClick={onDismissSuggestion} className="w-11 h-11 shrink-0 -mr-1 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Dismiss">
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
                <button type="button" onClick={onDismissSuggestion} className="w-11 h-11 shrink-0 -mr-1 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Dismiss">
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
                <button type="button" onClick={onDismissSuggestion} className="w-11 h-11 shrink-0 -mr-1 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Dismiss">
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
  const { palette } = useDraftArenaPalette();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPortal>
      <DialogOverlay className="z-[80]" />
      <DialogPrimitive.Content
        className="da-appearance-panel da-arena-dialog da-pick-dialog da-lounge fixed left-1/2 top-1/2 z-[90] w-[calc(100%-1rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl"
        data-da-palette={palette}
        aria-label="Make your pick"
      >
            <div className="da-pick-dialog-heading flex items-start justify-between gap-3">
              <div>
                <p className="dl-eyebrow">Your Pick</p>
                <DialogTitle className="dl-display text-lg font-bold text-foreground">
                  Round {currentRound} · Pick #{currentPickNumber}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs">{fields.topic}</DialogDescription>
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
            <div className="da-pick-dialog-desk">
              <PersonalDraftDesk
                compact
                draftId={draftId}
                userId={userId}
                taken={taken}
                onChoose={fields.onTextChange}
              />
            </div>
            <p className="text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
              Your shortlist. Your next contender.
            </p>
      </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

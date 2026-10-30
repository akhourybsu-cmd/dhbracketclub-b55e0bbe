import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RunModifier } from "@/lib/runedelve/runModifiers";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import { RunePager } from "./RunePager";
import "./runeDialogs.css";
interface Props {
  offer: RunModifier[];
  onPick: (mod: RunModifier) => void;
  onSkip: () => void;
}
const TIER_LABEL = ["Steady", "Mild", "Strong", "Volatile"];
export function RunModifierPicker({ offer, onPick, onSkip }: Props) {
  const focus = useRuneDialogFocus();
  const [page, setPage] = useState(0);
  const index = Math.min(page, Math.max(0, offer.length - 1));
  const modifier = offer[index];
  return (
    <Dialog open>
      <DialogContent
        {...focus}
        className="rd-dialog-theme rd-paged-dialog [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="rd-dialog-header">
          <DialogTitle className="rd-title">Pick your edge.</DialogTitle>
          <DialogDescription>
            Optional chamber rule · each choice has a trade-off.
          </DialogDescription>
        </DialogHeader>
        <article className="rd-dialog-body rd-dialog-card" aria-live="polite">
          {modifier && (
            <>
              <p className="rd-dialog-eyebrow">
                {TIER_LABEL[modifier.tier]} bargain
              </p>
              <h3>
                {modifier.glyph} {modifier.name}
              </h3>
              <p>{modifier.description}</p>
            </>
          )}
        </article>
        <RunePager
          page={index}
          pageCount={offer.length}
          onPageChange={setPage}
          label="Chamber bargains"
        />
        <div className="rd-dialog-actions">
          <button
            type="button"
            className="rd-dialog-primary"
            disabled={!modifier}
            onClick={() => {
              if (modifier) onPick(modifier);
            }}
          >
            Choose {modifier?.name ?? "bargain"}
          </button>
          <button
            type="button"
            className="rd-dialog-secondary"
            onClick={onSkip}
          >
            ◇ Steady Path · No extra rule
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

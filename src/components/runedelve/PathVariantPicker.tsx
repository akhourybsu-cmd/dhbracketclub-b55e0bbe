import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PATH_VARIANTS, type PathVariant } from "@/lib/runedelve/pathVariants";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import { RunePager } from "./RunePager";
import "./runeDialogs.css";
interface Props {
  levelNumber: number;
  lastPicked?: string | null;
  onPick: (variant: PathVariant) => void;
  onClose: () => void;
}
export function PathVariantPicker({
  levelNumber,
  lastPicked,
  onPick,
  onClose,
}: Props) {
  const focus = useRuneDialogFocus();
  const [page, setPage] = useState(0);
  const variant = PATH_VARIANTS[page];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent {...focus} className="rd-dialog-theme rd-paged-dialog">
        <DialogHeader className="rd-dialog-header">
          <DialogTitle className="rd-title">Choose your path.</DialogTitle>
          <DialogDescription>Milestone · Level {levelNumber}</DialogDescription>
        </DialogHeader>
        <article className="rd-dialog-body rd-dialog-card" aria-live="polite">
          <h3>
            {variant.glyph} {variant.name}
          </h3>
          <p className="rd-dialog-eyebrow">
            {variant.tier}
            {lastPicked === variant.id ? " · Last pick" : ""}
          </p>
          <p>{variant.tagline}</p>
          <ul>
            {variant.effectLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
        <RunePager
          page={page}
          pageCount={PATH_VARIANTS.length}
          onPageChange={setPage}
          label="Milestone paths"
        />
        <button
          type="button"
          className="rd-dialog-primary"
          onClick={() => onPick(variant)}
        >
          Choose {variant.name}
        </button>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getMechanic, type MechanicId } from "@/lib/runedelve/mechanics";
import { getBossRule, type BossRuleId } from "@/lib/runedelve/bossRules";
import { useSheetSfx } from "@/hooks/useSheetSfx";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import { RunePager } from "./RunePager";
import "./runeDialogs.css";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mechanicId?: MechanicId | null;
  bossRuleId?: BossRuleId | null;
  onBegin: () => void;
  levelNumber: number;
}
export function MechanicIntroSheet({
  open,
  onOpenChange,
  mechanicId,
  bossRuleId,
  onBegin,
  levelNumber,
}: Props) {
  useSheetSfx(open);
  const focus = useRuneDialogFocus();
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (open) setPage(0);
  }, [open, mechanicId, bossRuleId]);
  const mechanic = mechanicId ? getMechanic(mechanicId) : null;
  const boss = bossRuleId ? getBossRule(bossRuleId) : null;
  const rule = boss?.rule ?? mechanic?.oneLiner ?? "";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...focus}
        side="bottom"
        className="rd-dialog-theme rd-paged-dialog rd-intro-dialog"
      >
        <SheetHeader className="rd-dialog-header">
          <SheetTitle className="rd-title">
            {boss ? "👑" : mechanic?.icon} {boss?.label ?? mechanic?.name}
          </SheetTitle>
          <SheetDescription>
            {boss ? "Boss encounter" : "New mechanic"} · Level {levelNumber}
          </SheetDescription>
        </SheetHeader>
        <article className="rd-dialog-body rd-dialog-card" aria-live="polite">
          <h3>{page === 0 ? "The rule" : "Your opening"}</h3>
          <p>
            {page === 0
              ? rule
              : boss
                ? "Read the rule before your first chain. Use the enemy inspection and encounter details whenever you need a reminder."
                : mechanic?.tip}
          </p>
          {page === 1 && boss && mechanic && <p>{mechanic.oneLiner}</p>}
        </article>
        <RunePager
          page={page}
          pageCount={2}
          onPageChange={setPage}
          label="Encounter introduction"
        />
        <button type="button" className="rd-dialog-primary" onClick={onBegin}>
          {boss ? "Face the Boss" : `Begin Level ${levelNumber}`}
        </button>
      </SheetContent>
    </Sheet>
  );
}

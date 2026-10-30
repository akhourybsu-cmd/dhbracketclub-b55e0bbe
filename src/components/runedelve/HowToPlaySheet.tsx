import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getClass, type HeroClass } from "@/lib/runedelve/classConfig";
import { useSheetSfx } from "@/hooks/useSheetSfx";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import { RunePager } from "./RunePager";
import "./runeDialogs.css";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroClass?: HeroClass;
}
const RUNES = [
  ["⚔", "Attack", "Strikes the marked enemy."],
  ["✦", "Mana", "Charges your class ability."],
  ["❀", "Heal", "Restores your health."],
  ["◈", "Guard", "Softens enemy attacks."],
];
export function HowToPlaySheet({ open, onOpenChange, heroClass }: Props) {
  useSheetSfx(open);
  const focus = useRuneDialogFocus();
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (open) setPage(0);
  }, [open]);
  const cls = heroClass ? getClass(heroClass) : null;
  const pages = [
    <article className="rd-dialog-card" key="gesture">
      <h3>Connect 3 or more</h3>
      <p>
        Drag matching neighboring runes, including diagonals, and release to
        cast. Or tap a path, then press Cast.
      </p>
      <p>Backtrack one rune to undo. Clear cancels without spending a turn.</p>
    </article>,
    <div className="rd-dialog-runes" key="runes">
      {RUNES.map(([glyph, name, description]) => (
        <article className="rd-dialog-card" key={name}>
          <h3>
            <span aria-hidden>{glyph}</span> {name}
          </h3>
          <p>{description}</p>
        </article>
      ))}
    </div>,
    <article className="rd-dialog-card" key="combat">
      <h3>Watch the enemy</h3>
      <p>
        Enemies strike after your chain. Inspect a foe to read its attack,
        ability and countdown.
      </p>
      <p>
        Class abilities are free actions. Chain 6+ to hit harder; 7+ can earn
        one bonus action per enemy cycle.
      </p>
    </article>,
    <article className="rd-dialog-card" key="resonance">
      <h3>Charge all four sigils</h3>
      <p>
        Use every rune color to release Convergence: an area strike, one mana
        and one guarded turn.
      </p>
      <p>
        Repeated colors keep your charge. Gold sparkles earn score and shards;
        red hazards cost health. Encounter details explain your objective, bonus
        goal and chamber rules.
      </p>
    </article>,
    <article className="rd-dialog-card" key="class">
      <h3>
        {cls
          ? `${cls.emoji} ${cls.name} · ${cls.abilityName}`
          : "Choose your class"}
      </h3>
      <p>
        {cls?.abilityDesc ??
          "Four classes offer different powers and ways to build a run."}
      </p>
      {cls && <p>{cls.passive}</p>}
      <Link
        className="rd-dialog-link"
        to="/rune-delve/hero"
        onClick={() => onOpenChange(false)}
      >
        Explore class & masteries →
      </Link>
    </article>,
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...focus}
        side="bottom"
        className="rd-dialog-theme rd-paged-dialog"
      >
        <SheetHeader className="rd-dialog-header">
          <SheetTitle className="rd-title">One chain. One decision.</SheetTitle>
          <SheetDescription>
            Learn the runes, combat and your class.
          </SheetDescription>
        </SheetHeader>
        <div className="rd-dialog-body" aria-live="polite">
          {pages[page]}
        </div>
        <RunePager
          page={page}
          pageCount={pages.length}
          onPageChange={setPage}
          label="How to play"
        />
        <button
          type="button"
          className="rd-dialog-primary"
          onClick={() => onOpenChange(false)}
        >
          Ready to delve
        </button>
      </SheetContent>
    </Sheet>
  );
}

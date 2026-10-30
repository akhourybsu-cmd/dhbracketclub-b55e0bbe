import { Link } from "react-router-dom";
import { ArrowRight, Hand, Shield, Sparkles, Sword, Zap } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getClass, type HeroClass } from "@/lib/runedelve/classConfig";
import { ClassBadge } from "./ClassBadge";
import { useSheetSfx } from "@/hooks/useSheetSfx";
import { useRuneDialogFocus } from "./useRuneDialogFocus";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroClass?: HeroClass;
}
const RUNES = [
  {
    glyph: "⚔",
    name: "Attack",
    color: "0 75% 58%",
    desc: "Strikes the marked enemy.",
  },
  {
    glyph: "✦",
    name: "Mana",
    color: "215 75% 60%",
    desc: "Charges your class ability.",
  },
  {
    glyph: "❀",
    name: "Heal",
    color: "140 60% 50%",
    desc: "Restores your health.",
  },
  {
    glyph: "◈",
    name: "Guard",
    color: "45 90% 56%",
    desc: "Softens enemy attacks.",
  },
];

/** Teach the gesture and payoff visually; the codex holds the deeper rules. */
export function HowToPlaySheet({ open, onOpenChange, heroClass }: Props) {
  useSheetSfx(open);
  const focus = useRuneDialogFocus();
  const cls = heroClass ? getClass(heroClass) : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...focus}
        side="bottom"
        className="rd-dialog-theme max-h-[90dvh] overflow-y-auto rounded-t-3xl px-5 pb-6 pt-5"
      >
        <div className="mx-auto max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle className="rd-title text-xl">
              One chain. One decision.
            </SheetTitle>
            <SheetDescription>
              Connect matching runes. Build your power. Clear the chamber.
            </SheetDescription>
          </SheetHeader>
          <div
            className="my-4 flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4"
            aria-label="Three matching adjacent runes make a chain"
          >
            {[1, 2, 3].map((n, i) => (
              <div key={n} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="h-0.5 w-5 bg-destructive/50" aria-hidden />
                )}
                <span
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/50 bg-destructive/15 text-2xl text-destructive"
                  aria-hidden
                >
                  ⚔
                  <small className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-extrabold text-destructive-foreground">
                    {n}
                  </small>
                </span>
              </div>
            ))}
            <ArrowRight
              className="mx-1 h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            <Sword className="h-6 w-6 text-destructive" aria-hidden />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {RUNES.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-2 rounded-xl border border-border bg-card/60 p-3"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl"
                  style={{
                    color: `hsl(${r.color})`,
                    background: `hsl(${r.color}/.13)`,
                    border: `1px solid hsl(${r.color}/.3)`,
                  }}
                  aria-hidden
                >
                  {r.glyph}
                </span>
                <div>
                  <p className="text-xs font-extrabold">{r.name}</p>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    {r.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 text-xs leading-relaxed">
            <p className="flex gap-2">
              <Hand
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>
                <b>Connect 3+</b> in any direction, including diagonals. Drag
                and release, or Tap a path then Cast. Backtrack one rune to
                undo.
              </span>
            </p>
            <p className="flex gap-2">
              <Shield
                className="mt-0.5 h-4 w-4 shrink-0 text-gold"
                aria-hidden
              />
              <span>
                <b>Enemies strike after your action.</b> Tap an enemy to inspect
                its attack and countdown. Watch your health and remaining turns.
              </span>
            </p>
            <p className="flex gap-2">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>
                <b>Use all four colors to trigger Resonance:</b> a burst across
                the enemy field, plus mana and guard. Repeating a color keeps
                your progress.
              </span>
            </p>
            <p className="flex gap-2">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
              <span>
                <b>Long chains create openings.</b> 6+ hit harder. 7+ can earn a
                bonus action once per enemy cycle.
              </span>
            </p>
          </div>
          {cls && (
            <div className="my-4 flex gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <ClassBadge cls={cls.id} size="md" />
              <div>
                <p className="text-xs font-extrabold">
                  {cls.name} · {cls.abilityName}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {cls.abilityDesc}
                </p>
                <p className="mt-1 text-[10px] text-primary">{cls.passive}</p>
              </div>
            </div>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Gold sparkles reward score and shards. Red hazards cost health.
            Encounter details explain your objective, bonus goal, and chamber
            rules.
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-4 min-h-12 w-full rounded-xl bg-primary text-sm font-extrabold text-primary-foreground"
          >
            Ready to delve
          </button>
          <Link
            to="/rune-delve/hero"
            onClick={() => onOpenChange(false)}
            className="mt-1 flex min-h-11 items-center justify-center gap-1 text-xs font-bold text-muted-foreground"
          >
            Explore your class & masteries <ArrowRight size={13} />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

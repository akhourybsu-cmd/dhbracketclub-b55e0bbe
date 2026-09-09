import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getMechanic, type MechanicId } from '@/lib/runedelve/mechanics';
import { getBossRule, type BossRuleId } from '@/lib/runedelve/bossRules';
import { useSheetSfx } from '@/hooks/useSheetSfx';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional — omit when this sheet is presenting a boss-rule only. */
  mechanicId?: MechanicId | null;
  /** Optional boss rule shown alongside (or instead of) the mechanic intro. */
  bossRuleId?: BossRuleId | null;
  /** Called when the player taps the primary CTA (Begin). */
  onBegin: () => void;
  levelNumber: number;
}

/**
 * One-time intro modal for a brand-new mechanic OR a boss-rule level.
 * Mobile-first: oversized icon, single-line title, one short rule, one CTA.
 */
export function MechanicIntroSheet({ open, onOpenChange, mechanicId, bossRuleId, onBegin, levelNumber }: Props) {
  useSheetSfx(open);
  const m = mechanicId ? getMechanic(mechanicId) : null;
  const boss = bossRuleId ? getBossRule(bossRuleId) : null;
  // When a boss rule is present, it takes the headline slot. Otherwise the
  // mechanic does. (At least one of the two MUST be supplied.)
  const showBoss = !!boss;
  const headlineLabel = showBoss ? boss!.label : m?.name ?? '';
  const headlineIcon = showBoss ? '👑' : m?.icon ?? '✨';
  const headlineFamily = showBoss ? boss!.label : m?.family ?? '';
  const oneLiner = showBoss ? boss!.rule : m?.oneLiner ?? '';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 border-t-2" style={{ borderTopColor: 'hsl(var(--primary) / 0.5)' }}>
        <SheetHeader className="px-6 pt-6 pb-2 text-left">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-primary/15 text-primary">
              {showBoss ? 'Boss Encounter' : 'New mechanic'} · Lv {levelNumber}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{headlineFamily}</span>
          </div>
          <SheetTitle className="text-2xl font-extrabold tracking-tight flex items-center gap-3 leading-none">
            <span className="text-4xl leading-none" aria-hidden>{headlineIcon}</span>
            <span>{headlineLabel}</span>
          </SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-7 pt-3 space-y-5">
          <p className="text-[14px] leading-relaxed text-foreground/90">
            {oneLiner}
          </p>
          <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider font-extrabold text-primary mb-1">Tip</p>
            <p className="text-[12px] text-foreground/80 leading-snug">
              {showBoss
                ? 'Read the rule banner before your first chain. Boss chambers have no hidden rules.'
                : m?.tip}
            </p>
          </div>
          <button
            onClick={onBegin}
            className="w-full h-12 rounded-xl font-extrabold text-sm btn-press"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            {showBoss ? 'Face the Boss' : `Begin Level ${levelNumber}`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

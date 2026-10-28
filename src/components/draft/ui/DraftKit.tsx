import { ReactNode, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared Draft Arena presentation kit — palette tokens only (--da-gold, --success, etc). */

export const daMotion = {
  enter: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

export function DaSectionHeader({ eyebrow, title, action, className }: { eyebrow?: string; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-end justify-between gap-3 mb-3', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[hsl(var(--da-gold))]">{eyebrow}</p>}
        <h2 className="dl-display text-lg font-extrabold leading-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function DaStatChip({ icon: Icon, label, value, tone = 'muted' }: { icon?: LucideIcon; label?: string; value: ReactNode; tone?: 'muted' | 'gold' | 'success' | 'primary' }) {
  const toneCls = {
    muted: 'bg-muted/60 text-foreground/80 border-border/60',
    gold: 'bg-[hsl(var(--da-gold)/0.12)] text-[hsl(var(--da-gold))] border-[hsl(var(--da-gold)/0.35)]',
    success: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]',
    primary: 'bg-primary/10 text-primary border-primary/30',
  }[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10.5px] font-bold tabular-nums leading-none', toneCls)}>
      {Icon && <Icon className="w-3 h-3 opacity-80" aria-hidden />}
      <span>{value}</span>
      {label && <span className="font-medium opacity-70">{label}</span>}
    </span>
  );
}

export function DaStatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2.5">
      <div className="text-xl font-extrabold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

export function DaInfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
      <Icon className="w-4 h-4 text-[hsl(var(--da-gold))] flex-shrink-0" aria-hidden />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-bold text-right">{value}</span>
    </div>
  );
}

export function DaDetails({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  return (
    <div className="rounded-xl border border-border/60 bg-card/50">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full min-h-[44px] items-center justify-between px-3 text-xs font-bold">
        {title}
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

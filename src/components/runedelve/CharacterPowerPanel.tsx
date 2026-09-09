import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Gauge, Shield, SlidersHorizontal, Sparkles, Zap } from 'lucide-react';
import type { CharacterSheet, CharacterStat } from '@/lib/runedelve/characterStats';
import { getClass } from '@/lib/runedelve/classConfig';
import { cn } from '@/lib/utils';

interface Props {
  sheet: CharacterSheet;
  /** Armory uses the exact stat grid without repeating the full bonus ledger. */
  compact?: boolean;
}

function signedDelta(stat: CharacterStat): string | null {
  const delta = stat.effective - stat.base;
  if (delta === 0) return null;
  return `${delta > 0 ? '+' : ''}${delta}${stat.suffix}`;
}

export function CharacterPowerPanel({ sheet, compact = false }: Props) {
  const reducedMotion = useReducedMotion();
  const cls = getClass(sheet.cls);
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.32, ease: 'easeOut' as const };
  const buildKey = [
    sheet.cls,
    sheet.classLevel,
    sheet.campaignLevel,
    ...sheet.bonuses.map(bonus => `${bonus.id}:${bonus.rank ?? 0}`),
  ].join('|');

  return (
    <section
      className="glass-card overflow-hidden"
      aria-label={`${cls.name} combat sheet`}
      style={{ borderColor: 'hsl(var(--primary) / 0.28)' }}
    >
      <div
        className="p-4 border-b"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.14), hsl(var(--gold) / 0.06), transparent)',
          borderColor: 'hsl(var(--primary) / 0.18)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{
              background: 'radial-gradient(circle at 35% 30%, hsl(var(--primary) / 0.35), hsl(var(--card)))',
              boxShadow: '0 0 18px hsl(var(--primary) / 0.2)',
              border: '1px solid hsl(var(--primary) / 0.35)',
            }}
            aria-hidden
          >
            {cls.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-rd-display font-extrabold text-[15px] tracking-wide">Combat Sheet</h3>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                Live values
              </span>
            </div>
            <p className="text-[10.5px] text-foreground/70 mt-0.5">
              {cls.name} Lv {sheet.classLevel} · Campaign L{sheet.campaignLevel} · Chapter {sheet.chapter}
            </p>
          </div>
          {!compact && (
            <Link
              to="/rune-delve/armory"
              className="h-9 px-2.5 rounded-lg bg-muted/35 border border-border/40 inline-flex items-center gap-1 text-[10px] font-extrabold btn-press shrink-0"
            >
              <SlidersHorizontal className="w-3 h-3" /> Tune
            </Link>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 mt-3">
          <BuildMeter icon={<Sparkles className="w-3 h-3" />} label="Masteries" value={`${sheet.masteryCount}/5`} />
          <BuildMeter icon={<Shield className="w-3 h-3" />} label="Relics" value={`${sheet.equippedCount}/3`} />
          <BuildMeter
            icon={<Gauge className="w-3 h-3" />}
            label="Relic Ranks"
            value={sheet.equippedCount ? `${sheet.relicRankTotal}/${sheet.equippedCount * 5}` : '—'}
          />
        </div>
      </div>

      <motion.div
        key={buildKey}
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="p-4 space-y-3"
      >
          <div className="grid grid-cols-2 gap-2">
            {sheet.stats.map((stat, index) => {
              const delta = signedDelta(stat);
              const improved = stat.effective > stat.base;
              return (
                <motion.div
                  key={stat.id}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...transition, delay: reducedMotion ? 0 : index * 0.035 }}
                  className="rounded-xl border border-border/35 bg-muted/15 p-2.5 min-w-0"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] text-primary" aria-hidden>{stat.icon}</span>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/65 truncate">{stat.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
                    <span className="font-mono font-black text-[18px] tabular-nums leading-none">
                      {stat.effective}{stat.suffix}
                    </span>
                    {delta && (
                      <span className={cn(
                        'text-[9px] font-mono font-extrabold px-1 py-0.5 rounded',
                        improved ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive',
                      )}>
                        {delta}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1 truncate">
                    {delta ? `Base ${stat.base}${stat.suffix} · ` : ''}{stat.note}
                  </p>
                </motion.div>
              );
            })}
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] font-extrabold">{sheet.abilityName}</p>
                  <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5">
                    {sheet.abilityCost} mana
                  </span>
                </div>
                <p className="text-[10.5px] text-foreground/75 mt-0.5 leading-snug">{sheet.abilityDetail}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-foreground/60 mb-1.5">Opening Kit</p>
            <div className="grid grid-cols-3 gap-1.5">
              <OpeningStat icon="✦" label="Mana" value={`${sheet.startingMana}/3`} />
              <OpeningStat icon="⛨" label="Shield" value={`${sheet.startingShield}`} />
              <OpeningStat icon={<Clock3 className="w-3 h-3" />} label="Turns" value={sheet.bonusTurns ? `+${sheet.bonusTurns}` : '+0'} />
            </div>
          </div>

          {!compact && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-foreground/60">Complete Effect Ledger</p>
                <span className="text-[9px] text-muted-foreground">Conditional effects stay listed, not averaged</span>
              </div>
              <div className="space-y-1.5">
                {sheet.bonuses.map(bonus => (
                  <div key={`${bonus.source}-${bonus.id}`} className="flex items-start gap-2 rounded-lg bg-muted/15 border border-border/25 px-2.5 py-2">
                    <span className="text-[13px] leading-none mt-0.5" aria-hidden>{bonus.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[10.5px] font-extrabold">{bonus.name}</p>
                        <span className="text-[8px] font-extrabold uppercase tracking-wider text-muted-foreground">
                          {bonus.source}{bonus.rank ? ` · R${bonus.rank}` : ''}
                        </span>
                      </div>
                      <p className="text-[10px] text-foreground/70 leading-snug mt-0.5">{bonus.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-2 leading-snug">
                Class levels unlock the masteries shown here; they do not add hidden damage or health scaling.
              </p>
            </div>
          )}
      </motion.div>
    </section>
  );
}

function BuildMeter({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/25 border border-border/25 px-2 py-1.5 text-center min-w-0">
      <p className="text-[8px] font-bold uppercase tracking-wider text-foreground/55 flex items-center justify-center gap-1 truncate">{icon}{label}</p>
      <p className="font-mono text-[11px] font-black tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function OpeningStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/20 border border-border/30 px-2 py-1.5 flex items-center gap-1.5 min-w-0">
      <span className="text-primary shrink-0" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        <p className="font-mono font-black text-[11px] tabular-nums">{value}</p>
      </div>
    </div>
  );
}

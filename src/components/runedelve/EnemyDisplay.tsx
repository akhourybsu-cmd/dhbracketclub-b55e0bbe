import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { Enemy } from '@/lib/runedelve/dungeonGenerator';
import { Zap } from 'lucide-react';
import { EnemyDeathBurst } from './fx/EnemyDeathBurst';

interface Props {
  enemies: Enemy[];
  flashId?: string | null;
  /** First enemy a standard attack chain will hit right now. */
  primaryTargetId?: string | null;
}

/** Per-enemy death-burst trigger. Watches an enemy's hp; the first
 *  time it transitions to ≤0 (within the lifetime of this component
 *  instance), bumps an internal counter that the EnemyDeathBurst
 *  component reads as its trigger key. Resets when the enemy comes
 *  back alive (e.g. enemies that revive via abilities — rare but
 *  possible). */
function useDeathBurstTrigger(hp: number): number {
  const [trigger, setTrigger] = useState(0);
  const prevAlive = useRef(hp > 0);
  useEffect(() => {
    if (hp <= 0 && prevAlive.current) {
      setTrigger(t => t + 1);
      prevAlive.current = false;
    } else if (hp > 0) {
      prevAlive.current = true;
    }
  }, [hp]);
  return trigger;
}

/** Per-enemy tile — extracted so each gets its own death-burst hook. */
function EnemyTile({ e, flashId, primaryTargetId }: { e: Enemy; flashId?: string | null; primaryTargetId?: string | null }) {
  const dead = e.hp <= 0;
  const isPrimaryTarget = !dead && e.id === primaryTargetId;
  const deathTrigger = useDeathBurstTrigger(e.hp);
  const pct = Math.max(0, Math.round((e.hp / e.maxHp) * 100));
  const hasIntent = !dead && e.intent != null && e.intentMax != null;
  const aboutToFire = hasIntent && (e.intent ?? 99) <= 1;
  const burstTier: 'normal' | 'mini' | 'boss' =
    e.tier === 'boss' ? 'boss' : e.tier === 'mini' ? 'mini' : 'normal';

  return (
    <motion.div
      data-enemy-id={e.id}
      data-primary-target={isPrimaryTarget ? 'true' : undefined}
      animate={flashId === e.id ? { x: [-3, 3, -2, 2, 0] } : false}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-0.5 min-w-[64px]"
      style={{ opacity: dead ? 0.35 : 1 }}
    >
      <div className="relative">
        {/* V4 — Pedestal shadow. Soft elliptical drop tucked just
            under the portrait so the enemy reads as "standing" not
            "floating". Bosses get a deeper, gold-tinted pedestal;
            mini-bosses subtler; regulars a quiet gray. Lives INSIDE
            the relative wrapper but OUTSIDE the portrait box so the
            boss halo's z-index: -1 doesn't accidentally cover it. */}
        {!dead && (
          <div
            aria-hidden
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: e.tier === 'boss' ? 56 : e.tier === 'mini' ? 50 : 42,
              height: e.tier === 'boss' ? 10 : 8,
              background: e.tier === 'boss'
                ? 'radial-gradient(ellipse, hsl(var(--gold) / 0.35), transparent 70%)'
                : e.tier === 'mini'
                  ? 'radial-gradient(ellipse, hsl(var(--gold) / 0.18), transparent 70%)'
                  : 'radial-gradient(ellipse, hsl(0 0% 0% / 0.35), transparent 70%)',
            }}
          />
        )}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl rd-enemy-frame ${dead ? '' : e.tier === 'boss' ? 'rd-breath' : 'rd-breath-slow'} ${e.name?.startsWith('Elite') ? 'is-elite' : ''} ${e.tier === 'mini' ? 'rd-enemy-mini' : ''} ${e.tier === 'boss' ? 'rd-enemy-boss' : ''}`}
          style={{
            filter: dead ? 'grayscale(1)' : 'none',
            opacity: dead ? 0.5 : 1,
            boxShadow: !dead && e.tier === 'boss'
              ? '0 0 0 2px hsl(var(--gold)), 0 0 14px hsl(var(--gold) / 0.55)'
              : !dead && e.tier === 'mini'
                ? '0 0 0 2px hsl(var(--gold) / 0.7)'
                : undefined,
          }}
        >
          {dead ? '💀' : e.emoji}
        </div>
        {/* V1 — Death burst overlay. Mounts conditionally inside the
            enemy frame so the spark animation is positioned relative
            to the icon, not the page. */}
        <EnemyDeathBurst triggerKey={deathTrigger} tier={burstTier} />
        {!dead && e.tier && (
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 h-[14px] rounded-full text-[8px] font-extrabold uppercase tracking-wider flex items-center gap-0.5 shadow-md"
            style={{ background: 'hsl(var(--gold))', color: 'hsl(var(--background))' }}
            aria-label={e.tier === 'boss' ? 'Boss' : 'Mini-Boss'}
          >
            {e.tier === 'boss' ? '👑 Boss' : '🥈 Mini'}
          </div>
        )}
        {hasIntent && (
          <motion.div
            animate={aboutToFire ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.8, repeat: aboutToFire ? Infinity : 0 }}
            className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center gap-0.5 text-[10px] font-extrabold tabular-nums shadow-md ${
              aboutToFire
                ? 'bg-destructive text-destructive-foreground ring-2 ring-destructive/40'
                : 'bg-warning text-warning-foreground'
            }`}
            aria-label={`Attacks in ${e.intent} ${e.intent === 1 ? 'turn' : 'turns'}`}
          >
            <Zap className="w-2.5 h-2.5" />
            {e.intent}
          </motion.div>
        )}
        {/* Ability telegraph — small ✦ badge when an ability is about to fire. */}
        {!dead && e.ability && e.abilityCooldown != null && e.abilityCooldown <= 1 && (
          <div
            className="absolute -bottom-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-extrabold flex items-center justify-center shadow-md ring-1 ring-primary/40"
            aria-label={e.telegraphLabel ?? 'Ability ready'}
            title={e.telegraphLabel ?? 'Ability ready'}
          >✦</div>
        )}
        {/* Armor pip — visible damage-reduction indicator from shield_self. */}
        {!dead && (e.armor ?? 0) > 0 && (
          <div
            className="absolute -bottom-1 -left-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center shadow-md"
            style={{ background: 'hsl(var(--gold))', color: 'hsl(var(--background))' }}
            aria-label={`Armor ${e.armor}`}
          >🛡{e.armor}</div>
        )}
      </div>
      {/* Two-line clamp keeps "Boss Ancient Drake" / "Cult Warden" readable on 411px screens. */}
      <div
        className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/75 text-center max-w-[78px] leading-tight overflow-hidden"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}
      >
        {e.name}
      </div>
      <div className="w-12 h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: pct > 50 ? 'hsl(var(--success))' : pct > 25 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
          }}
        />
      </div>
      <div
        className="flex items-center gap-1 text-[9px] font-mono font-bold tabular-nums text-foreground/65 leading-none"
        aria-label={`${isPrimaryTarget ? 'Current target. ' : ''}${Math.max(0, e.hp)} of ${e.maxHp} health. ${e.damage} base attack damage${e.role ? `. ${e.role} role` : ''}.`}
        title={`${e.role ? `${e.role} · ` : ''}${e.damage} base damage`}
      >
        {isPrimaryTarget && <span className="text-primary" aria-hidden>▶</span>}
        <span>{Math.max(0, e.hp)}/{e.maxHp}</span>
        {!dead && <span className="text-destructive/85">· ⚔{e.damage}</span>}
      </div>
    </motion.div>
  );
}

export function EnemyDisplay({ enemies, flashId, primaryTargetId }: Props) {
  return (
    <div className="flex items-start justify-center gap-2.5 flex-wrap">
      {enemies.map(e => <EnemyTile key={e.id} e={e} flashId={flashId} primaryTargetId={primaryTargetId} />)}
    </div>
  );
}

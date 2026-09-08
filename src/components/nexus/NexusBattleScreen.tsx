import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ABILITIES } from '@/lib/nexus/abilities';
import { ENEMIES } from '@/lib/nexus/enemies';
import { TOWERS, TOWER_LIST, towerDamageAt, towerRangeAt, towerSellValue, towerUpgradeCost } from '@/lib/nexus/towers';
import { GRID_COLS, GRID_ROWS, getGridLayout } from '@/lib/nexus/grid';
import { AbilityKind, BattleEvent, BattleState, MissionDef, TargetMode, TowerKind } from '@/lib/nexus/types';
import { cn } from '@/lib/utils';
import { Heart, ChevronUp, X, Crosshair } from 'lucide-react';
import { TowerIcon } from './TowerIcon';
import { EnemyMarker, getEnemyAccent } from './EnemyMarker';

// hsl strings for SVG/inline use — anchored to nx tokens conceptually but
// resolved here so they render reliably inside framer-motion wrappers.
const TOWER_HSL: Record<TowerKind, { c: string; cDim: string; bg: string; text: string }> = {
  pulse: { c: 'hsl(188 92% 56%)', cDim: 'hsl(188 92% 56% / 0.18)', bg: 'hsl(188 92% 56% / 0.14)', text: 'hsl(188 92% 78%)' },
  arc:   { c: 'hsl(265 80% 70%)', cDim: 'hsl(265 80% 70% / 0.18)', bg: 'hsl(265 80% 70% / 0.14)', text: 'hsl(265 80% 84%)' },
  cryo:  { c: 'hsl(200 95% 70%)', cDim: 'hsl(200 95% 70% / 0.18)', bg: 'hsl(200 95% 70% / 0.14)', text: 'hsl(200 95% 84%)' },
  rail:  { c: 'hsl(38 95% 60%)',  cDim: 'hsl(38 95% 60% / 0.18)',  bg: 'hsl(38 95% 60% / 0.14)',  text: 'hsl(38 95% 78%)' },
  flak:  { c: 'hsl(150 80% 55%)', cDim: 'hsl(150 80% 55% / 0.18)', bg: 'hsl(150 80% 55% / 0.14)', text: 'hsl(150 80% 78%)' },
  mortar:{ c: 'hsl(350 85% 62%)', cDim: 'hsl(350 85% 62% / 0.18)', bg: 'hsl(350 85% 62% / 0.14)', text: 'hsl(350 85% 80%)' },
  amp:   { c: 'hsl(300 85% 68%)', cDim: 'hsl(300 85% 68% / 0.18)', bg: 'hsl(300 85% 68% / 0.14)', text: 'hsl(300 85% 84%)' },
};

const TOWER_SHORT: Record<TowerKind, string> = {
  pulse: 'PULSE', arc: 'ARC', cryo: 'CRYO', rail: 'RAIL', flak: 'FLAK', mortar: 'MORTAR', amp: 'AMP',
};

interface Props {
  state: BattleState;
  mission: MissionDef;
  selectedTowerKind: TowerKind | null;
  selectedTowerId: string | null;
  onSelectKind: (k: TowerKind | null) => void;
  onPlace: (col: number, row: number) => void;
  onSelectTower: (id: string | null) => void;
  onUpgrade: (id: string) => void;
  onSell: (id: string) => void;
  onSetPriority: (id: string, mode: TargetMode) => void;
  onCastAbility: (kind: AbilityKind) => void;
  onStartWave: () => void;
}

const TARGET_MODES: { mode: TargetMode; label: string }[] = [
  { mode: 'first', label: 'FIRST' },
  { mode: 'last', label: 'LAST' },
  { mode: 'strong', label: 'STRONG' },
  { mode: 'close', label: 'CLOSE' },
];

/** Jagged lightning polyline (Arc) — deterministic per bolt via its timestamp,
 *  so the geometry is stable while opacity flickers. SVG 0..100 units. */
function jaggedPath(sx: number, sy: number, tx: number, ty: number, seed: number): string {
  const segs = 5;
  const dx = tx - sx, dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len; // perpendicular unit
  const pts: string[] = [];
  for (let i = 0; i <= segs; i++) {
    const f = i / segs;
    const bx = sx + dx * f, by = sy + dy * f;
    const amp = i === 0 || i === segs ? 0 : Math.sin(seed * 0.013 + i * 2.7) * 3.4;
    pts.push(`${(bx + px * amp).toFixed(2)},${(by + py * amp).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Compact damage telemetry at the impact point. It is intentionally small so
 *  busy waves still read cleanly, while heavy Rail/Mortar hits feel weighty. */
function DamageNumber({ ev }: { ev: Extract<BattleEvent, { type: 'shot' }> }) {
  const tx = ((ev.to.x + 0.5) / GRID_COLS) * 100;
  const ty = ((ev.to.y + 0.5) / GRID_ROWS) * 100;
  const heavy = ev.damage >= 45;
  return (
    <motion.span
      aria-hidden
      className="absolute z-20 -translate-x-1/2 pointer-events-none font-black tabular-nums"
      initial={{ opacity: 0, y: 2, scale: 0.75 }}
      animate={{ opacity: [0, 1, 1, 0], y: -15, scale: heavy ? 1.08 : 1 }}
      transition={{ duration: 0.62, ease: 'easeOut', times: [0, 0.12, 0.7, 1] }}
      style={{
        left: `${tx}%`,
        top: `${ty}%`,
        color: heavy ? 'hsl(var(--nx-amber))' : 'hsl(0 0% 100% / 0.88)',
        fontSize: heavy ? 10 : 8,
        lineHeight: 1,
        textShadow: heavy
          ? '0 0 6px hsl(var(--nx-amber)), 0 1px 2px hsl(0 0% 0%)'
          : '0 1px 2px hsl(0 0% 0%), 0 0 4px hsl(var(--nx-cyan) / 0.7)',
      }}
    >
      −{ev.damage}
    </motion.span>
  );
}

/**
 * Per-tower muzzle→impact visual. Each weapon reads as a DIFFERENT kind of
 * attack, not just a recolored beam:
 *   • pulse — a fast little plasma bolt that travels, with a thin tracer
 *   • arc   — a jagged, flickering lightning arc (no travel)
 *   • rail  — a thick instant railgun beam with muzzle recoil + hard impact
 *   • cryo  — no beam at all; an expanding frost shockwave at the target
 */
function ShotEffect({ ev }: { ev: Extract<BattleEvent, { type: 'shot' }> }) {
  const sx = ((ev.from.col + 0.5) / GRID_COLS) * 100;
  const sy = ((ev.from.row + 0.5) / GRID_ROWS) * 100;
  const tx = ((ev.to.x + 0.5) / GRID_COLS) * 100;
  const ty = ((ev.to.y + 0.5) / GRID_ROWS) * 100;

  if (ev.tower === 'cryo') {
    // Cold shockwave — area modality, deliberately no line/bolt.
    return (
      <>
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ opacity: 0.8, scale: 0.2 }} animate={{ opacity: 0, scale: 1.9 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ left: `${tx}%`, top: `${ty}%`, width: 30, height: 30, transform: 'translate(-50%,-50%)',
            border: '1.5px solid hsl(200 95% 82% / 0.9)', borderRadius: '50%',
            background: 'radial-gradient(circle, hsl(200 95% 80% / 0.35), transparent 70%)',
            boxShadow: '0 0 12px hsl(200 95% 70% / 0.7)' }} />
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ opacity: 0.9, scale: 0.3 }} animate={{ opacity: 0, scale: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ left: `${tx}%`, top: `${ty}%`, width: 14, height: 14, transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, hsl(190 100% 92%), hsl(200 95% 75% / 0.5) 55%, transparent 75%)' }} />
        <DamageNumber ev={ev} />
      </>
    );
  }

  if (ev.tower === 'arc') {
    const pts = jaggedPath(sx, sy, tx, ty, ev.t);
    return (
      <>
        <motion.svg aria-hidden initial={{ opacity: 1 }} animate={{ opacity: [1, 0.35, 0.9, 0] }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', times: [0, 0.35, 0.6, 1] }}
          className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke="hsl(265 90% 72% / 0.55)" strokeWidth={2.2}
            strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'blur(1.5px)' }} />
          <polyline points={pts} fill="none" stroke="#ede9fe" strokeWidth={0.35}
            strokeLinejoin="round" strokeLinecap="round" />
        </motion.svg>
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ opacity: 0.9, scale: 0.3 }} animate={{ opacity: 0, scale: 1.3 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ left: `${tx}%`, top: `${ty}%`, width: 11, height: 11, transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, hsl(265 90% 85%), transparent 70%)' }} />
        <DamageNumber ev={ev} />
      </>
    );
  }

  if (ev.tower === 'rail') {
    // Railgun — thick instant beam that snaps in and fades, heavy recoil + impact.
    return (
      <>
        <motion.svg aria-hidden initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1={sx} y1={sy} x2={tx} y2={ty} stroke="hsl(38 95% 60% / 0.5)" strokeWidth={2.6} style={{ filter: 'blur(1.5px)' }} />
          <line x1={sx} y1={sy} x2={tx} y2={ty} stroke="#fff7e6" strokeWidth={0.7} />
        </motion.svg>
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ opacity: 0.9, scale: 0.6 }} animate={{ opacity: 0, scale: 1.5 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ left: `${sx}%`, top: `${sy}%`, width: 12, height: 12, transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, hsl(38 100% 85%), transparent 70%)' }} />
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ opacity: 1, scale: 0.4 }} animate={{ opacity: 0, scale: 1.7 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ left: `${tx}%`, top: `${ty}%`, width: 18, height: 18, transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, hsl(38 100% 80%), hsl(30 95% 60% / 0.5) 50%, transparent 75%)',
            boxShadow: '0 0 14px hsl(38 95% 60% / 0.8)' }} />
        <DamageNumber ev={ev} />
      </>
    );
  }

  if (ev.tower === 'flak') {
    // Airburst puff + shrapnel — reads as an anti-air flak cloud.
    return (
      <>
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ opacity: 0.9, scale: 0.3 }} animate={{ opacity: 0, scale: 1.7 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ left: `${tx}%`, top: `${ty}%`, width: 16, height: 16, transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, hsl(150 90% 80% / 0.9), hsl(150 80% 55% / 0.4) 55%, transparent 75%)',
            boxShadow: '0 0 12px hsl(150 80% 55% / 0.7)' }} />
        {[0, 1, 2, 3, 4].map((k) => {
          const ang = (k / 5) * Math.PI * 2;
          return (
            <motion.span key={k} aria-hidden className="absolute rounded-full"
              initial={{ left: `${tx}%`, top: `${ty}%`, opacity: 1 }}
              animate={{ left: `${tx + Math.cos(ang) * 3.5}%`, top: `${ty + Math.sin(ang) * 3.5}%`, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ width: 2.5, height: 2.5, transform: 'translate(-50%,-50%)', background: '#6ee7b7', boxShadow: '0 0 5px #34d399' }} />
          );
        })}
        <DamageNumber ev={ev} />
      </>
    );
  }

  if (ev.tower === 'mortar') {
    // Lobbed shell → heavy explosion + debris ring.
    return (
      <>
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ left: `${sx}%`, top: `${sy}%`, opacity: 1 }} animate={{ left: `${tx}%`, top: `${ty}%`, opacity: 1 }}
          transition={{ duration: 0.22, ease: 'easeIn' }}
          style={{ width: 5, height: 5, transform: 'translate(-50%,-50%)', background: '#fb7185', boxShadow: '0 0 8px #f43f5e' }} />
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: [0, 0.95, 0], scale: 2.2 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.22, ease: 'easeOut' }}
          style={{ left: `${tx}%`, top: `${ty}%`, width: 26, height: 26, transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, hsl(40 100% 82% / 0.95), hsl(350 90% 60% / 0.5) 50%, transparent 75%)',
            boxShadow: '0 0 20px hsl(350 90% 60% / 0.8)' }} />
        <motion.span aria-hidden className="absolute rounded-full"
          initial={{ opacity: 0.8, scale: 0.3 }} animate={{ opacity: 0, scale: 1.9 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.45, delay: 0.22, ease: 'easeOut' }}
          style={{ left: `${tx}%`, top: `${ty}%`, width: 22, height: 22, transform: 'translate(-50%,-50%)', border: '1.5px solid hsl(350 90% 70% / 0.8)', borderRadius: '50%' }} />
        <DamageNumber ev={ev} />
      </>
    );
  }

  // pulse — a quick plasma bolt with a thin tracer + small impact pop.
  return (
    <>
      <motion.svg aria-hidden initial={{ opacity: 0.8 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1={sx} y1={sy} x2={tx} y2={ty} stroke="hsl(188 92% 70% / 0.5)" strokeWidth={0.3} />
      </motion.svg>
      <motion.span aria-hidden className="absolute rounded-full"
        initial={{ left: `${sx}%`, top: `${sy}%`, opacity: 1 }} animate={{ left: `${tx}%`, top: `${ty}%`, opacity: 1 }}
        transition={{ duration: 0.12, ease: 'linear' }}
        style={{ width: 4, height: 4, transform: 'translate(-50%,-50%)', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee, 0 0 14px #22d3ee' }} />
      <motion.span aria-hidden className="absolute rounded-full"
        initial={{ opacity: 0.9, scale: 0.2 }} animate={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.22, delay: 0.12, ease: 'easeOut' }}
        style={{ left: `${tx}%`, top: `${ty}%`, width: 10, height: 10, transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle, #a5f3fc, transparent 70%)' }} />
      <DamageNumber ev={ev} />
    </>
  );
}

export function NexusBattleScreen({
  state, mission, selectedTowerKind, selectedTowerId,
  onSelectKind, onPlace, onSelectTower, onUpgrade, onSell, onSetPriority, onCastAbility, onStartWave,
}: Props) {
  // Layout-aware grid helpers — every render reads the path/build tiles for
  // the run's active variant. Cached per variantId by getGridLayout().
  const layout = useMemo(() => getGridLayout(state.pathVariantId), [state.pathVariantId]);
  const { isPath, isBuildable, NEXUS_CELL, pathToXY } = layout;
  // SVG polyline points for the path (centers of each cell). Recomputed when
  // the variant changes — cheap, stable for the lifetime of the run.
  const PATH_POINTS = useMemo(
    () => layout.PATH.map((c) => `${(c.col + 0.5) * (100 / GRID_COLS)},${(c.row + 0.5) * (100 / GRID_ROWS)}`).join(' '),
    [layout],
  );
  const cells = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) cells.push({ c, r });
  }
  const selectedTower = selectedTowerId ? state.towers.find(t => t.id === selectedTowerId) : null;
  const hpPctBase = state.baseHp / state.baseHpMax;
  const hpColor = hpPctBase > 0.5 ? 'hsl(150 80% 60%)' : hpPctBase > 0.25 ? 'hsl(38 95% 60%)' : 'hsl(350 85% 62%)';
  const intelWaveIndex = state.status === 'pre'
    ? 0
    : state.status === 'between'
      ? Math.min(state.waveIndex + 1, mission.waves.length - 1)
      : Math.max(0, state.waveIndex);
  const intelWave = mission.waves[intelWaveIndex];
  const threatKinds = Array.from(new Set(intelWave?.spawns.map(spawn => spawn.enemy) ?? []));
  const queuedContacts = state.spawnQueues.reduce((total, queue) => total + queue.remaining, 0);
  const contacts = state.enemies.length + queuedContacts;
  const furthestContact = state.enemies.reduce(
    (furthest, enemy) => Math.max(furthest, (enemy.pathIndex + enemy.progress) / Math.max(1, layout.PATH.length - 1)),
    0,
  );
  const hasAirDefense = state.towers.some(tower => TOWERS[tower.kind].canHitAir);
  const hasStealthDetection = state.towers.some(tower => tower.kind === 'rail');
  const needsAirDefense = threatKinds.some(kind => ENEMIES[kind].flying) && !hasAirDefense;
  const needsStealthDetection = threatKinds.some(kind => ENEMIES[kind].stealth) && !hasStealthDetection;
  const breachRisk = furthestContact >= 0.72;
  const tacticalAlert = breachRisk
    ? 'CORE BREACH RISK'
    : needsStealthDetection
      ? 'RAIL DETECTION REQUIRED'
      : needsAirDefense
        ? 'ANTI-AIR REQUIRED'
        : null;
  const bossWave = intelWave?.spawns.some(spawn => spawn.enemy === 'boss') ?? false;

  return (
    <div className="nx-battle-shell relative flex flex-col h-full w-full max-w-md mx-auto select-none">
      {/* ───── Unified command HUD rail ───── */}
      <div
        className="nx-battle-hud relative px-3 py-2"
        style={{
          background:
            'linear-gradient(180deg, hsl(var(--nx-panel) / 0.96), hsl(var(--nx-panel) / 0.55))',
          borderBottom: '1px solid hsl(var(--nx-cyan) / 0.3)',
          boxShadow:
            '0 1px 0 hsl(var(--nx-cyan) / 0.18), 0 8px 16px -10px hsl(var(--nx-cyan) / 0.35)',
        }}
      >
        {/* Corner brackets — make whole HUD feel like one panel */}
        <span aria-hidden className="absolute top-1 left-1 w-2 h-2 border-l border-t" style={{ borderColor: 'hsl(var(--nx-cyan) / 0.7)' }} />
        <span aria-hidden className="absolute top-1 right-1 w-2 h-2 border-r border-t" style={{ borderColor: 'hsl(var(--nx-cyan) / 0.7)' }} />
        <div className="flex items-stretch gap-3">
          {/* HP block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <Heart className="w-2.5 h-2.5" style={{ color: hpColor }} />
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>NEXUS</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: hpColor, textShadow: `0 0 8px ${hpColor}` }}>{state.baseHp}</span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>/{state.baseHpMax}</span>
            </div>
            <div className="mt-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'hsl(0 0% 100% / 0.06)' }}>
              <div className="h-full transition-all" style={{ width: `${Math.max(0, hpPctBase * 100)}%`, background: hpColor, boxShadow: `0 0 6px ${hpColor}` }} />
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px self-stretch" style={{ background: 'linear-gradient(180deg, transparent, hsl(var(--nx-cyan) / 0.35), transparent)' }} />

          {/* Energy block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] leading-none" style={{ color: 'hsl(var(--nx-amber))' }}>⚡</span>
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>ENERGY</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: 'hsl(var(--nx-amber))', textShadow: '0 0 8px hsl(var(--nx-amber) / 0.7)' }}>{state.energy}</span>
            </div>
            <div className="mt-1 h-[3px] rounded-full overflow-hidden nx-scan-bar" style={{ background: 'hsl(var(--nx-amber) / 0.15)' }}>
              <div className="h-full" style={{ width: `100%`, background: 'linear-gradient(90deg, hsl(var(--nx-amber) / 0.55), hsl(var(--nx-amber)))' }} />
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px self-stretch" style={{ background: 'linear-gradient(180deg, transparent, hsl(var(--nx-cyan) / 0.35), transparent)' }} />

          {/* Wave block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] leading-none" style={{ color: 'hsl(var(--nx-cyan))' }}>◫</span>
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>WAVE</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: 'hsl(var(--nx-cyan))', textShadow: '0 0 8px hsl(var(--nx-cyan) / 0.7)' }}>{Math.max(0, state.waveIndex + 1)}</span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>/{state.totalWaves ?? '·'}</span>
            </div>
            <div className="mt-1 flex gap-[2px]">
              {Array.from({ length: state.totalWaves || 0 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-[3px] rounded-sm"
                  style={{
                    background: i <= state.waveIndex
                      ? 'hsl(var(--nx-cyan))'
                      : 'hsl(var(--nx-cyan) / 0.18)',
                    boxShadow: i <= state.waveIndex ? '0 0 4px hsl(var(--nx-cyan))' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Live threat telemetry: concise enough for a phone, informative
            enough that players can make a counter-build before tapping rush. */}
        <div className="mt-1.5 flex items-center gap-1.5 min-w-0" aria-live="polite">
          <span
            className="nx-title shrink-0 text-[7px] px-1.5 py-1 nx-clip-sm"
            style={{
              color: contacts > 0 ? 'hsl(var(--nx-rose))' : 'hsl(var(--nx-cyan))',
              background: contacts > 0 ? 'hsl(var(--nx-rose) / 0.11)' : 'hsl(var(--nx-cyan) / 0.08)',
              border: `1px solid ${contacts > 0 ? 'hsl(var(--nx-rose) / 0.35)' : 'hsl(var(--nx-cyan) / 0.24)'}`,
            }}
          >
            {state.status === 'pre' || state.status === 'between' ? 'NEXT' : 'CONTACTS'} · {contacts || intelWave?.spawns.reduce((sum, spawn) => sum + spawn.count, 0) || 0}
          </span>
          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            {threatKinds.slice(0, 5).map(kind => {
              const def = ENEMIES[kind];
              const accent = getEnemyAccent(kind);
              return (
                <span
                  key={kind}
                  title={def.name}
                  className="inline-flex items-center gap-1 shrink-0 text-[7px] font-black px-1.5 py-1 nx-clip-sm"
                  style={{ color: accent.edge, background: accent.glow.replace('0.7)', '0.12)').replace('0.65)', '0.12)').replace('0.55)', '0.12)').replace('0.75)', '0.12)').replace('0.8)', '0.12)').replace('0.85)', '0.12)'), border: `1px solid ${accent.glow}` }}
                >
                  <EnemyMarker kind={kind} size={10} />
                  <span className="hidden min-[390px]:inline nx-title">{def.name}</span>
                </span>
              );
            })}
          </div>
          <span className="ml-auto nx-title text-[7px] shrink-0" style={{ color: bossWave ? 'hsl(var(--nx-rose))' : 'hsl(0 0% 100% / 0.48)' }}>
            {bossWave ? '☠ BOSS WAVE' : state.status === 'in_wave' ? `${Math.round(furthestContact * 100)}% ADVANCE` : `W${String(intelWaveIndex + 1).padStart(2, '0')} INTEL`}
          </span>
        </div>
      </div>

      {/* ───── Battle grid ───── */}
      <div className="nx-battle-field relative flex-1 flex items-center justify-center p-2 overflow-hidden">
        <div
          className="nx-battle-grid relative grid overflow-hidden nx-clip"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, hsl(218 50% 9%), hsl(220 60% 4%) 75%)',
            border: '1px solid hsl(var(--nx-cyan) / 0.35)',
            boxShadow:
              'inset 0 0 24px hsl(var(--nx-cyan) / 0.12), 0 0 28px -8px hsl(var(--nx-cyan) / 0.45)',
          }}
        >
          {/* Subtle background grid */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(hsl(var(--nx-cyan) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--nx-cyan) / 0.6) 1px, transparent 1px)',
              backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
            }}
          />

          <AnimatePresence>
            {tacticalAlert && (
              <motion.div
                key={tacticalAlert}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="nx-threat-alert absolute z-30 top-2 left-1/2 -translate-x-1/2 pointer-events-none nx-clip-sm px-2 py-1 flex items-center gap-1.5 whitespace-nowrap"
                style={{
                  background: breachRisk ? 'hsl(350 65% 12% / 0.94)' : 'hsl(38 55% 10% / 0.94)',
                  border: `1px solid ${breachRisk ? 'hsl(var(--nx-rose) / 0.72)' : 'hsl(var(--nx-amber) / 0.62)'}`,
                  color: breachRisk ? 'hsl(350 95% 78%)' : 'hsl(38 100% 75%)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor', boxShadow: '0 0 6px currentColor' }} />
                <span className="nx-title text-[8px] tracking-[0.18em]">{tacticalAlert}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wave arrival card gives every engagement a readable beat. */}
          <AnimatePresence>
            {state.status === 'in_wave' && state.waveTimeMs <= 1100 && (
              <motion.div
                key={`wave-callout-${state.waveIndex}`}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.92, 1, 1, 1.03] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.05, times: [0, 0.16, 0.76, 1], ease: 'easeOut' }}
                className="absolute z-30 top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center whitespace-nowrap"
              >
                <div
                  className="nx-title text-[9px] tracking-[0.3em]"
                  style={{ color: bossWave ? 'hsl(var(--nx-rose))' : 'hsl(var(--nx-cyan))', textShadow: '0 0 10px currentColor' }}
                >
                  {bossWave ? '☠ PRIORITY THREAT' : 'HOSTILES INBOUND'}
                </div>
                <div className="text-2xl font-black tracking-tight mt-0.5" style={{ color: 'hsl(0 0% 100%)', textShadow: '0 2px 12px hsl(218 80% 2%)' }}>
                  WAVE · {String(state.waveIndex + 1).padStart(2, '0')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Energy corridor (path) — SVG glow + scan dashes + arrows */}
          <svg
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                id="nx-path-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="3.5"
                markerHeight="3.5"
                orient="auto-start-reverse"
              >
                <path d="M0 1 L8 5 L0 9 Z" fill="hsl(188 95% 88%)" opacity="0.95" />
              </marker>
            </defs>
            {/* Outer glow */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 92% 56% / 0.28)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'blur(2.5px)' }}
            />
            {/* Lane fill */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 92% 60% / 0.45)"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Inner bright core */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 95% 92%)"
              strokeWidth="0.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.85"
              markerMid="url(#nx-path-arrow)"
            />
            {/* Running scan dashes — energy moving toward the nexus */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 95% 92%)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2.5 9"
              opacity="0.85"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-23" dur="1.4s" repeatCount="indefinite" />
            </polyline>
          </svg>

          {/* Cell grid (interaction layer) */}
          {cells.map(({ c, r }) => {
            const onPath = isPath(c, r);
            const buildable = isBuildable(c, r);
            const isNexus = c === NEXUS_CELL.col && r === NEXUS_CELL.row;
            const placed = state.towers.find(t => t.cell.col === c && t.cell.row === r);
            const canPlaceHere = !!selectedTowerKind && buildable && !placed && state.energy >= TOWERS[selectedTowerKind].cost;
            return (
              <button
                key={`${c}-${r}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (placed) {
                    onSelectTower(placed.id);
                    onSelectKind(null);
                  } else if (selectedTowerKind && buildable) {
                    onPlace(c, r);
                  } else {
                    onSelectTower(null);
                  }
                }}
                className={cn(
                  'relative transition-colors',
                  buildable && !placed && !canPlaceHere && 'hover:bg-cyan-400/10',
                  canPlaceHere && 'bg-emerald-400/25',
                )}
                style={
                  canPlaceHere
                    ? {
                        boxShadow:
                          'inset 0 0 0 1.5px hsl(150 80% 60% / 0.85), inset 0 0 10px hsl(150 80% 55% / 0.25)',
                      }
                    : buildable && !placed
                      ? {
                          background:
                            'linear-gradient(145deg, hsl(218 45% 12% / 0.55), hsl(218 55% 6% / 0.85))',
                          boxShadow:
                            'inset 0 0 0 1px hsl(var(--nx-cyan) / 0.12), inset 0 1px 0 hsl(0 0% 100% / 0.04), inset 0 -2px 3px hsl(0 0% 0% / 0.35)',
                        }
                      : !buildable && !onPath && !isNexus
                        ? {
                            background:
                              'linear-gradient(145deg, hsl(218 50% 8%), hsl(220 60% 4%))',
                            boxShadow:
                              'inset 0 0 0 1px hsl(0 0% 100% / 0.025), inset 0 1px 0 hsl(0 0% 100% / 0.03)',
                          }
                        : undefined
                }
              >
                {/* Nexus core */}
                {isNexus && (
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="nx-reactor-glow absolute inset-1 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle, hsl(var(--nx-amber) / 0.6), hsl(var(--nx-amber) / 0.15) 60%, transparent 75%)',
                      }}
                    />
                    <span
                      className="relative w-[68%] h-[68%] rounded-full flex items-center justify-center"
                      style={{
                        background:
                          'radial-gradient(circle at 35% 30%, hsl(38 95% 75%), hsl(38 95% 50%) 55%, hsl(20 70% 30%) 90%)',
                        boxShadow:
                          '0 0 10px hsl(var(--nx-amber) / 0.7), inset 0 0 6px hsl(0 0% 100% / 0.4), inset 0 -2px 4px hsl(0 0% 0% / 0.4)',
                        border: '1px solid hsl(38 95% 80% / 0.7)',
                      }}
                    >
                      <span className="text-[7px] font-black" style={{ color: 'hsl(20 60% 18%)' }}>◉</span>
                    </span>
                  </span>
                )}

                {/* Hardpoint dot on empty buildable tiles */}
                {buildable && !placed && !canPlaceHere && (
                  <span aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 nx-hardpoint" />
                )}

                {/* Path waypoint nodes (subtle) */}
                {onPath && !isNexus && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full"
                    style={{ background: 'hsl(188 92% 75% / 0.35)' }}
                  />
                )}

                {/* Placed tower */}
                {placed && (
                  <motion.div
                    initial={{ scale: 0.72, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    className={cn(
                      'absolute inset-[3px] rounded-md flex items-center justify-center',
                      selectedTowerId === placed.id && 'ring-2',
                    )}
                    style={{
                      background: TOWER_HSL[placed.kind].bg,
                      border: `1.5px solid ${TOWER_HSL[placed.kind].c}`,
                      boxShadow: `0 0 8px ${TOWER_HSL[placed.kind].cDim}, inset 0 0 6px hsl(0 0% 100% / 0.06)`,
                      color: TOWER_HSL[placed.kind].c,
                      // @ts-expect-error css var
                      '--tw-ring-color': 'hsl(150 80% 60% / 0.85)',
                    }}
                  >
                    <TowerIcon kind={placed.kind} size={20} />
                    <span
                      className="absolute -top-[5px] -right-[5px] text-[7px] font-black px-[3px] py-[1px] rounded-sm leading-none"
                      style={{
                        background: 'hsl(218 50% 8%)',
                        color: TOWER_HSL[placed.kind].text,
                        border: `1px solid ${TOWER_HSL[placed.kind].c}`,
                      }}
                    >
                      L{placed.level}
                    </span>
                  </motion.div>
                )}
              </button>
            );
          })}

          {/* Enemies overlay — distinct silhouettes per type */}
          <div className="absolute inset-0 pointer-events-none">
            {state.enemies.map(e => {
              const def = ENEMIES[e.kind];
              const accent = getEnemyAccent(e.kind);
              const pos = pathToXY(e.pathIndex, e.progress);
              const left = ((pos.x + 0.5) / GRID_COLS) * 100;
              const top = ((pos.y + 0.5) / GRID_ROWS) * 100;
              const hpPct = Math.max(0, e.hp / (e.maxHp || def.hp));
              const size = e.kind === 'boss' ? 30 : e.kind === 'brute' ? 26 : e.kind === 'walker' ? 22 : e.kind === 'runner' ? 13 : 17;
              const barW = e.kind === 'boss' || e.kind === 'brute' ? 22 : 14;
              return (
                <div
                  key={e.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  {/* Boss aura — extra threat presence */}
                  {e.kind === 'boss' && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full nx-reactor-glow"
                      style={{
                        width: size + 14,
                        height: size + 14,
                        background: `radial-gradient(circle, ${accent.glow}, transparent 70%)`,
                      }}
                    />
                  )}

                  {/* Stealth cloak ring (dashed) */}
                  {def.stealth && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: size + 6,
                        height: size + 6,
                        border: `1px dashed ${accent.edge}`,
                        opacity: 0.55,
                      }}
                    />
                  )}

                  {/* Shield bubble */}
                  {e.shield > 0 && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: size + 8,
                        height: size + 8,
                        background: 'radial-gradient(circle, hsl(200 95% 70% / 0.18), transparent 70%)',
                        border: '1px solid hsl(200 95% 75% / 0.85)',
                        boxShadow: '0 0 6px hsl(200 95% 70% / 0.7), inset 0 0 4px hsl(200 95% 80% / 0.4)',
                      }}
                    />
                  )}

                  {/* Combat states stay legible without opening a details panel. */}
                  {def.heal && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full nx-healer-aura"
                      style={{ width: size + 14, height: size + 14, border: '1px solid hsl(150 90% 70% / 0.55)', boxShadow: '0 0 10px hsl(150 80% 55% / 0.38)' }}
                    />
                  )}
                  {e.slowMs > 0 && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full nx-status-orbit"
                      style={{ width: size + 5, height: size + 5, border: '1px dotted hsl(200 100% 82% / 0.9)' }}
                    />
                  )}
                  {e.stunnedMs > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-black"
                      style={{ color: 'hsl(48 100% 70%)', textShadow: '0 0 5px hsl(48 100% 55%)' }}
                    >
                      ⚡
                    </span>
                  )}

                  {/* Airborne shadow — reads flyers as hovering above the lane */}
                  {def.flying && (
                    <span aria-hidden className="absolute left-1/2 -translate-x-1/2 rounded-full"
                      style={{ top: size * 0.6, width: size * 0.75, height: size * 0.24,
                        background: 'radial-gradient(ellipse, hsl(0 0% 0% / 0.55), transparent 70%)', filter: 'blur(1px)' }} />
                  )}

                  <div
                    className={cn('relative flex items-center justify-center', def.stealth && 'opacity-75')}
                    style={{ width: size, height: size, transform: def.flying ? 'translateY(-3px)' : undefined }}
                  >
                    <EnemyMarker kind={e.kind} size={size} />
                  </div>

                  {/* HP bar */}
                  <div
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-[2px] rounded overflow-hidden"
                    style={{ width: barW, background: 'hsl(0 0% 0% / 0.7)', border: '0.5px solid hsl(0 0% 100% / 0.15)' }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${hpPct * 100}%`,
                        background: hpPct > 0.5 ? 'hsl(150 85% 60%)' : hpPct > 0.25 ? 'hsl(38 95% 60%)' : 'hsl(350 90% 62%)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Range circle for selected placed tower */}
          {selectedTower && (
            <div
              className="absolute pointer-events-none rounded-full"
              style={{
                left: `${((selectedTower.cell.col + 0.5) / GRID_COLS) * 100}%`,
                top: `${((selectedTower.cell.row + 0.5) / GRID_ROWS) * 100}%`,
                width: `${(towerRangeAt(selectedTower.kind, selectedTower.level) * 2 / GRID_COLS) * 100}%`,
                height: `${(towerRangeAt(selectedTower.kind, selectedTower.level) * 2 / GRID_ROWS) * 100}%`,
                transform: 'translate(-50%, -50%)',
                border: '1px dashed hsl(150 80% 60% / 0.7)',
                background: 'hsl(150 80% 60% / 0.05)',
                boxShadow: 'inset 0 0 12px hsl(150 80% 60% / 0.18)',
              }}
            />
          )}

          {/* Per-tower shot FX — each weapon reads as a distinct attack */}
          <div className="absolute inset-0 pointer-events-none">
            <AnimatePresence>
              {state.events.map((ev, i) =>
                ev.type === 'shot' ? <ShotEffect key={`shot-${ev.t}-${i}`} ev={ev} /> : null,
              )}
            </AnimatePresence>
          </div>

          {/* Kill bursts — quick energy disintegration at the death position */}
          <div className="absolute inset-0 pointer-events-none">
            <AnimatePresence>
              {state.events.filter(ev => ev.type === 'kill').map((ev, i) => {
                if (ev.type !== 'kill') return null;
                const left = ((ev.at.x + 0.5) / GRID_COLS) * 100;
                const top = ((ev.at.y + 0.5) / GRID_ROWS) * 100;
                return (
                  <motion.span
                    key={`kill-${ev.t}-${i}`}
                    aria-hidden
                    initial={{ opacity: 0.95, scale: 0.35 }}
                    animate={{ opacity: 0, scale: 1.6 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="absolute rounded-full"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: 26,
                      height: 26,
                      transform: 'translate(-50%, -50%)',
                      background:
                        'radial-gradient(circle, hsl(38 95% 80% / 0.95), hsl(188 92% 70% / 0.55) 45%, transparent 75%)',
                      boxShadow:
                        '0 0 14px hsl(38 95% 70% / 0.7), 0 0 22px hsl(188 92% 60% / 0.45)',
                      filter: 'blur(0.4px)',
                    }}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          {/* Ability flash — orbital impact / EMP suppression ring */}
          <div className="absolute inset-0 pointer-events-none">
            <AnimatePresence>
              {state.events.filter(ev => ev.type === 'ability').map((ev, i) => {
                if (ev.type !== 'ability') return null;
                const isOrbital = ev.ability === 'orbital';
                return (
                  <motion.span
                    key={`ab-${ev.t}-${i}`}
                    aria-hidden
                    initial={{ opacity: 0.85, scale: 0.4 }}
                    animate={{ opacity: 0, scale: 2.4 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="absolute top-1/2 left-1/2 rounded-full"
                    style={{
                      width: '70%',
                      height: '70%',
                      transform: 'translate(-50%, -50%)',
                      border: isOrbital
                        ? '2px solid hsl(38 95% 70% / 0.85)'
                        : '2px solid hsl(265 80% 75% / 0.85)',
                      background: isOrbital
                        ? 'radial-gradient(circle, hsl(38 95% 70% / 0.35), transparent 65%)'
                        : 'radial-gradient(circle, hsl(265 80% 70% / 0.30), transparent 65%)',
                      boxShadow: isOrbital
                        ? '0 0 30px hsl(38 95% 60% / 0.7)'
                        : '0 0 30px hsl(265 80% 70% / 0.7)',
                    }}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          {/* Leak / breach flash — red vignette pulse over the battlefield */}
          <AnimatePresence>
            {state.events.some(ev => ev.type === 'leak') && (
              <motion.span
                key={`leak-${state.events.find(ev => ev.type === 'leak')?.t ?? 0}`}
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.55, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 100%, hsl(350 85% 55% / 0.55), transparent 65%)',
                  mixBlendMode: 'screen',
                }}
              />
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* ───── Selected tower panel ───── */}
      {selectedTower && (
        <div className="nx-selected-panel px-3 pb-2 space-y-1.5">
          <div
            className="nx-clip-sm p-2 flex items-center gap-2"
            style={{
              background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 8%))',
              border: '1px solid hsl(150 80% 55% / 0.5)',
              boxShadow: '0 0 12px -4px hsl(150 80% 55% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.05)',
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: TOWER_HSL[selectedTower.kind].bg,
                border: `1.5px solid ${TOWER_HSL[selectedTower.kind].c}`,
                color: TOWER_HSL[selectedTower.kind].c,
                boxShadow: `0 0 10px ${TOWER_HSL[selectedTower.kind].cDim}`,
              }}
            >
              <TowerIcon kind={selectedTower.kind} size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black truncate">
                {TOWERS[selectedTower.kind].name}
                <span className="ml-1.5 text-[9px] font-bold nx-title" style={{ color: TOWER_HSL[selectedTower.kind].text }}>L{selectedTower.level}</span>
              </div>
              <div className="text-[10px] text-foreground/65 nx-title">
                DMG <span className="text-foreground">{towerDamageAt(selectedTower.kind, selectedTower.level)}</span> · RNG <span className="text-foreground">{towerRangeAt(selectedTower.kind, selectedTower.level).toFixed(1)}</span>
              </div>
            </div>
            <button
              onClick={() => onUpgrade(selectedTower.id)}
              disabled={selectedTower.level >= 3 || state.energy < towerUpgradeCost(selectedTower.kind, selectedTower.level)}
              className="px-2.5 py-2 rounded-md text-[11px] font-black disabled:opacity-40 active:scale-95 nx-title"
              style={{
                background: 'hsl(150 80% 55% / 0.18)',
                color: 'hsl(150 80% 70%)',
                border: '1px solid hsl(150 80% 55% / 0.5)',
              }}
            >
              <ChevronUp className="w-3 h-3 inline" /> {selectedTower.level >= 3 ? 'MAX' : towerUpgradeCost(selectedTower.kind, selectedTower.level)}
            </button>
            <button
              onClick={() => onSell(selectedTower.id)}
              className="px-2.5 py-2 rounded-md text-[11px] font-black active:scale-95 nx-title"
              style={{
                background: 'hsl(350 85% 62% / 0.14)',
                color: 'hsl(350 85% 78%)',
                border: '1px solid hsl(350 85% 62% / 0.4)',
              }}
            >
              <X className="w-3 h-3 inline" /> {towerSellValue(selectedTower.kind, selectedTower.level)}
            </button>
          </div>

          {/* Targeting priority — live agency over what this tower shoots */}
          <div
            className="nx-clip-sm px-2 py-1.5 flex items-center gap-1.5"
            style={{
              background: 'linear-gradient(180deg, hsl(218 40% 10%), hsl(218 42% 7%))',
              border: '1px solid hsl(var(--nx-cyan) / 0.35)',
            }}
          >
            <span className="flex items-center gap-1 shrink-0 nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>
              <Crosshair className="w-3 h-3" style={{ color: 'hsl(var(--nx-cyan))' }} /> TARGET
            </span>
            <div className="flex-1 grid grid-cols-4 gap-1">
              {TARGET_MODES.map(({ mode, label }) => {
                const active = (selectedTower.targetPriority ?? 'first') === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onSetPriority(selectedTower.id, mode)}
                    className="py-1 rounded-sm text-[8px] font-black nx-title active:scale-95 transition"
                    style={{
                      background: active ? 'hsl(var(--nx-cyan) / 0.22)' : 'hsl(0 0% 100% / 0.04)',
                      border: `1px solid ${active ? 'hsl(var(--nx-cyan) / 0.8)' : 'hsl(0 0% 100% / 0.1)'}`,
                      color: active ? 'hsl(var(--nx-cyan))' : 'hsl(0 0% 100% / 0.55)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ───── Command deck: tower cards + ability bar ───── */}
      <div
        className="nx-command-deck relative px-2 pb-2 pt-1.5"
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, hsl(var(--nx-panel) / 0.55), hsl(var(--nx-panel) / 0.97))',
          borderTop: '1px solid hsl(var(--nx-cyan) / 0.3)',
          boxShadow: '0 -1px 0 hsl(var(--nx-cyan) / 0.18), 0 -8px 16px -10px hsl(var(--nx-cyan) / 0.3)',
        }}
      >
        {/* Launch control lives in the command deck instead of covering the
            final grid row and Nexus core. */}
        {(state.status === 'pre' || state.status === 'between') && (
          <button
            onClick={onStartWave}
            className="w-full mb-2 nx-clip-sm py-2.5 font-black text-xs active:scale-[0.98] transition nx-title"
            style={{
              background: 'linear-gradient(180deg, hsl(150 80% 55%), hsl(150 80% 42%))',
              color: 'hsl(150 30% 8%)',
              boxShadow: '0 0 18px hsl(150 80% 55% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)',
            }}
          >
            <span className="hidden min-[390px]:inline">
              {state.status === 'pre'
                ? `▶  DEPLOY WAVE 01 / ${String(state.totalWaves).padStart(2, '0')}`
                : `▶  WAVE ${String(state.waveIndex + 2).padStart(2, '0')} / ${String(state.totalWaves).padStart(2, '0')}  ·  ${Math.ceil(state.betweenWaveMs / 1000)}s  ·  TAP TO RUSH`}
            </span>
            <span className="min-[390px]:hidden">
              {state.status === 'pre'
                ? '▶  DEPLOY WAVE 01'
                : `▶  RUSH WAVE ${String(state.waveIndex + 2).padStart(2, '0')} · ${Math.ceil(state.betweenWaveMs / 1000)}s`}
            </span>
          </button>
        )}

        {/* Tower cards — distinct framed slots with letter badge + icon */}
        <div className="nx-command-strip nx-tower-strip flex gap-1.5 mb-2 overflow-x-auto pb-0.5">
          {TOWER_LIST.map((def) => {
            const kind = def.kind;
            const selected = selectedTowerKind === kind;
            const affordable = state.energy >= def.cost;
            const shortName = TOWER_SHORT[kind];
            const letter = def.glyph;
            const c = TOWER_HSL[kind];
            return (
              <button
                key={kind}
                onClick={() => { onSelectKind(selected ? null : kind); onSelectTower(null); }}
                aria-label={`${def.name}, ${def.cost} energy${affordable ? '' : ', unavailable'}`}
                aria-pressed={selected}
                className={cn(
                  'nx-command-card relative min-w-[72px] w-[72px] min-h-[66px] nx-clip-sm flex flex-col items-stretch justify-between p-1.5 transition active:scale-[0.97]',
                  !affordable && 'opacity-55',
                )}
                style={{
                  background: selected
                    ? `linear-gradient(180deg, ${c.bg}, hsl(218 50% 6% / 0.95))`
                    : 'linear-gradient(180deg, hsl(218 50% 10%), hsl(218 55% 6%))',
                  border: selected ? `1.5px solid ${c.c}` : `1px solid ${c.c.replace(')', ' / 0.4)').replace('hsl(', 'hsl(')}`,
                  boxShadow: selected
                    ? `0 0 14px -2px ${c.c.replace(')', ' / 0.55)').replace('hsl(', 'hsl(')}, inset 0 1px 0 hsl(0 0% 100% / 0.08)`
                    : 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                  color: c.c,
                }}
              >
                {/* Top row: letter badge + tower icon */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="flex items-center justify-center w-5 h-5 rounded-sm text-[10px] font-black leading-none"
                    style={{
                      background: `${c.bg}`,
                      border: `1px solid ${c.c}`,
                      color: c.c,
                      boxShadow: selected ? `0 0 6px ${c.cDim}` : undefined,
                    }}
                  >
                    {letter}
                  </span>
                  <span style={{ filter: `drop-shadow(0 0 4px ${c.cDim})` }}>
                    <TowerIcon kind={kind} size={22} />
                  </span>
                </div>

                {/* Selected indicator chevron */}
                {selected && (
                  <span
                    aria-hidden
                    className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-0 h-0"
                    style={{
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderBottom: `5px solid ${c.c}`,
                      filter: `drop-shadow(0 0 4px ${c.c})`,
                    }}
                  />
                )}

                {/* Bottom: name + cost */}
                <div className="flex flex-col items-center mt-1">
                  <span
                    className="nx-title text-[9px] leading-none"
                    style={{ color: selected ? c.text : 'hsl(0 0% 100% / 0.78)', letterSpacing: '0.16em' }}
                  >
                    {shortName}
                  </span>
                  <span
                    className="text-[10px] font-black tabular-nums leading-none mt-1 flex items-center gap-px"
                    style={{ color: affordable ? 'hsl(var(--nx-amber))' : 'hsl(350 80% 65%)' }}
                  >
                    <span style={{ filter: 'drop-shadow(0 0 3px hsl(var(--nx-amber) / 0.7))' }}>⚡</span>
                    {def.cost}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Ability bar — compact dials, scales to any number of abilities */}
        <div className="nx-command-strip nx-ability-strip flex gap-1.5 overflow-x-auto">
          {state.abilities.map((a) => {
            const def = ABILITIES[a.kind];
            const ready = a.cooldownMs <= 0;
            const pct = ready ? 1 : 1 - (a.cooldownMs / def.cooldownMs);
            const remainSec = Math.ceil(a.cooldownMs / 1000);
            const tone = ready ? 'hsl(var(--nx-amber))' : 'hsl(var(--nx-cyan))';
            return (
              <button
                key={a.kind}
                onClick={() => ready && onCastAbility(a.kind)}
                disabled={!ready}
                className="nx-command-card relative min-w-[136px] flex-1 nx-clip-sm flex items-center gap-2 px-2 py-1.5 active:scale-[0.97] transition"
                style={{
                  background: 'linear-gradient(180deg, hsl(218 50% 9%), hsl(218 55% 5%))',
                  border: `1px solid ${ready ? 'hsl(var(--nx-amber) / 0.55)' : 'hsl(var(--nx-cyan) / 0.28)'}`,
                  boxShadow: ready ? '0 0 10px -3px hsl(var(--nx-amber) / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.05)' : 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                  opacity: ready ? 1 : 0.85,
                }}
              >
                <span className="relative flex items-center justify-center shrink-0" style={{ width: 30, height: 30 }}>
                  <svg width="30" height="30" viewBox="0 0 30 30" className="absolute inset-0">
                    <circle cx="15" cy="15" r="12" fill="none" stroke="hsl(var(--nx-cyan) / 0.2)" strokeWidth="1.5" />
                    <circle cx="15" cy="15" r="12" fill="none" stroke={tone} strokeWidth="1.5" strokeLinecap="round"
                      strokeDasharray={`${pct * 75.4} 75.4`} transform="rotate(-90 15 15)"
                      style={{ filter: ready ? `drop-shadow(0 0 4px ${tone})` : undefined }} />
                  </svg>
                  <span className="text-[12px] font-black" style={{ color: ready ? 'hsl(var(--nx-amber))' : 'hsl(0 0% 100% / 0.55)' }}>{def.glyph}</span>
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block nx-title text-[9px] truncate" style={{ letterSpacing: '0.1em', color: ready ? 'hsl(0 0% 98%)' : 'hsl(0 0% 100% / 0.55)' }}>{def.name.toUpperCase()}</span>
                  <span className="block text-[9px] font-black tabular-nums leading-tight" style={{ color: ready ? 'hsl(150 80% 65%)' : 'hsl(var(--nx-cyan))' }}>{ready ? 'READY' : `${remainSec}s`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

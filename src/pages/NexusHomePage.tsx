import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Trophy, Target, Orbit, Users, Sparkles, Lock, Check,
  Infinity as InfinityIcon, ChevronRight,
} from 'lucide-react';
import { ContinueRunBanner } from '@/components/nexus/ContinueRunBanner';
import { useNexusJourney } from '@/hooks/useNexusJourney';
import type { JourneyStage, StageKey } from '@/lib/nexus/journey';

const STAGE_ICON: Record<StageKey, (p: { className?: string; style?: React.CSSProperties }) => JSX.Element> = {
  outer_rim: (p) => <Target {...p} />,
  inner_belt: (p) => <Orbit {...p} />,
  endless: (p) => <InfinityIcon {...p} />,
  coop: (p) => <Users {...p} />,
};

export default function NexusHomePage() {
  const { model } = useNexusJourney();
  const { stages, rank, overallPct, cores, sigils } = model;
  const overall = Math.round(overallPct * 100);

  return (
    <div className="max-w-[600px] mx-auto pb-6">
      {/* ───── Operative rank + overall completion ───── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden mt-2 mb-3 nx-clip nx-bracket"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 25% 15%, hsl(188 70% 22% / 0.55), transparent 60%),' +
            'linear-gradient(160deg, hsl(218 50% 10%), hsl(220 60% 5%))',
          border: '1px solid hsl(var(--nx-cyan) / 0.4)',
          boxShadow: '0 0 24px -8px hsl(var(--nx-cyan) / 0.55), inset 0 1px 0 hsl(var(--nx-cyan) / 0.18)',
        }}
      >
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full" style={{ background: 'hsl(188 92% 56% / 0.18)', filter: 'blur(40px)' }} />
        <div className="relative p-5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
            <p className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-cyan))' }}>OPERATIVE RANK</p>
          </div>

          <div className="flex items-end justify-between gap-3 mb-2">
            <h1 className="text-3xl font-black tracking-tight leading-none" style={{ color: 'hsl(0 0% 98%)' }}>{rank.title}</h1>
            <div className="text-right">
              <div className="text-2xl font-black tabular-nums leading-none" style={{ color: 'hsl(var(--nx-cyan))' }}>{overall}%</div>
              <div className="nx-title text-[8px] mt-0.5" style={{ color: 'hsl(0 0% 100% / 0.5)' }}>COMPLETE</div>
            </div>
          </div>

          {/* Overall completion bar */}
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'hsl(0 0% 100% / 0.07)' }}>
            <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, hsl(var(--nx-cyan)), hsl(150 80% 60%))', boxShadow: '0 0 6px hsl(var(--nx-cyan) / 0.5)' }}
              initial={{ width: 0 }} animate={{ width: `${overall}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          </div>

          {/* Rank pips + cores */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1">
              {Array.from({ length: rank.total }).map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-sm" style={{
                  background: i <= rank.index ? 'hsl(var(--nx-cyan))' : 'hsl(var(--nx-cyan) / 0.16)',
                  boxShadow: i <= rank.index ? '0 0 4px hsl(var(--nx-cyan))' : undefined,
                }} />
              ))}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-black tabular-nums" style={{ color: 'hsl(var(--nx-amber))' }}>
              <span style={{ filter: 'drop-shadow(0 0 3px hsl(var(--nx-amber) / 0.7))' }}>⚡</span>{cores}
            </span>
          </div>
          {rank.next && (
            <p className="text-[10px] mt-1.5" style={{ color: 'hsl(0 0% 100% / 0.55)' }}>
              {Math.round(rank.pctToNext * 100)}% to <span className="font-black" style={{ color: 'hsl(0 0% 90%)' }}>{rank.next}</span>
            </p>
          )}
        </div>
      </motion.div>

      <ContinueRunBanner />

      {/* ───── The operations journey ───── */}
      <h2 className="nx-title text-[9px] mb-2 mt-4" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.22em' }}>
        ◢ OPERATIONS JOURNEY
      </h2>
      <div>
        {stages.map((s, i) => (
          <StageRow key={s.key} stage={s} isLast={i === stages.length - 1} prevComplete={i > 0 && stages[i - 1].status === 'complete'} />
        ))}
      </div>

      {/* ───── Sigil collection tracker ───── */}
      <Link
        to="/nexus/sigils"
        className="flex items-center gap-3 mt-3 p-3 nx-clip-sm active:scale-[0.99] transition"
        style={{ background: 'linear-gradient(180deg, hsl(45 40% 11%), hsl(45 45% 6%))', border: '1px solid hsl(45 100% 60% / 0.35)' }}
      >
        <div className="w-9 h-9 nx-clip-sm flex items-center justify-center shrink-0" style={{ background: 'hsl(45 100% 60% / 0.16)', border: '1px solid hsl(45 100% 60% / 0.4)', color: 'hsl(45 100% 70%)' }}>
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-black" style={{ color: 'hsl(45 100% 78%)' }}>Sigil Vault</div>
          <div className="nx-title text-[9px] mt-0.5" style={{ color: 'hsl(45 60% 65% / 0.8)' }}>
            {sigils.total > 0 ? `${sigils.owned} / ${sigils.total} COLLECTED` : 'EARNED ALONG THE WAY'}
          </div>
        </div>
        {sigils.total > 0 && (
          <div className="w-16 h-1 rounded-full overflow-hidden mr-1" style={{ background: 'hsl(45 40% 30% / 0.5)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round((sigils.owned / sigils.total) * 100)}%`, background: 'hsl(45 100% 65%)' }} />
          </div>
        )}
        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'hsl(45 100% 70% / 0.5)' }} />
      </Link>

      {/* ───── Reference systems ───── */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <NavTile to="/nexus/leaderboard" icon={<Trophy className="w-4 h-4" />} label="Leaderboard" accent="hsl(150 80% 70%)" border="hsl(150 80% 60% / 0.35)" />
        <NavTile to="/nexus/codex" icon={<Shield className="w-4 h-4" />} label="Codex" accent="hsl(var(--nx-cyan))" border="hsl(var(--nx-cyan) / 0.3)" />
      </div>
    </div>
  );
}

/* ─── Journey stage row (with connector spine) ─── */

function StageRow({ stage, isLast, prevComplete }: { stage: JourneyStage; isLast: boolean; prevComplete: boolean }) {
  const locked = stage.status === 'locked';
  const complete = stage.status === 'complete';
  const Icon = STAGE_ICON[stage.key];
  const accent = stage.accent;
  const nodeColor = locked ? 'hsl(0 0% 100% / 0.28)' : complete ? 'hsl(150 80% 60%)' : accent;

  const card = (
    <div
      className="flex-1 p-3 nx-clip-sm relative overflow-hidden"
      style={{
        background: locked
          ? 'linear-gradient(180deg, hsl(218 25% 10%), hsl(218 28% 7%))'
          : `radial-gradient(ellipse 70% 90% at 100% 0%, ${accent.replace(')', ' / 0.14)')}, transparent 60%), linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))`,
        border: `1px solid ${locked ? 'hsl(0 0% 100% / 0.1)' : accent.replace(')', ' / 0.45)')}`,
        opacity: locked ? 0.7 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black truncate" style={{ color: locked ? 'hsl(0 0% 100% / 0.6)' : 'hsl(0 0% 96%)' }}>{stage.name}</span>
            <StatusPill status={stage.status} accent={accent} />
          </div>
          <p className="text-[10px] leading-snug mt-0.5" style={{ color: 'hsl(0 0% 100% / 0.55)' }}>
            {locked ? stage.unlockHint : stage.blurb}
          </p>
        </div>
        {!locked && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: `${accent.replace(')', ' / 0.6)')}` }} />}
      </div>

      {/* Progress line */}
      {!locked && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.5)' }}>{stage.progressLabel}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(0 0% 100% / 0.08)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(stage.progressPct * 100)}%`, background: complete ? 'hsl(150 80% 60%)' : accent, boxShadow: `0 0 5px ${complete ? 'hsl(150 80% 60%)' : accent}` }} />
          </div>
        </div>
      )}
      {locked && (
        <div className="mt-2 flex items-center gap-1.5">
          <Lock className="w-3 h-3" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
          <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>LOCKED</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-2.5">
      {/* Left rail: node + connector */}
      <div className="flex flex-col items-center pt-3" style={{ width: 28 }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: locked ? 'hsl(218 30% 12%)' : `${accent.replace(')', ' / 0.16)')}`, border: `1.5px solid ${nodeColor}`, color: nodeColor, boxShadow: locked ? undefined : `0 0 8px -1px ${nodeColor}` }}>
          {complete ? <Check className="w-4 h-4" /> : locked ? <Lock className="w-3.5 h-3.5" /> : <Icon className="w-4 h-4" />}
        </div>
        {!isLast && (
          <div className="flex-1 w-px my-1" style={{ minHeight: 18, background: prevComplete || complete ? 'linear-gradient(180deg, hsl(150 80% 60% / 0.6), hsl(var(--nx-cyan) / 0.25))' : 'hsl(0 0% 100% / 0.12)' }} />
        )}
      </div>
      <div className="flex-1 pb-2.5">
        {locked ? card : <Link to={stage.to} className="block active:scale-[0.99] transition">{card}</Link>}
      </div>
    </div>
  );
}

function StatusPill({ status, accent }: { status: JourneyStage['status']; accent: string }) {
  if (status === 'complete') {
    return <span className="nx-title text-[7px] px-1 py-px rounded-sm" style={{ color: 'hsl(150 80% 72%)', background: 'hsl(150 80% 55% / 0.15)', border: '1px solid hsl(150 80% 55% / 0.4)' }}>CLEAR</span>;
  }
  if (status === 'locked') {
    return <span className="nx-title text-[7px] px-1 py-px rounded-sm" style={{ color: 'hsl(0 0% 100% / 0.45)', border: '1px solid hsl(0 0% 100% / 0.15)' }}>LOCKED</span>;
  }
  return <span className="nx-title text-[7px] px-1 py-px rounded-sm" style={{ color: accent, background: accent.replace(')', ' / 0.12)'), border: `1px solid ${accent.replace(')', ' / 0.4)')}` }}>ACTIVE</span>;
}

function NavTile({ to, icon, label, accent, border }: { to: string; icon: React.ReactNode; label: string; accent: string; border: string }) {
  return (
    <Link to={to} className="flex items-center justify-center gap-2 h-12 nx-clip-sm active:scale-95 transition"
      style={{ background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))', border: `1px solid ${border}` }}>
      <span style={{ color: accent }}>{icon}</span>
      <span className="nx-title text-[9px]">{label}</span>
    </Link>
  );
}

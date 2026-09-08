import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Check, Skull, Users, Infinity as InfinityIcon, ChevronRight, Crosshair } from 'lucide-react';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { useNexusJourney } from '@/hooks/useNexusJourney';
import { resolveModifiers, modifierTone } from '@/lib/nexus/modifiers';
import { useActiveOperation } from '@/hooks/useNexusOperation';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { getBriefing } from '@/lib/nexus/missionBriefings';
import { getLayout } from '@/lib/nexus/mapLayouts';
import { MapLayoutPreview } from '@/components/nexus/MapLayoutPreview';
import { cn } from '@/lib/utils';

export default function NexusMissionsPage() {
  const { progress } = useNexusProgress();
  const { missions: MISSIONS } = useResolvedMissions();
  const { operation } = useActiveOperation();
  const { model: journey } = useNexusJourney();
  const endlessLocked = journey.stages.find(s => s.key === 'endless')?.status === 'locked';
  const coopLocked = journey.stages.find(s => s.key === 'coop')?.status === 'locked';
  const campaign = MISSIONS.filter(m => m.id !== ENDLESS_MISSION_ID);
  const cleared = Math.max(0, Math.min(progress.highest_mission - 1, campaign.length));
  const sectorPct = campaign.length > 0 ? Math.round((cleared / campaign.length) * 100) : 0;

  return (
    <div className="max-w-[600px] mx-auto pb-6 px-1">
      {/* Sector header — tactical deployment screen feel */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-4 mt-1 nx-clip-sm overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 100% 0%, hsl(var(--nx-cyan) / 0.18), transparent 60%),' +
            'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
          border: '1px solid hsl(var(--nx-cyan) / 0.32)',
          boxShadow: '0 0 14px -8px hsl(var(--nx-cyan) / 0.4), inset 0 1px 0 hsl(var(--nx-cyan) / 0.1)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.10]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--nx-cyan)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--nx-cyan)) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 60% 70% at 100% 50%, black, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at 100% 50%, black, transparent 80%)',
          }}
        />
        <div className="relative p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
            <p className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-cyan))', letterSpacing: '0.22em' }}>
              CAMPAIGN · DEPLOYMENT GRID
            </p>
          </div>
          <h1 className="text-xl font-black tracking-tight">Outer Rim → Inner Belt</h1>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold tabular-nums">
            <Crosshair className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--nx-cyan))' }} />
            <span className="text-foreground/70">{campaign.length} MISSIONS</span>
            <span className="w-0.5 h-0.5 rounded-full bg-foreground/30" />
            <span style={{ color: 'hsl(150 80% 70%)' }}>{cleared} CLEARED</span>
            <span className="ml-auto" style={{ color: 'hsl(var(--nx-cyan))' }}>{sectorPct}%</span>
          </div>
          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(0 0% 100% / 0.06)' }}>
            <motion.div
              className="h-full"
              style={{ background: 'linear-gradient(90deg, hsl(var(--nx-cyan)), hsl(150 80% 60%))', boxShadow: '0 0 6px hsl(var(--nx-cyan) / 0.5)' }}
              initial={{ width: 0 }}
              animate={{ width: `${sectorPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Special Operations: Endless (solo) + Co-op hub ── */}
      <div className="mb-4">
        <h2 className="nx-title text-[9px] mb-2" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.22em' }}>
          ◢ SPECIAL OPERATIONS
        </h2>
        <div className="space-y-2">
          {/* Endless Solo — unlocks on campaign completion */}
          <Link
            to={endlessLocked ? '#' : `/nexus/loadout/${ENDLESS_MISSION_ID}`}
            className={cn('block p-3 nx-clip-sm transition', endlessLocked ? 'opacity-60 pointer-events-none' : 'active:scale-[0.99]')}
            style={{
              background: endlessLocked ? 'linear-gradient(180deg, hsl(38 20% 9%), hsl(38 25% 6%))' : 'linear-gradient(180deg, hsl(38 50% 12%), hsl(38 60% 6%))',
              border: endlessLocked ? '1px dashed hsl(var(--nx-amber) / 0.35)' : '1px solid hsl(var(--nx-amber) / 0.5)',
              boxShadow: endlessLocked ? undefined : '0 0 14px -6px hsl(var(--nx-amber) / 0.45)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 nx-clip-sm flex items-center justify-center shrink-0"
                style={{ background: 'hsl(var(--nx-amber) / 0.18)', border: '1.5px solid hsl(var(--nx-amber))', color: 'hsl(var(--nx-amber))' }}>
                {endlessLocked ? <Lock className="w-4 h-4" /> : <InfinityIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black truncate">Endless Defense</div>
                <div className="nx-title text-[9px] mt-0.5" style={{ color: 'hsl(var(--nx-amber))' }}>
                  {endlessLocked ? 'LOCKED · COMPLETE THE CAMPAIGN' : 'SOLO · STANDALONE LEADERBOARD'}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/50 shrink-0" />
            </div>
          </Link>

          {/* Co-op Operation — unlocks after your first Endless run */}
          <Link
            to={coopLocked ? '#' : '/nexus/operation'}
            className={cn('block p-3 nx-clip-sm transition', coopLocked ? 'opacity-60 pointer-events-none' : 'active:scale-[0.99]')}
            style={{
              background: coopLocked
                ? 'linear-gradient(180deg, hsl(280 18% 9%), hsl(280 22% 6%))'
                : operation
                  ? 'linear-gradient(180deg, hsl(280 50% 14%), hsl(280 60% 8%))'
                  : 'linear-gradient(180deg, hsl(280 25% 10%), hsl(280 35% 6%))',
              border: coopLocked ? '1px dashed hsl(280 80% 65% / 0.3)' : operation ? '1px solid hsl(280 80% 65% / 0.5)' : '1px dashed hsl(280 80% 65% / 0.4)',
              boxShadow: !coopLocked && operation ? '0 0 14px -6px hsl(280 80% 60% / 0.5)' : undefined,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 nx-clip-sm flex items-center justify-center shrink-0"
                style={{ background: 'hsl(280 80% 65% / 0.18)', border: '1.5px solid hsl(280 80% 65%)', color: 'hsl(280 90% 80%)' }}>
                {coopLocked ? <Lock className="w-4 h-4" /> : <Users className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black truncate">Club Co-op Operation</div>
                <div className="nx-title text-[9px] mt-0.5" style={{ color: coopLocked ? 'hsl(280 70% 70% / 0.7)' : operation ? 'hsl(280 90% 78%)' : 'hsl(280 70% 70% / 0.7)' }}>
                  {coopLocked ? 'LOCKED · RUN ENDLESS TO UNLOCK' : operation ? `PHASE ${operation.current_phase} · ${operation.total_contributors} ALL${operation.total_contributors === 1 ? 'Y' : 'IES'}` : 'STANDBY · NO ACTIVE OP'}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/50 shrink-0" />
            </div>
          </Link>
        </div>
      </div>

      <h2 className="nx-title text-[9px] mb-2" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.22em' }}>
        ◢ CAMPAIGN MISSIONS
      </h2>
      <div className="space-y-2">
        {campaign.map((m, idx) => {
          const unlocked = m.id <= progress.highest_mission;
          const cleared = m.id < progress.highest_mission;
          const isCurrent = unlocked && !cleared;
          const briefing = getBriefing(m.id);
          const layout = getLayout(briefing?.layoutId);
          const accent = layout?.preview.accent ?? (m.isBoss ? 'hsl(350 85% 62%)' : 'hsl(var(--nx-cyan))');
          const showSector = idx === 0 || campaign[idx - 1].sector !== m.sector;

          return (
            <Fragment key={m.id}>
              {showSector && (
                <div className="flex items-center gap-2 pt-2 pb-0.5 first:pt-0">
                  <span className="nx-title text-[9px] whitespace-nowrap" style={{ color: 'hsl(var(--nx-cyan))', letterSpacing: '0.2em' }}>
                    ◢ {m.sector.toUpperCase()}
                  </span>
                  <span className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsl(var(--nx-cyan) / 0.4), transparent)' }} />
                </div>
              )}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Link
                to={unlocked ? `/nexus/loadout/${m.id}` : '#'}
                className={cn(
                  'block p-3 nx-clip-sm transition active:scale-[0.99] relative overflow-hidden',
                  !unlocked && 'opacity-50 pointer-events-none',
                )}
                style={{
                  background: m.isBoss && unlocked
                    ? 'radial-gradient(ellipse 60% 80% at 100% 0%, hsl(350 60% 22% / 0.5), transparent 60%), linear-gradient(180deg, hsl(350 50% 13%), hsl(350 60% 7%))'
                    : isCurrent
                      ? 'radial-gradient(ellipse 60% 80% at 100% 0%, ' + accent.replace(')', ' / 0.18)') + ', transparent 60%), linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))'
                      : 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
                  border: m.isBoss && unlocked
                    ? '1px solid hsl(350 85% 62% / 0.55)'
                    : isCurrent
                      ? `1px solid ${accent.replace(')', ' / 0.45)')}`
                      : unlocked
                        ? '1px solid hsl(0 0% 100% / 0.12)'
                        : '1px solid hsl(0 0% 100% / 0.06)',
                  boxShadow: isCurrent || (m.isBoss && unlocked)
                    ? `0 0 12px -6px ${accent.replace(')', ' / 0.5)')}`
                    : undefined,
                }}
              >
                {/* "CURRENT" badge for the in-progress mission */}
                {isCurrent && (
                  <span
                    className="absolute top-2 right-2 nx-title text-[8px] px-1.5 py-0.5"
                    style={{
                      color: accent,
                      background: accent.replace(')', ' / 0.16)'),
                      border: `1px solid ${accent.replace(')', ' / 0.4)')}`,
                      letterSpacing: '0.18em',
                    }}
                  >
                    ▲ CURRENT
                  </span>
                )}

                <div className="flex items-start gap-3">
                  {/* Layout preview thumbnail (or status badge if locked) */}
                  {layout && unlocked ? (
                    <div className="flex-shrink-0">
                      <MapLayoutPreview layout={layout} size="sm" pulse={isCurrent} />
                    </div>
                  ) : (
                    <div
                      className="w-14 h-14 nx-clip-sm flex items-center justify-center font-black text-sm flex-shrink-0"
                      style={{
                        background: cleared
                          ? 'hsl(150 80% 60% / 0.18)'
                          : unlocked
                            ? (m.isBoss ? 'hsl(350 85% 62% / 0.18)' : 'hsl(var(--nx-cyan) / 0.18)')
                            : 'hsl(0 0% 100% / 0.05)',
                        border: cleared
                          ? '1.5px solid hsl(150 80% 60%)'
                          : unlocked
                            ? (m.isBoss ? '1.5px solid hsl(350 85% 62%)' : '1.5px solid hsl(var(--nx-cyan))')
                            : '1px solid hsl(0 0% 100% / 0.1)',
                        color: cleared
                          ? 'hsl(150 80% 75%)'
                          : unlocked
                            ? (m.isBoss ? 'hsl(350 85% 78%)' : 'hsl(var(--nx-cyan))')
                            : 'hsl(0 0% 100% / 0.4)',
                      }}
                    >
                      {cleared ? <Check className="w-5 h-5" /> : !unlocked ? <Lock className="w-5 h-5" /> : m.isBoss ? <Skull className="w-5 h-5" /> : m.id}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="nx-title text-[8px]"
                        style={{
                          color: cleared ? 'hsl(150 80% 70%)' : accent.replace(')', ' / 0.85)'),
                          letterSpacing: '0.22em',
                        }}
                      >
                        {cleared ? '✓ CLEARED' : briefing?.codename ? `M${String(m.id).padStart(2, '0')} · ${briefing.codename}` : `MISSION ${String(m.id).padStart(2, '0')}`}
                      </span>
                      {m.isBoss && unlocked && (
                        <span
                          className="nx-title text-[7px] px-1 py-px"
                          style={{ color: 'hsl(350 85% 78%)', background: 'hsl(350 85% 62% / 0.18)', border: '1px solid hsl(350 85% 62% / 0.4)', letterSpacing: '0.18em' }}
                        >
                          BOSS
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black truncate mt-0.5">{m.name}</div>
                    {briefing?.tagline && unlocked && (
                      <p className="text-[10px] text-foreground/65 leading-snug mt-0.5 line-clamp-2">{briefing.tagline}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.5)', letterSpacing: '0.2em' }}>
                        {m.waves.length}W · {m.rewardCores}⚡
                      </span>
                      {briefing && unlocked && (
                        <DifficultyMini tier={briefing.difficulty} accent={accent} />
                      )}
                      {unlocked && (() => {
                        const mods = resolveModifiers(m.modifierIds);
                        if (mods.length === 0) return null;
                        return (
                          <div className="ml-auto flex items-center gap-0.5 shrink-0">
                            {mods.slice(0, 3).map(mod => {
                              const t = modifierTone(mod.tone);
                              return (
                                <span
                                  key={mod.id}
                                  title={`${mod.label} — ${mod.short}`}
                                  className="inline-flex items-center justify-center w-4 h-4 nx-clip-sm text-[9px] font-black"
                                  style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.fg }}
                                >
                                  {mod.glyph}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function DifficultyMini({ tier, accent }: { tier: number; accent: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Difficulty ${tier} of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-sm"
          style={{
            background: i <= tier ? accent : 'hsl(0 0% 100% / 0.12)',
          }}
        />
      ))}
    </div>
  );
}

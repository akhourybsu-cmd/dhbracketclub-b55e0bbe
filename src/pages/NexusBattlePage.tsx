import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { castAbility, initBattle, placeTower, sellTower, setTowerPriority, startWave, tick, TICK_MS, upgradeTower } from '@/lib/nexus/engine';
import { AbilityKind, BattleState, TargetMode, TowerKind } from '@/lib/nexus/types';
import { ABILITY_KINDS } from '@/lib/nexus/abilities';
import { TOWER_KINDS } from '@/lib/nexus/towers';
import { MISSIONS } from '@/lib/nexus/missions';

// Highest solo mission id — the unlock ceiling (dynamic, so adding sectors
// doesn't require touching the progression cap).
const MAX_SOLO_MISSION = Math.max(...MISSIONS.map(m => m.id));
import { NexusBattleScreen } from '@/components/nexus/NexusBattleScreen';
import { useAuth } from '@/contexts/AuthContext';
import { recordNexusRun, useNexusProgress } from '@/hooks/useNexusProgress';
import { useResolvedMission } from '@/hooks/useMissionCalibrations';
import { useNexusSfx } from '@/hooks/useNexusSfx';
import { resolveModifiers, modifierTone } from '@/lib/nexus/modifiers';
import { isEndlessMission, ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { submitOperationContribution } from '@/hooks/useNexusOperation';
import { usePendingBoost, consumeBoostForRun, awardEndlessRewards } from '@/hooks/useNexusRewards';
import { getBriefing } from '@/lib/nexus/missionBriefings';
import { getEnginePathVariant, type MapLayoutId } from '@/lib/nexus/mapLayouts';
import { getEndlessLayoutSelection } from '@/components/nexus/EndlessMapSelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { saveBattle, loadBattle, clearBattle, SAVE_THROTTLE_MS } from '@/lib/nexus/battlePersist';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function NexusBattlePage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { progress, updateProgress } = useNexusProgress();

  const id = parseInt(missionId || '1', 10);
  const { mission, enemyMods, loading: calLoading } = useResolvedMission(id);

  const abilities = useMemo<AbilityKind[]>(() => {
    const raw = params.get('abilities');
    if (!raw) return ['orbital', 'emp', 'overclock', 'repair'];
    return raw.split(',').filter(Boolean) as AbilityKind[];
  }, [params]);

  const { data: pendingBoost } = usePendingBoost();

  const [state, setState] = useState<BattleState | null>(null);
  // Initialise battle once mission is resolved. If we find a saved checkpoint
  // for this user+mission, resume from it (paused, so the player consents
  // before time starts again). Otherwise build a fresh BattleState.
  useEffect(() => {
    if (!mission || state) return;
    const saved = loadBattle(user?.id, mission.id);
    if (saved && saved.state.status !== 'victory' && saved.state.status !== 'defeat') {
      setState(saved.state);
      setPaused(true); // start paused so the player isn't blindsided
      // Surface a small confirmation that progress was restored.
      try { toast.message('Run restored — tap ▶ to resume'); } catch { /* optional UI feedback */ }
      return;
    }
    const boost = pendingBoost
      ? {
          code: pendingBoost.code,
          ...(pendingBoost.effect_config ?? {}),
        }
      : undefined;
    // Resolve which engine path variant this run uses. Endless honors the
    // player's saved map-selector choice; solo missions read their briefing's
    // assigned layout. Multi-spawn / multi-core layouts collapse to 'default'
    // inside getEnginePathVariant().
    const briefing = getBriefing(mission.id);
    const uiLayoutId: MapLayoutId | undefined =
      mission.id === ENDLESS_MISSION_ID
        ? getEndlessLayoutSelection()
        : briefing?.layoutId;
    const pathVariantId = getEnginePathVariant(uiLayoutId);
    setState(
      initBattle(mission.id, abilities, {
        mission,
        enemyHpMult: enemyMods.hpMult,
        enemyShieldMult: enemyMods.shieldMult,
        enemySpeedMult: enemyMods.speedMult,
        boost,
        pathVariantId,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission, pendingBoost]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [selectedKind, setSelectedKind] = useState<TowerKind | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1); // 1× / 2× / 3× fast-forward
  const [exitOpen, setExitOpen] = useState(false);
  const savedRef = useRef(false);
  const sfx = useNexusSfx();
  const [shakeKey, setShakeKey] = useState(0);
  const prevWaveIndexRef = useRef(-1);
  const prevStatusRef = useRef<BattleState['status']>('pre');
  const prevAbilityCdRef = useRef<Record<AbilityKind, number>>(
    Object.fromEntries(ABILITY_KINDS.map(k => [k, -1])) as Record<AbilityKind, number>,
  );
  const lastSaveAtRef = useRef(0);
  // Once a run is abandoned (or otherwise terminally cleared), suppress all
  // further checkpoint writes so the unmount/blur flush can't resurrect the
  // saved key we just deleted.
  const clearedRef = useRef(false);

  // Game loop
  useEffect(() => {
    if (!mission) return;
    const interval = setInterval(() => {
      const cur = stateRef.current;
      if (!cur || cur.status === 'victory' || cur.status === 'defeat' || paused || exitOpen) return;
      // Fast-forward runs multiple sim ticks per real interval (2×/3×), so the
      // simulation stays deterministic — we just advance it faster.
      let next = cur;
      for (let i = 0; i < speed; i++) {
        if (next.status === 'victory' || next.status === 'defeat') break;
        next = tick(next, mission);
      }
      stateRef.current = next;
      setState(next);
      // Throttled checkpoint so a tab-close keeps progress within ~1.5s.
      const now = Date.now();
      if (!clearedRef.current && now - lastSaveAtRef.current >= SAVE_THROTTLE_MS) {
        lastSaveAtRef.current = now;
        saveBattle(user?.id, mission.id, abilities, next);
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [mission, paused, exitOpen, user?.id, abilities, speed]);

  // Auto-pause + flush save when the tab is hidden, the window blurs, or the
  // page is being unloaded (mobile background, PWA close, navigation).
  useEffect(() => {
    if (!mission) return;
    const flush = () => {
      if (clearedRef.current) return;
      const cur = stateRef.current;
      if (cur) saveBattle(user?.id, mission.id, abilities, cur);
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        setPaused(true);
        flush();
      }
    };
    const onBlur = () => { setPaused(true); flush(); };
    const onPageHide = () => { flush(); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      // Also flush on unmount (route change) so navigating away mid-mission
      // doesn't lose the most recent few ticks.
      flush();
    };
  }, [mission, user?.id, abilities]);

  // Battle SFX/haptics: walk new engine events + react to status & wave transitions
  useEffect(() => {
    if (!state) return;
    sfx.consumeEvents(state.events);

    if (state.events.some(ev => ev.type === 'leak' || (ev.type === 'ability' && ev.ability === 'orbital'))) {
      setShakeKey(k => k + 1);
    }

    if (state.status === 'in_wave' && state.waveIndex !== prevWaveIndexRef.current) {
      if (prevWaveIndexRef.current >= 0) {
        sfx.play('wave.clear');
        window.setTimeout(() => sfx.play('wave.start'), 220);
      } else {
        sfx.play('wave.start');
      }
      prevWaveIndexRef.current = state.waveIndex;
    }

    if (state.status !== prevStatusRef.current) {
      if (state.status === 'victory') sfx.play('victory');
      else if (state.status === 'defeat') sfx.play('defeat');
      prevStatusRef.current = state.status;
    }

    for (const a of state.abilities) {
      const prev = prevAbilityCdRef.current[a.kind];
      if (prev > 0 && a.cooldownMs <= 0) sfx.play('ability.ready');
      prevAbilityCdRef.current[a.kind] = a.cooldownMs;
    }
  }, [state, sfx]);

  // End-of-run handling
  useEffect(() => {
    if (!state || !mission || savedRef.current) return;
    if (state.status === 'victory' || state.status === 'defeat') {
      savedRef.current = true;
      // Run is terminal — drop any in-flight checkpoint and lock out future saves.
      clearedRef.current = true;
      clearBattle(user?.id, mission.id);
      const won = state.status === 'victory';
      const endless = isEndlessMission(mission.id);
      // Endless co-op runs do not award solo cores or unlock missions.
      const cores = endless ? 0 : (won ? mission.rewardCores : Math.round(mission.rewardCores * 0.2));
      const newProgress: Partial<typeof progress> = {
        cores: progress.cores + cores,
      };
      if (!endless && won && mission.id >= progress.highest_mission) {
        // Cap one past the last mission so "campaign complete" is detectable
        // (clearing the finale pushes the pointer to MAX_SOLO_MISSION + 1).
        newProgress.highest_mission = Math.min(mission.id + 1, MAX_SOLO_MISSION + 1);
      }
      updateProgress(newProgress);

      const wavesCleared = won ? mission.waves.length : Math.max(0, state.waveIndex);
      const durationSeconds = Math.round(state.elapsedMs / 1000);

      // Use the engine's authoritative kill counter. Per-tower `kills` is
      // never incremented by the engine, so summing it always returned 0 —
      // which silently broke Operation Phase 1 progression.
      const totalKills = state.killedThisRun ?? 0;

      const finalize = async () => {
        let nexusRunId: string | null = null;
        if (user) {
          nexusRunId = await recordNexusRun({
            userId: user.id,
            missionId: mission.id,
            victory: won,
            score: state.score,
            wavesCleared,
            baseHpRemaining: state.baseHp,
            durationSeconds,
            loadout: { towers: TOWER_KINDS, abilities, modifierIds: state.modifierIds, boostCode: state.boostCode ?? null },
            failedWave: won ? null : state.waveIndex + 1,
            towerUsage: state.towerBuilds,
            towerUpgrades: state.towerUpgrades,
            towerSells: state.towerSells,
            abilityUsage: state.abilityUses,
            energyStarvedMs: state.energyStarvedMs,
            leaks: state.leaks,
            kills: totalKills,
          }).catch(() => null);
        }

        // Consume the boost (binds it to this run id) so award_endless_rewards
        // can read its salvageMult, and so it can't be reused on another run.
        if (user && state.boostCode && nexusRunId) {
          await consumeBoostForRun(nexusRunId).catch(() => null);
        }

        // Endless runs feed the active Operation. Even partial runs count.
        // We always stash *some* operation summary so the results panel
        // can explain to the user what happened (success, no active op,
        // op ended mid-flight, network error).
        type OpSummary = {
          operationId: string | null;
          pointsAwarded: number;
          phase: number;
          status: string;
          duplicate: boolean;
          error?: string;
          affectedPhase?: number;
          priorProgress?: number;
          newProgress?: number;
          priorTarget?: number;
          phaseAdvanced?: boolean;
          operationComplete?: boolean;
        };
        let opSummary: OpSummary | null = null;
        if (endless && user) {
          try {
            // nexus_operations ships through a newer migration than the
            // generated client schema currently bundled with this app.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: op } = await (supabase as any)
              .from('nexus_operations')
              .select('id')
              .eq('status', 'active')
              .order('started_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!op?.id) {
              opSummary = { operationId: null, pointsAwarded: 0, phase: 0, status: 'none', duplicate: false };
            } else {
              const res = await submitOperationContribution({
                operationId: op.id,
                nexusRunId: nexusRunId,
                kills: totalKills,
                score: state.score,
                waves: wavesCleared,
                bossDamage: state.bossDamageDealt ?? 0,
                durationSeconds,
              });
              if (res.ok) {
                opSummary = {
                  operationId: op.id,
                  pointsAwarded: res.pointsAwarded ?? 0,
                  phase: res.phase ?? 1,
                  status: res.status ?? 'active',
                  duplicate: !!res.duplicate,
                  affectedPhase: res.affectedPhase,
                  priorProgress: res.priorProgress,
                  newProgress: res.newProgress,
                  priorTarget: res.priorTarget,
                  phaseAdvanced: res.phaseAdvanced,
                  operationComplete: res.operationComplete,
                };
                if (res.operationComplete) {
                  toast.success('◆ Operation Complete — your run sealed it!');
                } else if (res.phaseAdvanced) {
                  toast.success(`Phase ${(res.affectedPhase ?? 1)} secured · +${res.pointsAwarded} pts`);
                } else if (!res.duplicate && (res.pointsAwarded ?? 0) > 0) {
                  toast.success(`+${res.pointsAwarded} Operation points`);
                }
              } else {
                opSummary = {
                  operationId: op.id, pointsAwarded: 0, phase: 0,
                  status: 'error', duplicate: false,
                  error: res.error ?? 'Submission rejected',
                };
                toast.message(res.error ?? 'Run did not count toward Operation');
              }
            }
          } catch (e: unknown) {
            opSummary = {
              operationId: null, pointsAwarded: 0, phase: 0,
              status: 'error', duplicate: false,
              error: e instanceof Error ? e.message : 'Network error',
            };
          }
        }

        // Endless milestone rewards (sigils + tokens for waves 10/20/30).
        let endlessRewards: { sigils: Array<{ code: string; first_time: boolean }>; tokens: number } | null = null;
        if (endless && user && nexusRunId && wavesCleared > 0) {
          endlessRewards = await awardEndlessRewards(nexusRunId, wavesCleared);
          if (endlessRewards && endlessRewards.tokens > 0) {
            const newSigils = endlessRewards.sigils.filter(s => s.first_time).length;
            if (newSigils > 0) toast.success(`+${endlessRewards.tokens}⬢ · ${newSigils} new sigil${newSigils > 1 ? 's' : ''}`);
            else toast.success(`+${endlessRewards.tokens}⬢ Salvage Tokens`);
          }
        }

        // Stash run insight for the results page (avoids URL bloat).
        try {
          sessionStorage.setItem(`nexus_run_${mission.id}`, JSON.stringify({
            towerBuilds: state.towerBuilds,
            towerUpgrades: state.towerUpgrades,
            towerSells: state.towerSells,
            abilityUses: state.abilityUses,
            energyStarvedMs: state.energyStarvedMs,
            leaks: state.leaks,
            durationSeconds,
            modifierIds: state.modifierIds,
            kills: totalKills,
            bossDamage: state.bossDamageDealt ?? 0,
            endless,
            operation: opSummary,
            boostCode: state.boostCode ?? null,
            endlessRewards,
          }));
        } catch { /* session storage is optional in private browsing */ }
      };

      finalize();

      const t = setTimeout(() => {
        navigate(`/nexus/results/${mission.id}?win=${won ? 1 : 0}&score=${state.score}&hp=${state.baseHp}&waves=${wavesCleared}&cores=${cores}`);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state?.status, mission, navigate, progress, updateProgress, user, abilities, state]);

  if (calLoading || !mission) {
    return <div className="p-6 text-center text-muted-foreground">{calLoading ? 'Loading mission…' : 'Mission not found.'}</div>;
  }
  if (!state) return <div className="p-6 text-center text-muted-foreground">Preparing battle…</div>;

  const handlePlace = (col: number, row: number) => {
    if (!selectedKind) return;
    const res = placeTower(state, selectedKind, col, row);
    if (!res.ok) {
      if (res.reason) toast.error(res.reason);
      sfx.play('invalid');
      return;
    }
    sfx.play('place');
    setState(res.state);
  };
  const handleUpgrade = (towerId: string) => {
    const res = upgradeTower(state, towerId);
    if (!res.ok) { if (res.reason) toast.error(res.reason); sfx.play('invalid'); return; }
    sfx.play('upgrade');
    setState(res.state);
  };
  const handleSell = (towerId: string) => {
    sfx.play('sell');
    setState(sellTower(state, towerId));
    setSelectedTowerId(null);
  };
  const handleAbility = (kind: AbilityKind) => {
    const res = castAbility(state, kind);
    if (res.ok) {
      // Engine event will also drive cast SFX — but firing immediately on tap
      // gives the action a snappier feel. consumeEvents throttling prevents
      // double-trigger because the same event timestamp won't be re-played.
      setState(res.state);
    } else {
      sfx.play('invalid');
    }
  };
  const handleStartWave = () => {
    // Wave-start sound is emitted by the status-watcher effect once the engine
    // flips into 'in_wave' on the next tick — keeps it consistent whether the
    // player taps "rush" or the timer auto-starts.
    setState(startWave(state, mission));
  };
  const handleSetPriority = (towerId: string, mode: TargetMode) => {
    sfx.play('place');
    setState(setTowerPriority(state, towerId, mode));
  };

  return (
    <div className="fixed inset-x-0 top-0 h-[100dvh] overflow-hidden bg-background flex flex-col z-30 overscroll-none">
      {/* Mission header — bracketed command frame */}
      <div
        className="nx-battle-page-header relative px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 w-full max-w-[960px] mx-auto"
        style={{
          background:
            'linear-gradient(180deg, hsl(218 60% 6% / 0.92), hsl(218 50% 4% / 0.4))',
        }}
      >
        <div className="flex items-stretch gap-2">
          {/* Left bracket: emblem / exit */}
          <button
            onClick={() => {
              if (state.status === 'victory' || state.status === 'defeat' || state.status === 'pre') {
                navigate('/nexus');
              } else {
                setExitOpen(true);
              }
            }}
            aria-label="Exit or abandon mission"
            className="relative w-14 h-12 nx-clip-sm flex flex-col items-center justify-center gap-0.5 active:scale-95 transition"
            style={{
              background: 'linear-gradient(180deg, hsl(0 60% 14%), hsl(0 65% 8%))',
              border: '1px solid hsl(0 80% 60% / 0.7)',
              boxShadow:
                '0 0 12px -2px hsl(0 80% 60% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.08)',
              color: 'hsl(0 90% 75%)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 4px hsl(0 80% 60%))' }}>
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M10 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="text-[8px] font-black tracking-[0.18em] leading-none" style={{ color: 'hsl(0 90% 80%)' }}>EXIT</span>
            <span aria-hidden className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-l border-t" style={{ borderColor: 'hsl(0 80% 60%)' }} />
            <span aria-hidden className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-r border-b" style={{ borderColor: 'hsl(0 80% 60%)' }} />

          </button>

          {/* Center frame: mission title */}
          <div
            className="relative flex-1 nx-clip-sm flex flex-col items-center justify-center px-3 py-1"
            style={{
              background:
                'linear-gradient(180deg, hsl(218 50% 9% / 0.95), hsl(218 55% 5% / 0.95))',
              border: '1px solid hsl(var(--nx-cyan) / 0.45)',
              boxShadow:
                '0 0 14px -2px hsl(var(--nx-cyan) / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.05)',
            }}
          >
            <span
              className="nx-title text-[9px] leading-none"
              style={{ color: 'hsl(var(--nx-cyan))', letterSpacing: '0.28em', textShadow: '0 0 6px hsl(var(--nx-cyan) / 0.6)' }}
            >
              MISSION {String(mission.id).padStart(2, '0')}
            </span>
            <span
              className="text-base font-black tracking-wide leading-tight mt-0.5 truncate"
              style={{ color: 'hsl(0 0% 98%)', letterSpacing: '0.06em', textShadow: '0 0 8px hsl(var(--nx-cyan) / 0.4)' }}
            >
              {mission.name.toUpperCase()}
            </span>
            <span aria-hidden className="absolute top-0.5 left-0.5 w-2 h-2 border-l border-t" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute top-0.5 right-0.5 w-2 h-2 border-r border-t" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute bottom-0.5 left-0.5 w-2 h-2 border-l border-b" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute bottom-0.5 right-0.5 w-2 h-2 border-r border-b" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
          </div>

          {/* Speed toggle: 1× / 2× / 3× fast-forward */}
          <button
            onClick={() => setSpeed(s => (s >= 3 ? 1 : s + 1))}
            aria-label={`Game speed ${speed}×`}
            className="relative w-12 h-12 nx-clip-sm flex flex-col items-center justify-center active:scale-95 transition"
            style={{
              background: speed > 1
                ? 'linear-gradient(180deg, hsl(38 90% 22%), hsl(38 95% 12%))'
                : 'linear-gradient(180deg, hsl(218 50% 11%), hsl(218 55% 7%))',
              border: `1px solid hsl(var(--nx-amber) / ${speed > 1 ? 0.8 : 0.4})`,
              boxShadow: speed > 1
                ? '0 0 12px -2px hsl(var(--nx-amber) / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.08)'
                : 'inset 0 1px 0 hsl(0 0% 100% / 0.06)',
              color: 'hsl(var(--nx-amber))',
            }}
          >
            <span className="text-sm font-black leading-none tabular-nums" style={{ filter: speed > 1 ? 'drop-shadow(0 0 4px hsl(var(--nx-amber)))' : undefined }}>{speed}×</span>
            <span className="nx-title text-[7px] mt-0.5" style={{ color: 'hsl(var(--nx-amber) / 0.7)', letterSpacing: '0.14em' }}>SPEED</span>
            <span aria-hidden className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-l border-t" style={{ borderColor: 'hsl(var(--nx-amber) / 0.7)' }} />
            <span aria-hidden className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-r border-b" style={{ borderColor: 'hsl(var(--nx-amber) / 0.7)' }} />
          </button>

          {/* Right bracket: pause */}
          <button
            onClick={() => setPaused(p => !p)}
            aria-label={paused ? 'Resume' : 'Pause'}
            className="relative w-12 h-12 nx-clip-sm flex items-center justify-center active:scale-95 transition"
            style={{
              background: 'linear-gradient(180deg, hsl(218 50% 11%), hsl(218 55% 7%))',
              border: '1px solid hsl(var(--nx-cyan) / 0.55)',
              boxShadow:
                '0 0 12px -2px hsl(var(--nx-cyan) / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.08)',
              color: 'hsl(var(--nx-cyan))',
            }}
          >
            {paused ? (
              <span className="text-base font-black" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--nx-cyan)))' }}>▶</span>
            ) : (
              <div className="flex gap-[3px]">
                <span className="block w-[3px] h-4 rounded-sm" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
                <span className="block w-[3px] h-4 rounded-sm" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
              </div>
            )}
            <span aria-hidden className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-l border-t" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
            <span aria-hidden className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-r border-b" style={{ borderColor: 'hsl(var(--nx-cyan))' }} />
          </button>
        </div>

        {/* Modifier intel strip — compact, scrollable on mobile */}
        {(() => {
          const mods = resolveModifiers(mission.modifierIds);
          if (mods.length === 0) return null;
          return (
            <div
              className="nx-mission-modifiers mt-1.5 -mx-1 px-1 flex items-center gap-1 overflow-x-auto"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
              aria-label="Mission modifiers"
            >
              {mods.map(mod => {
                const t = modifierTone(mod.tone);
                return (
                  <div
                    key={mod.id}
                    className="shrink-0 inline-flex items-center gap-1 px-1.5 py-[3px] nx-clip-sm leading-none"
                    style={{ background: t.bg, border: `1px solid ${t.border}` }}
                    title={`${mod.label} — ${mod.description}`}
                  >
                    <span className="font-black" style={{ color: t.fg, fontSize: 10, lineHeight: 1 }}>{mod.glyph}</span>
                    <span className="nx-title text-[8px] font-black" style={{ color: t.fg, letterSpacing: '0.16em' }}>
                      {mod.label.toUpperCase()}
                    </span>
                    <span className="text-[8px] font-medium" style={{ color: 'hsl(0 0% 100% / 0.7)' }}>
                      · {mod.short}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      <motion.div
        key={`shake-${shakeKey}`}
        initial={shakeKey === 0 ? false : { x: 0 }}
        animate={shakeKey === 0 ? undefined : { x: [0, -6, 5, -3, 2, 0] }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex-1 min-h-0"
      >
        <NexusBattleScreen
          state={state}
          mission={mission}
          selectedTowerKind={selectedKind}
          selectedTowerId={selectedTowerId}
          onSelectKind={setSelectedKind}
          onPlace={handlePlace}
          onSelectTower={setSelectedTowerId}
          onUpgrade={handleUpgrade}
          onSell={handleSell}
          onSetPriority={handleSetPriority}
          onCastAbility={handleAbility}
          onStartWave={handleStartWave}
        />
      </motion.div>

      {paused && (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center">
            <div className="text-3xl font-black text-emerald-400 mb-3">PAUSED</div>
            <button onClick={() => setPaused(false)} className="px-6 py-2 rounded-full bg-emerald-500 text-emerald-950 font-bold">Resume</button>
          </motion.div>
        </div>
      )}

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent className="max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Abandon mission?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current run will be discarded. Closing the tab or backgrounding
              the app instead keeps your progress — you'll resume right where you left off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearedRef.current = true;
                if (mission) clearBattle(user?.id, mission.id);
                navigate('/nexus');
              }}
              className="bg-rose-500 text-rose-950 hover:bg-rose-400"
            >
              Abandon
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

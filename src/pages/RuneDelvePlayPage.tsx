import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, HelpCircle, Trophy, Skull, Hourglass, Sparkles as SparklesIcon } from 'lucide-react';
import { useRuneDelveHero, useUpdateHero } from '@/hooks/useRuneDelveHero';
import { useAllClassProgress, useUpdateClassProgress } from '@/hooks/useRuneDelveClassProgress';
import { useLevel, useMyLevelRun, useSubmitLevelRun, useAdvanceProgress, useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { mulberry32 } from '@/lib/runedelve/prng';
import { generateBoard, type RuneType, type Enemy } from '@/lib/runedelve/dungeonGenerator';
import { isValidChain, resolveBoard, type Cell } from '@/lib/runedelve/boardEngine';
import { applyChain, enemiesAttack, endTurn, initialCombat, redChainDamage, useAbility as activateAbility, type CombatState } from '@/lib/runedelve/combatEngine';
import { calculateScore, xpForRun } from '@/lib/runedelve/scoring';
import { evaluateObjective, getObjectiveProgress } from '@/lib/runedelve/objectives';
import { levelFromXp, newTitleUnlocked, titleForLevel } from '@/lib/runedelve/classConfig';
import { useLoadout } from '@/hooks/useLoadout';
import { useEarnShards, useFailureRow, useBumpFailure, useResetFailure, useRuneWallet, useUnlockSlot } from '@/hooks/useRuneShards';
import { useRecordDefeats } from '@/hooks/useBestiary';
import { rosterById, ENEMY_ROSTER } from '@/lib/runedelve/enemyRoster';
import { spawnWave } from '@/lib/runedelve/combatEngine';
import { useRelicCollection, rankMapFromOwned } from '@/hooks/useRelicCollection';
import {
  buildActive,
  getStartingMana,
  getStartingShieldTurns,
  has,
  onEnemyKilled,
  tryLastStand,
  computeChainMods,
  abilityFreeFirstUse,
  shrineWardTurn1Mult,
  bossRuleSoften,
  momentumScoreBonusMult,
  compassShardBonus,
  getTelegraphReadyEarly,
  getSealedTilesSpeedup,
  thornsRelicMultiplier,
  getForeseerBonusTurns,
  getVoidPactHpCost,
  tryPhoenixHeart,
  type ActiveRelics,
} from '@/lib/runedelve/relicEffects';
import { MAX_MANA } from '@/lib/runedelve/combatEngine';
import { computeClearShards, computeFailureShards, slotsForClassLevels } from '@/lib/runedelve/shardEconomy';

import { objectiveLabel, type ObjectiveType } from '@/lib/runedelve/levelGenerator';
import {
  mechanicsForLevel,
  introMechanicForLevel,
  seenMechanicKey,
  type MechanicId,
} from '@/lib/runedelve/mechanics';
import { buildInitialSeals, sealsBrokenByChain } from '@/lib/runedelve/sealedTiles';
import {
  computeLayoutZones, countChainInZone, EMPTY_ZONES,
  TREASURE_SCORE_BONUS, TREASURE_SHARD_BONUS,
  HAZARD_DAMAGE, HAZARD_MAX_DAMAGE_PER_CHAIN,
} from '@/lib/runedelve/layoutZones';
import { getLayoutIdForLevel } from '@/lib/runedelve/chamberAssignment';
import { getLayout } from '@/lib/runedelve/runeLayouts';
import { ChamberBackdrop } from '@/components/runedelve/ChamberBackdrop';
import {
  type RunModifier, pickModifierOffer, resolveEffect, getModifierById, STEADY_PATH,
} from '@/lib/runedelve/runModifiers';
import { RunModifierPicker } from '@/components/runedelve/RunModifierPicker';
import { todayUtcDateString } from '@/lib/runedelve/dailyChallenge';
import { markDailyChamberPlayed } from '@/lib/runedelve/dailyChamber';
import { rollRelicDrop } from '@/lib/runedelve/relicDrops';
import type { RelicDef } from '@/lib/runedelve/relics';
import { useUnlockRelic } from '@/hooks/useRelicCollection';
import { getPathVariant, resolvePathEffect } from '@/lib/runedelve/pathVariants';
import {
  detectPhaseTransitions, applyPhaseDamageBump,
  type BossPhaseIndex,
} from '@/lib/runedelve/bossPhases';
import { applyInitialIntents } from '@/lib/runedelve/telegraph';
import {
  buildInitialCorruption,
  spreadCorruption,
  resolveChainAgainstCorruption,
  emptyCorruption,
  type CorruptionState,
} from '@/lib/runedelve/corruptedTiles';
import { buildInitialShift, applyShift, type ShiftState } from '@/lib/runedelve/shiftingRunes';
import { buildInitialPairs, pairsTriggeredByChain, consumePairs, type LinkedPairsState } from '@/lib/runedelve/linkedPairs';
import { buildInitialEclipse, type EclipseSet } from '@/lib/runedelve/eclipseTiles';
import { secondaryMet, secondaryShort, secondaryLabel, type SecondaryObjective } from '@/lib/runedelve/layeredGoals';
import { getBossRule, filterTargetable, type BossRuleId } from '@/lib/runedelve/bossRules';
import { useSubmitDailyRun } from '@/hooks/useDailyChallenge';
import { useReportQuestProgress } from '@/hooks/useQuests';
import {
  dailyDamageMultiplier,
  dailyMaxHpMultiplier,
  dailyHpDrainPerTurn,
  dailyChainCap,
  dailyManaRefundPerChain,
  dailyTurnLimitDelta,
  dailyShardMultiplier,
  dailyEnemyHpMultiplier,
  dailyIroncladDamageMult,
  dailyReflectivePct,
  dailyHidesForesight,
} from '@/lib/runedelve/dailyModifierEffects';
// NOTE: Daily challenge is now Endless Survival (separate page). Campaign
// play never enters daily mode — `isDailyMode` is always false here.
import { getActiveMasteries, masteryUnlockedAt } from '@/lib/runedelve/classMastery';
import {
  getMasteryStartingMana,
  getMasteryAbilityManaCost,
  getMasteryChainDamageMult,
  isLastStandActive,
  getMasteryBlueChainHeal,
  getMasteryShardsPerChain,
  getMasteryOpeningHeal,
  getMasteryShieldBonus,
  shouldMasteryRefundMana,
  getMasteryHpPerChapter,
  getMasteryGoldScoreBonus,
  getMasteryOpeningCritMult,
  getMasteryChainCritChance,
  hasMasteryAegis,
  hasMasteryPanicShield,
  reviveBurstActive,
} from '@/lib/runedelve/masteryEffects';
import { chapterFor } from '@/lib/runedelve/levelGenerator';
import { Crown, Target } from 'lucide-react';
import { RuneBoard } from '@/components/runedelve/RuneBoard';
import { EnemyDisplay } from '@/components/runedelve/EnemyDisplay';
import { HeroStatusBar } from '@/components/runedelve/HeroStatusBar';
import { HowToPlaySheet } from '@/components/runedelve/HowToPlaySheet';
import { MechanicIntroSheet } from '@/components/runedelve/MechanicIntroSheet';
import { MechanicBanner } from '@/components/runedelve/MechanicBanner';
import { CombatLog, type CombatLogEntry } from '@/components/runedelve/CombatLog';
import { FxLayer } from '@/components/runedelve/fx/FxLayer';
import { useFxQueue, type FxRect } from '@/hooks/useFxQueue';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { useRuneDelveSfx } from '@/hooks/useRuneDelveSfx';
import { FloatingNumberLayer, useFloaters } from '@/components/runedelve/fx/FloatingNumber';
import { ScreenEdgeFlash } from '@/components/runedelve/fx/ScreenEdgeFlash';
import { PhaseTransitionFlash } from '@/components/runedelve/fx/PhaseTransitionFlash';
import { HeavyStrikeBanner } from '@/components/runedelve/fx/HeavyStrikeBanner';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildSnapshot,
  clearSnapshot,
  loadSnapshot,
  rehydrateRelics,
  saveSnapshot,
  snapshotKey,
} from '@/lib/runedelve/runSnapshot';
import { format } from 'date-fns';

const RUNE_LABEL: Record<RuneType, string> = {
  red: 'Crimson',
  blue: 'Azure',
  green: 'Verdant',
  gold: 'Radiant',
};

// Module-level monotonic counter for log entry IDs. Stable, sortable, and
// avoids a Math.random() inside every setState updater.
let logSeq = 0;
const nextLogId = () => `l-${++logSeq}`;

export default function RuneDelvePlayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { levelNumber: levelParam } = useParams<{ levelNumber: string }>();
  const [searchParams] = useSearchParams();
  // Daily challenge is now Endless Survival (separate page). Campaign play
  // never enters daily mode — these stubs keep the legacy code paths inert.
  const isDailyMode = false;
  const submitDaily = useSubmitDailyRun();
  const reportQuestProgress = useReportQuestProgress();
  const levelNumber = Math.max(1, parseInt(levelParam ?? '1', 10) || 1);
  const dailyMods: never[] = [];

  const { user } = useAuth();
  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress();
  const { data: level } = useLevel(levelNumber);
  const { data: existingRun } = useMyLevelRun(level?.id);
  const { data: classTracks } = useAllClassProgress();
  const submit = useSubmitLevelRun();
  const advance = useAdvanceProgress();
  const updateHero = useUpdateHero();
  const updateClass = useUpdateClassProgress();
  const { data: loadout } = useLoadout(hero?.class);
  const { data: ownedRelics } = useRelicCollection();
  const unlockRelic = useUnlockRelic();
  // R7: a relic dropped on this clear (if any). Surfaced in the
  // endState card so the player sees the find.
  const [droppedRelic, setDroppedRelic] = useState<RelicDef | null>(null);
  // R5: per-enemy boss phase tracker. Bosses + mini-bosses progress
  // through phases as their HP drops; the map records the highest
  // phase each enemy has entered so we can detect new transitions
  // on every state change without re-firing past ones.
  const bossPhasesRef = useRef<Map<string, BossPhaseIndex>>(new Map());
  const { data: wallet } = useRuneWallet();
  const { data: failureRow } = useFailureRow(level?.level_number ?? null);
  const earnShards = useEarnShards();
  const recordDefeats = useRecordDefeats();
  const bumpFailure = useBumpFailure();
  const resetFailure = useResetFailure();
  const unlockSlot = useUnlockSlot();

  const [grid, setGrid] = useState<RuneType[][] | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [seals, setSeals] = useState<Set<string>>(new Set());
  const [rngTick, setRngTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [introMechanic, setIntroMechanic] = useState<MechanicId | null>(null);
  const [introBossRule, setIntroBossRule] = useState<BossRuleId | null>(null);
  const [endState, setEndState] = useState<null | { cleared: boolean; reason: 'cleared' | 'defeated' | 'timeout'; score: number; isNewBest: boolean; shards: number; improvedChain?: boolean; improvedTurns?: boolean; improvedHp?: boolean; firstClear?: boolean }>(null);
  // Counter (not boolean) — Last Stand at R5 grants 2 saves per run.
  const [lastStandUsed, setLastStandUsed] = useState(0);
  // Phoenix Heart — single-use full revive per run, separate from Last Stand.
  const [phoenixUsed, setPhoenixUsed] = useState(false);
  // Bonus-move rebalance: only one free turn per enemy cycle. Resets whenever
  // the enemy phase actually runs (i.e. a non-bonus chain or ability resolves).
  const [bonusUsedThisCycle, setBonusUsedThisCycle] = useState(false);
  const [corruption, setCorruption] = useState<CorruptionState>(emptyCorruption);
  const [shift, setShift] = useState<ShiftState>({ column: -1 });
  const [linkedPairs, setLinkedPairs] = useState<LinkedPairsState>({ pairs: new Map() });
  const [eclipse, setEclipse] = useState<EclipseSet>(new Set());
  const [log, setLog] = useState<CombatLogEntry[]>([]);
  // First-chain-of-fight detection for cleric mastery.
  const [chainsThisFight, setChainsThisFight] = useState(0);
  const [bonusShardsFromMastery, setBonusShardsFromMastery] = useState(0);
  // Chamber-layout zones (R1 wire-up). Tracked per-run; reset alongside
  // bonusShardsFromMastery on run-init.
  const [bonusScoreFromTreasure, setBonusScoreFromTreasure] = useState(0);
  const [bonusShardsFromTreasure, setBonusShardsFromTreasure] = useState(0);
  // Run modifier (R3). `activeModifier` is what's applied to this run;
  // `modifierOffer` is the 3 cards currently shown in the picker.
  // Both clear on run-init so each chamber gets a fresh offer.
  const [activeModifier, setActiveModifier] = useState<RunModifier | null>(null);
  const [modifierOffer, setModifierOffer] = useState<RunModifier[] | null>(null);
  // Track lifetime mana spent for Mage Overflow mastery refund cadence.
  const [totalManaSpent, setTotalManaSpent] = useState(0);
  // Rogue T1 Gilded Eye — count gold runes cleared across the run.
  const [goldRunesCleared, setGoldRunesCleared] = useState(0);
  // Warrior T4 Brace + Cleric T5 Aegis are one-shot per run. Refs avoid
  // re-render churn — they're read inside event handlers, never in JSX.
  const braceFiredRef = useRef(false);
  const aegisFiredRef = useRef(false);
  // Actual initial turn budget for THIS run (after Foreseer's Lens / daily /
  // run-modifier turn deltas). Shrine Ward's turn-1 check compares against this
  // — comparing against level.turn_limit broke whenever any turn modifier was
  // active (which is nearly every run). -1 on resume so it never fires post-resume.
  const initialTurnsRef = useRef(-1);
  // True once the hero has lost HP at any point this run — powers the honest
  // "no-damage clear" quest (end-of-run full HP alone doesn't prove it, since
  // green chains / lifesteal can heal back what was lost).
  const tookDamageRef = useRef(false);

  // Per-run defeat ledger keyed by archetypeId. Submitted to the Bestiary on
  // run-end. Mini-boss / boss kills get tracked under variant ids
  // (e.g. `goblin_scout__mini`, `goblin_scout__boss`) so the journal records
  // them as distinct silhouetted entries with elevated borders.
  const defeatedArchetypesRef = useRef<Map<string, number>>(new Map());
  const recordKill = (enemy: { archetypeId?: string; tier?: 'mini' | 'boss' } | undefined) => {
    if (!enemy?.archetypeId) return;
    const id = enemy.tier
      ? `${enemy.archetypeId}__${enemy.tier}`
      : enemy.archetypeId;
    const m = defeatedArchetypesRef.current;
    m.set(id, (m.get(id) ?? 0) + 1);
  };
  // Tracks how many reinforcement waves have spawned this run so we never
  // double-spawn the same wave when the player clears multiple enemies in a turn.
  const wavesSpawnedRef = useRef(0);

  // Per-run relic-effect counters (drive Ember Edge / Crimson Tide / Quickstep /
  // First Light / Cleansing Touch / Shrine Ward turn-1 detection).
  const [redChainCount, setRedChainCount] = useState(0);
  const [chainCountTotal, setChainCountTotal] = useState(0);
  const [abilityUsedCount, setAbilityUsedCount] = useState(0);
  const [corruptCleansedCount, setCorruptCleansedCount] = useState(0);
  // Snapshot the active relic loadout at run-start so toggling/upgrading
  // relics mid-run can never reset the board state.
  const [activeRelicsSnapshot, setActiveRelicsSnapshot] = useState<ActiveRelics | null>(null);

  // Append a single entry; trim to a small ring so memory stays tidy.
  const pushLog = (entry: Omit<CombatLogEntry, 'id'>) => {
    setLog(prev => {
      const next = [...prev, { ...entry, id: nextLogId() }];
      return next.length > 30 ? next.slice(-30) : next;
    });
  };
  const pushLogs = (entries: Array<Omit<CombatLogEntry, 'id'>>) => {
    if (!entries.length) return;
    setLog(prev => {
      const stamped = entries.map(e => ({ ...e, id: nextLogId() }));
      const next = [...prev, ...stamped];
      return next.length > 30 ? next.slice(-30) : next;
    });
  };

  // FX overlay queue — purely visual feedback for chains and abilities.
  const fxQ = useFxQueue();
  const { play: playSound } = useSoundEffect();
  const { play: rdSfx } = useRuneDelveSfx();
  const floaters = useFloaters();
  const [hurtFlashKey, setHurtFlashKey] = useState(0);
  const [healFlashKey, setHealFlashKey] = useState(0);
  // V1 visual overhaul:
  //   heavyFlashKey  — gold screen-edge flash on chain ≥ 6
  //   heavyChainLen  — chain length to render in the HeavyStrikeBanner
  //   phaseFlashKey  — R5 boss phase cinematic, paired with the
  //                    transition's metadata so the chyron shows the
  //                    boss name + flavor line
  const [heavyFlashKey, setHeavyFlashKey] = useState(0);
  const [heavyChainLen, setHeavyChainLen] = useState(6);
  const [phaseFlashKey, setPhaseFlashKey] = useState(0);
  const [phaseFlashMeta, setPhaseFlashMeta] = useState<{ phase: 2 | 3; bossName: string; flavor: string }>({
    phase: 2,
    bossName: '',
    flavor: '',
  });
  const playRootRef = useRef<HTMLDivElement>(null);
  const rectFromEl = (el: Element | null): FxRect | undefined => {
    if (!el) return undefined;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const findEnemyRect = (id: string): FxRect | undefined =>
    rectFromEl(playRootRef.current?.querySelector(`[data-enemy-id="${id}"]`) ?? null);
  const findHudRect = (target: 'hp' | 'mana' | 'shield'): FxRect | undefined =>
    rectFromEl(playRootRef.current?.querySelector(`[data-fx-target="${target}"]`) ?? null);

  // Trigger a brief CSS-driven camera shake on the play root. Cleans up
  // any pending timer so rapid red chains don't stack the animation.
  const shakeTimerRef = useRef<number | null>(null);
  const triggerCamShake = (amount = 6) => {
    const el = playRootRef.current;
    if (!el) return;
    el.style.setProperty('--rd-cam-shake-x', `${amount}px`);
    el.style.setProperty('--rd-cam-shake-y', `${Math.round(amount * 0.6)}px`);
    el.classList.remove('rd-cam-shake');
    // Force reflow so the animation restarts cleanly.
    void el.offsetWidth;
    el.classList.add('rd-cam-shake');
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => {
      el.classList.remove('rd-cam-shake');
    }, 240);
  };

  // Pulse the HP bar's inner glow (Lifebloom arrival cue).
  const pulseHpGlow = () => {
    const el = playRootRef.current?.querySelector('[data-fx-hp-glow-target]') as HTMLElement | null;
    if (!el) return;
    el.setAttribute('data-fx-hp-glow', 'on');
    window.setTimeout(() => el.removeAttribute('data-fx-hp-glow'), 620);
  };


  // Active relic loadout for this run (rank-aware).
  const activeRelics = useMemo(() => {
    const ranks = rankMapFromOwned(ownedRelics);
    return buildActive([loadout?.slot_1, loadout?.slot_2, loadout?.slot_3], ranks);
  }, [loadout, ownedRelics]);

  // Resolve mechanics for this level. Prefer the persisted row, fall back
  // to the deterministic helper so legacy/transient rows still work.
  const activeMechanics = useMemo<MechanicId[]>(() => {
    const stored = (level?.modifiers as any)?.mechanics as MechanicId[] | undefined;
    if (stored?.length) return stored;
    return level ? mechanicsForLevel(level.level_number) : [];
  }, [level]);

  // R2: path variant from the milestone picker (?pathVariant=…).
  // Resolved once per mount; effects threaded through init, chain
  // resolve, finalize, and the layout zone derivation below.
  const pathVariant = useMemo(
    () => getPathVariant(searchParams.get('pathVariant')),
    [searchParams],
  );
  const pathEffect = useMemo(() => resolvePathEffect(pathVariant), [pathVariant]);

  // The active chamber layout for this run. Drives both the R1 zone
  // computation (treasure/hazard cells) and the V5 atmospheric
  // backdrop. Path variant can override which layout is rendered
  // (e.g. Treasure Path forces the Cursed Vault chamber).
  const activeLayout = useMemo(() => {
    if (!level) return null;
    const layoutId = pathEffect.layoutOverride || getLayoutIdForLevel(level.level_number);
    return getLayout(layoutId) ?? null;
  }, [level, pathEffect.layoutOverride]);

  // Chamber layout zones — treasure/hazard cells derived from the
  // chamber assigned to this level. Treasure cells in a chain pay
  // bonus score + shards; hazard cells cost HP. Deterministic per
  // (level number, seed) so replays show the same layout.
  const layoutZones = useMemo(() => {
    if (!level || !activeLayout) return EMPTY_ZONES;
    return computeLayoutZones(activeLayout.id, level.generation_seed);
  }, [level, activeLayout]);
  const sealedTilesActive = activeMechanics.includes('sealed_tiles');
  const telegraphActive = activeMechanics.includes('telegraphed_attacks');
  const corruptionActive = activeMechanics.includes('corrupted_tiles');
  const shiftingActive = activeMechanics.includes('shifting_runes');
  const linkedPairsActive = activeMechanics.includes('linked_pairs');
  const eclipseActive = activeMechanics.includes('eclipse_tiles');
  const secondaryObjective = ((level?.modifiers as any)?.secondary_objective ?? null) as SecondaryObjective | null;
  const bossRule = ((level?.modifiers as any)?.boss_rule ?? null) as BossRuleId | null;
  const waveDefs = ((level?.modifiers as any)?.waves ?? null) as Array<{ enemies: any[]; reinforcement_turns: number }> | null;

  // Active mastery ids for the hero's class (computed once per render —
  // class level is stable per run since XP only awards on completion).
  const activeMasteries = useMemo(() => {
    if (!hero) return [];
    const lvl = (classTracks ?? []).find(t => t.class === hero.class)?.level ?? hero.level ?? 1;
    return getActiveMasteries(hero.class, lvl);
  }, [hero, classTracks]);

  // Mana orbs needed to cast the class ability. Mage T4 "Deep Reserve" drops
  // it 3 → 2. Used by handleAbility (gate + FX + spend accounting) and the
  // HeroStatusBar (ready-state threshold) so both agree.
  const abilityManaCost = useMemo(
    () => getMasteryAbilityManaCost(activeMasteries, MAX_MANA),
    [activeMasteries],
  );

  // Per-run snapshot key (scoped to user + level so swapping levels or users
  // can never bleed in stale state).
  const runKey = useMemo(() => {
    if (!user?.id || !level?.id) return null;
    if (level.id.startsWith('transient-')) return null;
    return snapshotKey(user.id, level.id);
  }, [user?.id, level?.id]);

  // Build deterministic state. Snapshots `activeRelics` once at run-start so
  // mid-run relic toggles or rank changes can never reset the board.
  // ALSO: prefer rehydrating an in-progress run from sessionStorage so
  // backgrounding the WebView (iOS PWA) doesn't wipe player progress.
  useEffect(() => {
    if (!level || !hero) return;
    const relics = activeRelics; // snapshot

    // ── Rehydrate path ──────────────────────────────────────────────────
    if (runKey) {
      const snap = loadSnapshot(runKey, level.generation_seed);
      // Only restore mid-run snapshots — if HP is 0 or no turns remain we
      // bail to fresh-board so the run actually ends rather than locking
      // the player on a defeated screen.
      if (snap && snap.combat.hp > 0 && snap.combat.turnsRemaining > 0) {
        setGrid(snap.grid);
        setCombat(snap.combat);
        setSeals(new Set(snap.seals));
        setCorruption({
          cells: new Set(snap.corruption.cells),
          sources: new Set(snap.corruption.sources),
        });
        setLog(snap.log);
        setLastStandUsed(snap.lastStandUsed);
        setPhoenixUsed(snap.phoenixUsed ?? false);
        setBonusUsedThisCycle(snap.bonusUsedThisCycle);
        setRedChainCount(snap.redChainCount);
        setChainCountTotal(snap.chainCountTotal);
        setAbilityUsedCount(snap.abilityUsedCount);
        setCorruptCleansedCount(snap.corruptCleansedCount);
        setRngTick(snap.rngTick);
        setActiveRelicsSnapshot(rehydrateRelics(snap.activeRelicsSnapshot) ?? relics);
        defeatedArchetypesRef.current = new Map(snap.defeatedArchetypes);
        wavesSpawnedRef.current = snap.wavesSpawned;
        // R3: rehydrate the modifier from snapshot. Pre-R3 snapshots
        // have no activeModifierId — getModifierById returns null in
        // that case, which the engine treats as Steady Path.
        setActiveModifier(getModifierById(snap.activeModifierId));
        setModifierOffer(null); // never re-show the picker on a resume
        // Restore the real opening budget so turn counts, survive goals, and
        // speed bonuses remain accurate after an iOS/Android background resume.
        initialTurnsRef.current = snap.initialTurns
          ?? Math.max(level.turn_limit, snap.combat.turnsRemaining);
        // Can't prove a resumed run was damage-free — disqualify conservatively.
        tookDamageRef.current = true;
        const turnNow = Math.max(1, initialTurnsRef.current - snap.combat.turnsRemaining + 1);
        toast(`↩️ Resumed your run (Turn ${turnNow} of ${initialTurnsRef.current})`, { duration: 2200 });
        return;
      }
    }

    // ── Fresh-board path (existing behavior) ────────────────────────────
    const rng = mulberry32(level.generation_seed);
    setGrid(generateBoard(rng));
    let initialSeals = buildInitialSeals(level.generation_seed, sealedTilesActive);
    // Keysight: pre-shatter the requested number of seals at run start so
    // the player effectively gets a head-start clearing them.
    const keysightTurns = getSealedTilesSpeedup(relics);
    if (keysightTurns > 0 && initialSeals.size > 0) {
      const keys = Array.from(initialSeals).slice(0, keysightTurns);
      const next = new Set(initialSeals);
      keys.forEach(k => next.delete(k));
      initialSeals = next;
    }
    setSeals(initialSeals);
    setCorruption(buildInitialCorruption(level.generation_seed, corruptionActive, level.level_number, initialSeals));
    setShift(buildInitialShift(level.generation_seed, shiftingActive));
    setLinkedPairs(buildInitialPairs(level.generation_seed, linkedPairsActive, initialSeals));
    setEclipse(buildInitialEclipse(level.generation_seed, eclipseActive, initialSeals));
    setChainsThisFight(0);
    setBonusShardsFromMastery(0);
    setBonusScoreFromTreasure(0);
    setBonusShardsFromTreasure(0);
    // R5: reset boss-phase tracker on every run-init path (fresh OR
    // snapshot rehydrate). Snapshot rehydrate re-derives current phase
    // lazily on the first transition check using the restored HP, so
    // resuming a backgrounded run picks up the correct boss state.
    bossPhasesRef.current = new Map();
    setTotalManaSpent(0);
    // Name → archetype-id fallback for legacy levels seeded before the roster system.
    const resolveArchetype = (e: any): string | undefined => {
      if (e.archetypeId) return e.archetypeId;
      const raw = String(e.name ?? '').replace(/^(Elite |Boss |Mini-Boss |Echo of )/, '').trim().toLowerCase();
      if (!raw) return undefined;
      const hit = ENEMY_ROSTER.find(a => a.name.toLowerCase() === raw);
      if (hit) return hit.id;
      // Common legacy aliases.
      if (raw === 'slime') return 'ember_slime';
      if (raw === 'skeleton') return 'skeleton_warrior';
      return undefined;
    };
    let enemies: Enemy[] = (level.enemy_config ?? []).map((e: any, i: number) => ({
      id: e.id ?? `e${i}`, name: e.name, emoji: e.emoji, hp: e.hp, maxHp: e.maxHp ?? e.hp, damage: e.damage,
      archetypeId: resolveArchetype(e), family: e.family, role: e.role,
      ability: e.ability, abilityCooldown: e.abilityCooldown, abilityCooldownMax: e.abilityCooldownMax ?? e.abilityCooldown,
      telegraphLabel: e.telegraphLabel, tier: e.tier,
    }));
    // Daily Fogged suppresses all foresight-style effects (Foreseer's Lens
    // turn bonus + telegraph early-reveal + spawn previews are hidden).
    const foggedActive = isDailyMode && dailyHidesForesight(dailyMods);
    if (telegraphActive) {
      enemies = applyInitialIntents(enemies, level.generation_seed, level.level_number);
      // Foresight: extend every heavy-strike fuse by N turns so the player
      // gets more warning + more time to kill the telegraphing enemy before it
      // unleashes. Raising `intentMax` too means the longer fuse persists after
      // each strike resets. (Previously this LOWERED the countdown, which made
      // heavies land SOONER — a strict downgrade for a 350-shard relic.)
      // Suppressed under Fogged.
      const earlyTurns = foggedActive ? 0 : getTelegraphReadyEarly(relics);
      if (earlyTurns > 0) {
        enemies = enemies.map(e => (
          e.intent != null
            ? { ...e, intent: e.intent + earlyTurns, intentMax: (e.intentMax ?? e.intent) + earlyTurns }
            : e
        ));
      }
    }
    // Daily Greed: enemies enter with +25% HP.
    // R2: path-variant Elite enemy HP mult composes multiplicatively
    // with the daily-mode mult so a daily on the Elite Path stacks.
    const enemyHpMult = (isDailyMode ? dailyEnemyHpMultiplier(dailyMods) : 1) * pathEffect.eliteEnemyHpMult;
    if (enemyHpMult !== 1) {
      enemies = enemies.map(e => ({
        ...e,
        hp: Math.max(1, Math.round(e.hp * enemyHpMult)),
        maxHp: Math.max(1, Math.round((e.maxHp ?? e.hp) * enemyHpMult)),
      }));
    }
    // Apply pre-run relic effects: starting mana + starting shield, plus
    // Foreseer's Lens (+ turns/level — suppressed by Fogged) and Void Pact.
    const bonusTurns = foggedActive ? 0 : getForeseerBonusTurns(relics);
    const dailyTurnDelta = isDailyMode ? dailyTurnLimitDelta(dailyMods) : 0;
    // Mastery: Warrior T2 — +1 max HP per chapter cleared (chapters are 1..N
    // where the first chapter is 1, so this also nudges chapter-1 by +1).
    const chapterIdx = chapterFor(level.level_number);
    const chapterHpBonus = getMasteryHpPerChapter(activeMasteries) * Math.max(0, chapterIdx);
    const initial = initialCombat(
      enemies,
      Math.max(3, level.turn_limit + bonusTurns + dailyTurnDelta),
      { bonusMaxHp: chapterHpBonus },
    );
    // Mastery: starting mana bonus (Mage T1) layered on top of relic effects.
    initial.mana = Math.min(MAX_MANA, initial.mana + getStartingMana(relics) + getMasteryStartingMana(activeMasteries));
    initial.shieldTurns = Math.max(initial.shieldTurns, getStartingShieldTurns(relics));
    const voidCost = getVoidPactHpCost(relics);
    if (voidCost > 0) {
      initial.maxHp = Math.max(10, initial.maxHp - voidCost);
      initial.hp = Math.min(initial.hp, initial.maxHp);
    }
    // Daily Glass Cannon: halve max HP at run start.
    const dailyHpMult = isDailyMode ? dailyMaxHpMultiplier(dailyMods) : 1;
    if (dailyHpMult !== 1) {
      initial.maxHp = Math.max(10, Math.round(initial.maxHp * dailyHpMult));
      initial.hp = initial.maxHp;
    }
    // R3 — Run modifier init effects. Applied AFTER all relic/daily/
    // mastery init so the modifier composes cleanly on top of the
    // already-buffed baseline. hpMult is multiplicative; manaStart is
    // additive (capped to MAX_MANA); turnDelta is additive to the
    // remaining turn budget (clamped to 3 minimum).
    if (activeModifier) {
      const eff = resolveEffect(activeModifier);
      if (eff.hpMult !== 1) {
        initial.maxHp = Math.max(10, Math.round(initial.maxHp * eff.hpMult));
        initial.hp = initial.maxHp;
      }
      if (eff.manaStart > 0) {
        initial.mana = Math.min(MAX_MANA, initial.mana + eff.manaStart);
      }
      if (eff.turnDelta !== 0) {
        initial.turnsRemaining = Math.max(3, initial.turnsRemaining + eff.turnDelta);
      }
    }
    setCombat(initial);
    // Record the true starting turn budget (post all turn modifiers) so
    // Shrine Ward's turn-1 detection is robust to Foreseer's Lens / daily /
    // run-modifier deltas.
    initialTurnsRef.current = initial.turnsRemaining;
    setActiveRelicsSnapshot(relics);
    setLastStandUsed(0);
    setPhoenixUsed(false);
    setRedChainCount(0);
    setChainCountTotal(0);
    setAbilityUsedCount(0);
    setCorruptCleansedCount(0);
    setBonusUsedThisCycle(false);
    setRngTick(0);
    setBonusShardsFromMastery(0);
    setBonusScoreFromTreasure(0);
    setBonusShardsFromTreasure(0);
    // R5: reset boss-phase tracker on every run-init path (fresh OR
    // snapshot rehydrate). Snapshot rehydrate re-derives current phase
    // lazily on the first transition check using the restored HP, so
    // resuming a backgrounded run picks up the correct boss state.
    bossPhasesRef.current = new Map();
    setTotalManaSpent(0);
    setGoldRunesCleared(0);
    // R3: fresh run — surface the modifier picker. We only do this
    // if no modifier is set yet (this guard exists because the run
    // can re-init mid-session in some flows; we never want to wipe
    // a choice the user already made).
    // R4 + R2: locked modifier id can come from either the Daily
    // Chamber (?dailyMod) or a Path Variant (e.g. Treasure Path's
    // lockedModifierId). Daily wins if both happen to be set, since
    // the daily is the more constrained surface.
    const lockedModId = searchParams.get('dailyMod') || pathEffect.lockedModifierId || null;
    const lockedMod = lockedModId ? getModifierById(lockedModId) : null;
    if (!activeModifier) {
      if (lockedMod) {
        setActiveModifier(lockedMod);
      } else {
        setModifierOffer(pickModifierOffer());
      }
    }
    braceFiredRef.current = false;
    aegisFiredRef.current = false;
    tookDamageRef.current = false;
    defeatedArchetypesRef.current = new Map();
    wavesSpawnedRef.current = 0;
    setLog([{ id: nextLogId(), kind: 'info', text: `You enter Level ${level.level_number}. The runes hum.` }]);
    // NOTE: `activeRelics` intentionally OMITTED from deps — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, hero, sealedTilesActive, telegraphActive, corruptionActive, shiftingActive, linkedPairsActive, eclipseActive, runKey, isDailyMode]);

  // ── Persist snapshot on every meaningful state change ─────────────────
  // Skipped while there's no live run, after end-state, or when we don't
  // have a stable key (anonymous user or transient level).
  useEffect(() => {
    if (!runKey || !level || !grid || !combat || endState) return;
    if (combat.hp <= 0 || combat.turnsRemaining <= 0) return;
    const snap = buildSnapshot({
      levelNumber: level.level_number,
      generationSeed: level.generation_seed,
      grid,
      combat,
      initialTurns: initialTurnsRef.current,
      seals,
      corruption,
      log,
      lastStandUsed,
      phoenixUsed,
      bonusUsedThisCycle,
      redChainCount,
      chainCountTotal,
      abilityUsedCount,
      corruptCleansedCount,
      defeatedArchetypes: defeatedArchetypesRef.current,
      wavesSpawned: wavesSpawnedRef.current,
      rngTick,
      activeRelicsSnapshot,
      activeModifierId: activeModifier?.id,
    });
    saveSnapshot(runKey, snap);
  }, [
    runKey, level, grid, combat, seals, corruption, log,
    lastStandUsed, phoenixUsed, bonusUsedThisCycle, redChainCount, chainCountTotal,
    abilityUsedCount, corruptCleansedCount, rngTick, activeRelicsSnapshot,
    activeModifier?.id, endState,
  ]);

  // Final-flush on visibilitychange / pagehide so the OS evicting the
  // WebView mid-microtask still leaves a usable snapshot behind.
  useEffect(() => {
    if (!runKey || !level || !grid || !combat) return;
    const flush = () => {
      if (endState) return;
      if (combat.hp <= 0 || combat.turnsRemaining <= 0) return;
      const snap = buildSnapshot({
        levelNumber: level.level_number,
        generationSeed: level.generation_seed,
        grid, combat, initialTurns: initialTurnsRef.current, seals, corruption, log,
        lastStandUsed, phoenixUsed, bonusUsedThisCycle, redChainCount, chainCountTotal,
        abilityUsedCount, corruptCleansedCount,
        defeatedArchetypes: defeatedArchetypesRef.current,
        wavesSpawned: wavesSpawnedRef.current,
        rngTick, activeRelicsSnapshot, activeModifierId: activeModifier?.id,
      });
      saveSnapshot(runKey, snap);
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [
    runKey, level, grid, combat, seals, corruption, log,
    lastStandUsed, phoenixUsed, bonusUsedThisCycle, redChainCount, chainCountTotal,
    abilityUsedCount, corruptCleansedCount, rngTick, activeRelicsSnapshot,
    activeModifier?.id, endState,
  ]);

  // Clear the snapshot whenever the run terminates — defeated, cleared, or
  // timed out. Subsequent visits to this level start fresh.
  useEffect(() => {
    if (endState && runKey) clearSnapshot(runKey);
  }, [endState, runKey]);


  // One-time intro modal for any brand-new mechanic taught at this level.
  useEffect(() => {
    if (!level || !hero) return;
    const intro = (level.modifiers as any)?.intro_mechanic ?? introMechanicForLevel(level.level_number);
    if (!intro) return;
    try {
      if (!localStorage.getItem(seenMechanicKey(intro))) setIntroMechanic(intro);
    } catch {}
  }, [level, hero]);

  // One-time intro modal for boss-rule levels (chapter & mid-chapter bosses).
  // Mini-bosses have no rule and skip this. Stored under a separate key per
  // rule id so each new rule shows once across the campaign.
  useEffect(() => {
    if (!level || !hero) return;
    if (!bossRule) return;
    const key = `rd-seen-bossrule-${bossRule}`;
    try {
      if (!localStorage.getItem(key)) setIntroBossRule(bossRule);
    } catch {}
  }, [level, hero, bossRule]);

  // Always invalidate the cached existing-run on mount so replay flows
  // ("Retry" → Play → finalize) compute isNewBest off fresh server data.
  // Without this, a stale cached row caused phantom hero XP double-counts.
  useEffect(() => {
    if (!level?.id || level.id.startsWith('transient-')) return;
    queryClient.invalidateQueries({ queryKey: ['rune-delve-level-run', level.id] });
  }, [level?.id, queryClient]);

  const refillRng = useMemo(() => {
    if (!level) return null;
    return mulberry32(level.generation_seed + 1000 + rngTick);
  }, [level, rngTick]);

  // Lock guard: if user navigates to a locked level via URL.
  if (progress && levelNumber > progress.highest_unlocked_level) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-6 text-center space-y-2">
          <p className="text-2xl">🔒</p>
          <h2 className="font-extrabold text-base">Level Locked</h2>
          <p className="text-xs text-muted-foreground">Clear Level {progress.highest_unlocked_level} first.</p>
          <button onClick={() => navigate(`/rune-delve/play/${progress.highest_unlocked_level}`)} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold btn-press">
            Go to Level {progress.highest_unlocked_level}
          </button>
        </div>
      </div>
    );
  }

  if (!hero || !level || !grid || !combat || !refillRng) {
    return <div className="h-64 rounded-2xl skeleton-shimmer" />;
  }

  const objType = level.objective_type as ObjectiveType;
  const activeTurnBudget = Math.max(level.turn_limit, initialTurnsRef.current);

  const handleChain = (chain: Cell[]) => {
    if (!isValidChain(grid, chain, seals, eclipse)) return;
    // Daily Overcharge caps chain length at 5.
    const chainCap = isDailyMode ? dailyChainCap(dailyMods) : 0;
    if (chainCap > 0 && chain.length > chainCap) {
      toast('⚡ Overcharge limits chains to 5', { duration: 1400 });
      return;
    }
    const type = grid[chain[0].r][chain[0].c];
    // Tiered chain bonus: 6=heavy strike (no free turn), 7=+30% & free turn,
    // 8+=+40% & free turn. Only ONE free turn per enemy cycle.
    const tierFor = (len: number) =>
      len >= 8 ? { dmgMult: 1.4, bonus: true as const }
      : len >= 7 ? { dmgMult: 1.3, bonus: true as const }
      : len >= 6 ? { dmgMult: 1.2, bonus: false as const }
      : { dmgMult: 1, bonus: false as const };
    const tier = tierFor(chain.length);
    // ── Visual FX trigger ─────────────────────────────────────────────────
    // Aim red at the first living enemy (the same target applyChain hits);
    // route green/blue/gold at the relevant HUD chip so the cue lands where
    // the player's eye should travel.
    const fxTier: 'normal' | 'big' | 'huge' =
      chain.length >= 8 ? 'huge' : chain.length >= 6 ? 'big' : 'normal';
    let fxTarget: FxRect | undefined;
    if (type === 'red') {
      const firstAlive = filterTargetable(bossRule, combat.enemies)[0];
      if (firstAlive) fxTarget = findEnemyRect(firstAlive.id);
    } else if (type === 'green') {
      fxTarget = findHudRect('hp');
    } else if (type === 'blue') {
      fxTarget = findHudRect('mana');
    } else if (type === 'gold') {
      fxTarget = findHudRect('shield') ?? findHudRect('hp');
    }
    fxQ.trigger({ kind: 'rune', rune: type, length: chain.length, tier: fxTier, target: fxTarget });
    // Themed audio + camera-feel beats per rune type.
    if (type === 'red') {
      rdSfx('rune.fire.red');
      if (chain.length >= 4) triggerCamShake(chain.length >= 6 ? 8 : 6);
      // V1 — Heavy-strike signature visual. Chain ≥ 6 already gets
      // the engine's "heavy strike" damage tier; this adds an
      // unmissable banner + gold screen-edge flash so the player
      // feels the moment land.
      if (chain.length >= 6) {
        setHeavyChainLen(chain.length);
        setHeavyFlashKey(k => k + 1);
      }
    } else if (type === 'green') {
      rdSfx('rune.fire.green');
      window.setTimeout(pulseHpGlow, 520);
    } else if (type === 'gold') {
      rdSfx('rune.fire.gold');
    } else if (type === 'blue') {
      rdSfx('rune.fire.blue');
    }
    if (chain.length >= 8) rdSfx('chain.epic');
    else if (chain.length >= 6) rdSfx('chain.bonus');
    // Snapshot relics for this run (falls back to live for first chain).
    const relics = activeRelicsSnapshot ?? activeRelics;
    // Per-chain counters BEFORE applying — drives Ember Edge / Crimson Tide / Quickstep.
    const isFirstChainOfRun = chainCountTotal === 0;
    const redCountAfter = type === 'red' ? redChainCount + 1 : redChainCount;
    // Compute relic chain mods (Ember Edge, Crimson Tide, Executioner's Mark,
    // Desperate Surge, Sapphire Flow, Verdant Heart, Bulwark, Quickstep).
    // Read the HP ratio from the enemy applyChain will actually hit — the first
    // TARGETABLE foe (boss rules can hide the final enemy) — so Executioner's
    // Mark evaluates its <25% check against the real target, not a hidden one.
    const targetEnemyForCtx = filterTargetable(bossRule, combat.enemies)[0]
      ?? combat.enemies.find(e => e.hp > 0);
    const enemyHpRatio = targetEnemyForCtx ? targetEnemyForCtx.hp / Math.max(1, targetEnemyForCtx.maxHp) : 1;
    const chainMods = computeChainMods(relics, {
      chainType: type,
      length: chain.length,
      redChainCountSoFar: type === 'red' ? redCountAfter : 0,
      isFirstChainOfRun,
      hpRatio: combat.hp / Math.max(1, combat.maxHp),
      enemyHpRatioBeforeHit: enemyHpRatio,
      chainNumberThisRun: chainCountTotal + 1,
    });
    // Momentum (rogue): chain bonus threshold drops from 5 → 4.
    const rogueBonusThreshold = hero.class === 'rogue' && has(relics, 'momentum') ? 4 : 5;
    const { next, resolution } = applyChain(combat, type, chain.length, hero.class, bossRule, rogueBonusThreshold, level.level_number);

    // ── R3: Run modifier per-chain effects ─────────────────────────────
    // Applied post-applyChain (same pattern as the relic damage mult
    // block below) so we can compose cleanly with everything else.
    //   redDamageMult → extra damage to current target
    //   healMult      → extra heal to next.hp
    //   shieldMult    → extra shield turns
    const modEff = resolveEffect(activeModifier);
    if (type === 'red' && modEff.redDamageMult !== 1 && resolution.damageDealt > 0) {
      const boosted = Math.round(resolution.damageDealt * modEff.redDamageMult);
      const delta = boosted - resolution.damageDealt;
      if (delta !== 0) {
        const target = next.enemies.find(e => e.hp > 0) ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
        if (target) {
          if (delta > 0) {
            const applied = Math.min(delta, Math.max(target.hp, 0));
            if (applied > 0) {
              target.hp -= applied;
              next.totalDamage += applied;
              resolution.damageDealt += applied;
              if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
                resolution.enemyKills.push(target.id);
                next.enemiesDefeated += 1;
              }
            }
          } else {
            // Negative modifier (e.g. Verdant Heart) — heal target back partially.
            const heal = Math.min(-delta, target.maxHp - target.hp);
            if (heal > 0) {
              target.hp += heal;
              next.totalDamage = Math.max(0, next.totalDamage - heal);
              resolution.damageDealt = Math.max(0, resolution.damageDealt - heal);
            }
          }
        }
      }
    }
    if (type === 'green' && modEff.healMult !== 1 && resolution.hpHealed > 0) {
      const boosted = Math.round(resolution.hpHealed * modEff.healMult);
      const delta = boosted - resolution.hpHealed;
      if (delta > 0) {
        const applied = Math.min(delta, next.maxHp - next.hp);
        if (applied > 0) { next.hp += applied; resolution.hpHealed += applied; }
      } else if (delta < 0) {
        // Reduce already-applied heal — clamp at 0.
        const reduction = Math.min(-delta, resolution.hpHealed, next.hp);
        next.hp -= reduction;
        resolution.hpHealed -= reduction;
      }
    }
    if (type === 'gold' && modEff.shieldMult !== 1 && resolution.guardGained > 0) {
      const boosted = Math.round(resolution.guardGained * modEff.shieldMult);
      const delta = boosted - resolution.guardGained;
      if (delta !== 0) {
        next.shieldTurns = Math.max(0, next.shieldTurns + delta);
        resolution.guardGained = Math.max(0, resolution.guardGained + delta);
      }
    }

    // ── Chamber layout zones: treasure + hazard (R1) ────────────────────
    // Treasure: bonus score + shards (banked, awarded at finalize so
    // they show up cleanly on the results card alongside other bonuses).
    // Hazard: immediate HP cost on the chain that touched them.
    //   Capped per chain so a chain through every hazard tile can't
    //   wipe the hero in one move — there's still risk, not instant
    //   death from a bad path.
    if (layoutZones.treasure.size > 0 || layoutZones.hazard.size > 0) {
      const treasureHits = countChainInZone(chain, layoutZones.treasure);
      const hazardHits = countChainInZone(chain, layoutZones.hazard);
      if (treasureHits > 0) {
        // R3: treasureMult from active modifier (Treasure Hunter triples).
        const scoreGain = Math.round(treasureHits * TREASURE_SCORE_BONUS * modEff.treasureMult);
        const shardGain = Math.round(treasureHits * TREASURE_SHARD_BONUS * modEff.treasureMult);
        setBonusScoreFromTreasure(s => s + scoreGain);
        setBonusShardsFromTreasure(s => s + shardGain);
        pushLog({
          kind: 'info',
          text: `✨ Treasure +${scoreGain} score · +${shardGain} shards`,
        });
      }
      if (hazardHits > 0) {
        // R3: hazardMult from active modifier (Treasure Hunter doubles).
        const rawDamage = Math.round(hazardHits * HAZARD_DAMAGE * modEff.hazardMult);
        const damage = Math.min(rawDamage, HAZARD_MAX_DAMAGE_PER_CHAIN * modEff.hazardMult);
        next.hp = Math.max(0, next.hp - damage);
        if (damage > 0) tookDamageRef.current = true;
        pushLog({
          kind: 'corruption',
          text: `⚠️ Hazard tile · -${damage} HP`,
          amount: damage,
        });
      }
    }

    // Apply relic damage multiplier for red chains (composes with tier mult).
    if (type === 'red' && chainMods.bonusDamageMult > 1 && resolution.damageDealt > 0) {
      const baseDmg = resolution.damageDealt;
      const boostedDmg = Math.round(baseDmg * chainMods.bonusDamageMult);
      const extra = boostedDmg - baseDmg;
      if (extra > 0) {
        const target = next.enemies.find(e => e.hp > 0) ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
        if (target) {
          const applied = Math.min(extra, Math.max(target.hp, 0));
          if (applied > 0) {
            target.hp -= applied;
            resolution.damageDealt += applied;
            next.totalDamage += applied;
            if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
              next.enemiesDefeated += 1;
              resolution.enemyKills.push(target.id);
            }
          }
        }
      }
    }
    // Mana / heal / shield bonuses.
    if (chainMods.bonusManaFlat > 0) {
      next.mana = Math.min(MAX_MANA, next.mana + chainMods.bonusManaFlat);
      resolution.manaGained += chainMods.bonusManaFlat;
    }
    if (chainMods.bonusHealFlat > 0) {
      const heal = Math.min(chainMods.bonusHealFlat, next.maxHp - next.hp);
      if (heal > 0) {
        next.hp += heal;
        resolution.hpHealed += heal;
      }
    }
    if (chainMods.bonusShieldTurns > 0) {
      next.shieldTurns += chainMods.bonusShieldTurns;
      resolution.guardGained += chainMods.bonusShieldTurns;
    }
    // Quickstep: first chain of run counts as +N length. Apply by adding the
    // per-rune effect of the chain type (an extra "phantom" rune's worth) for
    // every length bonus point. Also lifts the longest-chain stat for scoring.
    if (chainMods.effectiveLengthBonus > 0) {
      const bonusLen = chainMods.effectiveLengthBonus;
      next.longestChain = Math.max(next.longestChain, chain.length + bonusLen);
      if (type === 'red') {
        // Match the engine's class + campaign-depth curve exactly.
        const extra = Math.max(
          0,
          redChainDamage(chain.length + bonusLen, hero.class, level.level_number)
            - redChainDamage(chain.length, hero.class, level.level_number),
        );
        const target = next.enemies.find(e => e.hp > 0)
          ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
        if (target) {
          const applied = Math.min(extra, Math.max(target.hp, 0));
          if (applied > 0) {
            target.hp -= applied;
            resolution.damageDealt += applied;
            next.totalDamage += applied;
            if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
              next.enemiesDefeated += 1;
              resolution.enemyKills.push(target.id);
            }
          }
        }
      } else if (type === 'green') {
        const perRune = hero.class === 'cleric' ? Math.round(6 * 1.5) : 6;
        const extra = Math.min(perRune * bonusLen, next.maxHp - next.hp);
        if (extra > 0) {
          next.hp += extra;
          resolution.hpHealed += extra;
        }
      } else if (type === 'blue') {
        // Push the chain over the 5+ mana threshold if it wasn't already.
        if (chain.length < 5 && chain.length + bonusLen >= 5 && next.mana < MAX_MANA) {
          next.mana = Math.min(MAX_MANA, next.mana + 1);
          resolution.manaGained += 1;
        }
      } else if (type === 'gold') {
        // Gold scales shield turns by floor(length/3) — only push if it crosses a threshold.
        const beforeT = Math.floor(chain.length / 3);
        const afterT = Math.floor((chain.length + bonusLen) / 3);
        const extraTurns = afterT - beforeT;
        if (extraTurns > 0) {
          next.shieldTurns += extraTurns;
          resolution.guardGained += extraTurns;
        }
      }
    }
    // Update per-run counters.
    setChainCountTotal(c => c + 1);
    if (type === 'red') setRedChainCount(redCountAfter);
    // Scale red-chain damage by the tier multiplier; route the extra HP into
    // the same target that applyChain already hit. Round to whole HP.
    if (tier.dmgMult > 1 && type === 'red' && resolution.damageDealt > 0) {
      const baseDmg = resolution.damageDealt;
      const boostedDmg = Math.round(baseDmg * tier.dmgMult);
      const extra = boostedDmg - baseDmg;
      if (extra > 0) {
        const target = next.enemies.find(e => e.hp > 0 && e.hp < e.maxHp)
          ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
        if (target) {
          const applied = Math.min(extra, Math.max(target.hp, 0));
          if (applied > 0) {
            target.hp -= applied;
            resolution.damageDealt += applied;
            next.totalDamage += applied;
            if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
              next.enemiesDefeated += 1;
              resolution.enemyKills.push(target.id);
            }
          }
        }
      }
    }
    // ── Daily + Mastery damage compounding (red chains only) ─────────────
    // Stacks multiplicatively on top of the tier multiplier so power-builds
    // really feel powerful. Mastery T5 Last Stand also kicks in below 20% HP.
    let critFired = false;
    if (type === 'red' && resolution.damageDealt > 0) {
      let extraMult = 1;
      if (isDailyMode) extraMult *= dailyDamageMultiplier(dailyMods, type);
      if (isDailyMode) extraMult *= dailyIroncladDamageMult(dailyMods, chain.length);
      extraMult *= getMasteryChainDamageMult(activeMasteries, type);
      if (isLastStandActive(activeMasteries, combat.hp, combat.maxHp)) extraMult *= 1.5;
      // ── Mastery: Rogue T2 Opening Strike — first chain of run crits ×1.5.
      const openCrit = getMasteryOpeningCritMult(activeMasteries, chainsThisFight);
      if (openCrit > 1) { extraMult *= openCrit; critFired = true; }
      // ── Mastery: Rogue T4 Quickblade — chains 4+ have a 10% crit chance.
      const critChance = getMasteryChainCritChance(activeMasteries, chain.length);
      if (critChance > 0 && Math.random() < critChance) { extraMult *= 1.5; critFired = true; }
      if (extraMult !== 1) {
        const baseDmg = resolution.damageDealt;
        const boostedDmg = Math.round(baseDmg * extraMult);
        const extra = boostedDmg - baseDmg;
        if (extra !== 0) {
          const target = next.enemies.find(e => e.hp > 0)
            ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
          if (target && extra > 0) {
            const applied = Math.min(extra, Math.max(target.hp, 0));
            if (applied > 0) {
              target.hp -= applied;
              resolution.damageDealt += applied;
              next.totalDamage += applied;
              if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
                next.enemiesDefeated += 1;
                resolution.enemyKills.push(target.id);
              }
            }
          }
        }
      }
    }
    // ── Mastery: Rogue T1 Gilded Eye — track gold runes for end-of-run score.
    if (type === 'gold') {
      setGoldRunesCleared(g => g + chain.length);
    }
    // Toast the rogue crit (turnLogs isn't yet allocated at this point).
    if (critFired) {
      toast.success(`🗡️ Critical strike! Chain ×${chain.length}`, { duration: 1100 });
    }
    // ── Mastery: Mage T2 — blue chains heal a flat 2 HP. ─────────────────
    if (type === 'blue') {
      const blueHeal = getMasteryBlueChainHeal(activeMasteries);
      if (blueHeal > 0) {
        const applied = Math.min(blueHeal, next.maxHp - next.hp);
        if (applied > 0) {
          next.hp += applied;
          resolution.hpHealed += applied;
        }
      }
    }
    // ── Mastery: Cleric T1 — first chain of fight heals a small amount. ──
    {
      const openHeal = getMasteryOpeningHeal(activeMasteries, chainsThisFight);
      if (openHeal > 0) {
        const applied = Math.min(openHeal, next.maxHp - next.hp);
        if (applied > 0) {
          next.hp += applied;
          resolution.hpHealed += applied;
        }
      }
    }
    // ── Mastery: Cleric T2 — shields persist +1 turn. ────────────────────
    if (type === 'gold' && resolution.guardGained > 0) {
      const bonus = getMasteryShieldBonus(activeMasteries);
      if (bonus > 0) {
        next.shieldTurns += bonus;
        resolution.guardGained += bonus;
      }
    }
    // ── Daily: Hourglass refunds 1 mana per chain. ───────────────────────
    if (isDailyMode) {
      const refund = dailyManaRefundPerChain(dailyMods);
      if (refund > 0 && next.mana < MAX_MANA) {
        const before = next.mana;
        next.mana = Math.min(MAX_MANA, next.mana + refund);
        resolution.manaGained += next.mana - before;
      }
    }
    // ── Daily: Reflective — % of damage you deal hits you back. ──────────
    if (isDailyMode && resolution.damageDealt > 0) {
      const pct = dailyReflectivePct(dailyMods);
      if (pct > 0) {
        const reflect = Math.round(resolution.damageDealt * pct);
        if (reflect > 0) {
          next.hp = Math.max(0, next.hp - reflect);
        }
      }
    }
    // ── Mastery: Rogue T5 — +1 shard per chain. Tracked, awarded on finalize.
    {
      const perChain = getMasteryShardsPerChain(activeMasteries);
      if (perChain > 0) {
        setBonusShardsFromMastery(s => s + perChain);
      }
    }
    setChainsThisFight(c => c + 1);
    // ── Vampiric Sigil — heal % of red damage dealt ──────────────────────
    if (type === 'red' && chainMods.lifestealPctOfDamage > 0 && resolution.damageDealt > 0) {
      const lifesteal = Math.round(resolution.damageDealt * chainMods.lifestealPctOfDamage);
      const applied = Math.min(lifesteal, next.maxHp - next.hp);
      if (applied > 0) {
        next.hp += applied;
        resolution.hpHealed += applied;
      }
    }
    // ── Rune Echo — repeat the chain's effect at echoMult strength ──────
    if (chainMods.echoMult > 0) {
      const m = chainMods.echoMult;
      if (type === 'red' && resolution.damageDealt > 0) {
        const echoDmg = Math.round(resolution.damageDealt * m);
        const target = next.enemies.find(e => e.hp > 0)
          ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
        if (target && echoDmg > 0) {
          const applied = Math.min(echoDmg, Math.max(target.hp, 0));
          if (applied > 0) {
            target.hp -= applied;
            resolution.damageDealt += applied;
            next.totalDamage += applied;
            if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
              next.enemiesDefeated += 1;
              resolution.enemyKills.push(target.id);
            }
          }
        }
      } else if (type === 'green' && resolution.hpHealed > 0) {
        const echoHeal = Math.round(resolution.hpHealed * m);
        const applied = Math.min(echoHeal, next.maxHp - next.hp);
        if (applied > 0) { next.hp += applied; resolution.hpHealed += applied; }
      } else if (type === 'blue' && resolution.manaGained > 0) {
        const echoMana = Math.max(1, Math.round(resolution.manaGained * m));
        const before = next.mana;
        next.mana = Math.min(MAX_MANA, next.mana + echoMana);
        resolution.manaGained += next.mana - before;
      } else if (type === 'gold' && resolution.guardGained > 0) {
        const echoTurns = Math.max(1, Math.round(resolution.guardGained * m));
        next.shieldTurns += echoTurns;
        resolution.guardGained += echoTurns;
      }
    }
    if (resolution.enemyKills.length) setFlashId(resolution.enemyKills[0]);

    // Build the per-turn log batch as we go so the order matches the events.
    const turnLogs: Array<Omit<CombatLogEntry, 'id'>> = [];
    const runeLabel = RUNE_LABEL[type] ?? type;

    // Chain summary line — always logged.
    if (type === 'red' && resolution.damageDealt > 0) {
      const target = combat.enemies.find(e => resolution.enemyKills[0] ? e.id === resolution.enemyKills[0] : e.hp > 0);
      const targetName = target?.name ?? 'the foe';
      turnLogs.push({
        kind: 'damage',
        text: `${runeLabel} chain x${chain.length} struck ${targetName}`,
        amount: resolution.damageDealt,
      });
    } else if (type === 'green' && resolution.hpHealed > 0) {
      turnLogs.push({ kind: 'heal', text: `${runeLabel} chain x${chain.length} mended your wounds`, amount: resolution.hpHealed });
    } else if (type === 'blue' && resolution.manaGained > 0) {
      turnLogs.push({ kind: 'mana', text: `${runeLabel} chain x${chain.length} channeled mana`, amount: resolution.manaGained });
    } else if (type === 'gold') {
      turnLogs.push({ kind: 'shield', text: `${runeLabel} chain x${chain.length} raised your guard`, amount: resolution.guardGained });
    } else {
      // Red chain that hit a shielded boss → no damage applied.
      turnLogs.push({ kind: 'info', text: `${runeLabel} chain x${chain.length} fizzled` });
    }
    for (const killId of resolution.enemyKills) {
      const killed = combat.enemies.find(e => e.id === killId);
      recordKill(killed);
      turnLogs.push({ kind: 'kill', text: `${killed?.name ?? 'A foe'} was vanquished!` });
    }

    // Last Stand feedback: red chain landed but the boss is shielded → 0 dmg.
    if (
      bossRule === 'last_stand' &&
      type === 'red' &&
      resolution.damageDealt === 0 &&
      combat.enemies.some(e => e.hp > 0)
    ) {
      toast('🛡️ Boss is shielded — defeat the others first', { duration: 1600 });
    }
    // Phase Lock fizzle: boss is mid-phase and ignored the strike.
    if (
      bossRule === 'phaselock' &&
      type === 'red' &&
      resolution.damageDealt === 0 &&
      combat.enemies.some(e => e.hp > 0 && (e.phaseLockTurns ?? 0) > 0)
    ) {
      const phasing = combat.enemies.find(e => (e.phaseLockTurns ?? 0) > 0);
      toast('🌀 The boss is phasing — strike fizzled', { duration: 1600 });
      turnLogs.push({ kind: 'info', text: `${phasing?.name ?? 'The boss'} phased out — your strike found nothing` });
    }

    // Apply corruption: HP cost for matching corrupted cells, then strip them.
    // Cleansing Touch: first N corrupt-source clears each run cost no HP.
    // Bite keys off corruption EXISTING, not the level's band flag — enemy
    // `corrupt_tile` abilities (Rune Wraith / Whisper Witch / Wraith Lord) can
    // seed corruption on any level, and those cells must cost HP + clear too.
    let nextCorruption = corruption;
    if (corruption.cells.size) {
      const r = resolveChainAgainstCorruption(corruption, chain);
      let hpCost = r.hpCost;
      if (r.sourcesCleared > 0 && has(relics, 'cleansing_touch')) {
        // effectValue returns max free clears (1..2). We've already consumed
        // `corruptCleansedCount` of them.
        const freeRemaining = Math.max(
          0,
          (relics.ranks.get('cleansing_touch') ?? 1) >= 5 ? 2 - corruptCleansedCount : 1 - corruptCleansedCount,
        );
        if (freeRemaining > 0 && hpCost > 0) {
          hpCost = 0;
          turnLogs.push({ kind: 'info', text: '✨ Cleansing Touch — corruption cost waived' });
        }
        setCorruptCleansedCount(c => c + r.sourcesCleared);
      }
      if (hpCost > 0) {
        next.hp = Math.max(0, next.hp - hpCost);
        tookDamageRef.current = true;
        toast.error(`☠️ -${hpCost} HP from corruption`, { duration: 1100 });
        turnLogs.push({ kind: 'corruption', text: 'Corrupted runes burned you', amount: hpCost });
      }
      if (r.sourcesCleared > 0) {
        toast.success(r.sourcesCleared > 1 ? `Sources cleansed!` : `Source cleansed!`, { duration: 1200 });
        turnLogs.push({ kind: 'info', text: r.sourcesCleared > 1 ? 'Corruption sources cleansed' : 'Corruption source cleansed' });
      }
      nextCorruption = r.next;
    }

    // Bonus move (rebalanced): only chains of 7+ grant a free action, AND only
    // once per enemy cycle. Chain-6 still gets a damage bump (handled above)
    // but the enemy phase still runs.
    const enemiesAlive = next.enemies.some(e => e.hp > 0);
    const grantsBonusMove = tier.bonus && !bonusUsedThisCycle && enemiesAlive;

    // Capture pre-attack HP + shield to derive damage taken / mitigated.
    const hpBefore = next.hp;
    const hadShield = next.shieldTurns > 0;
    const rawIncoming = next.enemies.reduce(
      (s, e) => s + (e.hp > 0 ? Math.round(e.damage) : 0),
      0,
    );

    // enemiesAttack already runs applyBossTurnEffects internally — do NOT call it again here.
    // On a bonus-move chain, we skip the enemy phase entirely (no turn consumed, no retaliation).
    // Shrine Ward (turn 1) and Cracked Crown (boss-rule levels) reduce incoming
    // damage by scaling each enemy's `damage` field in-place before the call,
    // then restoring it after — mirrors the enrager pattern in combatEngine.
    const isTurnOne = combat.turnsRemaining === initialTurnsRef.current;
    const wardMult = shrineWardTurn1Mult(relics, isTurnOne);
    const crownMult = bossRule ? bossRuleSoften(relics) : 1;
    const incomingMult = wardMult * crownMult;
    let afterEnemies: CombatState & { heavyFired?: boolean; abilityLogs?: Array<Omit<CombatLogEntry, 'id'>>; abilityEffects?: any[]; thornsLog?: Omit<CombatLogEntry, 'id'> };
    if (grantsBonusMove) {
      afterEnemies = next;
    } else if (enemiesAlive) {
      const originalDamage = next.enemies.map(e => e.damage);
      if (incomingMult !== 1) {
        next.enemies.forEach(e => { e.damage = Math.max(0, Math.round(e.damage * incomingMult)); });
      }
      // Count minions already on the board so summon_minion respects its cap.
      const summonsSoFar = next.enemies.filter(e => e.archetypeId === 'bone_husk').length;
      afterEnemies = enemiesAttack(next, telegraphActive, bossRule, summonsSoFar, {
        cls: hero.class,
        relicMultiplier: thornsRelicMultiplier(relics),
      });
      // Restore damage on the post-attack array so future turns aren't permanently softened.
      afterEnemies.enemies = afterEnemies.enemies.map((e, i) => ({ ...e, damage: originalDamage[i] ?? e.damage }));
      // Apply ability side-effects (corrupt/seal/spawn) to the page-level state.
      // IMPORTANT: corrupt_tile / seal_tile additions are collected into the
      // local `nextCorruption` / `pendingSealAdds` so they merge with the
      // single end-of-turn setCorruption/setSeals calls below — using
      // functional updaters here would race and get overwritten.
      const effects = afterEnemies.abilityEffects ?? [];
      const pendingSealAdds: string[] = [];
      for (const eff of effects) {
        if (eff.kind === 'spawn_minion') {
          afterEnemies = { ...afterEnemies, enemies: [...afterEnemies.enemies, eff.enemy] };
        } else if (eff.kind === 'corrupt_tile') {
          // Drop one corrupted cell on the first available non-sealed,
          // non-corrupted square (deterministic scan keeps replays stable).
          // No longer gated on the corruption BAND — the ability fired and
          // logged, so its board effect must actually land (was a silent
          // no-op on 16 levels whose enemies carry corrupt_tile off-band).
          const cells = new Set(nextCorruption.cells);
          let placed = false;
          outer: for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
            const k = `${r}-${c}`;
            if (!cells.has(k) && !seals.has(k) && !pendingSealAdds.includes(k)) {
              cells.add(k);
              placed = true;
              break outer;
            }
          }
          if (placed) {
            nextCorruption = { cells, sources: nextCorruption.sources };
            turnLogs.push({ kind: 'corruption', text: 'A new rune was corrupted' });
          }
        } else if (eff.kind === 'seal_tile') {
          for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
            const k = `${r}-${c}`;
            if (!seals.has(k) && !pendingSealAdds.includes(k)) {
              pendingSealAdds.push(k);
              turnLogs.push({ kind: 'info', text: 'A rune was sealed shut' });
              r = 5; c = 5; break;
            }
          }
        }
      }
      // Stash for the final setSeals merge below.
      (afterEnemies as any).__pendingSealAdds = pendingSealAdds;
      // Push enemy ability logs (heavy_strike / shield_self / heal_ally / etc).
      if (afterEnemies.abilityLogs?.length) turnLogs.push(...afterEnemies.abilityLogs);
      // ── Shield Thorns ── push reflect log + record bestiary kills + pulse FX
      if (afterEnemies.thornsLog) {
        turnLogs.push(afterEnemies.thornsLog);
        // Diff pre/post-attack enemy hp to attribute kills to thorns for the
        // Bestiary. Chain kills already recorded above; this catches any new
        // foes who died during the enemy phase from reflected damage.
        const preIds = new Set(combat.enemies.filter(e => e.hp > 0).map(e => e.id));
        const chainKilledIds = new Set(resolution.enemyKills);
        for (const e of afterEnemies.enemies) {
          if (e.hp <= 0 && preIds.has(e.id) && !chainKilledIds.has(e.id)) {
            recordKill(e);
          }
        }
        // Brief shield-pill pulse to cue the reflect.
        const shieldEl = playRootRef.current?.querySelector('[data-fx-target="shield"]') as HTMLElement | null;
        if (shieldEl) {
          shieldEl.style.transition = 'transform 220ms ease-out, filter 220ms ease-out';
          shieldEl.style.transform = 'scale(1.35)';
          shieldEl.style.filter = 'drop-shadow(0 0 6px hsl(var(--gold) / 0.9))';
          window.setTimeout(() => {
            shieldEl.style.transform = '';
            shieldEl.style.filter = '';
          }, 220);
        }
        // First-ever Thorns trigger → show one-time mechanic intro.
        try {
          if (!localStorage.getItem(seenMechanicKey('thorns'))) {
            setIntroMechanic('thorns');
          }
        } catch { /* localStorage may be unavailable */ }
      }
    } else {
      afterEnemies = endTurn(next);
    }
    if (grantsBonusMove) {
      setBonusUsedThisCycle(true);
      toast.success(`✨ Bonus move! Chain x${chain.length}`, { duration: 1400 });
      turnLogs.push({ kind: 'info', text: `Chain x${chain.length} — bonus move! Enemies hesitate.` });
    } else if (tier.bonus && enemiesAlive) {
      if (chain.length >= 8) toast.success(`💥 Massive chain x${chain.length}!`, { duration: 1300 });
      turnLogs.push({ kind: 'info', text: `Chain x${chain.length} — massive damage! (bonus already used this cycle)` });
    } else if (chain.length === 6 && enemiesAlive) {
      turnLogs.push({ kind: 'info', text: `Chain x6 — heavy strike!` });
    }
    if (!grantsBonusMove && enemiesAlive) {
      setBonusUsedThisCycle(false);
    }

    if ((afterEnemies as any).heavyFired) {
      toast.error('⚡ Heavy strike!', { duration: 1200 });
      turnLogs.push({ kind: 'heavy', text: 'A telegraphed heavy strike landed!' });
    }

    // Damage taken / mitigated lines.
    const hpLost = Math.max(0, hpBefore - afterEnemies.hp);
    if (hpLost > 0) {
      tookDamageRef.current = true;
      turnLogs.push({ kind: 'taken', text: 'Enemies retaliated', amount: hpLost });
      setHurtFlashKey(k => k + 1);
      rdSfx('hero.hurt');
      floaters.addAt(playRootRef.current?.querySelector('[data-fx-target="hp"]'), { kind: 'damage', text: String(hpLost) });
    } else if (next.enemies.some(e => e.hp > 0) && rawIncoming > 0) {
      turnLogs.push({ kind: 'info', text: 'You weathered the assault' });
    }
    if (hadShield && rawIncoming > hpLost) {
      const mitigated = rawIncoming - hpLost;
      if (mitigated > 0) turnLogs.push({ kind: 'mitigated', text: 'Your guard absorbed the blow', amount: mitigated });
    }
    // Floating numbers for chain effects (heal / mana / shield) so the player
    // sees the reward land on the relevant HUD chip.
    if (resolution.hpHealed > 0) {
      floaters.addAt(playRootRef.current?.querySelector('[data-fx-target="hp"]'), { kind: 'heal', text: String(resolution.hpHealed) });
      setHealFlashKey(k => k + 1);
      rdSfx('hero.heal');
    }
    if (resolution.manaGained > 0) {
      floaters.addAt(playRootRef.current?.querySelector('[data-fx-target="mana"]'), { kind: 'mana', text: String(resolution.manaGained) });
      rdSfx('mana.gain', { index: resolution.manaGained });
    }
    if (resolution.guardGained > 0) {
      floaters.addAt(playRootRef.current?.querySelector('[data-fx-target="shield"]') ?? playRootRef.current?.querySelector('[data-fx-target="hp"]'), { kind: 'shield', text: String(resolution.guardGained) });
      rdSfx('shield.up');
    }
    // Damage numbers + enemy hit/die cues per kill in this chain.
    if (resolution.damageDealt > 0) {
      const targetEnemy = combat.enemies.find(e => resolution.enemyKills[0] ? e.id === resolution.enemyKills[0] : e.hp > 0);
      const targetEl = targetEnemy ? playRootRef.current?.querySelector(`[data-enemy-id="${targetEnemy.id}"]`) : null;
      floaters.addAt(targetEl, { kind: 'damage', text: String(resolution.damageDealt) });
      rdSfx('enemy.hit');
    }
    for (const killId of resolution.enemyKills) {
      const killed = combat.enemies.find(e => e.id === killId);
      rdSfx(killed?.tier === 'boss' ? 'boss.roar' : 'enemy.die');
    }
    // Mana orbs filled to ready → ability ready cue
    if (next.mana >= MAX_MANA && combat.mana < MAX_MANA) {
      rdSfx('ability.ready');
    }

    // Explicit "a save fired this turn" flag — set ONLY when Aegis / Last Stand
    // / Phoenix actually restores HP from a lethal blow. Cleric T4 reads this
    // instead of a pre-shield-damage heuristic that mis-fired whenever a shield
    // absorbed a nominally-lethal hit (and missed real revives).
    let revivedThisTurn = false;
    // ── Mastery: Cleric T5 Eternal Aegis — once per run, block a fatal hit.
    // Runs BEFORE the relic Last Stand / Phoenix saves so the cheap free
    // mastery save burns first; relics can still bail you out next time.
    if (afterEnemies.hp <= 0 && hasMasteryAegis(activeMasteries) && !aegisFiredRef.current) {
      afterEnemies = { ...afterEnemies, hp: 1 };
      aegisFiredRef.current = true;
      revivedThisTurn = true;
      toast.success('🛡️ Aegis blocked the killing blow!', { duration: 1800 });
      turnLogs.push({ kind: 'laststand', text: 'Eternal Aegis — fatal hit blocked!' });
    }
    // Relic: Last Stand — survive lethal at 1 HP. R1–R4: 1 use; R5: 2 uses.
    if (afterEnemies.hp <= 0) {
      const ls = tryLastStand(relics, afterEnemies.hp, lastStandUsed);
      if (ls.saved) {
        afterEnemies = { ...afterEnemies, hp: ls.hp };
        setLastStandUsed(c => c + 1);
        revivedThisTurn = true;
        toast.success('💔 Last Stand! Survived at 1 HP', { duration: 1800 });
        turnLogs.push({ kind: 'laststand', text: 'Last Stand! You survived at 1 HP' });
      }
    }
    // Relic: Phoenix Heart — full revive at 50%+ maxHp once per run. Runs
    // AFTER Last Stand so the cheap save fires first when both are equipped.
    if (afterEnemies.hp <= 0) {
      const reviveHp = tryPhoenixHeart(relics, afterEnemies.maxHp, phoenixUsed);
      if (reviveHp != null) {
        afterEnemies = { ...afterEnemies, hp: reviveHp };
        setPhoenixUsed(true);
        revivedThisTurn = true;
        toast.success(`🔥 Phoenix Heart! Revived at ${reviveHp} HP`, { duration: 2200 });
        turnLogs.push({ kind: 'laststand', text: `Phoenix Heart blazed — revived at ${reviveHp} HP` });
      }
    }

    // Relic: Bloodbond — heal per kill this turn (rank-aware: 4–6 HP).
    if (resolution.enemyKills.length && has(relics, 'bloodbond')) {
      const beforeHeal = afterEnemies.hp;
      let healed = afterEnemies;
      for (let i = 0; i < resolution.enemyKills.length; i++) healed = onEnemyKilled(relics, healed);
      afterEnemies = { ...afterEnemies, hp: healed.hp };
      const gained = afterEnemies.hp - beforeHeal;
      if (gained > 0) turnLogs.push({ kind: 'heal', text: 'Bloodbond drew vigor from the slain', amount: gained });
    }

    // ── Mastery: Warrior T4 Brace — first time HP drops below 25% in a run,
    // gain a 2-turn shield. Single-use; only fires when player is still alive.
    if (
      hasMasteryPanicShield(activeMasteries) &&
      !braceFiredRef.current &&
      afterEnemies.hp > 0 &&
      afterEnemies.hp / Math.max(1, afterEnemies.maxHp) < 0.25
    ) {
      afterEnemies = { ...afterEnemies, shieldTurns: Math.max(afterEnemies.shieldTurns, 2) };
      braceFiredRef.current = true;
      toast.success('🛡️ Brace! 2-turn shield', { duration: 1500 });
      turnLogs.push({ kind: 'shield', text: 'Brace — your guard surged at the brink', amount: 2 });
    }
    // ── Mastery: Cleric T4 Resurgent Light — if an actual revive fired this
    // turn (Aegis / Last Stand / Phoenix), scorch up to 2 targetable enemies.
    if (revivedThisTurn && reviveBurstActive(activeMasteries)) {
      const targets = afterEnemies.enemies.filter(e => e.hp > 0).slice(0, 2);
      if (targets.length > 0) {
        afterEnemies = {
          ...afterEnemies,
          enemies: afterEnemies.enemies.map(e => {
            if (!targets.find(t => t.id === e.id)) return e;
            const applied = Math.min(25, e.hp);
            return { ...e, hp: e.hp - applied };
          }),
        };
        // Recount kills to keep enemiesDefeated honest.
        const newKills = targets.filter(t => {
          const live = afterEnemies.enemies.find(e => e.id === t.id);
          return live && live.hp <= 0;
        }).length;
        if (newKills > 0) {
          afterEnemies.enemiesDefeated += newKills;
          afterEnemies.totalDamage += 25 * newKills;
        }
        turnLogs.push({ kind: 'ability', text: '✨ Resurgent Light scorched the closest foes', amount: 25 });
      }
    }

    // ── Linked Pairs (L46+) — clearing one cell triggers its twin too. ──
    let chainForResolve = chain;
    if (linkedPairsActive && linkedPairs.pairs.size > 0) {
      const triggered = pairsTriggeredByChain(linkedPairs, chain);
      if (triggered.length > 0) {
        chainForResolve = [...chain, ...triggered];
        const clearedKeys = chainForResolve.map(c => `${c.r}-${c.c}`);
        const nextPairs: LinkedPairsState = { pairs: new Map(linkedPairs.pairs) };
        consumePairs(nextPairs, clearedKeys);
        setLinkedPairs(nextPairs);
        turnLogs.push({ kind: 'info', text: `🔗 Linked twin${triggered.length > 1 ? 's' : ''} cleared` });
      }
    }
    let newGrid = resolveBoard(grid, chainForResolve, refillRng, seals);

    // ── Shifting Runes (L36+) — drift the active column down each turn. ─
    if (shiftingActive && shift.column >= 0 && !grantsBonusMove) {
      newGrid = applyShift(newGrid, shift, refillRng, seals);
    }

    // Build the final seal set: drop any broken adjacents, then layer in any
    // ability-driven additions (seal_tile from Voidspawn, etc.). One write
    // total avoids racing the functional-updater path.
    const pendingSealAdds: string[] = (afterEnemies as any).__pendingSealAdds ?? [];
    const broken = seals.size ? sealsBrokenByChain(seals, chain) : [];
    if (broken.length || pendingSealAdds.length) {
      const nextSeals = new Set(seals);
      broken.forEach(k => nextSeals.delete(k));
      pendingSealAdds.forEach(k => nextSeals.add(k));
      setSeals(nextSeals);
      if (broken.length) {
        turnLogs.push({ kind: 'info', text: broken.length > 1 ? `${broken.length} seals shattered` : 'A seal shattered' });
      }
    }

    // Spread corruption AFTER the chain resolves (player's turn ended).
    // On a bonus-move chain the turn does NOT end, so corruption holds too.
    if (corruptionActive && nextCorruption.sources.size && !grantsBonusMove) {
      nextCorruption = spreadCorruption(nextCorruption, rngTick, level.generation_seed, seals);
    }
    setCorruption(nextCorruption);

    setRngTick(t => t + 1);
    setGrid(newGrid);

    // ── Multi-wave: spawn the next wave when the current wave fully clears ──
    // Avoid double-spawning when multiple kills land on the same chain.
    let postWave = afterEnemies;
    const allDead = postWave.enemies.every(e => e.hp <= 0);
    if (allDead && waveDefs && wavesSpawnedRef.current < waveDefs.length) {
      const nextWave = waveDefs[wavesSpawnedRef.current];
      // Hydrate stored wave enemies (same archetype-id resolver as wave 1).
      const resolveAid = (e: any): string | undefined => {
        if (e.archetypeId) return e.archetypeId;
        const raw = String(e.name ?? '').replace(/^(Elite |Boss |Mini-Boss |Echo of )/, '').trim().toLowerCase();
        if (!raw) return undefined;
        const hit = ENEMY_ROSTER.find(a => a.name.toLowerCase() === raw);
        return hit?.id;
      };
      let fresh: Enemy[] = (nextWave.enemies ?? []).map((e: any, i: number) => ({
        id: e.id ?? `w${wavesSpawnedRef.current + 1}-${i}`,
        name: e.name, emoji: e.emoji, hp: e.hp, maxHp: e.maxHp ?? e.hp, damage: e.damage,
        archetypeId: resolveAid(e), family: e.family, role: e.role,
        ability: e.ability, abilityCooldown: e.abilityCooldown, abilityCooldownMax: e.abilityCooldownMax ?? e.abilityCooldown,
        telegraphLabel: e.telegraphLabel, tier: e.tier,
      }));
      // Telegraphed Attacks (L51+): wave-2 enemies must also carry intents
      // so their ⚡ badge appears and heavy strikes can fire on schedule.
      if (telegraphActive) {
        fresh = applyInitialIntents(fresh, level.generation_seed + wavesSpawnedRef.current + 1, level.level_number);
      }
      postWave = spawnWave(postWave, fresh, nextWave.reinforcement_turns ?? 2);
      wavesSpawnedRef.current += 1;
      const isBossWave = fresh.some(e => e.tier === 'boss');
      toast.success(isBossWave ? '👑 The Boss arrives!' : '⚔️ Wave 2 — Reinforcements!', { duration: 2000 });
      pushLog({
        kind: 'info',
        text: isBossWave
          ? `The ground trembles — the Boss enters! +${nextWave.reinforcement_turns ?? 2} turns granted.`
          : `Reinforcements arrive! +${nextWave.reinforcement_turns ?? 2} turns granted.`,
      });
    }
    // ── Daily Inferno: lose flat HP per turn (skipped on bonus moves). ──
    if (isDailyMode && !grantsBonusMove) {
      const drain = dailyHpDrainPerTurn(dailyMods);
      if (drain > 0) {
        afterEnemies.hp = Math.max(0, afterEnemies.hp - drain);
        turnLogs.push({ kind: 'corruption', text: '🔥 Inferno burns', amount: drain });
      }
    }
    // ── R5: Boss phase transitions ──────────────────────────────────────
    // Detect AFTER all damage has been applied for the turn (chain +
    // relic procs + any wave damage). Phase damage bumps apply to the
    // boss's `damage` field, which the engine reads on the NEXT
    // enemy turn — giving the player one "warning" turn between
    // hearing "Phase 2 — Awakened" and feeling the bigger hits.
    {
      const transitions = detectPhaseTransitions(postWave.enemies, bossPhasesRef.current);
      for (const t of transitions) {
        bossPhasesRef.current.set(t.enemyId, t.to);
        const e = postWave.enemies.find(e => e.id === t.enemyId);
        if (e) applyPhaseDamageBump(e, t);
        turnLogs.push({
          kind: 'info',
          text: `👑 ${t.enemyName} · ${t.def.name} — ${t.def.flavor}`,
        });
      }
      // V1 — fire the cinematic for the LAST transition in the batch.
      // If a chain crossed two thresholds in one swing (1→2→3), only
      // phase 3 gets the on-screen flash so the player doesn't see
      // two overlapping cinematics. Phase 2 still logs.
      if (transitions.length > 0) {
        const last = transitions[transitions.length - 1];
        setPhaseFlashMeta({ phase: last.to as 2 | 3, bossName: last.enemyName, flavor: last.def.flavor });
        setPhaseFlashKey(k => k + 1);
      }
    }
    setCombat(postWave);
    pushLogs(turnLogs);

    const status = evaluateObjective(postWave, activeTurnBudget, objType, level.objective_target);
    if (status.over) void finalize(postWave, status.cleared);
  };

  const handleAbility = () => {
    const relics = activeRelicsSnapshot ?? activeRelics;
    // First Light: the first N ability casts each run truly cost 0 mana — they
    // can fire at an empty pool, not just refund afterward. effectiveCost 0
    // lets useAbility resolve the cast while spending nothing.
    const isFreeCast = abilityFreeFirstUse(relics, abilityUsedCount);
    const effectiveCost = isFreeCast ? 0 : abilityManaCost;
    // Visual ability FX — cue whenever the cast will actually resolve.
    if (combat.mana >= effectiveCost) {
      const firstAlive = combat.enemies.find(e => e.hp > 0);
      const target = firstAlive ? findEnemyRect(firstAlive.id) : undefined;
      fxQ.trigger({ kind: 'ability', cls: hero.class, target });
      rdSfx(`ability.cast.${hero.class}` as any);
      if (hero.class === 'warrior') triggerCamShake(8);
    }
    const { next, ok } = activateAbility(combat, hero.class, bossRule, activeMasteries, level.level_number, effectiveCost);
    if (!ok) {
      toast.info('Ability not ready — fill mana orbs first.');
      return;
    }
    const turnLogs: Array<Omit<CombatLogEntry, 'id'>> = [];
    const ABILITY_LABEL: Record<string, string> = {
      warrior: 'Cleave swept the battlefield',
      mage: 'Arcane bolt crashed home',
      rogue: 'Shadowstep — next strike doubled',
      cleric: 'Sanctuary mended you',
    };
    const dealt = next.totalDamage - combat.totalDamage;
    const killed = next.enemiesDefeated - combat.enemiesDefeated;
    const healed = Math.max(0, next.hp - combat.hp);
    // Track which archetypes died from this ability for the Bestiary.
    if (killed > 0) {
      const newlyDead = next.enemies
        .filter(e => e.hp <= 0 && combat.enemies.find(o => o.id === e.id && o.hp > 0));
      newlyDead.forEach(recordKill);
    }
    turnLogs.push({
      kind: 'ability',
      text: ABILITY_LABEL[hero.class] ?? 'Ability unleashed',
      amount: dealt > 0 ? dealt : healed > 0 ? healed : undefined,
    });
    if (killed > 0) turnLogs.push({ kind: 'kill', text: killed > 1 ? `${killed} foes vanquished!` : 'A foe was vanquished!' });
    turnLogs.push({ kind: 'info', text: 'Free action — your turn continues.' });
    toast.success('✨ Ability — free action!', { duration: 1200 });

    // First Light: the cast already spent 0 mana (effectiveCost 0) — just flag it.
    let finalNext: CombatState = next;
    if (isFreeCast) {
      turnLogs.push({ kind: 'info', text: '🌅 First Light — free cast (0 mana)' });
      toast.success('🌅 First Light — free!', { duration: 1100 });
    }
    // ── Mastery: Mage T5 Overflow — every 4th mana spent refunds 1.
    // Only counts mana that was actually paid (not free casts).
    if (!isFreeCast) {
      const newSpent = totalManaSpent + abilityManaCost;
      setTotalManaSpent(newSpent);
      if (shouldMasteryRefundMana(activeMasteries, newSpent) && finalNext.mana < MAX_MANA) {
        finalNext = { ...finalNext, mana: Math.min(MAX_MANA, finalNext.mana + 1) };
        turnLogs.push({ kind: 'mana', text: '🌀 Overflow refunded mana', amount: 1 });
      }
    }
    setAbilityUsedCount(c => c + 1);

    // Abilities are now FREE actions: no enemy retaliation, no turn consumed,
    // no corruption spread. Player keeps their turn to chain again.
    let postWave = finalNext;
    const allDeadAbil = postWave.enemies.every(e => e.hp <= 0);
    if (allDeadAbil && waveDefs && wavesSpawnedRef.current < waveDefs.length) {
      const nextWave = waveDefs[wavesSpawnedRef.current];
      const resolveAid = (e: any): string | undefined => {
        if (e.archetypeId) return e.archetypeId;
        const raw = String(e.name ?? '').replace(/^(Elite |Boss |Mini-Boss |Echo of )/, '').trim().toLowerCase();
        if (!raw) return undefined;
        const hit = ENEMY_ROSTER.find(a => a.name.toLowerCase() === raw);
        return hit?.id;
      };
      let fresh: Enemy[] = (nextWave.enemies ?? []).map((e: any, i: number) => ({
        id: e.id ?? `w${wavesSpawnedRef.current + 1}-${i}`,
        name: e.name, emoji: e.emoji, hp: e.hp, maxHp: e.maxHp ?? e.hp, damage: e.damage,
        archetypeId: resolveAid(e), family: e.family, role: e.role,
        ability: e.ability, abilityCooldown: e.abilityCooldown, abilityCooldownMax: e.abilityCooldownMax ?? e.abilityCooldown,
        telegraphLabel: e.telegraphLabel, tier: e.tier,
      }));
      // Telegraphed Attacks (L51+): wave-2 enemies must also carry intents.
      if (telegraphActive) {
        fresh = applyInitialIntents(fresh, level.generation_seed + wavesSpawnedRef.current + 1, level.level_number);
      }
      postWave = spawnWave(postWave, fresh, nextWave.reinforcement_turns ?? 2);
      wavesSpawnedRef.current += 1;
      const isBossWave = fresh.some(e => e.tier === 'boss');
      toast.success(isBossWave ? '👑 The Boss arrives!' : '⚔️ Wave 2 — Reinforcements!', { duration: 2000 });
      pushLog({
        kind: 'info',
        text: isBossWave
          ? `The ground trembles — the Boss enters! +${nextWave.reinforcement_turns ?? 2} turns granted.`
          : `Reinforcements arrive! +${nextWave.reinforcement_turns ?? 2} turns granted.`,
      });
    }
    // R5: same boss-phase check as the other setCombat path — fires
    // for both the standard "turn ended" branch and the wave-spawn
    // branch so phase transitions never get skipped.
    {
      const transitions = detectPhaseTransitions(postWave.enemies, bossPhasesRef.current);
      for (const t of transitions) {
        bossPhasesRef.current.set(t.enemyId, t.to);
        const e = postWave.enemies.find(e => e.id === t.enemyId);
        if (e) applyPhaseDamageBump(e, t);
        turnLogs.push({
          kind: 'info',
          text: `👑 ${t.enemyName} · ${t.def.name} — ${t.def.flavor}`,
        });
      }
      // V1 — fire the cinematic for the LAST transition in the batch.
      // If a chain crossed two thresholds in one swing (1→2→3), only
      // phase 3 gets the on-screen flash so the player doesn't see
      // two overlapping cinematics. Phase 2 still logs.
      if (transitions.length > 0) {
        const last = transitions[transitions.length - 1];
        setPhaseFlashMeta({ phase: last.to as 2 | 3, bossName: last.enemyName, flavor: last.def.flavor });
        setPhaseFlashKey(k => k + 1);
      }
    }
    setCombat(postWave);
    pushLogs(turnLogs);
    const status = evaluateObjective(postWave, activeTurnBudget, objType, level.objective_target);
    if (status.over) void finalize(postWave, status.cleared);
  };

  async function finalize(final: CombatState, cleared: boolean) {
    if (submitting || !level || !hero) return;
    setSubmitting(true);
    // R4: if this was a Daily Chamber run (entered with ?dailyMod
    // query param), mark today's daily as played so the home card
    // gates against re-entry until UTC midnight. We mark on finalize
    // (clear OR fail) so abandoning mid-run doesn't burn the slot.
    const lockedModId = searchParams.get('dailyMod');
    if (lockedModId && user?.id) {
      const dateStr = todayUtcDateString();
      markDailyChamberPlayed(user.id, dateStr);
    }
    // R7: roll for a random relic drop on clear. Independent of the
    // shard reward — gives every chamber clear a "what will I pull?"
    // moment. The drop is persisted via the existing relic-unlock
    // mutation so it appears in the user's collection immediately.
    if (cleared && user?.id) {
      const ownedSet = new Set((ownedRelics ?? []).map(r => r.relic_id));
      const drop = rollRelicDrop({
        cleared: true,
        levelNumber: level.level_number,
        ownedRelicIds: ownedSet,
        // R2: Elite Path adds +8% drop chance on top of the base rate.
        bonusChance: pathEffect.bonusDropChance,
      });
      if (drop) {
        setDroppedRelic(drop.relic);
        try {
          await unlockRelic.mutateAsync({
            relic_id: drop.relic.id,
            level: level.level_number,
          });
        } catch {
          // If the insert fails (e.g. a stale dup race), the local
          // UI still shows the drop card — server state will catch
          // up on the next collection refetch. Swallowing keeps the
          // finalize flow non-blocking.
        }
      }
    }
    const turnsUsed = Math.max(0, activeTurnBudget - final.turnsRemaining);
    const relicsForFinal = activeRelicsSnapshot ?? activeRelics;
    // Optional Layered-Goal bonus (Band 4): met = extra score + shards. It is a
    // pure reward now, never a clear requirement (see evaluateObjective).
    const secondaryMetThisRun = !!(cleared && secondaryObjective
      && secondaryMet(secondaryObjective, final, activeTurnBudget));
    const rawBreakdown = calculateScore({
      totalDamage: final.totalDamage,
      enemiesDefeated: final.enemiesDefeated,
      hpRemaining: final.hp,
      turnsRemaining: final.turnsRemaining,
      longestChain: final.longestChain,
      cleared,
      rogueBonus: final.rogueBonusTriggered && hero.class === 'rogue',
      secondaryBonus: secondaryMetThisRun,
    });
    // Momentum: scale final score when longest chain >= 4.
    const momentumMult = momentumScoreBonusMult(relicsForFinal, final.longestChain);
    // Mastery: Rogue T1 Gilded Eye — +2 score per gold rune cleared.
    const goldEyeBonus = getMasteryGoldScoreBonus(activeMasteries, goldRunesCleared);
    // Chamber-layout treasure bonus accrued during the run (R1).
    // Added flat (after the momentum multiplier) so it reads as its
    // own line — treasure is a board property, not a chain bonus.
    const treasureScore = bonusScoreFromTreasure;
    // R3 — Run modifier score multiplier. Applied LAST so it composes
    // over everything (base + momentum + goldEye + treasure).
    const modScoreMult = resolveEffect(activeModifier).scoreMult;
    const preMod = momentumMult > 1
      ? Math.round(rawBreakdown.total * momentumMult) + goldEyeBonus + treasureScore
      : rawBreakdown.total + goldEyeBonus + treasureScore;
    const breakdown = { ...rawBreakdown, total: Math.round(preMod * modScoreMult) };
    const xp = xpForRun(breakdown.total, cleared);
    const reason: 'cleared' | 'defeated' | 'timeout' = cleared ? 'cleared' : final.hp <= 0 ? 'defeated' : 'timeout';
    // OPTIMISTIC isNewBest — used only for the immediate end-state card. The
    // canonical, server-truth value is taken from the mutation result below
    // and used for hero XP/lifetime increments.
    const isNewBest = !existingRun || breakdown.total > (existingRun.score ?? 0);

    // ── Rune Shards reward ────────────────────────────────────────────────
    const compassEquipped = has(relicsForFinal, 'wanderers_compass');
    const compassMultiplier = compassShardBonus(relicsForFinal);
    const isFirstClear = cleared && (!existingRun || !existingRun.dungeon_cleared);
    const bossClear = cleared && level.level_number % 25 === 0;
    const totalEnemies = (level.enemy_config?.length ?? final.enemies.length) || 1;
    let shardsAwarded = 0;
    // Daily Greed multiplies shard reward; bonus shards from Rogue T5 mastery
    // get added on top after the base computation.
    const dailyShardMult = isDailyMode ? dailyShardMultiplier(dailyMods) : 1;
    const masteryBonusShards = bonusShardsFromMastery;
    // Treasure-cell shard pickups from the chamber layout (R1).
    // Added flat to the awarded total at the same point as mastery
    // bonuses so the player sees consistent reward arithmetic.
    const treasureBonusShards = bonusShardsFromTreasure;
    try {
      if (cleared) {
        const breakdownShards = computeClearShards({
          levelNumber: level.level_number,
          isFirstClear,
          bossClear,
          chapterCleared: false,
          compassEquipped,
          compassMultiplier,
        });
        shardsAwarded = breakdownShards.total;
      } else {
        const nextFailureCount = (failureRow?.failure_count ?? 0) + 1;
        const breakdownShards = computeFailureShards({
          levelNumber: level.level_number,
          failureCount: nextFailureCount,
          enemiesKilled: final.enemiesDefeated,
          totalEnemies,
          turnsUsed,
          turnLimit: level.turn_limit,
          bossPhaseReached: 0,
          bossHasRule: !!bossRule,
          compassEquipped,
          compassMultiplier,
        });
        shardsAwarded = breakdownShards.total;
      }
    } catch { shardsAwarded = 0; }
    // Apply Daily Greed multiplier + Rogue T5 bonus shards on top.
    if (dailyShardMult !== 1) shardsAwarded = Math.round(shardsAwarded * dailyShardMult);
    // R2: path-variant shard bonus (Treasure +25%, Elite +50%).
    // Applied after the daily multiplier but before the additive
    // bonuses (mastery/treasure cells) so the multiplicative effects
    // compose cleanly without scaling the additive bonuses.
    if (pathEffect.shardBonusMult !== 1) {
      shardsAwarded = Math.round(shardsAwarded * pathEffect.shardBonusMult);
    }
    shardsAwarded += masteryBonusShards;
    shardsAwarded += treasureBonusShards;
    // Layered-Goal bonus shards — meeting the optional secondary objective now
    // pays out (it used to be a hidden clear requirement with no extra reward).
    const secondaryBonusShards = secondaryMetThisRun ? 10 : 0;
    shardsAwarded += secondaryBonusShards;
    if (secondaryMetThisRun) {
      pushLog({ kind: 'info', text: `🎯 Bonus objective met · +250 score · +${secondaryBonusShards} shards` });
    }
    setEndState({ cleared, reason, score: breakdown.total, isNewBest, shards: shardsAwarded });
    rdSfx(cleared ? 'victory' : 'defeat');
    try {
      // Server-truth flags. Default to the optimistic value so legacy
      // (transient-level) submissions still award XP correctly.
      let serverWasNewBest = isNewBest;
      let improvedChain = false;
      let improvedTurns = false;
      let improvedHp = false;
      let firstClear = false;

      // Don't submit transient levels (admin hasn't seeded them yet).
      if (!level.id.startsWith('transient-')) {
        // Signal to the results page that a run was just submitted, so
        // useMyLevelRun knows to briefly retry instead of showing the
        // "No run yet" empty state if Postgrest hasn't caught up.
        try {
          sessionStorage.setItem(
            `rd-just-submitted-${level.level_number}`,
            String(Date.now()),
          );
        } catch { /* sessionStorage may be unavailable */ }
        const result = await submit.mutateAsync({
          level_id: level.id,
          level_number: level.level_number,
          score: breakdown.total,
          enemies_defeated: final.enemiesDefeated,
          dungeon_cleared: cleared,
          turns_used: turnsUsed,
          total_damage: final.totalDamage,
          longest_chain: final.longestChain,
          hp_remaining: final.hp,
          xp_earned: xp,
          ability_used: final.abilityUsed,
          hero_class: hero.class,
        });
        serverWasNewBest = result.wasNewBest;
        improvedChain = result.improvedChain;
        improvedTurns = result.improvedTurns;
        improvedHp = result.improvedHp;
        firstClear = result.firstClear;
        // Hand the improvement flags to the Results page so it can render
        // the "secondary improvement" chip even though the saved row has
        // already been merged (and thus doesn't reveal what changed).
        try {
          sessionStorage.setItem(
            `rd-improvements-${level.level_number}`,
            JSON.stringify({
              ts: Date.now(),
              wasNewBest: serverWasNewBest,
              improvedChain,
              improvedTurns,
              improvedHp,
              firstClear,
              turnsUsed,
              longestChain: final.longestChain,
              hpRemaining: final.hp,
            }),
          );
        } catch { /* sessionStorage may be unavailable */ }
        // Reflect server truth on the end-state card so the toast + chip
        // matches what's actually persisted.
        setEndState(prev => prev ? {
          ...prev,
          isNewBest: serverWasNewBest,
          improvedChain,
          improvedTurns,
          improvedHp,
          firstClear,
        } : prev);
        if (cleared) await advance.mutateAsync(level.level_number);
      }
      // Hero + class progression.
      //   • Lifetime totals (runs, score) and the daily streak advance on
      //     EVERY completed run — so `lifetime_runs` counts all runs (not just
      //     new bests) and `lifetime_score` is a true running total instead of
      //     re-adding the whole best each improved replay.
      //   • XP / level / title / mastery only advance on a SERVER-confirmed new
      //     best — keeps grinding fair and prevents stale-cache double-counts.
      {
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(new Date(Date.now() - 86_400_000), 'yyyy-MM-dd');
        const continued = hero.last_run_date === yesterday;
        const newStreak = continued ? hero.current_streak + 1 : hero.last_run_date === today ? hero.current_streak : 1;

        // ── Per-class progression ──────────────────────────────────────
        // XP, level, and class title belong to the ACTIVE CLASS track only.
        // Other classes' saved progress is untouched.
        const activeTrack = classTracks?.find(t => t.class === hero.class);
        const prevClassXp = activeTrack?.xp ?? hero.xp;
        const prevClassLevel = activeTrack?.level ?? hero.level;
        // XP is earned only on a new best; otherwise progression holds steady
        // while lifetime totals still accrue below.
        const gainedXp = serverWasNewBest ? xp : 0;
        const newClassXp = prevClassXp + gainedXp;
        const newClassLevel = levelFromXp(newClassXp).level;
        const equippedClassTitle = titleForLevel(newClassLevel, hero.class) ?? activeTrack?.cosmetic_title ?? null;
        const titleUnlock = serverWasNewBest ? newTitleUnlocked(hero.class, prevClassLevel, newClassLevel) : null;

        await updateClass.mutateAsync({
          cls: hero.class,
          patch: {
            xp: newClassXp,
            level: newClassLevel,
            cosmetic_title: equippedClassTitle,
            lifetime_runs: (activeTrack?.lifetime_runs ?? 0) + 1,
            lifetime_score: (activeTrack?.lifetime_score ?? 0) + breakdown.total,
          },
        });

        // Hero record holds persistent identity + global lifetime totals only.
        // Mirror the active class's level/xp/title so legacy leaderboard
        // queries that read from `rune_delve_heroes` still show the right
        // active-class snapshot.
        await updateHero.mutateAsync({
          xp: newClassXp,
          level: newClassLevel,
          cosmetic_title: equippedClassTitle,
          current_streak: newStreak,
          best_streak: Math.max(hero.best_streak, newStreak),
          lifetime_runs: hero.lifetime_runs + 1,
          lifetime_score: hero.lifetime_score + breakdown.total,
          last_run_date: today,
        } as any);

        if (titleUnlock) {
          toast.success(`✨ New Title Unlocked — ${titleUnlock.next}`, {
            description: titleUnlock.previous
              ? `From ${titleUnlock.previous} · ${hero.class} Lv ${newClassLevel}`
              : `Equipped at ${hero.class} Lv ${newClassLevel}`,
            duration: 6000,
          });
        }
        // ── Class Mastery: celebratory toast when a new tier just unlocked.
        const newMastery = serverWasNewBest ? masteryUnlockedAt(hero.class, prevClassLevel, newClassLevel) : null;
        if (newMastery) {
          toast.success(`🌟 Mastery Unlocked — ${newMastery.name}`, {
            description: `${newMastery.summary} · Tier ${newMastery.tier} · ${hero.class} Lv ${newMastery.unlockLevel}`,
            duration: 7000,
          });
        }
      }

      // ── Award Rune Shards & track failure curve ─────────────────────────
      try {
        if (shardsAwarded > 0) await earnShards.mutateAsync(shardsAwarded);
        if (cleared) {
          await resetFailure.mutateAsync(level.level_number);
        } else {
          await bumpFailure.mutateAsync(level.level_number);
        }
        // Auto-unlock 3rd slot when ANY class hits the threshold.
        const tracks = classTracks ?? [];
        const maxClassLevel = Math.max(
          hero.level,
          ...tracks.map(t => t.level),
        );
        const desired = slotsForClassLevels(maxClassLevel);
        if ((wallet?.slots_unlocked ?? 2) < desired) {
          await unlockSlot.mutateAsync(desired);
          toast.success('🔓 3rd Relic Slot Unlocked!', { duration: 4500 });
        }
      } catch { /* shards are best-effort */ }

      // ── Bestiary: record defeats from this run ─────────────────────────
      try {
        const defeats = Array.from(defeatedArchetypesRef.current.entries()).map(
          ([archetypeId, count]) => ({ archetypeId, count, levelNumber: level.level_number }),
        );
        if (defeats.length > 0) {
          const { newlyDiscovered } = await recordDefeats.mutateAsync(defeats);
          if (newlyDiscovered.length > 0) {
            const allNames = newlyDiscovered.map(id => rosterById(id)?.name ?? 'Unknown');
            // Battle Chronicle: one discovery line per newly-logged foe so the
            // post-run log mirrors what the toast announces.
            pushLogs(allNames.map(name => ({
              kind: 'info' as const,
              text: `📖 Bestiary updated: ${name}`,
            })));
            const names = allNames.slice(0, 3);
            const more = newlyDiscovered.length - names.length;
            toast.success(
              newlyDiscovered.length === 1
                ? `📖 Bestiary: ${names[0]} discovered!`
                : `📖 Bestiary: ${names.join(', ')}${more > 0 ? ` +${more} more` : ''}`,
              { duration: 4000 },
            );
          }
        }
      } catch { /* bestiary write is best-effort */ }

      // ── Quests: report progress for this run (best-effort, never throws) ─
      try {
        const enemyKills = Array.from(defeatedArchetypesRef.current.values()).reduce((a, b) => a + b, 0);
        const bossKills = Array.from(defeatedArchetypesRef.current.entries())
          .filter(([id]) => rosterById(id)?.role === 'controller')
          .reduce((sum, [, n]) => sum + n, 0);
        // Use the ACTUAL longest chain length this run (final.longestChain),
        // not the count of chains made — the quest tracks max chain LENGTH.
        const longestChain = final.longestChain;
        const heroClass = hero?.class;
        type QEvent = Parameters<typeof reportQuestProgress>[0];
        const events: QEvent[] = [
          { type: 'enemies_defeated', amount: enemyKills, heroClass },
          { type: 'longest_chain', amount: 0, heroClass, meta: { chainLength: longestChain } },
          { type: 'total_score', amount: breakdown.total, heroClass },
        ];
        if (cleared) {
          events.push({ type: 'levels_cleared', amount: 1, heroClass });
          events.push({ type: 'class_run_complete', amount: 1, heroClass });
          events.push({ type: 'high_level_clears', amount: 1, heroClass, meta: { levelNumber: level.level_number } });
          // Genuinely damage-free run — the hero never lost HP at any point
          // (not merely healed back to full by the end).
          if (!tookDamageRef.current) {
            events.push({ type: 'no_damage_clear', amount: 1, heroClass });
          }
        }
        if (bossKills > 0) {
          events.push({ type: 'bosses_defeated', amount: bossKills, heroClass, meta: { isBoss: true } });
        }
        if (shardsAwarded > 0) {
          events.push({ type: 'shards_earned', amount: shardsAwarded, heroClass });
        }
        // Power Move: count special-ability uses per run (not gated by clear).
        if (abilityUsedCount > 0) {
          events.push({ type: 'abilities_used', amount: abilityUsedCount, heroClass });
        }
        // Path of Mastery: only credit class XP when the server actually
        // awarded XP (new best clear), so quest progress mirrors progression.
        if (serverWasNewBest && xp > 0) {
          events.push({ type: 'class_xp_earned', amount: xp, heroClass });
        }
        for (const e of events) {
          await reportQuestProgress(e);
        }
      } catch (err) { console.warn('[quests] progress report failed', err); }

      // Daily challenge submission no longer happens here — Endless Survival
      // handles its own submission flow on its own page.

      setTimeout(() => navigate(`/rune-delve/results/${level.level_number}`), 2500);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save run');
      setSubmitting(false);
      setEndState(null);
    }
  }

  const status = evaluateObjective(combat, activeTurnBudget, objType, level.objective_target);
  const objectiveProgress = getObjectiveProgress(combat, activeTurnBudget, objType, level.objective_target);
  const primaryTargetId = filterTargetable(bossRule, combat.enemies)[0]?.id ?? null;
  const turnDisplay = Math.min(
    activeTurnBudget,
    Math.max(1, activeTurnBudget - combat.turnsRemaining + (status.over ? 0 : 1)),
  );

  const equippedCount = [loadout?.slot_1, loadout?.slot_2, loadout?.slot_3].filter(Boolean).length;

  return (
    <div ref={playRootRef} className="space-y-2 pb-2 relative">
      {/* V5 — chamber atmospheric backdrop. Reads the active layout's
          atmosphere keyword + accent color and paints a per-chamber
          wash behind everything else on the play page. Fixed-position
          at z-index -1 so all UI sits on top, untouched. */}
      <ChamberBackdrop layout={activeLayout} />
      {/* Cinematic combat FX overlay — chains, abilities, tier flourishes. */}
      <FxLayer queue={fxQ.queue} onComplete={fxQ.complete} />
      <FloatingNumberLayer floaters={floaters.floaters} onComplete={floaters.complete} />
      <ScreenEdgeFlash hurtKey={hurtFlashKey} healKey={healFlashKey} heavyKey={heavyFlashKey} />
      {/* V1 — heavy-strike chyron over the board for chains ≥ 6. */}
      <HeavyStrikeBanner triggerKey={heavyFlashKey} chainLength={heavyChainLen} />
      {/* V1 — full-screen cinematic for R5 boss phase transitions. */}
      <PhaseTransitionFlash
        triggerKey={phaseFlashKey}
        phaseIndex={phaseFlashMeta.phase}
        bossName={phaseFlashMeta.bossName}
        flavor={phaseFlashMeta.flavor}
      />
      {/* Compact combined HUD: turn counter + objective on a single row */}
      <div className="rd-carved rounded-xl px-3 py-2 space-y-1.5" style={{ borderRadius: '0.75rem' }}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary px-1.5 py-0.5 rounded bg-primary/20 shrink-0">
            L{level.level_number}
          </span>
          <span className="text-[11px] font-extrabold tabular-nums text-foreground/95 shrink-0">
            T{turnDisplay}/{activeTurnBudget}
          </span>
          <span className="h-3 w-px bg-foreground/15 shrink-0" />
          <span className="text-[11px] font-bold flex-1 min-w-0 truncate text-foreground/95">
            {objectiveLabel(objType)}
          </span>
          {existingRun && (
            <span className="text-[10px] font-mono font-extrabold tabular-nums text-foreground/70 shrink-0">
              ★{existingRun.score.toLocaleString()}
            </span>
          )}
          {equippedCount > 0 && (
            <Link
              to="/rune-delve/armory"
              aria-label={`${equippedCount} relics equipped`}
              className="inline-flex items-center gap-0.5 px-1.5 h-6 rounded-full text-[10px] font-extrabold tabular-nums btn-press shrink-0"
              style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))' }}
            >
              🛡️{equippedCount}
            </Link>
          )}
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="How to play"
            className="w-7 h-7 -mr-1 rounded-full flex items-center justify-center text-foreground/70 hover:text-primary btn-press shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2" aria-label={`${objectiveLabel(objType)}: ${objectiveProgress.text}`}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${objectiveProgress.percent}%` }}
            />
          </div>
          <span className="shrink-0 text-[9px] font-extrabold tabular-nums text-foreground/65">
            {objectiveProgress.text}
          </span>
        </div>
      </div>

      {/* Active mechanics strip — only when this level uses any mechanic */}
      {activeMechanics.length > 0 && <MechanicBanner mechanics={activeMechanics} />}

      {/* Layered Goals — secondary objective pill (Band 4). */}
      {secondaryObjective && (() => {
        const met = secondaryMet(secondaryObjective, combat, activeTurnBudget);
        return (
          <div
            className="glass-card px-3 py-2 flex items-center gap-2"
            style={{ borderColor: met ? 'hsl(var(--primary) / 0.45)' : undefined }}
          >
            <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1"
              style={{ background: 'hsl(var(--accent) / 0.22)', color: 'hsl(var(--accent))', border: '1px solid hsl(var(--accent) / 0.35)' }}>
              <Target className="w-3 h-3" /> Bonus
            </span>
            <span className="text-[12px] font-extrabold flex-1 truncate text-foreground/95">{secondaryLabel(secondaryObjective)}</span>
            <span className={`text-[10px] font-extrabold tabular-nums ${met ? 'text-primary' : 'text-muted-foreground'}`}>
              {met ? '✓ Met' : secondaryShort(secondaryObjective)}
            </span>
          </div>
        );
      })()}

      {/* Boss-rule banner — Band 5 milestone levels. */}
      {bossRule && (
        <div
          className="glass-card px-3 py-2 flex items-start gap-2"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.14), hsl(var(--gold) / 0.08))',
            borderColor: 'hsl(var(--destructive) / 0.4)',
          }}
        >
          <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 mt-0.5"
            style={{ background: 'hsl(var(--destructive) / 0.2)', color: 'hsl(var(--destructive))' }}>
            <Crown className="w-3 h-3" /> {getBossRule(bossRule).label}
          </span>
          <span className="text-[11px] font-semibold flex-1 min-w-0 leading-snug">{getBossRule(bossRule).rule}</span>
        </div>
      )}
      <EnemyDisplay enemies={combat.enemies} flashId={flashId} primaryTargetId={primaryTargetId} />
      <HeroStatusBar state={combat} cls={hero.class} onAbility={handleAbility} manaCost={abilityManaCost} />

      <RuneBoard
        grid={grid}
        disabled={status.over || submitting}
        onChainComplete={handleChain}
        seals={seals}
        corruptedCells={corruption.cells}
        corruptionSources={corruption.sources}
        eclipsedCells={eclipse}
        linkedCells={new Set(linkedPairs.pairs.keys())}
        shiftingColumn={shift.column}
        treasureCells={layoutZones.treasure}
        hazardCells={layoutZones.hazard}
        effectOverride={{
          // Class-aware previews. Tier bonus shows when chain hits 6+.
          red: (n) => {
            const base = redChainDamage(n, hero.class, level.level_number);
            const tier = n >= 8 ? 1.4 : n >= 7 ? 1.3 : n >= 6 ? 1.2 : 1;
            const total = Math.round(base * tier);
            return tier > 1 ? `${total} dmg ⚡` : `${total} dmg`;
          },
          blue: (n) => {
            let mana = hero.class === 'mage' ? 2 : 1;
            if (n >= 5) mana += 1;
            return `+${mana} orb${mana > 1 ? 's' : ''}`;
          },
          green: (n) => {
            const base = n * 6;
            const heal = hero.class === 'cleric' ? Math.round(base * 1.5) : base;
            return `+${heal} HP`;
          },
        }}
      />

      {/* Compact single-line combat stats strip — keeps the board above the fold. */}
      <div
        className="flex items-center justify-around gap-2 px-3 py-1.5 rounded-lg"
        style={{
          background: 'hsl(var(--rd-stone-edge) / 0.6)',
          border: '1px solid hsl(var(--gold) / 0.12)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/80">DMG</span>
          <span className="text-[12px] font-extrabold tabular-nums text-foreground">{combat.totalDamage}</span>
        </div>
        <span className="h-3 w-px bg-foreground/25" />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/80">KILLS</span>
          <span className="text-[12px] font-extrabold tabular-nums text-foreground">{combat.enemiesDefeated}</span>
        </div>
        <span className="h-3 w-px bg-foreground/25" />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/80">CHAIN</span>
          <span className="text-[12px] font-extrabold tabular-nums text-foreground">{combat.longestChain}</span>
        </div>
      </div>

      {/* Animated battle chronicle — turn-by-turn flavor feed. */}
      <CombatLog entries={log} />

      <HowToPlaySheet open={helpOpen} onOpenChange={setHelpOpen} heroClass={hero.class} />

      {/* One-time intro for a brand-new mechanic taught at this level. */}
      {introMechanic && (
        <MechanicIntroSheet
          open={!!introMechanic}
          onOpenChange={(o) => { if (!o) setIntroMechanic(null); }}
          mechanicId={introMechanic}
          levelNumber={level.level_number}
          onBegin={() => {
            try { localStorage.setItem(seenMechanicKey(introMechanic), '1'); } catch {}
            setIntroMechanic(null);
          }}
        />
      )}

      {/* One-time intro for a boss-rule level (chapter & mid-chapter bosses). */}
      {introBossRule && !introMechanic && (
        <MechanicIntroSheet
          open={!!introBossRule}
          onOpenChange={(o) => { if (!o) setIntroBossRule(null); }}
          bossRuleId={introBossRule}
          levelNumber={level.level_number}
          onBegin={() => {
            try { localStorage.setItem(`rd-seen-bossrule-${introBossRule}`, '1'); } catch {}
            setIntroBossRule(null);
          }}
        />
      )}

      {endState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-md bg-background/70 animate-in fade-in"
          // Don't allow tap-outside to navigate while the run is still being saved —
          // prevents an orphaned in-flight write and a missed leaderboard update.
          onClick={() => { if (!submitting) navigate(`/rune-delve/results/${level.level_number}`); }}
        >
          <div className="glass-card p-6 max-w-sm w-full text-center space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center">
              {endState.reason === 'cleared' && <Trophy className="w-12 h-12" style={{ color: 'hsl(var(--gold))' }} />}
              {endState.reason === 'defeated' && <Skull className="w-12 h-12 text-destructive" />}
              {endState.reason === 'timeout' && <Hourglass className="w-12 h-12 text-muted-foreground" />}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                {endState.reason === 'cleared' && `Level ${level.level_number} Cleared!`}
                {endState.reason === 'defeated' && 'Defeated'}
                {endState.reason === 'timeout' && 'Out of Turns'}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {endState.reason === 'cleared' && (endState.isNewBest ? 'New best score!' : 'Run complete.')}
                {endState.reason === 'defeated' && 'Your hero fell in battle.'}
                {endState.reason === 'timeout' && 'Try a different chain strategy.'}
              </p>
            </div>
            <div className="py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Final Score</p>
              <p className="text-3xl font-extrabold font-mono tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                {endState.score.toLocaleString()}
              </p>
              {endState.shards > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold"
                  style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                  💠 +{endState.shards} Rune Shards
                </div>
              )}
              {/* R7: relic drop banner — celebratory card when the
                  clear rolled a free unlock. Sits below the shard
                  bonus so the visual order is: score → shards → relic. */}
              {droppedRelic && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.15 }}
                  className="mt-3 rounded-xl p-3 flex items-center gap-3 text-left"
                  style={{
                    background: 'linear-gradient(135deg, hsl(var(--gold) / 0.18), hsl(var(--gold) / 0.05))',
                    border: '1px solid hsl(var(--gold) / 0.45)',
                    boxShadow: '0 0 24px -6px hsl(var(--gold) / 0.45)',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, hsl(var(--gold) / 0.28), hsl(var(--gold) / 0.08))',
                      border: '1px solid hsl(var(--gold) / 0.55)',
                    }}
                    aria-hidden
                  >
                    {droppedRelic.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(var(--gold))' }}>
                      ✨ Relic dropped
                    </p>
                    <p className="text-[13px] font-extrabold tracking-tight leading-tight mt-0.5">
                      {droppedRelic.name}
                    </p>
                    <p className="text-[10.5px] text-foreground/70 leading-snug mt-0.5 line-clamp-2">
                      {droppedRelic.description}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
            <button
              onClick={() => navigate(`/rune-delve/results/${level.level_number}`)}
              className="w-full h-11 rounded-xl font-extrabold text-sm btn-press"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                color: 'white',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              View Results
            </button>
          </div>
        </div>
      )}

      {/* R3 — Chamber boon picker. Shown at run-start with three
          random modifiers + a Skip ("Steady Path") option. Once the
          player picks, the modifier persists for the rest of the run
          (saved into snapshot so backgrounding doesn't lose it). */}
      {modifierOffer && !activeModifier && !status.over && (
        <RunModifierPicker
          offer={modifierOffer}
          onPick={(mod) => { setActiveModifier(mod); setModifierOffer(null); }}
          onSkip={() => { setActiveModifier(STEADY_PATH); setModifierOffer(null); }}
        />
      )}
    </div>
  );
}

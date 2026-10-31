import { progressionRewardItems } from "@/lib/runedelve/rewardPresentation";
import {
  RuneRewardGallery,
  type RuneRewardItem,
} from "@/components/runedelve/RuneRewardReveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResonanceMeter } from "@/components/runedelve/ResonanceMeter";
import { RunePager } from "@/components/runedelve/RunePager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Info, Shield, Sword, Gem, Zap } from "lucide-react";
import { getMechanic } from "@/lib/runedelve/mechanics";
import "@/components/runedelve/runeBattle.css";
import { motion } from "framer-motion";
import {
  useNavigate,
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  HelpCircle,
  Trophy,
  Skull,
  Hourglass,
  Sparkles as SparklesIcon,
} from "lucide-react";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { useAllClassProgress } from "@/hooks/useRuneDelveClassProgress";
import {
  useLevel,
  useMyLevelRun,
  useSubmitLevelRun,
  useMyProgress,
  type SubmitLevelRunInput,
} from "@/hooks/useRuneDelveCampaign";
import { mulberry32 } from "@/lib/runedelve/prng";
import {
  generateBoard,
  type RuneType,
  type Enemy,
} from "@/lib/runedelve/dungeonGenerator";
import {
  isValidChain,
  resolveBoard,
  ensurePlayableBoard,
  cellKey,
  type Cell,
} from "@/lib/runedelve/boardEngine";
import {
  applyChain,
  enemiesAttack,
  endTurn,
  initialCombat,
  redChainPower,
  chainTier,
  damageEnemies,
  useAbility as activateAbility,
  type CombatState,
} from "@/lib/runedelve/combatEngine";
import { applyOpeningModifier } from "@/lib/runedelve/openingModifier";
import { advanceResonance } from "@/lib/runedelve/resonance";
import { calculateScore } from "@/lib/runedelve/scoring";
import { campaignXpForAttempt } from "@/lib/runedelve/economyProgression";
import {
  evaluateObjective,
  getObjectiveProgress,
  normalizeScoreObjectiveTarget,
} from "@/lib/runedelve/objectives";
import {
  levelFromXp,
  getClass,
  titleForLevel,
} from "@/lib/runedelve/classConfig";
import { useLoadout } from "@/hooks/useLoadout";
import { useFailureRow, useRuneWallet } from "@/hooks/useRuneShards";
import { useRecordDefeats } from "@/hooks/useBestiary";
import { rosterById } from "@/lib/runedelve/enemyRoster";
import { spawnWave } from "@/lib/runedelve/combatEngine";
import {
  useRelicCollection,
  rankMapFromOwned,
} from "@/hooks/useRelicCollection";
import {
  buildActive,
  getStartingMana,
  getRelicRankMaxHpBonus,
  getLifestealHealAmount,
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
  cleansingTouchHpCost,
  thornsRelicMultiplier,
  getForeseerBonusTurns,
  getVoidPactHpCost,
  tryPhoenixHeart,
  type ActiveRelics,
} from "@/lib/runedelve/relicEffects";
import { MAX_MANA } from "@/lib/runedelve/combatEngine";
import {
  computeClearShards,
  computeFailureShards,
  failureMultiplier,
  slotsForClassLevels,
} from "@/lib/runedelve/shardEconomy";

import {
  objectiveLabel,
  type ObjectiveType,
} from "@/lib/runedelve/levelGenerator";
import {
  mechanicsForLevel,
  introMechanicForLevel,
  seenMechanicKey,
  type MechanicId,
} from "@/lib/runedelve/mechanics";
import {
  buildInitialSeals,
  sealsBrokenByChain,
} from "@/lib/runedelve/sealedTiles";
import {
  computeLayoutZones,
  countChainInZone,
  EMPTY_ZONES,
  TREASURE_SCORE_BONUS,
  treasureShardValue,
  HAZARD_DAMAGE,
  HAZARD_MAX_DAMAGE_PER_CHAIN,
} from "@/lib/runedelve/layoutZones";
import { getLayoutIdForLevel } from "@/lib/runedelve/chamberAssignment";
import { getLayout } from "@/lib/runedelve/runeLayouts";
import { ChamberBackdrop } from "@/components/runedelve/ChamberBackdrop";
import {
  type RunModifier,
  pickModifierOffer,
  resolveEffect,
  getModifierById,
  STEADY_PATH,
} from "@/lib/runedelve/runModifiers";
import { RunModifierPicker } from "@/components/runedelve/RunModifierPicker";
import { todayUtcDateString } from "@/lib/runedelve/dailyChallenge";
import { markDailyChamberPlayed } from "@/lib/runedelve/dailyChamber";
import { getRelic } from "@/lib/runedelve/relics";
import {
  getPathVariant,
  resolvePathEffect,
} from "@/lib/runedelve/pathVariants";
import {
  detectPhaseTransitions,
  restoreBossPhases,
  applyPhaseDamageBump,
  type BossPhaseIndex,
} from "@/lib/runedelve/bossPhases";
import {
  campaignTurnBudget,
  prepareCampaignEnemies,
} from "@/lib/runedelve/campaignEncounter";
import {
  buildInitialCorruption,
  spreadCorruption,
  resolveChainAgainstCorruption,
  emptyCorruption,
  CORRUPTION_BITE,
  type CorruptionState,
} from "@/lib/runedelve/corruptedTiles";
import {
  buildInitialShift,
  applyShift,
  type ShiftState,
} from "@/lib/runedelve/shiftingRunes";
import {
  buildInitialPairs,
  pairsTriggeredByChain,
  consumePairs,
  type LinkedPairsState,
} from "@/lib/runedelve/linkedPairs";
import {
  buildInitialEclipse,
  type EclipseSet,
} from "@/lib/runedelve/eclipseTiles";
import {
  secondaryMet,
  secondaryShort,
  secondaryLabel,
  type SecondaryObjective,
} from "@/lib/runedelve/layeredGoals";
import {
  getBossRule,
  filterTargetable,
  type BossRuleId,
} from "@/lib/runedelve/bossRules";
import { useSubmitDailyRun } from "@/hooks/useDailyChallenge";
import { useActiveQuests } from "@/hooks/useQuests";
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
} from "@/lib/runedelve/dailyModifierEffects";
// NOTE: Daily challenge is now Endless Survival (separate page). Campaign
// play never enters daily mode — `isDailyMode` is always false here.
import {
  getActiveMasteries,
  type MasteryId,
} from "@/lib/runedelve/classMastery";
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
  getMasteryMaxHpBonus,
  getMasteryGoldScoreBonus,
  getMasteryOpeningCritMult,
  getMasteryChainCritChance,
  hasMasteryAegis,
  hasMasteryPanicShield,
  reviveBurstActive,
} from "@/lib/runedelve/masteryEffects";
import { chapterFor } from "@/lib/runedelve/levelGenerator";
import { Crown, Target } from "lucide-react";
import { RuneBoard } from "@/components/runedelve/RuneBoard";
import { EnemyDisplay } from "@/components/runedelve/EnemyDisplay";
import { HeroStatusBar } from "@/components/runedelve/HeroStatusBar";
import { CombatFeedback } from "@/components/runedelve/CombatFeedback";
import { HowToPlaySheet } from "@/components/runedelve/HowToPlaySheet";
import { MechanicIntroSheet } from "@/components/runedelve/MechanicIntroSheet";
import {
  CombatLog,
  type CombatLogEntry,
} from "@/components/runedelve/CombatLog";
import { FxLayer } from "@/components/runedelve/fx/FxLayer";
import { useFxQueue, type FxRect } from "@/hooks/useFxQueue";
import { useSoundEffect } from "@/hooks/useSoundEffect";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import { PhaseTransitionFlash } from "@/components/runedelve/fx/PhaseTransitionFlash";
import { HeavyStrikeBanner } from "@/components/runedelve/fx/HeavyStrikeBanner";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildSnapshot,
  clearSnapshot,
  loadSnapshot,
  rehydrateRelics,
  saveSnapshot,
  snapshotKey,
} from "@/lib/runedelve/runSnapshot";

import type { AbilityEffect } from "@/lib/runedelve/enemyAbilities";

type StoredEnemy = Omit<Enemy, "id" | "maxHp"> &
  Partial<Pick<Enemy, "id" | "maxHp">>;
type ChamberModifiers = {
  mechanics?: MechanicId[];
  secondary_objective?: SecondaryObjective;
  boss_rule?: BossRuleId;
  intro_mechanic?: MechanicId;
  waves?: Array<{ enemies: StoredEnemy[]; reinforcement_turns: number }>;
};

interface RunRewardTotals {
  goldRunesCleared: number;
  bonusShardsFromMastery: number;
  bonusScoreFromTreasure: number;
  bonusShardsFromTreasure: number;
  abilityUsedCount: number;
}

const RUNE_LABEL: Record<RuneType, string> = {
  red: "Crimson",
  blue: "Azure",
  green: "Verdant",
  gold: "Radiant",
};

// Timestamp + module counter stays unique across mobile reload/resume. A bare
// counter restarted at l-1 after reload and collided with restored log rows,
// which caused React to duplicate or omit animated entries.
let logSeq = 0;
const nextLogId = () => `l-${Date.now()}-${++logSeq}`;

export default function RuneDelvePlayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { levelNumber: levelParam } = useParams<{ levelNumber: string }>();
  const [searchParams] = useSearchParams();
  // Daily challenge is now Endless Survival (separate page). Campaign play
  // never enters daily mode — these stubs keep the legacy code paths inert.
  const isDailyMode = false;
  const submitDaily = useSubmitDailyRun();
  useActiveQuests();
  const levelNumber = Math.max(1, parseInt(levelParam ?? "1", 10) || 1);
  const dailyMods: never[] = [];

  const { user } = useAuth();
  const {
    data: hero,
    error: heroError,
    refetch: refetchHero,
  } = useRuneDelveHero();
  const {
    data: progress,
    error: progressError,
    refetch: refetchProgress,
  } = useMyProgress(hero?.class);
  const {
    data: level,
    error: levelError,
    refetch: refetchLevel,
  } = useLevel(levelNumber);
  const { data: existingRun } = useMyLevelRun(
    level?.id,
    levelNumber,
    hero?.class,
  );
  const { data: classTracks, isLoading: classTracksLoading } =
    useAllClassProgress();
  const submit = useSubmitLevelRun();
  const { data: loadout, isLoading: loadoutLoading } = useLoadout(hero?.class);
  const { data: ownedRelics, isLoading: ownedRelicsLoading } =
    useRelicCollection();
  // Confirmed acquisitions share one centered, paged result stage.
  const [settlementRewards, setSettlementRewards] = useState<RuneRewardItem[]>(
    [],
  );
  // R5: per-enemy boss phase tracker. Bosses + mini-bosses progress
  // through phases as their HP drops; the map records the highest
  // phase each enemy has entered so we can detect new transitions
  // on every state change without re-firing past ones.
  const bossPhasesRef = useRef<Map<string, BossPhaseIndex>>(new Map());
  const { data: wallet } = useRuneWallet();
  const { data: failureRow } = useFailureRow(
    level?.level_number ?? null,
    hero?.class,
  );
  const recordDefeats = useRecordDefeats();

  const [loadingSlow, setLoadingSlow] = useState(false);
  useEffect(() => {
    setLoadingSlow(false);
    const timer = window.setTimeout(() => setLoadingSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [levelNumber]);
  const [grid, setGrid] = useState<RuneType[][] | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [seals, setSeals] = useState<Set<string>>(new Set());
  const [rngTick, setRngTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const finalizeBusyRef = useRef(false);
  const settlementConfirmedRef = useRef(false);
  const resumedScoreCheckRef = useRef(false);
  const settleResumedScoreRef = useRef<((final: CombatState) => void) | null>(
    null,
  );
  const pendingSaveRef = useRef<SubmitLevelRunInput | null>(null);
  const failedFinalRef = useRef<{
    final: CombatState;
    cleared: boolean;
    totals: RunRewardTotals;
  } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [encounterOpen, setEncounterOpen] = useState(false);
  const [enemyInspecting, setEnemyInspecting] = useState(false);
  const [encounterPage, setEncounterPage] = useState(0);
  const [masteryIdsSnapshot, setMasteryIdsSnapshot] = useState<
    MasteryId[] | null
  >(null);
  const [introMechanic, setIntroMechanic] = useState<MechanicId | null>(null);
  const [introBossRule, setIntroBossRule] = useState<BossRuleId | null>(null);
  const [endState, setEndState] = useState<null | {
    cleared: boolean;
    reason: "cleared" | "defeated" | "timeout";
    score: number;
    isNewBest: boolean;
    shards: number;
    xp?: number;
    improvedChain?: boolean;
    improvedTurns?: boolean;
    improvedHp?: boolean;
    firstClear?: boolean;
  }>(null);
  // Counter (not boolean) — Last Stand at R5 grants 2 saves per run.
  const [lastStandUsed, setLastStandUsed] = useState(0);
  // Phoenix Heart — single-use full revive per run, separate from Last Stand.
  const [phoenixUsed, setPhoenixUsed] = useState(false);
  // Bonus-move rebalance: only one free turn per enemy cycle. Resets whenever
  // the enemy phase actually runs (i.e. a non-bonus chain or ability resolves).
  const [bonusUsedThisCycle, setBonusUsedThisCycle] = useState(false);
  const [corruption, setCorruption] =
    useState<CorruptionState>(emptyCorruption);
  const [shift, setShift] = useState<ShiftState>({ column: -1 });
  const [linkedPairs, setLinkedPairs] = useState<LinkedPairsState>({
    pairs: new Map(),
  });
  const [eclipse, setEclipse] = useState<EclipseSet>(new Set());
  const [log, setLog] = useState<CombatLogEntry[]>([]);
  // First-chain-of-fight detection for cleric mastery.
  const [chainsThisFight, setChainsThisFight] = useState(0);
  const [bonusShardsFromMastery, setBonusShardsFromMastery] = useState(0);
  // Chamber-layout zones (R1 wire-up). Tracked per-run; reset alongside
  // bonusShardsFromMastery on run-init.
  const [bonusScoreFromTreasure, setBonusScoreFromTreasure] = useState(0);
  const [bonusShardsFromTreasure, setBonusShardsFromTreasure] = useState(0);
  const [consumedTreasureCells, setConsumedTreasureCells] = useState<
    Set<string>
  >(new Set());
  const consumedTreasureCellsRef = useRef(new Set<string>());
  // Run modifier (R3). `activeModifier` is what's applied to this run;
  // `modifierOffer` is the 3 cards currently shown in the picker.
  // Both clear on run-init so each chamber gets a fresh offer.
  const initializedRunRef = useRef<string | null>(null);
  const [activeModifier, setActiveModifier] = useState<RunModifier | null>(
    null,
  );
  const [modifierOffer, setModifierOffer] = useState<RunModifier[] | null>(
    null,
  );
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
  const recordKill = (
    enemy: { archetypeId?: string; tier?: "mini" | "boss" } | undefined,
  ) => {
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
  const [activeRelicsSnapshot, setActiveRelicsSnapshot] =
    useState<ActiveRelics | null>(null);

  // Append a single entry; trim to a small ring so memory stays tidy.
  const pushLog = (entry: Omit<CombatLogEntry, "id">) => {
    setLog((prev) => {
      const next = [...prev, { ...entry, id: nextLogId() }];
      return next.length > 30 ? next.slice(-30) : next;
    });
  };
  const pushLogs = (entries: Array<Omit<CombatLogEntry, "id">>) => {
    if (!entries.length) return;
    setLog((prev) => {
      const stamped = entries.map((e) => ({ ...e, id: nextLogId() }));
      const next = [...prev, ...stamped];
      return next.length > 30 ? next.slice(-30) : next;
    });
  };

  // Rune trajectories complement the shared, state-derived impact feedback.
  const fxQ = useFxQueue();
  const { play: playSound } = useSoundEffect();
  const { play: rdSfx } = useRuneDelveSfx();
  // V1 visual overhaul:
  //   heavyFlashKey  — banner on chain ≥ 6
  //   heavyChainLen  — chain length to render in the HeavyStrikeBanner
  //   phaseFlashKey  — R5 boss phase cinematic, paired with the
  //                    transition's metadata so the chyron shows the
  //                    boss name + flavor line
  const [heavyFlashKey, setHeavyFlashKey] = useState(0);
  const [heavyChainLen, setHeavyChainLen] = useState(6);
  const [phaseFlashKey, setPhaseFlashKey] = useState(0);
  const [phaseFlashMeta, setPhaseFlashMeta] = useState<{
    phase: 2 | 3;
    bossName: string;
    flavor: string;
  }>({
    phase: 2,
    bossName: "",
    flavor: "",
  });
  const playRootRef = useRef<HTMLDivElement>(null);
  const rectFromEl = (el: Element | null): FxRect | undefined => {
    if (!el) return undefined;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const findEnemyRect = (id: string): FxRect | undefined =>
    rectFromEl(
      playRootRef.current?.querySelector(`[data-enemy-id="${id}"]`) ?? null,
    );
  const findHudRect = (target: "hp" | "mana" | "shield"): FxRect | undefined =>
    rectFromEl(
      playRootRef.current?.querySelector(`[data-fx-target="${target}"]`) ??
        null,
    );

  // Trigger a brief CSS-driven camera shake on the play root. Cleans up
  // any pending timer so rapid red chains don't stack the animation.
  const shakeTimerRef = useRef<number | null>(null);
  const triggerCamShake = (amount = 6) => {
    const el = playRootRef.current;
    if (!el) return;
    el.style.setProperty("--rd-cam-shake-x", `${amount}px`);
    el.style.setProperty("--rd-cam-shake-y", `${Math.round(amount * 0.6)}px`);
    el.classList.remove("rd-cam-shake");
    // Force reflow so the animation restarts cleanly.
    void el.offsetWidth;
    el.classList.add("rd-cam-shake");
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => {
      el.classList.remove("rd-cam-shake");
    }, 240);
  };

  // Pulse the HP bar's inner glow (Lifebloom arrival cue).
  const pulseHpGlow = () => {
    const el = playRootRef.current?.querySelector(
      "[data-fx-hp-glow-target]",
    ) as HTMLElement | null;
    if (!el) return;
    el.setAttribute("data-fx-hp-glow", "on");
    window.setTimeout(() => el.removeAttribute("data-fx-hp-glow"), 620);
  };

  // Active relic loadout for this run (rank-aware).
  const activeRelics = useMemo(() => {
    const ranks = rankMapFromOwned(ownedRelics);
    return buildActive(
      [loadout?.slot_1, loadout?.slot_2, loadout?.slot_3],
      ranks,
    );
  }, [loadout, ownedRelics]);

  // Resolve mechanics for this level. Prefer the persisted row, fall back
  // to the deterministic helper so legacy/transient rows still work.
  const activeMechanics = useMemo<MechanicId[]>(() => {
    const stored = (level?.modifiers as ChamberModifiers | undefined)
      ?.mechanics as MechanicId[] | undefined;
    if (stored?.length) return stored;
    return level ? mechanicsForLevel(level.level_number) : [];
  }, [level]);

  // R2: path variant from the milestone picker (?pathVariant=…).
  // Resolved once per mount; effects threaded through init, chain
  // resolve, finalize, and the layout zone derivation below.
  const pathVariant = useMemo(
    () => getPathVariant(searchParams.get("pathVariant")),
    [searchParams],
  );
  const pathEffect = useMemo(
    () => resolvePathEffect(pathVariant),
    [pathVariant],
  );

  // The active chamber layout for this run. Drives both the R1 zone
  // computation (treasure/hazard cells) and the V5 atmospheric
  // backdrop. Path variant can override which layout is rendered
  // (e.g. Treasure Path forces the Cursed Vault chamber).
  const activeLayout = useMemo(() => {
    if (!level) return null;
    const layoutId =
      pathEffect.layoutOverride || getLayoutIdForLevel(level.level_number);
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
  const sealedTilesActive = activeMechanics.includes("sealed_tiles");
  const telegraphActive = activeMechanics.includes("telegraphed_attacks");
  const corruptionActive = activeMechanics.includes("corrupted_tiles");
  const shiftingActive = activeMechanics.includes("shifting_runes");
  const linkedPairsActive = activeMechanics.includes("linked_pairs");
  const eclipseActive = activeMechanics.includes("eclipse_tiles");
  const secondaryObjective = ((level?.modifiers as ChamberModifiers | undefined)
    ?.secondary_objective ?? null) as SecondaryObjective | null;
  const bossRule = ((level?.modifiers as ChamberModifiers | undefined)
    ?.boss_rule ?? null) as BossRuleId | null;
  const waveDefs = ((level?.modifiers as ChamberModifiers | undefined)?.waves ??
    null) as Array<{
    enemies: StoredEnemy[];
    reinforcement_turns: number;
  }> | null;

  // Active mastery ids for the hero's class (computed once per render —
  // class level is stable per run since XP only awards on completion).
  const activeMasteries = useMemo(() => {
    if (masteryIdsSnapshot) return masteryIdsSnapshot;
    if (!hero) return [];
    const lvl =
      (classTracks ?? []).find((t) => t.class === hero.class)?.level ??
      hero.level ??
      1;
    return getActiveMasteries(hero.class, lvl);
  }, [hero, classTracks, masteryIdsSnapshot]);

  // Mana orbs needed to cast the class ability. Mage T4 "Deep Reserve" drops
  // it 3 → 2. Used by handleAbility (gate + FX + spend accounting) and the
  // HeroStatusBar (ready-state threshold) so both agree.
  const abilityManaCost = useMemo(
    () =>
      getMasteryAbilityManaCost(
        activeMasteries,
        getClass(hero?.class ?? "warrior").abilityCost,
      ),
    [activeMasteries, hero?.class],
  );

  // Per-run snapshot key (scoped to user + level so swapping levels or users
  // can never bleed in stale state).
  const runKey = useMemo(() => {
    if (!user?.id || !level?.id) return null;
    if (level.id.startsWith("transient-")) return null;
    if (!hero?.class) return null;
    const variant = `${pathVariant?.id ?? "standard"}:${searchParams.get("dailyMod") ?? ""}`;
    return snapshotKey(
      user.id,
      level.id,
      hero.class,
      variant === "standard:" ? undefined : variant,
    );
  }, [user?.id, level?.id, hero?.class, pathVariant?.id, searchParams]);

  // Build deterministic state. Snapshots `activeRelics` once at run-start so
  // mid-run relic toggles or rank changes can never reset the board.
  // ALSO: prefer rehydrating an in-progress run from sessionStorage so
  // backgrounding the WebView (iOS PWA) doesn't wipe player progress.
  useEffect(() => {
    if (
      !level ||
      !hero ||
      classTracksLoading ||
      loadoutLoading ||
      ownedRelicsLoading
    )
      return;
    const identity = `${runKey}:${level.generation_seed}:${pathVariant?.id ?? "standard"}:${searchParams.get("dailyMod") ?? ""}`;
    if (initializedRunRef.current === identity) return;
    initializedRunRef.current = identity;
    setEndState(null);
    setSettlementRewards([]);
    finalizeBusyRef.current = false;
    settlementConfirmedRef.current = false;
    resumedScoreCheckRef.current = false;
    setSubmitting(false);
    pendingSaveRef.current = null;
    failedFinalRef.current = null;
    setSaveError(null);
    bossPhasesRef.current = new Map();
    const relics = activeRelics; // snapshot

    // ── Rehydrate path ──────────────────────────────────────────────────
    if (runKey) {
      const snap = loadSnapshot(runKey, level.generation_seed);
      // An unacknowledged terminal result is as durable as a live board.
      const pendingSettlement = snap?.pendingSettlement;
      const hasPendingSettlement =
        !!pendingSettlement &&
        pendingSettlement.input.level_id === level.id &&
        pendingSettlement.input.level_number === level.level_number &&
        pendingSettlement.input.hero_class === hero.class;
      if (
        snap &&
        (hasPendingSettlement ||
          (snap.combat.hp > 0 && snap.combat.turnsRemaining > 0))
      ) {
        setGrid(snap.grid);
        setShift({ column: snap.shiftingColumn ?? -1 });
        setLinkedPairs({ pairs: new Map(snap.linkedPairs ?? []) });
        setEclipse(new Set(snap.eclipsedCells ?? []));
        setChainsThisFight(snap.chainsThisFight ?? 0);
        setBonusShardsFromMastery(snap.bonusShardsFromMastery ?? 0);
        setBonusScoreFromTreasure(snap.bonusScoreFromTreasure ?? 0);
        setBonusShardsFromTreasure(snap.bonusShardsFromTreasure ?? 0);
        // Old live checkpoints know their earned total, but not which cells
        // paid it. Preserve their rewards and conservatively exhaust those
        // authored spots rather than mint the same pickup again after resume.
        const consumed = new Set(
          snap.consumedTreasureCells ??
            ((snap.bonusScoreFromTreasure ?? 0) > 0 ||
            (snap.bonusShardsFromTreasure ?? 0) > 0
              ? layoutZones.treasure
              : []),
        );
        consumedTreasureCellsRef.current = consumed;
        setConsumedTreasureCells(consumed);
        setTotalManaSpent(snap.totalManaSpent ?? 0);
        setGoldRunesCleared(snap.goldRunesCleared ?? 0);
        braceFiredRef.current = snap.braceFired ?? false;
        aegisFiredRef.current = snap.aegisFired ?? false;
        setMasteryIdsSnapshot(snap.masteryIds ?? null);
        setCombat(snap.combat);
        bossPhasesRef.current = restoreBossPhases(
          snap.combat.enemies,
          snap.bossPhases,
        );
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
        setActiveRelicsSnapshot(
          rehydrateRelics(snap.activeRelicsSnapshot) ?? relics,
        );
        defeatedArchetypesRef.current = new Map(snap.defeatedArchetypes);
        wavesSpawnedRef.current = snap.wavesSpawned;
        // R3: rehydrate the modifier from snapshot. Pre-R3 snapshots
        // have no activeModifierId — getModifierById returns null in
        // that case, which the engine treats as Steady Path.
        const resumedModifier = getModifierById(snap.activeModifierId);
        const pendingOffer = (snap.pendingModifierOfferIds ?? [])
          .map(getModifierById)
          .filter((modifier): modifier is RunModifier => !!modifier);
        setActiveModifier(
          resumedModifier ?? (pendingOffer.length ? null : STEADY_PATH),
        );
        setModifierOffer(
          resumedModifier || !pendingOffer.length ? null : pendingOffer,
        );
        // Restore the real opening budget so turn counts, survive goals, and
        // speed bonuses remain accurate after an iOS/Android background resume.
        initialTurnsRef.current =
          snap.initialTurns ??
          Math.max(level.turn_limit, snap.combat.turnsRemaining);
        tookDamageRef.current = snap.tookDamage ?? true;
        if (hasPendingSettlement && pendingSettlement) {
          pendingSaveRef.current = pendingSettlement.input;
          failedFinalRef.current = {
            final: snap.combat,
            cleared: pendingSettlement.cleared,
            totals: pendingSettlement.totals,
          };
          setEndState(pendingSettlement.display);
          setSaveError(
            "This result is waiting to be saved. Retry to confirm your rewards.",
          );
          return;
        }
        // A balance patch can lower a legacy score goal beneath work already
        // earned in this checkpoint. Settle that work once instead of leaving
        // a completed objective with a disabled board and no result screen.
        resumedScoreCheckRef.current = level.objective_type === "reach_score";
        const turnNow = Math.max(
          1,
          initialTurnsRef.current - snap.combat.turnsRemaining + 1,
        );
        toast(
          `↩️ Resumed your run (Turn ${turnNow} of ${initialTurnsRef.current})`,
          { duration: 2200 },
        );
        return;
      }
    }

    // ── Fresh-board path (existing behavior) ────────────────────────────
    const rng = mulberry32(level.generation_seed);
    const classLevel =
      (classTracks ?? []).find((track) => track.class === hero.class)?.level ??
      hero.level ??
      1;
    const openingMasteries = getActiveMasteries(hero.class, classLevel);
    setMasteryIdsSnapshot(openingMasteries);
    setGrid(generateBoard(rng));
    let initialSeals = buildInitialSeals(
      level.generation_seed,
      sealedTilesActive,
    );
    // Keysight: pre-shatter the requested number of seals at run start so
    // the player effectively gets a head-start clearing them.
    const keysightTurns = getSealedTilesSpeedup(relics);
    if (keysightTurns > 0 && initialSeals.size > 0) {
      const keys = Array.from(initialSeals).slice(0, keysightTurns);
      const next = new Set(initialSeals);
      keys.forEach((k) => next.delete(k));
      initialSeals = next;
    }
    setSeals(initialSeals);
    setCorruption(
      buildInitialCorruption(
        level.generation_seed,
        corruptionActive,
        level.level_number,
        initialSeals,
      ),
    );
    setShift(buildInitialShift(level.generation_seed, shiftingActive));
    setLinkedPairs(
      buildInitialPairs(level.generation_seed, linkedPairsActive, initialSeals),
    );
    setEclipse(
      buildInitialEclipse(level.generation_seed, eclipseActive, initialSeals),
    );
    setChainsThisFight(0);
    setBonusShardsFromMastery(0);
    setBonusScoreFromTreasure(0);
    setBonusShardsFromTreasure(0);
    consumedTreasureCellsRef.current = new Set();
    setConsumedTreasureCells(new Set());
    // Fresh runs begin before any boss phase has triggered.
    bossPhasesRef.current = new Map();
    setTotalManaSpent(0);
    const foggedActive = isDailyMode && dailyHidesForesight(dailyMods);
    const enemies = prepareCampaignEnemies(level.enemy_config ?? [], {
      idPrefix: "e",
      seed: level.generation_seed,
      level: level.level_number,
      telegraphed: telegraphActive,
      foresightTurns: foggedActive ? 0 : getTelegraphReadyEarly(relics),
      hpMultiplier:
        (isDailyMode ? dailyEnemyHpMultiplier(dailyMods) : 1) *
        pathEffect.eliteEnemyHpMult,
    });
    // Apply pre-run relic effects: starting mana + starting shield, plus
    // Foreseer's Lens (+ turns/level — suppressed by Fogged) and Void Pact.
    const bonusTurns = foggedActive ? 0 : getForeseerBonusTurns(relics);
    const dailyTurnDelta = isDailyMode ? dailyTurnLimitDelta(dailyMods) : 0;
    const chapterIdx = chapterFor(level.level_number);
    const chapterHpBonus = getMasteryMaxHpBonus(
      openingMasteries,
      Math.max(0, chapterIdx - 1),
    );
    let initial = initialCombat(
      enemies,
      Math.max(3, level.turn_limit + bonusTurns + dailyTurnDelta),
      { bonusMaxHp: chapterHpBonus + getRelicRankMaxHpBonus(relics) },
    );
    // Mastery: starting mana bonus (Mage T1) layered on top of relic effects.
    const openingManaPower =
      getStartingMana(relics) + getMasteryStartingMana(openingMasteries);
    initial.mana = Math.min(MAX_MANA, initial.mana + openingManaPower);
    initial.shieldTurns = Math.max(
      initial.shieldTurns,
      getStartingShieldTurns(relics),
    );
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
    // Locked variants and tutorial chambers resolve before initialization.
    // An offered bargain applies only when selected, with the board disabled
    // until that decision is made.
    const lockedModId =
      searchParams.get("dailyMod") || pathEffect.lockedModifierId || null;
    const openingModifier =
      (lockedModId ? getModifierById(lockedModId) : null) ??
      (level.level_number <= 10 ? STEADY_PATH : null);
    initial = applyOpeningModifier(initial, openingModifier);
    setActiveModifier(openingModifier);
    setModifierOffer(openingModifier ? null : pickModifierOffer());
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
    // Fresh runs begin before any boss phase has triggered.
    bossPhasesRef.current = new Map();
    setTotalManaSpent(0);
    setGoldRunesCleared(0);
    braceFiredRef.current = false;
    aegisFiredRef.current = false;
    tookDamageRef.current = false;
    defeatedArchetypesRef.current = new Map();
    wavesSpawnedRef.current = 0;
    setLog([
      {
        id: nextLogId(),
        kind: "info",
        text: `You enter Level ${level.level_number}. The runes hum.`,
      },
    ]);
    // NOTE: `activeRelics` intentionally OMITTED from deps — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    level,
    hero,
    sealedTilesActive,
    telegraphActive,
    corruptionActive,
    shiftingActive,
    linkedPairsActive,
    eclipseActive,
    runKey,
    isDailyMode,
    classTracksLoading,
    loadoutLoading,
    ownedRelicsLoading,
    pathVariant?.id,
    pathEffect.lockedModifierId,
    searchParams,
  ]);

  // ── Persist snapshot on every meaningful state change ─────────────────
  // Keep terminal results until the server confirms settlement, as well as
  // live boards. Anonymous users and transient levels lack a stable key.
  useEffect(() => {
    if (!runKey || !level || !grid || !combat || settlementConfirmedRef.current)
      return;
    const pending = failedFinalRef.current;
    const pendingSettlement =
      endState && pending && pendingSaveRef.current
        ? {
            input: pendingSaveRef.current,
            cleared: pending.cleared,
            totals: pending.totals,
            display: endState,
          }
        : undefined;
    if (endState && !pendingSettlement) return;
    if (!pendingSettlement && (combat.hp <= 0 || combat.turnsRemaining <= 0))
      return;
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
      pendingModifierOfferIds: modifierOffer?.map((modifier) => modifier.id),
      shiftingColumn: shift.column,
      linkedPairs: Array.from(linkedPairs.pairs),
      eclipsedCells: Array.from(eclipse),
      chainsThisFight,
      bonusShardsFromMastery,
      bonusScoreFromTreasure,
      bonusShardsFromTreasure,
      consumedTreasureCells,
      totalManaSpent,
      goldRunesCleared,
      braceFired: braceFiredRef.current,
      aegisFired: aegisFiredRef.current,
      tookDamage: tookDamageRef.current,
      masteryIds: activeMasteries,
      bossPhases: Array.from(bossPhasesRef.current),
      pendingSettlement,
    });
    saveSnapshot(runKey, snap);
  }, [
    runKey,
    level,
    grid,
    combat,
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
    rngTick,
    activeRelicsSnapshot,
    activeModifier?.id,
    modifierOffer,
    endState,
    shift,
    linkedPairs,
    eclipse,
    chainsThisFight,
    bonusShardsFromMastery,
    bonusScoreFromTreasure,
    bonusShardsFromTreasure,
    consumedTreasureCells,
    totalManaSpent,
    goldRunesCleared,
    activeMasteries,
  ]);

  // Final-flush on visibilitychange / pagehide so the OS evicting the
  // WebView mid-microtask still leaves a usable snapshot behind.
  useEffect(() => {
    if (!runKey || !level || !grid || !combat) return;
    const flush = () => {
      if (settlementConfirmedRef.current) return;
      const pending = failedFinalRef.current;
      const pendingSettlement =
        endState && pending && pendingSaveRef.current
          ? {
              input: pendingSaveRef.current,
              cleared: pending.cleared,
              totals: pending.totals,
              display: endState,
            }
          : undefined;
      if (endState && !pendingSettlement) return;
      if (!pendingSettlement && (combat.hp <= 0 || combat.turnsRemaining <= 0))
        return;
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
        pendingModifierOfferIds: modifierOffer?.map((modifier) => modifier.id),
        shiftingColumn: shift.column,
        linkedPairs: Array.from(linkedPairs.pairs),
        eclipsedCells: Array.from(eclipse),
        chainsThisFight,
        bonusShardsFromMastery,
        bonusScoreFromTreasure,
        bonusShardsFromTreasure,
        consumedTreasureCells,
        totalManaSpent,
        goldRunesCleared,
        braceFired: braceFiredRef.current,
        aegisFired: aegisFiredRef.current,
        tookDamage: tookDamageRef.current,
        masteryIds: activeMasteries,
        bossPhases: Array.from(bossPhasesRef.current),
        pendingSettlement,
      });
      saveSnapshot(runKey, snap);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, [
    runKey,
    level,
    grid,
    combat,
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
    rngTick,
    activeRelicsSnapshot,
    activeModifier?.id,
    modifierOffer,
    endState,
    shift,
    linkedPairs,
    eclipse,
    chainsThisFight,
    bonusShardsFromMastery,
    bonusScoreFromTreasure,
    bonusShardsFromTreasure,
    consumedTreasureCells,
    totalManaSpent,
    goldRunesCleared,
    activeMasteries,
  ]);

  // Preserve a legal move after gravity, shifting, loading, or an enemy seal.
  // A blocked board never charges a player turn. Rescue only as many seals as
  // necessary if no three-cell topology remains at all.
  useEffect(() => {
    if (!grid || !level) return;
    const rescueRng = mulberry32(level.generation_seed ^ (rngTick + 0x5afe));
    let rescuedSeals = seals;
    let result = ensurePlayableBoard(grid, rescueRng, rescuedSeals, eclipse);
    if (!result.chain && seals.size) {
      rescuedSeals = new Set(seals);
      for (const key of Array.from(seals).reverse()) {
        rescuedSeals.delete(key);
        result = ensurePlayableBoard(grid, rescueRng, rescuedSeals, eclipse);
        if (result.chain) break;
      }
      setSeals(rescuedSeals);
    }
    if (result.reshuffled) setGrid(result.grid);
    if (result.reshuffled || rescuedSeals !== seals) {
      const entry: CombatLogEntry = {
        id: nextLogId(),
        kind: "info",
        text:
          rescuedSeals !== seals
            ? "The runes break a seal. A new path opens."
            : "The runes shift. No turn spent.",
      };
      setLog((previous) => [...previous, entry].slice(-30));
    }
  }, [grid, seals, eclipse, level, rngTick]);

  // One-time intro modal for any brand-new mechanic taught at this level.
  useEffect(() => {
    if (!level || !hero) return;
    const intro =
      (level.modifiers as ChamberModifiers | undefined)?.intro_mechanic ??
      introMechanicForLevel(level.level_number);
    if (!intro) return;
    try {
      if (!localStorage.getItem(seenMechanicKey(intro)))
        setIntroMechanic(intro);
    } catch {
      /* Storage may be unavailable. */
    }
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
    } catch {
      /* Storage may be unavailable. */
    }
  }, [level, hero, bossRule]);

  // Always invalidate the cached existing-run on mount so replay flows
  // ("Retry" → Play → finalize) compute isNewBest off fresh server data.
  // Without this, a stale cached row caused phantom hero XP double-counts.
  useEffect(() => {
    if (!level?.id || level.id.startsWith("transient-")) return;
    queryClient.invalidateQueries({
      queryKey: ["rune-delve-level-run", level.id],
    });
  }, [level?.id, queryClient]);

  const refillRng = useMemo(() => {
    if (!level) return null;
    return mulberry32(level.generation_seed + 1000 + rngTick);
  }, [level, rngTick]);

  useEffect(() => {
    if (
      !resumedScoreCheckRef.current ||
      !combat ||
      !grid ||
      !hero ||
      !level ||
      !progress ||
      levelNumber > progress.highest_unlocked_level ||
      !settleResumedScoreRef.current
    )
      return;
    resumedScoreCheckRef.current = false;
    const restoredStatus = evaluateObjective(
      combat,
      campaignTurnBudget(
        initialTurnsRef.current,
        level.turn_limit,
        waveDefs,
        wavesSpawnedRef.current,
      ),
      "reach_score",
      normalizeScoreObjectiveTarget(level),
    );
    if (restoredStatus.cleared) settleResumedScoreRef.current(combat);
  }, [combat, grid, hero, level, progress, levelNumber, waveDefs]);

  // Lock guard: if user navigates to a locked level via URL.
  if (progress && levelNumber > progress.highest_unlocked_level) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-6 text-center space-y-2">
          <p className="text-2xl">🔒</p>
          <h2 className="font-extrabold text-base">Level Locked</h2>
          <p className="text-xs text-muted-foreground">
            Clear Level {progress.highest_unlocked_level} first.
          </p>
          <button
            onClick={() =>
              navigate(`/rune-delve/play/${progress.highest_unlocked_level}`)
            }
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold btn-press"
          >
            Go to Level {progress.highest_unlocked_level}
          </button>
        </div>
      </div>
    );
  }

  if (!hero || !progress || !level || !grid || !combat || !refillRng) {
    const failed = heroError || progressError || levelError;
    return (
      <div className="relative min-h-64 rounded-2xl border border-primary/15 bg-card p-6">
        {!failed && !loadingSlow && (
          <div
            className="h-52 rounded-xl skeleton-shimmer"
            aria-label="Loading chamber"
          />
        )}
        {(failed || loadingSlow) && (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
            <SparklesIcon size={28} className="text-primary" aria-hidden />
            <p className="text-sm font-extrabold">
              {failed
                ? "The chamber could not load"
                : "Still opening the chamber…"}
            </p>
            <button
              type="button"
              onClick={() => {
                void refetchHero();
                void refetchLevel();
                void refetchProgress();
              }}
              className="min-h-11 rounded-xl bg-primary px-6 text-xs font-extrabold text-primary-foreground"
            >
              Retry
            </button>
            <Link
              to="/rune-delve/legacy"
              className="flex min-h-11 items-center text-xs font-bold text-muted-foreground"
            >
              Return to Combat Archive
            </Link>
          </div>
        )}
      </div>
    );
  }

  const objType = level.objective_type as ObjectiveType;
  const objectiveTarget = normalizeScoreObjectiveTarget(level);
  const currentTurnBudget = () =>
    campaignTurnBudget(
      initialTurnsRef.current,
      level.turn_limit,
      waveDefs,
      wavesSpawnedRef.current,
    );
  const activeTurnBudget = currentTurnBudget();

  const handleChain = (chain: Cell[]) => {
    if (!isValidChain(grid, chain, seals, eclipse)) return;
    // Daily Overcharge caps chain length at 5.
    const chainCap = isDailyMode ? dailyChainCap(dailyMods) : 0;
    if (chainCap > 0 && chain.length > chainCap) {
      toast("⚡ Overcharge limits chains to 5", { duration: 1400 });
      return;
    }
    const type = grid[chain[0].r][chain[0].c];
    const rewardTotals: RunRewardTotals = {
      goldRunesCleared,
      bonusShardsFromMastery,
      bonusScoreFromTreasure,
      bonusShardsFromTreasure,
      abilityUsedCount,
    };
    // Tiered chain bonus: 6=heavy strike (no free turn), 7=+30% & free turn,
    // 8+=+40% & free turn. Only ONE free turn per enemy cycle.
    const chainPowerTier = chainTier(chain.length);
    const tier = {
      dmgMult: chainPowerTier.damageMultiplier,
      bonus: chainPowerTier.bonusAction,
    };
    // ── Visual FX trigger ─────────────────────────────────────────────────
    // Aim red at the first living enemy (the same target applyChain hits);
    // route green/blue/gold at the relevant HUD chip so the cue lands where
    // the player's eye should travel.
    const fxTier: "normal" | "big" | "huge" =
      chain.length >= 8 ? "huge" : chain.length >= 6 ? "big" : "normal";
    let fxTarget: FxRect | undefined;
    if (type === "red") {
      const firstAlive = filterTargetable(bossRule, combat.enemies)[0];
      if (firstAlive) fxTarget = findEnemyRect(firstAlive.id);
    } else if (type === "green") {
      fxTarget = findHudRect("hp");
    } else if (type === "blue") {
      fxTarget = findHudRect("mana");
    } else if (type === "gold") {
      fxTarget = findHudRect("shield") ?? findHudRect("hp");
    }
    fxQ.trigger({
      kind: "rune",
      rune: type,
      length: chain.length,
      tier: fxTier,
      target: fxTarget,
    });
    // Themed audio + camera-feel beats per rune type.
    if (type === "red") {
      rdSfx("rune.fire.red");
      if (chain.length >= 4) triggerCamShake(chain.length >= 6 ? 8 : 6);
      // V1 — Heavy-strike signature visual. Chain ≥ 6 already gets
      // the engine's "heavy strike" damage tier; this adds an
      // unmissable banner + gold screen-edge flash so the player
      // feels the moment land.
      if (chain.length >= 6) {
        setHeavyChainLen(chain.length);
        setHeavyFlashKey((k) => k + 1);
      }
    } else if (type === "green") {
      rdSfx("rune.fire.green");
      window.setTimeout(pulseHpGlow, 520);
    } else if (type === "gold") {
      rdSfx("rune.fire.gold");
    } else if (type === "blue") {
      rdSfx("rune.fire.blue");
    }
    if (chain.length >= 8) rdSfx("chain.epic");
    else if (chain.length >= 6) rdSfx("chain.bonus");
    // Snapshot relics for this run (falls back to live for first chain).
    const relics = activeRelicsSnapshot ?? activeRelics;
    // Per-chain counters BEFORE applying — drives Ember Edge / Crimson Tide / Quickstep.
    const isFirstChainOfRun = chainCountTotal === 0;
    const redCountAfter = type === "red" ? redChainCount + 1 : redChainCount;
    // Compute relic chain mods (Ember Edge, Crimson Tide, Executioner's Mark,
    // Desperate Surge, Sapphire Flow, Verdant Heart, Bulwark, Quickstep).
    // Read the HP ratio from the enemy applyChain will actually hit — the first
    // TARGETABLE foe (boss rules can hide the final enemy) — so Executioner's
    // Mark evaluates its <25% check against the real target, not a hidden one.
    const targetEnemyForCtx =
      filterTargetable(bossRule, combat.enemies)[0] ??
      combat.enemies.find((e) => e.hp > 0);
    const enemyHpRatio = targetEnemyForCtx
      ? targetEnemyForCtx.hp / Math.max(1, targetEnemyForCtx.maxHp)
      : 1;
    const chainMods = computeChainMods(relics, {
      chainType: type,
      length: chain.length,
      redChainCountSoFar: type === "red" ? redCountAfter : 0,
      isFirstChainOfRun,
      hpRatio: combat.hp / Math.max(1, combat.maxHp),
      enemyHpRatioBeforeHit: enemyHpRatio,
      chainNumberThisRun: chainCountTotal + 1,
    });
    // Momentum (rogue): chain bonus threshold drops from 5 → 4.
    const rogueBonusThreshold =
      hero.class === "rogue" && has(relics, "momentum") ? 4 : 5;
    const modEff = resolveEffect(activeModifier);
    let combatMultiplier = 1;
    let critFired = false;
    if (type === "red") {
      if (isDailyMode)
        combatMultiplier *= dailyDamageMultiplier(dailyMods, type);
      if (isDailyMode)
        combatMultiplier *= dailyIroncladDamageMult(dailyMods, chain.length);
      combatMultiplier *= getMasteryChainDamageMult(activeMasteries, type);
      if (isLastStandActive(activeMasteries, combat.hp, combat.maxHp))
        combatMultiplier *= 1.5;
      const openingCrit = getMasteryOpeningCritMult(
        activeMasteries,
        redChainCount,
      );
      if (openingCrit > 1) {
        combatMultiplier *= openingCrit;
        critFired = true;
      }
      const critChance = getMasteryChainCritChance(
        activeMasteries,
        chain.length,
      );
      if (critChance > 0 && Math.random() < critChance) {
        combatMultiplier *= 1.5;
        critFired = true;
      }
    }
    // Compose power BEFORE armor, target HP, and kill credit. A weak hit must
    // never resurrect a killed foe or spill its modifiers into another enemy.
    const powerModifiers = {
      runMultiplier: modEff.redDamageMult,
      relicMultiplier: chainMods.bonusDamageMult,
      lengthBonus: chainMods.effectiveLengthBonus,
      tierMultiplier: tier.dmgMult,
      combatMultiplier,
      healMultiplier: modEff.healMult,
      guardMultiplier: modEff.shieldMult,
    };
    const chainResult = applyChain(
      combat,
      type,
      chain.length,
      hero.class,
      bossRule,
      rogueBonusThreshold,
      level.level_number,
      powerModifiers,
    );
    let next = chainResult.next;
    const resolution = chainResult.resolution;
    const rawRedDamage =
      type === "red"
        ? redChainPower(
            chain.length,
            hero.class,
            level.level_number,
            powerModifiers,
            combat.shadowstepActive,
          )
        : 0;

    // ── Chamber layout zones: treasure + hazard (R1) ────────────────────
    // Treasure: bonus score + shards (banked, awarded at finalize so
    // they show up cleanly on the results card alongside other bonuses).
    // Hazard: immediate HP cost on the chain that touched them.
    //   Capped per chain so a chain through every hazard tile can't
    //   wipe the hero in one move — there's still risk, not instant
    //   death from a bad path.
    if (layoutZones.treasure.size > 0 || layoutZones.hazard.size > 0) {
      const treasureKeys = new Set(
        chain
          .map(cellKey)
          .filter(
            (key) =>
              layoutZones.treasure.has(key) &&
              !consumedTreasureCellsRef.current.has(key),
          ),
      );
      const treasureHits = treasureKeys.size;
      const hazardHits = countChainInZone(chain, layoutZones.hazard);
      if (treasureHits > 0) {
        const consumed = new Set(consumedTreasureCellsRef.current);
        treasureKeys.forEach((key) => consumed.add(key));
        consumedTreasureCellsRef.current = consumed;
        setConsumedTreasureCells(consumed);
        // R3: treasureMult from active modifier (Treasure Hunter triples).
        const treasureMultiplier = Math.min(
          3,
          Math.max(0, modEff.treasureMult),
        );
        const scoreGain = Math.round(
          treasureHits * TREASURE_SCORE_BONUS * treasureMultiplier,
        );
        const shardGain = Math.round(
          treasureHits *
            treasureShardValue(level.level_number) *
            treasureMultiplier,
        );
        rewardTotals.bonusScoreFromTreasure += scoreGain;
        rewardTotals.bonusShardsFromTreasure += shardGain;
        setBonusScoreFromTreasure((s) => s + scoreGain);
        setBonusShardsFromTreasure((s) => s + shardGain);
        pushLog({
          kind: "info",
          text: `✨ Treasure +${scoreGain} score · +${shardGain} shards`,
        });
      }
      if (hazardHits > 0) {
        // R3: hazardMult from active modifier (Treasure Hunter doubles).
        const rawDamage = Math.round(
          hazardHits * HAZARD_DAMAGE * modEff.hazardMult,
        );
        const damage = Math.min(
          rawDamage,
          HAZARD_MAX_DAMAGE_PER_CHAIN * modEff.hazardMult,
        );
        next.hp = Math.max(0, next.hp - damage);
        if (damage > 0) tookDamageRef.current = true;
        pushLog({
          kind: "corruption",
          text: `⚠️ Hazard tile · -${damage} HP`,
          amount: damage,
        });
      }
    }

    // Mana / heal / shield bonuses.
    if (chainMods.bonusManaFlat > 0) {
      const manaBefore = next.mana;
      next.mana = Math.min(MAX_MANA, next.mana + chainMods.bonusManaFlat);
      resolution.manaGained += next.mana - manaBefore;
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
      if (type === "green") {
        const perRune = hero.class === "cleric" ? Math.round(6 * 1.5) : 6;
        const extra = Math.min(perRune * bonusLen, next.maxHp - next.hp);
        if (extra > 0) {
          next.hp += extra;
          resolution.hpHealed += extra;
        }
      } else if (type === "blue") {
        // Push the chain over the 5+ mana threshold if it wasn't already.
        if (
          chain.length < 5 &&
          chain.length + bonusLen >= 5 &&
          next.mana < MAX_MANA
        ) {
          next.mana = Math.min(MAX_MANA, next.mana + 1);
          resolution.manaGained += 1;
        }
      } else if (type === "gold") {
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
    setChainCountTotal((c) => c + 1);
    if (type === "red") setRedChainCount(redCountAfter);
    // ── Mastery: Rogue T1 Gilded Eye — track gold runes for end-of-run score.
    if (type === "gold") {
      rewardTotals.goldRunesCleared += chain.length;
      setGoldRunesCleared((g) => g + chain.length);
    }
    // Toast the rogue crit (turnLogs isn't yet allocated at this point).
    if (critFired) {
      toast.success(`🗡️ Critical strike! Chain ×${chain.length}`, {
        duration: 1100,
      });
    }
    // ── Mastery: Mage T2 — blue chains heal a flat 2 HP. ─────────────────
    if (type === "blue") {
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
    if (type === "gold" && resolution.guardGained > 0) {
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
          tookDamageRef.current = true;
        }
      }
    }
    // ── Mastery: Rogue T5 — +1 shard per chain. Tracked, awarded on finalize.
    {
      const perChain = getMasteryShardsPerChain(activeMasteries);
      if (perChain > 0) {
        rewardTotals.bonusShardsFromMastery += perChain;
        setBonusShardsFromMastery((s) => s + perChain);
      }
    }
    setChainsThisFight((c) => c + 1);
    // ── Vampiric Sigil — heal % of red damage dealt ──────────────────────
    if (
      type === "red" &&
      next.hp > 0 &&
      chainMods.lifestealPctOfDamage > 0 &&
      resolution.damageDealt > 0
    ) {
      const lifesteal = getLifestealHealAmount(
        relics,
        resolution.damageDealt,
        next.maxHp,
      );
      const applied = Math.min(lifesteal, next.maxHp - next.hp);
      if (applied > 0) {
        next.hp += applied;
        resolution.hpHealed += applied;
      }
    }
    // ── Rune Echo — repeat the chain's effect at echoMult strength ──────
    if (chainMods.echoMult > 0) {
      const m = chainMods.echoMult;
      if (type === "red" && rawRedDamage > 0) {
        // Echo is a distinct strike, with fresh targeting and armor.
        const echo = damageEnemies(
          next,
          Math.round(rawRedDamage * m),
          bossRule,
          1,
        );
        next = echo.next;
        resolution.damageDealt += echo.damageDealt;
        resolution.enemyKills.push(...echo.enemyKills);
      } else if (type === "green" && resolution.hpHealed > 0) {
        const echoHeal = Math.round(resolution.hpHealed * m);
        const applied = Math.min(echoHeal, next.maxHp - next.hp);
        if (applied > 0) {
          next.hp += applied;
          resolution.hpHealed += applied;
        }
      } else if (type === "blue" && resolution.manaGained > 0) {
        const echoMana = Math.max(1, Math.round(resolution.manaGained * m));
        const before = next.mana;
        next.mana = Math.min(MAX_MANA, next.mana + echoMana);
        resolution.manaGained += next.mana - before;
      } else if (type === "gold" && resolution.guardGained > 0) {
        const echoTurns = Math.max(1, Math.round(resolution.guardGained * m));
        next.shieldTurns += echoTurns;
        resolution.guardGained += echoTurns;
      }
    }
    if (resolution.enemyKills.length) setFlashId(resolution.enemyKills[0]);

    // Build the per-turn log batch as we go so the order matches the events.
    const turnLogs: Array<Omit<CombatLogEntry, "id">> = [];
    const runeLabel = RUNE_LABEL[type] ?? type;

    // Chain summary line — always logged.
    if (type === "red" && resolution.damageDealt > 0) {
      const target = combat.enemies.find((e) =>
        resolution.enemyKills[0] ? e.id === resolution.enemyKills[0] : e.hp > 0,
      );
      const targetName = target?.name ?? "the foe";
      turnLogs.push({
        kind: "damage",
        text: `${runeLabel} chain x${chain.length} struck ${targetName}`,
        amount: resolution.damageDealt,
      });
    } else if (type === "green" && resolution.hpHealed > 0) {
      turnLogs.push({
        kind: "heal",
        text: `${runeLabel} chain x${chain.length} mended your wounds`,
        amount: resolution.hpHealed,
      });
    } else if (type === "blue" && resolution.manaGained > 0) {
      turnLogs.push({
        kind: "mana",
        text: `${runeLabel} chain x${chain.length} channeled mana`,
        amount: resolution.manaGained,
      });
    } else if (type === "gold") {
      turnLogs.push({
        kind: "shield",
        text: `${runeLabel} chain x${chain.length} raised your guard`,
        amount: resolution.guardGained,
      });
    } else {
      // Red chain that hit a shielded boss → no damage applied.
      turnLogs.push({
        kind: "info",
        text: `${runeLabel} chain x${chain.length} fizzled`,
      });
    }
    for (const killId of resolution.enemyKills) {
      const killed = combat.enemies.find((e) => e.id === killId);
      recordKill(killed);
      turnLogs.push({
        kind: "kill",
        text: `${killed?.name ?? "A foe"} was vanquished!`,
      });
    }

    // Last Stand feedback: red chain landed but the boss is shielded → 0 dmg.
    if (
      bossRule === "last_stand" &&
      type === "red" &&
      resolution.damageDealt === 0 &&
      combat.enemies.some((e) => e.hp > 0)
    ) {
      toast("🛡️ Boss is shielded — defeat the others first", {
        duration: 1600,
      });
    }
    // Phase Lock fizzle: boss is mid-phase and ignored the strike.
    if (
      bossRule === "phaselock" &&
      type === "red" &&
      resolution.damageDealt === 0 &&
      combat.enemies.some((e) => e.hp > 0 && (e.phaseLockTurns ?? 0) > 0)
    ) {
      const phasing = combat.enemies.find((e) => (e.phaseLockTurns ?? 0) > 0);
      toast("🌀 The boss is phasing — strike fizzled", { duration: 1600 });
      turnLogs.push({
        kind: "info",
        text: `${phasing?.name ?? "The boss"} phased out — your strike found nothing`,
      });
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
      if (r.sourcesCleared > 0 && has(relics, "cleansing_touch")) {
        hpCost = cleansingTouchHpCost(
          relics,
          r.hpCost,
          r.sourcesCleared,
          corruptCleansedCount,
          CORRUPTION_BITE,
        );
        if (hpCost < r.hpCost) {
          turnLogs.push({
            kind: "info",
            text: "✨ Cleansing Touch — source damage waived",
          });
        }
        setCorruptCleansedCount((c) => c + r.sourcesCleared);
      }
      if (hpCost > 0) {
        next.hp = Math.max(0, next.hp - hpCost);
        tookDamageRef.current = true;
        toast.error(`☠️ -${hpCost} HP from corruption`, { duration: 1100 });
        turnLogs.push({
          kind: "corruption",
          text: "Corrupted runes burned you",
          amount: hpCost,
        });
      }
      if (r.sourcesCleared > 0) {
        toast.success(
          r.sourcesCleared > 1 ? `Sources cleansed!` : `Source cleansed!`,
          { duration: 1200 },
        );
        turnLogs.push({
          kind: "info",
          text:
            r.sourcesCleared > 1
              ? "Corruption sources cleansed"
              : "Corruption source cleansed",
        });
      }
      nextCorruption = r.next;
    }

    const resonance = advanceResonance(
      next,
      type,
      level.level_number,
      bossRule,
    );
    next = resonance.next;
    if (resonance.burst) {
      const burst = resonance.burst;
      turnLogs.push({
        kind: "ability",
        text: "Convergence — all four sigils unleashed",
        amount: burst.damageDealt || undefined,
      });
      if (burst.manaGained > 0)
        turnLogs.push({
          kind: "mana",
          text: "Convergence charged mana",
          amount: burst.manaGained,
        });
      turnLogs.push({
        kind: "shield",
        text: "Convergence raised your guard",
        amount: burst.guardGained,
      });
      for (const killId of burst.enemyKills) {
        const killed = combat.enemies.find((enemy) => enemy.id === killId);
        recordKill(killed);
        turnLogs.push({
          kind: "kill",
          text: `${killed?.name ?? "A foe"} fell to Convergence`,
        });
      }
      resolution.enemyKills.push(...burst.enemyKills);
      if (burst.enemyKills.length) setFlashId(burst.enemyKills[0]);
      rdSfx("chain.epic");
      toast.success("Convergence!", {
        description: "All foes struck · +1 mana · +1 guard",
        duration: 1700,
      });
    }

    // Kill healing resolves before surviving foes retaliate.
    if (resolution.enemyKills.length && has(relics, "bloodbond")) {
      const beforeHeal = next.hp;
      for (const _kill of resolution.enemyKills)
        next = onEnemyKilled(relics, next);
      if (next.hp > beforeHeal)
        turnLogs.push({
          kind: "heal",
          text: "Bloodbond drew vigor from the slain",
          amount: next.hp - beforeHeal,
        });
    }

    // Bonus move (rebalanced): only chains of 7+ grant a free action, AND only
    // once per enemy cycle. Chain-6 still gets a damage bump (handled above)
    // but the enemy phase still runs.
    const enemiesAlive = next.enemies.some((e) => e.hp > 0);
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
    let afterEnemies: CombatState & {
      heavyFired?: boolean;
      abilityLogs?: Array<Omit<CombatLogEntry, "id">>;
      abilityEffects?: AbilityEffect[];
      thornsLog?: Omit<CombatLogEntry, "id">;
      __pendingSealAdds?: string[];
    };
    if (grantsBonusMove) {
      afterEnemies = next;
    } else if (enemiesAlive) {
      const aliveBeforeEnemyPhase = new Set(
        next.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id),
      );
      // Count minions already on the board so summon_minion respects its cap.
      const summonsSoFar = next.enemies.filter(
        (e) => e.archetypeId === "bone_husk",
      ).length;
      afterEnemies = enemiesAttack(
        next,
        telegraphActive,
        bossRule,
        summonsSoFar,
        {
          cls: hero.class,
          relicMultiplier: thornsRelicMultiplier(relics),
          incomingMultiplier: incomingMult,
        },
      );
      // Apply ability side-effects (corrupt/seal/spawn) to the page-level state.
      // IMPORTANT: corrupt_tile / seal_tile additions are collected into the
      // local `nextCorruption` / `pendingSealAdds` so they merge with the
      // single end-of-turn setCorruption/setSeals calls below — using
      // functional updaters here would race and get overwritten.
      const effects = afterEnemies.abilityEffects ?? [];
      const pendingSealAdds: string[] = [];
      for (const eff of effects) {
        if (eff.kind === "spawn_minion") {
          afterEnemies = {
            ...afterEnemies,
            enemies: [...afterEnemies.enemies, eff.enemy],
          };
        } else if (eff.kind === "corrupt_tile") {
          // Drop one corrupted cell on the first available non-sealed,
          // non-corrupted square (deterministic scan keeps replays stable).
          // No longer gated on the corruption BAND — the ability fired and
          // logged, so its board effect must actually land (was a silent
          // no-op on 16 levels whose enemies carry corrupt_tile off-band).
          const cells = new Set(nextCorruption.cells);
          let placed = false;
          outer: for (let r = 0; r < 5; r++)
            for (let c = 0; c < 5; c++) {
              const k = `${r}-${c}`;
              if (
                !cells.has(k) &&
                !seals.has(k) &&
                !pendingSealAdds.includes(k)
              ) {
                cells.add(k);
                placed = true;
                break outer;
              }
            }
          if (placed) {
            nextCorruption = { cells, sources: nextCorruption.sources };
            turnLogs.push({
              kind: "corruption",
              text: "A new rune was corrupted",
            });
          }
        } else if (eff.kind === "seal_tile") {
          for (let r = 0; r < 5; r++)
            for (let c = 0; c < 5; c++) {
              const k = `${r}-${c}`;
              if (!seals.has(k) && !pendingSealAdds.includes(k)) {
                pendingSealAdds.push(k);
                turnLogs.push({ kind: "info", text: "A rune was sealed shut" });
                r = 5;
                c = 5;
                break;
              }
            }
        }
      }
      // Stash for the final setSeals merge below.
      afterEnemies.__pendingSealAdds = pendingSealAdds;
      // Push enemy ability logs (heavy_strike / shield_self / heal_ally / etc).
      if (afterEnemies.abilityLogs?.length)
        turnLogs.push(...afterEnemies.abilityLogs);
      // ── Shield Thorns ── push reflect log + record bestiary kills + pulse FX
      if (afterEnemies.thornsLog) {
        turnLogs.push(afterEnemies.thornsLog);
        // Diff pre/post-attack enemy hp to attribute kills to thorns for the
        // Bestiary. Chain kills already recorded above; this catches any new
        // foes who died during the enemy phase from reflected damage.
        for (const e of afterEnemies.enemies) {
          if (e.hp <= 0 && aliveBeforeEnemyPhase.has(e.id)) {
            recordKill(e);
            afterEnemies = onEnemyKilled(relics, afterEnemies);
          }
        }
        // Brief shield-pill pulse to cue the reflect.
        const shieldEl = playRootRef.current?.querySelector(
          '[data-fx-target="shield"]',
        ) as HTMLElement | null;
        if (shieldEl) {
          shieldEl.style.transition =
            "transform 220ms ease-out, filter 220ms ease-out";
          shieldEl.style.transform = "scale(1.35)";
          shieldEl.style.filter = "drop-shadow(0 0 6px hsl(var(--gold) / 0.9))";
          window.setTimeout(() => {
            shieldEl.style.transform = "";
            shieldEl.style.filter = "";
          }, 220);
        }
        // First-ever Thorns trigger → show one-time mechanic intro.
        try {
          if (!localStorage.getItem(seenMechanicKey("thorns"))) {
            setIntroMechanic("thorns");
          }
        } catch {
          /* localStorage may be unavailable */
        }
      }
    } else {
      afterEnemies = endTurn(next);
    }
    if (grantsBonusMove) {
      setBonusUsedThisCycle(true);
      toast.success(`✨ Bonus move! Chain x${chain.length}`, {
        duration: 1400,
      });
      turnLogs.push({
        kind: "info",
        text: `Chain x${chain.length} — bonus move! Enemies hesitate.`,
      });
    } else if (tier.bonus && enemiesAlive) {
      if (chain.length >= 8)
        toast.success(`💥 Massive chain x${chain.length}!`, { duration: 1300 });
      turnLogs.push({
        kind: "info",
        text: `Chain x${chain.length} — massive damage! (bonus already used this cycle)`,
      });
    } else if (chain.length === 6 && enemiesAlive) {
      turnLogs.push({ kind: "info", text: `Chain x6 — heavy strike!` });
    }
    if (!grantsBonusMove) {
      setBonusUsedThisCycle(false);
    }

    if (afterEnemies.heavyFired) {
      toast.error("⚡ Heavy strike!", { duration: 1200 });
      turnLogs.push({
        kind: "heavy",
        text: "A telegraphed heavy strike landed!",
      });
    }

    // Damage taken / mitigated lines.
    const hpLost = Math.max(0, hpBefore - afterEnemies.hp);
    if (hpLost > 0) {
      tookDamageRef.current = true;
      turnLogs.push({
        kind: "taken",
        text: "Enemies retaliated",
        amount: hpLost,
      });
      rdSfx("hero.hurt");
    } else if (next.enemies.some((e) => e.hp > 0) && rawIncoming > 0) {
      turnLogs.push({ kind: "info", text: "You weathered the assault" });
    }
    if (hadShield && rawIncoming > hpLost) {
      const mitigated = rawIncoming - hpLost;
      if (mitigated > 0)
        turnLogs.push({
          kind: "mitigated",
          text: "Your guard absorbed the blow",
          amount: mitigated,
        });
    }
    // Audio follows resolution; shared CombatFeedback reads committed deltas.
    if (resolution.hpHealed > 0) {
      rdSfx("hero.heal");
    }
    if (resolution.manaGained > 0) {
      rdSfx("mana.gain", { index: resolution.manaGained });
    }
    if (resolution.guardGained > 0) {
      rdSfx("shield.up");
    }
    // Enemy hit/die cues per kill in this chain.
    if (resolution.damageDealt > 0) {
      rdSfx("enemy.hit");
    }
    for (const killId of resolution.enemyKills) {
      const killed = combat.enemies.find((e) => e.id === killId);
      rdSfx(killed?.tier === "boss" ? "boss.roar" : "enemy.die");
    }
    // Mana orbs filled to ready → ability ready cue
    if (next.mana >= MAX_MANA && combat.mana < MAX_MANA) {
      rdSfx("ability.ready");
    }

    // Explicit "a save fired this turn" flag — set ONLY when Aegis / Last Stand
    // / Phoenix actually restores HP from a lethal blow. Cleric T4 reads this
    // instead of a pre-shield-damage heuristic that mis-fired whenever a shield
    // absorbed a nominally-lethal hit (and missed real revives).
    let revivedThisTurn = false;
    // ── Mastery: Cleric T5 Eternal Aegis — once per run, block a fatal hit.
    // Runs BEFORE the relic Last Stand / Phoenix saves so the cheap free
    // mastery save burns first; relics can still bail you out next time.
    if (
      afterEnemies.hp <= 0 &&
      hasMasteryAegis(activeMasteries) &&
      !aegisFiredRef.current
    ) {
      afterEnemies = { ...afterEnemies, hp: 1 };
      aegisFiredRef.current = true;
      revivedThisTurn = true;
      toast.success("🛡️ Aegis blocked the killing blow!", { duration: 1800 });
      turnLogs.push({
        kind: "laststand",
        text: "Eternal Aegis — fatal hit blocked!",
      });
    }
    // Relic: Last Stand — survive lethal at 1 HP. R1–R4: 1 use; R5: 2 uses.
    if (afterEnemies.hp <= 0) {
      const ls = tryLastStand(relics, afterEnemies.hp, lastStandUsed);
      if (ls.saved) {
        afterEnemies = { ...afterEnemies, hp: ls.hp };
        setLastStandUsed((c) => c + 1);
        revivedThisTurn = true;
        toast.success("💔 Last Stand! Survived at 1 HP", { duration: 1800 });
        turnLogs.push({
          kind: "laststand",
          text: "Last Stand! You survived at 1 HP",
        });
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
        toast.success(`🔥 Phoenix Heart! Revived at ${reviveHp} HP`, {
          duration: 2200,
        });
        turnLogs.push({
          kind: "laststand",
          text: `Phoenix Heart blazed — revived at ${reviveHp} HP`,
        });
      }
    }

    // ── Mastery: Warrior T4 Brace — first time HP drops below 25% in a run,
    // gain a 2-turn shield. Single-use; only fires when player is still alive.
    if (
      hasMasteryPanicShield(activeMasteries) &&
      !braceFiredRef.current &&
      afterEnemies.hp > 0 &&
      afterEnemies.hp / Math.max(1, afterEnemies.maxHp) < 0.25
    ) {
      afterEnemies = {
        ...afterEnemies,
        shieldTurns: Math.max(afterEnemies.shieldTurns, 2),
      };
      braceFiredRef.current = true;
      toast.success("🛡️ Brace! 2-turn shield", { duration: 1500 });
      turnLogs.push({
        kind: "shield",
        text: "Brace — your guard surged at the brink",
        amount: 2,
      });
    }
    // ── Mastery: Cleric T4 Resurgent Light — if an actual revive fired this
    // turn (Aegis / Last Stand / Phoenix), scorch up to 2 targetable enemies.
    if (revivedThisTurn && reviveBurstActive(activeMasteries)) {
      const burst = damageEnemies(afterEnemies, 25, bossRule, 2);
      afterEnemies = burst.next;
      if (burst.damageDealt > 0) {
        turnLogs.push({
          kind: "ability",
          text: "Resurgent Light scorched the closest foes",
          amount: burst.damageDealt,
        });
      }
      for (const killId of burst.enemyKills) {
        const killed = combat.enemies.find((enemy) => enemy.id === killId);
        recordKill(killed);
        turnLogs.push({
          kind: "kill",
          text: `${killed?.name ?? "A foe"} fell to Resurgent Light`,
        });
        afterEnemies = onEnemyKilled(relics, afterEnemies);
      }
    }

    // ── Linked Pairs (L46+) — clearing one cell triggers its twin too. ──
    let chainForResolve = chain;
    if (linkedPairsActive && linkedPairs.pairs.size > 0) {
      const triggered = pairsTriggeredByChain(linkedPairs, chain);
      if (triggered.length > 0) {
        chainForResolve = [...chain, ...triggered];
        const clearedKeys = chainForResolve.map((c) => `${c.r}-${c.c}`);
        const nextPairs: LinkedPairsState = {
          pairs: new Map(linkedPairs.pairs),
        };
        consumePairs(nextPairs, clearedKeys);
        setLinkedPairs(nextPairs);
        turnLogs.push({
          kind: "info",
          text: `🔗 Linked twin${triggered.length > 1 ? "s" : ""} cleared`,
        });
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
    const pendingSealAdds: string[] = afterEnemies.__pendingSealAdds ?? [];
    const broken = seals.size ? sealsBrokenByChain(seals, chain) : [];
    if (broken.length || pendingSealAdds.length) {
      const nextSeals = new Set(seals);
      broken.forEach((k) => nextSeals.delete(k));
      pendingSealAdds.forEach((k) => nextSeals.add(k));
      setSeals(nextSeals);
      if (broken.length) {
        turnLogs.push({
          kind: "info",
          text:
            broken.length > 1
              ? `${broken.length} seals shattered`
              : "A seal shattered",
        });
      }
    }

    // Spread corruption AFTER the chain resolves (player's turn ended).
    // On a bonus-move chain the turn does NOT end, so corruption holds too.
    if (corruptionActive && nextCorruption.sources.size && !grantsBonusMove) {
      nextCorruption = spreadCorruption(
        nextCorruption,
        rngTick,
        level.generation_seed,
        seals,
      );
    }
    setCorruption(nextCorruption);

    setRngTick((t) => t + 1);
    setGrid(newGrid);

    // ── Multi-wave: spawn the next wave when the current wave fully clears ──
    // Avoid double-spawning when multiple kills land on the same chain.
    let postWave = afterEnemies;
    const allDead = postWave.enemies.every((e) => e.hp <= 0);
    if (allDead && waveDefs && wavesSpawnedRef.current < waveDefs.length) {
      const nextWave = waveDefs[wavesSpawnedRef.current];
      const fresh = prepareCampaignEnemies(nextWave.enemies ?? [], {
        idPrefix: `w${wavesSpawnedRef.current + 1}-`,
        seed: level.generation_seed + wavesSpawnedRef.current + 1,
        level: level.level_number,
        telegraphed: telegraphActive,
        foresightTurns: getTelegraphReadyEarly(relics),
        hpMultiplier: pathEffect.eliteEnemyHpMult,
      });
      postWave = spawnWave(postWave, fresh, nextWave.reinforcement_turns ?? 2);
      wavesSpawnedRef.current += 1;
      const isBossWave = fresh.some((e) => e.tier === "boss");
      toast.success(
        isBossWave ? "👑 The Boss arrives!" : "⚔️ Wave 2 — Reinforcements!",
        { duration: 2000 },
      );
      pushLog({
        kind: "info",
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
        turnLogs.push({
          kind: "corruption",
          text: "🔥 Inferno burns",
          amount: drain,
        });
      }
    }
    // ── R5: Boss phase transitions ──────────────────────────────────────
    // Detect AFTER all damage has been applied for the turn (chain +
    // relic procs + any wave damage). Phase damage bumps apply to the
    // boss's `damage` field, which the engine reads on the NEXT
    // enemy turn — giving the player one "warning" turn between
    // hearing "Phase 2 — Awakened" and feeling the bigger hits.
    {
      const transitions = detectPhaseTransitions(
        postWave.enemies,
        bossPhasesRef.current,
      );
      for (const t of transitions) {
        bossPhasesRef.current.set(t.enemyId, t.to);
        const e = postWave.enemies.find((e) => e.id === t.enemyId);
        if (e) applyPhaseDamageBump(e, t);
        turnLogs.push({
          kind: "info",
          text: `👑 ${t.enemyName} · ${t.def.name} — ${t.def.flavor}`,
        });
      }
      // V1 — fire the cinematic for the LAST transition in the batch.
      // If a chain crossed two thresholds in one swing (1→2→3), only
      // phase 3 gets the on-screen flash so the player doesn't see
      // two overlapping cinematics. Phase 2 still logs.
      if (transitions.length > 0) {
        const last = transitions[transitions.length - 1];
        setPhaseFlashMeta({
          phase: last.to as 2 | 3,
          bossName: last.enemyName,
          flavor: last.def.flavor,
        });
        setPhaseFlashKey((k) => k + 1);
      }
    }
    setCombat(postWave);
    pushLogs(turnLogs);

    const status = evaluateObjective(
      postWave,
      currentTurnBudget(),
      objType,
      objectiveTarget,
    );
    if (status.over)
      void finalize(postWave, status.cleared, rewardTotals, newGrid);
  };

  const handleAbility = () => {
    const relics = activeRelicsSnapshot ?? activeRelics;
    // First Light: the first N ability casts each run truly cost 0 mana — they
    // can fire at an empty pool, not just refund afterward. effectiveCost 0
    // lets useAbility resolve the cast while spending nothing.
    const isFreeCast = abilityFreeFirstUse(relics, abilityUsedCount);
    const effectiveCost = isFreeCast ? 0 : abilityManaCost;
    const { next, ok } = activateAbility(
      combat,
      hero.class,
      bossRule,
      activeMasteries,
      level.level_number,
      effectiveCost,
    );
    if (!ok) {
      toast.info("Ability not ready — fill mana orbs first.");
      return;
    }
    rdSfx(`ability.cast.${hero.class}`);
    const turnLogs: Array<Omit<CombatLogEntry, "id">> = [];
    const ABILITY_LABEL: Record<string, string> = {
      warrior: "Cleave swept the battlefield",
      mage: "Arcane bolt crashed home",
      rogue: "Shadowstep — next strike doubled",
      cleric: "Sanctuary mended you",
    };
    const dealt = next.totalDamage - combat.totalDamage;
    const killed = next.enemiesDefeated - combat.enemiesDefeated;
    const healed = Math.max(0, next.hp - combat.hp);
    // Track which archetypes died from this ability for the Bestiary.
    if (killed > 0) {
      const newlyDead = next.enemies.filter(
        (e) =>
          e.hp <= 0 && combat.enemies.find((o) => o.id === e.id && o.hp > 0),
      );
      newlyDead.forEach(recordKill);
    }
    turnLogs.push({
      kind: "ability",
      text: ABILITY_LABEL[hero.class] ?? "Ability unleashed",
      amount: dealt > 0 ? dealt : healed > 0 ? healed : undefined,
    });
    if (killed > 0)
      turnLogs.push({
        kind: "kill",
        text:
          killed > 1 ? `${killed} foes vanquished!` : "A foe was vanquished!",
      });
    turnLogs.push({ kind: "info", text: "Free action — your turn continues." });
    toast.success("✨ Ability — free action!", { duration: 1200 });

    // First Light: the cast already spent 0 mana (effectiveCost 0) — just flag it.
    let finalNext: CombatState = next;
    for (let i = 0; i < killed; i++)
      finalNext = onEnemyKilled(relics, finalNext);
    if (isFreeCast) {
      turnLogs.push({
        kind: "info",
        text: "🌅 First Light — free cast (0 mana)",
      });
      toast.success("🌅 First Light — free!", { duration: 1100 });
    }
    // ── Mastery: Mage T5 Overflow — every 6th mana spent refunds 1.
    // Only counts mana that was actually paid (not free casts).
    if (!isFreeCast) {
      const newSpent = totalManaSpent + abilityManaCost;
      setTotalManaSpent(newSpent);
      if (
        shouldMasteryRefundMana(activeMasteries, newSpent, abilityManaCost) &&
        finalNext.mana < MAX_MANA
      ) {
        finalNext = {
          ...finalNext,
          mana: Math.min(MAX_MANA, finalNext.mana + 1),
        };
        turnLogs.push({
          kind: "mana",
          text: "🌀 Overflow refunded mana",
          amount: 1,
        });
      }
    }
    setAbilityUsedCount((c) => c + 1);

    // Abilities are now FREE actions: no enemy retaliation, no turn consumed,
    // no corruption spread. Player keeps their turn to chain again.
    let postWave = finalNext;
    const allDeadAbil = postWave.enemies.every((e) => e.hp <= 0);
    if (allDeadAbil && waveDefs && wavesSpawnedRef.current < waveDefs.length) {
      const nextWave = waveDefs[wavesSpawnedRef.current];
      const fresh = prepareCampaignEnemies(nextWave.enemies ?? [], {
        idPrefix: `w${wavesSpawnedRef.current + 1}-`,
        seed: level.generation_seed + wavesSpawnedRef.current + 1,
        level: level.level_number,
        telegraphed: telegraphActive,
        foresightTurns: getTelegraphReadyEarly(relics),
        hpMultiplier: pathEffect.eliteEnemyHpMult,
      });
      postWave = spawnWave(postWave, fresh, nextWave.reinforcement_turns ?? 2);
      wavesSpawnedRef.current += 1;
      const isBossWave = fresh.some((e) => e.tier === "boss");
      toast.success(
        isBossWave ? "👑 The Boss arrives!" : "⚔️ Wave 2 — Reinforcements!",
        { duration: 2000 },
      );
      pushLog({
        kind: "info",
        text: isBossWave
          ? `The ground trembles — the Boss enters! +${nextWave.reinforcement_turns ?? 2} turns granted.`
          : `Reinforcements arrive! +${nextWave.reinforcement_turns ?? 2} turns granted.`,
      });
    }
    // R5: same boss-phase check as the other setCombat path — fires
    // for both the standard "turn ended" branch and the wave-spawn
    // branch so phase transitions never get skipped.
    {
      const transitions = detectPhaseTransitions(
        postWave.enemies,
        bossPhasesRef.current,
      );
      for (const t of transitions) {
        bossPhasesRef.current.set(t.enemyId, t.to);
        const e = postWave.enemies.find((e) => e.id === t.enemyId);
        if (e) applyPhaseDamageBump(e, t);
        turnLogs.push({
          kind: "info",
          text: `👑 ${t.enemyName} · ${t.def.name} — ${t.def.flavor}`,
        });
      }
      // V1 — fire the cinematic for the LAST transition in the batch.
      // If a chain crossed two thresholds in one swing (1→2→3), only
      // phase 3 gets the on-screen flash so the player doesn't see
      // two overlapping cinematics. Phase 2 still logs.
      if (transitions.length > 0) {
        const last = transitions[transitions.length - 1];
        setPhaseFlashMeta({
          phase: last.to as 2 | 3,
          bossName: last.enemyName,
          flavor: last.def.flavor,
        });
        setPhaseFlashKey((k) => k + 1);
      }
    }
    setCombat(postWave);
    pushLogs(turnLogs);
    const status = evaluateObjective(
      postWave,
      currentTurnBudget(),
      objType,
      objectiveTarget,
    );
    if (status.over)
      void finalize(postWave, status.cleared, {
        goldRunesCleared,
        bonusShardsFromMastery,
        bonusScoreFromTreasure,
        bonusShardsFromTreasure,
        abilityUsedCount: abilityUsedCount + 1,
      });
  };

  const retryFinalization = () => {
    const pending = failedFinalRef.current;
    if (pending) void finalize(pending.final, pending.cleared, pending.totals);
  };

  async function finalize(
    final: CombatState,
    cleared: boolean,
    totals: RunRewardTotals,
    finalGrid = grid,
  ) {
    if (finalizeBusyRef.current || !level || !hero) return;
    finalizeBusyRef.current = true;
    failedFinalRef.current = { final, cleared, totals };
    setSaveError(null);
    setSubmitting(true);
    const finalTurnBudget = currentTurnBudget();
    const turnsUsed = Math.max(0, finalTurnBudget - final.turnsRemaining);
    const relicsForFinal = activeRelicsSnapshot ?? activeRelics;
    // Optional Layered-Goal bonus (Band 4): met = extra score + shards. It is a
    // pure reward now, never a clear requirement (see evaluateObjective).
    const secondaryMetThisRun = !!(
      cleared &&
      secondaryObjective &&
      secondaryMet(secondaryObjective, final, finalTurnBudget)
    );
    const rawBreakdown = calculateScore({
      totalDamage: final.totalDamage,
      enemiesDefeated: final.enemiesDefeated,
      hpRemaining: final.hp,
      turnsRemaining: final.turnsRemaining,
      longestChain: final.longestChain,
      cleared,
      rogueBonus: final.rogueBonusTriggered && hero.class === "rogue",
      secondaryBonus: secondaryMetThisRun,
    });
    // Momentum: scale final score when longest chain >= 4.
    const momentumMult = momentumScoreBonusMult(
      relicsForFinal,
      final.longestChain,
    );
    // Mastery: Rogue T1 Gilded Eye — +2 score per gold rune cleared.
    const goldEyeBonus = getMasteryGoldScoreBonus(
      activeMasteries,
      totals.goldRunesCleared,
    );
    // Chamber-layout treasure bonus accrued during the run (R1).
    // Added flat (after the momentum multiplier) so it reads as its
    // own line — treasure is a board property, not a chain bonus.
    const treasureScore = totals.bonusScoreFromTreasure;
    // R3 — Run modifier score multiplier. Applied LAST so it composes
    // over everything (base + momentum + goldEye + treasure).
    const modScoreMult = resolveEffect(activeModifier).scoreMult;
    const preMod =
      momentumMult > 1
        ? Math.round(rawBreakdown.total * momentumMult) +
          goldEyeBonus +
          treasureScore
        : rawBreakdown.total + goldEyeBonus + treasureScore;
    const breakdown = {
      ...rawBreakdown,
      total: Math.round(preMod * modScoreMult),
    };
    const reason: "cleared" | "defeated" | "timeout" = cleared
      ? "cleared"
      : final.hp <= 0
        ? "defeated"
        : "timeout";
    // OPTIMISTIC isNewBest — used only for the immediate end-state card. The
    // canonical, server-truth value is taken from the mutation result below
    // and used for hero XP/lifetime increments.
    const isNewBest =
      !existingRun || breakdown.total > (existingRun.score ?? 0);

    // ── Rune Shards reward ────────────────────────────────────────────────
    const compassEquipped = has(relicsForFinal, "wanderers_compass");
    const compassMultiplier = compassShardBonus(relicsForFinal);
    const isFirstClear =
      cleared && (!existingRun || !existingRun.dungeon_cleared);
    const bossClear = cleared && level.level_number % 25 === 0;
    const totalEnemies = Math.max(
      1,
      (level.enemy_config?.length ?? 0) +
        (waveDefs ?? []).reduce((sum, wave) => sum + wave.enemies.length, 0),
    );
    const bossPhaseReached = Math.max(0, ...bossPhasesRef.current.values());
    const nextFailureCount = (failureRow?.failure_count ?? 0) + 1;
    const meaningful =
      cleared ||
      (final.totalDamage > 0 && (turnsUsed >= 2 || final.enemiesDefeated > 0));
    const xp = campaignXpForAttempt({
      levelNumber: level.level_number,
      score: breakdown.total,
      cleared,
      isFirstClear,
      previousBestScore: existingRun?.score ?? 0,
      failureCount: nextFailureCount,
      enemiesKilled: final.enemiesDefeated,
      totalEnemies,
      turnsUsed,
      turnLimit: finalTurnBudget,
      bossPhaseReached,
      bossHasRule: !!bossRule,
      meaningful,
    });
    let shardsAwarded = 0;
    // Daily Greed multiplies shard reward; bonus shards from Rogue T5 mastery
    // get added on top after the base computation.
    const dailyShardMult = isDailyMode ? dailyShardMultiplier(dailyMods) : 1;
    const masteryBonusShards = totals.bonusShardsFromMastery;
    const treasureBonusShards = totals.bonusShardsFromTreasure;
    const treasureAwarded = cleared
      ? treasureBonusShards
      : Math.round(
          totals.bonusShardsFromTreasure * failureMultiplier(nextFailureCount),
        );
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
        const breakdownShards = computeFailureShards({
          levelNumber: level.level_number,
          failureCount: nextFailureCount,
          enemiesKilled: final.enemiesDefeated,
          totalEnemies,
          turnsUsed,
          turnLimit: finalTurnBudget,
          bossPhaseReached,
          bossHasRule: !!bossRule,
          compassEquipped,
          compassMultiplier,
        });
        shardsAwarded = breakdownShards.total;
      }
    } catch {
      shardsAwarded = 0;
    }
    // Apply Daily Greed multiplier + Rogue T5 bonus shards on top.
    if (dailyShardMult !== 1)
      shardsAwarded = Math.round(shardsAwarded * dailyShardMult);
    // R2: path-variant shard bonus (Treasure +25%, Elite +50%).
    // Applied after the daily multiplier but before the additive
    // bonuses (mastery/treasure cells) so the multiplicative effects
    // compose cleanly without scaling the additive bonuses.
    if (pathEffect.shardBonusMult !== 1) {
      shardsAwarded = Math.round(shardsAwarded * pathEffect.shardBonusMult);
    }
    shardsAwarded += masteryBonusShards;
    shardsAwarded += treasureAwarded;
    // Layered-Goal bonus shards — meeting the optional secondary objective now
    // pays out (it used to be a hidden clear requirement with no extra reward).
    const secondaryBonusShards = secondaryMetThisRun ? 10 : 0;
    shardsAwarded += secondaryBonusShards;
    if (secondaryMetThisRun) {
      pushLog({
        kind: "info",
        text: `🎯 Bonus objective met · +250 score · +${secondaryBonusShards} shards`,
      });
    }
    const display = {
      cleared,
      reason,
      score: breakdown.total,
      isNewBest,
      shards: shardsAwarded,
    };
    setEndState(display);
    rdSfx(cleared ? "victory" : "defeat");
    try {
      if (level.id.startsWith("transient-"))
        throw new Error("Chamber is not ready. Please reload and retry.");
      // Freeze the entire submission on first attempt. A timeout followed by
      // a cache refresh must retry the same receipt and reward telemetry.
      if (!pendingSaveRef.current)
        pendingSaveRef.current = {
          request_id: crypto.randomUUID(),
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
          quest_context: {
            abilities_used: totals.abilityUsedCount,
            bosses_defeated: Array.from(defeatedArchetypesRef.current.entries())
              .filter(
                ([id]) =>
                  id.endsWith("__boss") ||
                  id.endsWith("__mini") ||
                  rosterById(id)?.role === "controller",
              )
              .reduce((sum, [, count]) => sum + count, 0),
            no_damage_clear: cleared && !tookDamageRef.current,
          },
          reward_context: {
            path: pathVariant?.id ?? "standard",
            treasure_shards: treasureBonusShards,
            mastery_shards: masteryBonusShards,
            secondary_met: secondaryMetThisRun,
            total_enemies: totalEnemies,
            turn_limit: finalTurnBudget,
            boss_phase_reached: bossPhaseReached,
            boss_rule: !!bossRule,
          },
        };
      // Persist synchronously before the request, including its receipt ID.
      // The regular snapshot effect then refreshes the remaining board mechanics.
      if (runKey) {
        const previous = loadSnapshot(runKey, level.generation_seed);
        if (previous)
          saveSnapshot(runKey, {
            ...previous,
            savedAt: Date.now(),
            combat: final,
            grid: finalGrid ?? previous.grid,
            pendingSettlement: {
              input: pendingSaveRef.current,
              cleared,
              totals,
              display,
            },
          });
      }
      const result = await submit.mutateAsync(pendingSaveRef.current);
      settlementConfirmedRef.current = true;
      pendingSaveRef.current = null;
      failedFinalRef.current = null;
      setSubmitting(false);
      const serverWasNewBest = result.wasNewBest;
      const { improvedChain, improvedTurns, improvedHp, firstClear } = result;
      shardsAwarded = result.shardsAwarded;
      if (runKey) clearSnapshot(runKey);
      setEndState((prev) =>
        prev
          ? {
              ...prev,
              isNewBest: serverWasNewBest,
              shards: result.shardsAwarded,
              xp: result.xpAwarded,
              improvedChain,
              improvedTurns,
              improvedHp,
              firstClear,
            }
          : prev,
      );
      try {
        sessionStorage.setItem(
          `rd-just-submitted-${hero.class}-${level.level_number}`,
          String(Date.now()),
        );
        sessionStorage.setItem(
          `rd-improvements-${hero.class}-${level.level_number}`,
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
        if (user)
          sessionStorage.setItem(
            `rd-result-v2:${user.id}:${hero.class}:${level.level_number}`,
            JSON.stringify({
              version: 2,
              userId: user.id,
              heroClass: hero.class,
              levelNumber: level.level_number,
              ts: Date.now(),
              score: breakdown.total,
              totalDamage: final.totalDamage,
              enemiesDefeated: final.enemiesDefeated,
              hpRemaining: final.hp,
              turnsUsed,
              longestChain: final.longestChain,
              xpEarned: result.xpAwarded,
              dungeonCleared: cleared,
              shardsAwarded: result.shardsAwarded,
              wasNewBest: serverWasNewBest,
              improvedChain,
              improvedTurns,
              improvedHp,
              firstClear,
            }),
          );
      } catch {
        /* Storage is optional; server run and rewards are committed. */
      }
      const acquisitions: RuneRewardItem[] = [];
      const drop = result.relicDrop
        ? getRelic(result.relicDrop.relic_id)
        : null;
      if (drop)
        acquisitions.push({
          kind: "relic",
          relicId: drop.id,
          rank: result.relicDrop?.rank ?? 1,
          label: drop.name,
          detail: drop.description,
        });
      acquisitions.push(
        ...progressionRewardItems(
          hero.class,
          result,
          wallet?.slots_unlocked ?? 2,
        ),
      );
      setSettlementRewards(acquisitions);
      // R4: if this was a Daily Chamber run (entered with ?dailyMod
      // query param), mark today's daily as played so the home card
      // gates against re-entry until UTC midnight. We mark on finalize
      // (clear OR fail) so abandoning mid-run doesn't burn the slot.
      const lockedModId = searchParams.get("dailyMod");
      if (lockedModId && user?.id) {
        const dateStr = todayUtcDateString();
        markDailyChamberPlayed(user.id, dateStr);
      }
      // Loot is rolled and owned atomically by the same settlement receipt.
      // Retries display its confirmed drop without a second client-side roll.
      // Any confirmed relic drop is already included in the centered acquisition gallery.

      // ── Bestiary: record defeats from this run ─────────────────────────
      try {
        const defeats = Array.from(defeatedArchetypesRef.current.entries()).map(
          ([archetypeId, count]) => ({
            archetypeId,
            count,
            levelNumber: level.level_number,
          }),
        );
        if (defeats.length > 0) {
          const { newlyDiscovered } = await recordDefeats.mutateAsync(defeats);
          if (newlyDiscovered.length > 0) {
            const allNames = newlyDiscovered.map(
              (id) => rosterById(id)?.name ?? "Unknown",
            );
            // Battle Chronicle: one discovery line per newly-logged foe so the
            // post-run log mirrors what the toast announces.
            pushLogs(
              allNames.map((name) => ({
                kind: "info" as const,
                text: `📖 Bestiary updated: ${name}`,
              })),
            );
            setSettlementRewards((current) => [
              ...current,
              ...allNames.map((name) => ({
                kind: "discovery" as const,
                label: name,
                detail:
                  "Added to your Bestiary. Discover its tactics and rewards.",
              })),
            ]);
          }
        }
      } catch {
        /* bestiary write is best-effort */
      }

      // Daily challenge submission no longer happens here — Endless Survival
      // handles its own submission flow on its own page.
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "Could not save run. Your result is ready to retry.";
      toast.error(message);
      setSaveError(message);
      setSubmitting(false);
      finalizeBusyRef.current = false;
    }
  }

  settleResumedScoreRef.current = (restored) => {
    void finalize(restored, true, {
      goldRunesCleared,
      bonusShardsFromMastery,
      bonusScoreFromTreasure,
      bonusShardsFromTreasure,
      abilityUsedCount,
    });
  };

  const status = evaluateObjective(
    combat,
    activeTurnBudget,
    objType,
    objectiveTarget,
  );
  const objectiveProgress = getObjectiveProgress(
    combat,
    activeTurnBudget,
    objType,
    objectiveTarget,
  );
  const primaryTargetId =
    filterTargetable(bossRule, combat.enemies)[0]?.id ?? null;
  const turnDisplay = Math.min(
    activeTurnBudget,
    Math.max(
      1,
      activeTurnBudget - combat.turnsRemaining + (status.over ? 0 : 1),
    ),
  );

  const equippedCount = [
    loadout?.slot_1,
    loadout?.slot_2,
    loadout?.slot_3,
  ].filter(Boolean).length;

  // Live, build-aware chain estimates. Red is marked approximate because
  // enemy armor and target HP can reduce applied damage; resource previews
  // show the exact amount that can enter the hero's current pools.
  const previewRelics = activeRelicsSnapshot ?? activeRelics;
  const previewModsFor = (chainType: RuneType, length: number) => {
    const previewTarget =
      filterTargetable(bossRule, combat.enemies)[0] ??
      combat.enemies.find((enemy) => enemy.hp > 0);
    return computeChainMods(previewRelics, {
      chainType,
      length,
      redChainCountSoFar: chainType === "red" ? redChainCount + 1 : 0,
      isFirstChainOfRun: chainCountTotal === 0,
      hpRatio: combat.hp / Math.max(1, combat.maxHp),
      enemyHpRatioBeforeHit: previewTarget
        ? previewTarget.hp / Math.max(1, previewTarget.maxHp)
        : 1,
      chainNumberThisRun: chainCountTotal + 1,
    });
  };

  const redPreview = (length: number) => {
    const relicMods = previewModsFor("red", length);
    const runMods = resolveEffect(activeModifier);
    const tierMult = chainTier(length).damageMultiplier;
    let masteryMult = getMasteryChainDamageMult(activeMasteries, "red");
    if (isLastStandActive(activeMasteries, combat.hp, combat.maxHp))
      masteryMult *= 1.5;
    masteryMult *= getMasteryOpeningCritMult(activeMasteries, redChainCount);
    if (isDailyMode)
      masteryMult *=
        dailyDamageMultiplier(dailyMods, "red") *
        dailyIroncladDamageMult(dailyMods, length);
    let damage = redChainPower(
      length,
      hero.class,
      level.level_number,
      {
        runMultiplier: runMods.redDamageMult,
        relicMultiplier: relicMods.bonusDamageMult,
        lengthBonus: relicMods.effectiveLengthBonus,
        tierMultiplier: tierMult,
        combatMultiplier: masteryMult,
      },
      combat.shadowstepActive,
    );
    if (relicMods.echoMult > 0)
      damage += Math.round(damage * relicMods.echoMult);
    const critChance = getMasteryChainCritChance(activeMasteries, length);
    return `≈${damage} dmg${critChance > 0 ? ` · ${Math.round(critChance * 100)}% crit` : ""}${tierMult > 1 ? " ⚡" : ""}`;
  };

  const bluePreview = (length: number) => {
    const relicMods = previewModsFor("blue", length);
    let mana = combat.mana;
    let gained = 0;
    const addMana = (amount: number) => {
      const before = mana;
      mana = Math.min(MAX_MANA, mana + amount);
      gained += mana - before;
    };
    addMana((hero.class === "mage" ? 2 : 1) + (length >= 5 ? 1 : 0));
    addMana(relicMods.bonusManaFlat);
    if (length < 5 && length + relicMods.effectiveLengthBonus >= 5) addMana(1);
    if (relicMods.echoMult > 0 && gained > 0) {
      addMana(Math.max(1, Math.round(gained * relicMods.echoMult)));
    }
    const heal = Math.min(
      combat.maxHp - combat.hp,
      getMasteryBlueChainHeal(activeMasteries) +
        getMasteryOpeningHeal(activeMasteries, chainsThisFight),
    );
    const manaText =
      gained > 0 ? `+${gained} orb${gained === 1 ? "" : "s"}` : "Mana full";
    return heal > 0 ? `${manaText} · +${heal} HP` : manaText;
  };

  const greenPreview = (length: number) => {
    const relicMods = previewModsFor("green", length);
    const runMods = resolveEffect(activeModifier);
    let hp = combat.hp;
    let healed = 0;
    const addHeal = (amount: number) => {
      const applied = Math.min(Math.max(0, amount), combat.maxHp - hp);
      hp += applied;
      healed += applied;
    };
    const base =
      hero.class === "cleric" ? Math.round(length * 6 * 1.5) : length * 6;
    addHeal(Math.round(base * runMods.healMult));
    addHeal(relicMods.bonusHealFlat);
    if (relicMods.effectiveLengthBonus > 0) {
      addHeal(
        (hero.class === "cleric" ? 9 : 6) * relicMods.effectiveLengthBonus,
      );
    }
    addHeal(getMasteryOpeningHeal(activeMasteries, chainsThisFight));
    if (relicMods.echoMult > 0 && healed > 0)
      addHeal(Math.round(healed * relicMods.echoMult));
    return healed > 0 ? `+${healed} HP` : "HP full";
  };

  const goldPreview = (length: number) => {
    const relicMods = previewModsFor("gold", length);
    const runMods = resolveEffect(activeModifier);
    let gained =
      Math.max(combat.shieldTurns, 1) +
      Math.floor(length / 3) -
      combat.shieldTurns;
    gained = Math.max(0, Math.round(gained * runMods.shieldMult));
    gained += relicMods.bonusShieldTurns;
    if (relicMods.effectiveLengthBonus > 0) {
      gained +=
        Math.floor((length + relicMods.effectiveLengthBonus) / 3) -
        Math.floor(length / 3);
    }
    if (gained > 0) gained += getMasteryShieldBonus(activeMasteries);
    if (relicMods.echoMult > 0 && gained > 0)
      gained += Math.max(1, Math.round(gained * relicMods.echoMult));
    return `+${gained} shield turn${gained === 1 ? "" : "s"}`;
  };

  const chooseModifier = (modifier: RunModifier) => {
    if (!modifierOffer || activeModifier || status.over || submitting) return;
    const opening = applyOpeningModifier(combat, modifier);
    initialTurnsRef.current = opening.turnsRemaining;
    setCombat(opening);
    setActiveModifier(modifier);
    setModifierOffer(null);
  };

  const encounterCards = [
    {
      title: objectiveLabel(objType),
      text:
        objType === "reach_score"
          ? "Deal damage and defeat enemies to earn combat score. Long chains add a bounded bonus after you land a hit. Health and saved turns still improve your final run score."
          : (activeLayout?.recommendedStrategy ??
            "Watch enemy countdowns and match your runes to the encounter."),
    },
    ...(bossRule
      ? [
          {
            title: getBossRule(bossRule).label,
            text: getBossRule(bossRule).rule,
          },
        ]
      : []),
    ...(secondaryObjective
      ? [
          {
            title: `Bonus · ${secondaryShort(secondaryObjective)}`,
            text: secondaryLabel(secondaryObjective),
          },
        ]
      : []),
    ...activeMechanics.map((id) => {
      const rule = getMechanic(id);
      return { title: rule.name, text: `${rule.oneLiner} ${rule.tip}` };
    }),
    {
      title: `Resonance · ${combat.resonance?.bursts ?? 0} bursts`,
      text: "Connect each of the four rune colors to strike all targetable foes, restore one mana and gain one guard. Repeat colors keep your charge. Abilities and saved runs preserve your progress.",
    },
    ...(activeModifier && activeModifier.id !== STEADY_PATH.id
      ? [{ title: activeModifier.name, text: activeModifier.description }]
      : []),
    {
      title: "Battle record",
      text: `${combat.totalDamage} damage · ${combat.enemiesDefeated} foes defeated · longest chain ${combat.longestChain}`,
    },
  ];
  const detailPage = Math.min(encounterPage, encounterCards.length);
  const openingDialog =
    helpOpen ||
    encounterOpen ||
    enemyInspecting ||
    !!introMechanic ||
    !!introBossRule ||
    !!endState;
  const battleInputBlocked =
    status.over || submitting || !!modifierOffer || openingDialog;

  return (
    <div ref={playRootRef} className="rd-battle rd-screen relative">
      {/* V5 — chamber atmospheric backdrop. Reads the active layout's
          atmosphere keyword + accent color and paints a per-chamber
          wash behind everything else on the play page. Fixed-position
          at z-index -1 so all UI sits on top, untouched. */}
      <ChamberBackdrop layout={activeLayout} />
      {/* Cinematic combat FX overlay — chains, abilities, tier flourishes. */}
      <FxLayer queue={fxQ.queue} onComplete={fxQ.complete} />
      {/* V1 — heavy-strike chyron over the board for chains ≥ 6. */}
      <HeavyStrikeBanner
        triggerKey={heavyFlashKey}
        chainLength={heavyChainLen}
      />
      {/* V1 — full-screen cinematic for R5 boss phase transitions. */}
      <PhaseTransitionFlash
        triggerKey={phaseFlashKey}
        phaseIndex={phaseFlashMeta.phase}
        bossName={phaseFlashMeta.bossName}
        flavor={phaseFlashMeta.flavor}
      />
      <div className="rd-battle-objective">
        <span className="rd-battle-level">
          <small>Depth</small>
          {level.level_number}
        </span>
        <div
          className="rd-battle-progress"
          aria-label={`${objectiveLabel(objType)}: ${objectiveProgress.text}`}
        >
          <div>
            <span>{objectiveLabel(objType)}</span>
            <span
              className={
                combat.turnsRemaining <= 3 ? "text-destructive" : "text-primary"
              }
            >
              {combat.turnsRemaining} moves
            </span>
          </div>
          <div>
            <span style={{ width: `${objectiveProgress.percent}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEncounterOpen(true)}
          className="rd-battle-info btn-press"
          aria-label="Encounter details and battle log"
        >
          <Info size={19} />
        </button>
      </div>
      <CombatFeedback
        className="rd-battle-side"
        state={combat}
        cls={hero.class}
        scope={`${level.level_number}-${level.generation_seed}`}
        abilityRevision={abilityUsedCount}
        disabled={encounterOpen || !!modifierOffer}
      >
        <div className="rd-battle-stage">
          <EnemyDisplay
            enemies={combat.enemies}
            flashId={flashId}
            primaryTargetId={primaryTargetId}
            onInspectChange={setEnemyInspecting}
          />
        </div>
        <HeroStatusBar
          state={combat}
          cls={hero.class}
          onAbility={handleAbility}
          manaCost={
            abilityFreeFirstUse(
              activeRelicsSnapshot ?? activeRelics,
              abilityUsedCount,
            )
              ? 0
              : abilityManaCost
          }
          disabled={battleInputBlocked}
        />
        <ResonanceMeter state={combat} />
      </CombatFeedback>
      <div className="rd-battle-board">
        <RuneBoard
          grid={grid}
          disabled={battleInputBlocked}
          onChainComplete={handleChain}
          seals={seals}
          corruptedCells={corruption.cells}
          corruptionSources={corruption.sources}
          eclipsedCells={eclipse}
          linkedCells={new Set(linkedPairs.pairs.keys())}
          shiftingColumn={shift.column}
          treasureCells={
            new Set(
              [...layoutZones.treasure].filter(
                (key) => !consumedTreasureCells.has(key),
              ),
            )
          }
          hazardCells={layoutZones.hazard}
          effectOverride={{
            red: redPreview,
            blue: bluePreview,
            green: greenPreview,
            gold: goldPreview,
          }}
        />
      </div>
      <div className="rd-battle-footnote">
        {bossRule && (
          <span className="text-gold">
            <Crown size={12} />
            {getBossRule(bossRule).label}
          </span>
        )}
        {secondaryObjective && (
          <span
            className={
              secondaryMet(secondaryObjective, combat, activeTurnBudget)
                ? "text-primary"
                : ""
            }
          >
            <Target size={12} />
            Bonus{" "}
            {secondaryMet(secondaryObjective, combat, activeTurnBudget)
              ? "✓"
              : secondaryShort(secondaryObjective)}
          </span>
        )}
        <span>
          <Sword size={12} />
          {combat.totalDamage}
        </span>
        <span>
          <Skull size={12} />
          {combat.enemiesDefeated}
        </span>
        <span>
          <Zap size={12} />
          {combat.longestChain}
        </span>
      </div>
      <Dialog open={encounterOpen} onOpenChange={setEncounterOpen}>
        <DialogContent className="rd-dialog-theme rd-battle-dialog rd-paged-dialog rd-encounter-dialog">
          <DialogHeader className="rd-dialog-header">
            <DialogTitle className="rd-title text-xl">
              {activeLayout?.name ?? `Chamber ${level.level_number}`}
            </DialogTitle>
            <DialogDescription>
              Depth {level.level_number} · Move {turnDisplay}/{activeTurnBudget}{" "}
              · {objectiveProgress.text}
            </DialogDescription>
          </DialogHeader>
          {detailPage < encounterCards.length ? (
            <div className="rd-encounter-rules">
              <div>
                <h3>{encounterCards[detailPage].title}</h3>
                <p>{encounterCards[detailPage].text}</p>{" "}
                {equippedCount > 0 &&
                  detailPage === encounterCards.length - 1 && (
                    <Link
                      to="/rune-delve/armory"
                      className="flex min-h-11 items-center justify-center gap-1 text-xs font-bold text-primary"
                    >
                      <Shield size={14} />
                      {equippedCount} relics equipped · Armory
                    </Link>
                  )}
              </div>
            </div>
          ) : (
            <CombatLog entries={log} max={8} paged />
          )}
          <RunePager
            page={detailPage}
            pageCount={encounterCards.length + 1}
            onPageChange={setEncounterPage}
            label="Encounter details"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEncounterOpen(false);
                setHelpOpen(true);
              }}
              className="min-h-11 flex-1 rounded-xl border border-border text-xs font-extrabold"
            >
              <HelpCircle size={14} className="mr-1 inline" />
              How to play
            </button>
            <button
              type="button"
              onClick={() => setEncounterOpen(false)}
              className="min-h-11 flex-1 rounded-xl bg-primary text-xs font-extrabold text-primary-foreground"
            >
              Back to battle
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <HowToPlaySheet
        open={helpOpen}
        onOpenChange={setHelpOpen}
        heroClass={hero.class}
      />

      {/* One-time intro for a brand-new mechanic taught at this level. */}
      {introMechanic && (
        <MechanicIntroSheet
          open={!!introMechanic}
          onOpenChange={(o) => {
            if (!o) setIntroMechanic(null);
          }}
          mechanicId={introMechanic}
          levelNumber={level.level_number}
          onBegin={() => {
            try {
              localStorage.setItem(seenMechanicKey(introMechanic), "1");
            } catch {
              /* Storage may be unavailable. */
            }
            setIntroMechanic(null);
          }}
        />
      )}

      {/* One-time intro for a boss-rule level (chapter & mid-chapter bosses). */}
      {introBossRule && !introMechanic && (
        <MechanicIntroSheet
          open={!!introBossRule}
          onOpenChange={(o) => {
            if (!o) setIntroBossRule(null);
          }}
          bossRuleId={introBossRule}
          levelNumber={level.level_number}
          onBegin={() => {
            try {
              localStorage.setItem(`rd-seen-bossrule-${introBossRule}`, "1");
            } catch {
              /* Storage may be unavailable. */
            }
            setIntroBossRule(null);
          }}
        />
      )}

      <Dialog
        open={!!endState}
        onOpenChange={(open) => {
          if (!open && endState && !submitting && !saveError)
            navigate(`/rune-delve/results/${level.level_number}`);
        }}
      >
        {endState && (
          <DialogContent
            className="rd-dialog-theme rd-battle-dialog rd-settlement-dialog border-primary/25 p-0 [&>button]:hidden"
            onEscapeKeyDown={(event) => {
              if (submitting || saveError) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (submitting || saveError) event.preventDefault();
            }}
          >
            <div className="rd-settlement-content p-5 text-center space-y-3">
              <div className="flex justify-center">
                {endState.reason === "cleared" && (
                  <Trophy
                    className="w-12 h-12"
                    style={{ color: "hsl(var(--gold))" }}
                  />
                )}
                {endState.reason === "defeated" && (
                  <Skull className="w-12 h-12 text-destructive" />
                )}
                {endState.reason === "timeout" && (
                  <Hourglass className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <div>
                <DialogTitle className="rd-title text-2xl font-extrabold tracking-tight">
                  {endState.reason === "cleared" &&
                    `Level ${level.level_number} Cleared!`}
                  {endState.reason === "defeated" && "Defeated"}
                  {endState.reason === "timeout" && "Out of Turns"}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-1">
                  {endState.reason === "cleared" &&
                    (endState.isNewBest ? "New best score!" : "Run complete.")}
                  {endState.reason === "defeated" &&
                    "Your hero fell in battle."}
                  {endState.reason === "timeout" &&
                    "Try a different chain strategy."}
                </DialogDescription>
              </div>
              <div className="py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Final Score
                </p>
                <p
                  className="text-3xl font-extrabold font-mono tabular-nums"
                  style={{ color: "hsl(var(--gold))" }}
                >
                  {endState.score.toLocaleString()}
                </p>
                {(endState.shards > 0 || (endState.xp ?? 0) > 0) && (
                  <div
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold"
                    style={{
                      background: "hsl(var(--primary) / 0.15)",
                      color: "hsl(var(--primary))",
                    }}
                  >
                    💠 {submitting ? "Saving " : saveError ? "Pending " : "+"}
                    {endState.shards} Rune Shards
                    {!submitting && !saveError && endState.xp
                      ? ` · +${endState.xp} XP`
                      : ""}
                  </div>
                )}
                {/* R7: relic drop banner — celebratory card when the
                  clear rolled a free unlock. Sits below the shard
                  bonus so the visual order is: score → shards → relic. */}
              </div>
              {settlementRewards.length > 0 && !submitting && !saveError && (
                <div className="rd-settlement-rewards">
                  <RuneRewardGallery compact items={settlementRewards} />
                </div>
              )}
              {saveError && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  {saveError}
                  <span className="mt-1 block text-muted-foreground">
                    Your result is ready. Retry to save the run and its rewards.
                  </span>
                </p>
              )}
              <button
                disabled={submitting}
                onClick={() =>
                  saveError
                    ? retryFinalization()
                    : navigate(`/rune-delve/results/${level.level_number}`)
                }
                className="w-full h-11 rounded-xl font-extrabold text-sm btn-press"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))",
                  color: "white",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                {submitting
                  ? "Saving your run…"
                  : saveError
                    ? "Retry save"
                    : "View Results"}
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* R3 — Chamber boon picker. Shown at run-start with three
          random modifiers + a Skip ("Steady Path") option. Once the
          player picks, the modifier persists for the rest of the run
          (saved into snapshot so backgrounding doesn't lose it). */}
      {modifierOffer && !activeModifier && !status.over && !openingDialog && (
        <RunModifierPicker
          offer={modifierOffer}
          onPick={chooseModifier}
          onSkip={() => chooseModifier(STEADY_PATH)}
        />
      )}
    </div>
  );
}

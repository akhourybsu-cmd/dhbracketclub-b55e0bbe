import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Lock, Check, ChevronRight, Crown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { useMyProgress, useLevelWindow } from "@/hooks/useRuneDelveCampaign";
import { PathVariantPicker } from "@/components/runedelve/PathVariantPicker";
import {
  readLastPathChoice,
  writeLastPathChoice,
} from "@/lib/runedelve/pathVariants";
import {
  chapterFor,
  chapterMeta,
  difficultyTierFor,
  isMilestoneLevel,
  isChapterOpener,
} from "@/lib/runedelve/levelGenerator";
import {
  mechanicsForLevel,
  introMechanicForLevel,
  getMechanic,
  type MechanicId,
} from "@/lib/runedelve/mechanics";
import { getLayoutForLevel } from "@/lib/runedelve/chamberAssignment";
import { DungeonPathPreview } from "@/components/runedelve/DungeonPathPreview";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import "@/components/runedelve/runeMenus.css";

export default function RuneDelveLevelMapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const heroQuery = useRuneDelveHero();
  const { data: hero } = heroQuery;
  const progressQuery = useMyProgress(hero?.class);
  const { data: progress } = progressQuery;
  const [pickerLevel, setPickerLevel] = useState<number | null>(null);
  const [chapter, setChapter] = useState(1);
  const [stage, setStage] = useState(0);
  const initializedTrack = useRef<string | null>(null);
  const highestUnlocked = progress?.highest_unlocked_level ?? 1;
  const highestCompleted = progress?.highest_completed_level ?? 0;
  useEffect(() => {
    const key = `${user?.id}:${hero?.class}`;
    if (!progress || !hero || initializedTrack.current === key) return;
    initializedTrack.current = key;
    setChapter(chapterFor(progress.highest_unlocked_level));
    setStage(Math.floor(((progress.highest_unlocked_level - 1) % 50) / 10));
  }, [progress, hero, user?.id]);

  const chapterStart = (chapter - 1) * 50 + 1;
  const stageStart = chapterStart + stage * 10;
  const levelsQuery = useLevelWindow(stageStart, 10);
  const { data: levels } = levelsQuery;
  const meta = chapterMeta(chapter);
  const completed = Math.max(
    0,
    Math.min(50, highestCompleted - chapterStart + 1),
  );
  const currentChapter = chapterFor(highestUnlocked);
  function enter(levelNumber: number) {
    if (isMilestoneLevel(levelNumber)) setPickerLevel(levelNumber);
    else navigate(`/rune-delve/play/${levelNumber}`);
  }
  const queries = [heroQuery, progressQuery, levelsQuery];
  if (queries.some((q) => q.isError))
    return (
      <RuneDataState
        error
        onRetry={() => queries.forEach((q) => void q.refetch())}
      />
    );
  if (!hero || !progress)
    return (
      <RuneDataState onRetry={() => queries.forEach((q) => void q.refetch())} />
    );

  return (
    <div className="rd-menu-page rd-map-page space-y-4 pb-3">
      <div className="rd-menu-heading">
        <h1 className="rd-title">Dungeon</h1>
        <label className="sr-only" htmlFor="rd-map-chapter">
          Chapter
        </label>
        <select
          id="rd-map-chapter"
          value={chapter}
          className="min-h-11 max-w-[50%] min-w-0 bg-card border border-border/50 rounded-xl text-xs font-bold px-3"
          onChange={(e) => {
            const ch = Number(e.target.value);
            setChapter(ch);
            setStage(
              ch === currentChapter
                ? Math.floor(((highestUnlocked - 1) % 50) / 10)
                : 0,
            );
          }}
        >
          {Array.from(
            { length: Math.max(3, currentChapter + 1) },
            (_, i) => i + 1,
          ).map((ch) => (
            <option key={ch} value={ch}>
              Chapter {ch}
              {ch > currentChapter ? " · Locked" : ""}
            </option>
          ))}
        </select>
      </div>
      <section className="rd-menu-surface rd-chapter-card space-y-2">
        <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-primary">
          Chapter {chapter} · Chambers {chapterStart}–{chapterStart + 49}
        </p>
        <h2 className="rd-title text-xl">{meta.name}</h2>
        <p className="rd-menu-note">{meta.subtitle}</p>
        <div className="flex gap-2 items-center pt-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${completed * 2}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-muted-foreground">
            {completed}/50
          </span>
        </div>
      </section>
      <nav className="rd-route-stages" aria-label="Dungeon route stages">
        {Array.from({ length: 5 }, (_, i) => {
          const start = chapterStart + i * 10;
          return (
            <button
              type="button"
              key={i}
              aria-current={stage === i ? "step" : undefined}
              onClick={() => setStage(i)}
            >
              <span>
                {start}–{start + 9}
              </span>
              <small>
                {highestCompleted >= start + 9
                  ? "CLEARED"
                  : highestUnlocked < start
                    ? "LOCKED"
                    : "EXPLORE"}
              </small>
            </button>
          );
        })}
      </nav>
      <div className="flex items-center gap-4 text-[9px] font-bold text-muted-foreground">
        <span className="flex gap-1 items-center">
          <Check className="h-3 w-3 text-success" /> Cleared
        </span>
        <span className="flex gap-1 items-center">
          <Crown className="h-3 w-3 text-gold" /> Choose a path
        </span>
        <span className="flex gap-1 items-center">
          <Lock className="h-3 w-3" /> Locked
        </span>
      </div>
      {levelsQuery.isLoading || !levels ? (
        <div className="rd-path-grid grid grid-cols-3 sm:grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl skeleton-shimmer"
            />
          ))}
        </div>
      ) : (
        <div
          className="rd-path-grid grid grid-cols-3 sm:grid-cols-5 gap-2"
          key={`${chapter}-${stage}`}
        >
          {levels.map((level) => {
            const number = level.level_number;
            const mechanics =
              (level.modifiers?.mechanics as MechanicId[] | undefined) ??
              mechanicsForLevel(number);
            const mechanic = mechanics.length
              ? getMechanic(mechanics[mechanics.length - 1])
              : null;
            return (
              <DungeonPathPreview
                key={number}
                levelNumber={number}
                layout={getLayoutForLevel(number)}
                tier={difficultyTierFor(number)}
                isUnlocked={number <= highestUnlocked}
                isCleared={number <= highestCompleted}
                isCurrent={number === highestUnlocked}
                isMilestone={isMilestoneLevel(number)}
                isOpener={isChapterOpener(number)}
                mechanicIcon={mechanic?.icon}
                mechanicLabel={mechanic?.name}
                introducesMechanic={!!introMechanicForLevel(number)}
                cornerGlyph={level.modifiers?.boss_rule ? "♛" : null}
                onSelect={() => enter(number)}
              />
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => enter(highestUnlocked)}
        className="rd-map-continue rd-primary-action min-h-12 w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-extrabold text-sm"
      >
        Continue · Chamber {highestUnlocked}{" "}
        <ChevronRight className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {pickerLevel !== null && (
          <PathVariantPicker
            levelNumber={pickerLevel}
            lastPicked={
              user?.id ? readLastPathChoice(user.id, pickerLevel) : null
            }
            onClose={() => setPickerLevel(null)}
            onPick={(variant) => {
              if (user?.id)
                writeLastPathChoice(user.id, pickerLevel, variant.id);
              const number = pickerLevel;
              setPickerLevel(null);
              navigate(
                `/rune-delve/play/${number}${variant.id === "standard" ? "" : `?pathVariant=${variant.id}`}`,
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

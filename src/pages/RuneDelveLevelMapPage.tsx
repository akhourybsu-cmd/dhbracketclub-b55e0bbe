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
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import "@/components/runedelve/runeMenus.css";
import "@/components/runedelve/runeMapResults.css";

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
  const [anchorLevel, setAnchorLevel] = useState(1);
  const viewport = useRuneViewport();
  const pageSize = viewport.short || viewport.landscape ? 6 : 10;
  const initializedTrack = useRef<string | null>(null);
  const highestUnlocked = progress?.highest_unlocked_level ?? 1;
  const highestCompleted = progress?.highest_completed_level ?? 0;
  useEffect(() => {
    const key = `${user?.id}:${hero?.class}`;
    if (!progress || !hero || initializedTrack.current === key) return;
    initializedTrack.current = key;
    setChapter(chapterFor(progress.highest_unlocked_level));
    setStage(Math.floor(((progress.highest_unlocked_level - 1) % 50) / 10));
    setAnchorLevel(progress.highest_unlocked_level);
  }, [progress, hero, user?.id]);

  const chapterStart = (chapter - 1) * 50 + 1;
  const stageStart = chapterStart + stage * 10;
  const pageCount = Math.ceil(10 / pageSize);
  const page = Math.min(
    pageCount - 1,
    Math.floor(Math.max(0, anchorLevel - stageStart) / pageSize),
  );
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
    <div
      className="rd-menu-page rd-map-page rd-map-screen"
      data-short={viewport.short}
      data-landscape={viewport.landscape}
    >
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
            setAnchorLevel(
              ch === currentChapter ? highestUnlocked : (ch - 1) * 50 + 1,
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
      <section className="rd-menu-surface rd-chapter-card rd-map-chapter">
        <p className="rd-map-kicker">
          Chapter {chapter} · Chambers {chapterStart}–{chapterStart + 49}
        </p>
        <h2 className="rd-title">{meta.name}</h2>
        <p className="rd-menu-note rd-map-subtitle">{meta.subtitle}</p>
        <div className="rd-map-progress">
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
              onClick={() => {
                setStage(i);
                setAnchorLevel(start);
              }}
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
      <section
        className="rd-map-node-stage"
        aria-label={`Chambers ${stageStart + page * pageSize} to ${Math.min(stageStart + 9, stageStart + (page + 1) * pageSize - 1)}`}
      >
        <div className="rd-map-legend" aria-hidden="true">
          <span>
            <Check /> Cleared
          </span>
          <span>
            <Crown /> Choose a path
          </span>
          <span>
            <Lock /> Locked
          </span>
        </div>
        {levelsQuery.isLoading || !levels ? (
          <div
            className="rd-path-grid rd-map-nodes rd-motion-collection"
            data-columns={pageSize === 10 ? 5 : 3}
          >
            {Array.from({ length: pageSize }, (_, i) => (
              <div
                key={i}
                className="rd-map-node-placeholder rounded-xl skeleton-shimmer"
              />
            ))}
          </div>
        ) : (
          <div
            className="rd-path-grid rd-map-nodes rd-motion-collection"
            data-columns={pageSize === 10 ? 5 : 3}
            key={`${chapter}-${stage}-${page}`}
          >
            {levels
              .slice(page * pageSize, (page + 1) * pageSize)
              .map((level) => {
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
      </section>
      <div className="rd-map-pager">
        <RunePager
          page={page}
          pageCount={pageCount}
          onPageChange={(next) => setAnchorLevel(stageStart + next * pageSize)}
          label={`Chambers ${stageStart + page * pageSize}–${Math.min(stageStart + 9, stageStart + (page + 1) * pageSize - 1)}`}
        />
      </div>
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

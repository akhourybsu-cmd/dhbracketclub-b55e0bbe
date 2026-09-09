import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Check, ChevronRight, Crown, Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useMyProgress, useLevelWindow } from '@/hooks/useRuneDelveCampaign';
import { PathVariantPicker } from '@/components/runedelve/PathVariantPicker';
import { readLastPathChoice, writeLastPathChoice } from '@/lib/runedelve/pathVariants';
import {
  chapterFor,
  chapterMeta,
  difficultyTierFor,
  isMilestoneLevel,
  isChapterOpener,
  type ObjectiveType,
} from '@/lib/runedelve/levelGenerator';
import { mechanicsForLevel, introMechanicForLevel, getMechanic, type MechanicId } from '@/lib/runedelve/mechanics';
import { getLayoutForLevel } from '@/lib/runedelve/chamberAssignment';
import { DungeonPathPreview } from '@/components/runedelve/DungeonPathPreview';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { getClass } from '@/lib/runedelve/classConfig';
import { cn } from '@/lib/utils';

export default function RuneDelveLevelMapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress(hero?.class);
  // R2 — milestone path picker. When the player taps an unlocked
  // milestone level (every 10th), this opens instead of navigating
  // straight to the play page. Picker writes the choice to local
  // storage + navigates with `?pathVariant=<id>`.
  const [pickerLevel, setPickerLevel] = useState<number | null>(null);
  const highestUnlocked = progress?.highest_unlocked_level ?? 1;
  const highestCompleted = progress?.highest_completed_level ?? 0;
  const initialChapter = useMemo(() => chapterFor(highestUnlocked), [highestUnlocked]);
  const [chapter, setChapter] = useState(initialChapter);

  const start = (chapter - 1) * 50 + 1;
  const { data: levels, isLoading } = useLevelWindow(start, 50);
  const meta = chapterMeta(chapter);
  const completedInChapter = Math.max(0, Math.min(50, highestCompleted - start + 1));
  const chapterPct = Math.round((completedInChapter / 50) * 100);

  return (
    <div className="space-y-4 pb-8">

      {/* Chapter header — flavor + progress */}
      <div className="glass-card p-4" style={{
        background: 'linear-gradient(160deg, hsl(var(--primary) / 0.10), hsl(var(--accent) / 0.04))',
        borderColor: 'hsl(var(--primary) / 0.2)',
      }}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="font-rd-display px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-primary/20 text-primary tracking-[0.18em]">CHAPTER {chapter}</span>
          <span className="text-[10px] font-extrabold text-foreground/75 uppercase tracking-wider">L{start}–{start + 49}</span>
          {hero && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider text-foreground/75">
              <ClassBadge cls={hero.class} size="sm" /> {getClass(hero.class).name} track
            </span>
          )}
        </div>
        <h1 className="rd-title text-xl tracking-wide leading-tight text-foreground">{meta.name}</h1>
        <p className="text-[12px] text-foreground/75 mb-2.5 italic">{meta.subtitle}</p>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="font-extrabold text-foreground/75 uppercase tracking-wider">Progress</span>
          <span className="font-mono font-extrabold tabular-nums text-foreground">{completedInChapter}/50</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${chapterPct}%` }} />
        </div>
      </div>

      {/* Chapter switcher — always allows preview; per-level lock pips still gate play. */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 scrollbar-none">
        {[1, 2, 3].map(ch => {
          const reached = chapterFor(highestUnlocked) >= ch;
          const isCurrent = chapter === ch;
          return (
            <button
              key={ch}
              onClick={() => setChapter(ch)}
              className={cn(
                'font-rd-display shrink-0 px-3.5 h-9 rounded-xl text-[12px] font-extrabold flex items-center gap-1.5 btn-press border tracking-wide',
                isCurrent
                  ? 'bg-primary/20 text-primary border-primary/50'
                  : 'bg-muted/30 text-foreground/95 border-border/40',
              )}
            >
              {!reached && <Lock className="w-3 h-3 opacity-70" />}
              Ch {ch}
              <span className="text-[9px] text-foreground/65 font-bold">L{(ch - 1) * 50 + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[9px] font-extrabold uppercase tracking-wider text-foreground/75">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary" /> Next</span>
        <span className="flex items-center gap-1"><Check className="w-2.5 h-2.5" style={{ color: 'hsl(var(--success))' }} /> Cleared</span>
        <span className="flex items-center gap-1"><Crown className="w-2.5 h-2.5" style={{ color: 'hsl(var(--gold))' }} /> Milestone</span>
        <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</span>
      </div>

      {isLoading || !levels ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 rd-stagger" key={`ch-${chapter}`}>
          {levels.map(lvl => {
            const isUnlocked = lvl.level_number <= highestUnlocked;
            const isCleared  = lvl.level_number <= highestCompleted;
            const isCurrent  = lvl.level_number === highestUnlocked && !isCleared;
            const tier = difficultyTierFor(lvl.level_number);
            const milestone = isMilestoneLevel(lvl.level_number);
            const opener = isChapterOpener(lvl.level_number);
            const lvlMechanics = (lvl.modifiers?.mechanics as MechanicId[] | undefined)
              ?? mechanicsForLevel(lvl.level_number);
            const newestMechanic = lvlMechanics.length ? getMechanic(lvlMechanics[lvlMechanics.length - 1]) : null;
            const introId = introMechanicForLevel(lvl.level_number);
            const mods = (lvl.modifiers ?? {}) as { secondary_objective?: unknown; boss_rule?: unknown };
            const hasSecondary = !!mods.secondary_objective;
            const hasBossRule = !!mods.boss_rule;
            const layout = getLayoutForLevel(lvl.level_number);
            const tile = (
              <DungeonPathPreview
                key={lvl.level_number}
                levelNumber={lvl.level_number}
                layout={layout}
                tier={tier}
                isUnlocked={isUnlocked}
                isCleared={isCleared}
                isCurrent={isCurrent}
                isMilestone={milestone}
                isOpener={opener}
                mechanicIcon={newestMechanic?.icon}
                mechanicLabel={newestMechanic?.name}
                introducesMechanic={!!introId}
                cornerGlyph={hasBossRule ? '👑' : hasSecondary ? '🎯' : null}
              />
            );
            // R2 — milestone interception. For UNLOCKED milestone
            // levels, wrap the tile in a div whose capture-phase
            // click handler pre-empts the inner Link and opens the
            // path picker instead. Non-milestone & locked tiles
            // render as today (straight Link).
            if (milestone && isUnlocked) {
              return (
                <div
                  key={lvl.level_number}
                  onClickCapture={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPickerLevel(lvl.level_number);
                  }}
                >
                  {tile}
                </div>
              );
            }
            return tile;
          })}
        </div>
      )}

      {progress && progress.highest_unlocked_level > 0 && (
        <button
          onClick={() => navigate(`/rune-delve/play/${progress.highest_unlocked_level}`)}
          className="rd-btn-juice rd-shimmer w-full h-12 rounded-xl font-extrabold text-sm btn-press flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
            color: 'white',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          Jump to Level {progress.highest_unlocked_level} <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* R2 — milestone path picker overlay. Mounted at page level so
          the modal can close when tapping the backdrop without
          interfering with map scroll. */}
      <AnimatePresence>
        {pickerLevel !== null && (
          <PathVariantPicker
            levelNumber={pickerLevel}
            lastPicked={user?.id ? readLastPathChoice(user.id, pickerLevel) : null}
            onClose={() => setPickerLevel(null)}
            onPick={(variant) => {
              if (user?.id) writeLastPathChoice(user.id, pickerLevel, variant.id);
              const url = variant.id === 'standard'
                ? `/rune-delve/play/${pickerLevel}`
                : `/rune-delve/play/${pickerLevel}?pathVariant=${variant.id}`;
              setPickerLevel(null);
              navigate(url);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

import { Link } from "react-router-dom";
import {
  Flame,
  Trophy,
  Lock,
  Sparkles,
  Check,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { useRuneDelveHero, useUpdateHero } from "@/hooks/useRuneDelveHero";
import {
  useAllClassProgress,
  useEnsureClassProgress,
  type ClassProgress,
} from "@/hooks/useRuneDelveClassProgress";
import {
  CLASS_LIST,
  getClass,
  levelFromXp,
  titleForLevel,
  titleLadderFor,
  type HeroClass,
} from "@/lib/runedelve/classConfig";
import { MASTERY_TIERS, nextMasteryFor } from "@/lib/runedelve/classMastery";
import { CharacterPowerPanel } from "@/components/runedelve/CharacterPowerPanel";
import { RuneHeroArt } from "@/components/runedelve/RuneArtwork";
import { RuneMenuSigil } from "@/components/runedelve/RuneMenuSigil";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { useLoadout } from "@/hooks/useLoadout";
import { useRelicCollection } from "@/hooks/useRelicCollection";
import { useMyProgress } from "@/hooks/useRuneDelveCampaign";
import { buildCharacterSheet } from "@/lib/runedelve/characterStats";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import "@/components/runedelve/runeMenus.css";

export default function RuneDelveHeroPage() {
  const heroQuery = useRuneDelveHero();
  const tracksQuery = useAllClassProgress();
  const { data: hero } = heroQuery;
  const { data: tracks } = tracksQuery;
  const { data: loadout } = useLoadout(hero?.class);
  const { data: ownedRelics } = useRelicCollection();
  const { data: campaignProgress } = useMyProgress(hero?.class);
  const updateHero = useUpdateHero();
  const ensureClass = useEnsureClassProgress();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [view, setView] = useState<"build" | "classes" | "prestige">("build");
  const [switching, setSwitching] = useState<HeroClass | null>(null);
  const actionRef = useRef(false);

  if (heroQuery.isError || tracksQuery.isError)
    return (
      <RuneDataState
        error
        onRetry={() => {
          void heroQuery.refetch();
          void tracksQuery.refetch();
        }}
      />
    );
  if (!hero || tracksQuery.isLoading)
    return (
      <RuneDataState
        onRetry={() => {
          void heroQuery.refetch();
          void tracksQuery.refetch();
        }}
      />
    );

  const trackByClass = new Map<HeroClass, ClassProgress>(
    (tracks ?? []).map((t) => [t.class, t]),
  );
  const activeTrack = trackByClass.get(hero.class);
  const activeLevel = activeTrack?.level ?? hero.level;
  const lvl = levelFromXp(activeTrack?.xp ?? hero.xp);
  const xpPct = Math.min(100, Math.round((lvl.intoLevel / lvl.needed) * 100));
  const cls = getClass(hero.class);
  const title =
    activeTrack?.cosmetic_title ?? titleForLevel(activeLevel, hero.class);
  const ladder = titleLadderFor(hero.class);
  const characterSheet = buildCharacterSheet({
    cls: hero.class,
    classLevel: activeLevel,
    campaignLevel:
      activeTrack?.highest_unlocked_level ??
      campaignProgress?.highest_unlocked_level ??
      1,
    slots: [loadout?.slot_1, loadout?.slot_2, loadout?.slot_3],
    rankById: new Map(
      (ownedRelics ?? []).map((r) => [r.relic_id, r.rank ?? 1]),
    ),
  });
  const nextMastery = nextMasteryFor(hero.class, activeLevel);

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 24 || !hero || actionRef.current)
      return;
    actionRef.current = true;
    try {
      await updateHero.mutateAsync({ hero_name: trimmed });
      toast.success("Hero renamed");
      setEditingName(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not rename hero",
      );
    } finally {
      actionRef.current = false;
    }
  }
  async function switchClass(next: HeroClass) {
    if (!hero || next === hero.class || actionRef.current) return;
    actionRef.current = true;
    setSwitching(next);
    try {
      const track = await ensureClass.mutateAsync(next);
      await updateHero.mutateAsync({
        class: next,
        xp: track.xp,
        level: track.level,
        cosmetic_title:
          track.cosmetic_title ?? titleForLevel(track.level, next),
      });
      toast.success(`${getClass(next).name} ready · Level ${track.level}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not switch class",
      );
    } finally {
      actionRef.current = false;
      setSwitching(null);
    }
  }

  return (
    <div
      className="rd-menu-page rd-hero-page space-y-4 pb-5"
      data-class={hero.class}
    >
      <div className="rd-menu-heading">
        <h1 className="rd-title">Hero</h1>
        <Link to="/rune-delve/armory" className="rd-menu-link">
          Tune loadout <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <section className="rd-menu-surface rd-hero-dossier !p-0 overflow-hidden">
        <div className="rd-portrait-stage relative h-44 sm:h-52 overflow-hidden">
          <RuneMenuSigil className="rd-portrait-orbit" />
          <RuneHeroArt
            cls={hero.class}
            className="rd-dossier-portrait absolute inset-y-0 right-0 w-[58%] h-full"
          />
          <div className="rd-portrait-shade absolute inset-0" />
          <div className="absolute left-4 bottom-3 right-4">
            <p className="text-[10px] uppercase tracking-[.18em] text-primary font-extrabold">
              {cls.name} · Level {activeLevel}
            </p>
            <div className="flex items-center gap-1">
              <h2 className="rd-title text-2xl break-words min-w-0">
                {hero.hero_name}
              </h2>
              <button
                type="button"
                className="w-11 h-11 grid place-items-center shrink-0 rounded-full bg-card/40"
                aria-label="Rename hero"
                onClick={() => {
                  setEditingName(true);
                  setName(hero.hero_name);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            {title && <p className="text-xs text-primary font-bold">{title}</p>}
          </div>
        </div>
        <div className="p-4 pt-1">
          {editingName && (
            <form
              className="flex flex-wrap gap-2 mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                void saveName();
              }}
            >
              <label htmlFor="rd-hero-name" className="sr-only">
                Hero name
              </label>
              <input
                id="rd-hero-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={24}
                autoFocus
                className="form-input min-h-11 text-base px-3 w-full"
              />
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="rd-menu-link flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={name.trim().length < 2 || updateHero.isPending}
                className="rd-menu-link flex-1 !bg-primary !text-primary-foreground disabled:opacity-50"
              >
                {updateHero.isPending ? "Saving…" : "Save name"}
              </button>
            </form>
          )}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-muted-foreground">
            <span>
              {lvl.intoLevel}/{lvl.needed} XP
            </span>
            <span>
              {activeLevel >= 150
                ? "Class mastered"
                : `Next · Level ${activeLevel + 1}`}
            </span>
          </div>
          {nextMastery && (
            <p className="rd-menu-note mt-2">
              <Sparkles className="inline w-3 h-3 text-primary mr-1" />
              {nextMastery.name} unlocks at Lv {nextMastery.unlockLevel}
            </p>
          )}
        </div>
      </section>
      <div
        role="tablist"
        aria-label="Hero view"
        className="rd-menu-tabs grid-cols-3"
      >
        {(["build", "classes", "prestige"] as const).map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={view === tab}
            key={tab}
            onClick={() => setView(tab)}
          >
            {tab === "build"
              ? "Build"
              : tab === "classes"
                ? "Classes"
                : "Legacy"}
          </button>
        ))}
      </div>
      {view === "build" && (
        <div className="space-y-4">
          <CharacterPowerPanel sheet={characterSheet} compact />
          <section className="rd-menu-surface space-y-3">
            <h2 className="text-sm font-extrabold">{cls.name} masteries</h2>
            <div className="space-y-2">
              {MASTERY_TIERS[hero.class].map((t) => {
                const unlocked = activeLevel >= t.unlockLevel;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-xl border px-3 py-3 flex items-start gap-3",
                      unlocked
                        ? "bg-primary/5 border-primary/25"
                        : "bg-muted/10 border-border/40",
                    )}
                  >
                    <span
                      className={cn(
                        "h-9 w-9 rounded-lg grid place-items-center shrink-0",
                        unlocked
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {unlocked ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <h3 className="font-extrabold text-xs">{t.name}</h3>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          Lv {t.unlockLevel}
                        </span>
                      </div>
                      <p className="rd-menu-note mt-1">{t.summary}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {view === "classes" && (
        <section className="space-y-3" aria-label="Class selection">
          <p className="rd-menu-note">
            Four playstyles. Each keeps its own level, dungeon progress, and
            loadout.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CLASS_LIST.map((c) => {
              const track = trackByClass.get(c.id);
              const active = c.id === hero.class;
              return (
                <button
                  type="button"
                  key={c.id}
                  disabled={active || !!switching || updateHero.isPending}
                  onClick={() => void switchClass(c.id)}
                  aria-label={`${active ? "Active" : "Switch to"} ${c.name}, level ${track?.level ?? 1}`}
                  data-class={c.id}
                  data-active={active}
                  className={cn(
                    "rd-class-card overflow-hidden rounded-2xl border text-left transition-colors min-w-0 disabled:cursor-default",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-card",
                  )}
                >
                  <div className="rd-class-card-portrait relative h-36 overflow-hidden">
                    <RuneHeroArt
                      cls={c.id}
                      className="absolute inset-0 h-full w-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                    <strong className="absolute bottom-2 left-3 rd-title text-lg">
                      {c.name}
                    </strong>
                  </div>
                  <div className="p-3 pt-1">
                    <p className="text-[10px] font-bold text-muted-foreground">
                      Lv {track?.level ?? 1} · Chamber{" "}
                      {track?.highest_unlocked_level ?? 1}
                    </p>
                    <p className="text-[11px] leading-relaxed mt-2 min-h-10">
                      {c.passive}
                    </p>
                    <span
                      className={cn(
                        "mt-3 min-h-10 rounded-lg flex items-center justify-center gap-1 text-[11px] font-extrabold",
                        active ? "bg-primary/15 text-primary" : "bg-muted",
                      )}
                    >
                      {active ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Active
                        </>
                      ) : switching === c.id ? (
                        "Switching…"
                      ) : (
                        `Play ${c.name}`
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {view === "prestige" && (
        <div className="space-y-4">
          <div className="rd-menu-surface grid grid-cols-3 gap-3 text-center">
            <div>
              <Flame className="h-5 w-5 text-gold mx-auto mb-2" />
              <strong className="block text-xl tabular-nums">
                {hero.current_streak}
              </strong>
              <span className="rd-menu-note">Day streak</span>
            </div>
            <div>
              <Sparkles className="h-5 w-5 text-primary mx-auto mb-2" />
              <strong className="block text-xl tabular-nums">
                {hero.lifetime_runs}
              </strong>
              <span className="rd-menu-note">Runs</span>
            </div>
            <div>
              <Trophy className="h-5 w-5 text-gold mx-auto mb-2" />
              <strong className="block text-xl tabular-nums">
                {hero.lifetime_score.toLocaleString()}
              </strong>
              <span className="rd-menu-note">Score</span>
            </div>
          </div>
          <section className="rd-menu-surface space-y-3">
            <h2 className="text-sm font-extrabold">{cls.name} titles</h2>
            <div className="grid grid-cols-2 gap-2">
              {ladder.map(({ level, title: label }) => (
                <div
                  key={level}
                  className={cn(
                    "rounded-xl border p-3",
                    label === title
                      ? "bg-primary/10 border-primary/40"
                      : "bg-muted/10 border-border/40",
                    activeLevel < level && "text-muted-foreground",
                  )}
                >
                  <div className="flex items-center justify-between text-[9px] font-bold mb-1">
                    <span>LEVEL {level}</span>
                    {activeLevel >= level ? (
                      <Check className="w-3 h-3 text-primary" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                  </div>
                  <p className="text-[11px] font-bold leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </section>
          <Link to="/rune-delve/leaderboard" className="rd-menu-link w-full">
            <Trophy className="h-4 w-4 text-gold" /> Club leaderboard{" "}
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Link>
        </div>
      )}
    </div>
  );
}

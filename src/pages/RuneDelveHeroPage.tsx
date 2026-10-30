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
import { RuneBuildPages } from "@/components/runedelve/RuneBuildPages";
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
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
  const [view, setView] = useState<
    "profile" | "build" | "classes" | "prestige"
  >("profile");
  const [switching, setSwitching] = useState<HeroClass | null>(null);
  const actionRef = useRef(false);
  const viewport = useRuneViewport();
  const [classPage, setClassPage] = useState(0);
  const [legacyPage, setLegacyPage] = useState(0);

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

  const classSize = viewport.short ? 2 : 4;
  const classIndex = Math.min(
    classPage,
    Math.ceil(CLASS_LIST.length / classSize) - 1,
  );
  const legacySize = viewport.landscape ? 2 : viewport.short ? 4 : 8;
  const legacyIndex = Math.min(
    legacyPage,
    Math.max(0, Math.ceil(ladder.length / legacySize) - 1),
  );
  return (
    <div
      className="rd-screen rd-menu-page rd-fit-menu rd-hero-page"
      data-class={hero.class}
    >
      <div className="rd-menu-heading">
        <h1 className="rd-title">Hero</h1>
        <Link to="/rune-delve/armory" className="rd-menu-link">
          Tune loadout <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div
        role="tablist"
        aria-label="Hero view"
        className="rd-menu-tabs rd-fit-tabs grid-cols-4"
      >
        {(["profile", "build", "classes", "prestige"] as const).map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={view === tab}
            key={tab}
            onClick={() => setView(tab)}
          >
            {tab === "profile"
              ? "Profile"
              : tab === "build"
                ? "Build"
                : tab === "classes"
                  ? "Classes"
                  : "Legacy"}
          </button>
        ))}
      </div>
      {view === "profile" && (
        <section
          className="rd-profile-view rd-fit-content"
          aria-label="Hero profile"
        >
          {editingName ? (
            <form
              className="rd-menu-surface rd-rename-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveName();
              }}
            >
              <h2 className="rd-title text-lg">Rename hero</h2>
              <label htmlFor="rd-hero-name" className="sr-only">
                Hero name
              </label>
              <input
                id="rd-hero-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={24}
                autoFocus
                className="form-input min-h-11 text-base px-3 w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="rd-menu-link"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={name.trim().length < 2 || updateHero.isPending}
                  className="rd-menu-link !bg-primary !text-primary-foreground disabled:opacity-50"
                >
                  {updateHero.isPending ? "Saving…" : "Save name"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <section className="rd-menu-surface rd-hero-dossier !p-0">
                <div className="rd-portrait-stage relative">
                  <RuneMenuSigil className="rd-portrait-orbit" />
                  <RuneHeroArt
                    cls={hero.class}
                    className="rd-dossier-portrait absolute inset-y-0 right-0 w-[58%] h-full"
                  />
                  <div className="rd-portrait-shade absolute inset-0" />
                  <div className="absolute left-4 bottom-3 right-4">
                    <p className="text-[10px] uppercase tracking-widest text-primary font-extrabold">
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
                    {title && (
                      <p className="text-xs text-primary font-bold">{title}</p>
                    )}
                  </div>
                </div>
                <div className="rd-profile-progress">
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full bg-primary rounded-full"
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
            </>
          )}
        </section>
      )}
      {view === "build" && (
        <div className="rd-fit-content">
          <RuneBuildPages
            key={hero.class}
            sheet={characterSheet}
            masteries={MASTERY_TIERS[hero.class]}
            level={activeLevel}
          />
        </div>
      )}
      {view === "classes" && (
        <section
          className="rd-page-stack rd-fit-content"
          aria-label="Class selection"
        >
          <div
            className="rd-fit-class-grid"
            data-rows={classSize === 4 ? 2 : 1}
          >
            {CLASS_LIST.slice(
              classIndex * classSize,
              (classIndex + 1) * classSize,
            ).map((c) => {
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
                    "rd-class-card rd-fit-class-card",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-card",
                  )}
                >
                  <div className="rd-class-card-portrait relative">
                    <RuneHeroArt cls={c.id} />
                    <strong className="rd-title">{c.name}</strong>
                  </div>
                  <div className="rd-fit-class-copy">
                    <p className="rd-menu-note">
                      Lv {track?.level ?? 1} · Chamber{" "}
                      {track?.highest_unlocked_level ?? 1}
                    </p>
                    <p>{c.passive}</p>
                    <span
                      className={cn(
                        "rd-fit-class-action",
                        active ? "bg-primary/15 text-primary" : "bg-muted",
                      )}
                    >
                      {active ? (
                        <>
                          <Check size={14} /> Active
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
          <RunePager
            page={classIndex}
            pageCount={Math.ceil(CLASS_LIST.length / classSize)}
            onPageChange={setClassPage}
            label="Classes"
          />
        </section>
      )}
      {view === "prestige" && (
        <section className="rd-page-stack rd-fit-content">
          <div className="rd-legacy-content">
            <div className="rd-menu-surface rd-legacy-stats">
              <div>
                <Flame size={16} />
                <strong>{hero.current_streak}</strong>
                <span>Day streak</span>
              </div>
              <div>
                <Sparkles size={16} />
                <strong>{hero.lifetime_runs}</strong>
                <span>Runs</span>
              </div>
              <div>
                <Trophy size={16} />
                <strong>{hero.lifetime_score.toLocaleString()}</strong>
                <span>Score</span>
              </div>
            </div>
            <div className="rd-legacy-titles">
              {ladder
                .slice(legacyIndex * legacySize, (legacyIndex + 1) * legacySize)
                .map(({ level, title: label }) => (
                  <div
                    key={level}
                    className={cn(
                      "rd-menu-surface",
                      label === title && "border-primary/40",
                    )}
                  >
                    <span className="rd-menu-note flex justify-between">
                      Lv {level}
                      {activeLevel >= level ? (
                        <Check size={12} />
                      ) : (
                        <Lock size={12} />
                      )}
                    </span>
                    <p className="text-[11px] font-bold">{label}</p>
                  </div>
                ))}
            </div>
          </div>
          <div className="rd-legacy-footer">
            <RunePager
              page={legacyIndex}
              pageCount={Math.ceil(ladder.length / legacySize)}
              onPageChange={setLegacyPage}
              label="Titles"
            />
            <Link to="/rune-delve/leaderboard" className="rd-menu-link">
              <Trophy size={14} /> Standings
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Compass,
  Flame,
  Gem,
  HelpCircle,
  Map,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useRuneDelveHero, useEnsureHero } from "@/hooks/useRuneDelveHero";
import { useAllClassProgress } from "@/hooks/useRuneDelveClassProgress";
import { useMyProgress } from "@/hooks/useRuneDelveCampaign";
import { useMyDailyRun, useMyDailyStreak } from "@/hooks/useDailyChallenge";
import {
  CLASS_LIST,
  getClass,
  levelFromXp,
  type HeroClass,
} from "@/lib/runedelve/classConfig";
import { chapterFor, chapterMeta } from "@/lib/runedelve/levelGenerator";
import {
  RuneHeroArt,
  RUNE_PORTAL_ART,
} from "@/components/runedelve/RuneArtwork";
import { HowToPlaySheet } from "@/components/runedelve/HowToPlaySheet";
import { useAmbientMusic } from "@/hooks/useAmbientMusic";
import "@/components/runedelve/runeMenus.css";

const CLASS_STYLE: Record<
  HeroClass,
  { role: string; line: string; icon: typeof Swords }
> = {
  warrior: {
    role: "Frontline",
    line: "Cleave the horde. Reflect damage with guard.",
    icon: Swords,
  },
  mage: {
    role: "Spellcaster",
    line: "Charge quickly. Unleash devastating bursts.",
    icon: WandSparkles,
  },
  rogue: {
    role: "Assassin",
    line: "Build long chains. Double your next strike.",
    icon: Compass,
  },
  cleric: {
    role: "Battle healer",
    line: "Mend wounds. Raise shields. Smite your foes.",
    icon: Shield,
  },
};

export default function RuneDelveHomePage() {
  const heroQuery = useRuneDelveHero();
  const hero = heroQuery.data;
  const progressQuery = useMyProgress(hero?.class);
  const { data: tracks } = useAllClassProgress();
  const { data: daily } = useMyDailyRun();
  const { data: streak } = useMyDailyStreak();
  const ensureHero = useEnsureHero();
  const [picking, setPicking] = useState<HeroClass>("warrior");
  const [name, setName] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const guideKey = hero ? `rd-guide-v1:${hero.user_id}` : null;
  useEffect(() => {
    if (!guideKey) return;
    try {
      if (localStorage.getItem(guideKey) !== "1") setHelpOpen(true);
    } catch {
      setHelpOpen(true);
    }
  }, [guideKey]);
  const changeHelp = (open: boolean) => {
    setHelpOpen(open);
    if (!open && guideKey) {
      try {
        localStorage.setItem(guideKey, "1");
      } catch {
        /* guide remains optional */
      }
    }
  };
  useAmbientMusic({
    enabled: true,
    volume: 0.05,
    fadeInSec: 3.5,
    fadeOutSec: 1.2,
  });

  if (heroQuery.isError || (hero && progressQuery.isError)) {
    return (
      <div className="rd-load-error" role="alert">
        <Sparkles className="h-8 w-8 text-primary" />
        <p>The sanctum couldn’t connect.</p>
        <button
          onClick={() => {
            void heroQuery.refetch();
            void progressQuery.refetch();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  if (heroQuery.isLoading || (hero && !progressQuery.data)) {
    return (
      <div className="rd-load-error" aria-busy="true">
        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        <p>Opening the sanctum…</p>
        <button
          onClick={() => {
            void heroQuery.refetch();
            void progressQuery.refetch();
          }}
        >
          Reconnect
        </button>
      </div>
    );
  }

  if (!hero) {
    const style = CLASS_STYLE[picking];
    const Icon = style.icon;
    return (
      <section
        className="rd-screen rd-forge"
        data-class={picking}
        data-testid="rune-forge"
      >
        <div className="rd-forge-heading">
          <p className="rd-eyebrow">
            <Sparkles size={13} /> Rune Delve
          </p>
          <h1>Choose your legend.</h1>
          <p>Four classes. One world beneath the runes.</p>
        </div>
        <div
          className="rd-class-grid"
          role="group"
          aria-label="Choose your class"
        >
          {CLASS_LIST.map((c) => (
            <button
              type="button"
              key={c.id}
              aria-label={`Choose ${c.name}`}
              aria-pressed={picking === c.id}
              onClick={() => setPicking(c.id)}
              className="rd-class-choice btn-press"
              data-class={c.id}
            >
              <RuneHeroArt cls={c.id} />
              <strong>{c.name}</strong>
            </button>
          ))}
        </div>
        <div className="rd-class-info rd-menu-content-enter" key={picking}>
          <Icon />
          <div>
            <strong>
              {getClass(picking).name} · {style.role}
            </strong>
            <small>{style.line}</small>
          </div>
        </div>
        <label className="rd-name-field">
          Hero name
          <input
            aria-label="Hero name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoComplete="nickname"
            placeholder="Your legend begins here"
          />
        </label>
        <div className="rd-forge-actions">
          <button
            type="button"
            className="rd-primary-action btn-press"
            disabled={name.trim().length < 2 || ensureHero.isPending}
            onClick={async () => {
              try {
                await ensureHero.mutateAsync({
                  cls: picking,
                  hero_name: name.trim(),
                });
              } catch {
                toast.error("Your hero couldn’t be saved. Try again.");
              }
            }}
          >
            <Sparkles />
            {ensureHero.isPending ? "Summoning…" : "Enter the sanctum"}
            <ChevronRight />
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="rd-hub-foot min-h-11"
          >
            <HelpCircle />
            Learn the runes
          </button>
        </div>
        <HowToPlaySheet
          open={helpOpen}
          onOpenChange={changeHelp}
          heroClass={picking}
        />
      </section>
    );
  }

  const progress = progressQuery.data!;
  const track = tracks?.find((t) => t.class === hero.class);
  const classLevel = track?.level ?? hero.level;
  const xp = levelFromXp(track?.xp ?? hero.xp, classLevel);
  const nextLevel = progress.highest_unlocked_level;
  const chapter = chapterFor(nextLevel);
  const meta = chapterMeta(chapter);
  const xpPct = Math.max(0, Math.min(100, (xp.intoLevel / xp.needed) * 100));

  return (
    <section
      className="rd-screen rd-hub"
      data-class={hero.class}
      data-testid="rune-home"
    >
      <div className="rd-sanctum">
        <img src={RUNE_PORTAL_ART} alt="" width="1440" height="960" />
        <div className="rd-sanctum-copy">
          <p className="rd-eyebrow">
            <Sparkles size={13} /> Rune Delve · Expeditions
          </p>
          <h1>
            The depths
            <br />
            are calling.
          </h1>
          <p>Choose your path. Forge a different build every run.</p>
          <Link
            className="rd-primary-action rd-btn-juice"
            to="/rune-delve/expedition"
          >
            <Compass />
            Enter Expedition
            <ChevronRight />
          </Link>
        </div>
      </div>

      <Link
        to="/rune-delve/hero"
        className="rd-hub-hero btn-press"
        aria-label={`Your hero ${hero.hero_name}, ${getClass(hero.class).name} level ${classLevel}`}
      >
        <span className="rd-hub-portrait">
          <RuneHeroArt cls={hero.class} />
        </span>
        <span className="rd-hub-hero-copy">
          <strong>{hero.hero_name}</strong>
          <small>
            {getClass(hero.class).name} · Lv {classLevel} ·{" "}
            {track?.cosmetic_title ??
              hero.cosmetic_title ??
              "A legend in the making"}
          </small>
          <span
            className="rd-hub-xp"
            role="progressbar"
            aria-label="Class experience"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(xpPct)}
          >
            <i style={{ width: `${xpPct}%` }} />
          </span>
        </span>
        <ChevronRight />
      </Link>

      <div className="rd-mode-tiles">
        <Link
          to={`/rune-delve/play/${nextLevel}`}
          className="rd-mode-tile rd-btn-juice"
          data-mode="campaign"
          aria-label="Continue campaign"
        >
          <Map />
          <span className="rd-eyebrow">Campaign · Chamber {nextLevel}</span>
          <strong>{meta.name}</strong>
          <small>{progress.highest_completed_level} cleared · Continue →</small>
        </Link>
        <Link
          to="/rune-delve/daily"
          className="rd-mode-tile rd-btn-juice"
          data-mode="daily"
        >
          <Flame />
          <span className="rd-eyebrow">Daily arena · 2 minutes</span>
          <strong>
            {daily ? `${daily.kills_count} slain` : "Beat the clock"}
          </strong>
          <small>
            {daily ? "Today’s run complete" : "Fresh challenge every day"}
          </small>
        </Link>
      </div>

      <div className="rd-hub-tools">
        <Link to="/rune-delve/quests">
          <ScrollText />
          Quests
        </Link>
        <Link to="/rune-delve/leaderboard">
          <Trophy />
          Standings
        </Link>
        <Link to="/rune-delve/bestiary">
          <BookOpen />
          Bestiary
        </Link>
      </div>
      <div className="rd-hub-foot">
        <Gem />
        Relics power your campaign · <Flame />
        {streak?.current_streak ?? 0}-day streak
      </div>
      <HowToPlaySheet
        open={helpOpen}
        onOpenChange={changeHelp}
        heroClass={hero.class}
      />
    </section>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MECHANIC_LIST } from "@/lib/runedelve/mechanics";
import { MASTERY_TIERS, nextMasteryFor } from "@/lib/runedelve/classMastery";
import { useTodayDaily, useMyDailyStreak } from "@/hooks/useDailyChallenge";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { useAllClassProgress } from "@/hooks/useRuneDelveClassProgress";
import { useMyProgress } from "@/hooks/useRuneDelveCampaign";
import { getClass, type HeroClass } from "@/lib/runedelve/classConfig";
import { RELIC_CATALOG } from "@/lib/runedelve/relics";
import { useSheetSfx } from "@/hooks/useSheetSfx";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import { RunePager } from "./RunePager";
import { endlessRewardFor, endlessStarsFor } from "@/lib/runedelve/endlessMode";
import "./runeDialogs.css";

type CodexTab = "mechanics" | "daily" | "masteries" | "relics";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: CodexTab;
}
export function CodexSheet({
  open,
  onOpenChange,
  defaultTab = "mechanics",
}: Props) {
  useSheetSfx(open);
  const focus = useRuneDialogFocus();
  const [tab, setTab] = useState<CodexTab>(defaultTab);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      setPage(0);
    }
  }, [open, defaultTab]);
  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress(hero?.class);
  const { data: tracks } = useAllClassProgress();
  const today = useTodayDaily();
  const { data: streak } = useMyDailyStreak();
  const heroClass: HeroClass = hero?.class ?? "warrior";
  const classLevel =
    (tracks ?? []).find((track) => track.class === heroClass)?.level ?? 1;
  const next = nextMasteryFor(heroClass, classLevel);
  const guide: ReactNode[] = [
    <article className="rd-dialog-card" key="chains">
      <h3>Connect 3+ matching runes</h3>
      <p>
        Drag or tap neighbors, including diagonals. In tap mode, press Cast to
        commit. Clear cancels your path.
      </p>
      <p>⚔ Attack · ✦ Mana · ❀ Heal · ◈ Guard</p>
      <p>
        Use all four colors to release Convergence: an area strike, mana and
        guard.
      </p>
    </article>,
    <article className="rd-dialog-card" key="expeditions">
      <h3>Expeditions</h3>
      <p>
        Six seeded chambers. Draft blessings, choose a route, carry health
        forward, and bank a result for shards. Clear a run to unlock the next
        Ascension.
      </p>
      <Link
        className="rd-dialog-link"
        to="/rune-delve/expedition"
        onClick={() => onOpenChange(false)}
      >
        Explore Expeditions →
      </Link>
    </article>,
    ...MECHANIC_LIST.map((mechanic) => (
      <article className="rd-dialog-card" key={mechanic.id}>
        <p className="rd-dialog-eyebrow">
          {mechanic.family} ·{" "}
          {(progress?.highest_unlocked_level ?? 1) >= mechanic.introLevel
            ? "Discovered"
            : `Unlocks at level ${mechanic.introLevel}`}
        </p>
        <h3>
          {mechanic.icon} {mechanic.name}
        </h3>
        <p>{mechanic.oneLiner}</p>
        <p>{mechanic.tip}</p>
      </article>
    )),
  ];
  const daily: ReactNode[] = [
    <article className="rd-dialog-card" key="today">
      <p className="rd-dialog-eyebrow">Today · {today.dateStr}</p>
      <h3>Endless Survival</h3>
      <p>
        {today.timeLimitSec / 60} minutes. Defeat as many foes as you can. The
        run ends at zero time or zero health.
      </p>
      <p>Foes ramp at 0:20, 0:40, 1:00 and 1:30.</p>
    </article>,
    <article className="rd-dialog-card" key="rules">
      <h3>A fair daily challenge</h3>
      <p>
        Base class powers only; campaign equipment and masteries do not apply.
      </p>
      <p>
        Pausing, inspecting foes and backgrounding stop the clock. Your first
        result earns the day’s reward; retries cannot pay twice.
      </p>
    </article>,
    <article className="rd-dialog-card" key="streak">
      <h3>Your daily streak</h3>
      <div className="rd-dialog-stats">
        <div>
          <strong>{streak?.current_streak ?? 0}</strong>
          <span>Current</span>
        </div>
        <div>
          <strong>{streak?.best_streak ?? 0}</strong>
          <span>Best</span>
        </div>
        <div>
          <strong>{streak?.lifetime_clears ?? 0}</strong>
          <span>Lifetime</span>
        </div>
      </div>
    </article>,
    ...[0, 5, 10, 15, 20, 30, 50].map((kills) => (
      <article className="rd-dialog-card" key={kills}>
        <p className="rd-dialog-eyebrow">Reward ladder</p>
        <h3>{kills}+ foes slain</h3>
        <p>
          {endlessRewardFor(kills).shards} shards · {endlessStarsFor(kills)}{" "}
          stars {"★".repeat(endlessStarsFor(kills))}
        </p>
      </article>
    )),
  ];
  const masteries: ReactNode[] = [
    <article className="rd-dialog-card" key="class">
      <h3>
        {getClass(heroClass).emoji} {getClass(heroClass).name} · Level{" "}
        {classLevel}
      </h3>
      <p>Masteries unlock by leveling this class.</p>
      <p>
        {next
          ? `Next: ${next.name} at class level ${next.unlockLevel}.`
          : "All five masteries are unlocked."}
      </p>
    </article>,
    ...MASTERY_TIERS[heroClass].map((tier) => (
      <article className="rd-dialog-card" key={tier.id}>
        <p className="rd-dialog-eyebrow">
          {classLevel >= tier.unlockLevel ? "Unlocked" : "Locked"} · Class level{" "}
          {tier.unlockLevel}
        </p>
        <h3>
          T{tier.tier} · {tier.name}
        </h3>
        <p>{tier.summary}</p>
      </article>
    )),
  ];
  const relics = RELIC_CATALOG.map((relic) => (
    <article className="rd-dialog-card" key={relic.id}>
      <p className="rd-dialog-eyebrow">
        Tier {relic.tier} · {relic.category}
      </p>
      <h3>
        {relic.icon} {relic.name}
      </h3>
      <p>{relic.description}</p>
      <p>Unlock: {relic.cost} shards. Upgrade owned relics in the Armory.</p>
    </article>
  ));
  const pages = { mechanics: guide, daily, masteries, relics }[tab];
  const index = Math.min(page, pages.length - 1);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...focus}
        side="bottom"
        className="rd-dialog-theme rd-paged-dialog"
      >
        <SheetHeader className="rd-dialog-header">
          <SheetTitle className="rd-title">📖 Codex</SheetTitle>
          <SheetDescription>
            Runes, runs and rewards, one page at a time.
          </SheetDescription>
        </SheetHeader>
        <Tabs
          className="rd-dialog-tab-root"
          value={tab}
          onValueChange={(value) => {
            setTab(value as CodexTab);
            setPage(0);
          }}
        >
          <TabsList className="rd-dialog-tabs">
            {(
              [
                ["mechanics", "Guide"],
                ["daily", "Daily"],
                ["masteries", "Masteries"],
                ["relics", "Relics"],
              ] as const
            ).map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent
            value={tab}
            className="rd-dialog-body"
            aria-label={`${tab} page ${index + 1}`}
            aria-live="polite"
          >
            {pages[index]}
          </TabsContent>
        </Tabs>
        <RunePager
          page={index}
          pageCount={pages.length}
          onPageChange={setPage}
          label={`Codex ${tab}`}
        />
      </SheetContent>
    </Sheet>
  );
}

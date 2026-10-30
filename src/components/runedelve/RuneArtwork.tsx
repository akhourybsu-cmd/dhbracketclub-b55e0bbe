import { useId } from "react";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import { cn } from "@/lib/utils";
import "./runeWorld.css";

export const RUNE_PORTAL_ART = "/images/rune-delve/sanctum.webp";

const HERO_OFFSET: Record<HeroClass, string> = {
  warrior: "0%",
  mage: "33.3333%",
  rogue: "66.6667%",
  cleric: "100%",
};

/** Four illustrated portraits share one optimized atlas; no remote image dependency. */
export function RuneHeroArt({
  cls,
  className,
}: {
  cls: HeroClass;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("rd-hero-art", className)}
      style={{ backgroundPosition: `${HERO_OFFSET[cls]} 0%` }}
    />
  );
}

function creatureFor(id: string) {
  if (/bat|moth|wing/.test(id)) return "wing";
  if (/spider|crab|scarab|crawler/.test(id)) return "spider";
  if (/slime|ooze|toad/.test(id)) return "slime";
  if (/wolf|hound|pup|rat|lizard|beast|serpent|wyrm/.test(id)) return "beast";
  if (/wisp|wraith|ghost|shade|spirit|specter|revenant/.test(id))
    return "spirit";
  if (/skeleton|lich|bone|skull/.test(id)) return "undead";
  if (/golem|sentinel|warden|guardian|titan|colossus/.test(id))
    return "sentinel";
  return "fiend";
}

/** Original vector creature portraits: clear silhouettes remain legible at combat scale. */
export function RuneEnemyArt({
  archetypeId,
  name,
  className,
}: {
  archetypeId?: string;
  name?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const creature = creatureFor((archetypeId ?? name ?? "").toLowerCase());
  const hue =
    creature === "undead"
      ? 42
      : creature === "beast"
        ? 25
        : creature === "fiend"
          ? 12
          : creature === "spirit"
            ? 265
            : 175;
  return (
    <svg
      className={cn("rd-enemy-art", className)}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor={`hsl(${hue} 65% 52%)`} stopOpacity=".35" />
          <stop offset="1" stopColor={`hsl(${hue} 65% 20%)`} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor={`hsl(${hue} 30% 61%)`} />
          <stop offset=".45" stopColor={`hsl(${hue} 25% 33%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 30% 12%)`} />
        </linearGradient>
        <linearGradient id={`${id}-plate`} x2="1" y2="1">
          <stop stopColor="hsl(185 20% 53%)" />
          <stop offset=".5" stopColor="hsl(190 20% 23%)" />
          <stop offset="1" stopColor="hsl(195 25% 10%)" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill={`url(#${id}-halo)`} />
      <ellipse cx="60" cy="106" rx="35" ry="5" fill="hsl(195 40% 2% / .5)" />
      <g
        fill={`url(#${id}-body)`}
        stroke={`hsl(${hue} 35% 64% / .5)`}
        strokeWidth="1.2"
        strokeLinejoin="round"
      >
        {creature === "wing" && (
          <>
            <path d="M52 50 19 28 7 72 26 64 36 84 54 65M68 50 101 28 113 72 94 64 84 84 66 65" />
            <path d="m48 46 1-22 12 13 12-13-1 24 6 23-16 22-20-22Z" />
            <path d="m20 31 20 25-14 8m74-33L80 56l14 8" fill="none" />
          </>
        )}
        {creature === "spider" && (
          <>
            <path
              d="M45 52 25 35 12 47M41 61 19 58 5 77M43 71 22 80 16 99M75 52l20-17 13 12M79 61l22-3 14 19M77 71l21 9 6 19"
              fill="none"
              strokeWidth="5"
            />
            <path d="m60 26 22 21-5 32-17 15-17-15-5-32Z" />
            <path d="m51 38 9-9 9 9-9 12Z" fill="hsl(175 90% 75%)" />
          </>
        )}
        {creature === "slime" && (
          <>
            <path d="M21 88c-4-20 12-28 17-44C45 22 77 19 87 41c7 15 5 26 15 38 13 20-6 28-23 25-12-3-24-3-36 1-20 5-32-4-22-17Z" />
            <path
              d="M37 61c1-17 9-22 18-24"
              fill="none"
              stroke="hsl(165 80% 85% / .7)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path d="m43 23 7-14 10 12 14-12 4 16" fill="hsl(42 65% 50%)" />
          </>
        )}
        {creature === "beast" && (
          <>
            <path d="m29 49-4-30 25 15 20-4 27-17-7 37-1 28-30 25-30-27Z" />
            <path
              d="m35 53 16 5-8 13-9-6m51-12-16 5 8 13 9-6"
              fill="hsl(195 30% 12%)"
            />
            <path
              d="m47 73 13-8 13 8-3 15-10 10-10-10Z"
              fill="hsl(190 25% 18%)"
            />
            <path
              d="m53 83 7 5 8-5m-15 0 2 11m12-11-2 11"
              fill="none"
              stroke="hsl(40 40% 87%)"
              strokeWidth="2"
            />
          </>
        )}
        {creature === "spirit" && (
          <>
            <path d="M29 102c10-17-3-29 4-55C42 12 83 15 88 45c5 25-6 35 9 57l-23-9-15 16-13-16Z" />
            <path
              d="M43 55c-4-28 33-31 34-2l-9 26H52Z"
              fill="hsl(245 45% 12%)"
              stroke="none"
            />
            <path
              d="m32 70-15 15 11 4m62-19 15 15-11 4"
              fill="none"
              strokeWidth="4"
            />
          </>
        )}
        {creature === "undead" && (
          <>
            <path
              d="m23 105 4-22 19-12h28l19 12 4 22Z"
              fill={`url(#${id}-plate)`}
            />
            <path d="M38 31c5-22 43-21 47 1l-2 26-12 9-2 13H52l-3-13-12-9Z" />
            <path
              d="m44 40 12 3-2 12-11-3m24-9 12-3 1 12-11 3m-11 7 4-7 4 7"
              fill="hsl(195 40% 8%)"
              stroke="none"
            />
            <path
              d="M52 70h17M57 67v10m7-10v10"
              fill="none"
              stroke="hsl(195 40% 8%)"
            />
          </>
        )}
        {creature === "sentinel" && (
          <>
            <path
              d="m18 90 4-35 18-4 4-27 16-11 17 11 4 27 18 4 4 35-20 10-23 9-23-9Z"
              fill={`url(#${id}-plate)`}
            />
            <path d="m45 28 15 12 15-12-3 35-12 12-12-12Z" />
            <path
              d="m49 49 11 5 11-5m-11 8v10M33 68l11 11-6 18m49-29L76 79l6 18"
              fill="none"
              stroke="hsl(175 80% 67%)"
              strokeWidth="2.5"
            />
            <path d="m60 79 8 9-8 11-8-11Z" fill="hsl(175 90% 67%)" />
          </>
        )}
        {creature === "fiend" && (
          <>
            <path d="m33 50-9-33 25 16 12-6 12 6 25-16-9 33-5 29-23 21-23-21Z" />
            <path
              d="m40 50 15 7-7 12m34-19-15 7 7 12"
              fill="hsl(195 30% 10%)"
            />
            <path d="m47 79 14 8 14-8-8 17H55Z" fill="hsl(195 30% 10%)" />
            <path d="m49 79 3 10 4-5m17-5-3 10-4-5" fill="hsl(40 60% 87%)" />
          </>
        )}
      </g>
      {creature !== "sentinel" && (
        <g fill={`hsl(${hue} 95% 82%)`}>
          <ellipse
            cx={creature === "slime" ? 51 : 49}
            cy={creature === "spirit" ? 54 : creature === "slime" ? 72 : 58}
            rx="3.5"
            ry="2.5"
          />
          <ellipse
            cx={creature === "slime" ? 74 : 73}
            cy={creature === "spirit" ? 54 : creature === "slime" ? 72 : 58}
            rx="3.5"
            ry="2.5"
          />
        </g>
      )}
    </svg>
  );
}

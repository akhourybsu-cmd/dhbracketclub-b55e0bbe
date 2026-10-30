import { useId } from "react";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import { cn } from "@/lib/utils";
import "./runeWorld.css";
import "./runeCreatureArt.css";
import {
  resolveMonsterPortrait,
  monsterPortraitPosition,
} from "@/lib/runedelve/monsterPortraits";

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
  if (/moth/.test(id)) return "moth";
  if (/crab/.test(id)) return "crab";
  if (/toad/.test(id)) return "toad";
  if (/rat/.test(id)) return "rat";
  if (/lizard/.test(id)) return "lizard";
  if (/serpent|wyrm/.test(id)) return "serpent";
  if (/drake|dragon/.test(id)) return "dragon";
  if (/bat|wing/.test(id)) return "wing";
  if (/spider|scarab|crawler|cave_stalker/.test(id)) return "spider";
  if (/slime|ooze/.test(id)) return "slime";
  if (/wolf|hound|pup|beast/.test(id)) return "beast";
  if (/wisp|wraith|ghost|shade|spirit|specter|revenant|shrieker/.test(id))
    return "spirit";
  if (/skeleton|lich|bone|skull|crypt_sentinel/.test(id)) return "undead";
  if (/golem|sentinel|warden|guardian|titan|colossus|construct/.test(id))
    return "sentinel";
  if (
    /imp|goblin|kobold|cult|witch|knight|assassin|caster|acolyte|stalker|seer|void|raider|sovereign/.test(
      id,
    )
  )
    return "fiend";
  return "unknown";
}

/** Every named species resolves to its own local portrait; promotions retain
 * the species, with dedicated legendary artwork where available. */
export function RuneEnemyArt({
  archetypeId,
  name,
  tier,
  enemyId,
  decorative = true,
  className,
}: {
  archetypeId?: string;
  name?: string;
  tier?: "mini" | "boss";
  enemyId?: string;
  decorative?: boolean;
  className?: string;
}) {
  const { portrait, promotion, echo } = resolveMonsterPortrait({
    archetypeId,
    name,
    tier,
    enemyId,
  });
  return (
    <span
      className={cn(
        "rd-enemy-art rd-creature-art rd-monster-portrait",
        className,
      )}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-label={
        decorative
          ? undefined
          : `${name ?? portrait?.name ?? "Unknown creature"} portrait`
      }
      data-monster-portrait={portrait?.id ?? "unknown"}
      data-promotion={promotion ?? undefined}
      data-echo={echo || undefined}
    >
      <RuneEnemyVector
        archetypeId={portrait?.id ?? "unknown"}
        name={name}
        className="rd-enemy-vector"
      />
      {portrait && (
        <span
          aria-hidden="true"
          className="rd-creature-illustration"
          style={{
            backgroundImage: `url("${portrait.atlas}")`,
            backgroundPosition: monsterPortraitPosition(portrait.cell),
            backgroundSize: "400% 400%",
          }}
        />
      )}
      {promotion && (
        <span className="rd-monster-regalia" aria-hidden="true">
          {promotion === "boss" ? "♛" : "✦"}
        </span>
      )}
    </span>
  );
}

/** Original vector creature portraits remain available as a lightweight fallback. */
function RuneEnemyVector({
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
        {creature === "moth" && (
          <>
            <path d="M55 52C28 9 4 26 16 60c-7 37 24 40 41 13M65 52c27-43 51-26 39 8 7 37-24 40-41 13" />
            <path d="m53 52 7-17 7 17-2 38H55Z" />
            <path
              d="m57 40-9-14m15 14 9-14M26 44l18 13-17 13m67-26L76 57l17 13"
              fill="none"
              strokeWidth="3"
            />
          </>
        )}
        {creature === "crab" && (
          <>
            <path d="m28 63 10-18h44l10 18-8 23H36Z" />
            <path
              d="m36 73-22 8-7 18m34-18L24 96m60-23 22 8 7 18m-34-18 17 15M35 54 18 42m67 12 17-12"
              fill="none"
              strokeWidth="5"
            />
            <path d="M23 45 7 36l3-18 9 12 10-10 3 18Zm74 0 16-9-3-18-9 12-10-10-3 18Z" />
            <path d="m47 48-3-16m29 16 3-16" fill="none" strokeWidth="5" />
          </>
        )}
        {creature === "toad" && (
          <>
            <path d="M24 89c-9-13-5-35 8-41-4-25 26-29 28-10 4-19 33-15 28 9 17 8 20 28 8 43Z" />
            <path
              d="m31 73-20 19 24 7m54-26 20 19-24 7M38 75q22 17 44 0"
              fill="none"
              strokeWidth="5"
            />
            <circle cx="40" cy="40" r="5" fill="hsl(45 85% 65%)" />
            <circle cx="80" cy="40" r="5" fill="hsl(45 85% 65%)" />
          </>
        )}
        {creature === "rat" && (
          <>
            <path d="M80 90c39 4 31-29 17-21" fill="none" strokeWidth="4" />
            <path d="M27 86c-5-19 3-34 19-37 15-19 36-5 38 17l9 20-13 14H41Z" />
            <circle cx="42" cy="43" r="12" />
            <circle cx="68" cy="43" r="12" />
            <path
              d="m45 75 14 13 14-13M31 77l-19-6m20 14-20 4m62-12 20-6m-20 14 20 4"
              fill="none"
              strokeWidth="2"
            />
          </>
        )}
        {creature === "lizard" && (
          <>
            <path d="M76 80c34 11 43-5 32-19-1 16-20 9-24 2L66 41 48 27 28 38l7 22 17 17Z" />
            <path
              d="m45 59-23 4-10 14m43 1-13 19-17 1m42-40 22-12 12 3m-24 25 7 19 13 3"
              fill="none"
              strokeWidth="6"
            />
            <path d="m32 38 11 4m2-9 9 12" fill="none" strokeWidth="2" />
          </>
        )}
        {creature === "serpent" && (
          <>
            <path d="M38 86c-30 24 63 28 62 0-2-14-41-10-44-22-3-15 22-16 21-34L62 17 45 30c-3 17-23 24-17 43 5 19 44 8 47 16-2 8-27 5-37-3Z" />
            <path
              d="m51 31 10 5 10-5m-9 6 1 13 8 4"
              fill="none"
              strokeWidth="2"
            />
          </>
        )}
        {creature === "dragon" && (
          <>
            <path d="m46 52-27-26L4 74l26-11 14 20m30-31 27-26 15 48-26-11-14 20" />
            <path d="m40 44-9-23 23 12 18-12 9 29-5 31-18 22-23-22Z" />
            <path
              d="m43 55 14 5-6 11m24-16-11 5 5 11m-20 13 12 6 12-6"
              fill="none"
              strokeWidth="3"
            />
          </>
        )}
        {creature === "unknown" && (
          <>
            <path d="m60 18 38 42-38 43-38-43Z" fill={`url(#${id}-plate)`} />
            <path
              d="M49 47c1-17 27-17 25 0-1 8-14 10-14 21m0 10v4"
              fill="none"
              stroke="hsl(175 75% 75%)"
              strokeWidth="5"
              strokeLinecap="round"
            />
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
      {[
        "wing",
        "spider",
        "slime",
        "beast",
        "spirit",
        "undead",
        "fiend",
      ].includes(creature) && (
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

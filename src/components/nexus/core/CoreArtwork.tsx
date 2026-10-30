import { useId } from "react";
import type { CoreLoadout } from "@/lib/nexus/core/types";

export function CoreSigil({
  loadout,
  className = "",
}: {
  loadout?: CoreLoadout;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={`nc-sigil ${className}`}
      viewBox="-160 -160 320 320"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id}>
          <stop stopColor="hsl(173 100% 70%)" stopOpacity=".22" />
          <stop offset="1" stopColor="hsl(173 100% 70%)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}metal`} x2="1" y2="1">
          <stop stopColor="hsl(181 80% 78%)" />
          <stop offset=".45" stopColor="hsl(174 65% 33%)" />
          <stop offset="1" stopColor="hsl(199 72% 18%)" />
        </linearGradient>
      </defs>
      <circle r="155" fill={`url(#${id})`} />
      <g className="nc-sigil-outer" fill="none" stroke="currentColor">
        <circle r="137" strokeOpacity=".13" strokeDasharray="2 10" />
        <circle r="115" strokeOpacity=".24" strokeDasharray="30 10 2 12" />
        <path d="M-125 0h20M105 0h20M0-125v20M0 105v20" strokeOpacity=".6" />
      </g>
      <g className="nc-sigil-inner" fill="none" stroke="currentColor">
        <circle r="93" strokeOpacity=".1" />
        <path
          d="M-80-44A91 91 0 0 1 80-44M80 44A91 91 0 0 1-80 44"
          strokeWidth="2"
          strokeOpacity=".5"
        />
      </g>
      <g className="nc-sigil-core">
        <path
          d="M0-66 57-33v66L0 66-57 33v-66Z"
          fill="hsl(192 58% 11%)"
          stroke="currentColor"
          strokeOpacity=".4"
        />
        <path
          d="M0-53 46-26v52L0 53-46 26v-52Z"
          fill={`url(#${id}metal)`}
          stroke="hsl(173 100% 85%)"
          strokeWidth="2"
        />
        <path
          d="M0-35 30-17v34L0 35-30 17v-34Z"
          fill="hsl(194 70% 9%)"
          stroke="currentColor"
        />
        <path d="M0-18 16-9V9L0 18-16 9V-9Z" fill="hsl(173 100% 80%)" />
        <circle r="6" fill="white" />
        <path
          d="M42-8h33v16H42M73-4h12v8H73"
          fill="hsl(187 55% 16%)"
          stroke="hsl(173 100% 80%)"
          strokeWidth="2"
        />
      </g>
      {loadout?.weapons.map((weapon, i) => (
        <g key={weapon} transform={`rotate(${i * 180 + 135})`}>
          <path
            d="M80-7h16v14H80"
            fill="hsl(194 55% 14%)"
            stroke="currentColor"
          />
          <circle cx="89" r="3" fill="currentColor" />
        </g>
      ))}
      <g className="nc-sigil-sparks" fill="currentColor">
        <circle cx="-116" cy="-32" r="3" />
        <circle cx="93" cy="66" r="2" />
        <circle cx="-56" cy="105" r="2" />
      </g>
    </svg>
  );
}

export function CoreEquipmentArt({ id }: { id: string }) {
  return (
    <svg
      className="nc-equipment-art"
      data-equipment={id}
      viewBox="0 0 120 88"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="60"
        cy="44"
        r="34"
        stroke="currentColor"
        strokeOpacity=".13"
      />
      <path
        d="M12 44h9m78 0h9M60 3v9m0 64v9"
        stroke="currentColor"
        strokeOpacity=".3"
      />
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {id === "pulse" && (
          <>
            <path
              d="m33 35 24-13 24 13v24L57 72 33 59Z"
              fill="currentColor"
              fillOpacity=".1"
            />
            <path d="M54 37h40v14H54M87 32v24M46 44h25M56 59v8" />
            <circle cx="43" cy="44" r="5" />
          </>
        )}
        {id === "arc" && (
          <>
            <path d="M34 59V31l13-7m39 35V31l-13-7M25 59h18m34 0h18M31 38h9m40 0h9" />
            <path
              d="m65 15-16 25h14L53 68l23-31H61Z"
              fill="currentColor"
              fillOpacity=".22"
            />
          </>
        )}
        {id === "rail" && (
          <>
            <path d="m27 55 12-13 14 14-12 13ZM41 40 78 13l13 13-35 33ZM51 35l14 15M73 20l13 13M35 61l-9 9M88 11l10-5m-3 14 12-1" />
            <path d="M56 39 84 19" strokeWidth="4" />
          </>
        )}
        {id === "orbit" && (
          <>
            <ellipse
              cx="60"
              cy="44"
              rx="38"
              ry="19"
              transform="rotate(-25 60 44)"
              strokeOpacity=".5"
            />
            <path
              d="m34 26 13 1-6 24-8-9-16 5ZM88 44l10 9-21 14 1-13-15-8Z"
              fill="currentColor"
              fillOpacity=".25"
            />
            <circle cx="60" cy="44" r="9" />
            <circle cx="60" cy="44" r="3" fill="currentColor" />
          </>
        )}
        {id === "mortar" && (
          <>
            <path
              d="M28 65h64l-8-12H36ZM45 53 56 22l19 7-9 24M52 35l19 7M55 22l4-8 19 7-3 8M39 65v7m41-7v7"
              fill="currentColor"
              fillOpacity=".1"
            />
            <path d="M83 16q16 1 17 18" strokeDasharray="3 5" />
            <circle cx="99" cy="40" r="3" fill="currentColor" />
          </>
        )}
        {id === "laser" && (
          <>
            <path
              d="M24 38h26v16H24ZM50 30h18v32H50ZM53 24h12m-12 44h12M68 38l16 6-16 6"
              fill="currentColor"
              fillOpacity=".12"
            />
            <path d="M84 44h24" strokeWidth="4" />
            <path
              d="M91 34l9-5m-9 25 9 5M31 31v-8m10 8v-8"
              strokeOpacity=".65"
            />
            <circle cx="59" cy="44" r="5" fill="currentColor" />
          </>
        )}
        {id === "venom" && (
          <>
            <path d="M48 17h24m-19 0v21L36 63q-3 8 5 8h38q8 0 5-8L67 38V17" />
            <path
              d="M46 52h28l9 14H37Z"
              fill="currentColor"
              fillOpacity=".2"
              strokeOpacity=".4"
            />
            <circle cx="54" cy="59" r="3" fill="currentColor" />
            <circle cx="66" cy="49" r="2" fill="currentColor" />
            <path
              d="m88 21 5 8-5 5-5-5Z"
              fill="currentColor"
              fillOpacity=".3"
            />
          </>
        )}
        {id === "flak" && (
          <>
            <path
              d="M25 64h56l-8-15H37ZM44 48 38 25l12-3 9 26M61 48l5-26 12 3-3 24M35 64v8m36-8v8"
              fill="currentColor"
              fillOpacity=".12"
            />
            <path
              d="m84 18 3-9m3 16 10-5m-11 14 10 5M28 20l-8-6m7 17-11 2"
              strokeDasharray="3 3"
            />
            <circle cx="90" cy="12" r="2" fill="currentColor" />
          </>
        )}
        {id === "capacitor" && (
          <>
            <path d="M38 27h44v35H38ZM45 21h30M45 68h30M27 37h11m-11 15h11m44-15h11M82 52h11" />
            <path
              d="m63 31-14 17h13l-4 12 14-18H59Z"
              fill="currentColor"
              fillOpacity=".25"
            />
            <path
              d="M25 20a40 40 0 0 1 70 0M25 20l-1-10m1 10 11-1"
              strokeOpacity=".45"
            />
          </>
        )}
        {id === "thorns" && (
          <>
            <path
              d="m60 20 22 11v22L60 70 38 53V31Z"
              fill="currentColor"
              fillOpacity=".1"
            />
            <path d="m49 25-7-15 16 10m15 5 9-15-3 18M38 37l-15-3 15 15m44-12 15-3-15 15M48 61l-3 15 13-8m14-7 3 15-13-8" />
            <path d="m49 43 8 10 15-19" strokeWidth="3" />
          </>
        )}
        {id === "repair" && (
          <>
            <path d="m60 13 27 15v32L60 75 33 60V28Z" strokeOpacity=".6" />
            <path
              d="M53 28h14v10h10v14H67v10H53V52H43V38h10Z"
              fill="currentColor"
              fillOpacity=".2"
            />
          </>
        )}
        {id === "siphon" && (
          <>
            <path d="M42 19h36v51H42ZM50 14h20M49 63h22M34 32l-8 12 8 12m52-24 8 12-8 12" />
            <path
              d="m64 25-13 21h12l-6 16 16-24H61Z"
              fill="currentColor"
              fillOpacity=".25"
            />
          </>
        )}
        {id === "stasis" && (
          <>
            <path d="M60 15v58M35 30l50 28M35 58l50-28M51 20l9 8 9-8M51 68l9-8 9 8M35 40l10-4-1-11m32 38-1-11 10-4M35 48l10 4-1 11m32-38-1 11 10 4" />
            <circle
              cx="60"
              cy="44"
              r="10"
              fill="currentColor"
              fillOpacity=".1"
            />
          </>
        )}
        {![
          "pulse",
          "arc",
          "rail",
          "orbit",
          "mortar",
          "laser",
          "venom",
          "flak",
          "capacitor",
          "thorns",
          "repair",
          "siphon",
          "stasis",
        ].includes(id) && (
          <>
            <path d="m60 16 26 14v29L60 74 34 59V30Z" />
            <circle cx="60" cy="45" r="13" />
            <path d="M60 36v18m-9-9h18" />
          </>
        )}
      </g>
    </svg>
  );
}

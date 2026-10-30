import type { RuneType } from "@/lib/runedelve/dungeonGenerator";

/** Original, shape-distinct marks. Color is inherited from the rune's enamel. */
export function RuneSigil({
  type,
  className,
}: {
  type: RuneType;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {type === "red" && (
        <>
          <path
            d="m10 7 7 3 17 23-5 4L12 14Z"
            fill="currentColor"
            fillOpacity=".14"
          />
          <path
            d="m38 7-7 3-17 23 5 4 17-23Z"
            fill="currentColor"
            fillOpacity=".14"
          />
          <path d="m12 30 10 8M26 38l10-8M15 36l-4 5M33 36l4 5M13 12l11 15M35 12 24 27" />
          <path d="M24 5v3M5 23h3M40 23h3" strokeWidth="1.5" />
        </>
      )}
      {type === "blue" && (
        <>
          <path
            d="m24 5 6 13 13 6-13 6-6 13-6-13-13-6 13-6Z"
            fill="currentColor"
            fillOpacity=".14"
          />
          <path
            d="m24 14 6 10-6 10-6-10Z"
            fill="currentColor"
            fillOpacity=".2"
          />
          <path
            d="m11 11 3 3M34 34l3 3M37 11l-3 3M14 34l-3 3M24 20v8"
            strokeWidth="1.5"
          />
        </>
      )}
      {type === "green" && (
        <>
          <path
            d="M24 8c-9 8-9 15 0 20 9-5 9-12 0-20Z"
            fill="currentColor"
            fillOpacity=".15"
          />
          <path
            d="M8 21c0 12 5 17 16 14C24 24 19 20 8 21Zm32 0c0 12-5 17-16 14 0-11 5-15 16-14Z"
            fill="currentColor"
            fillOpacity=".15"
          />
          <path d="M24 17v25M14 27l10 9 10-9M19 42h10" />
          <path d="M9 11h4M11 9v4M35 11h4M37 9v4" strokeWidth="1.5" />
        </>
      )}
      {type === "gold" && (
        <>
          <path
            d="m24 6 15 6v12c0 9-7 15-15 19-8-4-15-10-15-19V12Z"
            fill="currentColor"
            fillOpacity=".14"
          />
          <path
            d="m24 12 9 4v8c0 6-4 11-9 14-5-3-9-8-9-14v-8Z"
            strokeWidth="1.5"
          />
          <path d="m24 17 5 7-5 7-5-7Z" fill="currentColor" fillOpacity=".24" />
          <path d="M6 5h4M8 3v4M38 5h4M40 3v4" strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { RuneType } from "@/lib/runedelve/dungeonGenerator";
import { RuneSigil } from "./RuneSigil";
import "./runeTiles.css";

const RUNE_LABEL: Record<RuneType, string> = {
  red: "Attack",
  blue: "Mana",
  green: "Heal",
  gold: "Guard",
};

type RuneMarkType =
  | "sealed"
  | "corrupted"
  | "source"
  | "linked"
  | "eclipsed"
  | "shifting"
  | "treasure"
  | "hazard";

function RuneMark({ type }: { type: RuneMarkType }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {type === "sealed" && (
        <>
          <rect x="4" y="9" width="12" height="9" rx="2" />
          <path d="M6 9V6a4 4 0 0 1 8 0v3M10 12v3" />
        </>
      )}
      {type === "corrupted" && (
        <>
          <path d="m10 2 7 8-7 8-7-8Z" />
          <path d="m7 6 5 4-4 4M3 3l2 2M15 15l2 2" />
        </>
      )}
      {type === "source" && (
        <>
          <path d="m10 1 2 5 5-2-2 5 4 3-6 1-3 6-3-6-6-1 4-3-2-5 5 2Z" />
          <circle cx="10" cy="10" r="2.3" />
        </>
      )}
      {type === "linked" && (
        <>
          <path d="m8 12-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M12 8l1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0M7 13l6-6" />
        </>
      )}
      {type === "eclipsed" && (
        <>
          <circle cx="10" cy="10" r="7" />
          <path d="M12 3a7 7 0 0 0 0 14 7 7 0 0 1 0-14Z" fill="currentColor" />
        </>
      )}
      {type === "shifting" && (
        <>
          <path d="M3 5h10a3 3 0 1 1-3-3M3 10h13M3 15h9a2 2 0 1 1-2 3" />
        </>
      )}
      {type === "treasure" && (
        <>
          <path d="m10 2 7 6-7 10L3 8Z" />
          <path d="M3 8h14M7 8l3 10 3-10-3-6Z" />
        </>
      )}
      {type === "hazard" && (
        <>
          <path d="m10 2 8 15H2Z" />
          <path d="M10 7v4M10 14h.01" />
        </>
      )}
    </svg>
  );
}

interface Props {
  type: RuneType;
  selected?: boolean;
  selectionOrder?: number;
  invalid?: boolean;
  sealed?: boolean;
  corrupted?: boolean;
  corruptionSource?: boolean;
  eclipsed?: boolean;
  linked?: boolean;
  shifting?: boolean;
  treasure?: boolean;
  hazard?: boolean;
  size?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  touchAction?: "none" | "pan-y";
  dataR: number;
  dataC: number;
  /** Cosmetic only: button identity and hit geometry never depend on this. */
  refillVersion?: number;
  motionEnabled?: boolean;
}

export function RuneCell({
  type,
  selected,
  selectionOrder,
  invalid,
  sealed,
  corrupted,
  corruptionSource,
  eclipsed,
  linked,
  shifting,
  treasure,
  hazard,
  size,
  onPointerDown,
  onPointerEnter,
  onClick,
  disabled,
  touchAction = "none",
  dataR,
  dataC,
  refillVersion = 0,
  motionEnabled = true,
}: Props) {
  const arrivalRef = useRef<HTMLSpanElement>(null);
  const previousRune = useRef({ type, refillVersion });

  useEffect(() => {
    const changed =
      previousRune.current.type !== type ||
      previousRune.current.refillVersion !== refillVersion;
    previousRune.current = { type, refillVersion };
    // Animate only the inscription. The button stays still and remains usable
    // throughout a cast. Updates received while hidden never replay on return.
    if (!changed || !motionEnabled || !arrivalRef.current?.animate) return;
    const animation = arrivalRef.current.animate(
      [
        { opacity: 0, transform: "translateY(-9px) scale(.72)", offset: 0 },
        { opacity: 0, transform: "translateY(-9px) scale(.72)", offset: 0.18 },
        { opacity: 1, transform: "translateY(1px) scale(1.07)", offset: 0.72 },
        { opacity: 1, transform: "translateY(0) scale(1)", offset: 1 },
      ],
      { duration: 420, easing: "cubic-bezier(.2,.75,.2,1)" },
    );
    return () => animation.cancel();
  }, [type, refillVersion, motionEnabled]);

  const states: string[] = [];
  if (sealed) states.push("Sealed");
  if (corruptionSource) states.push("Corruption source on");
  else if (corrupted) states.push("Corrupted");
  if (linked) states.push("Linked");
  if (eclipsed) states.push("Eclipsed");
  const details = [
    eclipsed ? "cannot start chain" : undefined,
    shifting ? "shifting column" : undefined,
    treasure ? "treasure chamber cell" : undefined,
    hazard ? "hazard chamber cell" : undefined,
  ].filter(Boolean);
  const label = `${states.length ? `${states.join(", ")} ` : ""}${RUNE_LABEL[type]} rune${details.length ? ` (${details.join("; ")})` : ""}`;

  return (
    <button
      type="button"
      data-rune-cell={sealed ? undefined : true}
      data-rune-type={type}
      data-selected={Boolean(selected)}
      data-r={dataR}
      data-c={dataC}
      onPointerDown={sealed ? undefined : onPointerDown}
      onPointerEnter={sealed ? undefined : onPointerEnter}
      onClick={sealed ? undefined : onClick}
      disabled={disabled || sealed}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "rd-rune",
        selected && "is-selected",
        invalid && "is-invalid",
        sealed && "is-sealed",
        (corrupted || corruptionSource) && "is-corrupted",
        corruptionSource && "is-source",
        eclipsed && "is-eclipsed",
        shifting && "is-shifting",
        treasure && "is-treasure",
        hazard && !treasure && "is-hazard",
      )}
      style={{
        width: size ?? "100%",
        height: size ?? "auto",
        aspectRatio: "1 / 1",
        touchAction,
      }}
    >
      <span className="rd-rune-enamel" aria-hidden="true" />
      <span className="rd-rune-engraving" aria-hidden="true" />
      <span ref={arrivalRef} className="rd-rune-arrival" aria-hidden="true">
        <RuneSigil type={type} className="rd-rune-sigil" />
      </span>
      {selectionOrder != null && (
        <span className="rd-selection-order" aria-hidden="true">
          {selectionOrder}
        </span>
      )}
      {sealed && (
        <span className="rd-rune-seal" aria-hidden="true">
          <RuneMark type="sealed" />
        </span>
      )}
      {(corruptionSource || corrupted || linked || eclipsed) && (
        <span className="rd-rune-marks" aria-hidden="true">
          {(corruptionSource || corrupted) && (
            <span
              className={cn(
                "rd-rune-mark",
                corruptionSource ? "is-source" : "is-corrupted",
              )}
            >
              <RuneMark type={corruptionSource ? "source" : "corrupted"} />
            </span>
          )}
          {linked && (
            <span className="rd-rune-mark is-linked">
              <RuneMark type="linked" />
            </span>
          )}
          {eclipsed && (
            <span className="rd-rune-mark is-eclipsed">
              <RuneMark type="eclipsed" />
            </span>
          )}
        </span>
      )}
      {shifting && (
        <span className="rd-rune-drift" aria-hidden="true">
          <RuneMark type="shifting" />
        </span>
      )}
      {(treasure || hazard) && (
        <span
          className={cn(
            "rd-rune-chamber-mark",
            treasure ? "is-treasure" : "is-hazard",
          )}
          aria-hidden="true"
        >
          <RuneMark type={treasure ? "treasure" : "hazard"} />
        </span>
      )}
    </button>
  );
}

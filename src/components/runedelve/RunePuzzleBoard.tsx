import { useRef } from "react";
import { CircleDot, DoorOpen, Gem, LockKeyhole, Snowflake } from "lucide-react";
import { RuneSigil } from "./RuneSigil";
import { RuneEnemyArt, RuneHeroArt } from "./RuneArtwork";
import {
  puzzleGuardianCalm,
  puzzleNeighbor,
  puzzleOpenGates,
  puzzleSigilsFilled,
} from "@/lib/runedelve/puzzles/engine";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import type {
  PuzzleDirection,
  PuzzleRoom,
  PuzzleState,
} from "@/lib/runedelve/puzzles/types";
import "./runePuzzles.css";

const COLOR_NAMES = {
  red: "Ember",
  blue: "Aether",
  green: "Verdant",
  gold: "Golden",
};
export function RunePuzzleBoard({
  room,
  state,
  avatar,
  disabled,
  hint,
  onDirection,
  onDistantTap,
}: {
  room: PuzzleRoom;
  state: PuzzleState;
  avatar: HeroClass;
  disabled?: boolean;
  hint?: PuzzleDirection | null;
  onDirection: (direction: PuzzleDirection) => void;
  onDistantTap?: () => void;
}) {
  const start = useRef<{
    x: number;
    y: number;
    pointerId: number;
    cell: number | null;
  } | null>(null);
  const gates = new Set(puzzleOpenGates(room, state));
  const calm = puzzleGuardianCalm(room, state);
  const portalOpen = puzzleSigilsFilled(room, state) === room.sigils.length;
  const directions: PuzzleDirection[] = ["up", "right", "down", "left"];
  const hintedCell = hint ? puzzleNeighbor(room, state.player, hint) : -1;
  const tap = (cell: number) => {
    if (disabled) return;
    const direction = directions.find(
      (d) => puzzleNeighbor(room, state.player, d) === cell,
    );
    if (direction) onDirection(direction);
    else if (cell !== state.player) onDistantTap?.();
  };
  return (
    <div className="rp-board-frame">
      <div
        className="rp-board"
        role="group"
        aria-label="Rune chamber. Tap a neighboring tile or swipe to move your delver."
        tabIndex={0}
        data-testid="puzzle-board"
        data-puzzle-room={room.id}
        onPointerDown={(event) => {
          if (!disabled && event.isPrimary && event.button === 0) {
            const tile =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>("[data-puzzle-cell]")
                : null;
            start.current = {
              x: event.clientX,
              y: event.clientY,
              pointerId: event.pointerId,
              cell: tile ? Number(tile.dataset.puzzleCell) : null,
            };
          }
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        onPointerUp={(event) => {
          const origin = start.current;
          start.current = null;
          if (!origin || disabled || origin.pointerId !== event.pointerId)
            return;
          const dx = event.clientX - origin.x,
            dy = event.clientY - origin.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) {
            if (origin.cell !== null) tap(origin.cell);
            return;
          }
          onDirection(
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? "right"
                : "left"
              : dy > 0
                ? "down"
                : "up",
          );
        }}
      >
        {Array.from({ length: 36 }, (_, cell) => {
          const stone = state.stones.find((item) => item.cell === cell);
          const sigil = room.sigils.find((item) => item.cell === cell);
          const wall = room.walls.includes(cell),
            isPlayer = state.player === cell;
          const isGate = room.gates.includes(cell),
            gateOpen = gates.has(cell);
          const isIce = room.ice.includes(cell),
            isPlate = room.plates.includes(cell);
          const isGuardian = room.guardian?.cell === cell;
          const isTreasure =
            room.treasures.includes(cell) && !state.collected.includes(cell);
          const isExit = room.exit === cell;
          const matched = !!stone && sigil?.color === stone.color;
          const neighbor = directions.some(
            (d) => puzzleNeighbor(room, state.player, d) === cell,
          );
          const labels = [
            wall ? "Wall" : "Floor",
            isIce && "ice",
            isPlate && "pressure plate",
            isGate && `${gateOpen ? "open" : "closed"} gate`,
            sigil &&
              `${COLOR_NAMES[sigil.color]} sigil${matched ? ", restored" : ""}`,
            stone && `${COLOR_NAMES[stone.color]} runestone`,
            isGuardian && `${room.guardian!.name}, ${calm ? "calm" : "warded"}`,
            isTreasure && "treasure",
            isExit && `${portalOpen ? "restored" : "inactive"} portal`,
            isPlayer && "your delver",
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={cell}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              // Pointer gestures are handled on release, even when a mobile
              // browser omits its compatibility click after a swipe. Keep
              // native keyboard and assistive activation without double moves.
              onClick={(event) => {
                if (event.detail === 0) tap(cell);
              }}
              className={`rp-tile${wall ? " is-wall" : ""}${isPlayer ? " is-player" : ""}${neighbor && !wall ? " is-neighbor" : ""}${isIce ? " is-ice" : ""}${isGate && !gateOpen ? " is-gated" : ""}${matched ? " is-restored" : ""}${hintedCell === cell ? " is-hinted" : ""}`}
              data-puzzle-cell={cell}
              data-puzzle-stone={stone?.color}
              data-puzzle-player={isPlayer || undefined}
              aria-label={`Row ${Math.floor(cell / 6) + 1}, column ${(cell % 6) + 1}: ${labels}`}
            >
              {!wall && (
                <>
                  {isIce && (
                    <Snowflake
                      className="rp-floor-icon rp-ice-icon"
                      aria-hidden="true"
                    />
                  )}
                  {isPlate && (
                    <CircleDot
                      className={`rp-floor-icon rp-plate-icon${isPlayer || stone ? " is-pressed" : ""}`}
                      aria-hidden="true"
                    />
                  )}
                  {sigil && (
                    <span className="rp-sigil" data-color={sigil.color}>
                      <RuneSigil type={sigil.color} />
                    </span>
                  )}
                  {isExit && (
                    <span
                      className={`rp-portal${portalOpen ? " is-open" : ""}`}
                    >
                      <DoorOpen aria-hidden="true" />
                    </span>
                  )}
                  {isTreasure && (
                    <Gem
                      className={`rp-treasure${isGuardian ? " is-guarded" : ""}`}
                      aria-hidden="true"
                    />
                  )}
                  {isGate && (
                    <span
                      className={`rp-gate${gateOpen ? " is-open" : ""}`}
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {isGuardian && (
                    <span className={`rp-guardian${calm ? " is-calm" : ""}`}>
                      <RuneEnemyArt
                        archetypeId={room.guardian!.archetypeId}
                        name={room.guardian!.name}
                      />
                      <span
                        data-color={room.guardian!.color}
                        className="rp-guardian-seal"
                      >
                        <RuneSigil type={room.guardian!.color} />
                      </span>
                      {!calm && (
                        <LockKeyhole
                          className="rp-guardian-lock"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  )}
                  {stone && (
                    <span className="rp-stone" data-color={stone.color}>
                      <RuneSigil type={stone.color} />
                    </span>
                  )}
                  {(isPlate || isIce) && (
                    <span className="rp-floor-marks" aria-hidden="true">
                      {isPlate && (
                        <CircleDot
                          className={isPlayer || stone ? "is-pressed" : ""}
                        />
                      )}
                      {isIce && <Snowflake />}
                    </span>
                  )}
                  {isPlayer && (
                    <span className="rp-delver">
                      <RuneHeroArt cls={avatar} />
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

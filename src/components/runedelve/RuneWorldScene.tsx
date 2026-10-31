import { useLocation } from "react-router-dom";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { useMyProgress } from "@/hooks/useRuneDelveCampaign";
import { useRunePuzzleProgress } from "@/hooks/useRunePuzzles";
import { getPuzzleRoom } from "@/lib/runedelve/puzzles/rooms";
import { isRunePuzzleRoute } from "@/lib/runedelve/puzzles/routes";

type RuneBiome = "ember" | "crystal" | "hollow";

/** Static illustrated depth with a small, fixed particle budget. Never participates in layout or input. */
export function RuneWorldScene() {
  const { pathname } = useLocation();
  return isRunePuzzleRoute(pathname) ? (
    <PuzzleWorldScene pathname={pathname} />
  ) : (
    <LegacyWorldScene pathname={pathname} />
  );
}

function PuzzleWorldScene({ pathname }: { pathname: string }) {
  const { data: progress } = useRunePuzzleProgress();
  const roomId = pathname.match(/^\/rune-delve\/chamber\/([^/]+)/)?.[1];
  const room =
    (roomId ? getPuzzleRoom(roomId) : undefined) ??
    getPuzzleRoom(progress?.unlocked ?? 1);
  const biome: RuneBiome =
    room?.chapter === 3 || room?.chapter === 6
      ? "hollow"
      : room?.chapter === 2 || room?.chapter === 4
        ? "crystal"
        : "ember";
  return <WorldScenery biome={biome} puzzleChapter={room?.chapter} />;
}

function LegacyWorldScene({ pathname }: { pathname: string }) {
  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress(hero?.class);
  const chamber = pathname.match(/\/play\/(\d+)/)?.[1];
  const chapter = Math.floor(
    ((chamber ? Number(chamber) : (progress?.highest_unlocked_level ?? 1)) -
      1) /
      50,
  );
  const biome: RuneBiome = pathname.endsWith("/expedition")
    ? "hollow"
    : chapter >= 2
      ? "hollow"
      : chapter === 1
        ? "crystal"
        : "ember";
  return <WorldScenery biome={biome} />;
}

function WorldScenery({
  biome,
  puzzleChapter,
}: {
  biome: RuneBiome;
  puzzleChapter?: number;
}) {
  return (
    <div
      className="rd-world-scene"
      data-biome={biome}
      data-puzzle-chapter={puzzleChapter}
      aria-hidden="true"
    >
      <div className="rd-world-illustration" />
      <div className="rd-world-vignette" />
      <div className="rd-world-motes">
        {Array.from({ length: 8 }, (_, i) => (
          <i
            key={i}
            style={
              {
                "--mote-x": `${7 + ((i * 37) % 88)}%`,
                "--mote-delay": `${-i * 1.7}s`,
                "--mote-drift": `${i % 2 ? -24 : 28}px`,
                "--mote-time": `${12 + (i % 4) * 3}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <span className="rd-world-arch rd-world-arch-left" />
      <span className="rd-world-arch rd-world-arch-right" />
    </div>
  );
}

import { useLocation } from "react-router-dom";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { useMyProgress } from "@/hooks/useRuneDelveCampaign";

/** Static illustrated depth with a small, fixed particle budget. Never participates in layout or input. */
export function RuneWorldScene() {
  const { pathname } = useLocation();
  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress(hero?.class);
  const chamber = pathname.match(/\/play\/(\d+)/)?.[1];
  const chapter = Math.floor(
    ((chamber ? Number(chamber) : (progress?.highest_unlocked_level ?? 1)) -
      1) /
      50,
  );
  const biome = pathname.endsWith("/expedition")
    ? "hollow"
    : chapter >= 2
      ? "hollow"
      : chapter === 1
        ? "crystal"
        : "ember";
  return (
    <div className="rd-world-scene" data-biome={biome} aria-hidden="true">
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

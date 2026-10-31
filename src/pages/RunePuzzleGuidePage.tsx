import { RunePuzzleGuide } from "@/components/runedelve/RunePuzzleGuide";
import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";
import { puzzleRoomHref } from "@/lib/runedelve/puzzles/links";
import "@/components/runedelve/runePuzzles.css";

export default function RunePuzzleGuidePage() {
  return (
    <section className="rd-screen rd-puzzle-guide-screen">
      <header>
        <p className="rd-eyebrow">Rune Delve</p>
        <h1 className="rd-title">The chamber guide</h1>
      </header>
      <RunePuzzleGuide />
      <Link
        className="rp-secondary rp-tutorial-replay"
        to={`${puzzleRoomHref(PUZZLE_ROOMS[0])}?tutorial=1`}
      >
        <RotateCcw size={16} aria-hidden="true" />
        Replay tutorial
      </Link>
    </section>
  );
}

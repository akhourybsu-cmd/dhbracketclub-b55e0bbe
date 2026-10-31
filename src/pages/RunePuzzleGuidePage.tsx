import { RunePuzzleGuide } from "@/components/runedelve/RunePuzzleGuide";

export default function RunePuzzleGuidePage() {
  return (
    <section className="rd-screen rd-puzzle-guide-screen">
      <header>
        <p className="rd-eyebrow">Rune Delve</p>
        <h1 className="rd-title">The chamber guide</h1>
      </header>
      <RunePuzzleGuide />
    </section>
  );
}

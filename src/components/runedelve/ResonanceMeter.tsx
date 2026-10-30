import type { CombatState } from "@/lib/runedelve/combatEngine";
import { getResonanceColors } from "@/lib/runedelve/resonance";
import { RUNE_TYPES } from "@/lib/runedelve/dungeonGenerator";
import { RuneSigil } from "./RuneSigil";
import "./runeBattle.css";

export function ResonanceMeter({
  state,
  onInspect,
}: {
  state: CombatState;
  onInspect?: () => void;
}) {
  const colors = getResonanceColors(state);
  const content = (
    <>
      <span>
        <span>Resonance <b>{colors.length}/4</b></span>
        <small>{colors.length === 3 ? "One sigil to Convergence" : "Four colors. One burst."}</small>
      </span>
      {RUNE_TYPES.map((rune, index) => (
        <span
          key={rune}
          className="rd-resonance-rune"
          data-active={colors.includes(rune)}
          style={{
            color: `hsl(${["0 75% 62%", "215 75% 67%", "140 60% 58%", "45 90% 65%"][index]})`,
          }}
          aria-hidden
        >
          <RuneSigil type={rune} />
        </span>
      ))}
    </>
  );
  const label = `Resonance: ${colors.length} of 4 colors charged. Use each rune color to unleash a burst.`;
  return onInspect ? (
    <button
      type="button"
      className="rd-resonance"
      onClick={onInspect}
      aria-label={label}
    >
      {content}
    </button>
  ) : (
    <div className="rd-resonance w-full" role="status" aria-label={label}>
      {content}
    </div>
  );
}

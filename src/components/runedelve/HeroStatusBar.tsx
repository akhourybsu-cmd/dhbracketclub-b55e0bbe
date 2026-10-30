import { Heart, Shield, Sparkles, Zap } from "lucide-react";
import type { CombatState } from "@/lib/runedelve/combatEngine";
import { MAX_MANA } from "@/lib/runedelve/combatEngine";
import { getClass, type HeroClass } from "@/lib/runedelve/classConfig";
import "./runeBattle.css";

interface Props {
  state: CombatState;
  cls: HeroClass;
  onAbility: () => void;
  manaCost?: number;
  disabled?: boolean;
}

export function HeroStatusBar({
  state,
  cls,
  onAbility,
  manaCost = MAX_MANA,
  disabled,
}: Props) {
  const def = getClass(cls);
  const cost = Math.max(0, Math.min(MAX_MANA, manaCost));
  const primed = cls === "rogue" && state.shadowstepActive;
  const ready = state.mana >= cost && !primed;
  const hpPct = Math.max(
    0,
    Math.min(100, Math.round((state.hp / Math.max(1, state.maxHp)) * 100)),
  );
  return (
    <div className="rd-hero-hud">
      <div
        className="rd-hero-health"
        data-fx-target="hp"
        aria-label={`${state.hp} of ${state.maxHp} health`}
      >
        <Heart
          size={13}
          aria-hidden
          style={{ color: "hsl(var(--destructive))" }}
        />
        <div className="rd-hero-health-track" data-fx-hp-glow-target>
          <span
            style={{
              width: `${hpPct}%`,
              background: hpPct <= 35 ? "hsl(var(--destructive))" : undefined,
            }}
          />
        </div>
        <span>
          {state.hp}
          <span className="opacity-60">/{state.maxHp}</span>
        </span>
      </div>
      <div
        className="rd-hero-resources"
        data-fx-target="mana"
        aria-label={`${state.mana} of ${cost} mana needed for ${def.abilityName}`}
      >
        {Array.from({ length: MAX_MANA }).map((_, i) => (
          <span
            key={i}
            className="rd-mana-orb"
            data-filled={i < state.mana}
            aria-hidden
          />
        ))}
        {state.shieldTurns > 0 && (
          <span
            className="rd-hero-state"
            data-fx-target="shield"
            title={`${state.shieldTurns} guarded turns; reduces incoming damage`}
          >
            <Shield size={12} aria-hidden /> {state.shieldTurns}
          </span>
        )}
        {state.shadowstepActive && (
          <span
            className="rd-hero-state"
            title="Shadowstep: next attack deals double damage"
          >
            <Sparkles size={12} aria-hidden /> ×2
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onAbility}
        disabled={!ready || disabled}
        data-ready={ready}
        className="rd-ability-button btn-press"
        aria-label={`${def.abilityName}. ${primed ? "Primed. Your next attack deals double damage" : ready ? "Ready to cast" : `${Math.max(0, cost - state.mana)} more mana needed`}`}
      >
        <Zap size={18} aria-hidden />
        <span>
          {def.abilityName}
          <small>
            {primed
              ? "Next attack ×2"
              : cost === 0
                ? "Free cast"
                : ready
                  ? "Tap to unleash"
                  : `${state.mana}/${cost} mana`}
          </small>
        </span>
      </button>
    </div>
  );
}

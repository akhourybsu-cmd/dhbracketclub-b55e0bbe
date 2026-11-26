import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { fieldPlateUrl } from "@/lib/mesomon/assets";
import { Activity, ArrowRight, ChevronsRight, Droplet, Feather, Gem, Mountain, Shield, Sparkles, Waves } from "lucide-react";
import { hasIncomingDoublePulse, resonanceEligibility, tinctureRecovery } from "@/lib/mesomon/battle";
import { battleBeatDuration, getBattleBeat } from "@/lib/mesomon/battlePlayback";
import { MOVES, SPECIES } from "@/lib/mesomon/data/species";
import { isDirection, keyboardAction } from "@/lib/mesomon/input";
import type { Affinity, BattleAction, BattleState, MesomonSaveV1, MoveId } from "@/lib/mesomon/types";
import "./battlePanel.css";

interface BattlePanelProps {
  save: MesomonSaveV1;
  battle: BattleState;
  paused: boolean;
  onBeat: (turn: number, index: number) => void;
  onAction: (action: BattleAction) => void;
  onContinue: () => void;
}

/** The arrow pad follows the visible layout, including moves reflowed by rotation. */
function navigateCommands(event: KeyboardEvent<HTMLDivElement>) {
  const direction = keyboardAction(event.key);
  if (direction === "confirm" && event.repeat) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!direction || !isDirection(direction) || !(event.target instanceof HTMLButtonElement)) return;
  event.preventDefault();
  event.stopPropagation();
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:enabled"));
  const current = event.target.getBoundingClientRect();
  const vertical = direction === "up" || direction === "down";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  let closest: HTMLButtonElement | undefined;
  let shortest = Infinity;
  for (const button of buttons) {
    const box = button.getBoundingClientRect();
    const dx = box.left + box.width / 2 - (current.left + current.width / 2);
    const dy = box.top + box.height / 2 - (current.top + current.height / 2);
    const forward = sign * (vertical ? dy : dx);
    const cross = Math.abs(vertical ? dx : dy);
    if (forward < 1 || (!vertical && cross > current.height / 2)) continue;
    const distance = forward + cross * 2;
    if (distance < shortest) { closest = button; shortest = distance; }
  }
  closest?.focus();
}

const affinityIcons = { Tide: Droplet, Gale: Feather, Lumen: Sparkles, Stone: Mountain, Rift: Activity } satisfies Record<Affinity, typeof Droplet>;

function moveHint(id: MoveId, boss: boolean) {
  const move = MOVES[id];
  if (move.kind === "calm") return boss ? "Drain stability" : "Lower agitation";
  switch (id) {
    case "tidal-veil": return "Guard all hits";
    case "mud-wrap": return "Shield first hit";
    case "reedstep": return boss ? "Chance to dodge" : "May dodge & calm";
    case "quick-tackle": return "Priority strike";
    case "bank-break": return "Slow, heavy strike";
    default: return `${move.affinity} strike`;
  }
}

function VitalBar({ name, value, max, label, active, delta, side }: {
  name: string;
  value: number;
  max: number;
  label: "HP" | "Stability";
  active: boolean;
  delta: number;
  side: "ally" | "foe";
}) {
  const low = side === "ally" && value > 0 && value <= max / 4;
  return (
    <div className="mm-fighter" data-side={side} data-acting={active || undefined}
      data-hit={delta < 0 || undefined} data-low={low || undefined}>
      <div className="mm-fighter-title">
        <strong>{name}</strong>
        {delta !== 0 && <b className="mm-vital-change" data-direction={delta > 0 ? "gain" : "loss"} aria-hidden="true">
          {delta > 0 ? "+" : "−"}{Math.abs(delta)}
        </b>}
      </div>
      <div className="mm-battle-meter" role="meter" aria-label={`${name} ${label}`}
        aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
        aria-valuetext={`${value} of ${max} ${label}${low ? ", low HP" : ""}`}>
        <i style={{ width: `${max > 0 ? (100 * value) / max : 0}%` }} />
      </div>
      <span className="mm-vital-number">{low ? "Low HP" : label} <b>{value}</b>/{max}</span>
    </div>
  );
}

export function BattlePanel({ save, battle, paused, onBeat, onAction, onContinue }: BattlePanelProps) {
  const [tab, setTab] = useState<"moves" | "switch" | "pack" | "log">("moves");
  const panel = useRef<HTMLDivElement>(null);
  const lastCommand = useRef<{ allyId: string; action: MoveId | "guard" } | null>(null);
  const beat = getBattleBeat(battle);
  const index = battle.playback?.index;
  const turn = battle.turn;
  const delay = battleBeatDuration(battle, save.settings.battleSpeed, save.settings.manualBattle);
  useEffect(() => {
    if (index === undefined || !delay || paused) return;
    const timer = window.setTimeout(() => onBeat(turn, index), delay);
    return () => window.clearTimeout(timer);
  }, [index, turn, delay, paused, onBeat]);

  const choosing = !beat && battle.phase === "choosing";
  const stage = beat ? "playback" : choosing ? "commands" : "result";
  useLayoutEffect(() => {
    if (!paused && document.activeElement === document.body)
      panel.current?.querySelector<HTMLElement>("[data-battle-default]")?.focus({ preventScroll: true });
  }, [stage, paused]);

  const activeIndex = beat?.activeIndex ?? battle.activeIndex;
  const ally = battle.allies[activeIndex];
  const enemy = battle.enemy;
  const boss = enemy.speciesId === "rift-wretch";
  const previous = index !== undefined ? battle.playback?.beats[index - 1] : undefined;
  const hp = beat?.allyVitality[activeIndex] ?? ally.vitality;
  const enemyValue = boss ? beat?.stability ?? battle.stability : beat?.enemyVitality ?? enemy.vitality;
  const enemyBefore = boss ? previous?.stability : previous?.enemyVitality;
  const hpBefore = previous?.activeIndex === activeIndex ? previous.allyVitality[activeIndex] : undefined;
  const previousCommand = lastCommand.current;
  const preferred = previousCommand?.allyId === ally.id ? previousCommand.action : undefined;
  const focusCommand = preferred && (preferred === "guard" || ally.moves.includes(preferred)) ? preferred : ally.moves[0];
  const potions = Math.max(0, (save.inventory.tincture ?? 0) - battle.usedTinctures);
  const healing = tinctureRecovery(ally);
  const canHeal = potions > 0 && healing > 0;
  const eligibility = resonanceEligibility(battle, save.inventory["crystal-bud"] ?? 0);

  return (
    <div className="mm-battle-panel" ref={panel} onKeyDown={navigateCommands}
      data-battle-stage={stage} data-motion={save.settings.reducedMotion ? "reduced" : "full"}>
      <div className="mm-battle-vitals" role="group" aria-label="Combatants">
        <VitalBar name={SPECIES[ally.speciesId].name} value={hp} max={ally.maxVitality} label="HP" side="ally"
          active={beat?.side === "ally" && beat.kind !== "impact"}
          delta={hpBefore === undefined ? 0 : hp - hpBefore} />
        <VitalBar name={SPECIES[enemy.speciesId].name} value={enemyValue}
          max={boss ? battle.maxStability : enemy.maxVitality} label={boss ? "Stability" : "HP"} side="foe"
          active={beat?.side === "enemy" && beat.kind !== "impact"}
          delta={enemyBefore === undefined ? 0 : enemyValue - enemyBefore} />
      </div>
      {beat && index !== undefined ? (
        <div className="mm-turn-readout" data-side={beat.side} data-beat-kind={beat.kind}>
          <div role="status" aria-live="polite" aria-atomic="true">
            <small>Turn {turn}{!boss && ` · Agitation ${beat.agitation}`}</small>
            <p className="mm-battle-log">{beat.text}</p>
          </div>
          <button type="button" className="mm-beat-next" disabled={paused} data-battle-default
            onClick={() => onBeat(turn, index)}>Next <ChevronsRight aria-hidden="true" size={17} /></button>
        </div>
      ) : !choosing ? (
        <div className="mm-battle-result" aria-live="polite" data-outcome={battle.phase}>
          <h2>{battle.phase === "resonated" ? `${SPECIES[enemy.speciesId].name} accepted the bond`
            : battle.phase === "lost" ? "Back to the tide stairs"
            : battle.phase === "escaped" ? "You stepped away"
            : boss ? "Pushed back" : "The way is clear"}</h2>
          {battle.phase !== "escaped" && <p>{battle.phase === "resonated" ? "Open Companions to see their stats."
            : battle.phase === "lost" ? "Your companions will recover there."
            : boss ? "The rift is ready to seal." : `${SPECIES[enemy.speciesId].name} retreats.`}</p>}
          <button className="mm-primary" disabled={paused} data-battle-default onClick={onContinue}>
            Continue <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <fieldset className="mm-battle-controls" aria-label="Battle commands" disabled={paused}>
          <p className="mm-battle-log mm-command-prompt" role="status">
            <span>Turn {turn + 1}</span>
            {!boss && <span>Agitation {battle.agitation}</span>}
            {battle.mudbound > 1 && <span>Mudbound</span>}
            {hasIncomingDoublePulse(battle) && <strong>Double pulse next · Try Guard</strong>}
          </p>
          {tab === "moves" ? (
            <>
              <div className="mm-moves">
                {ally.moves.map((id) => {
                  const move = MOVES[id];
                  const Icon = move.kind === "guard" ? Shield : move.kind === "evade" ? Feather
                    : move.kind === "calm" ? Waves : affinityIcons[move.affinity];
                  return <button
                    key={id}
                    data-battle-default={id === focusCommand || undefined}
                    data-move-kind={move.kind}
                    title={`${move.affinity} · ${move.description}`}
                    onClick={() => {
                      lastCommand.current = { allyId: ally.id, action: id };
                      onAction({ type: "move", moveId: id });
                    }}
                  >
                    <Icon aria-hidden="true" size={17} />
                    <span><strong>{move.name}</strong><small>{moveHint(id, boss)}</small></span>
                  </button>;
                })}
              </div>
              <div className="mm-battle-utility">
                <button data-battle-default={focusCommand === "guard" || undefined} onClick={() => {
                  lastCommand.current = { allyId: ally.id, action: "guard" };
                  onAction({ type: "guard" });
                }}><Shield size={14} aria-hidden="true" /> Guard</button>
                <button
                  disabled={!eligibility.eligible}
                  aria-describedby="mm-resonance-reason"
                  onClick={() => onAction({ type: "resonate" })}
                >
                  <Gem size={14} aria-hidden="true" /> Resonate
                </button>
              </div>
              <p id="mm-resonance-reason" className="mm-resonance-reason">{eligibility.reason}</p>
            </>
          ) : tab === "switch" ? (
            <div className="mm-switch-list">
              {battle.allies.map((member, index) => (
                <button
                  key={member.id}
                  disabled={index === battle.activeIndex || member.vitality <= 0}
                  onClick={() => {
                    onAction({ type: "switch", index });
                    setTab("moves");
                  }}
                >
                  <img src={fieldPlateUrl(member.speciesId)} alt="" />
                  <span>
                    {SPECIES[member.speciesId].name}
                    <small>
                      {member.vitality}/{member.maxVitality} Vitality
                    </small>
                  </span>
                  {member.vitality === 0 ? "Resting" : index === battle.activeIndex ? "Active" : "Call"}
                </button>
              ))}
            </div>
          ) : tab === "log" ? (
            <ol className="mm-turn-history" aria-label="Recent battle actions">
              {battle.log.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ol>
          ) : (
            <div className="mm-pack">
              <button
                disabled={!canHeal}
                onClick={() => {
                  onAction({ type: "item", itemId: "tincture" });
                  setTab("moves");
                }}
              >
                <span>Healing tincture <small>{potions === 0 ? "None left"
                  : !canHeal ? "HP full" : `Restore ${healing} HP`}</small></span>
                <b>×{potions}</b>
              </button>
              {battle.enemy.speciesId !== "rift-wretch" && (
                <button onClick={() => onAction({ type: "flee" })}>
                  Give them space
                </button>
              )}
            </div>
          )}
          <div className="mm-battle-tabs" role="group" aria-label="Battle actions">
            {(["moves", "switch", "pack", "log"] as const).map((value) => (
              <button
                key={value}
                data-battle-default={(tab !== "moves" && tab === value) || undefined}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {value === "moves"
                  ? "Moves"
                  : value === "switch"
                    ? "Switch"
                    : value === "pack"
                      ? "Satchel"
                      : "Log"}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

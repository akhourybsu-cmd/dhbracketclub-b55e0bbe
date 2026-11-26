import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { portraitUrl } from "@/lib/mesomon/assets";
import { resonanceEligibility } from "@/lib/mesomon/battle";
import { battleBeatDuration, getBattleBeat } from "@/lib/mesomon/battlePlayback";
import { MOVES, SPECIES } from "@/lib/mesomon/data/species";
import { isDirection, keyboardAction } from "@/lib/mesomon/input";
import type { BattleAction, BattleState, MesomonSaveV1 } from "@/lib/mesomon/types";
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

function VitalBar({ name, value, max, label, active, delta }: {
  name: string;
  value: number;
  max: number;
  label: "HP" | "Stability";
  active: boolean;
  delta: number;
}) {
  return (
    <div className="mm-fighter" data-acting={active || undefined} data-hit={delta < 0 || undefined}>
      <div className="mm-fighter-title">
        <strong>{name}</strong>
        {delta !== 0 && <b className="mm-vital-change" aria-hidden="true">{delta > 0 ? "+" : "−"}{Math.abs(delta)}</b>}
      </div>
      <div className="mm-battle-meter" role="meter" aria-label={`${name} ${label}`}
        aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <i style={{ width: `${100 * value / max}%` }} />
      </div>
      <span className="mm-vital-number">{label} {value}/{max}</span>
    </div>
  );
}

export function BattlePanel({ save, battle, paused, onBeat, onAction, onContinue }: BattlePanelProps) {
  const [tab, setTab] = useState<"moves" | "switch" | "pack" | "log">("moves");
  const panel = useRef<HTMLDivElement>(null);
  const beat = getBattleBeat(battle);
  const index = battle.playback?.index;
  const turn = battle.turn;
  const delay = battleBeatDuration(battle, save.settings.battleSpeed);
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
  const eligibility = resonanceEligibility(battle, save.inventory["crystal-bud"] ?? 0, save.party.length < 3);

  return (
    <div className="mm-battle-panel" ref={panel} onKeyDown={navigateCommands}
      data-battle-stage={stage} data-motion={save.settings.reducedMotion ? "reduced" : "full"}>
      <div className="mm-battle-vitals" aria-label="Combatants">
        <VitalBar name={SPECIES[ally.speciesId].name} value={hp} max={ally.maxVitality} label="HP"
          active={beat?.kind === "action" && beat.side === "ally"}
          delta={previous && beat?.kind === "impact" ? hp - previous.allyVitality[activeIndex] : 0} />
        <VitalBar name={SPECIES[enemy.speciesId].name} value={enemyValue}
          max={boss ? battle.maxStability : enemy.maxVitality} label={boss ? "Stability" : "HP"}
          active={beat?.kind === "action" && beat.side === "enemy"}
          delta={enemyBefore !== undefined && beat?.kind === "impact" ? enemyValue - enemyBefore : 0} />
      </div>
      {beat && index !== undefined ? (
        <div className="mm-turn-readout">
          <div role="status" aria-live="polite" aria-atomic="true">
            <small>Turn {turn}{!boss && ` · Agitation ${beat.agitation}`}</small>
            <p className="mm-battle-log">{beat.text}</p>
          </div>
          <button type="button" className="mm-beat-next" disabled={paused} data-battle-default
            onClick={() => onBeat(turn, index)}>Next</button>
        </div>
      ) : !choosing ? (
        <div className="mm-battle-result" aria-live="polite">
          <h2>{battle.phase === "resonated" ? "A willing bond."
            : battle.phase === "lost" ? "A moment to catch your breath."
            : battle.phase === "escaped" ? "You leave them room."
            : boss ? "Pushed back. Not yet sealed." : "The current settles."}</h2>
          <p>{battle.log.at(-1)}</p>
          <button className="mm-primary" disabled={paused} data-battle-default onClick={onContinue}>Continue</button>
        </div>
      ) : (
        <fieldset className="mm-battle-controls" aria-label="Battle commands" disabled={paused}>
          <p className="mm-battle-log mm-command-prompt" role="status">
            Turn {turn + 1}{!boss && ` · Agitation ${battle.agitation}`} · {boss ? "Break the rift’s hold." : "Choose a move."}
          </p>
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
          {tab === "moves" ? (
            <>
              <div className="mm-moves">
                {ally.moves.map((id) => (
                  <button
                    key={id}
                    data-battle-default={id === ally.moves[0] || undefined}
                    title={MOVES[id].description}
                    onClick={() => onAction({ type: "move", moveId: id })}
                  >
                    <strong>{MOVES[id].name}</strong>
                    <small>
                      {MOVES[id].kind === "calm"
                        ? battle.enemy.speciesId === "rift-wretch"
                          ? "Loosen hold"
                          : "Calm"
                        : MOVES[id].kind === "guard"
                          ? "Guard"
                          : MOVES[id].kind === "evade"
                            ? "Evade"
                            : "Attack"}{" "}
                      · {MOVES[id].affinity}
                    </small>
                  </button>
                ))}
              </div>
              <div className="mm-battle-utility">
                <button onClick={() => onAction({ type: "guard" })}>Guard</button>
                <button
                  disabled={!eligibility.eligible}
                  aria-describedby="mm-resonance-reason"
                  onClick={() => onAction({ type: "resonate" })}
                >
                  Resonate
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
                  <img src={portraitUrl(member.speciesId)} alt="" />
                  <span>
                    {SPECIES[member.speciesId].name}
                    <small>
                      {member.vitality}/{member.maxVitality} Vitality
                    </small>
                  </span>
                  {index === battle.activeIndex ? "Active" : "Call"}
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
                disabled={
                  (save.inventory.tincture ?? 0) <= battle.usedTinctures || ally.vitality === ally.maxVitality
                }
                onClick={() => onAction({ type: "item", itemId: "tincture" })}
              >
                Healing tincture · up to 26 vitality{" "}
                <span>
                  ×
                  {Math.max(
                    0,
                    (save.inventory.tincture ?? 0) - battle.usedTinctures,
                  )}
                </span>
              </button>
              {battle.enemy.speciesId !== "rift-wretch" && (
                <button onClick={() => onAction({ type: "flee" })}>
                  Give them space
                </button>
              )}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}

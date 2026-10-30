import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import { Heart, Shield, Sparkles, Swords, Zap } from "lucide-react";
import type { CombatState } from "@/lib/runedelve/combatEngine";
import { getClass, type HeroClass } from "@/lib/runedelve/classConfig";
import "./runeFeedback.css";

type FeedbackKind =
  | "damage"
  | "defeat"
  | "hurt"
  | "heal"
  | "mana"
  | "guard"
  | "ability"
  | "convergence";

export interface CombatFeedbackEvent {
  kind: FeedbackKind;
  target: string;
  amount?: number;
}

interface Snapshot {
  hp: number;
  maxHp: number;
  mana: number;
  guard: number;
  abilityUsed: boolean;
  abilityRevision?: number;
  shadowstep: boolean;
  damage: number;
  defeated: number;
  bursts: number;
  enemies: Map<string, number>;
}

function snapshot(state: CombatState, abilityRevision?: number): Snapshot {
  return {
    hp: state.hp,
    maxHp: state.maxHp,
    mana: state.mana,
    guard: state.shieldTurns,
    abilityUsed: state.abilityUsed,
    abilityRevision,
    shadowstep: state.shadowstepActive,
    damage: state.totalDamage,
    defeated: state.enemiesDefeated,
    bursts: state.resonance?.bursts ?? 0,
    enemies: new Map(state.enemies.map((enemy) => [enemy.id, enemy.hp])),
  };
}

/** Presentation reads committed values only; it never resolves or delays combat. */
function transitions(before: Snapshot, after: Snapshot): CombatFeedbackEvent[] {
  const events: CombatFeedbackEvent[] = [];
  // A checkpoint, a new encounter, or a reset establishes a quiet baseline.
  if (
    after.damage < before.damage ||
    after.defeated < before.defeated ||
    after.bursts < before.bursts ||
    after.maxHp !== before.maxHp
  )
    return events;
  for (const [id, hp] of after.enemies) {
    const oldHp = before.enemies.get(id);
    if (oldHp === undefined || oldHp <= 0 || hp >= oldHp) continue;
    events.push({
      kind: hp <= 0 ? "defeat" : "damage",
      target: id,
      amount: Math.round(oldHp - Math.max(0, hp)),
    });
  }
  const hpDelta = Math.round(after.hp - before.hp);
  if (hpDelta)
    events.push({
      kind: hpDelta > 0 ? "heal" : "hurt",
      target: "hero-health",
      amount: Math.abs(hpDelta),
    });
  if (after.mana > before.mana)
    events.push({
      kind: "mana",
      target: "hero-mana",
      amount: after.mana - before.mana,
    });
  if (after.guard > before.guard)
    events.push({
      kind: "guard",
      target: "hero-guard",
      amount: after.guard - before.guard,
    });
  if (after.bursts > before.bursts)
    events.push({ kind: "convergence", target: "stage" });
  // Campaign supplies its successful-cast counter so upgraded First Light
  // casts remain exact even when neither mana nor the boolean flag changes.
  // The other modes use paid casts and can read their committed mana/flags.
  const abilityResolved =
    after.abilityRevision !== undefined
      ? before.abilityRevision !== undefined &&
        after.abilityRevision > before.abilityRevision
      : after.mana < before.mana ||
        (after.abilityUsed && !before.abilityUsed) ||
        (after.shadowstep && !before.shadowstep);
  if (abilityResolved) events.push({ kind: "ability", target: "stage" });
  return events;
}

interface LiveEvent extends CombatFeedbackEvent {
  id: number;
  expires: number;
}

const MAX_EVENTS = 12;
const LIFETIME_MS = 1100;
const FeedbackContext = createContext<{
  events: LiveEvent[];
  cls: HeroClass;
}>({ events: [], cls: "warrior" });

/** One bounded visual queue shared by campaign, arena, and expedition. */
export function CombatFeedback({
  state,
  cls,
  scope,
  children,
  className,
  disabled = false,
  abilityRevision,
  ...attributes
}: {
  state: CombatState;
  cls: HeroClass;
  scope: string | number;
  children: ReactNode;
  className: string;
  disabled?: boolean;
  /** Existing successful-cast counter; presentation only, never resolves an action. */
  abilityRevision?: number;
  "data-testid"?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !document.hidden);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const previous = useRef<{ scope: string | number; value: Snapshot } | null>(
    null,
  );
  const sequence = useRef(0);
  const enabled = visible && !reducedMotion && !disabled;

  useEffect(() => {
    const onVisibility = () => {
      setVisible(!document.hidden);
      if (document.hidden) setEvents([]);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const value = snapshot(state, abilityRevision);
    const before = previous.current;
    previous.current = { scope, value };
    if (!enabled || document.hidden || !before || before.scope !== scope) {
      setEvents((current) => (current.length ? [] : current));
      return;
    }
    const next = transitions(before.value, value);
    if (!next.length) return;
    const now = Date.now();
    const stamped = next.map((event) => ({
      ...event,
      id: ++sequence.current,
      expires: now + LIFETIME_MS,
    }));
    setEvents((current) =>
      [...current.filter((event) => event.expires > now), ...stamped].slice(
        -MAX_EVENTS,
      ),
    );
  }, [state, scope, enabled, abilityRevision]);

  useEffect(() => {
    if (!events.length) return;
    const timeout = window.setTimeout(
      () => {
        const now = Date.now();
        setEvents((current) => current.filter((event) => event.expires > now));
      },
      Math.max(
        0,
        Math.min(...events.map((event) => event.expires)) - Date.now(),
      ),
    );
    return () => window.clearTimeout(timeout);
  }, [events]);

  return (
    <FeedbackContext.Provider
      value={{
        events: enabled && previous.current?.scope === scope ? events : [],
        cls,
      }}
    >
      <div
        {...attributes}
        className={`${className} rd-combat-feedback`}
        data-rd-combat-feedback
      >
        {children}
      </div>
    </FeedbackContext.Provider>
  );
}

export function TargetFeedback({ target }: { target: string }) {
  const { events } = useContext(FeedbackContext);
  return (
    <span className="rd-feedback-anchor" aria-hidden="true">
      {events
        .filter((event) => event.target === target)
        .slice(-2)
        .map((event, index) => (
          <span
            key={event.id}
            data-rd-feedback={event.kind}
            data-rd-feedback-id={event.id}
            className={`rd-feedback-float is-${event.kind}`}
            style={{ "--feedback-lane": index } as CSSProperties}
          >
            <i className="rd-feedback-impact" />
            {(event.kind === "defeat" || event.kind === "damage") && (
              <i className="rd-feedback-cut" />
            )}
            <strong>
              {event.kind === "heal" && <Heart size={12} />}
              {event.kind === "mana" && <Zap size={12} />}
              {event.kind === "guard" && <Shield size={12} />}
              {event.kind === "hurt" ||
              event.kind === "damage" ||
              event.kind === "defeat"
                ? "−"
                : "+"}
              {event.amount}
            </strong>
            {event.kind === "defeat" && <small>VANQUISHED</small>}
          </span>
        ))}
    </span>
  );
}

export function BattleStageFeedback() {
  const { events, cls } = useContext(FeedbackContext);
  const stage = events.filter((event) => event.target === "stage").slice(-1);
  return (
    <div className="rd-stage-feedback" aria-hidden="true">
      {stage.map((event) => (
        <div
          key={event.id}
          className={`rd-stage-burst is-${event.kind} is-${cls}`}
          data-rd-feedback={event.kind}
          data-rd-feedback-id={event.id}
        >
          <i className="rd-stage-burst-ring" />
          <i className="rd-stage-burst-ring rd-stage-burst-ring-outer" />
          <svg
            className="rd-stage-signature"
            viewBox="0 0 120 120"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            {event.kind === "convergence" ? (
              <>
                <path d="m60 9 16 35 35 16-35 16-16 35-16-35L9 60l35-16Z" />
                <path d="m60 31 29 29-29 29-29-29Z" />
                <circle cx="60" cy="60" r="9" />
              </>
            ) : cls === "warrior" ? (
              <>
                <path d="M9 87Q34 16 109 34 62 44 23 100" strokeWidth="4" />
                <path d="m39 83 43-43m-36 0 35 35" strokeWidth="2.5" />
              </>
            ) : cls === "mage" ? (
              <>
                <path d="m69 12-34 51h26l-10 45 36-60H62Z" strokeWidth="3" />
                <circle cx="60" cy="60" r="43" strokeDasharray="10 8 2 8" />
              </>
            ) : cls === "rogue" ? (
              <>
                <path
                  d="m25 92 17-42 43-25-25 43-35 24Zm18-41 17 17m-25 11 9 9M92 92 75 50 32 25l25 43 35 24ZM74 51 57 68"
                  strokeWidth="2.5"
                />
              </>
            ) : (
              <>
                <circle cx="60" cy="60" r="41" />
                <path d="M52 21h16v31h27v16H68v31H52V68H25V52h27Z" />
                <path d="m25 25 8 8m54 54 8 8m0-70-8 8m-54 54-8 8" />
              </>
            )}
          </svg>
          <span>
            {event.kind === "convergence" ? (
              <Sparkles size={14} />
            ) : cls === "warrior" ? (
              <Swords size={14} />
            ) : cls === "cleric" ? (
              <Heart size={14} />
            ) : (
              <Zap size={14} />
            )}
            {event.kind === "convergence"
              ? "Convergence"
              : getClass(cls).abilityName}
          </span>
        </div>
      ))}
    </div>
  );
}

import { ArrowUp, Check, Gem, Lock, Plus, X } from "lucide-react";
import type { RelicDef } from "@/lib/runedelve/relics";
import {
  MAX_RANK,
  rankCost,
  describeRelicAtRank,
} from "@/lib/runedelve/relics";
import { RelicGlyph } from "./RelicGlyph";
import "./runeMenus.css";

interface Props {
  relic: RelicDef;
  state: "locked-tier" | "affordable" | "unaffordable" | "owned" | "equipped";
  shards?: number;
  rank?: number;
  /** Armory cards change equipment; shop cards buy ranks. */
  intent?: "equip" | "upgrade";
  onClick?: () => void;
  disabled?: boolean;
}

export function RelicCard({
  relic,
  state,
  shards,
  rank = 1,
  intent = "upgrade",
  onClick,
  disabled,
}: Props) {
  const owned = state === "owned" || state === "equipped";
  const equipped = state === "equipped";
  const maxed = rank >= MAX_RANK;
  const cost = owned ? rankCost(relic.cost, rank + 1) : relic.cost;
  const affordable = shards == null || shards >= cost;
  const equipping = intent === "equip";
  const action =
    state === "locked-tier"
      ? `Chapter ${relic.tier}`
      : equipping
        ? equipped
          ? "Unequip"
          : "Equip relic"
        : owned
          ? maxed
            ? "Max rank"
            : `Upgrade · ${cost}`
          : `Unlock · ${cost}`;
  const Icon =
    state === "locked-tier"
      ? Lock
      : equipping
        ? equipped
          ? X
          : Plus
        : owned
          ? maxed
            ? Check
            : ArrowUp
          : Gem;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "locked-tier"}
      className="rd-relic-tile"
      data-state={state}
      data-tier={relic.tier}
      data-category={relic.category}
      aria-label={`${relic.name}. ${describeRelicAtRank(relic, owned ? rank : 1)} ${action}`}
    >
      <span className="rd-item-stage">
        <span className="rd-item-tier">
          TIER <strong>{relic.tier}</strong>
        </span>
        <RelicGlyph relic={relic} />
        {owned && (
          <span
            className="rd-item-rank"
            aria-label={`Rank ${rank} of ${MAX_RANK}`}
          >
            {Array.from({ length: MAX_RANK }, (_, i) => (
              <span key={i} data-filled={i < rank} />
            ))}
          </span>
        )}
      </span>
      <span className="rd-item-title">{relic.name}</span>
      <span className="rd-item-effect">
        {describeRelicAtRank(relic, owned ? rank : 1)}
      </span>
      <span
        className="rd-item-action"
        data-afford={equipping || affordable}
        data-equipped={equipped}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {disabled ? "Saving…" : action}
      </span>
    </button>
  );
}

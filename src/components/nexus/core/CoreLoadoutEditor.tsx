import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Lock, Orbit } from "lucide-react";
import {
  ARMORY,
  AUXILIARIES,
  MODULES,
  POWER_BUDGET,
  loadoutError,
  loadoutPower,
} from "@/lib/nexus/core/progression";
import type {
  AuxiliaryId,
  CoreLoadout,
  CoreProfile,
  ModuleId,
} from "@/lib/nexus/core/types";
import { CoreIcon } from "./CoreUI";
import { CoreEquipmentArt } from "./CoreArtwork";
import { CoreDetails } from "./CoreDetails";
import {
  CoreBayArtwork,
  CoreBayHeading,
  CoreSelectionDeck,
} from "./CoreSelectionDeck";
import { CoreFeedback } from "./CoreMotion";
import type { CoreFeedbackEvent } from "@/hooks/useCoreFeedback";
import { EQUIPMENT_BRIEF } from "./menuCopy";

export function CoreLoadoutEditor({
  profile,
  value,
  onChange,
  disabled = false,
  focusId,
  feedback,
  onFeedback,
}: {
  profile: CoreProfile;
  value: CoreLoadout;
  onChange: (value: CoreLoadout) => void;
  disabled?: boolean;
  focusId?: string | null;
  feedback?: CoreFeedbackEvent | null;
  onFeedback?: (label: string) => void;
}) {
  const focus = ARMORY.find((a) => a.id === focusId);
  const [tab, setTab] = useState<"weapons" | "support">(
    focus?.kind === "module" ? "support" : "weapons",
  );
  const [choices, setChoices] = useState({
    weapons: focus?.kind === "weapon" ? focus.id : value.weapons[0] || "orbit",
    support: focus?.kind === "module" ? focus.id : value.module || "repair",
  });
  const [inspected, setInspected] = useState<(typeof ARMORY)[number] | null>(
    null,
  );
  const items = tab === "weapons" ? AUXILIARIES : MODULES;
  const item = items.find((a) => a.id === choices[tab]) || items[0];
  const power = loadoutPower(value),
    weapon = item.kind === "weapon",
    owned = profile.unlocks.includes(item.id);
  const selected = weapon
    ? value.weapons.includes(item.id as AuxiliaryId)
    : value.module === item.id;
  const next: CoreLoadout = weapon
    ? {
        ...value,
        weapons: selected
          ? value.weapons.filter((w) => w !== item.id)
          : [...value.weapons, item.id as AuxiliaryId],
      }
    : { ...value, module: selected ? null : (item.id as ModuleId) };
  const error = loadoutError(next);
  return (
    <section className="nc-loadout-editor" aria-label="Nexus loadout">
      <div className="nc-loadout-summary nc-panel">
        <div>
          <CoreIcon name="Crosshair" size={17} />
          <strong>Pulse cannon</strong>
          <small>PRIMARY · ALWAYS ONLINE</small>
        </div>
        <div
          className="nc-power-budget"
          aria-label={`${power} of ${POWER_BUDGET} power used`}
        >
          <strong>
            {power}
            <small> / {POWER_BUDGET}</small>
          </strong>
          <span>POWER</span>
          <div>
            {Array.from({ length: POWER_BUDGET }, (_, i) => (
              <i key={i} data-active={i < power} />
            ))}
          </div>
        </div>
      </div>
      <div className="nc-loadout-slots" aria-label="Auxiliary slots">
        {[0, 1].map((i) => {
          const equipped = ARMORY.find((a) => a.id === value.weapons[i]);
          return (
            <button
              key={i}
              data-equipped={!!equipped}
              aria-label={`Hardpoint ${i + 1}: ${equipped?.name || "Empty"}`}
              onClick={() => {
                setTab("weapons");
                setChoices((prev) => ({
                  ...prev,
                  weapons:
                    equipped?.id ||
                    AUXILIARIES.find(
                      (a) => !value.weapons.includes(a.id as AuxiliaryId),
                    )?.id ||
                    "orbit",
                }));
              }}
            >
              {equipped ? (
                <CoreEquipmentArt id={equipped.id} />
              ) : (
                <CoreIcon name="Crosshair" size={22} />
              )}
              <span>
                <small>HARDPOINT {i + 1}</small>
                <strong>{equipped?.name || "Empty"}</strong>
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="nc-menu-tabs"
        role="tablist"
        aria-label="Loadout equipment"
      >
        {(["weapons", "support"] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {id === "weapons" ? "Weapons" : "Support"}{" "}
            <small>
              {id === "weapons"
                ? `${value.weapons.length}/2`
                : value.module
                  ? "1/1"
                  : "0/1"}
            </small>
          </button>
        ))}
      </div>
      <CoreSelectionDeck
        label="Inspect loadout equipment"
        value={item.id}
        onChange={(id) => setChoices((prev) => ({ ...prev, [tab]: id }))}
        items={items.map((a) => ({
          ...a,
          icon: undefined,
          locked: !profile.unlocks.includes(a.id),
          installed:
            a.kind === "weapon"
              ? value.weapons.includes(a.id as AuxiliaryId)
              : value.module === a.id,
        }))}
      >
        <CoreBayArtwork id={item.id} />
        <CoreBayHeading
          name={item.name}
          role={item.role}
          brief={EQUIPMENT_BRIEF[item.id]}
          onInfo={() => setInspected(item)}
        />
        <div className="nc-bay-actions">
          {owned && !selected && error && (
            <div className="nc-bay-status">{error}</div>
          )}
          <div className="nc-bay-action-row">
            <button
              className="nc-button"
              aria-label={`${selected ? "Unequip" : "Equip"} ${item.name}`}
              aria-pressed={selected}
              disabled={disabled || !owned || (!selected && !!error)}
              onClick={() => {
                onChange(next);
                onFeedback?.(selected ? "SYSTEM REMOVED" : "SYSTEM EQUIPPED");
              }}
            >
              {selected ? (
                <>
                  <Check size={16} /> EQUIPPED · REMOVE
                </>
              ) : !owned ? (
                <>
                  <Lock size={14} />
                  <Orbit size={13} />
                  {item.cost}
                </>
              ) : error ? (
                power + item.power > POWER_BUDGET ? (
                  "POWER LIMIT"
                ) : (
                  "SLOTS FULL"
                )
              ) : (
                "EQUIP SYSTEM"
              )}
            </button>
            {!owned && (
              <Link
                className="nc-button nc-button-secondary"
                to={`/nexus/research?tab=${weapon ? "armory" : "support"}&item=${item.id}`}
                aria-label={`Unlock ${item.name} in armory`}
              >
                <ArrowUpRight size={17} />
                Unlock
              </Link>
            )}
          </div>
        </div>
        <CoreFeedback event={feedback || null} />
      </CoreSelectionDeck>
      <CoreDetails item={inspected} onClose={() => setInspected(null)}>
        {inspected && !profile.unlocks.includes(inspected.id) && (
          <>
            <p className="nc-menu-note">
              {inspected.cost} credits · {inspected.waves} lifetime waves
            </p>
            <Link
              className="nc-button nc-button-secondary"
              to={`/nexus/research?tab=${inspected.kind === "weapon" ? "armory" : "support"}&item=${inspected.id}`}
            >
              Open armory
            </Link>
          </>
        )}
      </CoreDetails>
    </section>
  );
}

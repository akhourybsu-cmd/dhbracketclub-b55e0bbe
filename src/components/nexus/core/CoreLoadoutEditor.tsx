import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Info, Lock, Orbit } from "lucide-react";
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
export function CoreLoadoutEditor({
  profile,
  value,
  onChange,
  disabled = false,
}: {
  profile: CoreProfile;
  value: CoreLoadout;
  onChange: (value: CoreLoadout) => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<"weapons" | "support">("weapons"),
    [inspected, setInspected] = useState<(typeof ARMORY)[number] | null>(null);
  const power = loadoutPower(value);
  return (
    <section className="nc-loadout-editor" aria-label="Nexus loadout">
      <div className="nc-loadout-summary nc-panel">
        <div>
          <CoreIcon name="Crosshair" size={23} />
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
          const item = ARMORY.find((a) => a.id === value.weapons[i]);
          return (
            <div key={i}>
              <small>HARDPOINT {i + 1}</small>
              <strong>{item?.name || "Empty"}</strong>
              <span>{item ? `${item.power} power` : "Select a weapon"}</span>
            </div>
          );
        })}
      </div>
      <div
        className="nc-menu-tabs"
        role="tablist"
        aria-label="Loadout equipment"
      >
        <button
          role="tab"
          aria-selected={tab === "weapons"}
          id="equip-weapons"
          aria-controls="equip-grid"
          onClick={() => setTab("weapons")}
        >
          Weapons <small>{value.weapons.length}/2</small>
        </button>
        <button
          role="tab"
          aria-selected={tab === "support"}
          id="equip-support"
          aria-controls="equip-grid"
          onClick={() => setTab("support")}
        >
          Support <small>{value.module ? "1/1" : "0/1"}</small>
        </button>
      </div>
      <div
        className="nc-item-grid"
        id="equip-grid"
        role="tabpanel"
        aria-labelledby={`equip-${tab}`}
      >
        {(tab === "weapons" ? AUXILIARIES : MODULES).map((item) => {
          const weapon = item.kind === "weapon",
            owned = profile.unlocks.includes(item.id),
            selected = weapon
              ? value.weapons.includes(item.id as AuxiliaryId)
              : value.module === item.id;
          const next = weapon
            ? {
                ...value,
                weapons: selected
                  ? value.weapons.filter((w) => w !== item.id)
                  : [...value.weapons, item.id as AuxiliaryId],
              }
            : { ...value, module: selected ? null : (item.id as ModuleId) };
          const error = loadoutError(next);
          return (
            <div className="nc-item" data-selected={selected} key={item.id}>
              <button
                className="nc-item-select"
                type="button"
                aria-label={`${selected ? "Unequip" : "Equip"} ${item.name}`}
                aria-pressed={selected}
                disabled={disabled || !owned || (!selected && !!error)}
                onClick={() => onChange(next)}
              >
                <CoreEquipmentArt id={item.id} />
                <strong>{item.name}</strong>
                <span>
                  {item.role}
                  {weapon ? ` · ${item.power} power` : ""}
                </span>
                <small>
                  {selected ? (
                    "EQUIPPED"
                  ) : !owned ? (
                    <span className="nc-item-price">
                      <Lock size={10} />
                      <Orbit size={10} />
                      {item.cost}
                    </span>
                  ) : error ? (
                    power + item.power > 4 ? (
                      "POWER LIMIT"
                    ) : (
                      "SLOTS FULL"
                    )
                  ) : (
                    "EQUIP"
                  )}
                </small>
              </button>
              {selected && <Check size={13} className="nc-item-mark" />}
              <button
                className="nc-item-info"
                aria-label={`About ${item.name}`}
                onClick={() => setInspected(item)}
              >
                <Info size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <CoreDetails item={inspected} onClose={() => setInspected(null)}>
        {inspected && !profile.unlocks.includes(inspected.id) && (
          <>
            <p className="nc-menu-note">
              {inspected.cost} credits · {inspected.waves} lifetime waves
            </p>
            <Link
              className="nc-button nc-button-secondary"
              to="/nexus/research"
            >
              Open armory
            </Link>
          </>
        )}
      </CoreDetails>
    </section>
  );
}

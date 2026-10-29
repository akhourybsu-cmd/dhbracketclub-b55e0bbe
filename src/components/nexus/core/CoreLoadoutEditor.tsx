import { Link } from "react-router-dom";
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
  const power = loadoutPower(value);
  return (
    <section className="nc-loadout-editor" aria-label="Nexus loadout">
      <div className="nc-loadout-summary nc-panel">
        <div>
          <CoreIcon name="Crosshair" size={24} />
          <strong>Pulse cannon</strong>
          <small>Always equipped · no power draw</small>
        </div>
        <div
          className="nc-power-budget"
          aria-label={`${power} of ${POWER_BUDGET} power used`}
        >
          <strong>
            {power}
            <small> / {POWER_BUDGET}</small>
          </strong>
          <span>WEAPON POWER</span>
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
              <strong>{item?.name || "Empty slot"}</strong>
              <span>
                {item
                  ? `${item.role} · ${item.power} power`
                  : "Choose a weapon below"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="nc-section-label">
        Auxiliary weapons<span>{value.weapons.length} / 2 equipped</span>
      </div>
      <div className="nc-equipment-grid">
        {AUXILIARIES.map((item) => {
          const id = item.id as AuxiliaryId,
            owned = profile.unlocks.includes(id),
            selected = value.weapons.includes(id);
          const next = {
            ...value,
            weapons: selected
              ? value.weapons.filter((w) => w !== id)
              : [...value.weapons, id],
          };
          const error = loadoutError(next);
          return (
            <button
              key={id}
              type="button"
              className="nc-equipment nc-panel"
              aria-pressed={selected}
              aria-label={`${selected ? "Unequip" : "Equip"} ${item.name}`}
              disabled={disabled || !owned || (!selected && !!error)}
              onClick={() => onChange(next)}
            >
              <CoreIcon name={item.icon} size={25} />
              <span className="nc-equipment-role">
                {item.role} · {item.power} power
              </span>
              <strong>{item.name}</strong>
              <p>{item.description}</p>
              <small>
                {selected
                  ? "Equipped · tap to remove"
                  : !owned
                    ? `Unlock in armory · ${item.cost} credits`
                    : error || "Tap to equip · starts online"}
              </small>
            </button>
          );
        })}
      </div>
      <div className="nc-section-label">
        Support module<span>Choose one · no weapon power</span>
      </div>
      <div className="nc-module-grid">
        {MODULES.map((item) => {
          const id = item.id as ModuleId,
            selected = value.module === id,
            owned = profile.unlocks.includes(id);
          return (
            <button
              type="button"
              className="nc-equipment nc-panel"
              key={id}
              aria-pressed={selected}
              aria-label={`${selected ? "Unequip" : "Equip"} ${item.name}`}
              disabled={disabled || !owned}
              onClick={() =>
                onChange({ ...value, module: selected ? null : id })
              }
            >
              <CoreIcon name={item.icon} />
              <strong>{item.name}</strong>
              <p>{item.description}</p>
              <small>
                {selected
                  ? "Equipped · tap to remove"
                  : owned
                    ? "Tap to equip"
                    : `Unlock · ${item.cost} credits`}
              </small>
            </button>
          );
        })}
      </div>
      <p className="nc-note">
        Equipped weapons start at level 1 every run. Only your chosen weapons
        and support module can be upgraded in battle.{" "}
        <Link to="/nexus/research">Unlock more in the armory →</Link>
      </p>
    </section>
  );
}

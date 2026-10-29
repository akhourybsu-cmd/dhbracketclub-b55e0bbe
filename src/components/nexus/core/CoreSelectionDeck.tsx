import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Info, Lock } from "lucide-react";
import { CoreEquipmentArt } from "./CoreArtwork";
import { CoreIcon } from "./CoreUI";

interface SelectionItem {
  id: string;
  name: string;
  icon?: string;
  locked?: boolean;
  installed?: boolean;
  level?: number;
}
const shortNames: Record<string, string> = {
  orbit: "Blades",
  arc: "Arc",
  rail: "Rail",
  mortar: "Mortar",
  repair: "Repair",
  siphon: "Siphon",
  stasis: "Stasis",
  weapons: "Power",
  reactor: "Rate",
  plating: "Hull",
  barrier: "Shield",
  salvage: "Energy",
  nova: "Nova",
};

export function CoreSelectionDeck({
  items,
  value,
  onChange,
  label,
  children,
}: {
  items: SelectionItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  children: ReactNode;
}) {
  const id = useId().replace(/:/g, ""),
    reduced = useReducedMotion();
  return (
    <div className="nc-selection-deck">
      <motion.section
        className="nc-equipment-bay"
        key={value}
        role="tabpanel"
        id={`${id}-bay`}
        aria-labelledby={`${id}-${value}`}
        initial={reduced ? false : { opacity: 0, x: 18, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.22 }}
      >
        {children}
      </motion.section>
      <div
        className="nc-selector-keys"
        role="tablist"
        aria-label={label}
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            id={`${id}-${item.id}`}
            role="tab"
            aria-label={`Inspect ${item.name}`}
            aria-selected={item.id === value}
            aria-controls={`${id}-bay`}
            tabIndex={item.id === value ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              const offset =
                event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowLeft"
                    ? -1
                    : 0;
              if (!offset && event.key !== "Home" && event.key !== "End")
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (index + offset + items.length) % items.length;
              onChange(items[next].id);
              (
                event.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }}
          >
            {item.icon ? (
              <CoreIcon name={item.icon} size={23} />
            ) : (
              <CoreEquipmentArt id={item.id} />
            )}
            <span>{shortNames[item.id] || item.name}</span>
            {item.installed ? (
              <Check className="nc-selector-badge" size={10} />
            ) : item.locked ? (
              <Lock className="nc-selector-badge" size={10} />
            ) : item.level !== undefined ? (
              <small className="nc-selector-badge">{item.level}</small>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CoreBayArtwork({ id, icon }: { id: string; icon?: string }) {
  return (
    <div className="nc-bay-artwork" data-system={id} aria-hidden="true">
      <div className="nc-bay-orbits">
        <i />
        <i />
        <i />
      </div>
      {icon ? <CoreIcon name={icon} size={78} /> : <CoreEquipmentArt id={id} />}
    </div>
  );
}

export function CoreBayHeading({
  name,
  role,
  brief,
  onInfo,
}: {
  name: string;
  role: string;
  brief: string;
  onInfo?: () => void;
}) {
  return (
    <div className="nc-bay-heading">
      <small>{role}</small>
      <h2>{name}</h2>
      <p>{brief}</p>
      {onInfo && (
        <button
          className="nc-bay-info"
          aria-label={`About ${name}`}
          onClick={onInfo}
        >
          <Info size={17} />
        </button>
      )}
    </div>
  );
}

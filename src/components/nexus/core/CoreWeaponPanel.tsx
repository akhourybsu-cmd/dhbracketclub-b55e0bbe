import type { CoreRun, CoreScenario, WeaponId } from "@/lib/nexus/core/types";
import { stats, WEAPON_NAMES } from "@/lib/nexus/core/systems";
import { CoreIcon } from "./CoreUI";
export function CoreWeaponPanel({
  run,
  scenario,
  onInstall,
  expanded = false,
}: {
  run: CoreRun;
  scenario: CoreScenario;
  onInstall: () => void;
  expanded?: boolean;
}) {
  const v = stats(run, scenario);
  const systems: {
    id: WeaponId;
    icon: string;
    active: boolean;
    info: string;
    cooldown: number;
  }[] = [
    {
      id: "pulse",
      icon: "Crosshair",
      active: true,
      info: `${v.damage.toFixed(1)} damage · ${v.fireRate.toFixed(2)} shots/s · ${v.targets} target${v.targets > 1 ? "s" : ""}`,
      cooldown: 0,
    },
    {
      id: "arc",
      icon: "Zap",
      active: !!v.arcDamage,
      info: `${v.arcDamage.toFixed(0)} damage · ${v.arcTargets} targets · ${v.arcInterval.toFixed(1)}s cycle`,
      cooldown: run.arcCd || 0,
    },
    {
      id: "rail",
      icon: "Radar",
      active: !!v.railDamage,
      info: `${v.railDamage.toFixed(0)} piercing damage · ${v.railInterval.toFixed(1)}s cycle`,
      cooldown: run.railCd || 0,
    },
    {
      id: "orbit",
      icon: "Orbit",
      active: !!v.orbit,
      info: `${v.orbit} blades · ${v.orbitDamage.toFixed(1)} damage/contact`,
      cooldown: 0,
    },
    {
      id: "mortar",
      icon: "Radar",
      active: !!v.mortarDamage,
      info: `${v.mortarDamage.toFixed(0)} splash · ${v.mortarRadius} radius · ${v.mortarInterval.toFixed(1)}s cycle`,
      cooldown: run.mortarCd || 0,
    },
  ];
  return (
    <details className="nc-systems nc-panel" open={expanded}>
      <summary>
        Weapon systems
        <span>{systems.filter((s) => s.active).length} / 5 online</span>
      </summary>
      <div className="nc-systems-grid">
        {systems.map((s) => (
          <div
            className={`nc-system ${s.active ? "" : "nc-system-off"}`}
            key={s.id}
          >
            <CoreIcon name={s.icon} />
            <div>
              <strong>{WEAPON_NAMES[s.id]}</strong>
              <p>
                {s.active
                  ? s.info
                  : run.loadout
                    ? "Not equipped"
                    : "Not installed"}
              </p>
              {s.active ? (
                <small>
                  {s.cooldown > 0
                    ? `Recharging ${s.cooldown.toFixed(1)}s`
                    : "Online"}
                </small>
              ) : !run.loadout ? (
                <button onClick={onInstall}>Open Weapons →</button>
              ) : (
                <small>—</small>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

import { ChevronDown, Crosshair, Hexagon, Orbit, Zap } from "lucide-react";
import { ENEMIES } from "@/lib/nexus/core/catalog";
import { ARMORY, MILESTONES } from "@/lib/nexus/core/progression";
import { CoreHeading } from "@/components/nexus/core/CoreUI";
import { CoreEquipmentArt } from "@/components/nexus/core/CoreArtwork";
export default function NexusCodexPage() {
  return (
    <>
      <CoreHeading eyebrow="FIELD GUIDE" title="Hold the core." />
      <div className="nc-quick-guide">
        <div>
          <Crosshair size={24} />
          <strong>DEFEND</strong>
          <span>Auto-aim is on</span>
        </div>
        <div>
          <Zap size={24} />
          <strong>UPGRADE</strong>
          <span>Spend energy</span>
        </div>
        <div>
          <Orbit size={24} />
          <strong>RETURN</strong>
          <span>Build your arsenal</span>
        </div>
      </div>
      <details className="nc-guide-section" {...{ name: "nexus-field-guide" }}>
        <summary>
          Combat & abilities
          <ChevronDown size={16} />
        </summary>
        <div>
          <p>
            Your core fires automatically. Enemies attack from every direction
            and keep hitting once they reach the hull.
          </p>
          <p>
            <strong>Nova:</strong> Area damage, knockback and slow. 20s
            cooldown.
          </p>
          <p>
            <strong>Overdrive:</strong> 2× weapon output for 6s. 30s cooldown.
          </p>
          <p>
            Shields recharge after 3 seconds without a hit. Hull and barrier
            upgrades restore the capacity they add.
          </p>
        </div>
      </details>
      <details className="nc-guide-section" {...{ name: "nexus-field-guide" }}>
        <summary>
          Weapons & support
          <ChevronDown size={16} />
        </summary>
        <div>
          <div className="nc-guide-entry">
            <CoreEquipmentArt id="pulse" />
            <div>
              <strong>Pulse cannon</strong>
              <p>
                Always equipped. Homing rounds, multishot and critical hits.
              </p>
            </div>
          </div>
          {ARMORY.map((a) => (
            <div key={a.id} className="nc-guide-entry">
              <CoreEquipmentArt id={a.id} />
              <div>
                <strong>{a.name}</strong>
                <p>{a.description}</p>
                <small>
                  {a.kind === "weapon" ? `${a.power} power` : "Support slot"} ·{" "}
                  {a.cost} credits
                </small>
              </div>
            </div>
          ))}
          <p>
            2 auxiliary slots. 4 power. 1 support module. Equipped weapons start
            online; only deployed equipment can upgrade.
          </p>
        </div>
      </details>
      <details className="nc-guide-section" {...{ name: "nexus-field-guide" }}>
        <summary>
          Enemy intel
          <ChevronDown size={16} />
        </summary>
        <div>
          {Object.entries(ENEMIES).map(([kind, e]) => (
            <div className="nc-guide-entry" key={kind}>
              <Hexagon size={32} style={{ color: e.color }} />
              <div>
                <strong>{e.name}</strong>
                <p>{e.detail}</p>
                <small>
                  Speed {e.speed} · Energy {e.bounty}
                </small>
              </div>
            </div>
          ))}
        </div>
      </details>
      <details className="nc-guide-section" {...{ name: "nexus-field-guide" }}>
        <summary>
          Progression & rewards
          <ChevronDown size={16} />
        </summary>
        <div>
          <p>
            Energy buys upgrades for this run. Credits unlock permanent weapons,
            support and research. Bank earnings when the core falls or choose
            End run & collect.
          </p>
          <p>
            Every fifth wave brings a boss. Each wave gets harder. There's no
            final wave.
          </p>
          <p>
            Milestones pay once, on top of wave credits. Lifetime waves unlock
            equipment access.
          </p>
          {MILESTONES.map((m) => (
            <div className="nc-milestone-row" key={m.wave}>
              <span>WAVE {m.wave}</span>
              <strong>
                <Orbit size={12} />+{m.credits}
              </strong>
            </div>
          ))}
          <p style={{ marginTop: 12 }}>
            Equipment and research carry over. Battle upgrades reset. A run with
            no cleared waves earns no credits.
          </p>
        </div>
      </details>
    </>
  );
}

import { Crosshair, Hexagon, Orbit, Shield, Zap } from "lucide-react";
import { ENEMIES } from "@/lib/nexus/core/catalog";
import { CoreBack, CoreHeading } from "@/components/nexus/core/CoreUI";

export default function NexusCodexPage() {
  return (
    <>
      <CoreBack />
      <CoreHeading
        eyebrow="Field guide / core protocol"
        title="Know your perimeter."
      >
        One nexus at the center. Enemies approach from all directions at
        different speeds. Your weapons aim automatically; your decisions shape
        the defense.
      </CoreHeading>
      <div className="nc-mode-grid">
        <section className="nc-panel nc-mode-card">
          <Crosshair size={23} />
          <h2>Build while you fight</h2>
          <p>
            Neutralize enemies for energy. Spend it immediately on damage, fire
            rate, multishot, or fortifications. Nearest-to-core targeting is the
            safest starting point.
          </p>
        </section>
        <section className="nc-panel nc-mode-card">
          <Shield size={23} />
          <h2>Layer your defense</h2>
          <p>
            Shields absorb hits before hull. Enemies keep attacking when they
            reach the core. Shields start recharging three seconds after the
            last hit. Armor reduces incoming damage; nanites repair hull.
            Orbitals and stasis protect the inner ring.
          </p>
        </section>
        <section className="nc-panel nc-mode-card">
          <Zap size={23} />
          <h2>Choose your moment</h2>
          <p>
            Nova damages enemies within 350 range and pushes them back. It
            recharges in 20 seconds. Overdrive doubles pulse fire rate, arc and
            rail recharge speed, and orbital damage for six seconds, with a
            30-second cooldown.
          </p>
        </section>
      </div>
      <div className="nc-section-label">
        Four weapon systems<span>Install using battle energy</span>
      </div>
      <div className="nc-enemy-list">
        {[
          [
            "Pulse cannon",
            "Always online. Homing rounds retarget when an enemy falls. Multishot attacks additional distinct enemies; critical strike affects pulse hits.",
          ],
          [
            "Chain arc",
            "Install in Weapons. Lightning starts inside detection range, then jumps to nearby targets within 110 distance. Each jump deals 82% of the previous hit.",
          ],
          [
            "Rail lance",
            "Install in Weapons. Targets the strongest enemy and pierces every enemy along its beam. Bypasses the armor on bulwarks and siege engines.",
          ],
          [
            "Orbital blades",
            "Install in Weapons. Moving blades intercept enemies close to the core, including enemies attacking its hull. Each upgrade adds another blade.",
          ],
        ].map(([name, detail]) => (
          <section className="nc-panel nc-enemy-entry" key={name}>
            <div>
              <h3>{name}</h3>
              <p>{detail}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="nc-section-label">
        Threat signatures<span>6 enemy classes</span>
      </div>
      <div className="nc-enemy-list">
        {Object.entries(ENEMIES).map(([kind, e]) => (
          <section className="nc-panel nc-enemy-entry" key={kind}>
            <div className="nc-enemy-glyph" style={{ color: e.color }}>
              <Hexagon
                size={kind === "boss" ? 38 : 28}
                fill="currentColor"
                fillOpacity={0.15}
              />
            </div>
            <div>
              <h3 style={{ color: e.color }}>{e.name}</h3>
              <p>{e.detail}</p>
              <small>
                Base speed {e.speed} · Energy {e.bounty}
                {kind === "boss" ? " · Also guards each sector finale" : ""}
              </small>
            </div>
          </section>
        ))}
      </div>
      <div className="nc-section-label">
        A core that grows with you
        <Orbit size={16} />
      </div>
      <div className="nc-panel" style={{ padding: 24 }}>
        <p className="nc-note">
          Campaign sectors unlock in order. Finish at 40% hull for two stars or
          80% for three. Endless is available from the start, with a boss every
          fifth wave. Four challenges change the rules and award their own clear
          bonuses.
        </p>
        <p className="nc-note" style={{ marginTop: 12 }}>
          Battle energy pays for upgrades during your run and resets afterward.
          Research credits pay for permanent upgrades. Campaign waves pay 4–8
          credits each, challenges pay 6 per wave, and endless pays more as you
          reach higher waves (65 credits at wave 10; 180 at wave 20, capped at
          1,500). Sector and challenge clear bonuses are paid once. Zero-wave
          losses pay nothing. Purchases and earnings appear in the core lab’s
          credit history. Active runs save on this device and pause when you
          switch away; research and completed records sync to your account.
        </p>
      </div>
    </>
  );
}

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
            reach the core. Armor reduces incoming damage; nanites repair hull.
            Orbitals and stasis protect the inner ring.
          </p>
        </section>
        <section className="nc-panel nc-mode-card">
          <Zap size={23} />
          <h2>Choose your moment</h2>
          <p>
            Nova damages enemies within 350 range and pushes them back. It
            recharges in 20 seconds. Overdrive gives 2.2× fire rate for 6
            seconds, with a 30-second recharge.
          </p>
        </section>
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
          Earn 5 research credits for finishing a run, plus 6 per cleared wave
          (wave rewards cap at 500). Sector and challenge victories add a bonus.
          Spend credits in the core lab on permanent upgrades. Active runs save
          on this device and pause when you switch away; research and completed
          records sync to your account.
        </p>
      </div>
    </>
  );
}

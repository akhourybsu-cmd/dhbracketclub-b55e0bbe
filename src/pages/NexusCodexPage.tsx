import { Hexagon } from "lucide-react";
import { ENEMIES } from "@/lib/nexus/core/catalog";
import { ARMORY } from "@/lib/nexus/core/progression";
import {
  CoreBack,
  CoreHeading,
  CoreLink,
} from "@/components/nexus/core/CoreUI";
export default function NexusCodexPage() {
  return (
    <>
      <CoreBack />
      <CoreHeading eyebrow="Field guide / endless" title="Know your perimeter.">
        One nexus. Enemies from every direction. Auto-aim handles the shooting;
        your loadout, upgrades and ability timing shape the defense.
      </CoreHeading>
      <div className="nc-mode-grid">
        <section className="nc-panel nc-mode-card">
          <h2>Prepare your loadout</h2>
          <p>
            Start with the pulse cannon. Unlock up to four auxiliary weapon
            types, then choose two within 4 power. Choose one support module.
            Equipped weapons start online at level 1, and you can only upgrade
            what you brought.
          </p>
        </section>
        <section className="nc-panel nc-mode-card">
          <h2>Build while you fight</h2>
          <p>
            Kills and wave clears supply energy. Spend it on weapon power, pulse
            fire rate, range, multishot or fortifications. Shields recharge
            after three seconds without a hit. Hull plating immediately restores
            its added capacity.
          </p>
        </section>
        <section className="nc-panel nc-mode-card">
          <h2>Push one wave further</h2>
          <p>
            Runners join at wave 2, swarms at 3, armor at 4 and splitters at 6.
            A siege engine arrives every fifth wave. Enemy health, attack
            pressure, speed and spawn density increase; health compounds after
            wave 8. There is no final wave or separate difficulty selector.
          </p>
        </section>
      </div>
      <div className="nc-section-label">
        Your arsenal<span>Different tools for different threats</span>
      </div>
      <div className="nc-enemy-list">
        <section className="nc-panel nc-enemy-entry">
          <div>
            <h3>Pulse cannon · always equipped</h3>
            <p>
              Homing rounds retarget when an enemy falls. Multishot attacks
              different enemies. Critical strike grants a chance at 2.5× pulse
              damage. Your reliable single-target backbone; no power cost.
            </p>
          </div>
        </section>
        {ARMORY.map((a) => (
          <section className="nc-panel nc-enemy-entry" key={a.id}>
            <div>
              <h3>
                {a.name} · {a.role}
              </h3>
              <p>
                {a.description} {a.tradeoff}
              </p>
              <small>
                {a.cost} credits · {a.waves} lifetime waves
                {a.kind === "weapon"
                  ? ` · ${a.power} power`
                  : " · Support slot"}
              </small>
            </div>
          </section>
        ))}
      </div>
      <div className="nc-section-label">
        Active abilities<span>Timing makes a difference</span>
      </div>
      <div className="nc-panel" style={{ padding: 22 }}>
        <p className="nc-note">
          Nova damages enemies within 350 range, knocks them back and slows
          them. It recharges in 20 seconds. Overdrive doubles pulse fire rate,
          arc, rail and mortar recharge speed, and orbital damage for six
          seconds, with a 30-second cooldown. Weapon power and amplifier
          research improve the whole arsenal. Fire rate, critical strike and
          multishot apply to pulse only.
        </p>
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
              </small>
            </div>
          </section>
        ))}
      </div>
      <div className="nc-section-label">
        Progress that carries on<span>Play. Earn. Rebuild.</span>
      </div>
      <div className="nc-panel" style={{ padding: 22 }}>
        <p className="nc-note">
          At the end of a run, earn 3 credits per cleared wave plus floor(waves²
          / 8), capped at 1,800 wave credits. Wave 5 pays 18, wave 10 pays 42,
          and wave 20 pays 110. New personal milestones add one-time bonuses:
          +20 at wave 5, +35 at 10, then larger rewards further out. Even short
          runs count toward lifetime waves for equipment access. Zero-wave
          losses earn nothing.
        </p>
        <p className="nc-note" style={{ marginTop: 12 }}>
          Unlocks, saved loadouts, credits and six research tracks sync to your
          account. Research costs rise by 35% per level and apply to your next
          deployment. Run energy and battle upgrades reset each time. Active
          runs save on this device and pause when you switch away. Old records
          remain archived; the club leaderboard uses this Endless ramp.
        </p>
      </div>
      <div style={{ marginTop: 22 }}>
        <CoreLink to="/nexus/loadout/endless">Build your loadout</CoreLink>
      </div>
    </>
  );
}

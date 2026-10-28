import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Crosshair,
  FlaskConical,
  Infinity as InfinityIcon,
  Play,
  Shield,
  Swords,
  Trophy,
} from "lucide-react";
import { useNexusCore } from "@/hooks/useNexusCore";
import { CAMPAIGN, ENDLESS, getScenario } from "@/lib/nexus/core/catalog";
import { createRun, isFinished } from "@/lib/nexus/core/engine";
import { readCoreRun } from "@/lib/nexus/core/persistence";
import { CoreArena } from "@/components/nexus/core/CoreArena";
import { CoreProfileGate } from "@/components/nexus/core/CoreUI";

export default function NexusHomePage() {
  return (
    <CoreProfileGate>
      <CommandCenter />
    </CoreProfileGate>
  );
}
function CommandCenter() {
  const { profile, userId, clubId } = useNexusCore();
  const saved = readCoreRun(userId, clubId);
  const demo = useMemo(() => {
    const s = createRun(ENDLESS, {}, "preview", 42);
    s.enemies = [
      { id: 1, kind: "drone", x: -220, y: -230 },
      { id: 2, kind: "drone", x: 270, y: 130 },
      { id: 3, kind: "runner", x: 175, y: -280 },
      { id: 4, kind: "tank", x: -290, y: 100 },
      { id: 5, kind: "swarm", x: 100, y: 230 },
      { id: 6, kind: "swarm", x: 130, y: 260 },
      { id: 7, kind: "runner", x: -100, y: 340 },
      { id: 8, kind: "drone", x: -350, y: -160 },
    ].map((e) => ({
      ...e,
      hp: 1,
      maxHp: 1,
      speed: 1,
      damage: 1,
      radius: e.kind === "tank" ? 14 : 8,
      bounty: 1,
      attackCd: 1,
      slowed: 0,
    })) as typeof s.enemies;
    s.projectiles = [
      { id: 10, x: -90, y: -93, target: 1, damage: 1, critical: false },
    ];
    s.upgrades = { orbit: 2 };
    s.time = 0.3;
    return s;
  }, []);
  if (!profile) return null;
  const cleared = Object.keys(profile.campaign).length;
  const next =
    CAMPAIGN.find((s) => !profile.campaign[s.id]) ??
    CAMPAIGN[CAMPAIGN.length - 1];
  const activeSave = saved && !isFinished(saved);
  return (
    <>
      {saved && isFinished(saved) && !saved.rewardClaimed && (
        <Link to={`/nexus/results/${saved.scenarioId}`} className="nc-continue">
          <Shield size={18} />
          <div>
            Finish syncing your run
            <small>Your completed defense has research credits waiting.</small>
          </div>
          <ArrowRight size={17} />
        </Link>
      )}
      {activeSave && (
        <Link to={`/nexus/battle/${saved.scenarioId}`} className="nc-continue">
          <Play size={18} />
          <div>
            Resume your defense
            <small>
              {getScenario(saved.scenarioId)?.title} · Wave {saved.wave || 1} ·
              Saved on this device
            </small>
          </div>
          <ArrowRight size={17} />
        </Link>
      )}
      <section className="nc-hero">
        <div className="nc-hero-copy">
          <div className="nc-hero-status">
            <i className="nc-live-dot" />
            Central core online
          </div>
          <h1>
            Hold the core.
            <br />
            <em>Defy the swarm.</em>
          </h1>
          <p>
            They come from everywhere. Build a nexus that can take it. One
            upgrade, one wave, one more chance to survive.
          </p>
          <Link to={`/nexus/loadout/${next.id}`} className="nc-button">
            {cleared ? "Continue campaign" : "Begin your defense"}
            <ArrowRight size={17} />
          </Link>
          <div className="nc-hero-meta">
            <span>360° combat</span>
            <span>•</span>
            <span>Build as you battle</span>
          </div>
        </div>
        <div className="nc-hero-visual">
          <CoreArena run={demo} scenario={ENDLESS} showcase />
        </div>
      </section>
      <div className="nc-stat-strip">
        <div>
          <strong>
            {cleared}
            <small style={{ fontSize: 14, color: "hsl(200 18% 50%)" }}>
              {" "}
              / 8
            </small>
          </strong>
          <span>Sectors secured</span>
        </div>
        <div>
          <strong>{profile.bestWave.toString().padStart(2, "0")}</strong>
          <span>Endless best wave</span>
        </div>
        <div>
          <strong>
            {Object.keys(profile.challenges).length}
            <small style={{ fontSize: 14, color: "hsl(200 18% 50%)" }}>
              {" "}
              / 4
            </small>
          </strong>
          <span>Challenges cleared</span>
        </div>
      </div>
      <div className="nc-section-label">
        Choose your front<span>Three ways to hold</span>
      </div>
      <div className="nc-mode-grid">
        <Link to="/nexus/missions" className="nc-mode-card nc-panel">
          <Crosshair size={23} />
          <h2>Campaign</h2>
          <p>
            Eight sectors. Escalating threats. Find the build that gets you
            home.
          </p>
          <footer>
            <span>
              {cleared === 8 ? "All sectors secured" : `Next: ${next.title}`}
            </span>
            <ArrowRight size={15} />
          </footer>
        </Link>
        <Link to="/nexus/loadout/endless" className="nc-mode-card nc-panel">
          <InfinityIcon size={25} />
          <h2>Endless</h2>
          <p>No finish line. Push your nexus until the swarm pushes back.</p>
          <footer>
            <span>Available from the start</span>
            <ArrowRight size={15} />
          </footer>
        </Link>
        <Link to="/nexus/challenges" className="nc-mode-card nc-panel">
          <Swords size={23} />
          <h2>Challenges</h2>
          <p>Faster enemies. Fragile cores. New rules, different decisions.</p>
          <footer>
            <span>4 distinct rulesets</span>
            <ArrowRight size={15} />
          </footer>
        </Link>
      </div>
      <Link to="/nexus/research" className="nc-lab-callout nc-panel">
        <FlaskConical size={24} />
        <div>
          <h2>A stronger core. Every run.</h2>
          <p>Spend research credits on permanent nexus upgrades.</p>
        </div>
        <ArrowRight size={18} />
      </Link>
      <nav className="nc-subnav">
        <Link to="/nexus/leaderboard">
          <Trophy size={15} />
          Club records
        </Link>
        <Link to="/nexus/codex">
          <Shield size={15} />
          Field guide
        </Link>
        {saved && isFinished(saved) && (
          <Link to={`/nexus/results/${saved.scenarioId}`}>
            Last run
            <ArrowRight size={14} />
          </Link>
        )}
      </nav>
    </>
  );
}

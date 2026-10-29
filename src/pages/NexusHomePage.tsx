import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FlaskConical, Play, Shield, Trophy } from "lucide-react";
import { useNexusCore } from "@/hooks/useNexusCore";
import { ENDLESS, getScenario } from "@/lib/nexus/core/catalog";
import { createRun, isFinished } from "@/lib/nexus/core/engine";
import { readCoreRun } from "@/lib/nexus/core/persistence";
import { CoreArena } from "@/components/nexus/core/CoreArena";
import { ARMORY, MILESTONES } from "@/lib/nexus/core/progression";
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
  const nextUnlock = ARMORY.find((a) => !profile.unlocks.includes(a.id));
  const milestone = MILESTONES.find((m) => m.wave > profile.bestWave);
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
            Start with a pulse cannon. Earn your arsenal. Build a nexus that
            holds a little longer every time you return.
          </p>
          <Link to="/nexus/loadout/endless" className="nc-button">
            Build your loadout
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
          <strong>{String(profile.bestWave).padStart(2, "0")}</strong>
          <span>Best wave</span>
        </div>
        <div>
          <strong>{profile.totalWaves}</strong>
          <span>Lifetime waves</span>
        </div>
        <div>
          <strong>
            {profile.unlocks.length}
            <small style={{ fontSize: 14 }}> / 7</small>
          </strong>
          <span>Equipment unlocked</span>
        </div>
      </div>
      <div className="nc-section-label">
        One endless defense<span>A stronger next run</span>
      </div>
      <div className="nc-endless-rules">
        <span>360° auto combat</span>
        <span>Boss every 5 waves</span>
        <span>2 auxiliary slots · 4 power</span>
        <span>1 support module</span>
      </div>
      {nextUnlock && (
        <section className="nc-panel nc-next-unlock">
          <div className="nc-eyebrow">Your next discovery</div>
          <h2>{nextUnlock.name}</h2>
          <p className="nc-note">{nextUnlock.description}</p>
          <p className="nc-note">
            {Math.min(profile.totalWaves, nextUnlock.waves)} /{" "}
            {nextUnlock.waves} lifetime waves ·{" "}
            {Math.min(profile.credits, nextUnlock.cost)} / {nextUnlock.cost}{" "}
            credits
          </p>
          <Link to="/nexus/research" className="nc-back">
            Explore the armory <ArrowRight size={15} />
          </Link>
        </section>
      )}
      {milestone && (
        <p className="nc-note">
          Next personal milestone: clear wave {milestone.wave} for +
          {milestone.credits} bonus credits. Paid once, on top of every run’s
          wave earnings.
        </p>
      )}
      <Link to="/nexus/research" className="nc-lab-callout nc-panel">
        <FlaskConical size={24} />
        <div>
          <h2>Your arsenal. Your advantage.</h2>
          <p>
            Unlock weapons and support modules, or invest in permanent core
            research.
          </p>
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

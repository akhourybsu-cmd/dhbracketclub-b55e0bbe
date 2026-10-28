import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Crosshair, Heart, Orbit, Shield, Zap } from "lucide-react";
import { CAMPAIGN, getScenario } from "@/lib/nexus/core/catalog";
import { createRun, isFinished, stats } from "@/lib/nexus/core/engine";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import { useNexusCore } from "@/hooks/useNexusCore";
import { CoreArena } from "@/components/nexus/core/CoreArena";
import { rewardBreakdown } from "@/lib/nexus/core/economy";
import {
  CoreBack,
  CoreHeading,
  CoreLink,
  CoreProfileGate,
} from "@/components/nexus/core/CoreUI";

export default function NexusLoadoutPage() {
  return (
    <CoreProfileGate>
      <Deployment />
    </CoreProfileGate>
  );
}
function Deployment() {
  const { missionId } = useParams();
  const { profile, userId, clubId, begin } = useNexusCore();
  const navigate = useNavigate();
  const scenario = getScenario(missionId);
  const [replace, setReplace] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState("");
  const deploymentId = useRef(crypto.randomUUID());
  const busy = useRef(false);
  const preview = useMemo(
    () =>
      scenario ? createRun(scenario, profile?.research, "preview", 1) : null,
    [scenario, profile?.research],
  );
  if (!profile) return null;
  if (!scenario || !preview)
    return (
      <>
        <CoreBack />
        <CoreHeading eyebrow="Unknown signal" title="Sector not found." />
        <CoreLink to="/nexus/missions">Choose a sector</CoreLink>
      </>
    );
  const locked =
    scenario.mode === "campaign" &&
    Number(scenario.id) > 1 &&
    !profile.campaign[String(Number(scenario.id) - 1)];
  const saved = readCoreRun(userId, clubId);
  const activeSave = saved && !isFinished(saved);
  const unclaimed = saved && isFinished(saved) && !saved.rewardClaimed;
  const v = stats(preview, scenario);
  const deploy = async () => {
    if (busy.current) return;
    busy.current = true;
    setDeploying(true);
    setDeployError("");
    try {
      const run = await begin(scenario, deploymentId.current);
      saveCoreRun(run, userId, clubId);
      navigate(`/nexus/battle/${scenario.id}`, { state: { freshRun: run } });
    } catch (e) {
      setDeployError(
        e instanceof Error ? e.message : "Could not deploy. Try again.",
      );
    } finally {
      busy.current = false;
      setDeploying(false);
    }
  };
  const rewards = rewardBreakdown(
    { phase: "victory", cleared: scenario.waves || 10 },
    scenario,
    profile,
  );
  return (
    <>
      <CoreBack
        to={
          scenario.mode === "campaign"
            ? "/nexus/missions"
            : scenario.mode === "challenge"
              ? "/nexus/challenges"
              : "/nexus"
        }
      />
      <div className="nc-deploy">
        <div>
          <CoreHeading eyebrow={scenario.subtitle} title={scenario.title}>
            {scenario.description}
          </CoreHeading>
          {scenario.rule && (
            <div className="nc-rule">
              {scenario.rule === "glass"
                ? "One hull point. Defensive systems disabled. Weapons deal double damage."
                : scenario.rule === "blackout"
                  ? "Hull repair and shield recharge disabled. Capacity upgrades still refill their added capacity."
                  : scenario.rule === "rush"
                    ? "Enemy movement speed increased by 60%."
                    : "Bulwarks appear from wave one. A siege engine arrives every third wave."}
            </div>
          )}
          <div className="nc-sector-info">
            <span>
              {scenario.waves ? `${scenario.waves} waves` : "Unlimited waves"}
            </span>
            <span>
              {scenario.waves
                ? `${rewards.waves} wave credits${rewards.bonus ? ` + ${rewards.bonus} first-clear bonus` : ""}`
                : "10 waves = 65 credits · higher waves earn more"}
            </span>
          </div>
          <ul className="nc-deploy-rules">
            <li>
              <Crosshair size={17} />
              Your core aims and fires automatically. Enemies attack from every
              direction.
            </li>
            <li>
              <Zap size={17} />
              Spend energy during combat to upgrade your weapons and
              fortifications.
            </li>
            <li>
              <Orbit size={17} />
              Use nova to push enemies back, or overdrive to accelerate your
              fire rate.
            </li>
          </ul>
          {locked ? (
            <div className="nc-rule">
              Clear {CAMPAIGN[Number(scenario.id) - 2].title} first.
            </div>
          ) : unclaimed ? (
            <div className="nc-panel" style={{ padding: 18 }}>
              <p className="nc-note" style={{ marginBottom: 14 }}>
                Your last run has credits waiting to sync. Save its rewards
                before starting another defense.
              </p>
              <CoreLink to={`/nexus/results/${saved.scenarioId}`}>
                Sync last run
              </CoreLink>
            </div>
          ) : activeSave && !replace ? (
            <div className="nc-panel" style={{ padding: 18 }}>
              <p className="nc-note" style={{ marginBottom: 14 }}>
                You have an unfinished run. Resume it, or replace it with this
                deployment. An unfinished run earns no credits.
              </p>
              <CoreLink to={`/nexus/battle/${saved.scenarioId}`}>
                Resume saved run
              </CoreLink>
              <button
                className="nc-back"
                style={{ display: "flex", marginTop: 8 }}
                onClick={() => setReplace(true)}
              >
                Replace saved run
              </button>
            </div>
          ) : (
            <button className="nc-button" onClick={deploy} disabled={deploying}>
              {deploying ? "Deploying…" : "Deploy nexus"}
              <ArrowRight size={17} />
            </button>
          )}
          {deployError && (
            <p className="nc-rule" role="alert">
              {deployError}. Retry deployment to reconnect.
            </p>
          )}
          <p className="nc-note" style={{ fontSize: 10, marginTop: 16 }}>
            Research and completed records sync across devices. Active runs save
            on this device.
          </p>
        </div>
        <div>
          <CoreArena run={preview} scenario={scenario} showcase />
          <div className="nc-stat-strip" style={{ marginBottom: 0 }}>
            <div>
              <strong>{v.maxHp}</strong>
              <span>
                <Heart size={10} className="inline" /> Hull
              </span>
            </div>
            <div>
              <strong>{v.maxShield}</strong>
              <span>
                <Shield size={10} className="inline" /> Shield
              </span>
            </div>
            <div>
              <strong>{preview.energy}</strong>
              <span>
                <Zap size={10} className="inline" /> Energy
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

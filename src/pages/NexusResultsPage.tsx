import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Orbit, Shield, ShieldOff } from "lucide-react";
import { useNexusCore } from "@/hooks/useNexusCore";
import { CAMPAIGN, getScenario } from "@/lib/nexus/core/catalog";
import { isFinished, runReward, runStars } from "@/lib/nexus/core/engine";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import type { CoreRun } from "@/lib/nexus/core/types";
import { rewardBreakdown } from "@/lib/nexus/core/economy";
import { WEAPON_IDS, WEAPON_NAMES } from "@/lib/nexus/core/systems";
import { useNavigate } from "react-router-dom";
import { clearCoreRun } from "@/lib/nexus/core/persistence";
import {
  CoreBack,
  CoreLink,
  CoreProfileGate,
  CoreSaved,
  CoreStars,
} from "@/components/nexus/core/CoreUI";

export default function NexusResultsPage() {
  return (
    <CoreProfileGate>
      <Debrief />
    </CoreProfileGate>
  );
}
function Debrief() {
  const { missionId } = useParams();
  const { userId, clubId, finish, profile } = useNexusCore();
  const navigate = useNavigate();
  const location = useLocation();
  const [run] = useState(
    () =>
      (location.state as { completedRun?: CoreRun } | null)?.completedRun ??
      readCoreRun(userId, clubId),
  );
  const [sync, setSync] = useState<"saving" | "saved" | "error">("saving");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [award, setAward] = useState<{
    reward: number;
    stars: number;
    waves: number;
    bonus: number;
  } | null>(null);
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const valid =
    run && run.scenarioId === getScenario(missionId)?.id && isFinished(run);
  useEffect(() => {
    if (!valid) return;
    let active = true;
    setSync("saving");
    finishRef
      .current(run)
      .then((result) => {
        if (readCoreRun(userId, clubId)?.id === run.id)
          saveCoreRun({ ...run, rewardClaimed: true }, userId, clubId);
        if (active) {
          setAward(result);
          setSync("saved");
        }
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Connection interrupted");
          setSync("error");
        }
      });
    return () => {
      active = false;
    };
  }, [valid, run, attempt, userId, clubId]);
  if (!valid)
    return (
      <>
        <CoreBack />
        <div className="nc-empty">
          <Shield size={32} />
          <h2>No completed run on this device.</h2>
          <p>Start a defense to build your next record.</p>
          <CoreLink to="/nexus">Command center</CoreLink>
        </div>
      </>
    );
  const scenario = getScenario(run.scenarioId)!;
  const won = run.phase === "victory";
  const stars = award?.stars ?? runStars(run, scenario);
  const breakdown = rewardBreakdown(run, scenario, profile);
  const reward = award?.reward ?? breakdown.total;
  const next =
    scenario.mode === "campaign"
      ? CAMPAIGN.find((s) => Number(s.id) === Number(scenario.id) + 1)
      : null;
  return (
    <>
      <CoreBack />
      <div className="nc-result">
        <div className="nc-result-seal">
          {won ? <Shield size={38} /> : <ShieldOff size={38} />}
        </div>
        <div className="nc-eyebrow" style={{ justifyContent: "center" }}>
          {scenario.subtitle} / After action
        </div>
        <h1>
          {won
            ? "The core holds."
            : scenario.mode === "endless"
              ? "Every wave earned."
              : "Rebuild. Return."}
        </h1>
        <p>
          {scenario.title} ·{" "}
          {won
            ? "Perimeter secured."
            : "The nexus fell. Your research carries on."}
        </p>
        {won && <CoreStars count={stars} />}
        <div className="nc-result-grid">
          <div className="nc-panel">
            <strong>{run.cleared}</strong>
            <span>Waves cleared</span>
          </div>
          <div className="nc-panel">
            <strong>{run.kills}</strong>
            <span>Enemies neutralized</span>
          </div>
          <div className="nc-panel">
            <strong>{run.score.toLocaleString()}</strong>
            <span>Score</span>
          </div>
        </div>
        <div className="nc-reward">
          <Orbit size={18} />
          <strong>+{reward}</strong> research credits
        </div>
        <p className="nc-note">
          {award?.waves ?? breakdown.waves} wave credits
          {(award?.bonus ?? breakdown.bonus) > 0
            ? ` + ${award?.bonus ?? breakdown.bonus} first-clear bonus`
            : ""}
        </p>
        {sync === "saved" ? (
          <CoreSaved text="Credits and record synced" />
        ) : sync === "saving" ? (
          <p className="nc-note" role="status">
            Syncing your run…
          </p>
        ) : (
          <div className="nc-rule" role="alert">
            {error}. Your run is saved on this device.
            <br />
            <button
              className="nc-back"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry sync →
            </button>
            {/Deploy your nexus before|Deployment already closed|no legacy checkpoint/.test(
              error,
            ) && (
              <button
                className="nc-back"
                onClick={() => {
                  clearCoreRun(userId, clubId);
                  navigate("/nexus");
                }}
              >
                Discard this unsaved record →
              </button>
            )}
          </div>
        )}
        <div className="nc-result-actions">
          {sync === "saved" &&
            (next && won ? (
              <CoreLink to={`/nexus/loadout/${next.id}`}>
                Next sector: {next.title}
              </CoreLink>
            ) : (
              <CoreLink to={`/nexus/loadout/${scenario.id}`}>
                Deploy again
              </CoreLink>
            ))}
          <CoreLink to="/nexus/research" secondary>
            Upgrade in the core lab
          </CoreLink>
        </div>
        {run.metrics && (
          <section className="nc-panel nc-run-metrics">
            <h2>Build performance</h2>
            <div className="nc-damage-list">
              {WEAPON_IDS.filter((id) => run.metrics!.damage[id] > 0).map(
                (id) => (
                  <div key={id}>
                    <div>
                      <strong>{WEAPON_NAMES[id]}</strong>
                      <span>
                        {Math.round(run.metrics!.damage[id]).toLocaleString()}{" "}
                        damage · {run.metrics!.kills[id]} kills
                      </span>
                    </div>
                    <i
                      style={{
                        width: `${(run.metrics!.damage[id] / Math.max(1, ...Object.values(run.metrics!.damage))) * 100}%`,
                      }}
                    />
                  </div>
                ),
              )}
            </div>
            <p className="nc-note">
              Energy supplied {run.metrics.energyEarned} · Spent{" "}
              {run.metrics.energySpent} · Unspent {run.energy}
            </p>
          </section>
        )}
        <p className="nc-note">
          {Math.floor(run.time / 60)}m {Math.floor(run.time % 60)}s survived ·
          In-battle upgrades reset for your next deployment.
        </p>
      </div>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { BarChart3, ChevronRight, Orbit, Play, Shield } from "lucide-react";
import { useNexusCore } from "@/hooks/useNexusCore";
import { ENDLESS, getScenario } from "@/lib/nexus/core/catalog";
import { isFinished, runStars } from "@/lib/nexus/core/engine";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import type { CoreRun } from "@/lib/nexus/core/types";
import { ARMORY } from "@/lib/nexus/core/progression";
import { rewardBreakdown } from "@/lib/nexus/core/economy";
import { CoreMenuActions } from "@/components/nexus/core/CoreMenuActions";
import { CoreCounter } from "@/components/nexus/core/CoreMotion";
import {
  CoreSigil,
  CoreEquipmentArt,
} from "@/components/nexus/core/CoreArtwork";
import { CoreDetails } from "@/components/nexus/core/CoreDetails";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { WEAPON_IDS, WEAPON_NAMES } from "@/lib/nexus/core/systems";
import { useNavigate } from "react-router-dom";
import { clearCoreRun } from "@/lib/nexus/core/persistence";
import {
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
  const { userId, clubId, finish, profile, begin } = useNexusCore();
  const replayId = useRef(crypto.randomUUID());
  const replayBusy = useRef(false);
  const previousBest = useRef(profile?.bestWave || 0);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState("");
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
  const [panel, setPanel] = useState<"details" | "unlock" | null>(null);
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
  const nextUnlock = ARMORY.find((a) => !profile?.unlocks.includes(a.id));
  const replay = async () => {
    if (replayBusy.current || sync !== "saved") return;
    replayBusy.current = true;
    setPlaying(true);
    setPlayError("");
    try {
      const next = await begin(ENDLESS, replayId.current, profile!.loadout);
      saveCoreRun(next, userId, clubId);
      navigate("/nexus/battle/endless", {
        state: { freshRun: next, autoStart: true },
      });
    } catch (e) {
      setPlayError(
        e instanceof Error ? e.message : "Connection lost. Try again.",
      );
    } finally {
      replayBusy.current = false;
      setPlaying(false);
    }
  };
  return (
    <section className="nc-deck-screen nc-result-screen">
      <div className="nc-result-hero">
        <CoreSigil loadout={run.loadout} />
        <div className="nc-result-heading">
          <h1>{run.retired || won ? "RUN COMPLETE" : "CORE LOST"}</h1>
          <div className="nc-result-wave">
            <CoreCounter value={run.cleared} digits={2} fromZero />
          </div>
          <p className="nc-wave-caption">
            WAVES CLEARED
            {run.cleared > previousBest.current ? " · NEW BEST" : ""}
          </p>
        </div>
      </div>
      {won && <CoreStars count={stars} />}
      <div className="nc-result-grid">
        <div className="nc-panel">
          <strong>
            <CoreCounter value={run.kills} fromZero />
          </strong>
          <span>Kills</span>
        </div>
        <div className="nc-panel">
          <strong>
            <CoreCounter value={run.score} fromZero />
          </strong>
          <span>Score</span>
        </div>
        <div className="nc-panel">
          <strong>
            {Math.floor(run.time / 60)}:
            {String(Math.floor(run.time % 60)).padStart(2, "0")}
          </strong>
          <span>Survived</span>
        </div>
      </div>
      {sync === "saved" && reward > 0 && (
        <div className="nc-result-celebration" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ "--nc-i": i } as React.CSSProperties} />
          ))}
        </div>
      )}
      <div className="nc-reward">
        <Orbit size={21} />
        <strong>
          +<CoreCounter value={reward} fromZero />
        </strong>
        <span>CREDITS</span>
      </div>
      <p className="nc-menu-note">
        {award?.waves ?? breakdown.waves} waves
        {(award?.bonus ?? breakdown.bonus) > 0
          ? ` + ${award?.bonus ?? breakdown.bonus} milestone bonus`
          : ""}
      </p>
      {sync === "saved" ? (
        <CoreSaved text="Rewards saved" />
      ) : sync === "saving" ? (
        <p className="nc-menu-note" role="status">
          Saving rewards…
        </p>
      ) : (
        <div className="nc-rule" role="alert">
          {error}. Run saved on this device.
          <button className="nc-back" onClick={() => setAttempt((n) => n + 1)}>
            Retry sync
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
              Discard record
            </button>
          )}
        </div>
      )}
      <div className="nc-result-inspect">
        {nextUnlock && (
          <button
            className="nc-next-system"
            onClick={() => setPanel("unlock")}
            aria-label={`Next unlock: ${nextUnlock.name}`}
          >
            <CoreEquipmentArt id={nextUnlock.id} />
            <span>
              <small>NEXT UNLOCK</small>
              <strong>{nextUnlock.name}</strong>
            </span>
            <ChevronRight size={15} />
          </button>
        )}
        {run.metrics && (
          <button
            className="nc-next-system"
            onClick={() => setPanel("details")}
          >
            <BarChart3 size={20} />
            <span>Run details</span>
            <ChevronRight size={15} />
          </button>
        )}
      </div>
      <CoreDetails
        item={panel === "unlock" && nextUnlock ? nextUnlock : null}
        onClose={() => setPanel(null)}
      >
        {nextUnlock && (
          <div className="nc-next-unlock">
            <progress
              aria-label={`${nextUnlock.name} credit progress`}
              value={Math.min(profile?.credits || 0, nextUnlock.cost)}
              max={nextUnlock.cost}
            />
            <p className="nc-menu-note">
              {Math.min(profile?.credits || 0, nextUnlock.cost)}/
              {nextUnlock.cost} credits ·{" "}
              {Math.min(profile?.totalWaves || 0, nextUnlock.waves)}/
              {nextUnlock.waves} lifetime waves
            </p>
          </div>
        )}
      </CoreDetails>
      <CoreMenuActions
        label="Result actions"
        notice={playError ? <span role="alert">{playError}</span> : undefined}
      >
        <button
          className="nc-button"
          disabled={sync !== "saved" || playing}
          onClick={replay}
        >
          <Play size={17} />
          {playing ? "CONNECTING…" : "PLAY AGAIN"}
        </button>
        <CoreLink to="/nexus/loadout/endless" secondary>
          Loadout
        </CoreLink>
      </CoreMenuActions>
      {run.metrics && (
        <Dialog
          open={panel === "details"}
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
        >
          <DialogContent className="nx-mode nc-shell nc-menu-dialog">
            <DialogTitle>Run details</DialogTitle>
            <DialogDescription>Weapon output & energy</DialogDescription>
            <section className="nc-dialog-scroll nc-run-metrics">
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
              <p className="nc-menu-note">
                Energy {run.metrics.energyEarned} · Spent{" "}
                {run.metrics.energySpent} · Remaining {run.energy}
              </p>
            </section>
            <button className="nc-button" onClick={() => setPanel(null)}>
              Done
            </button>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

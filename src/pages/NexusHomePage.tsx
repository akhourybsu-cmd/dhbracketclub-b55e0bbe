import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crosshair, FlaskConical, Play, Trophy } from "lucide-react";
import { useNexusCore } from "@/hooks/useNexusCore";
import { ENDLESS } from "@/lib/nexus/core/catalog";
import { isFinished } from "@/lib/nexus/core/engine";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import { CoreObjectiveStrip } from "@/components/nexus/core/CoreCareer";
import { CoreProfileGate } from "@/components/nexus/core/CoreUI";
import { CoreSigil } from "@/components/nexus/core/CoreArtwork";
export default function NexusHomePage() {
  return (
    <CoreProfileGate>
      <TitleScreen />
    </CoreProfileGate>
  );
}
function TitleScreen() {
  const { profile, userId, clubId, begin } = useNexusCore();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const deploymentId = useRef(crypto.randomUUID()),
    busy = useRef(false);
  const saved = readCoreRun(userId, clubId),
    active = saved && !isFinished(saved),
    unclaimed = saved && isFinished(saved) && !saved.rewardClaimed;
  if (!profile) return null;
  const play = async () => {
    if (busy.current) return;
    if (unclaimed) {
      navigate(`/nexus/results/${saved.scenarioId}`);
      return;
    }
    if (active) {
      navigate(`/nexus/battle/${saved.scenarioId}`);
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const run = await begin(ENDLESS, deploymentId.current, profile.loadout);
      saveCoreRun(run, userId, clubId);
      navigate("/nexus/battle/endless", {
        state: { freshRun: run, autoStart: true },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection lost. Try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <section className="nc-title-screen">
      <div className="nc-title-wordmark">
        <span className="nc-title-kicker">ENDLESS SURVIVAL</span>
        <h1>
          NEXUS<span>DEFENSE</span>
        </h1>
      </div>
      <div className="nc-title-visual">
        <CoreSigil loadout={profile.loadout} />
        <div className="nc-title-record">
          <Trophy size={13} />
          <span>BEST WAVE</span>
          <strong>{String(profile.bestWave).padStart(2, "0")}</strong>
        </div>
      </div>
      <div className="nc-title-actions">
        <Link to="/nexus/loadout/endless" className="nc-title-build">
          <Crosshair size={16} />
          <span>LOADOUT</span>
          <strong>
            Pulse
            {profile.loadout.weapons.length
              ? ` + ${profile.loadout.weapons.length}`
              : " cannon"}
          </strong>
          <span>EDIT →</span>
        </Link>
        <button
          className="nc-button nc-play-button"
          onClick={play}
          disabled={pending}
        >
          <Play size={22} fill="currentColor" />
          {pending
            ? "CONNECTING…"
            : unclaimed
              ? "COLLECT REWARDS"
              : active
                ? "RESUME"
                : "PLAY"}
          {active && <small>WAVE {saved.wave || 1}</small>}
        </button>
        {error && (
          <p role="alert" className="nc-title-error">
            {error}
          </p>
        )}
        <div className="nc-title-links">
          <Link to="/nexus/research">
            <Crosshair size={20} />
            <span>ARSENAL</span>
          </Link>
          <Link to="/nexus/research?tab=research">
            <FlaskConical size={20} />
            <span>RESEARCH</span>
          </Link>
          <Link to="/nexus/leaderboard">
            <Trophy size={20} />
            <span>RECORDS</span>
          </Link>
        </div>
        <CoreObjectiveStrip profile={profile} />
      </div>
    </section>
  );
}

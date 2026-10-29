import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Heart, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { ENDLESS } from "@/lib/nexus/core/catalog";
import { createRun, isFinished, stats } from "@/lib/nexus/core/engine";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import { useNexusCore } from "@/hooks/useNexusCore";
import { CoreLoadoutEditor } from "@/components/nexus/core/CoreLoadoutEditor";
import { CoreMenuActions } from "@/components/nexus/core/CoreMenuActions";
import {
  CoreHeading,
  CoreLink,
  CoreProfileGate,
} from "@/components/nexus/core/CoreUI";
import { loadoutError } from "@/lib/nexus/core/progression";
import type { CoreLoadout } from "@/lib/nexus/core/types";

export default function NexusLoadoutPage() {
  const { missionId } = useParams();
  if (missionId !== "endless")
    return <Navigate to="/nexus/loadout/endless" replace />;
  return (
    <CoreProfileGate>
      <Deployment />
    </CoreProfileGate>
  );
}
function Deployment() {
  const { profile, userId, clubId, begin, saveLoadout } = useNexusCore();
  const navigate = useNavigate();
  const [loadout, setLoadout] = useState<CoreLoadout>(() => profile!.loadout);
  const [replace, setReplace] = useState(false);
  const [pending, setPending] = useState<"save" | "deploy" | null>(null);
  const [error, setError] = useState("");
  const deploymentId = useRef(crypto.randomUUID());
  const busy = useRef(false);
  const preview = useMemo(
    () => createRun(ENDLESS, profile?.research, "preview", 1, loadout),
    [profile?.research, loadout],
  );
  if (!profile) return null;
  const saved = readCoreRun(userId, clubId),
    active = saved && !isFinished(saved),
    unclaimed = saved && isFinished(saved) && !saved.rewardClaimed;
  const v = stats(preview, ENDLESS);
  const act = async (action: "save" | "deploy") => {
    if (busy.current) return;
    busy.current = true;
    setPending(action);
    setError("");
    try {
      if (action === "save") {
        await saveLoadout(loadout);
        toast.success("Loadout saved");
      } else {
        const run = await begin(ENDLESS, deploymentId.current, loadout);
        saveCoreRun(run, userId, clubId);
        navigate("/nexus/battle/endless", {
          state: { freshRun: run, autoStart: true },
        });
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Connection interrupted. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <>
      <CoreHeading eyebrow="PREPARE YOUR CORE" title="Loadout">
        2 hardpoints · 4 power · 1 support
      </CoreHeading>
      <CoreLoadoutEditor
        profile={profile}
        value={loadout}
        onChange={setLoadout}
        disabled={!!pending}
      />
      <div className="nc-mini-stats">
        <span>
          <Heart size={13} />
          {v.maxHp}
        </span>
        <span>
          <Shield size={13} />
          {v.maxShield}
        </span>
        <span>
          <Zap size={13} />
          {preview.energy}
        </span>
      </div>
      {unclaimed ? (
        <div className="nc-run-notice">
          <p className="nc-note">Rewards waiting.</p>
          <CoreLink to={`/nexus/results/${saved.scenarioId}`}>
            Collect rewards
          </CoreLink>
        </div>
      ) : active && !replace ? (
        <div className="nc-run-notice">
          <p className="nc-note">
            Wave {saved.wave || 1} saved. A new run replaces this defense.
          </p>
          <CoreLink to={`/nexus/battle/${saved.scenarioId}`}>Resume</CoreLink>
          <button className="nc-back" onClick={() => setReplace(true)}>
            New run
          </button>
        </div>
      ) : null}
      {error && (
        <p className="nc-rule" role="alert">
          {error}
        </p>
      )}
      <CoreMenuActions>
        <button
          className="nc-button nc-button-secondary"
          aria-label="Save loadout"
          disabled={!!pending || !!loadoutError(loadout, profile.unlocks)}
          onClick={() => act("save")}
        >
          {pending === "save" ? "Saving…" : "Save"}
        </button>
        {!unclaimed && (!active || replace) && (
          <button
            className="nc-button"
            disabled={!!pending || !!loadoutError(loadout, profile.unlocks)}
            onClick={() => act("deploy")}
          >
            {pending === "deploy" ? "Deploying…" : "Deploy"}
            <ArrowRight size={17} />
          </button>
        )}
      </CoreMenuActions>
    </>
  );
}

import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Heart, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { ENDLESS } from "@/lib/nexus/core/catalog";
import { createRun, isFinished, stats } from "@/lib/nexus/core/engine";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import { useNexusCore } from "@/hooks/useNexusCore";
import { CoreLoadoutEditor } from "@/components/nexus/core/CoreLoadoutEditor";
import {
  CoreBack,
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
        toast.success("Loadout synced. Ready for your next defense.");
      } else {
        const run = await begin(ENDLESS, deploymentId.current, loadout);
        saveCoreRun(run, userId, clubId);
        navigate("/nexus/battle/endless", { state: { freshRun: run } });
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
      <CoreBack />
      <CoreHeading eyebrow="Endless / deployment" title="Build your defense.">
        Your pulse cannon is always ready. Choose up to two auxiliary weapons
        within 4 power, plus one support module. Every weapon you bring starts
        online.
      </CoreHeading>
      <div className="nc-endless-rules">
        <span>Unlimited waves</span>
        <span>Boss every 5 waves</span>
        <span>Difficulty increases every wave</span>
      </div>
      <CoreLoadoutEditor
        profile={profile}
        value={loadout}
        onChange={setLoadout}
        disabled={!!pending}
      />
      <div className="nc-stat-strip">
        <div>
          <strong>{v.maxHp}</strong>
          <span>
            <Heart size={10} className="inline" /> Starting hull
          </span>
        </div>
        <div>
          <strong>{v.maxShield}</strong>
          <span>
            <Shield size={10} className="inline" /> Starting barrier
          </span>
        </div>
        <div>
          <strong>{preview.energy}</strong>
          <span>
            <Zap size={10} className="inline" /> Starting energy
          </span>
        </div>
      </div>
      {unclaimed ? (
        <div className="nc-panel" style={{ padding: 18 }}>
          <p className="nc-note">
            Sync your completed run before deploying again.
          </p>
          <CoreLink to={`/nexus/results/${saved.scenarioId}`}>
            Sync last run
          </CoreLink>
        </div>
      ) : active && !replace ? (
        <div className="nc-panel" style={{ padding: 18 }}>
          <p className="nc-note">
            A defense is saved on this device. Replacing it forfeits its
            unclaimed earnings.
          </p>
          <CoreLink to={`/nexus/battle/${saved.scenarioId}`}>
            Resume saved run
          </CoreLink>
          <button className="nc-back" onClick={() => setReplace(true)}>
            Replace saved run
          </button>
        </div>
      ) : null}
      {error && (
        <p className="nc-rule" role="alert">
          {error}
        </p>
      )}
      <div className="nc-deploy-actions">
        <button
          className="nc-button nc-button-secondary"
          disabled={!!pending || !!loadoutError(loadout, profile.unlocks)}
          onClick={() => act("save")}
        >
          {pending === "save" ? "Saving…" : "Save loadout"}
        </button>
        {!unclaimed && (!active || replace) && (
          <button
            className="nc-button"
            disabled={!!pending || !!loadoutError(loadout, profile.unlocks)}
            onClick={() => act("deploy")}
          >
            {pending === "deploy" ? "Deploying…" : "Deploy nexus"}
            <ArrowRight size={17} />
          </button>
        )}
      </div>
      <p className="nc-note">
        Weapons, modules, credits and research sync to your account. Battle
        energy and upgrades reset each run. Active defenses save on this device.
      </p>
    </>
  );
}

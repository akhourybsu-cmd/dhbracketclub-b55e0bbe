import { useCoreFeedback } from "@/hooks/useCoreFeedback";
import { useMemo, useRef, useState } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowRight, Heart, RotateCcw, Shield, Zap } from "lucide-react";
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
import { useNexusThreat } from "@/hooks/useNexusThreat";
import { CoreThreatControl } from "@/components/nexus/core/CoreThreatControl";

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
  const { threat, choose } = useNexusThreat(
    userId,
    clubId,
    profile?.totalWaves || 0,
  );
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loadout, setLoadout] = useState<CoreLoadout>(() => profile!.loadout);
  const [replace, setReplace] = useState(false);
  const [pending, setPending] = useState<"save" | "deploy" | null>(null);
  const [error, setError] = useState("");
  const deploymentId = useRef(crypto.randomUUID());
  const busy = useRef(false);
  const { feedback, trigger } = useCoreFeedback();
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
        trigger("LOADOUT SAVED");
      } else {
        const run = await begin(
          ENDLESS,
          deploymentId.current,
          loadout,
          threat.id,
        );
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
    <section className="nc-deck-screen nc-deployment-screen">
      <div className="nc-threat-heading">
        <CoreHeading eyebrow="PREPARE YOUR CORE" title="Loadout" />
        <CoreThreatControl
          value={threat.id}
          waves={profile.totalWaves}
          disabled={!!pending}
          onChange={(id) => {
            choose(id);
            deploymentId.current = crypto.randomUUID();
          }}
        />
      </div>
      <CoreLoadoutEditor
        profile={profile}
        value={loadout}
        onChange={setLoadout}
        disabled={!!pending}
        focusId={params.get("item")}
        feedback={feedback}
        onFeedback={trigger}
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
      <CoreMenuActions
        notice={
          error ? (
            <span role="alert">{error}</span>
          ) : unclaimed ? (
            "Rewards waiting"
          ) : active ? (
            replace ? (
              `New run replaces saved wave ${saved.wave || 1}`
            ) : (
              `Wave ${saved.wave || 1} saved`
            )
          ) : undefined
        }
      >
        <button
          className="nc-button nc-button-secondary"
          aria-label="Save loadout"
          disabled={!!pending || !!loadoutError(loadout, profile.unlocks)}
          onClick={() => act("save")}
        >
          {pending === "save" ? "Saving…" : "Save"}
        </button>
        {unclaimed ? (
          <CoreLink to={`/nexus/results/${saved.scenarioId}`}>
            Collect rewards
          </CoreLink>
        ) : active && !replace ? (
          <>
            <CoreLink to={`/nexus/battle/${saved.scenarioId}`}>Resume</CoreLink>
            <button
              className="nc-icon-button"
              aria-label="New run"
              onClick={() => setReplace(true)}
            >
              <RotateCcw size={17} />
            </button>
          </>
        ) : null}
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
    </section>
  );
}

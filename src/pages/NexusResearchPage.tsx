import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Orbit } from "lucide-react";
import { toast } from "sonner";
import { RESEARCH } from "@/lib/nexus/core/catalog";
import { ARMORY, MILESTONES } from "@/lib/nexus/core/progression";
import type { ResearchId, UnlockId } from "@/lib/nexus/core/types";
import { useNexusCore, useNexusLedger } from "@/hooks/useNexusCore";
import { researchCost } from "@/lib/nexus/core/systems";
import {
  CoreBack,
  CoreHeading,
  CoreIcon,
  CoreProfileGate,
} from "@/components/nexus/core/CoreUI";

export default function NexusResearchPage() {
  return (
    <CoreProfileGate>
      <Lab />
    </CoreProfileGate>
  );
}
function Lab() {
  const { profile, research, unlock } = useNexusCore();
  const ledger = useNexusLedger();
  const [tab, setTab] = useState<"armory" | "research">("armory");
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  if (!profile) return null;
  const buy = async (id: ResearchId | UnlockId, equipment = false) => {
    if (busy.current) return;
    busy.current = true;
    setPending(id);
    try {
      if (equipment) await unlock(id as UnlockId);
      else await research(id as ResearchId);
      toast.success(
        equipment
          ? "Equipment unlocked. Add it to your loadout."
          : "Research installed. Applies to your next run.",
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Purchase could not be saved. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <>
      <CoreBack />
      <CoreHeading
        eyebrow="Armory / permanent progression"
        title="Earn your arsenal."
      >
        Every cleared wave pays credits and counts toward equipment access. Save
        for a new weapon or build up your core. Unlocks and research are
        permanent; equip your discoveries before deploying.
      </CoreHeading>
      <div className="nc-section-label">
        {profile.totalWaves} lifetime waves
        <span className="nc-wallet">
          <Orbit size={14} />
          {profile.credits.toLocaleString()} credits
        </span>
      </div>
      <Link
        to="/nexus/loadout/endless"
        className="nc-button nc-button-secondary"
      >
        Configure loadout →
      </Link>
      <div className="nc-section-label">
        Personal milestones<span>One-time wave bonuses</span>
      </div>
      <div className="nc-milestone-strip" aria-label="Wave milestones">
        {MILESTONES.map((m) => (
          <div
            key={m.wave}
            className="nc-milestone"
            data-complete={profile.bestWave >= m.wave}
          >
            <span>WAVE {m.wave}</span>
            <strong>+{m.credits}</strong>
            <span>bonus credits</span>
            <small>
              {profile.bestWave >= m.wave ? "Claimed" : "Clear in one run"}
            </small>
          </div>
        ))}
      </div>
      <div
        className="nc-tabs nc-lab-tabs"
        role="tablist"
        aria-label="Laboratory section"
      >
        {(["armory", "research"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`lab-${t}`}
            id={`lab-tab-${t}`}
            onClick={() => setTab(t)}
          >
            {t === "armory" ? "Weapons & modules" : "Core research"}
          </button>
        ))}
      </div>
      {tab === "armory" ? (
        <div
          className="nc-armory-grid"
          role="tabpanel"
          id="lab-armory"
          aria-labelledby="lab-tab-armory"
        >
          {ARMORY.map((a) => {
            const owned = profile.unlocks.includes(a.id),
              eligible = profile.totalWaves >= a.waves;
            return (
              <section
                className="nc-equipment nc-panel"
                data-owned={owned}
                key={a.id}
              >
                <CoreIcon name={a.icon} size={26} />
                <span className="nc-equipment-role">
                  {a.kind === "weapon"
                    ? `${a.role} · ${a.power} power`
                    : `Support · ${a.role}`}
                </span>
                <strong>{a.name}</strong>
                <p>{a.description}</p>
                <small>{a.tradeoff}</small>
                <small>
                  {owned
                    ? "Permanently unlocked"
                    : `${Math.min(profile.totalWaves, a.waves)} / ${a.waves} lifetime waves · ${a.cost} credits`}
                </small>
                <button
                  className="nc-button nc-button-secondary"
                  aria-label={`Unlock ${a.name}`}
                  disabled={
                    owned || !!pending || !eligible || profile.credits < a.cost
                  }
                  onClick={() => buy(a.id, true)}
                >
                  {pending === a.id
                    ? "Unlocking…"
                    : owned
                      ? "Unlocked"
                      : !eligible
                        ? `${a.waves - profile.totalWaves} more lifetime waves`
                        : `Unlock · ${a.cost} credits`}
                </button>
              </section>
            );
          })}
        </div>
      ) : (
        <div
          className="nc-research-grid"
          role="tabpanel"
          id="lab-research"
          aria-labelledby="lab-tab-research"
        >
          {RESEARCH.map((r) => {
            const level = profile.research[r.id] || 0,
              price = researchCost(r.id, level);
            return (
              <section className="nc-panel nc-research" key={r.id}>
                <CoreIcon name={r.icon} size={26} />
                <h2>{r.name}</h2>
                <p>{r.description}</p>
                <div className="nc-research-level">
                  LEVEL {level} / {r.max}
                </div>
                <div className="nc-level-bar">
                  {Array.from({ length: r.max }, (_, i) => (
                    <i key={i} data-active={i < level} />
                  ))}
                </div>
                <button
                  className="nc-button nc-button-secondary"
                  aria-label={`Research ${r.name}`}
                  disabled={
                    level >= r.max || !!pending || profile.credits < price
                  }
                  onClick={() => buy(r.id)}
                >
                  {pending === r.id ? (
                    "Installing…"
                  ) : level >= r.max ? (
                    "Fully researched"
                  ) : (
                    <>
                      <Orbit size={14} />
                      {price} credits
                    </>
                  )}
                </button>
              </section>
            );
          })}
        </div>
      )}
      <p className="nc-note" style={{ marginTop: 22 }}>
        Credits are earned when a run ends. Energy is for battle upgrades and
        resets afterward. Zero-wave runs pay nothing. Milestones pay once;
        repeat runs still pay wave credits.
      </p>
      <details className="nc-history">
        <summary>Credit history · Latest 12 transactions</summary>
        <div className="nc-panel" aria-label="Credit history">
          {ledger.isPending ? (
            <p className="nc-note" style={{ padding: 18 }}>
              Loading transactions…
            </p>
          ) : ledger.isError ? (
            <div style={{ padding: 18 }}>
              <p className="nc-note">Credit history is unavailable.</p>
              <button className="nc-back" onClick={() => ledger.refetch()}>
                Retry history →
              </button>
            </div>
          ) : !ledger.data?.length ? (
            <p className="nc-note" style={{ padding: 18 }}>
              Equipment purchases, research and run earnings will appear here.
            </p>
          ) : (
            ledger.data.map((e) => (
              <div className="nc-record-row" key={e.id}>
                <div className="nc-record-name">
                  {e.kind === "research"
                    ? `${RESEARCH.find((r) => r.id === e.details.track)?.name || "Research"} · Level ${e.details.level}`
                    : e.kind === "unlock"
                      ? `Unlocked · ${ARMORY.find((a) => a.id === e.details.item)?.name || e.details.item}`
                      : "Run earnings · Endless"}
                  <small>
                    {e.details.milestones
                      ? `Includes ${e.details.milestones} milestone credits · `
                      : ""}
                    {new Date(e.created_at).toLocaleDateString()} · Balance{" "}
                    {e.balance}
                  </small>
                </div>
                <span
                  className={`nc-credit-delta ${e.delta > 0 ? "nc-credit-earned" : ""}`}
                >
                  {e.delta > 0 ? "+" : ""}
                  {e.delta}
                </span>
              </div>
            ))
          )}
        </div>
      </details>
    </>
  );
}

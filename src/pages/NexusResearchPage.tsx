import { useRef, useState } from "react";
import { Orbit } from "lucide-react";
import { toast } from "sonner";
import { RESEARCH } from "@/lib/nexus/core/catalog";
import type { ResearchId } from "@/lib/nexus/core/types";
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
  const { profile, research } = useNexusCore();
  const ledger = useNexusLedger();
  const [pending, setPending] = useState<ResearchId | null>(null);
  const busy = useRef(false);
  if (!profile) return null;
  const buy = async (id: ResearchId) => {
    if (busy.current) return;
    busy.current = true;
    setPending(id);
    try {
      await research(id);
      toast.success("Research installed. Applies to your next run.");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Research could not be saved. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <>
      <CoreBack />
      <CoreHeading eyebrow="Core laboratory" title="Built to last.">
        Cleared waves earn research credits. Invest in a stronger starting core.
        Research is permanent and applies when you begin a new run.
      </CoreHeading>
      <div className="nc-section-label">
        Permanent systems
        <span className="nc-wallet">
          <Orbit size={14} />
          {profile.credits.toLocaleString()} credits
        </span>
      </div>
      <div className="nc-research-grid">
        {RESEARCH.map((r) => {
          const level = profile.research[r.id] || 0;
          const price = researchCost(r.id, level);
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
      <p className="nc-note" style={{ marginTop: 22 }}>
        Energy buys upgrades during battle and resets each run. Research credits
        stay in your account. Clear a sector or challenge for its first-clear
        bonus; replays still earn wave credits. A run with no cleared waves
        earns no credits.
      </p>
      <div className="nc-section-label">
        Credit history<span>Latest 12 transactions</span>
      </div>
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
            New research purchases and run earnings will appear here.
          </p>
        ) : (
          ledger.data.map((entry) => (
            <div className="nc-record-row" key={entry.id}>
              <div className="nc-record-name">
                {entry.kind === "research"
                  ? `${RESEARCH.find((r) => r.id === entry.details.track)?.name || "Research"} · Level ${entry.details.level}`
                  : `Run earnings · ${entry.details.scenario === "endless" ? "Endless" : entry.details.scenario}`}
                <small>
                  {entry.kind === "run" && !!entry.details.first_clear
                    ? "Includes first-clear bonus · "
                    : ""}
                  {new Date(entry.created_at).toLocaleDateString()} · Balance{" "}
                  {entry.balance}
                </small>
              </div>
              <span
                className={`nc-credit-delta ${entry.delta > 0 ? "nc-credit-earned" : ""}`}
              >
                {entry.delta > 0 ? "+" : ""}
                {entry.delta}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

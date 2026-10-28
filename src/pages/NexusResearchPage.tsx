import { useRef, useState } from "react";
import { Orbit } from "lucide-react";
import { toast } from "sonner";
import { RESEARCH } from "@/lib/nexus/core/catalog";
import type { ResearchId } from "@/lib/nexus/core/types";
import { useNexusCore } from "@/hooks/useNexusCore";
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
        Every run earns research credits. Invest in a stronger starting core.
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
          const price = Math.round(r.cost * 1.5 ** level);
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
        Earn 6 credits per cleared wave and a bonus for completing a sector or
        challenge. In-battle energy upgrades reset each run; these upgrades stay
        with you.
      </p>
    </>
  );
}

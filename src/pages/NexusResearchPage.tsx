import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, History, Info, Lock, Orbit, Trophy } from "lucide-react";
import { toast } from "sonner";
import { RESEARCH } from "@/lib/nexus/core/catalog";
import { ARMORY, MILESTONES } from "@/lib/nexus/core/progression";
import type { ResearchId, UnlockId } from "@/lib/nexus/core/types";
import { useNexusCore, useNexusLedger } from "@/hooks/useNexusCore";
import { researchCost } from "@/lib/nexus/core/systems";
import {
  CoreHeading,
  CoreIcon,
  CoreProfileGate,
} from "@/components/nexus/core/CoreUI";
import {
  CoreDetails,
  type CoreDetailItem,
} from "@/components/nexus/core/CoreDetails";
import { CoreEquipmentArt } from "@/components/nexus/core/CoreArtwork";
import { EQUIPMENT_BRIEF } from "@/components/nexus/core/menuCopy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
export default function NexusResearchPage() {
  return (
    <CoreProfileGate>
      <Lab />
    </CoreProfileGate>
  );
}
function Lab() {
  const { profile, research, unlock } = useNexusCore(),
    ledger = useNexusLedger();
  const [params, setParams] = useSearchParams();
  const selected = params.get("tab"),
    tab =
      selected === "research" || selected === "support" ? selected : "armory";
  const [pending, setPending] = useState<string | null>(null),
    [inspected, setInspected] = useState<CoreDetailItem | null>(null),
    [panel, setPanel] = useState<"milestones" | "history" | null>(null);
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
        equipment ? "Unlocked. Ready to equip." : "Research upgraded.",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Purchase failed. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <>
      <div className="nc-menu-toolbar">
        <CoreHeading eyebrow="PERMANENT UPGRADES" title="Core lab" />
        <div className="nc-menu-toolbar-actions">
          <button
            aria-label="Wave milestones"
            onClick={() => setPanel("milestones")}
          >
            <Trophy size={18} />
          </button>
          <button
            aria-label="Credit history"
            onClick={() => setPanel("history")}
          >
            <History size={18} />
          </button>
        </div>
      </div>
      <div
        className="nc-menu-tabs"
        role="tablist"
        aria-label="Laboratory section"
      >
        {(
          [
            ["armory", "Weapons"],
            ["support", "Support"],
            ["research", "Research"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`lab-tab-${id}`}
            aria-controls={`lab-${id}`}
            aria-selected={tab === id}
            onClick={() => setParams({ tab: id }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab !== "research" ? (
        <div
          className="nc-item-grid"
          role="tabpanel"
          id={`lab-${tab}`}
          aria-labelledby={`lab-tab-${tab}`}
        >
          {ARMORY.filter((a) =>
            tab === "support" ? a.kind === "module" : a.kind === "weapon",
          ).map((a) => {
            const owned = profile.unlocks.includes(a.id),
              eligible = profile.totalWaves >= a.waves;
            return (
              <section
                className="nc-item nc-shop-item"
                key={a.id}
                data-owned={owned}
              >
                <button
                  className="nc-item-info"
                  aria-label={`About ${a.name}`}
                  onClick={() => setInspected(a)}
                >
                  <Info size={16} />
                </button>
                {owned && <Check size={13} className="nc-item-mark" />}
                <CoreEquipmentArt id={a.id} />
                <strong>{a.name}</strong>
                <span>{EQUIPMENT_BRIEF[a.id]}</span>
                {!owned && !eligible && (
                  <>
                    <div className="nc-item-progress">
                      <i
                        style={{
                          width: `${Math.min(100, (profile.totalWaves / a.waves) * 100)}%`,
                        }}
                      />
                    </div>
                    <small className="nc-shop-requirement">
                      {profile.totalWaves}/{a.waves} lifetime waves
                    </small>
                  </>
                )}
                <button
                  className="nc-button nc-button-secondary"
                  aria-label={`Unlock ${a.name}`}
                  disabled={
                    owned || !!pending || !eligible || profile.credits < a.cost
                  }
                  onClick={() => buy(a.id, true)}
                >
                  {pending === a.id ? (
                    "UNLOCKING…"
                  ) : owned ? (
                    <>
                      <Check size={13} />
                      OWNED
                    </>
                  ) : (
                    <>
                      {!eligible ? <Lock size={12} /> : <Orbit size={12} />}
                      {a.cost}
                    </>
                  )}
                </button>
              </section>
            );
          })}
        </div>
      ) : (
        <div
          className="nc-item-grid nc-research-items"
          role="tabpanel"
          id="lab-research"
          aria-labelledby="lab-tab-research"
        >
          {RESEARCH.map((r) => {
            const level = profile.research[r.id] || 0,
              price = researchCost(r.id, level);
            return (
              <section className="nc-item nc-shop-item" key={r.id}>
                <div className="nc-research-glyph">
                  <CoreIcon name={r.icon} size={30} />
                </div>
                <strong>{r.name}</strong>
                <span>{r.description}</span>
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
                    "UPGRADING…"
                  ) : level >= r.max ? (
                    "MAX"
                  ) : (
                    <>
                      <Orbit size={12} />
                      {price}
                    </>
                  )}
                </button>
              </section>
            );
          })}
        </div>
      )}
      <p className="nc-menu-note">
        {tab === "research"
          ? "Permanent boosts · active next run"
          : `${profile.totalWaves} lifetime waves · Unlock, then equip in Loadout`}
      </p>
      <CoreDetails item={inspected} onClose={() => setInspected(null)} />
      <Dialog
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="nx-mode nc-shell nc-menu-dialog">
          <DialogTitle>
            {panel === "milestones" ? "Wave milestones" : "Credit history"}
          </DialogTitle>
          <DialogDescription>
            {panel === "milestones"
              ? "Clear a new milestone. Claim a one-time bonus."
              : "Your latest purchases and earnings."}
          </DialogDescription>
          <div className="nc-dialog-scroll">
            {panel === "milestones" ? (
              MILESTONES.map((m) => (
                <div className="nc-milestone-row" key={m.wave}>
                  <span>WAVE {String(m.wave).padStart(2, "0")}</span>
                  <small>{profile.bestWave >= m.wave ? "CLAIMED" : ""}</small>
                  <strong>
                    <Orbit size={13} />+{m.credits}
                  </strong>
                </div>
              ))
            ) : (
              <div aria-label="Credit history">
                {ledger.isPending ? (
                  <p className="nc-menu-note">Loading…</p>
                ) : ledger.isError ? (
                  <button
                    className="nc-button"
                    onClick={() => ledger.refetch()}
                  >
                    Retry
                  </button>
                ) : !ledger.data?.length ? (
                  <p className="nc-menu-note">No transactions yet.</p>
                ) : (
                  ledger.data.map((e) => (
                    <div className="nc-record-row" key={e.id}>
                      <div className="nc-record-name">
                        {e.kind === "research"
                          ? `${RESEARCH.find((r) => r.id === e.details.track)?.name || "Research"} · ${e.details.level}`
                          : e.kind === "unlock"
                            ? `Unlocked · ${ARMORY.find((a) => a.id === e.details.item)?.name || e.details.item}`
                            : "Endless earnings"}
                        <small>
                          {new Date(e.created_at).toLocaleDateString()} ·
                          Balance {e.balance}
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
            )}
          </div>
          <button className="nc-button" onClick={() => setPanel(null)}>
            Done
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

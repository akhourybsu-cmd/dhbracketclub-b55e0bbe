import { useCoreFeedback } from "@/hooks/useCoreFeedback";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, History, Lock, Orbit, Trophy } from "lucide-react";
import { toast } from "sonner";
import { RESEARCH } from "@/lib/nexus/core/catalog";
import { ARMORY, MILESTONES } from "@/lib/nexus/core/progression";
import type { ResearchId, UnlockId } from "@/lib/nexus/core/types";
import { useNexusCore, useNexusLedger } from "@/hooks/useNexusCore";
import { researchCost } from "@/lib/nexus/core/systems";
import {
  CoreHeading,
  CoreLink,
  CoreProfileGate,
} from "@/components/nexus/core/CoreUI";
import {
  CoreDetails,
  type CoreDetailItem,
} from "@/components/nexus/core/CoreDetails";
import {
  CoreBayArtwork,
  CoreBayHeading,
  CoreSelectionDeck,
} from "@/components/nexus/core/CoreSelectionDeck";
import { CoreFeedback } from "@/components/nexus/core/CoreMotion";
import { EQUIPMENT_BRIEF } from "@/components/nexus/core/menuCopy";
import { CoreUnlockReveal } from "@/components/nexus/core/CoreUnlockReveal";
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
  const [acquired, setAcquired] = useState<(typeof ARMORY)[number] | null>(
    null,
  );
  const { feedback, trigger } = useCoreFeedback();
  if (!profile) return null;
  const buy = async (id: ResearchId | UnlockId, equipment = false) => {
    if (busy.current) return;
    busy.current = true;
    setPending(id);
    try {
      if (equipment) {
        await unlock(id as UnlockId);
        setAcquired(ARMORY.find((a) => a.id === id) || null);
      } else {
        const level = profile.research[id as ResearchId] || 0;
        await research(id as ResearchId);
        const max = RESEARCH.find((r) => r.id === id)?.max || 30;
        trigger(level + 1 >= max ? "RESEARCH MASTERED" : "CORE UPGRADED");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Purchase failed. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  const equipment = ARMORY.filter((a) =>
    tab === "support" ? a.kind === "module" : a.kind === "weapon",
  );
  const item =
    equipment.find((a) => a.id === params.get("item")) || equipment[0];
  const track =
    RESEARCH.find((r) => r.id === params.get("item")) || RESEARCH[0];
  const owned = profile.unlocks.includes(item.id),
    eligible = profile.totalWaves >= item.waves;
  const level = profile.research[track.id] || 0,
    price = researchCost(track.id, level);
  const choose = (id: string) =>
    setParams({ tab, item: id }, { replace: true });
  return (
    <section className="nc-deck-screen nc-lab-screen">
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
        <CoreSelectionDeck
          label="Inspect armory equipment"
          value={item.id}
          onChange={choose}
          items={equipment.map((a) => ({
            ...a,
            icon: undefined,
            locked: !profile.unlocks.includes(a.id),
            installed: profile.unlocks.includes(a.id),
          }))}
        >
          <CoreBayArtwork id={item.id} />
          <CoreBayHeading
            name={item.name}
            role={item.role}
            brief={EQUIPMENT_BRIEF[item.id]}
            onInfo={() => setInspected(item)}
          />
          <div className="nc-bay-actions">
            <div className="nc-bay-status">
              <span>
                {owned
                  ? "READY TO EQUIP"
                  : `${Math.min(profile.totalWaves, item.waves)}/${item.waves} lifetime waves`}
              </span>
              <strong>{owned ? "PERMANENT" : `${item.cost} credits`}</strong>
            </div>
            {!owned && (
              <progress
                value={Math.min(profile.totalWaves, item.waves)}
                max={item.waves}
                aria-label={`${item.name} lifetime wave progress`}
              />
            )}
            <div className="nc-bay-action-row">
              <button
                className="nc-button"
                aria-label={`Unlock ${item.name}`}
                disabled={
                  owned || !!pending || !eligible || profile.credits < item.cost
                }
                onClick={() => buy(item.id, true)}
              >
                {pending === item.id ? (
                  "UNLOCKING…"
                ) : owned ? (
                  <>
                    <Check size={15} />
                    OWNED
                  </>
                ) : (
                  <>
                    {!eligible ? <Lock size={13} /> : <Orbit size={13} />}
                    {item.cost} · UNLOCK
                  </>
                )}
              </button>
              {owned && (
                <CoreLink
                  to={`/nexus/loadout/endless?item=${item.id}`}
                  secondary
                >
                  Equip
                </CoreLink>
              )}
            </div>
          </div>
          <CoreFeedback event={feedback} />
        </CoreSelectionDeck>
      ) : (
        <CoreSelectionDeck
          label="Inspect research tracks"
          value={track.id}
          onChange={choose}
          items={RESEARCH.map((r) => ({
            ...r,
            level: profile.research[r.id] || 0,
          }))}
        >
          <CoreBayArtwork id={track.id} icon={track.icon} />
          <CoreBayHeading
            name={track.name}
            role={`CORE RESEARCH · LEVEL ${level} / ${track.max}`}
            brief={track.description}
          />
          <div className="nc-bay-actions">
            <div
              className="nc-bay-level"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={track.max}
              aria-valuenow={level}
              aria-label={`${track.name} level ${level} of ${track.max}`}
            >
              {Array.from({ length: track.max }, (_, i) => (
                <i key={i} data-active={i < level} />
              ))}
            </div>
            <div className="nc-bay-action-row">
              <button
                className="nc-button"
                aria-label={`Research ${track.name}`}
                disabled={
                  level >= track.max || !!pending || profile.credits < price
                }
                onClick={() => buy(track.id)}
              >
                {pending === track.id ? (
                  "UPGRADING…"
                ) : level >= track.max ? (
                  "MAXIMUM LEVEL"
                ) : (
                  <>
                    <Orbit size={14} />
                    {price} · UPGRADE
                  </>
                )}
              </button>
            </div>
          </div>
          <CoreFeedback event={feedback} />
        </CoreSelectionDeck>
      )}
      <p className="nc-menu-note">
        {tab === "research"
          ? "Permanent boosts · active next run"
          : `${profile.totalWaves} lifetime waves · Unlock, then equip in Loadout`}
      </p>
      <CoreDetails item={inspected} onClose={() => setInspected(null)} />
      <CoreUnlockReveal item={acquired} onClose={() => setAcquired(null)} />
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
    </section>
  );
}

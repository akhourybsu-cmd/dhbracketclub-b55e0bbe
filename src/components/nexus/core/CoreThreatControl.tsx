import { useState } from "react";
import { Info, Lock } from "lucide-react";
import { DIFFICULTIES, getDifficulty } from "@/lib/nexus/core/difficulty";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "./threat.css";

export function CoreThreatControl({
  value,
  waves,
  onChange,
  disabled,
}: {
  value: number;
  waves: number;
  onChange: (id: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const threat = getDifficulty(value);
  return (
    <>
      <div className="nc-threat-control">
        <label>
          <span>THREAT</span>
          <select
            aria-label="Endless threat level"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.id} value={d.id} disabled={waves < d.waves}>
                {d.id} · {d.name}
                {waves < d.waves ? ` · ${d.waves.toLocaleString()} waves` : ""}
              </option>
            ))}
          </select>
        </label>
        <button aria-label="Threat level details" onClick={() => setOpen(true)}>
          <Info size={17} />
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="nx-mode nc-shell nc-menu-dialog">
          <DialogTitle>Choose your threat</DialogTitle>
          <DialogDescription>
            {waves.toLocaleString()} lifetime waves · Higher threats earn more
            wave credits. Milestone bonuses stay the same.
          </DialogDescription>
          <div className="nc-dialog-scroll nc-threat-roadmap">
            {DIFFICULTIES.map((d) => (
              <section key={d.id} data-current={d.id === threat.id}>
                <div>
                  <strong>
                    {d.id} · {d.name}
                  </strong>
                  <span>
                    {waves < d.waves && <Lock size={12} />}×{d.reward} credits
                  </span>
                </div>
                <p>{d.description}</p>
                <small>
                  {waves >= d.waves
                    ? "UNLOCKED"
                    : `${waves.toLocaleString()} / ${d.waves.toLocaleString()} lifetime waves`}
                </small>
                <progress
                  aria-label={`${d.name} unlock progress`}
                  value={d.waves ? Math.min(waves, d.waves) : 1}
                  max={d.waves || 1}
                />
              </section>
            ))}
          </div>
          <button className="nc-button" onClick={() => setOpen(false)}>
            Ready
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

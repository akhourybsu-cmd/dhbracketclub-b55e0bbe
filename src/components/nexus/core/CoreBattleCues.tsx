import { Hexagon, ShieldAlert } from "lucide-react";
import type { CoreRun } from "@/lib/nexus/core/types";
import { nextWaveTarget } from "@/lib/nexus/core/career";
import { Target } from "lucide-react";

export function CoreBattleCues({
  run,
  bestWave = 0,
}: {
  run: CoreRun;
  bestWave?: number;
}) {
  const boss = run.enemies.find((e) => e.kind === "boss" && e.hp > 0);
  const impact = run.damageTaken + (run.metrics?.shieldAbsorbed || 0);
  const target = nextWaveTarget(bestWave, run.cleared);
  return (
    <>
      {(run.balanceVersion || 0) >= 4 && (
        <div
          className="nc-run-target"
          aria-label={`Next objective: clear wave ${target.wave}${target.credits ? ` for a ${target.credits} credit milestone bonus` : " for a new best"}`}
        >
          <div>
            <Target size={10} />
            <span>TARGET {String(target.wave).padStart(2, "0")}</span>
          </div>
          <progress value={run.cleared} max={target.wave} />
        </div>
      )}
      {impact > 0 && (
        <div className="nc-impact-vignette" key={impact} aria-hidden="true" />
      )}
      {run.phase === "wave" && run.wave > 1 && run.waveTime < 1.6 && (
        <div
          className={`nc-wave-intro ${run.wave % 5 === 0 ? "nc-boss-intro" : ""}`}
          key={run.wave}
          role="status"
        >
          {run.wave % 5 === 0 ? (
            <ShieldAlert size={27} />
          ) : (
            <Hexagon size={24} />
          )}
          <div>
            <small>
              {run.wave % 5 === 0 ? "SIEGE INBOUND" : "DEFENSE ONLINE"}
            </small>
            <strong>WAVE {String(run.wave).padStart(2, "0")}</strong>
          </div>
        </div>
      )}
      {boss && (
        <div
          className="nc-boss-track"
          aria-label={`Siege boss: ${Math.ceil((100 * boss.hp) / boss.maxHp)} percent hull`}
        >
          <div>
            <ShieldAlert size={12} />
            <span>SIEGE BOSS</span>
          </div>
          <progress value={boss.hp} max={boss.maxHp} />
        </div>
      )}
    </>
  );
}

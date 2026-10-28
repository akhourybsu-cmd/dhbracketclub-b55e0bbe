import { Lock, Swords } from "lucide-react";
import { useLocation } from "react-router-dom";
import { CAMPAIGN, CHALLENGES } from "@/lib/nexus/core/catalog";
import { useNexusCore } from "@/hooks/useNexusCore";
import {
  CoreBack,
  CoreHeading,
  CoreLink,
  CoreProfileGate,
  CoreStars,
} from "@/components/nexus/core/CoreUI";

export default function NexusMissionsPage() {
  return (
    <CoreProfileGate>
      <Sectors />
    </CoreProfileGate>
  );
}
function Sectors() {
  const { profile } = useNexusCore();
  const challenges = useLocation().pathname.endsWith("/challenges");
  if (!profile) return null;
  const entries = challenges ? CHALLENGES : CAMPAIGN;
  return (
    <>
      <CoreBack />
      <CoreHeading
        eyebrow={
          challenges ? "Special assignments" : "Campaign / eight sectors"
        }
        title={challenges ? "Change the rules." : "Secure the perimeter."}
      >
        {challenges
          ? "Each challenge changes how your core survives. All four are open. Your permanent research carries in."
          : "Clear each sector to unlock the next. Finish with 40% hull for two stars, or 80% for three."}
      </CoreHeading>
      <div className="nc-sector-grid">
        {entries.map((s, i) => {
          const locked =
            !challenges && i > 0 && !profile.campaign[entries[i - 1].id];
          const stars =
            (challenges ? profile.challenges : profile.campaign)[s.id] || 0;
          return (
            <section
              className={`nc-panel nc-sector ${locked ? "nc-sector-locked" : ""}`}
              key={s.id}
            >
              <div className="nc-sector-top">
                <span className="nc-sector-number">{s.subtitle}</span>
                {locked ? (
                  <Lock size={15} />
                ) : stars ? (
                  <CoreStars count={stars} />
                ) : challenges ? (
                  <Swords size={16} />
                ) : (
                  <span className="nc-eyebrow">Open</span>
                )}
              </div>
              <h2>{s.title}</h2>
              <p>{s.description}</p>
              <div className="nc-sector-info">
                <span>{s.waves} waves</span>
                <span>+{s.reward} clear bonus</span>
              </div>
              {locked ? (
                <span className="nc-note">
                  Clear {entries[i - 1].title} to unlock
                </span>
              ) : (
                <CoreLink to={`/nexus/loadout/${s.id}`} secondary={!!stars}>
                  {stars ? "Deploy again" : "Prepare core"}
                </CoreLink>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

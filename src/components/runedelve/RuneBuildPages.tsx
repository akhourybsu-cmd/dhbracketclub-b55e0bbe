import { useState } from "react";
import { Check, Lock, Sparkles, Zap } from "lucide-react";
import type { CharacterSheet } from "@/lib/runedelve/characterStats";
import { RunePager } from "./RunePager";

/** One readable screen at a time; values still come from the combat sheet. */
export function RuneBuildPages({
  sheet,
  masteries = [],
  level = 1,
}: {
  sheet: CharacterSheet;
  masteries?: {
    id: string;
    name: string;
    summary: string;
    unlockLevel: number;
  }[];
  level?: number;
}) {
  const [page, setPage] = useState(0);
  const detailStart = 2 + masteries.length;
  const pageCount = detailStart + sheet.stats.length + sheet.bonuses.length;
  const index = Math.min(page, pageCount - 1);
  const mastery = masteries[index - 2];
  const stat = sheet.stats[index - detailStart];
  const bonus = sheet.bonuses[index - detailStart - sheet.stats.length];
  return (
    <section className="rd-build-pages rd-page-stack" aria-label="Combat build">
      <div className="rd-menu-surface rd-build-content">
        {index === 0 ? (
          <>
            <h2 className="rd-build-caption">
              Combat stats · 5-rune chains · Chamber {sheet.campaignLevel}
            </h2>
            <div className="rd-screen-stat-grid">
              {sheet.stats.map((stat) => (
                <div key={stat.id}>
                  <span>
                    {
                      {
                        hp: "Health",
                        strike: "Strike",
                        heal: "Heal",
                        mana: "Mana",
                        guard: "Guard",
                        thorns: "Thorns",
                      }[stat.id]
                    }
                  </span>
                  <strong>
                    {stat.effective}
                    <small>{stat.suffix}</small>
                  </strong>
                  {stat.effective !== stat.base && (
                    <small className="text-primary">
                      Base {stat.base}
                      {stat.suffix}
                    </small>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : index === 1 ? (
          <>
            <h2 className="rd-build-caption">
              <Zap size={14} aria-hidden /> {sheet.abilityName} ·{" "}
              {sheet.abilityCost} mana
            </h2>
            <p className="rd-build-detail">{sheet.abilityDetail}</p>
            <div className="rd-opening-grid">
              <span>
                Starting mana <strong>{sheet.startingMana}/3</strong>
              </span>
              <span>
                Guard <strong>{sheet.startingShield}</strong>
              </span>
              <span>
                Bonus turns <strong>+{sheet.bonusTurns}</strong>
              </span>
            </div>
          </>
        ) : mastery ? (
          <>
            <h2 className="rd-build-caption">
              <Sparkles size={14} aria-hidden /> Class mastery · Lv{" "}
              {mastery.unlockLevel}
            </h2>
            <h3 className="rd-title text-lg">{mastery.name}</h3>
            <p className="rd-build-detail">{mastery.summary}</p>
            <p className="rd-menu-note flex items-center gap-1">
              {level >= mastery.unlockLevel ? (
                <Check size={14} />
              ) : (
                <Lock size={14} />
              )}
              {level >= mastery.unlockLevel
                ? "Unlocked"
                : `Unlocks at level ${mastery.unlockLevel}`}
            </p>
          </>
        ) : stat ? (
          <>
            <h2 className="rd-build-caption">Stat detail</h2>
            <h3 className="rd-title text-lg">{stat.label}</h3>
            <div
              className="rd-opening-grid"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              <span>
                Base
                <strong>
                  {stat.base}
                  {stat.suffix}
                </strong>
              </span>
              <span>
                Effective
                <strong>
                  {stat.effective}
                  {stat.suffix}
                </strong>
              </span>
            </div>
            <p className="rd-build-detail">{stat.note}</p>
          </>
        ) : bonus ? (
          <>
            <h2 className="rd-build-caption">Build effect</h2>
            <h3 className="rd-title text-lg">{bonus.name}</h3>
            <p className="rd-menu-note">
              Source: {bonus.source}
              {bonus.rank != null ? ` · Rank ${bonus.rank}` : ""}
            </p>
            <p className="rd-build-detail">{bonus.detail}</p>
          </>
        ) : null}
      </div>
      <RunePager
        page={index}
        pageCount={pageCount}
        onPageChange={setPage}
        label="Build"
      />
    </section>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import type { CharacterSheet } from "@/lib/runedelve/characterStats";
import { getClass } from "@/lib/runedelve/classConfig";
import { RunePager } from "./RunePager";
import "./runeDialogs.css";
interface Props {
  sheet: CharacterSheet;
  compact?: boolean;
}
export function CharacterPowerPanel({ sheet, compact = false }: Props) {
  const [page, setPage] = useState(0);
  const cls = getClass(sheet.cls);
  const pages = [
    ...sheet.stats.map((stat) => (
      <article className="rd-power-page rd-power-stat" key={stat.id}>
        <p>
          {stat.icon} {stat.label}
        </p>
        <strong>
          {stat.effective}
          {stat.suffix}
        </strong>
        <p>{stat.note}</p>
        {stat.effective !== stat.base && (
          <small>
            Base {stat.base}
            {stat.suffix} · Change {stat.effective > stat.base ? "+" : ""}
            {stat.effective - stat.base}
            {stat.suffix}
          </small>
        )}
      </article>
    )),
    <article className="rd-power-page rd-dialog-card" key="ability">
      <h3>
        {sheet.abilityName} · {sheet.abilityCost} mana
      </h3>
      <p>{sheet.abilityDetail}</p>
    </article>,
    <article className="rd-power-page rd-dialog-card" key="opening">
      <h3>Opening kit</h3>
      <div className="rd-dialog-stats">
        <div>
          <strong>{sheet.startingMana}/3</strong>
          <span>Mana</span>
        </div>
        <div>
          <strong>{sheet.startingShield}</strong>
          <span>Guard</span>
        </div>
        <div>
          <strong>+{sheet.bonusTurns}</strong>
          <span>Turns</span>
        </div>
      </div>
    </article>,
    ...(!compact
      ? [
          <article className="rd-power-page rd-dialog-card" key="build">
            <h3>Your build</h3>
            <p>
              {sheet.masteryCount}/5 masteries · {sheet.equippedCount}/3 relics
              · {sheet.relicRankTotal} relic ranks
            </p>
            <p>
              Class levels unlock the listed masteries. Conditional effects stay
              listed instead of being averaged into combat stats.
            </p>
          </article>,
          ...sheet.bonuses.map((bonus) => (
            <article
              className="rd-power-page rd-dialog-card"
              key={`${bonus.source}-${bonus.id}`}
            >
              <p className="rd-dialog-eyebrow">
                {bonus.source}
                {bonus.rank ? ` · Rank ${bonus.rank}` : ""}
              </p>
              <h3>
                {bonus.icon} {bonus.name}
              </h3>
              <p>{bonus.detail}</p>
            </article>
          )),
        ]
      : []),
  ];
  const index = Math.min(page, pages.length - 1);
  return (
    <section
      className="glass-card rd-power-panel"
      aria-label={`${cls.name} combat sheet`}
    >
      <div className="rd-power-heading">
        <div>
          <h3>Combat stats</h3>
          <p>
            {cls.name} Lv {sheet.classLevel} · Chamber {sheet.campaignLevel}
          </p>
        </div>
        {!compact && (
          <Link className="rd-dialog-secondary" to="/rune-delve/armory">
            Tune
          </Link>
        )}
      </div>
      <div aria-live="polite">{pages[index]}</div>
      <RunePager
        page={index}
        pageCount={pages.length}
        onPageChange={setPage}
        label="Combat sheet"
      />
    </section>
  );
}

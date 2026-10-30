import { useState } from "react";
import { RuneLayoutPreview } from "./RuneLayoutPreview";
import type { RuneLayout } from "@/lib/runedelve/runeLayouts";
import { RunePager } from "./RunePager";
import "./runeDialogs.css";
interface Props {
  layout: RuneLayout;
  levelNumber?: number;
  title?: string;
  showStrategy?: boolean;
}
export function DelveBriefingCard({
  layout,
  levelNumber,
  title,
  showStrategy = true,
}: Props) {
  const [page, setPage] = useState(0);
  const pages = [
    <p key="briefing">{layout.briefing}</p>,
    <div key="board">
      <div className="rd-dialog-stats">
        <div>
          <strong>5×5</strong>
          <span>Rune board</span>
        </div>
        <div>
          <strong>{layout.preview.hazardZones}</strong>
          <span>Hazards</span>
        </div>
        <div>
          <strong>{layout.preview.treasureZones}</strong>
          <span>Treasure</span>
        </div>
      </div>
      <p>
        {25 - layout.preview.hazardZones - layout.preview.treasureZones} plain
        runes
      </p>
    </div>,
    ...(showStrategy
      ? [
          <p key="strategy">
            <b>Strategy:</b> {layout.recommendedStrategy}
          </p>,
        ]
      : []),
  ];
  const index = Math.min(page, pages.length - 1);
  return (
    <section className="rd-briefing-card">
      <header>
        <RuneLayoutPreview layout={layout} size="sm" />
        <div>
          <p>
            {levelNumber !== undefined ? `Level ${levelNumber} · ` : ""}
            {layout.category}
            {title && title !== layout.name ? ` · ${layout.name}` : ""}
          </p>
          <h2 className="rd-title">{title ?? layout.name}</h2>
        </div>
      </header>
      <div className="rd-briefing-content" aria-live="polite">
        {pages[index]}
      </div>
      <RunePager
        page={index}
        pageCount={pages.length}
        onPageChange={setPage}
        label="Chamber briefing"
      />
    </section>
  );
}

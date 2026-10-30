import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Orbit,
  Target,
} from "lucide-react";
import {
  careerMedals,
  defenderRank,
  nextCareerObjective,
} from "@/lib/nexus/core/career";
import type { CoreProfile } from "@/lib/nexus/core/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoreIcon } from "./CoreUI";

export function CoreRankCrest({
  level,
  className = "",
}: {
  level: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="-40 -40 80 80"
      className={`nc-rank-crest ${className}`}
      data-rank={level}
      aria-hidden="true"
    >
      <path
        d="M0 -35 30 -18 30 17 0 35 -30 17 -30 -18Z"
        fill="currentColor"
        fillOpacity=".06"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M0 -28 24 -14 24 13 0 28 -24 13 -24 -14Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".3"
      />
      <path
        d="m0 -16 5 10 11 2-8 8 2 11L0 10l-10 5 2-11-8-8 11-2Z"
        fill="currentColor"
        fillOpacity={level > 3 ? ".8" : ".18"}
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {Array.from({ length: Math.min(4, level) }, (_, i) => (
        <path
          key={i}
          d={`M${-14 + i * 4} 23 l2 3 2 -3`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

export function CoreCareerDialog({
  profile,
  open,
  onClose,
}: {
  profile: CoreProfile;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "medals">("overview"),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState("first-light");
  const rank = defenderRank(profile.totalWaves),
    medals = careerMedals(profile),
    objective = nextCareerObjective(profile);
  const focused = medals.find((m) => m.id === selected) || medals[0],
    earned = medals.filter((m) => m.unlocked).length;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        className="nx-mode nc-shell nc-menu-dialog nc-career-dialog"
        data-tab={tab}
      >
        <DialogTitle>Defender career</DialogTitle>
        <DialogDescription className="sr-only">
          Ranks and medals earned through permanent account progress.
        </DialogDescription>
        <div className="nc-career-body">
          {tab === "overview" && (
            <div className="nc-career-identity">
              <CoreRankCrest level={rank.level} />
              <div>
                <small>RANK {String(rank.level).padStart(2, "0")}</small>
                <h3>{rank.name}</h3>
                <span>{rank.totalWaves.toLocaleString()} lifetime waves</span>
              </div>
            </div>
          )}
          <div
            className="nc-menu-tabs"
            role="tablist"
            aria-label="Career section"
          >
            <button
              role="tab"
              aria-selected={tab === "overview"}
              onClick={() => setTab("overview")}
            >
              Progress
            </button>
            <button
              role="tab"
              aria-selected={tab === "medals"}
              onClick={() => setTab("medals")}
            >
              Medals{" "}
              <small>
                {earned}/{medals.length}
              </small>
            </button>
          </div>
          {tab === "overview" ? (
            <section
              aria-label="Career progress"
              className="nc-career-overview"
            >
              <div className="nc-rank-progress">
                <progress
                  value={rank.progress}
                  max={1}
                  aria-label={
                    rank.next
                      ? `Progress to ${rank.next.name}`
                      : "Maximum career rank"
                  }
                />
                <span>
                  {rank.next
                    ? `${rank.remaining} waves to ${rank.next.name}`
                    : `${rank.name.toUpperCase()} · MAX RANK`}
                </span>
              </div>
              <div className="nc-career-objective">
                <div>
                  <Target size={17} />
                  <small>NEXT OBJECTIVE</small>
                </div>
                <strong>{objective.title}</strong>
                <p>{objective.description}</p>
                <Link
                  to={objective.href || "/nexus"}
                  className="nc-button"
                  onClick={onClose}
                >
                  {objective.href ? objective.action : "Ready up"}
                  <ArrowRight size={15} />
                </Link>
              </div>
              {rank.next && (
                <div className="nc-next-rank">
                  <CoreRankCrest level={rank.level + 1} />
                  <span>
                    <small>NEXT RANK</small>
                    <strong>{rank.next.name}</strong>
                  </span>
                  <span>{rank.next.waves.toLocaleString()} waves</span>
                </div>
              )}
            </section>
          ) : (
            <section className="nc-medal-page" aria-label="Career medals">
              <div className="nc-medal-grid">
                {medals.slice(page * 4, page * 4 + 4).map((m) => (
                  <button
                    key={m.id}
                    className="nc-medal"
                    aria-label={`${m.name}: ${m.unlocked ? "earned" : `${m.current} of ${m.target}`}`}
                    aria-pressed={selected === m.id}
                    data-earned={m.unlocked}
                    onClick={() => setSelected(m.id)}
                  >
                    <CoreIcon name={m.icon} size={25} />
                    <strong>{m.name}</strong>
                    <span>
                      {m.unlocked ? (
                        <>
                          <Check size={10} />
                          EARNED
                        </>
                      ) : (
                        <>
                          <Lock size={10} />
                          {m.current}/{m.target}
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <div className="nc-medal-detail">
                <strong>{focused.name}</strong>
                <p>{focused.description}</p>
                <progress
                  value={focused.progress}
                  max={1}
                  aria-label={`${focused.name} medal progress`}
                />
              </div>
              <div className="nc-record-pages">
                <button
                  aria-label="Previous medals"
                  disabled={page === 0}
                  onClick={() => {
                    setPage(page - 1);
                    setSelected(medals[(page - 1) * 4].id);
                  }}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  {page + 1} / {Math.ceil(medals.length / 4)}
                </span>
                <button
                  aria-label="Next medals"
                  disabled={(page + 1) * 4 >= medals.length}
                  onClick={() => {
                    setPage(page + 1);
                    setSelected(medals[(page + 1) * 4].id);
                  }}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </section>
          )}
        </div>
        <button className="nc-button" onClick={onClose}>
          Done
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function CoreCareerSummary({
  profile,
  bankedWaves = 0,
  onClick,
}: {
  profile: CoreProfile;
  bankedWaves?: number;
  onClick: () => void;
}) {
  const rank = defenderRank(profile.totalWaves);
  return (
    <button
      className="nc-career-summary"
      aria-label="View career progress"
      onClick={onClick}
    >
      <CoreRankCrest level={rank.level} />
      <span>
        <strong>{rank.name}</strong>
        <small>
          {bankedWaves > 0
            ? `+${bankedWaves} career waves`
            : `Rank ${rank.level}`}
        </small>
        <progress
          value={rank.progress}
          max={1}
          aria-label="Career rank progress"
        />
      </span>
      <ChevronRight size={13} />
    </button>
  );
}

export function CoreObjectiveStrip({ profile }: { profile: CoreProfile }) {
  const [open, setOpen] = useState(false),
    objective = nextCareerObjective(profile);
  return (
    <>
      <button
        className="nc-title-milestone nc-objective-strip"
        aria-label={`Next objective: ${objective.title}`}
        onClick={() => setOpen(true)}
      >
        <Target size={13} />
        <span>
          {objective.kind === "wave"
            ? `TARGET · WAVE ${objective.wave}`
            : objective.kind === "equip"
              ? "ARM YOUR CORE"
              : "UNLOCK READY"}
        </span>
        <div>
          <i style={{ width: `${objective.progress * 100}%` }} />
        </div>
        <strong>
          {objective.kind === "wave" && objective.credits ? (
            <>
              <Orbit size={12} />+{objective.credits}
            </>
          ) : (
            <ChevronRight size={15} />
          )}
        </strong>
      </button>
      <CoreCareerDialog
        profile={profile}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

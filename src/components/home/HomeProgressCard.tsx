import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Flag,
  RefreshCw,
  Trophy,
} from "lucide-react";
import {
  dhRank,
  FEAT_CATEGORIES,
  FEAT_TIERS,
  formatFeatValue,
} from "@/lib/feats/progression";
import type { HomeSignals } from "@/lib/home/signals";

export function HomeProgressCard({
  signals,
  installed,
  onRefresh,
}: {
  signals?: HomeSignals;
  installed: Set<string>;
  onRefresh: () => void;
}) {
  const data = signals?.progress.data,
    rank = data ? dhRank(data.score) : null;
  const goal = data?.goals.find((g) => {
    const asset = FEAT_CATEGORIES[g.category]?.asset;
    return !asset || installed.has(asset);
  });
  return (
    <section className="home-progress home-panel" aria-label="Your DH progress">
      <Link
        to="/feats"
        className="home-score-link"
        aria-label="Open your DH Score"
      >
        <div className="home-score-copy">
          <span className="home-eyebrow">
            YOUR DH SCORE
            <ArrowUpRight size={13} />
          </span>
          <strong className="home-score-value">
            {data ? data.score.toLocaleString() : "—"}
            <small>DH</small>
          </strong>
          <span className="home-score-rank">
            {rank
              ? `${rank.name} · Level ${rank.level}`
              : signals?.progress.error
                ? "Ready to reconnect"
                : "Your progress across DH"}
          </span>
        </div>
        <div className="home-rank-mark" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="49" />
            <circle
              cx="60"
              cy="60"
              r="49"
              pathLength="100"
              strokeDasharray={`${(rank?.progress || 0) * 100} 100`}
            />
            <path d="M60 23 87 39 87 76 60 92 33 76 33 39Z" />
            <text x="60" y="60">
              DH
            </text>
            <text x="60" y="76">
              {rank ? String(rank.level).padStart(2, "0") : "—"}
            </text>
          </svg>
        </div>
      </Link>
      <div className="home-score-meta">
        <span>
          <Trophy size={13} />
          {data
            ? `${data.unlocked} feats unlocked`
            : "Your next chapter starts here"}
        </span>
        {data && data.score > 0 && data.club_rank != null && <span>#{data.club_rank} in club</span>}
      </div>
      {rank && (
        <div className="home-rank-progress">
          <progress
            value={rank.progress}
            max={1}
            aria-label="DH rank progress"
          />
          <small>
            {rank.next ? (
              <>
                <strong>{rank.remaining.toLocaleString()} DH</strong> to{" "}
                {rank.next.name}
              </>
            ) : (
              "DH Icon · Maximum rank"
            )}
          </small>
        </div>
      )}
      {signals?.progress.error ? (
        <button
          className="home-goal-link home-progress-retry"
          onClick={onRefresh}
        >
          <RefreshCw size={15} />
          <span>Refresh your progress</span>
          <ArrowRight size={15} />
        </button>
      ) : (
        <Link
          to={goal ? `/feats?goal=${encodeURIComponent(goal.key)}` : "/feats"}
          className="home-goal-link"
          aria-label={goal ? `View goal: ${goal.title}` : "Find your next feat"}
        >
          <Flag size={15} />
          <span>
            <small>{goal?.tracked ? "TRACKED GOAL" : "NEXT MILESTONE"}</small>
            <strong>{goal ? goal.title : "Find your next feat"}</strong>
          </span>
          {goal ? (
            <span className="home-goal-numbers">
              <strong>
                {formatFeatValue(
                  Math.min(goal.value, goal.target),
                  goal.unit,
                  true,
                )}
                <i> / {formatFeatValue(goal.target, goal.unit, true)}</i>
              </strong>
              <small>
                {FEAT_TIERS[goal.tier - 1]} · +{goal.points} DH
              </small>
            </span>
          ) : (
            <ArrowRight size={17} />
          )}
        </Link>
      )}
    </section>
  );
}

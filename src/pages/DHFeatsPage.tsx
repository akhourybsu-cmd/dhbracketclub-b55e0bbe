import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link,useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Loader2,
  Pin,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { useClubAssets } from "@/hooks/useClubAssets";
import { useDHFeats } from "@/hooks/useDHFeats";
import {
  dhRank,
  FEAT_CATEGORIES,
  FEAT_TIERS,
  featProgress,
  formatFeatValue,
  nextFeats,
  unseenFeats,
} from "@/lib/feats/progression";
import type {
  FeatBoard,
  FeatDefinition,
  FeatLeader,
  FeatUnlock,
} from "@/lib/feats/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeatCrest, FeatIcon } from "@/components/feats/FeatArtwork";
import "@/components/feats/feats.css";

type Tab = "next" | "collection" | "club";
function FeatCard({
  feat,
  board,
  onSelect,
}: {
  feat: FeatDefinition;
  board: FeatBoard;
  onSelect: () => void;
}) {
  const p = featProgress(feat, board.progress[feat.key], board.unlocks),
    category = FEAT_CATEGORIES[feat.category];
  return (
    <button
      className="dh-feat-card"
      data-tier={p.index}
      data-maxed={p.maxed}
      onClick={onSelect}
      aria-label={`${feat.title}, ${p.maxed ? "mastered" : p.tier}`}
    >
      <span className="dh-feat-icon">
        <FeatIcon name={category?.icon || "Sparkles"} />
      </span>
      <span className="dh-feat-card-body">
        <small>
          {category?.name || "DH Club"} <i>·</i> {p.maxed ? "MASTERED" : p.tier}
        </small>
        <strong>{feat.title}</strong>
        <span className="dh-feat-numbers">
          {formatFeatValue(Math.min(p.current, p.target), feat.unit, true)}{" "}
          <i>/ {formatFeatValue(p.target, feat.unit, true)}</i>
        </span>
        <progress
          value={p.progress}
          max={1}
          aria-label={`${feat.title} progress`}
        />
      </span>
      <span className="dh-feat-award">
        {p.maxed ? (
          <Check size={18} />
        ) : (
          <>
            +{p.points}
            <small>DH</small>
          </>
        )}
      </span>
      {board.pinned.includes(feat.key) && (
        <Pin className="dh-card-pin" size={10} aria-label="Tracked" />
      )}
    </button>
  );
}
function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="dh-pager">
      <button
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={18} />
      </button>
      <span aria-live="polite">
        {page + 1} / {Math.max(1, total)}
      </span>
      <button
        aria-label="Next page"
        disabled={page >= total - 1}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
function PagedFeats({
  feats,
  board,
  onSelect,
  empty,
}: {
  feats: FeatDefinition[];
  board: FeatBoard;
  onSelect: (key: string) => void;
  empty: string;
}) {
  const area = useRef<HTMLDivElement>(null),
    [capacity, setCapacity] = useState(3),
    [page, setPage] = useState(0);
  const signature = feats.map((f) => f.key).join("|");
  useEffect(() => {
    setPage(0);
  }, [signature, capacity]);
  useEffect(() => {
    if (!area.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const columns =
        entry.contentRect.width >= 1000
          ? 3
          : entry.contentRect.width >= 630
            ? 2
            : 1;
      const short =
        window.innerHeight <= 540 && window.innerWidth > window.innerHeight;
      setCapacity(
        Math.max(
          1,
          Math.floor((entry.contentRect.height + 8) / (short ? 76 : 96)),
        ) * columns,
      );
    });
    observer.observe(area.current);
    return () => observer.disconnect();
  }, []);
  const total = Math.ceil(feats.length / capacity),
    current = Math.min(page, Math.max(0, total - 1));
  return (
    <>
      <div className="dh-list-space" ref={area}>
        {feats.length ? (
          <div className="dh-feat-grid">
            {feats
              .slice(current * capacity, (current + 1) * capacity)
              .map((feat) => (
                <FeatCard
                  key={feat.key}
                  feat={feat}
                  board={board}
                  onSelect={() => onSelect(feat.key)}
                />
              ))}
          </div>
        ) : (
          <div className="dh-empty">
            <Sparkles />
            <strong>{empty}</strong>
            <span>Choose another view to find your next feat.</span>
          </div>
        )}
      </div>
      <Pager page={current} total={total} onChange={setPage} />
    </>
  );
}
function ClubBoard({ board }: { board: FeatBoard }) {
  const { user } = useAuth(),
    { club } = useClub(),
    [monthly, setMonthly] = useState(false),
    [page, setPage] = useState(0),
    [size, setSize] = useState(4),
    area = useRef<HTMLDivElement>(null);
  const rows = monthly ? board.monthly_leaders : board.leaders,
    me = monthly ? board.monthly_me : board.me;
  useEffect(() => {
    if (!area.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize(Math.max(1, Math.floor(entry.contentRect.height / 64))),
    );
    observer.observe(area.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setPage(0), [size, monthly]);
  const total = Math.ceil(rows.length / size),
    current = Math.min(page, Math.max(0, total - 1));
  const row = (member: FeatLeader, mine = false) => (
    <div
      className="dh-leader"
      key={member.user_id}
      data-you={mine || member.user_id === user?.id}
    >
      <span className="dh-leader-place">
        {member.rank <= 3 ? (
          <Trophy size={18} />
        ) : (
          String(member.rank).padStart(2, "0")
        )}
      </span>
      <span className="dh-leader-avatar">
        {member.display_name?.slice(0, 1).toUpperCase() || "D"}
      </span>
      <span className="dh-leader-name">
        <strong>
          {member.user_id === user?.id
            ? "You"
            : member.display_name || "Club member"}
        </strong>
        <small>
          {monthly
            ? `${member.unlocked} feats this month`
            : dhRank(member.score).name}
        </small>
      </span>
      <strong className="dh-leader-score">
        {Number(member.score).toLocaleString()}
        <small>DH</small>
      </strong>
    </div>
  );
  return (
    <section className="dh-panel dh-club-panel">
      <div className="dh-panel-heading">
        <h2>{club?.name || "Your club"}</h2>
        <small>{board.members} members</small>
      </div>
      <div className="dh-segment" role="group" aria-label="Leaderboard period">
        <button aria-pressed={!monthly} onClick={() => setMonthly(false)}>
          All time
        </button>
        <button aria-pressed={monthly} onClick={() => setMonthly(true)}>
          This month
        </button>
      </div>
      {me && (
        <div className="dh-your-rank" aria-label="Your club standing">
          {row(me, true)}
        </div>
      )}
      <div className="dh-leader-space" ref={area}>
        {rows
          .slice(current * size, (current + 1) * size)
          .map((member) => row(member))}
      </div>
      <Pager page={current} total={total} onChange={setPage} />
      <p className="dh-board-note">
        {monthly
          ? "New feats earned this UTC month. Imported history is excluded."
          : "Lifetime DH Score · Shared ranks for tied scores"}
      </p>
    </section>
  );
}

export default function DHFeatsPage() {
  const [params]=useSearchParams();
  const result = useDHFeats(),
    { data: board } = result,
    { isInstalled } = useClubAssets(),
    reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>("next"),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("all"),
    [term, setTerm] = useState(""),
    [selected, setSelected] = useState<string | null>(()=>params.get('goal')),
    [help, setHelp] = useState(false),
    [reveal, setReveal] = useState<{
      items: FeatUnlock[];
      through: string;
    } | null>(null);
  const shown = useRef(new Set<string>());
  useEffect(() => {
    document.documentElement.classList.add("dh-feats-active");
    document.body.classList.add("dh-feats-active");
    return () => {
      document.documentElement.classList.remove("dh-feats-active");
      document.body.classList.remove("dh-feats-active");
    };
  }, []);
  useEffect(() => {
    if (!board) return;
    const items = unseenFeats(board).filter(
      (u) => !shown.current.has(`${u.feat_key}:${u.tier}`),
    );
    if (items.length) {
      items.forEach((u) => shown.current.add(`${u.feat_key}:${u.tier}`));
      setReveal({ items, through: board.as_of });
    }
  }, [board]);
  const available =
    board?.catalog.filter((f) => {
      const meta = FEAT_CATEGORIES[f.category];
      return (
        !meta?.asset ||
        isInstalled(meta.asset) ||
        board.pinned.includes(f.key) ||
        board.unlocks.some((u) => u.feat_key === f.key)
      );
    }) || [];
  const rank = dhRank(board?.score || 0),
    feat = board?.catalog.find((f) => f.key === selected);
  const p =
    feat && board
      ? featProgress(feat, board.progress[feat.key], board.unlocks)
      : null;
  const categoryOptions = Object.entries(FEAT_CATEGORIES).filter(([key]) =>
    available.some((f) => f.category === key),
  );
  const recommendations = board ? nextFeats(board, available) : [];
  const tracked =
    board?.pinned
      .map((key) => available.find((f) => f.key === key))
      .filter((f): f is FeatDefinition => !!f) || [];
  const list = available
    .filter((f) => {
      const progress = featProgress(f, board.progress[f.key], board.unlocks);
      return (
        (category === "all" || f.category === category) &&
        (status === "all" ||
          (status === "earned" && progress.earned > 0) ||
          (status === "progress" && !progress.maxed) ||
          (status === "mastered" && progress.maxed)) &&
        (!term ||
          `${f.title} ${f.description} ${FEAT_CATEGORIES[f.category]?.name}`
            .toLowerCase()
            .includes(term.toLowerCase()))
      );
    })
    .sort((a, b) => a.sort_order - b.sort_order);
  const dismissReveal = () => {
    if (!reveal) return;
    const through = reveal.through;
    setReveal(null);
    result.seen.mutate(through, {
      onError: () =>
        toast.error("Could not save viewed feats. They may appear again."),
    });
  };
  const togglePin = () => {
    if (!board || !feat || result.pins.isPending) return;
    const keys = board.pinned.includes(feat.key)
      ? board.pinned.filter((k) => k !== feat.key)
      : [...board.pinned, feat.key];
    result.pins.mutate(keys, {
      onError: () => toast.error("Tracking could not sync. Try again."),
    });
  };
  const tabs: [Tab, string, typeof Trophy][] = [
    ["next", "Next up", Sparkles],
    ["collection", "Feats", Trophy],
    ["club", "Club", Users],
  ];
  return createPortal(
    <div className="dh-feats" data-tab={tab}>
      <div className="dh-feat-atmosphere" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className="dh-feats-header">
        <Link
          to="/dashboard"
          className="dh-icon-button"
          aria-label="Back to DH home"
        >
          <ArrowLeft size={21} />
        </Link>
        <div>
          <small>YOUR CLUB. YOUR LEGACY.</small>
          <h1>DH SCORE</h1>
        </div>
        <button
          className="dh-icon-button"
          aria-label="Refresh DH Score"
          onClick={() => {
            void result.refetch();
          }}
          disabled={result.isFetching}
        >
          <RefreshCw size={18} className={result.isFetching ? "dh-spin" : ""} />
        </button>
        <button
          className="dh-icon-button"
          aria-label="About DH Score"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={20} />
        </button>
      </header>
      <section className="dh-score-hero" aria-label="Your lifetime DH Score">
        <FeatCrest level={rank.level} />
        <div className="dh-score-identity">
          <small>
            {rank.name} <span>· LEVEL {rank.level}</span>
          </small>
          <motion.strong
            key={board?.score || 0}
            initial={reduced ? false : { opacity: 0.4, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {board ? Number(board.score).toLocaleString() : "—"}
            <span>DH</span>
          </motion.strong>
          <div className="dh-rank-meter">
            <progress
              value={rank.progress}
              max={1}
              aria-label="DH rank progress"
            />
            <span>
              {rank.next
                ? `${rank.remaining.toLocaleString()} to ${rank.next.name}`
                : "DH ICON · MAX RANK"}
            </span>
          </div>
        </div>
        <div className="dh-hero-totals">
          <strong>{board?.unlocked || 0}</strong>
          <small>FEATS</small>
        </div>
      </section>
      <main className="dh-feats-workspace">
        {result.isError ? (
          <div className="dh-empty" role="alert">
            <RefreshCw />
            <strong>Score couldn’t sync</strong>
            <span>Try again to load your saved progress.</span>
            <button
              className="dh-button"
              onClick={() => {
                void result.refetch();
              }}
            >
              Retry sync
            </button>
          </div>
        ) : !board ? (
          <div className="dh-empty" role="status">
            <Loader2 className="dh-spin" />
            <strong>Syncing your legacy…</strong>
            <span>Finding your feats across DH.</span>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="dh-tab-panel"
              key={tab}
              initial={reduced ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
            >
              {tab === "next" && (
                <section className="dh-panel dh-next-panel">
                  <div className="dh-panel-heading">
                    <h2>
                      {tracked.length ? "Your next feats" : "Within reach"}
                    </h2>
                    <button onClick={() => setTab("collection")}>
                      {tracked.length
                        ? `${tracked.length}/3 tracked`
                        : "Find a feat"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <PagedFeats
                    feats={[
                      ...tracked,
                      ...recommendations.filter(
                        (f) => !board.pinned.includes(f.key),
                      ),
                    ].slice(0, 6)}
                    board={board}
                    onSelect={setSelected}
                    empty="Every available feat mastered"
                  />
                  <button
                    className="dh-collection-link"
                    onClick={() => setTab("collection")}
                  >
                    <Trophy size={17} />
                    <span>
                      <strong>Your trophy cabinet</strong>
                      <small>
                        {board.unlocked} unlocked · {available.length} feat
                        families
                      </small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                </section>
              )}
              {tab === "collection" && (
                <section className="dh-panel dh-collection-panel">
                  <div className="dh-panel-heading">
                    <h2>The feat collection</h2>
                    <small>
                      {list.length} {list.length === 1 ? "family" : "families"}
                    </small>
                  </div>
                  <div className="dh-feat-filters">
                    <label className="dh-search">
                      <Search size={17} />
                      <input
                        type="search"
                        placeholder="Find your next feat"
                        aria-label="Search feats"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                      />
                      {term && (
                        <button
                          aria-label="Clear feat search"
                          onClick={() => setTerm("")}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </label>
                    <select
                      aria-label="Feat feature"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">All features</option>
                      {categoryOptions.map(([key, meta]) => (
                        <option key={key} value={key}>
                          {meta.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Feat progress filter"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">All feats</option>
                      <option value="progress">In progress</option>
                      <option value="earned">Earned</option>
                      <option value="mastered">Mastered</option>
                    </select>
                  </div>
                  <PagedFeats
                    feats={list}
                    board={board}
                    onSelect={setSelected}
                    empty="No matching feats"
                  />
                </section>
              )}
              {tab === "club" && <ClubBoard board={board} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <nav className="dh-feats-nav" aria-label="DH Score views">
        {tabs.map(([key, label, Icon], i) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? (i + 1) % 3
                  : e.key === "ArrowLeft"
                    ? (i + 2) % 3
                    : -1;
              if (next >= 0) {
                e.preventDefault();
                setTab(tabs[next][0]);
                document.getElementById("dh-tab-" + tabs[next][0])?.focus();
              }
            }}
            id={"dh-tab-" + key}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <Dialog
      open={!!feat&&!reveal}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="dh-feats dh-feat-dialog">
          <DialogTitle>{feat?.title || "DH Feat"}</DialogTitle>
          <DialogDescription className="sr-only">
            Feat requirements, tiers and tracking.
          </DialogDescription>
          {feat && p && board && (
            <>
              <div className="dh-dialog-scroll">
                <div className="dh-detail-badge" data-tier={p.index}>
                  <FeatIcon
                    name={FEAT_CATEGORIES[feat.category]?.icon || "Sparkles"}
                    size={36}
                  />
                  <small>
                    {FEAT_CATEGORIES[feat.category]?.name} · {feat.kind}
                  </small>
                </div>
                <p className="dh-detail-description">{feat.description}</p>
                <div className="dh-detail-current">
                  <span>{formatFeatValue(p.current, feat.unit)}</span>
                  <small>
                    {p.maxed
                      ? "Mastered"
                      : `Next: ${formatFeatValue(p.target, feat.unit)}`}
                  </small>
                </div>
                <progress
                  value={p.progress}
                  max={1}
                  aria-label="Next tier progress"
                />
                <div className="dh-tier-list">
                  {feat.thresholds.map((target, i) => {
                    const receipt = board.unlocks.find(
                      (u) => u.feat_key === feat.key && u.tier === i + 1,
                    );
                    return (
                      <div key={i} data-earned={!!receipt} data-tier={i}>
                        <span>
                          {receipt ? <Check size={16} /> : <Trophy size={16} />}
                        </span>
                        <span>
                          <strong>{FEAT_TIERS[i]}</strong>
                          <small>
                            {formatFeatValue(target, feat.unit)}
                            {receipt?.historical
                              ? " · Saved history"
                              : receipt
                                ? " · Unlocked"
                                : ""}
                          </small>
                        </span>
                        <strong>+{receipt?.points ?? feat.points[i]} DH</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="dh-detail-actions">
                <button
                  className="dh-button dh-button-secondary"
                  onClick={togglePin}
                  disabled={
                    result.pins.isPending ||
                    (!board.pinned.includes(feat.key) &&
                      board.pinned.length >= 3)
                  }
                >
                  <Pin size={16} />
                  {board.pinned.includes(feat.key)
                    ? "Untrack feat"
                    : board.pinned.length >= 3
                      ? "3 goals tracked"
                      : "Track this feat"}
                </button>
                {!FEAT_CATEGORIES[feat.category]?.asset ||
                isInstalled(FEAT_CATEGORIES[feat.category].asset) ? (
                  <Link
                    className="dh-button"
                    to={FEAT_CATEGORIES[feat.category]?.path || "/club"}
                  >
                    Jump in
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <span className="dh-board-note">
                    This app is currently unavailable in your club.
                  </span>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="dh-feats dh-feat-dialog">
          <DialogTitle>Your DH legacy</DialogTitle>
          <DialogDescription>
            Every feature can move your story forward.
          </DialogDescription>
          <div className="dh-dialog-scroll dh-help">
            <FeatCrest level={rank.level} />
            <p>
              Complete feats across games, workouts and club life. Every earned
              tier adds to your permanent DH Score.
            </p>
            <div className="dh-help-tiers">
              {FEAT_TIERS.map((t, i) => (
                <span key={t} data-tier={i}>
                  {t}
                  <strong>+{[10, 20, 40, 80, 150][i]} DH</strong>
                </span>
              ))}
            </div>
            <p>
              Track up to three goals. Existing saved history counts toward your
              lifetime score; monthly standings count new unlocks.
            </p>
            <p>
              DH Score is a shared achievement total. Game credits, workout fuel
              and competition points keep working in their own features.
            </p>
          </div>
          <button className="dh-button" onClick={() => setHelp(false)}>
            Let’s go
            <ArrowRight size={16} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!reveal}
        onOpenChange={(open) => {
          if (!open) dismissReveal();
        }}
      >
        <DialogContent className="dh-feats dh-feat-dialog dh-unlock-dialog">
          <DialogTitle>
            {reveal?.items.length === 1 ? "FEAT UNLOCKED" : "FEATS UNLOCKED"}
          </DialogTitle>
          <DialogDescription>
            Your saved achievements just grew.
          </DialogDescription>
          <FeatCrest level={rank.level} />
          <strong className="dh-unlock-score">
            +{reveal?.items.reduce((sum, u) => sum + u.points, 0) || 0}
            <small>DH SCORE</small>
          </strong>
          <div className="dh-dialog-scroll dh-unlock-items">
            {reveal?.items.map((u) => (
              <div key={u.feat_key + u.tier}>
                <Check size={16} />
                <span>
                  {board?.catalog.find((f) => f.key === u.feat_key)?.title}
                  <small>{FEAT_TIERS[u.tier - 1]}</small>
                </span>
                <strong>+{u.points}</strong>
              </div>
            ))}
          </div>
          <button className="dh-button" onClick={dismissReveal}>
            Keep going
            <ArrowRight size={17} />
          </button>
        </DialogContent>
      </Dialog>
    </div>,
    document.body,
  );
}

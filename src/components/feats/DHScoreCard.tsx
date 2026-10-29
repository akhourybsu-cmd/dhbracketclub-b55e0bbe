import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { useDHScore } from "@/hooks/useDHFeats";
import { dhRank } from "@/lib/feats/progression";

// A route transition after an activity prompts a fresh evaluation. Source-table
// triggers mark dirty accounts; unchanged accounts return cached totals cheaply.
export function DHScoreSync() {
  const { pathname } = useLocation(),
    { user } = useAuth(),
    { club } = useClub(),
    cache = useQueryClient();
  const uid = user?.id,
    clubId = club?.id;
  useDHScore();
  useEffect(() => {
    if (!uid || !clubId || pathname === "/feats") return;
    const timer = setTimeout(() => {
      void cache.invalidateQueries({ queryKey: ["dh-score", uid, clubId] });
    }, 1200);
    return () => clearTimeout(timer);
  }, [pathname, uid, clubId, cache]);
  return null;
}
export function DHScoreCard() {
  const { data, isError } = useDHScore();
  const rank = dhRank(data?.score || 0);
  return (
    <Link
      to="/feats"
      className="mb-4 flex min-h-[88px] items-center gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-card p-4 shadow-[var(--shadow-card)]"
      aria-label="Open DH Score and feats"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <Trophy className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
          DH Score · {rank.name}
        </span>
        <strong className="mt-0.5 block text-2xl font-bold tabular-nums">
          {data
            ? data.score.toLocaleString() + " DH"
            : isError
              ? "Open to retry"
              : "…"}
        </strong>
        <span className="text-xs text-muted-foreground">
          {data
            ? `${data.unlocked} feats unlocked`
            : "Your achievements across DH"}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 text-primary" />
    </Link>
  );
}

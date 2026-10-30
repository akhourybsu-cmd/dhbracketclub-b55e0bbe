import { RuneRewardContext } from "@/hooks/useRuneRewardReveal";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Droplet,
  Feather,
  Flame,
  Heart,
  Hourglass,
  Sun,
  Sword,
  Wind,
  Zap,
  Crown,
  Gem,
  Shield,
  Sparkles,
  Star,
  Swords,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RELIC_BY_ID } from "@/lib/runedelve/relics";
import { RuneEnemyArt } from "./RuneArtwork";
import { RelicGlyph } from "./RelicGlyph";
import { RunePager } from "./RunePager";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import "./runeRewards.css";

import type {
  RuneRewardItem,
  RuneRewardReveal,
} from "@/lib/runedelve/rewardPresentation";
export type {
  RuneRewardItem,
  RuneRewardReveal,
} from "@/lib/runedelve/rewardPresentation";
const historyKey = (userId: string) => `rd-reward-seen:v1:${userId}`;
function readHistory(userId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(historyKey(userId)) ?? "[]",
    );
    return new Set(
      Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string").slice(-80)
        : [],
    );
  } catch {
    return new Set();
  }
}

/** Only explicit, confirmed acquisition handlers enqueue reveals. Reads/restores never do. */
export function RuneRewardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <AccountRewardQueue key={user?.id ?? "guest"} userId={user?.id ?? null}>
      {children}
    </AccountRewardQueue>
  );
}
function AccountRewardQueue({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const active = useRef(true);
  const identity = useRef(userId);
  identity.current = userId;
  const seen = useRef(userId ? readHistory(userId) : new Set<string>());
  const [queue, setQueue] = useState<RuneRewardReveal[]>([]);
  // A stale async response from an unmounted account cannot enqueue for its successor.
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const reveal = useCallback(
    (reward: RuneRewardReveal) => {
      if (
        !active.current ||
        !userId ||
        identity.current !== userId ||
        !reward.id ||
        !reward.items.length ||
        seen.current.has(reward.id)
      )
        return;
      seen.current.add(reward.id);
      setQueue((current) => [...current, reward]);
    },
    [userId],
  );
  const acknowledge = useCallback(() => {
    const reward = queue[0];
    if (!reward) return;
    if (userId) {
      const history = readHistory(userId);
      history.add(reward.id);
      try {
        sessionStorage.setItem(
          historyKey(userId),
          JSON.stringify([...history].slice(-80)),
        );
      } catch {
        /* Optional device storage. */
      }
    }
    setQueue((current) =>
      current[0]?.id === reward.id ? current.slice(1) : current,
    );
  }, [queue, userId]);
  const reward = queue[0];
  const continueButton = useRef<HTMLButtonElement>(null);
  const focus = useRuneDialogFocus();
  return (
    <RuneRewardContext.Provider value={{ reveal }}>
      {children}
      <Dialog
        open={!!reward}
        onOpenChange={(open) => {
          if (!open) acknowledge();
        }}
      >
        {reward && (
          <DialogContent
            className="rd-dialog-theme rd-reward-dialog"
            {...focus}
            onOpenAutoFocus={(event) => {
              focus.onOpenAutoFocus();
              event.preventDefault();
              continueButton.current?.focus({ preventScroll: true });
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <header className="rd-reward-heading">
              <p className="rd-reward-brand">
                DH CLUB <span>✦</span> RUNE DELVE
              </p>
              <p className="rd-reward-eyebrow">
                {reward.eyebrow ?? "Acquired"}
              </p>
              <DialogTitle className="rd-title">{reward.title}</DialogTitle>
              <DialogDescription>
                {reward.detail ??
                  "Your progress is saved. Make it part of your next adventure."}
              </DialogDescription>
            </header>
            <RuneRewardGallery key={reward.id} items={reward.items} />
            <button
              ref={continueButton}
              type="button"
              className="rd-reward-continue rd-btn-juice"
              onClick={acknowledge}
            >
              Continue <span aria-hidden="true">→</span>
            </button>
            {queue.length > 1 && (
              <span className="rd-reward-queued">
                {queue.length - 1} more reward{queue.length > 2 ? "s" : ""}
              </span>
            )}
          </DialogContent>
        )}
      </Dialog>
    </RuneRewardContext.Provider>
  );
}

const ICONS = {
  relic: Gem,
  shards: Gem,
  xp: Star,
  mastery: Swords,
  title: Crown,
  slot: Shield,
  blessing: Sparkles,
  discovery: BookOpen,
  level: Star,
};
const BLESSING_GLYPHS: Record<string, typeof Sparkles> = {
  sword: Sword,
  zap: Zap,
  heart: Heart,
  shield: Shield,
  droplet: Droplet,
  sun: Sun,
  wind: Wind,
  sparkles: Sparkles,
  crown: Crown,
  flame: Flame,
  feather: Feather,
  hourglass: Hourglass,
};
const KIND_LABELS = {
  relic: "Relic",
  shards: "Shards banked",
  xp: "Class experience",
  mastery: "Mastery unlocked",
  title: "Title unlocked",
  slot: "Loadout expanded",
  blessing: "Blessing acquired",
  discovery: "Bestiary discovery",
  level: "Class level gained",
};

/** Reused inside existing centered result screens, avoiding two stacked dialogs. */
export function RuneRewardGallery({
  items,
  compact = false,
}: {
  items: RuneRewardItem[];
  compact?: boolean;
}) {
  const [requestedPage, setPage] = useState(0);
  const index = Math.min(requestedPage, Math.max(0, items.length - 1));
  const item = items[index];
  if (!item) return null;
  const Icon =
    (item.kind === "blessing" && item.glyph
      ? BLESSING_GLYPHS[item.glyph]
      : null) ?? ICONS[item.kind];
  const relic = item.relicId ? RELIC_BY_ID[item.relicId] : null;
  return (
    <section
      className={`rd-reward-gallery${compact ? " is-compact" : ""}`}
      aria-label="Acquired rewards"
    >
      <article
        key={`${index}:${item.label}`}
        className="rd-reward-spotlight"
        data-kind={item.kind}
      >
        <div className="rd-reward-object" aria-hidden="true">
          <span className="rd-reward-halo" />
          {relic ? (
            <RelicGlyph relic={relic} />
          ) : item.kind === "discovery" ? (
            <RuneEnemyArt name={item.label} />
          ) : (
            <Icon strokeWidth={1.3} />
          )}
          {item.rank && <span className="rd-reward-rank">R{item.rank}</span>}
        </div>
        <div className="rd-reward-copy">
          <p className="rd-reward-eyebrow">{KIND_LABELS[item.kind]}</p>
          <h3>
            {item.amount !== undefined
              ? `+${item.amount.toLocaleString()} `
              : ""}
            {item.label}
          </h3>
          {item.detail && <p>{item.detail}</p>}
        </div>
      </article>
      {items.length > 1 && (
        <RunePager
          page={index}
          pageCount={items.length}
          onPageChange={setPage}
          label="Acquired rewards"
        />
      )}
    </section>
  );
}

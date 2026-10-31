import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArrowRight,
  Check,
  Compass,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useRunePuzzleProgress,
  useSelectRunePuzzleAvatar,
} from "@/hooks/useRunePuzzles";
import { PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";
import { CLASS_LIST, type HeroClass } from "@/lib/runedelve/classConfig";
import {
  RuneHeroArt,
  RUNE_PORTAL_ART,
} from "@/components/runedelve/RuneArtwork";
import {
  PuzzleDataState,
  PuzzleStars,
} from "@/components/runedelve/RunePuzzleChrome";
import { puzzleRoomHref } from "@/lib/runedelve/puzzles/links";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRuneDialogFocus } from "@/components/runedelve/useRuneDialogFocus";

export default function RunePuzzleHomePage() {
  const { user } = useAuth();
  return <RunePuzzleHomeScreen key={user?.id ?? "guest"} />;
}

/** Account changes discard transient chooser state and its async callbacks. */
function RunePuzzleHomeScreen() {
  const query = useRunePuzzleProgress();
  const selectAvatar = useSelectRunePuzzleAvatar();
  const { user } = useAuth();
  const scope = useRef(user?.id);
  scope.current = user?.id;
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [choosing, setChoosing] = useState<HeroClass | null>(null);
  const focus = useRuneDialogFocus();
  if (query.isLoading)
    return <PuzzleDataState retry={() => void query.refetch()} />;
  if (query.isError || !query.data)
    return <PuzzleDataState error retry={() => void query.refetch()} />;
  const progress = query.data;
  const complete = progress.completed >= PUZZLE_ROOMS.length;
  const room = complete
    ? (PUZZLE_ROOMS.find(
        (r) =>
          (progress.records.find((record) => record.room_id === r.id)?.stars ??
            0) < 3,
      ) ?? PUZZLE_ROOMS[PUZZLE_ROOMS.length - 1])
    : PUZZLE_ROOMS[
        Math.max(0, Math.min(PUZZLE_ROOMS.length - 1, progress.unlocked - 1))
      ];
  const best =
    progress.records.find((record) => record.room_id === room.id)?.stars ?? 0;
  const choose = async (avatar: HeroClass) => {
    if (choosing) return;
    const account = user?.id;
    setChoosing(avatar);
    setAvatarError("");
    try {
      await selectAvatar.mutateAsync(avatar);
      if (scope.current === account) setAvatarOpen(false);
    } catch (error) {
      if (scope.current === account)
        setAvatarError(
          error instanceof Error
            ? error.message
            : "Your appearance could not be saved. Try again.",
        );
    } finally {
      if (scope.current === account) setChoosing(null);
    }
  };
  return (
    <section className="rd-screen rp-screen rp-home" data-testid="puzzle-home">
      <div className="rp-home-scene">
        <img src={RUNE_PORTAL_ART} alt="" className="rp-home-art" />
        <div className="rp-home-copy">
          <p className="rp-eyebrow">
            <Sparkles size={13} /> RUNE DELVE
          </p>
          <h1>The Living Hollow</h1>
          <p>Restore the runes. Find your way out.</p>
          <Link className="rp-primary rd-btn-juice" to={puzzleRoomHref(room)}>
            <span>
              {complete
                ? progress.stars >= PUZZLE_ROOMS.length * 3
                  ? "Return to the vault"
                  : "Chase your next star"
                : progress.completed
                  ? "Continue journey"
                  : "Enter the Hollow"}
              <small>
                Chamber {room.order} · {room.title}
              </small>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="rp-home-progress" aria-label="Journey progress">
        <div>
          <b>
            {progress.completed}
            <small> / {PUZZLE_ROOMS.length}</small>
          </b>
          <span>Chambers restored</span>
        </div>
        <div>
          <b>
            <Star size={16} fill="currentColor" />
            {progress.stars}
            <small> / {PUZZLE_ROOMS.length * 3}</small>
          </b>
          <span>Mastery stars</span>
        </div>
        <button
          type="button"
          className="rp-avatar-select"
          onClick={() => setAvatarOpen(true)}
          aria-label="Choose delver appearance"
        >
          <span>
            <RuneHeroArt cls={progress.avatar} />
          </span>
          <UserRound size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="rp-home-links">
        <Link to="/rune-delve/journey" className="rp-menu-link">
          <Compass />
          <span>
            Chambers<small>Three worlds to unravel</small>
          </span>
          <ArrowRight />
        </Link>
        <Link to="/rune-delve/legacy" className="rp-menu-link">
          <Archive />
          <span>
            Legacy archive<small>Your combat adventures</small>
          </span>
          <ArrowRight />
        </Link>
      </div>
      {complete && (
        <p className="rp-home-finish">
          The portal is restored. Every chamber still holds a perfect route.
        </p>
      )}
      <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
        <DialogContent {...focus} className="rd-dialog-theme rp-avatar-dialog">
          <DialogTitle className="rd-title">Choose your delver</DialogTitle>
          <DialogDescription>
            Four legends. The same puzzle rules.
          </DialogDescription>
          <div className="rp-avatar-grid">
            {CLASS_LIST.map((hero) => (
              <button
                key={hero.id}
                type="button"
                aria-pressed={progress.avatar === hero.id}
                disabled={!!choosing}
                onClick={() => void choose(hero.id)}
              >
                <span>
                  <RuneHeroArt cls={hero.id} />
                </span>
                <b>{hero.name}</b>
                {progress.avatar === hero.id && (
                  <Check size={15} aria-hidden="true" />
                )}
                {choosing === hero.id && <small>Saving…</small>}
              </button>
            ))}
          </div>
          {avatarError && (
            <p className="rp-error" role="alert">
              {avatarError}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <span className="sr-only">
        <PuzzleStars count={best} label="Current chamber mastery" />
      </span>
    </section>
  );
}

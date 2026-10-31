import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Star, Volume2, VolumeX } from "lucide-react";
import { useRunePuzzleProgress } from "@/hooks/useRunePuzzles";
import { useSoundSettings } from "@/hooks/useSoundSettings";
import { PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RuneSoundSettings } from "./RuneSoundSettings";
import { RunePuzzleGuide } from "./RunePuzzleGuide";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import "./runeDialogs.css";
import "./runePuzzleFrame.css";

export function RunePuzzleHUD() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data } = useRunePuzzleProgress();
  const { settings } = useSoundSettings();
  const [guideOpen, setGuideOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const guideFocus = useRuneDialogFocus();
  const soundFocus = useRuneDialogFocus();
  const playing = pathname.startsWith("/rune-delve/chamber/");
  return (
    <>
      <header className="rd-puzzle-hud">
        <button
          type="button"
          aria-label={
            pathname === "/rune-delve" ? "Exit Rune Delve" : "Back to journey"
          }
          onClick={() =>
            navigate(
              pathname === "/rune-delve" ? "/compete" : "/rune-delve/journey",
            )
          }
        >
          <ArrowLeft size={20} />
        </button>
        <Link
          to="/rune-delve"
          className="rd-puzzle-hud-brand"
          aria-label="Rune Delve Sanctum"
        >
          <strong className="rd-title">Rune Delve</strong>
          <small>
            {playing ? "The living labyrinth" : "An exploration adventure"}
          </small>
        </Link>
        {!playing && (
          <button
            type="button"
            aria-label="Sound settings"
            onClick={() => setSoundOpen(true)}
          >
            {settings.master ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        )}
        <button
          type="button"
          aria-label="Open puzzle guide"
          onClick={() => setGuideOpen(true)}
        >
          <BookOpen size={18} />
        </button>
        <Link
          to="/rune-delve/journey"
          className="rd-puzzle-hud-stars"
          aria-label={`${data?.stars ?? 0} of ${PUZZLE_ROOMS.length * 3} mastery stars`}
        >
          <Star size={15} aria-hidden="true" />
          <b>{data?.stars ?? 0}</b>
        </Link>
      </header>
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent
          {...guideFocus}
          className="rd-dialog-theme rd-paged-dialog rd-puzzle-guide-dialog"
        >
          <DialogHeader className="rd-dialog-header">
            <DialogTitle className="rd-title">The chamber guide</DialogTitle>
            <DialogDescription>
              Read the room. Find your way through.
            </DialogDescription>
          </DialogHeader>
          {guideOpen && <RunePuzzleGuide />}
          <button
            className="rd-dialog-primary"
            type="button"
            onClick={() => setGuideOpen(false)}
          >
            Return to the chamber
          </button>
        </DialogContent>
      </Dialog>
      <Sheet open={soundOpen} onOpenChange={setSoundOpen}>
        <SheetContent
          {...soundFocus}
          side="bottom"
          className="rd-dialog-theme rd-audio-sheet"
        >
          <SheetHeader>
            <SheetTitle>Sound &amp; Haptics</SheetTitle>
          </SheetHeader>
          <RuneSoundSettings />
        </SheetContent>
      </Sheet>
    </>
  );
}

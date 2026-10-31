import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRunePuzzleProgress } from "@/hooks/useRunePuzzles";
import { PUZZLE_CHAPTERS, PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";
import {
  PuzzleChapterArt,
  PuzzleDataState,
  PuzzleStars,
} from "@/components/runedelve/RunePuzzleChrome";
import { puzzleRoomHref } from "@/lib/runedelve/puzzles/links";

export default function RunePuzzleJourneyPage() {
  const query = useRunePuzzleProgress();
  const { user } = useAuth();
  const [chapter, setChapter] = useState(1);
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    if (!query.data || initialized.current === user?.id) return;
    initialized.current = user?.id ?? null;
    setChapter(Math.min(3, Math.max(1, Math.ceil(query.data.unlocked / 6))));
  }, [query.data, user?.id]);
  if (query.isLoading)
    return <PuzzleDataState retry={() => void query.refetch()} />;
  if (query.isError || !query.data)
    return <PuzzleDataState error retry={() => void query.refetch()} />;
  const progress = query.data,
    meta = PUZZLE_CHAPTERS.find((item) => item.id === chapter)!;
  return (
    <section
      className="rd-screen rp-screen rp-journey"
      data-testid="puzzle-journey"
    >
      <header className="rp-heading">
        <div>
          <p className="rp-eyebrow">THE JOURNEY</p>
          <h1>Chambers of the Hollow</h1>
        </div>
        <span className="rp-total-stars">
          ✦ {progress.stars}/{PUZZLE_ROOMS.length * 3}
        </span>
      </header>
      <nav className="rp-chapter-tabs" aria-label="Puzzle chapters">
        {PUZZLE_CHAPTERS.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={chapter === item.id}
            onClick={() => setChapter(item.id)}
          >
            <span>0{item.id}</span>
            {item.title}
          </button>
        ))}
      </nav>
      <PuzzleChapterArt chapter={chapter} className="rp-journey-banner">
        <div>
          <p className="rp-eyebrow">CHAPTER 0{chapter}</p>
          <h2>{meta.title}</h2>
          <p>{meta.subtitle}</p>
        </div>
      </PuzzleChapterArt>
      <div className="rp-room-grid rd-motion-collection" key={chapter}>
        {PUZZLE_ROOMS.filter((room) => room.chapter === chapter).map((room) => {
          const record = progress.records.find(
              (item) =>
                item.room_id === room.id &&
                item.definition_version === room.version,
            ),
            locked = room.order > progress.unlocked;
          const content = (
            <>
              <span className="rp-room-number">
                {locked ? (
                  <LockKeyhole size={18} />
                ) : (
                  String(room.order).padStart(2, "0")
                )}
              </span>
              <b>{room.title}</b>
              <PuzzleStars
                count={record?.stars ?? 0}
                label={`${room.title} mastery`}
              />
              {!locked && room.order === progress.unlocked && !record && (
                <span className="rp-room-current">
                  NEXT <ArrowRight size={11} />
                </span>
              )}
            </>
          );
          return locked ? (
            <button
              type="button"
              key={room.id}
              className="rp-room-card is-locked"
              disabled
              aria-label={`Chamber ${room.order}: ${room.title}. Locked.`}
            >
              {content}
            </button>
          ) : (
            <Link
              key={room.id}
              to={puzzleRoomHref(room)}
              className="rp-room-card rd-btn-juice"
              aria-label={`Enter chamber ${room.order}: ${room.title}`}
            >
              {content}
            </Link>
          );
        })}
      </div>
      <p className="rp-journey-note">
        Restore a chamber to open the next. Return for a sharper route.
      </p>
    </section>
  );
}

import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { RuneDataState } from "./RuneDataState";
import "./runePuzzles.css";

export function PuzzleStars({
  count,
  label = "Mastery",
}: {
  count: number;
  label?: string;
}) {
  return (
    <span
      className="rp-stars"
      role="img"
      aria-label={`${label}: ${count} of 3 stars`}
    >
      {[1, 2, 3].map((star) => (
        <Star
          key={star}
          className={star <= count ? "is-earned" : ""}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function PuzzleDataState({
  error,
  retry,
}: {
  error?: boolean;
  retry: () => void;
}) {
  return (
    <section className="rd-screen rp-screen rp-data">
      <RuneDataState
        error={error}
        onRetry={retry}
        label="Opening the Hollow…"
      />
    </section>
  );
}

export function PuzzleChapterArt({
  chapter,
  children,
  className = "",
}: {
  chapter: number;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rp-chapter-art ${className}`} data-chapter={chapter}>
      <span className="rp-chapter-image" aria-hidden="true" />
      {children}
    </div>
  );
}

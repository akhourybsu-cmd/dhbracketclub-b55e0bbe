import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Explicit pages keep every collection reachable without a scrolling panel. */
export function RunePager({
  page,
  pageCount,
  onPageChange,
  label = "Collection",
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
}) {
  const count = Math.max(1, Math.floor(pageCount) || 1);
  const current = Math.max(0, Math.min(count - 1, Math.floor(page) || 0));
  if (count <= 1) return null;
  return (
    <nav
      className={cn("rd-pager", className)}
      aria-label={`${label} pages`}
      data-rune-pager
      data-page={current}
      data-page-count={count}
    >
      <button
        type="button"
        aria-label={`Previous ${label.toLowerCase()} page`}
        disabled={current === 0}
        onClick={() => onPageChange(current - 1)}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span aria-live="polite" aria-atomic="true">
        <span className="sr-only">{label} page </span>
        <b>{current + 1}</b>
        <span aria-hidden="true"> / </span>
        <span className="sr-only"> of </span>
        {count}
      </span>
      <button
        type="button"
        aria-label={`Next ${label.toLowerCase()} page`}
        disabled={current === count - 1}
        onClick={() => onPageChange(current + 1)}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </nav>
  );
}

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

/** Loading always has a timed recovery path, including a never-settling request. */
export function RuneDataState({
  error = false,
  onRetry,
  label = "Preparing your hero…",
}: {
  error?: boolean;
  loading?: boolean;
  label?: string;
  onRetry: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div
      className="glass-card p-8 min-h-48 flex flex-col items-center justify-center text-center gap-3"
      role="status"
    >
      {error ? (
        <RefreshCw className="h-7 w-7 text-primary" />
      ) : (
        <Loader2 className="h-7 w-7 text-primary animate-spin" />
      )}
      <p className="text-sm font-bold">
        {error ? "The dungeon lost your signal" : label}
      </p>
      {(error || slow) && (
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
          >
            Retry
          </button>
          <Link
            to="/rune-delve"
            className="min-h-11 px-4 rounded-xl bg-muted flex items-center text-xs font-bold"
          >
            Base camp
          </Link>
        </div>
      )}
    </div>
  );
}

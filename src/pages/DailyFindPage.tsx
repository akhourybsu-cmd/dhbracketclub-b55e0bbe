import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUp,
  CalendarDays,
  Check,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import {
  useDailyFinds,
  useDropFeed,
  useSearchFinds,
} from "@/hooks/useDailyFinds";
import { FindCard } from "@/components/dailyFind/FindCard";
import { FindCalendar } from "@/components/dailyFind/FindCalendar";
import { ComposeFindSheet } from "@/components/dailyFind/ComposeFindSheet";
import { MemberLoadError } from "@/components/member/MemberLoadError";
import { localDayKey, type DailyFind } from "@/lib/dailyFind";
import { pauseDropPlayback } from "@/lib/dropPlayback";
import "@/components/dailyFind/dropSocial.css";

function Cards({ finds }: { finds: DailyFind[] }) {
  return (
    <div className="drop-social-feed">
      {finds.map((find) => (
        <FindCard key={find.id} find={find} />
      ))}
    </div>
  );
}
function FeedSkeleton() {
  return (
    <div className="drop-feed-loading" role="status" aria-label="Loading Drops">
      {[0, 1].map((n) => (
        <div className="drop-feed-skeleton" key={n} aria-hidden="true">
          <div className="drop-feed-skeleton-author">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-2.5 w-12 rounded" />
            </div>
          </div>
          <Skeleton className="mx-4 mb-4 h-4 w-3/5 rounded" />
          <Skeleton className="drop-feed-skeleton-media rounded-none" />
          <div className="drop-feed-skeleton-actions">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
function Archive() {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [day, setDay] = useState(localDayKey);
  const range = useMemo(
    () => ({
      from: localDayKey(month),
      to: localDayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
    }),
    [month],
  );
  const query = useDailyFinds(range);
  return (
    <>
      <FindCalendar
        month={month}
        onMonthChange={(next) => {
          setMonth(next);
          setDay(localDayKey(next));
        }}
        finds={query.data || []}
        selectedDay={day}
        onSelectDay={setDay}
      />
      {query.isError ? (
        <MemberLoadError onRetry={() => void query.refetch()} compact />
      ) : query.isLoading ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="drop-archive-items">
          <p className="drop-archive-day">
            {new Date(day + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <Cards
            finds={(query.data || []).filter((find) => find.find_date === day)}
          />
          {!(query.data || []).some((find) => find.find_date === day) && (
            <div className="drop-archive-empty">No Drops on this day.</div>
          )}
        </div>
      )}
    </>
  );
}
function SearchResults({ term, tag }: { term: string; tag: string | null }) {
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const query = useSearchFinds(debounced, tag);
  if (term.trim().length < 2 && !tag)
    return <p className="drop-social-empty">Find a post by caption or tag.</p>;
  if (query.isError)
    return <MemberLoadError compact onRetry={() => void query.refetch()} />;
  if (query.isLoading || debounced !== term)
    return <Skeleton className="h-48 rounded-xl" />;
  return query.data?.length ? (
    <Cards finds={query.data} />
  ) : (
    <p className="drop-social-empty">No Drops found. Try another word.</p>
  );
}
export default function DailyFindPage() {
  const { user } = useAuth();
  const { club } = useClub();
  return (
    <DropFeedScreen key={`${user?.id ?? "guest"}:${club?.id ?? "none"}`} />
  );
}
function DropFeedScreen() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<"all" | "mine">("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(
    params.get("tab") === "calendar",
  );
  const [searchOpen, setSearchOpen] = useState(
    params.get("tab") === "search" || params.has("q") || params.has("tag"),
  );
  const [focusSearch, setFocusSearch] = useState(false);
  const [shared, setShared] = useState<{
    title: string;
    url: string;
    note: string;
  } | null>(null);
  const query = useDropFeed(mode);
  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = query;
  const sentinel = useRef<HTMLDivElement>(null);
  const term = params.get("q") || "",
    tag = params.get("tag");
  const finds = useMemo(
    () => [
      ...new Map(
        (query.data?.pages.flat() || []).map((find) => [find.id, find]),
      ).values(),
    ],
    [query.data],
  );
  useEffect(() => {
    if (params.has("q") || params.has("tag") || params.get("tab") === "search")
      setSearchOpen(true);
    if (params.get("tab") === "calendar") setArchiveOpen(true);
    if (params.has("tab"))
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete("tab");
          return next;
        },
        { replace: true },
      );
  }, [params, setParams]);
  useEffect(() => {
    if (
      params.get("compose") !== "1" &&
      !params.has("share_title") &&
      !params.has("share_text") &&
      !params.has("share_url")
    )
      return;
    const title = params.get("share_title") || "",
      text = params.get("share_text") || "",
      url =
        params.get("share_url") || text.match(/https?:\/\/[^\s]+/)?.[0] || "";
    if (title || text || url)
      setShared({
        title: title.slice(0, 160),
        url,
        note: text.replace(url, "").trim().slice(0, 2000),
      });
    setComposeOpen(true);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        ["compose", "share_title", "share_text", "share_url"].forEach((key) =>
          next.delete(key),
        );
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);
  useEffect(() => {
    if (composeOpen || archiveOpen || searchOpen) pauseDropPlayback();
  }, [composeOpen, archiveOpen, searchOpen]);
  useEffect(() => {
    const node = sentinel.current;
    if (
      !node ||
      searchOpen ||
      composeOpen ||
      archiveOpen ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage({ cancelRefetch: false });
      },
      { rootMargin: "500px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    searchOpen,
    composeOpen,
    archiveOpen,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  ]);
  const closeSearch = () => {
    setSearchOpen(false);
    setFocusSearch(false);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        ["q", "tag", "tab"].forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
  };
  const openComposer = () => {
    pauseDropPlayback();
    setComposeOpen(true);
  };
  return (
    <section
      className="drop-page member-page drop-social"
      aria-label="The Drop"
    >
      <header className="drop-social-header">
        <div>
          <h1>The Drop</h1>
          <p>The good stuff, from your club.</p>
        </div>
      </header>
      <button
        className="drop-social-compose"
        onClick={openComposer}
        aria-label="Share a Drop"
      >
        <span className="drop-social-self" aria-hidden="true">
          {Array.from(
            String(user?.user_metadata?.display_name || "You").trim(),
          )[0]?.toLocaleUpperCase() || "Y"}
        </span>
        <span>Share something good…</span>
        <span className="drop-social-compose-add" aria-hidden="true">
          <Plus size={20} />
        </span>
      </button>
      <div className="drop-social-toolbar">
        <div className="drop-social-filter" role="group" aria-label="Drop feed">
          {(["all", "mine"] as const).map((feedMode) => (
            <button
              key={feedMode}
              aria-pressed={!searchOpen && mode === feedMode}
              onClick={() => {
                pauseDropPlayback();
                if (searchOpen) closeSearch();
                setMode(feedMode);
              }}
            >
              {feedMode === "all" ? "Latest" : "Yours"}
            </button>
          ))}
        </div>
        <div
          className="drop-social-tools"
          role="group"
          aria-label="Find a Drop"
        >
          <button
            aria-label={searchOpen ? "Close Drop search" : "Search Drops"}
            aria-pressed={searchOpen}
            onClick={() => {
              if (searchOpen) closeSearch();
              else {
                setFocusSearch(true);
                setSearchOpen(true);
              }
            }}
          >
            {searchOpen ? <X size={19} /> : <Search size={19} />}
          </button>
          <button
            aria-label="Browse Drop archive"
            onClick={() => setArchiveOpen(true)}
          >
            <CalendarDays size={19} />
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className="drop-social-search">
          <label className="sr-only" htmlFor="drop-query">
            Search Drops
          </label>
          <div className="drop-social-search-field">
            <Search size={17} aria-hidden="true" />
            <Input
              id="drop-query"
              type="search"
              value={term}
              placeholder="Search captions or notes"
              onChange={(event) =>
                setParams(
                  (previous) => {
                    const next = new URLSearchParams(previous);
                    next.set("q", event.target.value);
                    return next;
                  },
                  { replace: true },
                )
              }
              autoFocus={focusSearch}
            />
            {term && (
              <button
                aria-label="Clear search text"
                onClick={() =>
                  setParams(
                    (previous) => {
                      const next = new URLSearchParams(previous);
                      next.delete("q");
                      return next;
                    },
                    { replace: true },
                  )
                }
              >
                <X size={17} />
              </button>
            )}
          </div>
          {tag && (
            <button
              aria-label={`Remove tag filter: ${tag}`}
              onClick={() =>
                setParams(
                  (previous) => {
                    const next = new URLSearchParams(previous);
                    next.delete("tag");
                    return next;
                  },
                  { replace: true },
                )
              }
            >
              #{tag} <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {searchOpen ? (
        <SearchResults term={term} tag={tag} />
      ) : query.isPending ? (
        <FeedSkeleton />
      ) : query.isError && !finds.length ? (
        <MemberLoadError onRetry={() => void query.refetch()} />
      ) : finds.length ? (
        <>
          <Cards finds={finds} />
          <div ref={sentinel} className="drop-social-more">
            {query.hasNextPage && (
              <Button
                variant="ghost"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Loading more
                  </>
                ) : query.isFetchNextPageError ? (
                  "Try loading more"
                ) : (
                  "More Drops"
                )}
              </Button>
            )}
            {!query.hasNextPage && (
              <div className="drop-social-end">
                <span>
                  <Check size={16} aria-hidden="true" /> You’re all caught up.
                </span>
                {finds.length > 6 && (
                  <button
                    onClick={() =>
                      document.body.scrollTo({
                        top: 0,
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "auto"
                          : "smooth",
                      })
                    }
                  >
                    <ArrowUp size={15} aria-hidden="true" /> Back to top
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="drop-social-empty">
          <p>
            {mode === "mine"
              ? "Your first Drop starts here."
              : "Something good belongs here."}
          </p>
          <Button onClick={openComposer}>Share a Drop</Button>
        </div>
      )}
      <ComposeFindSheet
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) setShared(null);
        }}
        initial={shared}
        onCreated={() => {
          setMode("all");
          closeSearch();
          document.body.scrollTo({ top: 0, behavior: "auto" });
        }}
      />
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="drop-page drop-archive-dialog">
          <DialogTitle>From the archive</DialogTitle>
          <DialogDescription>Revisit what your club shared.</DialogDescription>
          {archiveOpen && <Archive />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

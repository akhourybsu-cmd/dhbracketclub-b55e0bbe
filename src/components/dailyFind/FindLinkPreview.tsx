/* eslint-disable react-refresh/only-export-components -- Keep the existing preview/helper exports compatible. */
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Globe,
  Loader2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isSafeUrl } from "@/lib/linkParser";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import { dropVideoSource, type DropVideoSource } from "@/lib/dropMedia";
import {
  getDropPlayback,
  pauseDropPlayback,
  requestDropPlayback,
  stopDropPlayback,
  subscribeDropPlayback,
} from "@/lib/dropPlayback";
import "./dropMedia.css";

export { socialEmbed } from "@/lib/dropMedia";

interface Preview {
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  content_type?: string | null;
}
function hostOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
function readableText(value: string | null) {
  if (!value || typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}
export function useLinkPreview(url: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["link-preview", url],
    enabled: enabled && !!url && /^https?:\/\//i.test(url),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("fetch-link-preview", { body: { url } }),
        QUERY_TIMEOUT_MS,
        "Drop link preview",
      );
      if (error || !data || typeof data.title !== "string") return null;
      const string = (value: unknown) =>
        typeof value === "string" ? value : null;
      return {
        title: string(data.title),
        description: string(data.description),
        image_url: string(data.image_url),
        site_name: string(data.site_name),
        content_type: string(data.content_type),
      } satisfies Preview;
    },
  });
}
function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, near };
}
function MediaPoster({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="drop-player-placeholder" aria-hidden="true" />
  );
}
function DropVideo({
  url,
  source,
  preview,
}: {
  url: string;
  source: DropVideoSource;
  preview?: Preview | null;
}) {
  const id = useId();
  const frame = useRef<HTMLDivElement>(null);
  const native = useRef<HTMLVideoElement>(null);
  const playAttempt = useRef(0);
  const position = useRef(0);
  const active = useSyncExternalStore(
    subscribeDropPlayback,
    () => getDropPlayback() === id,
    () => false,
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resumeAt, setResumeAt] = useState(0);
  const contentLabel =
    source.provider === "Video" ? "video" : `${source.provider} video`;
  const title = readableText(preview?.title ?? null) || contentLabel;
  useEffect(() => {
    const element = frame.current;
    const video = native.current;
    const stop = () => {
      if (getDropPlayback() !== id) return;
      video?.pause();
      stopDropPlayback(id);
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    const observer =
      element && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry && entry.intersectionRatio < 0.35) stop();
            },
            { threshold: [0, 0.35, 0.6, 1] },
          )
        : null;
    if (element) observer?.observe(element);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", stop);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", stop);
      stop();
      // A detached media element can keep playing. Release the captured node,
      // because React has already cleared native.current during unmount.
      if (video?.hasAttribute("src")) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [id]);
  useEffect(() => {
    if (!active) {
      playAttempt.current++;
      setLoading(false);
      setBlocked(false);
      setPaused(false);
      const video = native.current;
      if (video && video.hasAttribute("src")) {
        position.current = video.ended
          ? 0
          : Number.isFinite(video.currentTime)
            ? video.currentTime
            : position.current;
        setResumeAt(position.current);
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      return;
    }
    if (!loading) return;
    const timer = window.setTimeout(() => {
      setFailed(true);
      stopDropPlayback(id);
    }, QUERY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [active, id, loading]);
  const playNative = () => {
    const video = native.current;
    if (!video) return;
    const attempt = ++playAttempt.current;
    setBlocked(false);
    setPaused(false);
    if (video.getAttribute("src") !== source.src) video.src = source.src;
    setLoading(video.readyState < 3);
    void video.play().catch((error: unknown) => {
      // A pause, another player or a later retry can settle this old promise.
      if (attempt !== playAttempt.current || getDropPlayback() !== id) return;
      setLoading(false);
      setPaused(true);
      const errorName =
        error && typeof error === "object" && "name" in error
          ? error.name
          : undefined;
      if (errorName === "AbortError" && video.paused) {
        // Native pause controls can reject play() before dispatching pause.
        return;
      } else if (errorName === "NotAllowedError") {
        setBlocked(true);
      } else {
        setFailed(true);
        stopDropPlayback(id);
      }
    });
  };
  const start = () => {
    setFailed(false);
    setBlocked(false);
    setLoading(true);
    requestDropPlayback(id);
    if (source.kind === "native") playNative();
  };
  return (
    <div
      className="drop-video-preview"
      onClick={(event) => event.stopPropagation()}
    >
      <div
        ref={frame}
        className={cn("drop-player-frame", source.tall && "drop-player-tall")}
        data-drop-player={id}
        data-playing={active && !paused}
      >
        {source.kind === "native" && (
          <video
            ref={native}
            controls={active}
            playsInline
            preload="none"
            aria-label={title}
            onLoadedMetadata={() => {
              const video = native.current;
              if (!video || getDropPlayback() !== id || position.current <= 0)
                return;
              const target = Number.isFinite(video.duration)
                ? Math.min(position.current, Math.max(0, video.duration - 0.1))
                : position.current;
              video.currentTime = target;
            }}
            onCanPlay={() => {
              setLoading(false);
              setBlocked(false);
            }}
            onPlaying={() => {
              setLoading(false);
              setBlocked(false);
              setPaused(false);
            }}
            onWaiting={() => {
              if (getDropPlayback() === id && !native.current?.paused)
                setLoading(true);
            }}
            onSeeked={() => {
              setLoading(false);
            }}
            onPlay={() => {
              if (native.current?.hasAttribute("src")) {
                requestDropPlayback(id);
                setPaused(false);
              }
            }}
            onPause={() => {
              if (getDropPlayback() !== id) return;
              playAttempt.current++;
              setLoading(false);
              setPaused(true);
            }}
            onEnded={() => {
              position.current = 0;
              setResumeAt(0);
              stopDropPlayback(id);
            }}
            onError={() => {
              if (getDropPlayback() !== id) return;
              setFailed(true);
              stopDropPlayback(id);
            }}
          />
        )}
        {active && source.kind === "iframe" && (
          <iframe
            src={source.src}
            title={title}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoading(false)}
            onError={() => {
              setFailed(true);
              stopDropPlayback(id);
            }}
          />
        )}
        {!active && (
          <>
            <MediaPoster url={preview?.image_url || source.poster} />
            <div className="drop-player-shade" />
            <button
              className="drop-player-play"
              type="button"
              onClick={start}
              aria-label={
                failed
                  ? `Retry ${contentLabel}`
                  : resumeAt > 0
                    ? `Resume ${contentLabel}`
                    : `Play ${contentLabel}`
              }
            >
              {failed ? (
                <RotateCcw size={25} />
              ) : (
                <Play size={27} fill="currentColor" />
              )}
            </button>
            {failed && (
              <span className="drop-player-error" role="status">
                Player unavailable. Retry or open the source.
              </span>
            )}
          </>
        )}
        {active && loading && (
          <div className="drop-player-loading" role="status">
            <Loader2 size={22} className="animate-spin" />
            <span>Loading video</span>
          </div>
        )}
        {active && blocked && (
          <button
            className="drop-player-play"
            type="button"
            aria-label="Play video"
            onClick={() => {
              playNative();
            }}
          >
            <Play fill="currentColor" size={27} />
          </button>
        )}
      </div>
      <div className="drop-player-footer">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.stopPropagation();
            pauseDropPlayback();
          }}
          aria-label={
            source.provider === "Video"
              ? "Open video source"
              : `Open on ${source.provider}`
          }
        >
          <span>
            {source.provider === "Video" ? hostOf(url) : source.provider}
          </span>
          <ExternalLink size={13} />
        </a>
        {active && (
          <button
            type="button"
            onClick={() => {
              if (source.kind === "iframe") stopDropPlayback(id);
              else if (paused) playNative();
              else native.current?.pause();
            }}
            aria-label={paused ? "Resume video" : "Pause video"}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
            <span>{paused ? "Resume" : "Pause"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
export function FindLinkPreview({
  url,
  compact,
  immersive,
  className,
}: {
  url: string;
  compact?: boolean;
  immersive?: boolean;
  className?: string;
}) {
  const { ref, near } = useNearViewport();
  const { data, isFetching } = useLinkPreview(url, near);
  const source = dropVideoSource(url);
  const host = hostOf(url);
  const title = readableText(data?.title ?? null);
  const description = readableText(data?.description ?? null);
  if (!isSafeUrl(url) || !/^https?:\/\//i.test(url)) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "drop-media-preview",
        immersive && "drop-media-immersive",
        className,
      )}
    >
      {source ? (
        <DropVideo key={url} url={url} source={source} preview={data} />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("drop-link-card", compact && "drop-link-card-compact")}
          onClick={(event) => {
            event.stopPropagation();
            pauseDropPlayback();
          }}
        >
          <div className="drop-link-card-image">
            <MediaPoster url={data?.image_url} />
            {!data?.image_url && <Globe size={29} aria-hidden="true" />}
          </div>
          <div className="drop-link-card-copy">
            <span className="drop-link-source">
              {data?.site_name || host}
              <ExternalLink size={12} />
            </span>
            <strong>{title || (isFetching ? "Loading preview…" : host)}</strong>
            {description && <p>{description}</p>}
          </div>
        </a>
      )}
    </div>
  );
}

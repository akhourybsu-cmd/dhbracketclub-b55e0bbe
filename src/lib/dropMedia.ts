export interface DropVideoSource {
  provider: string;
  src: string;
  tall: boolean;
  kind: "iframe" | "native";
  poster?: string;
}

function isHost(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Official player URLs only. Never embed HTML returned by a link preview. */
export function dropVideoSource(value: string): DropVideoSource | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return null;
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  let match: RegExpMatchArray | null;
  if (/\.(mp4|webm|m4v|ogv)$/i.test(path))
    return { provider: "Video", src: url.href, tall: false, kind: "native" };
  if (
    isHost(host, "youtube.com") ||
    isHost(host, "youtube-nocookie.com") ||
    host === "youtu.be"
  ) {
    const id =
      host === "youtu.be"
        ? path.split("/")[1]
        : url.searchParams.get("v") ||
          path.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return {
      provider: "YouTube",
      kind: "iframe",
      tall: path.startsWith("/shorts/"),
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
      poster: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  }
  if (
    isHost(host, "tiktok.com") &&
    (match = path.match(/\/video\/(\d+)(?:\/|$)/))
  )
    return {
      provider: "TikTok",
      kind: "iframe",
      src: `https://www.tiktok.com/embed/v2/${match[1]}`,
      tall: true,
    };
  if (
    isHost(host, "instagram.com") &&
    (match = path.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)(?:\/|$)/))
  )
    return {
      provider: "Instagram",
      kind: "iframe",
      src: `https://www.instagram.com/${match[1] === "p" ? "p" : "reel"}/${match[2]}/embed`,
      tall: true,
    };
  if (
    (isHost(host, "x.com") || isHost(host, "twitter.com")) &&
    (match = path.match(/\/status\/(\d+)(?:\/|$)/))
  )
    return {
      provider: "X",
      kind: "iframe",
      src: `https://platform.twitter.com/embed/Tweet.html?id=${match[1]}&dnt=true`,
      tall: true,
    };
  if (
    (isHost(host, "facebook.com") || host === "fb.watch") &&
    (/\/(videos|reel|watch|share\/[vr])(?:\/|$)/.test(path) ||
      host === "fb.watch" ||
      url.searchParams.has("v"))
  )
    return {
      provider: "Facebook",
      kind: "iframe",
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false`,
      tall: /\/(reel|share\/r)(?:\/|$)/.test(path),
    };
  return null;
}

export function socialEmbed(url: string) {
  const source = dropVideoSource(url);
  return source?.kind === "iframe" && source.provider !== "YouTube"
    ? { provider: source.provider, src: source.src, tall: source.tall }
    : null;
}

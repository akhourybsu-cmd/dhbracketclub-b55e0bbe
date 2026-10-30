import type { FindKind } from "@/lib/dailyFind";

function captionSplit(text: string) {
  const newline = text.indexOf("\n");
  if (newline > 0 && newline <= 160) return newline;
  if (text.length <= 160) return text.length;
  const wordBoundary = text.lastIndexOf(" ", 160);
  return wordBoundary >= 80 ? wordBoundary : 160;
}

export function dropCaptionOverflow(caption: string) {
  const text = caption.trim();
  return Math.max(0, text.slice(captionSplit(text)).trim().length - 2000);
}

/** Keep the existing title/note storage while presenting one social caption. */
export function composeDropContent(
  caption: string,
  url: string,
  hasImage: boolean,
) {
  const text = caption.trim();
  const split = captionSplit(text);
  let host = "a link";
  try {
    host = new URL(url).hostname.replace(/^www\./, "") || host;
  } catch {
    /* An unfinished URL is not publishable. */
  }
  const fallback = hasImage
    ? "A photo for the club"
    : url
      ? `Shared from ${host}`
      : "";
  return {
    kind: (hasImage ? "photo" : url ? "article" : "learned") as FindKind,
    title: (text.slice(0, split).trim() || fallback).slice(0, 160),
    note: text.slice(split).trim().slice(0, 2000),
  };
}

export function pastedDropUrl(text: string) {
  const value = text.trim();
  if (!/^https?:\/\/\S+$/i.test(value)) return null;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

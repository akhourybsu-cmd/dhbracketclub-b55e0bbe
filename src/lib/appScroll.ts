/** The shared shell scrolls on body; document/window support other layouts. */
export function getAppScrollTop(): number {
  if (typeof window === "undefined" || typeof document === "undefined")
    return 0;
  return Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop,
    document.body?.scrollTop || 0,
  );
}

export function scrollAppToTop(behavior: ScrollBehavior = "auto"): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  for (const element of [document.body, document.documentElement]) {
    if (!element) continue;
    if (typeof element.scrollTo === "function")
      element.scrollTo({ top: 0, behavior });
    else element.scrollTop = 0;
  }
  window.scrollTo({ top: 0, behavior });
}

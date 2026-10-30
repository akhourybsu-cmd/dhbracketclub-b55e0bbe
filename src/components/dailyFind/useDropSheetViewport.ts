import { useEffect } from "react";

/** Keep portaled sheets and their primary actions above the mobile keyboard. */
export function useDropSheetViewport(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const previousHeight = root.style.getPropertyValue("--drop-sheet-viewport");
    const previousLift = root.style.getPropertyValue("--drop-sheet-lift");
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height || window.innerHeight;
        const bottom = height + (viewport?.offsetTop || 0);
        root.style.setProperty("--drop-sheet-viewport", `${height}px`);
        root.style.setProperty(
          "--drop-sheet-lift",
          `${Math.max(0, window.innerHeight - bottom)}px`,
        );
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (previousHeight)
        root.style.setProperty("--drop-sheet-viewport", previousHeight);
      else root.style.removeProperty("--drop-sheet-viewport");
      if (previousLift)
        root.style.setProperty("--drop-sheet-lift", previousLift);
      else root.style.removeProperty("--drop-sheet-lift");
    };
  }, [open]);
}

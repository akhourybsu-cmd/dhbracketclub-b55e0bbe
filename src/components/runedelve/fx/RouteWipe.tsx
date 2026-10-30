import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";

/** A light passing through the doorway; it never masks the screen or delays input. */
export function RouteWipe() {
  const { pathname } = useLocation();
  const { play } = useRuneDelveSfx();
  const reduced = useReducedMotion();
  const lastPath = useRef(pathname);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const element = ref.current;
    if (!element || reduced || document.hidden || pathname.includes("/play/"))
      return;
    element.classList.remove("is-passing");
    // A new keyframe starts after the previous route has released its light.
    const frame = requestAnimationFrame(() => {
      if (!document.hidden) element.classList.add("is-passing");
    });
    play("tab.switch", { skipHaptic: true });
    const timeout = window.setTimeout(
      () => element.classList.remove("is-passing"),
      440,
    );
    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      element.classList.remove("is-passing");
    };
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [pathname, reduced, play]);
  return <div ref={ref} className="rd-doorway-light" aria-hidden="true" />;
}

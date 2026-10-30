import { useEffect, useState } from "react";

function readViewport() {
  if (typeof window === "undefined") return { width: 390, height: 844 };
  return {
    width: Math.round(window.innerWidth),
    height: Math.round(window.visualViewport?.height || window.innerHeight),
  };
}

/** The visible game area, including browser chrome and the on-screen keyboard. */
export function useRuneViewport() {
  const [viewport, setViewport] = useState(readViewport);
  useEffect(() => {
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readViewport();
        setViewport((current) =>
          current.width === next.width && current.height === next.height
            ? current
            : next,
        );
      });
    };
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, []);
  return {
    ...viewport,
    short: viewport.height < 700,
    landscape: viewport.width > viewport.height,
  };
}

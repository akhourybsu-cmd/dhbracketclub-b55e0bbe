import { useEffect, useRef, useState } from "react";

const KEYBOARD_THRESHOLD_PX = 80;
const MIN_VALID_VIEWPORT_PX = 120;

export interface ChatViewportMeasurement {
  height: number;
  keyboardOpen: boolean;
}

interface ChatViewportInput {
  layoutHeight: number;
  visualHeight?: number;
  visualOffsetTop?: number;
  restingHeight?: number;
  editableFocused?: boolean;
  bottomInset?: number;
}

/** Convert layout/visual viewport readings into chat's safe bottom edge. */
export function measureChatViewport({
  layoutHeight,
  visualHeight,
  visualOffsetTop = 0,
  restingHeight = layoutHeight,
  editableFocused = false,
  bottomInset = 0,
}: ChatViewportInput): ChatViewportMeasurement {
  const safeLayoutHeight =
    Number.isFinite(layoutHeight) && layoutHeight > 0 ? layoutHeight : 0;
  const safeVisualHeight =
    Number.isFinite(visualHeight) && (visualHeight ?? 0) > 0
      ? visualHeight!
      : safeLayoutHeight;
  const safeOffsetTop = Number.isFinite(visualOffsetTop)
    ? Math.max(0, visualOffsetTop)
    : 0;
  const visualBottom = safeVisualHeight + safeOffsetTop;
  const availableHeight = Math.round(
    safeLayoutHeight > 0
      ? Math.min(safeLayoutHeight, visualBottom)
      : visualBottom,
  );
  const height = Math.max(
    0,
    availableHeight -
      (Number.isFinite(bottomInset) ? Math.max(0, bottomInset) : 0),
  );

  return {
    height,
    keyboardOpen: Boolean(
      editableFocused &&
      restingHeight - safeVisualHeight >= KEYBOARD_THRESHOLD_PX,
    ),
  };
}

function editableElementFocused() {
  const active = document.activeElement as HTMLElement | null;
  return Boolean(
    active?.matches('input, textarea, select, [contenteditable="true"]'),
  );
}

/**
 * Keeps full-screen chat pinned to the actually visible viewport. CSS dvh is
 * the no-JS fallback; VisualViewport covers older WebKit plus the keyboard
 * resize modes used by current iOS and Android browsers.
 */
export function useChatViewport() {
  const [height, setHeight] = useState("100dvh");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const restingHeightRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const visualViewport = window.visualViewport;
    const bottomNav = document.querySelector<HTMLElement>(
      "[data-mobile-bottom-nav]",
    );
    let animationFrame = 0;
    const settleTimers = new Set<number>();

    root.classList.add("chat-viewport-active");
    body.classList.add("chat-viewport-active");

    const update = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const layoutHeight = Math.max(
          document.documentElement.clientHeight || 0,
          window.innerHeight || 0,
        );
        const visualHeight = visualViewport?.height ?? layoutHeight;
        const focused = editableElementFocused();

        if (!focused || restingHeightRef.current === 0) {
          restingHeightRef.current = Math.max(layoutHeight, visualHeight);
        }

        const viewportInput = {
          layoutHeight,
          visualHeight,
          visualOffsetTop: visualViewport?.offsetTop ?? 0,
          restingHeight: restingHeightRef.current,
          editableFocused: focused,
        };
        const measurement = measureChatViewport(viewportInput);

        root.classList.toggle("chat-keyboard-open", measurement.keyboardOpen);
        const navHeight =
          !measurement.keyboardOpen &&
          bottomNav &&
          getComputedStyle(bottomNav).display !== "none"
            ? Math.ceil(bottomNav.getBoundingClientRect().height)
            : 0;
        root.classList.toggle("chat-bottom-nav-visible", navHeight > 0);

        // WebKit can briefly report zero during rotation/keyboard animation.
        if (measurement.height >= MIN_VALID_VIEWPORT_PX) {
          const nextHeight = `${measureChatViewport({ ...viewportInput, bottomInset: navHeight }).height}px`;
          setHeight((current) =>
            current === nextHeight ? current : nextHeight,
          );
        }
        setKeyboardOpen((current) =>
          current === measurement.keyboardOpen
            ? current
            : measurement.keyboardOpen,
        );
      });
    };

    const scheduleSettledUpdates = () => {
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      settleTimers.clear();
      update();
      for (const delay of [80, 240, 500]) {
        const timer = window.setTimeout(() => {
          settleTimers.delete(timer);
          update();
        }, delay);
        settleTimers.add(timer);
      }
    };

    const handleOrientationChange = () => {
      restingHeightRef.current = 0;
      scheduleSettledUpdates();
    };

    scheduleSettledUpdates();
    const navObserver = bottomNav ? new ResizeObserver(update) : null;
    if (bottomNav) navObserver?.observe(bottomNav);
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", handleOrientationChange);
    document.addEventListener("focusin", scheduleSettledUpdates);
    document.addEventListener("focusout", scheduleSettledUpdates);

    return () => {
      root.classList.remove("chat-viewport-active");
      body.classList.remove("chat-viewport-active");
      root.classList.remove("chat-keyboard-open", "chat-bottom-nav-visible");
      navObserver?.disconnect();
      cancelAnimationFrame(animationFrame);
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", handleOrientationChange);
      document.removeEventListener("focusin", scheduleSettledUpdates);
      document.removeEventListener("focusout", scheduleSettledUpdates);
    };
  }, []);

  return { height, keyboardOpen };
}

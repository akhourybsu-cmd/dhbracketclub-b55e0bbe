import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

/** Escapes the composer's scroll area and stays above the visible keyboard. */
export function ComposerPopover({
  anchor,
  children,
  width,
  id,
  label,
  role = "dialog",
}: {
  anchor: RefObject<HTMLElement>;
  children: ReactNode;
  width?: number;
  id?: string;
  label: string;
  role?: "dialog" | "listbox";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    left: 0,
    bottom: 0,
    width: 0,
    maxHeight: 0,
  });
  useLayoutEffect(() => {
    const measure = () => {
      const bounds = anchor.current?.getBoundingClientRect();
      if (!bounds) return;
      const size = Math.min(width || bounds.width, window.innerWidth - 24);
      setPosition({
        left: Math.max(
          12,
          Math.min(bounds.left, window.innerWidth - size - 12),
        ),
        bottom: window.innerHeight - bounds.top + 8,
        width: size,
        maxHeight: Math.max(
          80,
          bounds.top - (window.visualViewport?.offsetTop || 0) - 20,
        ),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (anchor.current) observer.observe(anchor.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [anchor, width]);
  return createPortal(
    <div
      ref={ref}
      id={id}
      role={role}
      aria-label={label}
      data-chat-composer-layer
      className="chat-composer-popover"
      style={{ ...position, visibility: position.width ? "visible" : "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}

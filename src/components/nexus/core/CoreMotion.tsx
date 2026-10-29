import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import type { CoreFeedbackEvent } from "@/hooks/useCoreFeedback";
import { Sparkles } from "lucide-react";

export function CoreAtmosphere() {
  return (
    <div className="nc-atmosphere" aria-hidden="true">
      <div className="nc-nebula" />
      <div className="nc-radar-orbit" />
      <div className="nc-scan-line" />
      {Array.from({ length: 16 }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--nc-i": i,
              left: `${(i * 37 + 11) % 100}%`,
              top: `${(i * 61 + 7) % 100}%`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function CoreCounter({
  value,
  digits = 0,
  fromZero = false,
}: {
  value: number;
  digits?: number;
  fromZero?: boolean;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(fromZero ? 0 : value);
  const previous = useRef(fromZero ? 0 : value);
  useEffect(() => {
    if (reduced) {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const from = previous.current,
      started = performance.now();
    if (from === value) return;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 650);
      const next = Math.round(
        from + (value - from) * (1 - (1 - progress) ** 3),
      );
      previous.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return (
    <span aria-label={String(value)}>
      <span aria-hidden="true">
        {digits
          ? String(display).padStart(digits, "0")
          : display.toLocaleString()}
      </span>
    </span>
  );
}

export function CoreFeedback({ event }: { event: CoreFeedbackEvent | null }) {
  if (!event) return null;
  return (
    <div key={event.id} className="nc-game-feedback" role="status">
      <Sparkles size={17} />
      <span>{event.label}</span>
      <div className="nc-feedback-burst" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ "--nc-i": i } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

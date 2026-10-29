import { useCallback, useEffect, useRef, useState } from "react";

export interface CoreFeedbackEvent {
  label: string;
  id: number;
}

export function useCoreFeedback() {
  const [feedback, setFeedback] = useState<CoreFeedbackEvent | null>(null);
  const sequence = useRef(0);
  const trigger = useCallback(
    (label: string) => setFeedback({ label, id: ++sequence.current }),
    [],
  );
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1600);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  return { feedback, trigger };
}

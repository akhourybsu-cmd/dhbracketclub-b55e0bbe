import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, SkipForward } from "lucide-react";
import { keyboardAction } from "@/lib/mesomon/input";
import { ArrivalArt } from "./cinematic/ArrivalArt";
import "./arrivalCinematic.css";

const SHOTS = [
  {
    id: "sea", duration: 7200, label: "Tavian Merrow", title: "Aboard the Wayfarer",
    caption: "I left at sixteen to chart the coast. I packed for one summer. That was four years ago.",
    description: "A ferry approaches the harbor.",
  },
  {
    id: "letter", duration: 5900, label: "Edda Venn · My old teacher", title: "“Come home. Bring the core.”",
    caption: "“The harbor is singing in two voices.”",
    description: "Tavian unfolds a letter at the rail.",
  },
  {
    id: "quay", duration: 6700, label: "Tavian Merrow", title: "Port Marche",
    caption: "I left my charts with the crew and took the first boat home. I’ve been looking for her lamp since dawn.",
    description: "The quay comes into view.",
  },
] as const;

interface ArrivalCinematicProps {
  reducedMotion: boolean;
  onFinish: () => void;
}

export function ArrivalCinematic({ reducedMotion, onFinish }: ArrivalCinematicProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const finished = useRef(false);
  const clock = useRef<{ index: number; remaining: number }>({ index: 0, remaining: SHOTS[0].duration });
  const shot = SHOTS[index];
  const lastShot = index === SHOTS.length - 1;

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  }, [onFinish]);

  const advance = useCallback(() => {
    if (finished.current) return;
    if (lastShot) finish();
    else setIndex(index + 1);
  }, [finish, index, lastShot]);

  useLayoutEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body)
        previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (clock.current.index !== index) clock.current = { index, remaining: shot.duration };
    if (reducedMotion || paused) return;

    const current = clock.current;
    let timer: number | undefined;
    let started = 0;
    function suspend() {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
      current.remaining = Math.max(0, current.remaining - (performance.now() - started));
    }
    function sync() {
      if (document.hidden) {
        suspend();
      } else if (timer === undefined) {
        started = performance.now();
        timer = window.setTimeout(() => {
          timer = undefined;
          advance();
        }, current.remaining);
      }
    }
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      suspend();
    };
  }, [advance, index, paused, reducedMotion, shot.duration]);

  // Dispatch on release so a held confirm/skip cannot also open the ship dialogue.
  const pressed = useRef(new Set<string>());
  useEffect(() => {
    const keys = pressed.current;
    function key(event: KeyboardEvent) {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Tab" && event.type === "keydown") {
        const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const active = document.activeElement;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && (active === first || active === panel.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      const action = keyboardAction(event.key);
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type === "keydown") {
        if (!event.repeat) keys.add(event.key.toLowerCase());
        return;
      }
      if (!keys.delete(event.key.toLowerCase())) return;
      if (action === "cancel") finish();
      if (action === "right") advance();
      if (action === "confirm") {
        const button = document.activeElement;
        if (button instanceof HTMLButtonElement && panel.current?.contains(button)) button.click();
        else advance();
      }
    }
    const release = () => keys.clear();
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", key, true);
      window.removeEventListener("blur", release);
    };
  }, [advance, finish]);

  return (
    <section className="mm-arrival" role="dialog" aria-modal="true" aria-label="Opening cinematic"
      tabIndex={-1} ref={panel} data-shot={shot.id} data-still={reducedMotion || undefined}
      data-paused={paused || undefined}>
      <div className="mm-arrival-frame" key={shot.id} aria-hidden="true">
        <ArrivalArt shot={shot.id} />
      </div>
      <div className="mm-arrival-top">
        <button type="button" className="mm-arrival-skip" onClick={finish}>
          Skip opening <SkipForward size={15} aria-hidden="true" />
        </button>
      </div>
      <footer className="mm-arrival-footer">
        <div className="mm-arrival-caption" aria-live="polite" aria-atomic="true">
          <div key={shot.id} className="mm-arrival-lines">
            <span className="mm-arrival-label">{shot.label}</span>
            <h2>{shot.title}</h2>
            <p>{shot.caption}</p>
            <span className="sr-only">{shot.description}</span>
          </div>
        </div>
        <div className="mm-arrival-controls">
          <div className="mm-arrival-reel" aria-label={`Scene ${index + 1} of ${SHOTS.length}`} role="img">
            {SHOTS.map((scene, i) => <i key={scene.id} data-lit={i <= index || undefined} />)}
          </div>
          {!reducedMotion && (
            <button type="button" className="mm-arrival-play" onClick={() => setPaused(value => !value)}
              aria-label={paused ? "Play opening" : "Pause opening"}>
              {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
          )}
          <button type="button" className="mm-arrival-next" aria-label={lastShot ? "Arrive at Port Marche" : "Next scene"}
            onClick={advance}>
            {lastShot ? "Arrive" : "Next"} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}

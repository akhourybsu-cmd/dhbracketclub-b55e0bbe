import { useEffect, useRef, type RefObject } from 'react';
import { stepRun, TICK_RATE, type RunState } from '../../../supabase/functions/_shared/arcade/riftwatch';
import { recordInput, type ReplayEvent } from '../../../supabase/functions/_shared/arcade/replay';
import type { ArcadeInputs } from '@/lib/riftwatch/controls';
import type { RiftPreferences } from '@/lib/riftwatch/preferences';
import { captureRiftwatchEvents, drawRiftwatch } from '@/lib/riftwatch/render';
import type { RiftwatchAudio } from '@/lib/riftwatch/audio';

export interface Flight {
  state: RunState;
  inputs: ReplayEvent[];
  recordable: boolean;
  mode: 'ranked' | 'practice';
  ticket?: { runId: string; expiresAt: string };
}
interface Props {
  flight: Flight;
  playing: boolean;
  best: number;
  settings: RiftPreferences;
  controls: ArcadeInputs;
  sound: RefObject<RiftwatchAudio>;
  onFinish: (flight: Flight) => void;
}

export function RiftField({ flight, playing, best, settings, controls, sound, onFinish }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;
  useEffect(() => {
    const view = viewport.current;
    const screen = canvas.current;
    if (!view || !screen) return;
    function resize() {
      const rect = view.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      const pixels = Math.max(1, Math.floor(Math.min(rect.width / 160, rect.height / 144) * dpr)) / dpr;
      screen.style.width = pixels * 160 + 'px';
      screen.style.height = pixels * 144 + 'px';
    }
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(view);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d', { alpha: false });
    if (!ctx) return;
    const options = { highScore: best, reducedMotion: settings.reducedMotion, highContrast: settings.highContrast };
    function draw() { drawRiftwatch(ctx, flight.state, options); }
    draw();
    if (!playing) return;
    const step = 1000 / TICK_RATE;
    let elapsed = 0;
    let previous: number | null = null;
    let handle = 0;
    function frame(time: number) {
      if (document.hidden) return;
      // Discard any stall beyond 120ms. The simulation never skips an authoritative tick.
      if (previous !== null) elapsed += Math.min(120, Math.max(0, time - previous));
      previous = time;
      while (elapsed + .000001 >= step && flight.state.phase !== 'over') {
        const mask = controls.read();
        if (flight.mode === 'ranked' && flight.recordable) flight.recordable = recordInput(flight.inputs, flight.state.tick, mask);
        stepRun(flight.state, mask);
        sound.current?.update(flight.state);
        captureRiftwatchEvents(flight.state);
        elapsed -= step;
      }
      draw();
      if (flight.state.phase === 'over') finish.current(flight);
      else handle = requestAnimationFrame(frame);
    }
    handle = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(handle); };
  }, [flight, playing, best, settings.highContrast, settings.reducedMotion, controls, sound]);
  return <div className="rw-playfield" ref={viewport}>
    <canvas aria-label="Riftwatch playfield" ref={canvas} width={160} height={144} />
  </div>;
}

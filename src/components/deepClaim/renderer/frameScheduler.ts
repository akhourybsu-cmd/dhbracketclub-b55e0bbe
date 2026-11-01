export interface CanvasFrameHost {
  now: () => number;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  setTimer: (callback: () => void, delay: number) => number;
  clearTimer: (id: number) => void;
}
export interface CanvasFrameOptions { enabled: boolean; reducedMotion: boolean; reducedGraphics: boolean }
/** Timers sleep between paints; RAF aligns just the due paint with the display. */
export class CanvasFrameScheduler {
  private frame: number | null = null;
  private timer: number | null = null;
  private nextPaintAt = -Infinity;
  private options: CanvasFrameOptions = { enabled: false, reducedMotion: false, reducedGraphics: false };
  paints = 0;
  wakeups = 0;
  constructor(private readonly host: CanvasFrameHost, private readonly paint: (time: number) => void) {}
  configure(next: CanvasFrameOptions) {
    const changed = next.enabled !== this.options.enabled || next.reducedMotion !== this.options.reducedMotion || next.reducedGraphics !== this.options.reducedGraphics;
    this.options = next;
    if (changed) { this.cancel(); this.nextPaintAt = -Infinity; }
  }
  invalidate() {
    if (!this.options.enabled || this.frame !== null || this.timer !== null) return;
    const wait = this.options.reducedMotion ? 0 : this.nextPaintAt - this.host.now();
    if (wait > 0) {
      // Browser timers may truncate fractional delays. Round UP and recheck
      // the deadline before requesting RAF, rather than waking one frame early.
      this.timer = this.host.setTimer(() => {
        this.timer = null;
        if (this.host.now() >= this.nextPaintAt) this.request(); else this.invalidate();
      }, Math.max(1, Math.ceil(wait)));
    } else this.request();
  }
  private request() {
    if (!this.options.enabled || this.frame !== null) return;
    this.frame = this.host.requestFrame(time => {
      this.frame = null; this.wakeups++;
      if (!this.options.enabled) return;
      const interval = this.options.reducedGraphics ? 1000 / 12 : 1000 / 30;
      // RAF's frame timestamp may precede actual callback execution. Timer
      // deadlines and gating must use the same monotonic clock to avoid an
      // early extra RAF on every paint; animations still receive frame time.
      const now = this.host.now();
      if (this.options.reducedMotion || now >= this.nextPaintAt) {
        // Keep the cadence anchored to deadlines, not delayed callback times.
        // Skip missed slots after a stall; never burst to catch up.
        this.nextPaintAt = Number.isFinite(this.nextPaintAt) ? this.nextPaintAt + interval : now + interval;
        if (this.nextPaintAt <= now) this.nextPaintAt += (Math.floor((now - this.nextPaintAt) / interval) + 1) * interval;
        this.paints++; this.paint(time);
      }
      if (!this.options.reducedMotion) this.invalidate();
    });
  }
  cancel() {
    if (this.frame !== null) this.host.cancelFrame(this.frame);
    if (this.timer !== null) this.host.clearTimer(this.timer);
    this.frame = null; this.timer = null;
  }
  dispose() { this.options.enabled = false; this.cancel(); }
}

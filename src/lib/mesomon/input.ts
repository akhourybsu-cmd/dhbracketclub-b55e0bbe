import type { InputAction } from './types';

const KEYS: Record<string, InputAction> = {
  ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  z: 'confirm', Z: 'confirm', Enter: 'confirm', ' ': 'confirm',
  x: 'cancel', X: 'cancel', Escape: 'cancel', Backspace: 'cancel', m: 'menu', M: 'menu',
};
export function keyboardAction(key: string): InputAction | null { return KEYS[key] ?? null; }
export function pointerAction(action: InputAction): InputAction { return action; }
export function isDirection(action: InputAction): action is 'up' | 'down' | 'left' | 'right' { return ['up', 'down', 'left', 'right'].includes(action); }

/** One 16-pixel step for direct controls, path following and sprite travel. */
export const WALK_STEP_MS = 200;

/** Keep one pending intent; changing direction or input device never buys another step. */
export function createWalkClock() {
  let nextAt = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: (() => void) | undefined;
  function cancel() {
    clearTimeout(timer);
    pending = undefined;
    timer = undefined;
  }
  function request(step: () => void) {
    cancel();
    pending = step;
    const run = () => {
      if (pending !== step) return;
      const now = performance.now();
      const remaining = nextAt - now;
      if (remaining > 0) {
        timer = setTimeout(run, Math.ceil(remaining));
        return;
      }
      cancel();
      nextAt = now + WALK_STEP_MS;
      step();
    };
    run();
    return () => { if (pending === step) cancel(); };
  }
  return { request, cancel };
}

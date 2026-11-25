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

import { useEffect, useRef } from 'react';
import { INPUT } from '../../../supabase/functions/_shared/arcade/riftwatch';
import type { PocketDirection } from '@/components/pocket/PocketHandheld';

type InputSource = 'touch' | 'keyboard' | 'gamepad';
export type MenuCommand = PocketDirection | 'confirm' | 'cancel' | 'menu';

export function keyInput(code: string) {
  switch (code) {
    case 'ArrowLeft': case 'KeyA': return INPUT.left;
    case 'ArrowRight': case 'KeyD': return INPUT.right;
    case 'KeyZ': case 'Space': case 'Enter': return INPUT.fire;
    case 'KeyX': case 'ShiftLeft': case 'ShiftRight': return INPUT.pulse;
    default: return 0;
  }
}

export function readGamepad(pad: Gamepad | undefined) {
  const pressed = (index: number) => pad?.buttons[index]?.pressed === true;
  const x = pad?.axes[0] ?? 0;
  const y = pad?.axes[1] ?? 0;
  const left = x < -.45 || pressed(14);
  const right = x > .45 || pressed(15);
  const fire = pressed(0);
  const pulse = pressed(1);
  return {
    mask: (left ? INPUT.left : 0) | (right ? INPUT.right : 0) | (fire ? INPUT.fire : 0) | (pulse ? INPUT.pulse : 0),
    left, right, up: y < -.45 || pressed(12), down: y > .45 || pressed(13),
    confirm: fire, cancel: pulse, menu: pressed(9),
  };
}

export class ArcadeInputs {
  private sources: Record<InputSource, number> = { touch: 0, keyboard: 0, gamepad: 0 };
  private latched = 0;
  set(source: InputSource, mask: number) {
    // Preserve a short button tap across the gap between two simulation ticks.
    const before = this.sources[source];
    this.latched |= (mask & ~before) & (INPUT.fire | INPUT.pulse);
    this.sources[source] = mask;
  }
  tap(bit: number) { this.latched |= bit; }
  touch(bit: number, pressed: boolean) {
    this.set('touch', pressed ? this.sources.touch | bit : this.sources.touch & ~bit);
  }
  move(direction: PocketDirection | null) {
    const horizontal = direction === 'left' ? INPUT.left : direction === 'right' ? INPUT.right : 0;
    this.set('touch', (this.sources.touch & ~(INPUT.left | INPUT.right)) | horizontal);
  }
  read() {
    let mask = this.latched | this.sources.touch | this.sources.keyboard | this.sources.gamepad;
    this.latched = 0;
    if ((mask & INPUT.left) && (mask & INPUT.right)) mask &= ~(INPUT.left | INPUT.right);
    return mask;
  }
  clear() {
    this.latched = 0;
    this.sources = { touch: 0, keyboard: 0, gamepad: 0 };
  }
}

export function useArcadeControls(playing: boolean, onCommand: (key: MenuCommand) => void, onInactive: () => void) {
  const inputs = useRef(new ArcadeInputs());
  const actions = useRef({ playing, onCommand, onInactive });
  actions.current = { playing, onCommand, onInactive };
  useEffect(() => {
    const keys = new Set<string>();
    const port = inputs.current;
    let padState = readGamepad(undefined);
    let blockHeldPad = false;
    let timer = 0;
    const updateKeys = () => port.set('keyboard', [...keys].reduce((mask, code) => mask | keyInput(code), 0));
    function keyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const { onCommand, playing } = actions.current;
      const code = event.code || event.key;
      if (playing) {
        const bit = keyInput(code);
        if (bit) { event.preventDefault(); keys.add(code); updateKeys(); }
        else if (code === 'Escape' || code === 'KeyM') {
          event.preventDefault();
          if (!event.repeat) onCommand('menu');
        }
        return;
      }
      if (event.repeat && (code === 'Space' || code === 'Enter')) { event.preventDefault(); return; }
      if (event.target instanceof HTMLInputElement && event.target.type === 'range' && code.startsWith('Arrow')) return;
      const commands: Record<string, MenuCommand> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        KeyZ: 'confirm', KeyX: 'cancel', Escape: 'cancel', KeyM: 'menu' };
      const command = commands[code];
      if (command) { event.preventDefault(); if (!event.repeat) onCommand(command); }
      // Enter and Space on menu controls retain native keyboard activation.
    }
    function keyUp(event: KeyboardEvent) {
      if (keys.delete(event.code || event.key)) { event.preventDefault(); updateKeys(); }
    }
    let previousPlaying = actions.current.playing;
    function sample() {
      let pad: Gamepad | undefined;
      try { pad = Array.from(navigator.getGamepads?.() ?? []).find(item => item?.connected && item.mapping === 'standard'); }
      catch { /* Some embedded browsers deny gamepad access. */ }
      const next = readGamepad(pad);
      if (previousPlaying !== actions.current.playing) {
        if (!actions.current.playing) { keys.clear(); port.set('keyboard', 0); }
        previousPlaying = actions.current.playing;
        if (previousPlaying && padState.confirm) blockHeldPad = true;
      }
      if (!next.mask) blockHeldPad = false;
      port.set('gamepad', actions.current.playing && !blockHeldPad ? next.mask : 0);
      for (const key of ['menu','cancel','confirm','left','right','up','down'] as const) {
        if (next[key] && !padState[key] && (key === 'menu' || !actions.current.playing)) {
          actions.current.onCommand(key);
          break;
        }
      }
      padState = next;
      if (!document.hidden) timer = window.setTimeout(sample, pad ? 16 : 150);
    }
    function clear() {
      keys.clear(); port.clear();
      blockHeldPad = true;
      actions.current.onInactive();
    }
    function visibility() {
      window.clearTimeout(timer);
      if (document.hidden) clear();
      else sample();
    }
    sample();
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      port.clear();
    };
  }, []);
  return inputs.current;
}
